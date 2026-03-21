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

  CREATE TABLE IF NOT EXISTS revisions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type  TEXT    NOT NULL,
    entity_id    INTEGER NOT NULL,
    entity_title TEXT    NOT NULL DEFAULT '',
    snapshot     TEXT    NOT NULL,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name    TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_revisions_entity ON revisions(entity_type, entity_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS custom_forms (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    slug             TEXT    UNIQUE NOT NULL,
    description      TEXT    NOT NULL DEFAULT '',
    fields           TEXT    NOT NULL DEFAULT '[]',
    success_message  TEXT    NOT NULL DEFAULT 'Thank you! Your message has been sent.',
    email_notify     TEXT    NOT NULL DEFAULT '',
    status           TEXT    NOT NULL DEFAULT 'active',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS custom_form_submissions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id    INTEGER NOT NULL REFERENCES custom_forms(id) ON DELETE CASCADE,
    form_name  TEXT    NOT NULL DEFAULT '',
    data       TEXT    NOT NULL DEFAULT '{}',
    status     TEXT    NOT NULL DEFAULT 'unread',
    ip         TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cfs_form ON custom_form_submissions(form_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS webhooks (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL,
    url                TEXT    NOT NULL,
    events             TEXT    NOT NULL DEFAULT '[]',
    secret             TEXT    NOT NULL DEFAULT '',
    active             INTEGER NOT NULL DEFAULT 1,
    last_triggered_at  TEXT,
    last_status        INTEGER,
    last_error         TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    slug         TEXT    UNIQUE NOT NULL,
    excerpt      TEXT    NOT NULL DEFAULT '',
    description  TEXT    NOT NULL DEFAULT '',
    cover_image  TEXT,
    start_date   TEXT    NOT NULL,
    end_date     TEXT,
    all_day      INTEGER NOT NULL DEFAULT 0,
    location     TEXT    NOT NULL DEFAULT '',
    venue        TEXT    NOT NULL DEFAULT '',
    ticket_url   TEXT    NOT NULL DEFAULT '',
    tags         TEXT    NOT NULL DEFAULT '[]',
    status       TEXT    NOT NULL DEFAULT 'draft',
    featured     INTEGER NOT NULL DEFAULT 0,
    meta_title   TEXT,
    meta_desc    TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date ASC);

  CREATE TABLE IF NOT EXISTS media_folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    slug       TEXT    UNIQUE NOT NULL,
    parent_id  INTEGER REFERENCES media_folders(id) ON DELETE SET NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    key_hash        TEXT    UNIQUE NOT NULL,
    key_prefix      TEXT    NOT NULL,
    scopes          TEXT    NOT NULL DEFAULT '["read"]',
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    last_used_at    TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_locks (
    entity_type  TEXT    NOT NULL,
    entity_id    INTEGER NOT NULL,
    user_id      INTEGER NOT NULL,
    user_name    TEXT    NOT NULL,
    locked_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at   TEXT    NOT NULL,
    PRIMARY KEY(entity_type, entity_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number    TEXT    UNIQUE NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'pending',
    customer_name   TEXT    NOT NULL,
    customer_email  TEXT    NOT NULL,
    customer_phone  TEXT    NOT NULL DEFAULT '',
    shipping_address TEXT   NOT NULL DEFAULT '',
    items           TEXT    NOT NULL DEFAULT '[]',
    subtotal        REAL    NOT NULL DEFAULT 0,
    total           REAL    NOT NULL DEFAULT 0,
    notes           TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_email  ON orders(customer_email);

  -- ── Shipping Zones ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS shipping_zones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    countries   TEXT    NOT NULL DEFAULT '[]',  -- JSON array of ISO-3166 alpha-2 codes; [] = rest of world
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shipping_rates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id     INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL DEFAULT 'Standard Shipping',
    type        TEXT    NOT NULL DEFAULT 'flat',  -- 'flat' | 'free' | 'threshold'
    rate        REAL    NOT NULL DEFAULT 0,       -- cost (ignored for free; threshold is min order for free)
    min_order   REAL    NOT NULL DEFAULT 0,       -- used by 'threshold' type
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Product Reviews ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS product_reviews (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    author_name  TEXT    NOT NULL,
    author_email TEXT    NOT NULL DEFAULT '',
    rating       INTEGER NOT NULL DEFAULT 5,  -- 1–5
    title        TEXT    NOT NULL DEFAULT '',
    body         TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, status);

  -- ── Coupons ──────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS coupons (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    code             TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    type             TEXT    NOT NULL DEFAULT 'percentage',  -- 'percentage' | 'fixed'
    value            REAL    NOT NULL DEFAULT 0,
    min_order_amount REAL    NOT NULL DEFAULT 0,
    max_uses         INTEGER NOT NULL DEFAULT 0,  -- 0 = unlimited
    used_count       INTEGER NOT NULL DEFAULT 0,
    expires_at       TEXT,
    active           INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Migrations (safe ALTER TABLE if column not already present) ─────────────

// Stock management columns on products
const existingProductColsEarly = db.pragma('table_info(products)').map(c => c.name)
if (!existingProductColsEarly.includes('track_stock')) {
  db.exec(`ALTER TABLE products ADD COLUMN track_stock INTEGER NOT NULL DEFAULT 0`)
}
if (!existingProductColsEarly.includes('stock_quantity')) {
  db.exec(`ALTER TABLE products ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0`)
}
if (!existingProductColsEarly.includes('allow_backorder')) {
  db.exec(`ALTER TABLE products ADD COLUMN allow_backorder INTEGER NOT NULL DEFAULT 0`)
}
if (!existingProductColsEarly.includes('low_stock_threshold')) {
  db.exec(`ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5`)
}

// Coupon + discount columns on orders
const existingOrderCols = db.pragma('table_info(orders)').map(c => c.name)
if (!existingOrderCols.includes('coupon_code')) {
  db.exec(`ALTER TABLE orders ADD COLUMN coupon_code TEXT NOT NULL DEFAULT ''`)
}
if (!existingOrderCols.includes('discount_amount')) {
  db.exec(`ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0`)
}

const existingPageCols = db.pragma('table_info(pages)').map(c => c.name)
if (!existingPageCols.includes('publish_at')) {
  db.exec(`ALTER TABLE pages ADD COLUMN publish_at TEXT`)
}

const existingProductCols = db.pragma('table_info(products)').map(c => c.name)
if (!existingProductCols.includes('publish_at')) {
  db.exec(`ALTER TABLE products ADD COLUMN publish_at TEXT`)
}

// folder_id on media
const existingMediaCols = db.pragma('table_info(media)').map(c => c.name)
if (!existingMediaCols.includes('folder_id')) {
  db.exec(`ALTER TABLE media ADD COLUMN folder_id INTEGER REFERENCES media_folders(id) ON DELETE SET NULL`)
}

// 2FA columns on users
const existingUserCols = db.pragma('table_info(users)').map(c => c.name)
if (!existingUserCols.includes('totp_secret')) {
  db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`)
}
if (!existingUserCols.includes('totp_enabled')) {
  db.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`)
}

// shipping_cost column on orders
const existingOrderCols2 = db.pragma('table_info(orders)').map(c => c.name)
if (!existingOrderCols2.includes('shipping_cost')) {
  db.exec(`ALTER TABLE orders ADD COLUMN shipping_cost REAL NOT NULL DEFAULT 0`)
}
if (!existingOrderCols2.includes('shipping_zone')) {
  db.exec(`ALTER TABLE orders ADD COLUMN shipping_zone TEXT NOT NULL DEFAULT ''`)
}
if (!existingOrderCols2.includes('shipping_method')) {
  db.exec(`ALTER TABLE orders ADD COLUMN shipping_method TEXT NOT NULL DEFAULT ''`)
}
if (!existingOrderCols2.includes('shipping_country')) {
  db.exec(`ALTER TABLE orders ADD COLUMN shipping_country TEXT NOT NULL DEFAULT ''`)
}
if (!existingOrderCols2.includes('shipping_rate_name')) {
  db.exec(`ALTER TABLE orders ADD COLUMN shipping_rate_name TEXT NOT NULL DEFAULT ''`)
}

// product_variants table
db.exec(`
  CREATE TABLE IF NOT EXISTS product_variants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    options     TEXT    NOT NULL DEFAULT '[]',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_variant_options (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id  INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    label       TEXT    NOT NULL,
    price_adj   REAL    NOT NULL DEFAULT 0,
    sku_suffix  TEXT    NOT NULL DEFAULT '',
    stock       INTEGER NOT NULL DEFAULT -1,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );
`)

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
  // E-commerce / shop
  shop_enabled: '1',
  shop_currency: 'EUR',
  shop_currency_symbol: '€',
  shop_checkout_intro: 'Complete your order below.',
  shop_thankyou_message: 'Thank you for your order! We\'ll be in touch shortly.',
  notify_new_order: '1',
  notify_order_status: '1',
  order_confirmation_subject: 'Your order has been received — #{order_number}',
  order_status_subject: 'Order #{order_number} status update',
  // Reviews
  reviews_enabled: '1',
  reviews_require_approval: '1',
}

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`)

for (const [key, value] of Object.entries(defaultSettings)) {
  insertSetting.run(key, value)
}

export default db
