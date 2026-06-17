const path = require('path');
const fs = require('fs');

let db;

function getDb() {
  if (db) return db;

  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'mysql') {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'maintenance_dispatch',
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
    });

    // Wrap pool to match the sqlite API shape used throughout the app
    db = {
      type: 'mysql',
      pool,
      async run(sql, params = []) {
        const [result] = await pool.execute(sql, params);
        return { lastID: result.insertId, changes: result.affectedRows };
      },
      async get(sql, params = []) {
        const [rows] = await pool.execute(sql, params);
        return rows[0] || null;
      },
      async all(sql, params = []) {
        const [rows] = await pool.execute(sql, params);
        return rows;
      },
    };
  } else {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'data', 'dispatch.db');
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    // Wrap synchronous sqlite3 to expose the same async API
    db = {
      type: 'sqlite',
      sqlite,
      async run(sql, params = []) {
        const stmt = sqlite.prepare(sql);
        const result = stmt.run(params);
        return { lastID: result.lastInsertRowid, changes: result.changes };
      },
      async get(sql, params = []) {
        const stmt = sqlite.prepare(sql);
        return stmt.get(params) || null;
      },
      async all(sql, params = []) {
        const stmt = sqlite.prepare(sql);
        return stmt.all(params);
      },
    };
  }

  return db;
}

async function initDb() {
  const d = getDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  if (d.type === 'sqlite') {
    // SQLite: execute all statements at once
    d.sqlite.exec(schema);
  } else {
    // MySQL: split on ; and run each statement
    const stmts = schema
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of stmts) {
      // Convert SQLite-specific syntax to MySQL
      const mysqlStmt = stmt
        .replace(/AUTOINCREMENT/g, 'AUTO_INCREMENT')
        .replace(/INTEGER PRIMARY KEY AUTO_INCREMENT/g, 'INT AUTO_INCREMENT PRIMARY KEY')
        .replace(/INSERT OR IGNORE/g, 'INSERT IGNORE')
        .replace(/TEXT/g, 'TEXT')
        .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP');
      try {
        await d.pool.execute(mysqlStmt);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('Duplicate entry')) {
          throw err;
        }
      }
    }
  }

  console.log(`[DB] Initialized (${d.type})`);
  return d;
}

module.exports = { getDb, initDb };
