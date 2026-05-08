/**
 * Message Controller — Send/receive messages and manage webhooks
 */

const Instance = require('../models/Instance');
const validator = require('validator');

/**
 * POST /api/message/send
 * Send a text message
 */
async function sendMessage(req, res) {
  try {
    const { instanceId, to, message } = req.body;

    // Validation
    if (!instanceId || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'instanceId, to, and message are required.',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate phone number format (basic check)
    const phoneDigits = to.replace(/[@c.us@g.us\D]/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Use international format (e.g., 919876543210@c.us)',
        code: 'INVALID_PHONE'
      });
    }

    // Get the WhatsApp service instance
    const service = req.sessionManager.getInstance(instanceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found or not running.',
        code: 'INSTANCE_NOT_FOUND'
      });
    }

    const result = await service.sendTextMessage(to, message);

    res.json(result);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to send message.',
      code: 'SEND_FAILED'
    });
  }
}

/**
 * POST /api/message/send-media
 * Send a media message (image, video, document)
 */
async function sendMedia(req, res) {
  try {
    const { instanceId, to, mediaUrl, caption } = req.body;

    // Validation
    if (!instanceId || !to || !mediaUrl) {
      return res.status(400).json({
        success: false,
        error: 'instanceId, to, and mediaUrl are required.',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate URL
    if (!validator.isURL(mediaUrl, { protocols: ['http', 'https'] })) {
      return res.status(400).json({
        success: false,
        error: 'Invalid media URL. Must be a valid HTTP/HTTPS URL.',
        code: 'INVALID_URL'
      });
    }

    // Get the WhatsApp service
    const service = req.sessionManager.getInstance(instanceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found or not running.',
        code: 'INSTANCE_NOT_FOUND'
      });
    }

    const result = await service.sendMediaMessage(to, mediaUrl, caption || '');

    res.json(result);
  } catch (err) {
    console.error('Send media error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to send media.',
      code: 'SEND_FAILED'
    });
  }
}

/**
 * GET /api/chats/:instanceId
 * Get all chats for an instance
 */
async function getChats(req, res) {
  try {
    const { instanceId } = req.params;

    const service = req.sessionManager.getInstance(instanceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found or not running.',
        code: 'INSTANCE_NOT_FOUND'
      });
    }

    const chats = await service.getChats();

    res.json({
      success: true,
      data: chats
    });
  } catch (err) {
    console.error('Get chats error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to get chats.',
      code: 'FETCH_FAILED'
    });
  }
}

/**
 * GET /api/messages/:instanceId/:chatId
 * Get messages from a specific chat
 */
async function getMessages(req, res) {
  try {
    const { instanceId, chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const service = req.sessionManager.getInstance(instanceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found or not running.',
        code: 'INSTANCE_NOT_FOUND'
      });
    }

    const messages = await service.getMessages(chatId, limit);

    res.json({
      success: true,
      data: messages
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to get messages.',
      code: 'FETCH_FAILED'
    });
  }
}

/**
 * POST /api/webhook/set
 * Set webhook URL for an instance
 */
async function setWebhook(req, res) {
  try {
    const { instanceId, url } = req.body;

    if (!instanceId || !url) {
      return res.status(400).json({
        success: false,
        error: 'instanceId and url are required.',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate URL
    if (!validator.isURL(url, { protocols: ['http', 'https'] })) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook URL.',
        code: 'INVALID_URL'
      });
    }

    // Verify instance exists
    const instance = Instance.findById(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found.',
        code: 'NOT_FOUND'
      });
    }

    Instance.updateWebhook(instanceId, url);

    console.log(`🔔 Webhook set for ${instanceId}: ${url}`);

    res.json({
      success: true,
      data: {
        instanceId,
        webhookUrl: url,
        message: 'Webhook URL set successfully.'
      }
    });
  } catch (err) {
    console.error('Set webhook error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to set webhook.',
      code: 'SERVER_ERROR'
    });
  }
}

module.exports = { sendMessage, sendMedia, getChats, getMessages, setWebhook };
