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
    parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
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

// ─── Phase 25: Tax Rates + Loyalty Transactions ──────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS tax_rates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL DEFAULT 'VAT',
    country     TEXT    NOT NULL DEFAULT '*',
    state       TEXT    NOT NULL DEFAULT '',
    rate        REAL    NOT NULL DEFAULT 0,
    inclusive   INTEGER NOT NULL DEFAULT 0,
    priority    INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id     INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    type         TEXT    NOT NULL,
    points       INTEGER NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_transactions(customer_id);
`)

// Migrations: orders tax columns
const ordersColsPhase25 = db.pragma('table_info(orders)').map(c => c.name)
if (!ordersColsPhase25.includes('tax_amount')) {
  try { db.exec("ALTER TABLE orders ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0") } catch {}
}
if (!ordersColsPhase25.includes('tax_rate_name')) {
  try { db.exec("ALTER TABLE orders ADD COLUMN tax_rate_name TEXT NOT NULL DEFAULT ''") } catch {}
}

// Migration: customers points_balance column
const customersColsPhase25 = db.pragma('table_info(customers)').map(c => c.name)
if (!customersColsPhase25.includes('points_balance')) {
  try { db.exec("ALTER TABLE customers ADD COLUMN points_balance INTEGER NOT NULL DEFAULT 0") } catch {}
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
  // Tax / VAT
  tax_enabled: '0',
  tax_inclusive: '0',
  tax_registration_number: '',
  // Loyalty Points
  loyalty_enabled: '0',
  loyalty_points_per_unit: '1',
  loyalty_redemption_rate: '100',
  loyalty_min_redeem: '100',
  loyalty_expiry_days: '0',
  // Phase 36: Digest Emails
  digest_enabled: '0',
  digest_frequency: 'weekly',
  digest_recipients: '',
  digest_last_sent: '',
  // Phase 36: Default language
  default_language: 'en',
}

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`)

for (const [key, value] of Object.entries(defaultSettings)) {
  insertSetting.run(key, value)
}

// ─── Phase 24: Page Content Blocks ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS page_blocks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    type       TEXT    NOT NULL DEFAULT 'text',
    sort_order INTEGER NOT NULL DEFAULT 0,
    settings   TEXT    NOT NULL DEFAULT '{}',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_page_blocks_page ON page_blocks(page_id, sort_order);
`)

// Seed the system homepage page (slug = __home__, never shown in public page list)
{
  const existing = db.prepare("SELECT id FROM pages WHERE slug = '__home__'").get()
  if (!existing) {
    db.prepare(`
      INSERT INTO pages (title, slug, content, status, sort_order)
      VALUES ('Homepage', '__home__', '', 'published', -9999)
    `).run()
  }
}

// ─── Phase 26: Gift Cards ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS gift_cards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    code         TEXT    NOT NULL UNIQUE,
    initial_value REAL   NOT NULL DEFAULT 0,
    balance      REAL    NOT NULL DEFAULT 0,
    currency     TEXT    NOT NULL DEFAULT 'EUR',
    recipient_name  TEXT NOT NULL DEFAULT '',
    recipient_email TEXT NOT NULL DEFAULT '',
    sender_name  TEXT    NOT NULL DEFAULT '',
    message      TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'active',
    expires_at   TEXT,
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
  CREATE INDEX IF NOT EXISTS idx_gift_cards_email ON gift_cards(recipient_email);

  CREATE TABLE IF NOT EXISTS gift_card_transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_card_id INTEGER NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
    order_id     INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    type         TEXT    NOT NULL DEFAULT 'redeem',
    amount       REAL    NOT NULL DEFAULT 0,
    balance_after REAL   NOT NULL DEFAULT 0,
    note         TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_gc_tx_card ON gift_card_transactions(gift_card_id);
`)

// Migration: gift_card columns on orders
const ordersColsP26 = db.pragma('table_info(orders)').map(c => c.name)
if (!ordersColsP26.includes('gift_card_code')) {
  try { db.exec("ALTER TABLE orders ADD COLUMN gift_card_code TEXT NOT NULL DEFAULT ''") } catch {}
}
if (!ordersColsP26.includes('gift_card_discount')) {
  try { db.exec("ALTER TABLE orders ADD COLUMN gift_card_discount REAL NOT NULL DEFAULT 0") } catch {}
}

// Default settings for gift cards
const gcSettings = {
  gift_cards_enabled: '0',
}
for (const [key, value] of Object.entries(gcSettings)) {
  insertSetting.run(key, value)
}

// ─── Phase 27: Digital Downloads ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS digital_files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label           TEXT    NOT NULL DEFAULT 'Download',
    filename        TEXT    NOT NULL,
    original_name   TEXT    NOT NULL DEFAULT '',
    file_size       INTEGER NOT NULL DEFAULT 0,
    mime_type       TEXT    NOT NULL DEFAULT 'application/octet-stream',
    download_limit  INTEGER NOT NULL DEFAULT 0,   -- 0 = unlimited
    expires_days    INTEGER NOT NULL DEFAULT 0,   -- 0 = never expire
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_digital_files_product ON digital_files(product_id);

  CREATE TABLE IF NOT EXISTS download_tokens (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_id         INTEGER NOT NULL REFERENCES digital_files(id) ON DELETE CASCADE,
    customer_email  TEXT    NOT NULL DEFAULT '',
    token           TEXT    UNIQUE NOT NULL,
    expires_at      TEXT,
    download_count  INTEGER NOT NULL DEFAULT 0,
    download_limit  INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_download_tokens_order ON download_tokens(order_id);
  CREATE INDEX IF NOT EXISTS idx_download_tokens_email ON download_tokens(customer_email);
`)

// Migration: is_digital flag on products
{
  const pCols = db.pragma('table_info(products)').map(c => c.name)
  if (!pCols.includes('is_digital')) {
    try { db.exec("ALTER TABLE products ADD COLUMN is_digital INTEGER NOT NULL DEFAULT 0") } catch {}
  }
}

// ── Phase 27: Order Fulfillment Tracking (was labeled Phase 27, now Phase 28 ordering)
{
  const cols = db.pragma('table_info(orders)').map(c => c.name)
  if (!cols.includes('tracking_number')) {
    try { db.exec("ALTER TABLE orders ADD COLUMN tracking_number TEXT NOT NULL DEFAULT ''") } catch {}
  }
  if (!cols.includes('tracking_carrier')) {
    try { db.exec("ALTER TABLE orders ADD COLUMN tracking_carrier TEXT NOT NULL DEFAULT ''") } catch {}
  }
  if (!cols.includes('tracking_url')) {
    try { db.exec("ALTER TABLE orders ADD COLUMN tracking_url TEXT NOT NULL DEFAULT ''") } catch {}
  }
  if (!cols.includes('fulfillment_notes')) {
    try { db.exec("ALTER TABLE orders ADD COLUMN fulfillment_notes TEXT NOT NULL DEFAULT ''") } catch {}
  }
  if (!cols.includes('shipped_at')) {
    try { db.exec("ALTER TABLE orders ADD COLUMN shipped_at TEXT") } catch {}
  }
  if (!cols.includes('customer_id')) {
    try { db.exec("ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL") } catch {}
  }
}

// ─── Phase 27: Subscription Plans + Member Gating ────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL DEFAULT '',
    slug            TEXT    UNIQUE NOT NULL DEFAULT '',
    description     TEXT    NOT NULL DEFAULT '',
    price           REAL    NOT NULL DEFAULT 0,
    interval        TEXT    NOT NULL DEFAULT 'month',   -- month | year
    trial_days      INTEGER NOT NULL DEFAULT 0,
    features        TEXT    NOT NULL DEFAULT '[]',      -- JSON array of strings
    active          INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS member_subscriptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id         INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status          TEXT    NOT NULL DEFAULT 'active',   -- active | cancelled | expired | trialing | past_due
    current_period_start  TEXT,
    current_period_end    TEXT,
    trial_ends_at   TEXT,
    cancelled_at    TEXT,
    cancel_at_end   INTEGER NOT NULL DEFAULT 0,
    renewal_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    notes           TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_member_subs_customer ON member_subscriptions(customer_id);
  CREATE INDEX IF NOT EXISTS idx_member_subs_status   ON member_subscriptions(status);
`)

// Migration: access_level on posts + pages
{
  const postCols = db.pragma('table_info(posts)').map(c => c.name)
  if (!postCols.includes('access_level')) {
    try { db.exec("ALTER TABLE posts ADD COLUMN access_level TEXT NOT NULL DEFAULT 'public'") } catch {}
  }
  const pageCols = db.pragma('table_info(pages)').map(c => c.name)
  if (!pageCols.includes('access_level')) {
    try { db.exec("ALTER TABLE pages ADD COLUMN access_level TEXT NOT NULL DEFAULT 'public'") } catch {}
  }
}

// Migration: plan_id on customers (active plan reference)
{
  const custCols = db.pragma('table_info(customers)').map(c => c.name)
  if (!custCols.includes('plan_id')) {
    try { db.exec("ALTER TABLE customers ADD COLUMN plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL") } catch {}
  }
}

// Default settings for memberships
const memberSettings = {
  memberships_enabled: '0',
  members_page_title: 'Become a Member',
  members_page_intro: 'Get exclusive access to premium content.',
}
for (const [key, value] of Object.entries(memberSettings)) {
  insertSetting.run(key, value)
}

// ─── Phase 28: Email branding + Gift card denominations ───────────────────────
const phase28Settings = {
  gift_card_denominations: '[25, 50, 100]',
  email_accent_color: 'hsl(355, 70%, 30%)',
  email_footer_text: '',
  email_logo_url: '',
  email_custom_css: '',
}
for (const [key, value] of Object.entries(phase28Settings)) {
  insertSetting.run(key, value)
}

// ─── Phase 28: Affiliate / Referral Program ───────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS affiliates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL DEFAULT '',
    email           TEXT    NOT NULL DEFAULT '',
    code            TEXT    UNIQUE NOT NULL,
    commission_rate REAL    NOT NULL DEFAULT 10,     -- percent
    status          TEXT    NOT NULL DEFAULT 'active', -- active | inactive | suspended
    notes           TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_id      INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    order_id          INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    order_amount      REAL    NOT NULL DEFAULT 0,
    commission_amount REAL    NOT NULL DEFAULT 0,
    status            TEXT    NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS affiliate_payouts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_id    INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    amount          REAL    NOT NULL DEFAULT 0,
    method          TEXT    NOT NULL DEFAULT 'manual',  -- manual | paypal | bank
    notes           TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'paid',    -- paid | pending
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
  CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_aff ON affiliate_referrals(affiliate_id);
`)

// Phase 28 default settings
const phase28bSettings = {
  // Affiliate Program
  affiliate_enabled: '0',
  affiliate_cookie_days: '30',
  // GDPR / Cookie Consent
  cookie_consent_enabled: '1',
  cookie_consent_message: 'We use cookies to improve your experience. By continuing to use this site, you accept our use of cookies.',
  cookie_consent_accept_label: 'Accept All',
  cookie_consent_reject_label: 'Reject Non-Essential',
  cookie_consent_manage_label: 'Manage Preferences',
  cookie_consent_policy_url: '/privacy-policy',
  cookie_analytics_default: '0',
  cookie_marketing_default: '0',
}
for (const [key, value] of Object.entries(phase28bSettings)) {
  insertSetting.run(key, value)
}

export default db

// ─── Phase 29: Multi-Currency + Product Bundles + Customer CSV Import ─────────

// Exchange rates table
db.exec(`
  CREATE TABLE IF NOT EXISTS currency_rates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,   -- e.g. USD, GBP, JPY
    symbol      TEXT NOT NULL DEFAULT '',
    rate        REAL NOT NULL DEFAULT 1, -- multiplier vs base currency
    active      INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_bundles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL DEFAULT '',
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    discount_type TEXT NOT NULL DEFAULT 'percent', -- percent | fixed
    discount_value REAL NOT NULL DEFAULT 0,
    cover_image TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'draft',  -- draft | published
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bundle_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id   INTEGER NOT NULL REFERENCES product_bundles(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity    INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_id);
  CREATE INDEX IF NOT EXISTS idx_currency_rates_code ON currency_rates(code);
`)

// Phase 29 settings
const phase29Settings = {
  multicurrency_enabled: '0',
  base_currency: 'EUR',
}
for (const [key, value] of Object.entries(phase29Settings)) {
  insertSetting.run(key, value)
}

// ─── Phase 30: Product Q&A + Import Wizard ────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS product_qa (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    question    TEXT NOT NULL DEFAULT '',
    answer      TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT 'Anonymous',
    customer_email TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | published | spam
    is_featured INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_product_qa_product ON product_qa(product_id);
  CREATE INDEX IF NOT EXISTS idx_product_qa_status ON product_qa(status);
`)

// ─── Phase 30: Advanced Coupons + Back-in-Stock + Recommendations + Order Timeline ───

db.exec(`
  -- Advanced coupon extensions
  CREATE TABLE IF NOT EXISTS coupon_usage (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id   INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL DEFAULT '',
    customer_email TEXT NOT NULL DEFAULT '',
    discount_amount REAL NOT NULL DEFAULT 0,
    used_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
  CREATE INDEX IF NOT EXISTS idx_coupon_usage_email ON coupon_usage(customer_email);

  -- Back-in-stock alert subscriptions
  CREATE TABLE IF NOT EXISTS stock_alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    notified    INTEGER NOT NULL DEFAULT 0,
    notified_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_alerts_unique ON stock_alerts(product_id, email);
  CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);

  -- Product recommendations
  CREATE TABLE IF NOT EXISTS product_recommendations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    recommended_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'related',  -- 'related' | 'upsell' | 'crosssell' | 'bought_together'
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_recommendations_unique ON product_recommendations(product_id, recommended_id, type);
  CREATE INDEX IF NOT EXISTS idx_recommendations_product ON product_recommendations(product_id);

  -- Order timeline events
  CREATE TABLE IF NOT EXISTS order_timeline (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL DEFAULT 'note',  -- 'note' | 'status_change' | 'payment' | 'shipment' | 'refund' | 'system'
    message     TEXT NOT NULL DEFAULT '',
    is_customer_visible INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT NOT NULL DEFAULT 'system',  -- 'system' | admin user name
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);
`)

// Phase 30 advanced coupon migrations
const existingCouponCols = db.pragma('table_info(coupons)').map(c => c.name)
if (!existingCouponCols.includes('max_uses_per_customer')) {
  db.exec(`ALTER TABLE coupons ADD COLUMN max_uses_per_customer INTEGER NOT NULL DEFAULT 0`)
}
if (!existingCouponCols.includes('product_ids')) {
  // JSON array of product IDs this coupon applies to (empty = all products)
  db.exec(`ALTER TABLE coupons ADD COLUMN product_ids TEXT NOT NULL DEFAULT '[]'`)
}
if (!existingCouponCols.includes('category_ids')) {
  // JSON array of category IDs (empty = all categories)
  db.exec(`ALTER TABLE coupons ADD COLUMN category_ids TEXT NOT NULL DEFAULT '[]'`)
}
if (!existingCouponCols.includes('bogo_buy_qty')) {
  // BOGO: buy X quantity
  db.exec(`ALTER TABLE coupons ADD COLUMN bogo_buy_qty INTEGER NOT NULL DEFAULT 0`)
}
if (!existingCouponCols.includes('bogo_get_qty')) {
  // BOGO: get Y quantity free/discounted
  db.exec(`ALTER TABLE coupons ADD COLUMN bogo_get_qty INTEGER NOT NULL DEFAULT 0`)
}
if (!existingCouponCols.includes('bogo_product_id')) {
  // BOGO: specific product to apply free qty to (0 = cheapest)
  db.exec(`ALTER TABLE coupons ADD COLUMN bogo_product_id INTEGER NOT NULL DEFAULT 0`)
}
// Add free_shipping to type (already TEXT, just documenting)

// ─── Phase 31: Returns & Refunds + Email Templates ─────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS order_returns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    order_number    TEXT NOT NULL DEFAULT '',
    customer_name   TEXT NOT NULL DEFAULT '',
    customer_email  TEXT NOT NULL DEFAULT '',
    reason          TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    admin_notes     TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | refunded | closed
    refund_amount   REAL NOT NULL DEFAULT 0,
    items           TEXT NOT NULL DEFAULT '[]',     -- JSON array of {product_id, name, quantity, unit_price}
    refund_method   TEXT NOT NULL DEFAULT 'original', -- original | store_credit | manual
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_returns_order ON order_returns(order_id);
  CREATE INDEX IF NOT EXISTS idx_returns_status ON order_returns(status);
  CREATE INDEX IF NOT EXISTS idx_returns_email ON order_returns(customer_email);

  CREATE TABLE IF NOT EXISTS email_templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL DEFAULT '',
    slug        TEXT NOT NULL UNIQUE,
    subject     TEXT NOT NULL DEFAULT '',
    html_body   TEXT NOT NULL DEFAULT '',
    text_body   TEXT NOT NULL DEFAULT '',
    variables   TEXT NOT NULL DEFAULT '[]',  -- JSON array of {key, description}
    is_system   INTEGER NOT NULL DEFAULT 0,  -- 1 = built-in, cannot delete
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Seed default email templates (idempotent)
const seedTemplate = (slug, name, subject, html_body, text_body, variables_arr) => {
  const existing = db.prepare('SELECT id FROM email_templates WHERE slug = ?').get(slug)
  if (!existing) {
    db.prepare(`
      INSERT INTO email_templates (slug, name, subject, html_body, text_body, variables, is_system)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(slug, name, subject, html_body, text_body, JSON.stringify(variables_arr))
  }
}

seedTemplate(
  'order_confirmation',
  'Order Confirmation',
  'Your order has been received — #{{order_number}}',
  `<h2>Hi {{customer_name}},</h2>
<p>Thanks for your order! We've received it and will be in touch shortly.</p>
<p><strong>Order number:</strong> {{order_number}}</p>
{{items_table}}
{{totals_section}}
{{shipping_section}}
{{downloads_section}}`,
  `Hi {{customer_name}},\n\nThanks for your order!\nOrder: {{order_number}}\n\n{{items_text}}\nTotal: {{total}}`,
  [
    {key:'customer_name', description:'Customer full name'},
    {key:'order_number', description:'Order number (e.g. ORD-260322-0001)'},
    {key:'items_table', description:'HTML table of ordered items'},
    {key:'items_text', description:'Plain text list of items'},
    {key:'totals_section', description:'Subtotal, discount, total block'},
    {key:'shipping_section', description:'Shipping address block'},
    {key:'downloads_section', description:'Digital download links (if any)'},
    {key:'total', description:'Order grand total with currency symbol'},
  ]
)

seedTemplate(
  'order_status_update',
  'Order Status Update',
  'Order #{{order_number}} status update',
  `<h2>Hi {{customer_name}},</h2>
<p>{{status_message}}</p>
<p><strong>Order number:</strong> {{order_number}}<br>
   <strong>New status:</strong> {{status_label}}</p>
{{items_table}}
{{order_notes}}`,
  `Hi {{customer_name}},\n\n{{status_message}}\n\nOrder: {{order_number}}\nStatus: {{status_label}}\nTotal: {{total}}`,
  [
    {key:'customer_name', description:'Customer full name'},
    {key:'order_number', description:'Order number'},
    {key:'status_message', description:'Human-readable status description'},
    {key:'status_label', description:'Status label (e.g. Shipped)'},
    {key:'items_table', description:'HTML table of order items'},
    {key:'order_notes', description:'Admin notes (if any)'},
    {key:'total', description:'Order grand total'},
  ]
)

seedTemplate(
  'shipment_notification',
  'Shipment Notification',
  'Your order {{order_number}} has been shipped! 📦',
  `<h2>Hi {{customer_name}},</h2>
<p>Great news! Your order is on its way. 🚀</p>
<p><strong>Order number:</strong> {{order_number}}</p>
{{tracking_section}}
{{items_table}}
{{shipping_address}}`,
  `Hi {{customer_name}},\n\nYour order is on its way!\nOrder: {{order_number}}\n{{tracking_text}}\nShipping to:\n{{shipping_address}}`,
  [
    {key:'customer_name', description:'Customer full name'},
    {key:'order_number', description:'Order number'},
    {key:'tracking_section', description:'Tracking info HTML block'},
    {key:'tracking_text', description:'Tracking info plain text'},
    {key:'items_table', description:'HTML table of order items'},
    {key:'shipping_address', description:'Shipping address'},
  ]
)

seedTemplate(
  'return_received',
  'Return Request Received',
  'Return request received for order #{{order_number}}',
  `<h2>Hi {{customer_name}},</h2>
<p>We've received your return request for order <strong>{{order_number}}</strong>.</p>
<p><strong>Return ID:</strong> {{return_id}}<br>
   <strong>Reason:</strong> {{reason}}</p>
<p>We'll review your request and get back to you within 2–3 business days.</p>`,
  `Hi {{customer_name}},\n\nReturn request received for order {{order_number}}.\nReturn ID: {{return_id}}\nReason: {{reason}}\n\nWe'll be in touch within 2–3 business days.`,
  [
    {key:'customer_name', description:'Customer full name'},
    {key:'order_number', description:'Original order number'},
    {key:'return_id', description:'Return request ID'},
    {key:'reason', description:'Return reason provided by customer'},
  ]
)

seedTemplate(
  'return_approved',
  'Return Approved',
  'Your return for order #{{order_number}} has been approved ✅',
  `<h2>Hi {{customer_name}},</h2>
<p>Your return request has been <strong>approved</strong>!</p>
<p><strong>Order:</strong> {{order_number}}<br>
   <strong>Refund amount:</strong> {{refund_amount}}<br>
   <strong>Refund method:</strong> {{refund_method}}</p>
<p>{{admin_notes}}</p>
<p>Please allow 3–5 business days for your refund to appear.</p>`,
  `Hi {{customer_name}},\n\nYour return has been approved!\nOrder: {{order_number}}\nRefund: {{refund_amount}} via {{refund_method}}\n\n{{admin_notes}}\n\nPlease allow 3–5 business days for the refund to process.`,
  [
    {key:'customer_name', description:'Customer full name'},
    {key:'order_number', description:'Original order number'},
    {key:'refund_amount', description:'Refund amount with currency symbol'},
    {key:'refund_method', description:'Refund method (original/store credit/manual)'},
    {key:'admin_notes', description:'Message from admin to customer'},
  ]
)

seedTemplate(
  'return_rejected',
  'Return Rejected',
  'Update on your return request for order #{{order_number}}',
  `<h2>Hi {{customer_name}},</h2>
<p>We're sorry, but your return request for order <strong>{{order_number}}</strong> could not be approved.</p>
{{admin_notes}}
<p>If you have questions, please <a href="{{contact_url}}">contact us</a>.</p>`,
  `Hi {{customer_name}},\n\nYour return request for order {{order_number}} could not be approved.\n\n{{admin_notes}}\n\nContact us if you have questions.`,
  [
    {key:'customer_name', description:'Customer full name'},
    {key:'order_number', description:'Original order number'},
    {key:'admin_notes', description:'Reason for rejection'},
    {key:'contact_url', description:'Link to contact page'},
  ]
)

// ── Phase 30: Flash Sales ─────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS flash_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percent',  -- percent | fixed | free_shipping
    discount_value REAL NOT NULL DEFAULT 0,
    applies_to TEXT NOT NULL DEFAULT 'all',          -- all | category | products
    applies_to_ids TEXT DEFAULT '[]',                -- JSON array of category names or product ids
    min_purchase REAL DEFAULT 0,
    max_uses INTEGER DEFAULT 0,
    uses_count INTEGER DEFAULT 0,
    starts_at TEXT,
    ends_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    show_countdown INTEGER NOT NULL DEFAULT 1,
    badge_label TEXT DEFAULT 'Flash Sale',
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 30: Announcement Bar ────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS announcement_bars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    link_url TEXT,
    link_label TEXT,
    bg_color TEXT DEFAULT '#c0392b',
    text_color TEXT DEFAULT '#ffffff',
    dismissable INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT,
    ends_at TEXT,
    position TEXT DEFAULT 'top',  -- top | bottom
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 30: Pop-up Builder ──────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS popups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'newsletter', -- newsletter | promo | announcement | custom
    title TEXT,
    body TEXT,
    cta_label TEXT,
    cta_url TEXT,
    image_url TEXT,
    trigger TEXT NOT NULL DEFAULT 'timed',  -- timed | exit_intent | scroll
    trigger_delay INTEGER DEFAULT 5,         -- seconds (timed) or % scrolled (scroll)
    show_once INTEGER NOT NULL DEFAULT 1,    -- 1 = only once per browser
    cookie_days INTEGER DEFAULT 30,          -- days before reshowing
    show_on TEXT DEFAULT 'all',              -- all | home | blog | shop | product | custom
    show_on_paths TEXT DEFAULT '[]',         -- JSON array of path patterns for custom
    bg_color TEXT DEFAULT 'rgba(0,0,0,0.85)',
    active INTEGER NOT NULL DEFAULT 0,
    display_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 32: Support Tickets + Live Chat ─────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',       -- open | in_progress | waiting | resolved | closed
    priority TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high | urgent
    channel TEXT NOT NULL DEFAULT 'widget',    -- widget | email | manual
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_id INTEGER,                       -- FK customers (if logged in)
    assigned_to INTEGER,                       -- FK users
    order_number TEXT,
    tags TEXT DEFAULT '[]',
    is_read INTEGER NOT NULL DEFAULT 0,
    last_reply_at TEXT,
    resolved_at TEXT,
    closed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender TEXT NOT NULL DEFAULT 'customer',   -- customer | agent
    sender_name TEXT NOT NULL,
    sender_email TEXT,
    agent_id INTEGER,
    message TEXT NOT NULL,
    attachments TEXT DEFAULT '[]',
    is_internal INTEGER NOT NULL DEFAULT 0,    -- internal note (not visible to customer)
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()

// Phase 32 settings
const phase32Settings = {
  support_enabled: '1',
  support_widget_enabled: '1',
  support_widget_greeting: 'Hi there! 👋 How can we help you today?',
  support_widget_offline_msg: "We're currently offline. Leave us a message and we'll get back to you!",
  support_online_hours: '{"mon":"09:00-17:00","tue":"09:00-17:00","wed":"09:00-17:00","thu":"09:00-17:00","fri":"09:00-17:00","sat":"","sun":""}',
  support_auto_reply_enabled: '0',
  support_auto_reply_msg: "Thanks for reaching out! We've received your message and will get back to you within 24 hours.",
  support_notify_email: '',
}
for (const [key, value] of Object.entries(phase32Settings)) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

// ── Phase 33: Quick Notes ────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS quick_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT    NOT NULL DEFAULT '',
    color      TEXT    NOT NULL DEFAULT 'yellow',  -- yellow | green | blue | pink | purple
    pinned     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now')),
    updated_at TEXT    DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 34: A/B Testing ─────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS ab_tests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    description   TEXT    DEFAULT '',
    entity_type   TEXT    NOT NULL DEFAULT 'page',   -- page | post | product | custom
    entity_id     INTEGER,
    status        TEXT    NOT NULL DEFAULT 'draft',  -- draft | running | paused | completed
    split         INTEGER NOT NULL DEFAULT 50,       -- % sent to variant B (0–100)
    goal          TEXT    NOT NULL DEFAULT 'click',  -- click | conversion | bounce | time_on_page
    goal_selector TEXT    DEFAULT '',                -- CSS selector or event name
    winner        TEXT    DEFAULT NULL,              -- 'a' | 'b' | null
    started_at    TEXT,
    ended_at      TEXT,
    created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT    DEFAULT (datetime('now')),
    updated_at    TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS ab_variants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id     INTEGER NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
    label       TEXT    NOT NULL DEFAULT 'A',        -- A | B | C …
    name        TEXT    NOT NULL DEFAULT '',
    changes     TEXT    NOT NULL DEFAULT '{}',       -- JSON: { field: value } overrides
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS ab_impressions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id    INTEGER NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES ab_variants(id) ON DELETE CASCADE,
    session_id TEXT    NOT NULL,
    converted  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_ab_impressions_test ON ab_impressions(test_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_ab_impressions_session ON ab_impressions(session_id, test_id)`).run()

// ── Phase 34: Search Analytics ───────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS search_queries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    query        TEXT    NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,
    clicked_slug TEXT    DEFAULT NULL,
    clicked_type TEXT    DEFAULT NULL,
    session_id   TEXT    DEFAULT NULL,
    created_at   TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_search_queries_query ON search_queries(query)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_search_queries_date ON search_queries(created_at)`).run()

// ── Phase 35: Customer Segments ───────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_segments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    conditions  TEXT    NOT NULL DEFAULT '[]',   -- JSON array of {field, operator, value}
    dynamic     INTEGER NOT NULL DEFAULT 1,      -- 1 = auto-recalculate, 0 = manual
    member_count INTEGER NOT NULL DEFAULT 0,
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 35: Email Sequences (Drip Campaigns) ────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS email_sequences (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    trigger_type TEXT   NOT NULL DEFAULT 'manual', -- manual | subscriber_join | order_placed | customer_register | segment_enter | date_anniversary
    trigger_config TEXT NOT NULL DEFAULT '{}',     -- JSON: segment_id, product_id, etc.
    status      TEXT    NOT NULL DEFAULT 'draft',  -- draft | active | paused
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS email_sequence_steps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_id INTEGER NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL DEFAULT 1,
    subject     TEXT    NOT NULL DEFAULT '',
    body        TEXT    NOT NULL DEFAULT '',       -- HTML body
    delay_days  INTEGER NOT NULL DEFAULT 0,        -- days after previous step (or trigger for step 1)
    delay_hours INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_id  INTEGER NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
    email        TEXT    NOT NULL,
    name         TEXT    DEFAULT '',
    next_step    INTEGER NOT NULL DEFAULT 1,        -- step_number of next email to send
    next_send_at TEXT    NOT NULL,                 -- datetime to send next email
    status       TEXT    NOT NULL DEFAULT 'active', -- active | completed | unsubscribed | failed
    enrolled_at  TEXT    DEFAULT (datetime('now')),
    completed_at TEXT
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_seq_enrollments_next ON email_sequence_enrollments(next_send_at, status)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_seq_enrollments_seq ON email_sequence_enrollments(sequence_id, status)`).run()

// ── Phase 35 migrations ───────────────────────────────────────────────────────
// Add parent_id to comments for reply threading (safe if column already exists)
try { db.prepare(`ALTER TABLE comments ADD COLUMN parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE`).run() } catch {}
// Add liked_count to comments for future social proof
try { db.prepare(`ALTER TABLE comments ADD COLUMN liked_count INTEGER NOT NULL DEFAULT 0`).run() } catch {}

// ── Phase 36: Multi-language Content Translations ─────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS languages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,  -- e.g. 'de', 'fr', 'es'
    name        TEXT    NOT NULL,          -- e.g. 'German', 'French'
    native_name TEXT    NOT NULL DEFAULT '', -- e.g. 'Deutsch'
    flag        TEXT    NOT NULL DEFAULT '', -- e.g. '🇩🇪'
    active      INTEGER NOT NULL DEFAULT 1,
    is_default  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS content_translations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type   TEXT    NOT NULL,  -- 'page' | 'post' | 'product' | 'navigation'
    entity_id     INTEGER NOT NULL,
    language_code TEXT    NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
    field         TEXT    NOT NULL,  -- 'title' | 'content' | 'excerpt' | 'meta_title' | 'meta_description'
    value         TEXT    NOT NULL DEFAULT '',
    updated_at    TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_translations_entity_field
  ON content_translations(entity_type, entity_id, language_code, field)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_translations_entity
  ON content_translations(entity_type, entity_id)`).run()

// ── Phase 36: Web Vitals / RUM Performance ────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS web_vitals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    path        TEXT    NOT NULL,
    lcp         REAL    DEFAULT NULL,   -- Largest Contentful Paint (ms)
    fid         REAL    DEFAULT NULL,   -- First Input Delay (ms)
    cls         REAL    DEFAULT NULL,   -- Cumulative Layout Shift (score)
    fcp         REAL    DEFAULT NULL,   -- First Contentful Paint (ms)
    ttfb        REAL    DEFAULT NULL,   -- Time to First Byte (ms)
    inp         REAL    DEFAULT NULL,   -- Interaction to Next Paint (ms)
    device      TEXT    DEFAULT 'desktop', -- 'mobile' | 'tablet' | 'desktop'
    session_id  TEXT    DEFAULT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_web_vitals_path ON web_vitals(path)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_web_vitals_date ON web_vitals(created_at)`).run()

// ── Phase 36: Digest Email Preferences ───────────────────────────────────────
// Stored in settings table, no new tables needed

// Migrations (safe)
try { db.prepare(`ALTER TABLE activity_log ADD COLUMN metadata TEXT DEFAULT NULL`).run() } catch {}
