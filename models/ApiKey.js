/**
 * ApiKey Model — CRUD operations for API keys
 */

const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ApiKey {
  /**
   * Generate a new API key for a user
   */
  static create(name, userId) {
    const db = getDb();
    // Generate a prefixed API key: wapi_<uuid>
    const key = `wapi_${uuidv4().replace(/-/g, '')}`;

    const stmt = db.prepare(
      'INSERT INTO api_keys (key, name, user_id) VALUES (?, ?, ?)'
    );
    const result = stmt.run(key, name, userId);

    return {
      id: result.lastInsertRowid,
      key,
      name,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Find API key record by key string
   */
  static findByKey(key) {
    const db = getDb();
    return db.prepare(
      'SELECT ak.*, u.username FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key = ?'
    ).get(key);
  }

  /**
   * List all API keys for a user (keys are masked for security)
   */
  static findByUserId(userId) {
    const db = getDb();
    const keys = db.prepare(
      'SELECT id, key, name, created_at, last_used FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);

    // Mask the key (show only first 8 and last 4 chars)
    return keys.map(k => ({
      ...k,
      key_masked: k.key.substring(0, 8) + '...' + k.key.substring(k.key.length - 4),
      key_full: k.key
    }));
  }

  /**
   * Update last_used timestamp
   */
  static updateLastUsed(id) {
    const db = getDb();
    db.prepare("UPDATE api_keys SET last_used = datetime('now') WHERE id = ?").run(id);
  }

  /**
   * Delete an API key
   */
  static delete(id, userId) {
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM api_keys WHERE id = ? AND user_id = ?'
    ).run(id, userId);
    return result.changes > 0;
  }
}

module.exports = ApiKey;
