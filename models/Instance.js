/**
 * Instance Model — CRUD operations for WhatsApp instances
 */

const { getDb } = require('../config/database');

class Instance {
  /**
   * Create a new instance record
   */
  static create(id, name, userId) {
    const db = getDb();
    const stmt = db.prepare(
      'INSERT INTO instances (id, name, user_id, status) VALUES (?, ?, ?, ?)'
    );
    stmt.run(id, name, userId, 'disconnected');
    return Instance.findById(id);
  }

  /**
   * Find instance by ID
   */
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  }

  /**
   * List all instances for a user
   */
  static findByUserId(userId) {
    const db = getDb();
    return db.prepare(
      'SELECT id, name, phone, status, created_at FROM instances WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);
  }

  /**
   * List ALL instances (admin)
   */
  static findAll() {
    const db = getDb();
    return db.prepare(
      'SELECT id, name, phone, status, created_at, user_id FROM instances ORDER BY created_at DESC'
    ).all();
  }

  /**
   * Update instance status
   */
  static updateStatus(id, status, phone = null) {
    const db = getDb();
    if (phone) {
      db.prepare('UPDATE instances SET status = ?, phone = ? WHERE id = ?').run(status, phone, id);
    } else {
      db.prepare('UPDATE instances SET status = ? WHERE id = ?').run(status, id);
    }
  }

  /**
   * Update QR code for an instance
   */
  static updateQrCode(id, qrCode) {
    const db = getDb();
    db.prepare('UPDATE instances SET qr_code = ?, status = ? WHERE id = ?').run(qrCode, 'qr', id);
  }

  /**
   * Update webhook URL
   */
  static updateWebhook(id, webhookUrl) {
    const db = getDb();
    db.prepare('UPDATE instances SET webhook_url = ? WHERE id = ?').run(webhookUrl, id);
  }

  /**
   * Delete an instance
   */
  static delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM instances WHERE id = ?').run(id);
  }

  /**
   * Count instances created by a user in the last hour (for rate limiting)
   */
  static countRecentByUser(userId) {
    const db = getDb();
    const result = db.prepare(
      "SELECT COUNT(*) as count FROM instances WHERE user_id = ? AND created_at > datetime('now', '-1 hour')"
    ).get(userId);
    return result.count;
  }

  /**
   * Get all connected/active instances (for session restore)
   */
  static findActive() {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM instances WHERE status IN ('connected', 'disconnected')"
    ).all();
  }
}

module.exports = Instance;
