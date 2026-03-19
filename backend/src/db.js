// Pygmy CMS — SQLite database setup + schema
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '../pygmy.db')

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    UNIQUE NOT NULL,
    password    TEXT    NOT NULL,
    name        TEXT    NOT NULL DEFAULT 'Admin',
    role        TEXT    NOT NULL DEFAULT 'admin',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    slug        TEXT    UNIQUE NOT NULL,
    content     TEXT    NOT NULL DEFAULT '',
    meta_title  TEXT,
    meta_desc   TEXT,
    status      TEXT    NOT NULL DEFAULT 'draft',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    slug        TEXT    UNIQUE NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    slug        TEXT    UNIQUE NOT NULL,
    excerpt     TEXT,
    content     TEXT    NOT NULL DEFAULT '',
    cover_image TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    tags        TEXT    NOT NULL DEFAULT '[]',
    status      TEXT    NOT NULL DEFAULT 'draft',
    published_at TEXT,
    meta_title  TEXT,
    meta_desc   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filename    TEXT    NOT NULL,
    original    TEXT    NOT NULL,
    mime_type   TEXT    NOT NULL,
    size        INTEGER NOT NULL,
    width       INTEGER,
    height      INTEGER,
    alt         TEXT    DEFAULT '',
    url         TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS navigation (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    target      TEXT    NOT NULL DEFAULT '_self',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    parent_id   INTEGER REFERENCES navigation(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_name TEXT    NOT NULL,
    author_email TEXT   NOT NULL,
    content     TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    slug       TEXT    UNIQUE NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    slug        TEXT    UNIQUE NOT NULL,
    excerpt     TEXT,
    description TEXT    NOT NULL DEFAULT '',
    price       REAL,
    sale_price  REAL,
    sku         TEXT,
    cover_image TEXT,
    gallery     TEXT    NOT NULL DEFAULT '[]',
    category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
    tags        TEXT    NOT NULL DEFAULT '[]',
    status      TEXT    NOT NULL DEFAULT 'draft',
    featured    INTEGER NOT NULL DEFAULT 0,
    meta_title  TEXT,
    meta_desc   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS form_submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL,
    subject     TEXT    NOT NULL DEFAULT '',
    message     TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'unread',
    ip          TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type  TEXT    NOT NULL,
    entity_id    INTEGER NOT NULL,
    entity_slug  TEXT    NOT NULL DEFAULT '',
    entity_title TEXT    NOT NULL DEFAULT '',
    view_date    TEXT    NOT NULL DEFAULT (date('now')),
    count        INTEGER NOT NULL DEFAULT 0,
    UNIQUE(entity_type, entity_id, view_date)
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name   TEXT,
    action      TEXT    NOT NULL,
    entity_type TEXT,
    entity_id   INTEGER,
    entity_title TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS redirects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    from_path   TEXT    UNIQUE NOT NULL,
    to_path     TEXT    NOT NULL,
    type        TEXT    NOT NULL DEFAULT '301',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    UNIQUE NOT NULL,
    name            TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'active',
    token           TEXT    UNIQUE NOT NULL,
    subscribed_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    unsubscribed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS newsletter_campaigns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    subject     TEXT    NOT NULL,
    content     TEXT    NOT NULL DEFAULT '',
    sent_to     INTEGER NOT NULL DEFAULT 0,
    sent_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Migrations (safe ALTER TABLE if column not already present) ──────────────
const existingPageCols = db.pragma('table_info(pages)').map(c => c.name)
if (!existingPageCols.includes('publish_at')) {
  db.exec(`ALTER TABLE pages ADD COLUMN publish_at TEXT`)
}

const existingProductCols = db.pragma('table_info(products)').map(c => c.name)
if (!existingProductCols.includes('publish_at')) {
  db.exec(`ALTER TABLE products ADD COLUMN publish_at TEXT`)
}

// ─── Default settings ─────────────────────────────────────────────────────────

const defaultSettings = {
  site_name: 'My Pygmy Site',
  site_tagline: 'Built with Pygmy CMS',
  site_logo: '',
  accent_color: 'hsl(355, 70%, 58%)',
  hero_title: 'Welcome to My Site',
  hero_subtitle: 'This is the hero subtitle.',
  hero_bg_url: '',
  footer_text: '© 2026 My Pygmy Site',
  posts_per_page: '10',
  google_analytics: '',
  contact_intro: 'Have a question or want to work together? Drop us a message and we\'ll get back to you.',
  // Email / notifications
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  notify_email: '',
  notify_new_comment: '1',
  notify_new_contact: '1',
  // Newsletter
  newsletter_enabled: '0',
  newsletter_intro: 'Get the latest updates delivered straight to your inbox.',
  // Maintenance mode
  maintenance_mode: '0',
  maintenance_message: 'We\'re currently down for maintenance. We\'ll be back shortly!',
  // Custom code injection
  header_scripts: '',
  footer_scripts: '',
  // robots.txt
  robots_txt: 'User-agent: *\nAllow: /',
}

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`)

for (const [key, value] of Object.entries(defaultSettings)) {
  insertSetting.run(key, value)
}

export default db
