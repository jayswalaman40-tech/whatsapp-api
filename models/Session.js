/**
 * Session Model — WhatsApp session persistence
 * Stores session auth data so WhatsApp stays logged in across server restarts.
 */

const { getDb } = require('../config/database');

class Session {
  /**
   * Save or update session data for an instance
   */
  static upsert(instanceId, sessionData) {
    const db = getDb();
    const dataString = typeof sessionData === 'string'
      ? sessionData
      : JSON.stringify(sessionData);

    const stmt = db.prepare(`
      INSERT INTO sessions (instance_id, session_data, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(instance_id) DO UPDATE SET
        session_data = excluded.session_data,
        updated_at = datetime('now')
    `);
    stmt.run(instanceId, dataString);
  }

  /**
   * Get session data for an instance
   */
  static findByInstanceId(instanceId) {
    const db = getDb();
    const row = db.prepare(
      'SELECT * FROM sessions WHERE instance_id = ?'
    ).get(instanceId);

    if (row && row.session_data) {
      try {
        row.session_data = JSON.parse(row.session_data);
      } catch (e) {
        // Already a string, keep as is
      }
    }
    return row;
  }

  /**
   * Delete session data
   */
  static delete(instanceId) {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE instance_id = ?').run(instanceId);
  }

  /**
   * Get all saved sessions (for restore on startup)
   */
  static findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM sessions').all();
  }
}

module.exports = Session;
