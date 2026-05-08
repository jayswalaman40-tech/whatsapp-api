/**
 * WhatsApp / Baileys Configuration
 * Settings for @whiskeysockets/baileys client instances.
 */

const path = require('path');
const fs = require('fs');

// Session storage path
const SESSION_PATH = process.env.SESSION_PATH || './sessions';

// Ensure sessions directory exists
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
  console.log(`📁 Created sessions directory: ${SESSION_PATH}`);
}

/**
 * Baileys configuration options
 */
const clientConfig = {
  printQRInTerminal: false,
  browser: ['Antigravity', 'Chrome', '1.0.0'],
  auth: null, // Will be set per instance
  logger: require('pino')({ level: 'error' })
};

/**
 * Get the session file path for an instance
 */
function getSessionPath(instanceId) {
  return path.join(SESSION_PATH, instanceId);
}

// QR code auto-cleanup timeout (60 seconds)
const QR_TIMEOUT_MS = 60000;

// Auto-reconnect delay (5 seconds)
const RECONNECT_DELAY_MS = 5000;

module.exports = {
  SESSION_PATH,
  clientConfig,
  getSessionPath,
  QR_TIMEOUT_MS,
  RECONNECT_DELAY_MS
};
