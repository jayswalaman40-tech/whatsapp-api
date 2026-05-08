/**
 * Database Configuration — SQLite3 with better-sqlite3
 * Synchronous, fast, and perfect for single-server deployments.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

/**
 * Initialize the database connection and create tables if they don't exist.
 */
function initDatabase() {
  const dbPath = process.env.DATABASE_PATH || './data/whatsapp.db';
  const dbDir = path.dirname(dbPath);

  // Auto-create the data directory
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`📁 Created database directory: ${dbDir}`);
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create all tables
  createTables();

  console.log(`✅ Database initialized at ${dbPath}`);
  return db;
}

/**
 * Create all required tables (idempotent — safe to call multiple times)
 */
function createTables() {
  db.exec(`
    -- Users table (admin accounts)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- WhatsApp instances
    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      status TEXT DEFAULT 'disconnected',
      qr_code TEXT,
      webhook_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- API keys for authentication
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- WhatsApp session data (for persistence across restarts)
    CREATE TABLE IF NOT EXISTS sessions (
      instance_id TEXT PRIMARY KEY,
      session_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    -- Webhooks configuration
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT DEFAULT 'all',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );
  `);
}

/**
 * Get the database instance
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection gracefully
 */
function closeDatabase() {
  if (db) {
    db.close();
    console.log('🔒 Database connection closed');
  }
}

module.exports = { initDatabase, getDb, closeDatabase };
