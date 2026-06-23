const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/pricing.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let SQL;
let dbInstance;
let saveTimer = null;

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  // Debounce writes — sql.js is in-memory, we save the file async
  saveTimer = setTimeout(() => {
    try {
      const data = dbInstance.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (e) {
      console.error('DB persist failed:', e.message);
    }
  }, 100);
}

async function init() {
  if (dbInstance) return dbInstance;
  SQL = await initSqlJs();

  let existing = null;
  if (fs.existsSync(dbPath)) {
    try {
      existing = fs.readFileSync(dbPath);
    } catch (e) {
      console.warn('Could not read existing DB, starting fresh:', e.message);
    }
  }

  dbInstance = existing ? new SQL.Database(existing) : new SQL.Database();

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      zip_pattern TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      label TEXT,
      priority INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_rules_product ON pricing_rules(product_id);
    CREATE INDEX IF NOT EXISTS idx_rules_active ON pricing_rules(active);

    CREATE TABLE IF NOT EXISTS zip_lookups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT,
      variant_id TEXT,
      zip_code TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      rule_id INTEGER,
      matched INTEGER DEFAULT 0,
      user_agent TEXT,
      shop_domain TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lookups_zip ON zip_lookups(zip_code);
    CREATE INDEX IF NOT EXISTS idx_lookups_product ON zip_lookups(product_id);
    CREATE INDEX IF NOT EXISTS idx_lookups_created ON zip_lookups(created_at);

    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      title TEXT,
      base_price_cents INTEGER,
      synced_at TEXT DEFAULT (datetime('now'))
    );
  `);

  persist();
  return dbInstance;
}

// Synchronous-ish API to mimic better-sqlite3 for minimal code changes.
// All methods return promises; routes are already async-friendly.
const db = {
  init,
  prepare(sql) {
    if (!dbInstance) throw new Error('DB not initialized — call db.init() first');
    const stmt = dbInstance.prepare(sql);

    return {
      run(...params) {
        stmt.run(params);
        const changes = dbInstance.getRowsModified();
        const lastId = dbInstance.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] || 0;
        persist();
        return { changes, lastInsertRowid: lastId };
      },
      all(...params) {
        stmt.bind(params);
        const out = [];
        while (stmt.step()) out.push(stmt.getAsObject());
        stmt.reset();
        return out;
      },
      get(...params) {
        stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : null;
        stmt.reset();
        return row;
      },
      free() { stmt.free(); }
    };
  },
  exec(sql) {
    if (!dbInstance) throw new Error('DB not initialized');
    dbInstance.exec(sql);
    persist();
  },
  transaction(fn) {
    if (!dbInstance) throw new Error('DB not initialized');
    return (...args) => {
      dbInstance.exec('BEGIN');
      try {
        const result = fn(...args);
        dbInstance.exec('COMMIT');
        return result;
      } catch (e) {
        dbInstance.exec('ROLLBACK');
        throw e;
      }
    };
  }
};

module.exports = db;