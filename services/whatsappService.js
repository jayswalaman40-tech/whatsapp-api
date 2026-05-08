/**
 * WhatsApp Service — Core WhatsApp client management using Baileys
 * Handles individual @whiskeysockets/baileys instances, QR codes,
 * session persistence, messaging, and webhook dispatch.
 */

const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore,
  makeInMemoryStore
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const { clientConfig, getSessionPath, QR_TIMEOUT_MS, RECONNECT_DELAY_MS } = require('../config/whatsapp');
const Instance = require('../models/Instance');
const Session = require('../models/Session');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const pino = require('pino');

class WhatsAppService {
  /**
   * @param {string} instanceId - Unique instance identifier
   * @param {object} io - Socket.io server instance
   */
  constructor(instanceId, io) {
    this.instanceId = instanceId;
    this.io = io;
    this.sock = null;
    this.qrTimeout = null;
    this.isReady = false;
    this.isDestroyed = false;
    this.logger = pino({ level: 'error' });
    
    // Create a store to track chats and messages
    this.store = makeInMemoryStore({ logger: this.logger });
  }

  /**
   * Initialize the WhatsApp client with Baileys socket
   */
  async initialize() {
    console.log(`🔄 [${this.instanceId}] Initializing Baileys WhatsApp client...`);
    
    try {
      const { state, saveCreds } = await useMultiFileAuthState(getSessionPath(this.instanceId));
      console.log(`📂 [${this.instanceId}] Auth state loaded from ${getSessionPath(this.instanceId)}`);
      
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`📡 [${this.instanceId}] Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

      this.sock = makeWASocket({
        ...clientConfig,
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.logger),
        },
      });
      console.log(`🚀 [${this.instanceId}] Socket created`);

      // Bind store to socket
      this.store.bind(this.sock.ev);
      console.log(`📦 [${this.instanceId}] Store bound`);

    // Save credentials whenever they are updated
    this.sock.ev.on('creds.update', saveCreds);

    // Connection update listener
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR Code
      if (qr) {
        console.log(`📱 [${this.instanceId}] QR code generated`);
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
          });
          Instance.updateQrCode(this.instanceId, qrDataUrl);
          this.io.emit(`qr:${this.instanceId}`, {
            instanceId: this.instanceId,
            qr: qrDataUrl,
            status: 'qr'
          });
          this._startQrTimeout();
        } catch (err) {
          console.error(`❌ [${this.instanceId}] QR generation error:`, err);
        }
      }

      // Handle Connection Status
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`❌ [${this.instanceId}] Connection closed due to:`, lastDisconnect?.error, ', reconnecting:', shouldReconnect);
        
        this.isReady = false;
        Instance.updateStatus(this.instanceId, 'disconnected');
        this.io.emit(`status:${this.instanceId}`, {
          instanceId: this.instanceId,
          status: 'disconnected'
        });

        if (shouldReconnect && !this.isDestroyed) {
          this.initialize();
        }
      } else if (connection === 'open') {
        console.log(`✅ [${this.instanceId}] WhatsApp connection is open!`);
        this.isReady = true;
        this._clearQrTimeout();
        
        const phone = this.sock.user?.id?.split(':')[0] || 'unknown';
        Instance.updateStatus(this.instanceId, 'connected', phone);
        this.io.emit(`status:${this.instanceId}`, {
          instanceId: this.instanceId,
          status: 'connected',
          phone: phone
        });
      }
    });

    // Incoming message listener
    this.sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe) {
            console.log(`📩 [${this.instanceId}] Message from ${msg.key.remoteJid}: ${msg.message?.conversation || 'media message'}`);
            
            const messageData = {
              instanceId: this.instanceId,
              from: msg.key.remoteJid,
              to: this.sock.user.id,
              body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
              timestamp: msg.messageTimestamp,
              type: this._getMessageType(msg.message),
              hasMedia: !!(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage),
              isGroup: msg.key.remoteJid.endsWith('@g.us')
            };

            this._dispatchWebhook('message', messageData);
            this.io.emit(`message:${this.instanceId}`, messageData);
          }
        }
      }
    });
    } catch (err) {
      console.error(`❌ [${this.instanceId}] Initialization failed:`, err);
      Instance.updateStatus(this.instanceId, 'error');
      this.io.emit(`status:${this.instanceId}`, {
        instanceId: this.instanceId,
        status: 'error',
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Helper to determine message type
   */
  _getMessageType(message) {
    if (!message) return 'unknown';
    if (message.conversation || message.extendedTextMessage) return 'chat';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.documentMessage) return 'document';
    if (message.audioMessage) return 'audio';
    return 'other';
  }

  /**
   * Send a text message
   */
  async sendTextMessage(to, message) {
    this._ensureReady();
    const jid = this._formatJid(to);

    try {
      const result = await this.sock.sendMessage(jid, { text: message });
      console.log(`📤 [${this.instanceId}] Message sent to ${jid}`);

      return {
        success: true,
        data: {
          id: result.key.id,
          to: jid,
          body: message,
          timestamp: result.messageTimestamp,
          status: 'sent'
        }
      };
    } catch (err) {
      console.error(`❌ [${this.instanceId}] Send message error:`, err);
      throw new Error(`Failed to send message: ${err.message}`);
    }
  }

  /**
   * Send a media message (image, video, document)
   */
  async sendMediaMessage(to, mediaUrl, caption = '', type = 'image') {
    this._ensureReady();
    const jid = this._formatJid(to);

    try {
      let content = { caption };
      
      if (type === 'image') content.image = { url: mediaUrl };
      else if (type === 'video') content.video = { url: mediaUrl };
      else if (type === 'document') content.document = { url: mediaUrl };
      else throw new Error('Unsupported media type');

      const result = await this.sock.sendMessage(jid, content);
      console.log(`📤 [${this.instanceId}] ${type} sent to ${jid}`);

      return {
        success: true,
        data: {
          id: result.key.id,
          to: jid,
          caption: caption,
          timestamp: result.messageTimestamp,
          status: 'sent'
        }
      };
    } catch (err) {
      console.error(`❌ [${this.instanceId}] Send media error:`, err);
      throw new Error(`Failed to send media: ${err.message}`);
    }
  }

  /**
   * Get all chats from store
   */
  async getChats() {
    this._ensureReady();
    const chats = this.store.chats.all();
    return chats.map(chat => ({
      id: chat.id,
      name: chat.name || chat.id,
      unreadCount: chat.unreadCount || 0,
      timestamp: chat.conversationTimestamp || 0
    }));
  }

  /**
   * Get messages from store
   */
  async getMessages(chatId, limit = 50) {
    this._ensureReady();
    const jid = this._formatJid(chatId);
    const messages = this.store.messages[jid]?.array.slice(-limit) || [];
    
    return messages.map(msg => ({
      id: msg.key.id,
      from: msg.key.remoteJid,
      body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
      timestamp: msg.messageTimestamp,
      fromMe: msg.key.fromMe
    }));
  }

  /**
   * Get connection status
   */
  getStatus() {
    const instance = Instance.findById(this.instanceId);
    return {
      instanceId: this.instanceId,
      status: instance?.status || 'unknown',
      phone: instance?.phone || null,
      isReady: this.isReady
    };
  }

  /**
   * Destroy the client and cleanup
   */
  async destroy() {
    console.log(`🗑️ [${this.instanceId}] Destroying client...`);
    this.isDestroyed = true;
    this._clearQrTimeout();

    try {
      if (this.sock) {
        this.sock.end();
      }
    } catch (err) {
      console.error(`⚠️ [${this.instanceId}] Error during destroy:`, err.message);
    }

    this.sock = null;
    this.isReady = false;
  }

  // ---- Private Methods ----

  /**
   * Start QR timeout — auto-cleanup if not scanned
   */
  _startQrTimeout() {
    this._clearQrTimeout();
    this.qrTimeout = setTimeout(async () => {
      console.log(`⏰ [${this.instanceId}] QR timeout — cleaning up`);
      Instance.updateStatus(this.instanceId, 'timeout');
      this.io.emit(`status:${this.instanceId}`, {
        instanceId: this.instanceId,
        status: 'timeout',
        message: 'QR code expired. Please create a new instance.'
      });
      await this.destroy();
    }, QR_TIMEOUT_MS);
  }

  /**
   * Clear QR timeout
   */
  _clearQrTimeout() {
    if (this.qrTimeout) {
      clearTimeout(this.qrTimeout);
      this.qrTimeout = null;
    }
  }

  /**
   * Ensure the client is ready before performing actions
   */
  _ensureReady() {
    if (!this.isReady || !this.sock) {
      throw new Error('WhatsApp client is not ready. Please scan QR code first.');
    }
  }

  /**
   * Format JID — ensures proper @s.whatsapp.net or @g.us suffix
   */
  _formatJid(to) {
    if (to.includes('@')) return to;
    const digits = to.replace(/\D/g, '');
    return `${digits}@s.whatsapp.net`;
  }

  /**
   * Dispatch incoming message to webhook URL
   */
  async _dispatchWebhook(event, data) {
    try {
      const instance = Instance.findById(this.instanceId);
      if (!instance?.webhook_url) return;

      const timeout = parseInt(process.env.WEBHOOK_TIMEOUT) || 5000;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      await fetch(instance.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          instanceId: this.instanceId,
          data,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`🔔 [${this.instanceId}] Webhook dispatched to ${instance.webhook_url}`);
    } catch (err) {
      console.error(`⚠️ [${this.instanceId}] Webhook dispatch failed:`, err.message);
    }
  }
}

module.exports = WhatsAppService;
