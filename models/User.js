/**
 * User Model — CRUD operations for the users table
 */

const { getDb } = require('../config/database');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

class User {
  /**
   * Create a new user (with bcrypt hashed password)
   */
  static create(username, password) {
    const db = getDb();
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

    const stmt = db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    );

    try {
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint')) {
        throw new Error('Username already exists');
      }
      throw err;
    }
  }

  /**
   * Find user by username
   */
  static findByUsername(username) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  /**
   * Find user by ID
   */
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(id);
  }

  /**
   * Verify password against stored hash
   */
  static verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  /**
   * Check if any users exist (for first-time setup)
   */
  static count() {
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
    return result.count;
  }
}

module.exports = User;
