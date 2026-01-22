const mysql = require('mysql2/promise');
const Database = require('better-sqlite3');
const path = require('path');

// MariaDB connection pool
const mariaPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'panel_admin',
    password: process.env.DB_PASSWORD || 'change_this_password',
    database: process.env.DB_NAME || 'hosting_panel',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// SQLite for panel metadata
const sqliteDb = new Database(path.join(__dirname, '../../data/panel.db'));

// Initialize SQLite schema
const initSqlite = () => {
    sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      backup_codes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS websites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      domain TEXT NOT NULL,
      runtime TEXT NOT NULL,
      php_version TEXT,
      port INTEGER,
      status TEXT DEFAULT 'stopped',
      auto_start INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_id INTEGER,
      domain TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    CREATE TABLE IF NOT EXISTS ssl_certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      expires_at DATETIME,
      auto_renew INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_id INTEGER,
      backup_path TEXT NOT NULL,
      size_bytes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    CREATE TABLE IF NOT EXISTS cron_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_id INTEGER,
      command TEXT NOT NULL,
      schedule TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    CREATE TABLE IF NOT EXISTS git_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_id INTEGER,
      repo_url TEXT NOT NULL,
      branch TEXT DEFAULT 'main',
      deploy_key TEXT,
      auto_pull INTEGER DEFAULT 0,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_id INTEGER,
      event TEXT NOT NULL,
      url TEXT,
      command TEXT,
      enabled INTEGER DEFAULT 1,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    CREATE TABLE IF NOT EXISTS ftp_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_id INTEGER,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      quota_mb INTEGER DEFAULT 1024,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    CREATE TABLE IF NOT EXISTS redis_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_id INTEGER,
      port INTEGER UNIQUE NOT NULL,
      password TEXT,
      max_memory_mb INTEGER DEFAULT 64,
      status TEXT DEFAULT 'stopped',
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    CREATE TABLE IF NOT EXISTS email_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      quota_mb INTEGER DEFAULT 1024,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

initSqlite();

module.exports = {
    mariaPool,
    sqliteDb
};
