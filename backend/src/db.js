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

// ── Phase 37: Customer Notes ───────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    admin_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_name  TEXT    NOT NULL DEFAULT 'Admin',
    note        TEXT    NOT NULL,
    type        TEXT    NOT NULL DEFAULT 'note',  -- 'note' | 'call' | 'email' | 'meeting' | 'flag'
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id)`).run()

// ── Phase 37: Recently Viewed Products (per session) ──────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS recently_viewed (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    viewed_at   TEXT    DEFAULT (datetime('now')),
    UNIQUE(session_id, product_id)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_recently_viewed_session ON recently_viewed(session_id)`).run()

// ── Phase 37: Web Push Notifications ─────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint    TEXT    NOT NULL UNIQUE,
    p256dh      TEXT    NOT NULL DEFAULT '',
    auth        TEXT    NOT NULL DEFAULT '',
    session_id  TEXT    DEFAULT NULL,
    page_path   TEXT    DEFAULT '/',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(active)`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS push_campaigns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    body        TEXT    NOT NULL,
    icon        TEXT    DEFAULT NULL,
    image       TEXT    DEFAULT NULL,
    url         TEXT    DEFAULT NULL,
    badge       TEXT    DEFAULT NULL,
    schedule_at TEXT    DEFAULT NULL,
    status      TEXT    NOT NULL DEFAULT 'draft', -- draft | scheduled | sent
    sent_at     TEXT    DEFAULT NULL,
    sent_count  INTEGER NOT NULL DEFAULT 0,
    fail_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 37: Default VAPID keys seed in settings ─────────────────────────────
// (generated via POST /api/push/generate-vapid, not seeded with values)

// Migrations (safe)
try { db.prepare(`ALTER TABLE activity_log ADD COLUMN metadata TEXT DEFAULT NULL`).run() } catch {}
// Phase 37: billing address on orders
try { db.prepare(`ALTER TABLE orders ADD COLUMN billing_address TEXT DEFAULT NULL`).run() } catch {}
try { db.prepare(`ALTER TABLE orders ADD COLUMN billing_same_as_shipping INTEGER DEFAULT 1`).run() } catch {}

// ── Phase 38: Price Drop Alerts ────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS price_alerts (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id              INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    email                   TEXT    NOT NULL,
    name                    TEXT    NOT NULL DEFAULT '',
    target_price            REAL    DEFAULT NULL,
    current_price_at_signup REAL    NOT NULL DEFAULT 0,
    notified                INTEGER NOT NULL DEFAULT 0,
    notified_at             TEXT    DEFAULT NULL,
    created_at              TEXT    DEFAULT (datetime('now')),
    UNIQUE(product_id, email)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_price_alerts_product ON price_alerts(product_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_price_alerts_notified ON price_alerts(notified)`).run()

// ── Phase 38: Social Proof — Live Viewers ──────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS live_viewers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL UNIQUE,
    path       TEXT    NOT NULL,
    expires_at TEXT    NOT NULL
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_live_viewers_path ON live_viewers(path)`).run()

// ── Phase 38: Social Proof — Purchase Activity Feed ───────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS purchase_activity (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name     TEXT    NOT NULL,
    customer_display TEXT    NOT NULL DEFAULT 'Someone',
    city             TEXT    NOT NULL DEFAULT '',
    amount           REAL    DEFAULT NULL,
    created_at       TEXT    DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 38: Product Badges ───────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS product_badges (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label      TEXT    NOT NULL,
    style      TEXT    NOT NULL DEFAULT 'default',
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_product_badges_product ON product_badges(product_id)`).run()

// ── Phase 38: Saved Carts (cross-device) ──────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS saved_carts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    items       TEXT    NOT NULL DEFAULT '[]',
    updated_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 39: Store Credit + Referral Program ────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS store_credit_transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount        REAL NOT NULL,                   -- positive = credit, negative = debit
    type          TEXT NOT NULL DEFAULT 'manual',  -- manual | referral | refund | redemption | expiry
    note          TEXT,
    order_id      INTEGER,                         -- linked order (if redemption/refund)
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_sc_customer ON store_credit_transactions(customer_id)`).run()

// Add store_credit_balance column to customers if not present
try { db.prepare('ALTER TABLE customers ADD COLUMN store_credit_balance REAL NOT NULL DEFAULT 0').run() } catch {}

db.prepare(`
  CREATE TABLE IF NOT EXISTS referral_codes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    code          TEXT NOT NULL UNIQUE,
    times_used    INTEGER NOT NULL DEFAULT 0,
    credit_earned REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_referral_code ON referral_codes(code)`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS referral_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    referral_code   TEXT NOT NULL,
    referrer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    referred_email  TEXT NOT NULL,
    referred_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    order_id        INTEGER,
    reward_given    INTEGER NOT NULL DEFAULT 0,   -- 0/1
    reward_amount   REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()

// Add gift_wrap columns to orders
try { db.prepare('ALTER TABLE orders ADD COLUMN gift_wrap INTEGER NOT NULL DEFAULT 0').run() } catch {}
try { db.prepare('ALTER TABLE orders ADD COLUMN gift_message TEXT').run() } catch {}
try { db.prepare('ALTER TABLE orders ADD COLUMN gift_wrap_cost REAL NOT NULL DEFAULT 0').run() } catch {}
try { db.prepare('ALTER TABLE orders ADD COLUMN store_credit_used REAL NOT NULL DEFAULT 0').run() } catch {}

// Referral / store credit settings defaults
const referralDefaults = {
  referral_enabled: '0',
  referral_reward_amount: '10',   // store credit for referrer on first order
  referral_min_order: '0',        // min order value to trigger reward
  store_credit_enabled: '1',
  gift_wrap_enabled: '0',
  gift_wrap_price: '5.00',
  gift_wrap_label: 'Gift Wrapping',
}
for (const [key, value] of Object.entries(referralDefaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// ── Phase 39: Product Collections ────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS collections (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    slug         TEXT    NOT NULL UNIQUE,
    description  TEXT    DEFAULT '',
    cover_image  TEXT    DEFAULT '',
    sort_order   INTEGER NOT NULL DEFAULT 0,
    active       INTEGER NOT NULL DEFAULT 1,
    seo_title    TEXT    DEFAULT '',
    seo_desc     TEXT    DEFAULT '',
    created_at   TEXT    DEFAULT (datetime('now')),
    updated_at   TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS collection_products (
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, product_id)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_col_prods ON collection_products(collection_id)`).run()

// ── Phase 39: Post-Purchase Upsell ────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS upsell_offers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    trigger_type  TEXT    NOT NULL DEFAULT 'any',  -- any | product | category
    trigger_value TEXT    DEFAULT '',               -- product_id or category slug
    headline      TEXT    NOT NULL DEFAULT 'Special One-Time Offer!',
    subtext       TEXT    DEFAULT '',
    discount_pct  INTEGER NOT NULL DEFAULT 0,       -- 0 = no discount
    active        INTEGER NOT NULL DEFAULT 1,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS upsell_conversions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id    INTEGER NOT NULL REFERENCES upsell_offers(id) ON DELETE CASCADE,
    order_number TEXT   NOT NULL,
    revenue     REAL   NOT NULL DEFAULT 0,
    created_at  TEXT   DEFAULT (datetime('now'))
  )
`).run()

// ── Phase 39: Suppliers ───────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    contact_name TEXT    DEFAULT '',
    email        TEXT    DEFAULT '',
    phone        TEXT    DEFAULT '',
    website      TEXT    DEFAULT '',
    address      TEXT    DEFAULT '',
    notes        TEXT    DEFAULT '',
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    DEFAULT (datetime('now')),
    updated_at   TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id  INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    po_number    TEXT    NOT NULL UNIQUE,
    status       TEXT    NOT NULL DEFAULT 'draft',  -- draft | sent | received | partial | cancelled
    items        TEXT    NOT NULL DEFAULT '[]',      -- JSON [{product_id, name, qty, unit_cost}]
    total_cost   REAL    NOT NULL DEFAULT 0,
    notes        TEXT    DEFAULT '',
    expected_at  TEXT    DEFAULT NULL,
    received_at  TEXT    DEFAULT NULL,
    created_at   TEXT    DEFAULT (datetime('now')),
    updated_at   TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id)`).run()

// Add supplier_id to products
try { db.prepare('ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL').run() } catch {}

const phase39Defaults = {
  upsell_enabled: '0',
  upsell_button_text: 'Yes! Add to My Order',
  upsell_decline_text: 'No thanks, I\'ll pass',
  suppliers_enabled: '1',
}
for (const [key, value] of Object.entries(phase39Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// ── Phase 40: Waitlist ────────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS product_waitlist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    email       TEXT    NOT NULL,
    name        TEXT    DEFAULT '',
    variant_key TEXT    DEFAULT '',
    notified    INTEGER NOT NULL DEFAULT 0,
    notified_at TEXT    DEFAULT NULL,
    created_at  TEXT    DEFAULT (datetime('now')),
    UNIQUE(product_id, email, variant_key)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_waitlist_product ON product_waitlist(product_id)`).run()

// ── Phase 40: Volume / Tiered Pricing ────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS volume_pricing (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    min_qty     INTEGER NOT NULL DEFAULT 2,
    price       REAL    NOT NULL,
    label       TEXT    DEFAULT '',
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_vol_price_product ON volume_pricing(product_id)`).run()

// ── Phase 40: Product Customization Options ───────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS product_custom_options (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    field_type  TEXT    NOT NULL DEFAULT 'text',  -- text | textarea | select | checkbox | color
    label       TEXT    NOT NULL,
    placeholder TEXT    DEFAULT '',
    options     TEXT    DEFAULT '[]',   -- JSON for select/checkbox
    required    INTEGER NOT NULL DEFAULT 0,
    price_add   REAL    NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_custom_opts_product ON product_custom_options(product_id)`).run()

// Add customizations column to orders items (stored in order JSON items)
// (no schema change needed — customizations stored in the items JSON array)

const phase40Defaults = {
  waitlist_enabled: '1',
  waitlist_notify_email_subject: 'Good news! {{product}} is back in stock',
}
for (const [key, value] of Object.entries(phase40Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// ── Phase 41: Checkout Order Bumps ───────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS order_bumps (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    headline       TEXT    NOT NULL DEFAULT 'Special One-Time Offer!',
    subtext        TEXT    DEFAULT '',
    discount_pct   REAL    NOT NULL DEFAULT 0,
    active         INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    impressions    INTEGER NOT NULL DEFAULT 0,
    conversions    INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_order_bumps_product ON order_bumps(product_id)`).run()

// ── Phase 41: Review Request Queue ───────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS review_requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL,
    order_number TEXT    NOT NULL,
    customer_email TEXT  NOT NULL,
    customer_name  TEXT  DEFAULT '',
    product_ids    TEXT  DEFAULT '[]',  -- JSON array of product ids to review
    status       TEXT    NOT NULL DEFAULT 'pending',  -- pending | sent | skipped
    send_after   TEXT    NOT NULL,  -- datetime when to send
    sent_at      TEXT    DEFAULT NULL,
    created_at   TEXT    DEFAULT (datetime('now')),
    UNIQUE(order_number)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_review_requests_status ON review_requests(status, send_after)`).run()

// ── Phase 41: Multi-location Inventory ───────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS inventory_locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    code        TEXT    NOT NULL UNIQUE,
    address     TEXT    DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS inventory_stock (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id    INTEGER NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    quantity       INTEGER NOT NULL DEFAULT 0,
    reserved       INTEGER NOT NULL DEFAULT 0,
    low_threshold  INTEGER NOT NULL DEFAULT 5,
    updated_at     TEXT    DEFAULT (datetime('now')),
    UNIQUE(product_id, location_id)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_inv_stock_product ON inventory_stock(product_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_inv_stock_location ON inventory_stock(location_id)`).run()

// Seed default inventory location if none exists
const defaultLocExists = db.prepare('SELECT id FROM inventory_locations WHERE is_default = 1').get()
if (!defaultLocExists) {
  db.prepare(`INSERT OR IGNORE INTO inventory_locations (name, code, is_default, active) VALUES ('Main Warehouse', 'MAIN', 1, 1)`).run()
}

const phase41Defaults = {
  order_bumps_enabled:        '1',
  review_requests_enabled:    '1',
  review_request_delay_days:  '7',
  review_request_subject:     'How was your order from {{site_name}}?',
  multi_location_enabled:     '0',
}
for (const [key, value] of Object.entries(phase41Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// ── Phase 41: Customer Groups ─────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_groups (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL UNIQUE,
    slug           TEXT    NOT NULL UNIQUE,
    description    TEXT    DEFAULT '',
    discount_pct   REAL    NOT NULL DEFAULT 0,
    active         INTEGER NOT NULL DEFAULT 1,
    color          TEXT    DEFAULT '#6366f1',
    created_at     TEXT    DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_group_members (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id     INTEGER NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
    customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    added_at     TEXT    DEFAULT (datetime('now')),
    UNIQUE(group_id, customer_id)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cgm_customer ON customer_group_members(customer_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cgm_group ON customer_group_members(group_id)`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_group_pricing (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id     INTEGER NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price        REAL    NOT NULL,
    created_at   TEXT    DEFAULT (datetime('now')),
    UNIQUE(group_id, product_id)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cgp_product ON customer_group_pricing(product_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cgp_group ON customer_group_pricing(group_id)`).run()

const phase41bDefaults = {
  customer_groups_enabled: '1',
  google_shopping_feed_enabled: '1',
  google_merchant_id: '',
}
for (const [key, value] of Object.entries(phase41bDefaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// ════════════════════════════════════════════════════════════════════════════
// Phase 42 — Loyalty Tiers + Product Subscriptions + Order Timeline UI + Storefront Customizer
// ════════════════════════════════════════════════════════════════════════════

// Loyalty Tiers
db.prepare(`
  CREATE TABLE IF NOT EXISTS loyalty_tiers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    slug            TEXT    NOT NULL UNIQUE,
    min_points      INTEGER NOT NULL DEFAULT 0,
    earn_multiplier REAL    NOT NULL DEFAULT 1.0,
    color           TEXT    NOT NULL DEFAULT '#888888',
    icon            TEXT    NOT NULL DEFAULT '⭐',
    perks           TEXT    NOT NULL DEFAULT '[]',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    DEFAULT (datetime('now'))
  )
`).run()

// Default tiers (only if none exist)
const tierCount = db.prepare('SELECT COUNT(*) as n FROM loyalty_tiers').get().n
if (tierCount === 0) {
  const defaultTiers = [
    { name: 'Bronze', slug: 'bronze', min_points: 0,    earn_multiplier: 1.0, color: '#cd7f32', icon: '🥉', perks: '["Free shipping on orders over €50","Birthday bonus points"]',                      sort_order: 1 },
    { name: 'Silver', slug: 'silver', min_points: 500,  earn_multiplier: 1.5, color: '#a8a9ad', icon: '🥈', perks: '["1.5× earn rate","Free shipping on orders over €30","Priority support"]',         sort_order: 2 },
    { name: 'Gold',   slug: 'gold',   min_points: 2000, earn_multiplier: 2.0, color: '#ffd700', icon: '🥇', perks: '["2× earn rate","Free shipping always","Exclusive member discounts","Early access"]', sort_order: 3 },
  ]
  for (const t of defaultTiers) {
    db.prepare(`INSERT OR IGNORE INTO loyalty_tiers (name, slug, min_points, earn_multiplier, color, icon, perks, sort_order) VALUES (?,?,?,?,?,?,?,?)`)
      .run(t.name, t.slug, t.min_points, t.earn_multiplier, t.color, t.icon, t.perks, t.sort_order)
  }
}

// Add tier_id column to customers if missing
const customerColsP42 = db.pragma('table_info(customers)').map(c => c.name)
if (!customerColsP42.includes('loyalty_tier_id')) {
  db.exec(`ALTER TABLE customers ADD COLUMN loyalty_tier_id INTEGER REFERENCES loyalty_tiers(id)`)
}
if (!customerColsP42.includes('loyalty_tier_updated_at')) {
  db.exec(`ALTER TABLE customers ADD COLUMN loyalty_tier_updated_at TEXT`)
}

// Product Subscriptions
db.prepare(`
  CREATE TABLE IF NOT EXISTS product_subscriptions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    interval_days     INTEGER NOT NULL DEFAULT 30,
    interval_label    TEXT    NOT NULL DEFAULT 'Monthly',
    discount_pct      REAL    NOT NULL DEFAULT 0,
    active            INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_ps_product ON product_subscriptions(product_id)`).run()

// Customer Subscription Orders (recurring)
db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_subscriptions_orders (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id       INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id        INTEGER NOT NULL REFERENCES products(id),
    subscription_id   INTEGER NOT NULL REFERENCES product_subscriptions(id) ON DELETE CASCADE,
    status            TEXT    NOT NULL DEFAULT 'active',
    quantity          INTEGER NOT NULL DEFAULT 1,
    unit_price        REAL    NOT NULL DEFAULT 0,
    next_order_date   TEXT    NOT NULL,
    last_order_date   TEXT,
    last_order_number TEXT,
    total_orders      INTEGER NOT NULL DEFAULT 0,
    notes             TEXT    NOT NULL DEFAULT '',
    created_at        TEXT    DEFAULT (datetime('now')),
    cancelled_at      TEXT
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cso_customer ON customer_subscriptions_orders(customer_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cso_product ON customer_subscriptions_orders(product_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cso_status ON customer_subscriptions_orders(status)`).run()

// Add subscription columns to products
const productColsP42 = db.pragma('table_info(products)').map(c => c.name)
if (!productColsP42.includes('subscription_enabled')) {
  db.exec(`ALTER TABLE products ADD COLUMN subscription_enabled INTEGER NOT NULL DEFAULT 0`)
}

// Phase 42 settings
const phase42Defaults = {
  loyalty_tiers_enabled: '1',
  product_subscriptions_enabled: '0',
  theme_font:               'Poppins',
  theme_font_size:          '16px',
  theme_button_radius:      '0.5rem',
  theme_card_style:         'glass',
  theme_nav_style:          'floating',
  theme_hero_layout:        'centered',
  theme_products_per_row:   '3',
  theme_show_excerpt:       '0',
  theme_show_atc:           '1',
  theme_footer_style:       'minimal',
  theme_show_social:        '0',
  bg_color:                 'hsl(228, 4%, 10%)',
  surface_color:            'hsl(228, 4%, 15%)',
  custom_css:               '',
}
for (const [key, value] of Object.entries(phase42Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// ════════════════════════════════════════════════════════════════════════════
// Phase 46 — Appointment Booking + Bulk Coupon Campaigns + Automation Rules
// ════════════════════════════════════════════════════════════════════════════

// Services
db.prepare(`
  CREATE TABLE IF NOT EXISTS services (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    slug          TEXT    NOT NULL UNIQUE,
    description   TEXT    DEFAULT '',
    duration_min  INTEGER NOT NULL DEFAULT 60,
    price         REAL    NOT NULL DEFAULT 0,
    buffer_min    INTEGER NOT NULL DEFAULT 0,
    max_per_slot  INTEGER NOT NULL DEFAULT 1,
    cover_image   TEXT    DEFAULT '',
    gallery       TEXT    DEFAULT '[]',
    category      TEXT    DEFAULT '',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    DEFAULT (datetime('now')),
    updated_at    TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_services_active ON services(active)`).run()

// Weekly availability slots per service
db.prepare(`
  CREATE TABLE IF NOT EXISTS booking_availability (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id    INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    day_of_week   INTEGER NOT NULL, -- 0=Sun ... 6=Sat
    start_time    TEXT    NOT NULL DEFAULT '09:00',
    end_time      TEXT    NOT NULL DEFAULT '17:00',
    available     INTEGER NOT NULL DEFAULT 1,
    UNIQUE(service_id, day_of_week, start_time)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_ba_service ON booking_availability(service_id)`).run()

// Blocked dates (holidays / closures)
db.prepare(`
  CREATE TABLE IF NOT EXISTS booking_blocked_dates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id   INTEGER REFERENCES services(id) ON DELETE CASCADE, -- NULL = all services
    blocked_date TEXT    NOT NULL,
    reason       TEXT    DEFAULT '',
    created_at   TEXT    DEFAULT (datetime('now')),
    UNIQUE(service_id, blocked_date)
  )
`).run()

// Bookings
db.prepare(`
  CREATE TABLE IF NOT EXISTS bookings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id      INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    booking_date    TEXT    NOT NULL,
    time_slot       TEXT    NOT NULL,
    duration_min    INTEGER NOT NULL DEFAULT 60,
    customer_name   TEXT    NOT NULL,
    customer_email  TEXT    NOT NULL,
    customer_phone  TEXT    DEFAULT '',
    notes           TEXT    DEFAULT '',
    admin_notes     TEXT    DEFAULT '',
    reference       TEXT    NOT NULL UNIQUE,
    status          TEXT    NOT NULL DEFAULT 'pending', -- pending, confirmed, completed, cancelled, no_show
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(customer_email)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(reference)`).run()

// Coupon Campaigns (bulk coupon generators)
// Add campaign_id column to existing coupons table if missing
const couponCols = db.pragma('table_info(coupons)').map(c => c.name)
if (!couponCols.includes('campaign_id')) {
  db.exec(`ALTER TABLE coupons ADD COLUMN campaign_id INTEGER REFERENCES coupon_campaigns(id) ON DELETE SET NULL`)
}

db.prepare(`
  CREATE TABLE IF NOT EXISTS coupon_campaigns (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT    NOT NULL,
    description       TEXT    DEFAULT '',
    discount_type     TEXT    NOT NULL DEFAULT 'percentage',
    discount_value    REAL    NOT NULL DEFAULT 10,
    expires_at        TEXT,
    min_order_amount  REAL    NOT NULL DEFAULT 0,
    max_uses_per_code INTEGER NOT NULL DEFAULT 1,
    prefix            TEXT    DEFAULT '',
    code_count        INTEGER NOT NULL DEFAULT 50,
    code_length       INTEGER NOT NULL DEFAULT 8,
    codes_generated   INTEGER NOT NULL DEFAULT 0,
    product_ids       TEXT    DEFAULT '[]',
    category_ids      TEXT    DEFAULT '[]',
    active            INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT    DEFAULT (datetime('now')),
    updated_at        TEXT    DEFAULT (datetime('now'))
  )
`).run()

// Automation Rules
db.prepare(`
  CREATE TABLE IF NOT EXISTS automation_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    trigger     TEXT    NOT NULL,
    conditions  TEXT    NOT NULL DEFAULT '[]',
    actions     TEXT    NOT NULL DEFAULT '[]',
    active      INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_auto_trigger ON automation_rules(trigger)`).run()

// Automation Run History
db.prepare(`
  CREATE TABLE IF NOT EXISTS automation_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id         INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    trigger         TEXT    NOT NULL,
    context_summary TEXT    DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'success', -- success, error
    error           TEXT,
    triggered_at    TEXT    DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_aruns_rule ON automation_runs(rule_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_aruns_status ON automation_runs(status)`).run()

// Phase 46 settings
const phase46Defaults = {
  bookings_enabled:    '0',
  bookings_page_title: 'Book an Appointment',
  bookings_intro:      'Choose a service and pick a time that works for you.',
}
for (const [key, value] of Object.entries(phase46Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// Phase 47 — Post gallery + Bookings confirmation email setting
try { db.prepare(`ALTER TABLE posts ADD COLUMN gallery TEXT NOT NULL DEFAULT '[]'`).run() } catch {}

const phase47Defaults = {
  bookings_confirmation_subject:  'Your booking is confirmed – #{reference}',
  bookings_confirmation_message:  'Thank you for booking with us! We look forward to seeing you.',
  bookings_cancellation_subject:  'Your booking #{reference} has been cancelled',
  bookings_reminder_hours:        '24',
  bookings_reminder_enabled:      '0',
}
for (const [key, value] of Object.entries(phase47Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 42 + Phase 43 + Phase 46 + Phase 47 schema ready')

// ── Phase 48 schema migrations ────────────────────────────────────────────────

// Payment tracking on orders
try { db.prepare(`ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'manual'`).run() } catch {}
try { db.prepare(`ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'`).run() } catch {}
try { db.prepare(`ALTER TABLE orders ADD COLUMN payment_reference TEXT NOT NULL DEFAULT ''`).run() } catch {}

// Product video
try { db.prepare(`ALTER TABLE products ADD COLUMN video_url TEXT NOT NULL DEFAULT ''`).run() } catch {}

// SMS notifications log
db.prepare(`
  CREATE TABLE IF NOT EXISTS sms_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    to_number   TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'sent',  -- sent | failed
    error       TEXT,
    entity_type TEXT,
    entity_id   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

// Phase 48 settings
const phase48Defaults = {
  sms_enabled:          '0',
  sms_provider:         'twilio',
  sms_account_sid:      '',
  sms_auth_token:       '',
  sms_from_number:      '',
  sms_order_confirm:    '1',
  sms_order_shipped:    '1',
  sms_order_message:    'Hi {{name}}, your order {{order_number}} has been placed! Total: {{total}}',
  sms_shipped_message:  'Hi {{name}}, your order {{order_number}} has shipped! Track: {{tracking_url}}',
  sms_notify_admin:     '0',
  sms_admin_number:     '',
}
for (const [key, value] of Object.entries(phase48Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 48 schema ready')

// ── Phase 50 schema migrations ────────────────────────────────────────────────

// Gift Registry
db.prepare(`
  CREATE TABLE IF NOT EXISTS gift_registries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL DEFAULT 'My Gift Registry',
    slug        TEXT    NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    event_type  TEXT    NOT NULL DEFAULT 'wedding', -- wedding|baby|birthday|other
    event_date  TEXT,
    description TEXT    DEFAULT '',
    thank_you   TEXT    DEFAULT '',
    is_public   INTEGER NOT NULL DEFAULT 1,
    status      TEXT    NOT NULL DEFAULT 'active', -- active|archived
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS gift_registry_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    registry_id  INTEGER NOT NULL REFERENCES gift_registries(id) ON DELETE CASCADE,
    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity     INTEGER NOT NULL DEFAULT 1,
    purchased    INTEGER NOT NULL DEFAULT 0,
    notes        TEXT    DEFAULT '',
    added_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS gift_registry_purchases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    registry_id  INTEGER NOT NULL REFERENCES gift_registries(id) ON DELETE CASCADE,
    item_id      INTEGER NOT NULL REFERENCES gift_registry_items(id) ON DELETE CASCADE,
    giver_name   TEXT    NOT NULL DEFAULT 'Anonymous',
    giver_email  TEXT    DEFAULT '',
    quantity     INTEGER NOT NULL DEFAULT 1,
    message      TEXT    DEFAULT '',
    order_id     INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    purchased_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_registry_customer ON gift_registries(customer_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_registry_slug ON gift_registries(slug)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_registry_items_reg ON gift_registry_items(registry_id)`).run()

// Cart-level auto discounts (BOGO / Buy X Get Y)
db.prepare(`
  CREATE TABLE IF NOT EXISTS auto_discounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    type           TEXT    NOT NULL DEFAULT 'bogo', -- bogo|buy_x_get_y|spend_x_get_y|nth_free
    description    TEXT    DEFAULT '',
    buy_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    buy_quantity   INTEGER NOT NULL DEFAULT 1,
    get_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    get_quantity   INTEGER NOT NULL DEFAULT 1,
    get_discount   INTEGER NOT NULL DEFAULT 100, -- percent off the "get" item(s)
    min_spend      REAL    NOT NULL DEFAULT 0,
    nth_item       INTEGER NOT NULL DEFAULT 3,   -- for nth_free type
    max_uses_total INTEGER NOT NULL DEFAULT 0,
    uses_count     INTEGER NOT NULL DEFAULT 0,
    starts_at      TEXT,
    ends_at        TEXT,
    active         INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_auto_disc_active ON auto_discounts(active)`).run()

// Customer LTV table (cache table for fast reads)
db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_ltv (
    customer_id       INTEGER PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    total_orders      INTEGER NOT NULL DEFAULT 0,
    total_spent       REAL    NOT NULL DEFAULT 0,
    avg_order_value   REAL    NOT NULL DEFAULT 0,
    first_order_date  TEXT,
    last_order_date   TEXT,
    days_as_customer  INTEGER NOT NULL DEFAULT 0,
    order_frequency   REAL    NOT NULL DEFAULT 0, -- orders per month
    predicted_ltv     REAL    NOT NULL DEFAULT 0, -- simple 12-month projection
    ltv_tier          TEXT    NOT NULL DEFAULT 'new', -- new|occasional|regular|loyal|vip
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_ltv_tier ON customer_ltv(ltv_tier)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_ltv_spent ON customer_ltv(total_spent)`).run()

// Phase 50 settings
const phase50Defaults = {
  gift_registry_enabled:  '1',
  gift_registry_title:    'Gift Registries',
  auto_discounts_enabled: '1',
}
for (const [key, value] of Object.entries(phase50Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 50 schema ready')

// Phase 50 order column
try { db.prepare(`ALTER TABLE orders ADD COLUMN auto_discount_amount REAL NOT NULL DEFAULT 0`).run() } catch {}


// ─── Phase 51: Order Tags + Inventory Adjustment Log ────────────────────────

db.prepare(`
  CREATE TABLE IF NOT EXISTS order_tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tag        TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(order_id, tag)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_order_tags_order ON order_tags(order_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_order_tags_tag   ON order_tags(tag)`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id      INTEGER,
    reason       TEXT    NOT NULL DEFAULT 'manual', -- manual|sale|return|import|restock
    qty_before   INTEGER NOT NULL,
    qty_change   INTEGER NOT NULL,
    qty_after    INTEGER NOT NULL,
    note         TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_inv_adj_product ON inventory_adjustments(product_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_inv_adj_created ON inventory_adjustments(created_at)`).run()

// Phase 51: add tags column to orders as a cached JSON array for fast listing
try { db.prepare(`ALTER TABLE orders ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`).run() } catch {}

// Phase 51 settings
const phase51Defaults = {
  order_tags_enabled:       '1',
  inventory_log_enabled:    '1',
}
for (const [key, value] of Object.entries(phase51Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 51 schema ready')

// ─── Phase 52: Multi-Vendor Marketplace ──────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS vendors (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    slug             TEXT    UNIQUE NOT NULL,
    email            TEXT    UNIQUE NOT NULL,
    password         TEXT    NOT NULL,
    description      TEXT    DEFAULT '',
    logo             TEXT,
    banner           TEXT,
    status           TEXT    NOT NULL DEFAULT 'pending',
    commission_rate  REAL    NOT NULL DEFAULT 10,
    total_sales      REAL    NOT NULL DEFAULT 0,
    total_commission REAL    NOT NULL DEFAULT 0,
    payout_info      TEXT    DEFAULT '{}',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS vendor_payouts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id   INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount      REAL    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending',
    note        TEXT,
    paid_at     TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS vendor_order_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id         INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_number      TEXT    NOT NULL,
    product_id        INTEGER,
    product_name      TEXT    NOT NULL,
    quantity          INTEGER NOT NULL DEFAULT 1,
    unit_price        REAL    NOT NULL,
    subtotal          REAL    NOT NULL,
    commission_rate   REAL    NOT NULL,
    commission_amount REAL    NOT NULL,
    vendor_amount     REAL    NOT NULL,
    payout_id         INTEGER REFERENCES vendor_payouts(id),
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_vendor_items_vendor ON vendor_order_items(vendor_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_vendor_items_order  ON vendor_order_items(order_id)`).run()

try { db.prepare(`ALTER TABLE products ADD COLUMN vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL`).run() } catch {}

const phase52Defaults = {
  marketplace_enabled:        '0',
  marketplace_name:           'Marketplace',
  marketplace_commission:     '10',
  marketplace_auto_approve:   '0',
  product_comparison_enabled: '1',
  product_comparison_max:     '4',
}
for (const [key, value] of Object.entries(phase52Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 52 schema ready')

// ─── Phase 54: Pre-Orders + Persistent Wishlists + Charity Donations ─────────

// Pre-orders: add columns to products
try { db.prepare(`ALTER TABLE products ADD COLUMN preorder_enabled INTEGER NOT NULL DEFAULT 0`).run() } catch {}
try { db.prepare(`ALTER TABLE products ADD COLUMN preorder_message TEXT DEFAULT 'Pre-order now — ships when available'`).run() } catch {}
try { db.prepare(`ALTER TABLE products ADD COLUMN preorder_release_date TEXT`).run() } catch {}
try { db.prepare(`ALTER TABLE products ADD COLUMN preorder_limit INTEGER DEFAULT 0`).run() } catch {}
try { db.prepare(`ALTER TABLE products ADD COLUMN preorder_count INTEGER NOT NULL DEFAULT 0`).run() } catch {}

// Persistent wishlist for logged-in customers
db.prepare(`
  CREATE TABLE IF NOT EXISTS wishlists (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(customer_id, product_id)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_wishlists_customer ON wishlists(customer_id)`).run()

// Charity / donation campaigns
db.prepare(`
  CREATE TABLE IF NOT EXISTS charity_campaigns (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    description      TEXT    DEFAULT '',
    logo             TEXT,
    mode             TEXT    NOT NULL DEFAULT 'roundup', -- roundup | fixed | custom
    fixed_amounts    TEXT    NOT NULL DEFAULT '[1,2,5]',  -- JSON array for fixed mode
    active           INTEGER NOT NULL DEFAULT 1,
    total_raised     REAL    NOT NULL DEFAULT 0,
    donation_count   INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS charity_donations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id      INTEGER NOT NULL REFERENCES charity_campaigns(id) ON DELETE CASCADE,
    order_id         INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    order_number     TEXT,
    customer_email   TEXT,
    amount           REAL    NOT NULL,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_donations_campaign ON charity_donations(campaign_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_donations_order    ON charity_donations(order_id)`).run()

// Add donation_amount to orders
try { db.prepare(`ALTER TABLE orders ADD COLUMN donation_amount REAL DEFAULT 0`).run() } catch {}
try { db.prepare(`ALTER TABLE orders ADD COLUMN donation_campaign_id INTEGER`).run() } catch {}

// Customer order cancellation tracking
try { db.prepare(`ALTER TABLE orders ADD COLUMN cancelled_by TEXT`).run() } catch {} // 'customer' | 'admin'
try { db.prepare(`ALTER TABLE orders ADD COLUMN cancel_reason TEXT`).run() } catch {}
try { db.prepare(`ALTER TABLE orders ADD COLUMN cancelled_at TEXT`).run() } catch {}

const phase54Defaults = {
  preorders_enabled:          '1',
  wishlists_enabled:          '1',
  charity_enabled:            '0',
  customer_cancel_enabled:    '1',
  customer_cancel_window:     '24', // hours
}
for (const [key, value] of Object.entries(phase54Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 54 schema ready')

// Phase 55 — Stock History table
db.prepare(`
  CREATE TABLE IF NOT EXISTS stock_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_qty     INTEGER NOT NULL DEFAULT 0,
    new_qty     INTEGER NOT NULL DEFAULT 0,
    change_amt  INTEGER NOT NULL DEFAULT 0,
    reason      TEXT    NOT NULL DEFAULT 'manual', -- manual | order | adjustment | return | import
    order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    admin_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_name  TEXT,
    note        TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_history(created_at DESC)`).run()

// Phase 55 defaults
const phase55Defaults = {
  stock_history_enabled: '1',
  pwa_enabled:           '0',
  pwa_name:              'My Site',
  pwa_short_name:        'My Site',
  pwa_theme_color:       '#c0434e',
}
for (const [key, value] of Object.entries(phase55Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 55 schema ready')

// Phase 56 — AI Content Helper + Order Multi-Shipment settings
const phase56Defaults = {
  ai_enabled:    '0',
  ai_api_url:    'https://api.openai.com/v1/chat/completions',
  ai_api_key:    '',
  ai_model:      'gpt-3.5-turbo',
  ai_tone:       'professional',
  multi_shipment_enabled: '1',
}
for (const [key, value] of Object.entries(phase56Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// order_shipments table (idempotent)
db.prepare(`
  CREATE TABLE IF NOT EXISTS order_shipments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier          TEXT,
    tracking_number  TEXT,
    tracking_url     TEXT,
    items            TEXT DEFAULT '[]',
    status           TEXT NOT NULL DEFAULT 'pending',
    shipped_at       TEXT,
    delivered_at     TEXT,
    notes            TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_order_shipments_order ON order_shipments(order_id)`).run()

console.log('Phase 56 schema ready')

// ─── Phase 57 Schema ──────────────────────────────────────────────────────────

// changelog / release notes
db.prepare(`
  CREATE TABLE IF NOT EXISTS changelog_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    version     TEXT NOT NULL,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    type        TEXT NOT NULL DEFAULT 'feature',
    status      TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_changelog_status ON changelog_entries(status, published_at DESC)`).run()

// NPS surveys
db.prepare(`
  CREATE TABLE IF NOT EXISTS nps_surveys (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number  TEXT,
    customer_email TEXT,
    score         INTEGER NOT NULL CHECK(score BETWEEN 0 AND 10),
    feedback      TEXT,
    category      TEXT,
    responded_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_nps_score ON nps_surveys(score)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_nps_email ON nps_surveys(customer_email)`).run()

const phase57Defaults = {
  changelog_enabled: '1',
  changelog_title:   'What\'s New',
  changelog_subtitle:'Stay up to date with the latest features and improvements.',
  nps_enabled:       '0',
  nps_delay_days:    '3',
  nps_question:      'How likely are you to recommend us to a friend or colleague?',
  nps_follow_up:     'What\'s the main reason for your score?',
  shipping_label_from_name: '',
  shipping_label_from_address: '',
  shipping_label_from_city: '',
  shipping_label_from_zip: '',
  shipping_label_from_country: '',
}
for (const [key, value] of Object.entries(phase57Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 57 schema ready')

// ─── Phase 58 Schema ──────────────────────────────────────────────────────────

// Product Specifications (key-value attributes per product)
db.prepare(`
  CREATE TABLE IF NOT EXISTS product_specs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    value       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    group_name  TEXT NOT NULL DEFAULT 'General',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_product_specs_product ON product_specs(product_id, sort_order)`).run()

// Scheduled Email Reports
db.prepare(`
  CREATE TABLE IF NOT EXISTS scheduled_reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    frequency       TEXT NOT NULL DEFAULT 'weekly',
    day_of_week     INTEGER DEFAULT 1,
    day_of_month    INTEGER DEFAULT 1,
    send_time       TEXT NOT NULL DEFAULT '08:00',
    recipients      TEXT NOT NULL DEFAULT '[]',
    report_types    TEXT NOT NULL DEFAULT '["orders","revenue"]',
    last_sent_at    TEXT,
    next_send_at    TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()

const phase58Defaults = {
  geo_analytics_enabled: '1',
  scheduled_reports_enabled: '1',
}
for (const [key, value] of Object.entries(phase58Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 58 schema ready')

// ─── Phase 59 Schema ──────────────────────────────────────────────────────────

// Survey Builder
db.prepare(`
  CREATE TABLE IF NOT EXISTS surveys (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT NOT NULL,
    slug           TEXT NOT NULL UNIQUE,
    description    TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'draft',
    show_progress  INTEGER NOT NULL DEFAULT 1,
    allow_multiple INTEGER NOT NULL DEFAULT 0,
    success_message TEXT NOT NULL DEFAULT 'Thank you for your response!',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS survey_questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id   INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'text',
    options     TEXT NOT NULL DEFAULT '[]',
    required    INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    placeholder TEXT NOT NULL DEFAULT ''
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id, sort_order)`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS survey_responses (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id        INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    respondent_id    TEXT NOT NULL,
    respondent_email TEXT,
    submitted_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id)`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS survey_answers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id  INTEGER NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id  INTEGER NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    answer_text  TEXT NOT NULL DEFAULT '',
    answer_value TEXT NOT NULL DEFAULT ''
  )
`).run()

// Customer Tags
db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_tag_definitions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_tag_assignments (
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES customer_tag_definitions(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (customer_id, tag_id)
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_customer_tags_tag ON customer_tag_assignments(tag_id)`).run()

// Custom Order Statuses
db.prepare(`
  CREATE TABLE IF NOT EXISTS custom_order_statuses (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    slug             TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    color            TEXT NOT NULL DEFAULT '#6366f1',
    description      TEXT NOT NULL DEFAULT '',
    sort_order       INTEGER NOT NULL DEFAULT 0,
    active           INTEGER NOT NULL DEFAULT 1,
    notify_customer  INTEGER NOT NULL DEFAULT 0,
    email_subject    TEXT NOT NULL DEFAULT '',
    email_body       TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()

// Survey slug auto-generate trigger (for surveys without explicit slug)
// We'll handle this in the route instead.

const phase59Defaults = {
  surveys_enabled: '1',
  customer_tags_enabled: '1',
  custom_order_statuses_enabled: '1',
}
for (const [key, value] of Object.entries(phase59Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// ─── Phase 60 Schema ──────────────────────────────────────────────────────────

// IP Blocklist
db.prepare(`
  CREATE TABLE IF NOT EXISTS ip_blocklist (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern    TEXT    NOT NULL,
    type       TEXT    NOT NULL DEFAULT 'exact',
    note       TEXT    NOT NULL DEFAULT '',
    active     INTEGER NOT NULL DEFAULT 1,
    hits       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_ip_blocklist_active ON ip_blocklist(active)`).run()

// Safe migration: add folder_id to media if missing (already done in Phase 15 but guard added)
try { db.prepare(`ALTER TABLE media ADD COLUMN folder_id INTEGER REFERENCES media_folders(id) ON DELETE SET NULL`).run() } catch {}

const phase60Defaults = {
  ip_blocklist_enabled: '1',
  site_audit_enabled: '1',
}
for (const [key, value] of Object.entries(phase60Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 60 schema ready')

// ─── Phase 62 Schema ──────────────────────────────────────────────────────────

const phase62Defaults = {
  store_locator_enabled: '1',
  store_locator_title: 'Find a Store',
  store_locator_subtitle: 'Discover our locations near you',
  shared_wishlists_enabled: '1',
}
for (const [key, value] of Object.entries(phase62Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// Shared wishlist share_code column
try { db.prepare(`ALTER TABLE wishlists ADD COLUMN share_code TEXT`).run() } catch {}
// Shared wishlist lists table
db.prepare(`
  CREATE TABLE IF NOT EXISTS shared_wishlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    share_code TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL DEFAULT 'My Wishlist',
    public     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_shared_wishlists_code ON shared_wishlists(share_code)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_shared_wishlists_customer ON shared_wishlists(customer_id)`).run()

console.log('Phase 62 schema ready')

// ─── Phase 66 Schema ──────────────────────────────────────────────────────────

// Knowledge Base Tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS kb_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '📖',
    color TEXT DEFAULT '#e05562',
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS kb_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT DEFAULT '',
    content TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    views INTEGER DEFAULT 0,
    helpful_yes INTEGER DEFAULT 0,
    helpful_no INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    meta_title TEXT,
    meta_desc TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run()

const phase66Defaults = {
  kb_enabled: '1',
  kb_title: 'Help Center',
  kb_subtitle: 'Find answers to your questions',
  kb_search_placeholder: 'Search for answers…',
}
for (const [key, value] of Object.entries(phase66Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 66 schema ready')

// ─── Phase 67 Schema ──────────────────────────────────────────────────────────

// Social Media Scheduler
db.prepare(`
  CREATE TABLE IF NOT EXISTS social_accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    platform   TEXT NOT NULL,
    name       TEXT NOT NULL,
    handle     TEXT NOT NULL,
    access_token TEXT DEFAULT '',
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS social_posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id   INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'draft',
    content      TEXT NOT NULL DEFAULT '',
    media_url    TEXT DEFAULT '',
    link_url     TEXT DEFAULT '',
    scheduled_at TEXT DEFAULT NULL,
    published_at TEXT DEFAULT NULL,
    platform_post_id TEXT DEFAULT '',
    error_msg    TEXT DEFAULT '',
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
  )
`).run()

// Canned Responses
db.prepare(`
  CREATE TABLE IF NOT EXISTS canned_responses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    shortcut   TEXT NOT NULL DEFAULT '',
    body       TEXT NOT NULL DEFAULT '',
    category   TEXT NOT NULL DEFAULT 'general',
    scope      TEXT NOT NULL DEFAULT 'both',
    use_count  INTEGER DEFAULT 0,
    active     INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run()

// Team Members
db.prepare(`
  CREATE TABLE IF NOT EXISTS team_members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL DEFAULT '',
    department  TEXT NOT NULL DEFAULT '',
    bio         TEXT NOT NULL DEFAULT '',
    photo       TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    linkedin    TEXT NOT NULL DEFAULT '',
    twitter     TEXT NOT NULL DEFAULT '',
    github      TEXT NOT NULL DEFAULT '',
    website     TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active',
    featured    INTEGER DEFAULT 0,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )
`).run()

const phase67Defaults = {
  social_scheduler_enabled: '1',
  canned_responses_enabled: '1',
  team_page_enabled: '1',
  team_page_title: 'Meet the Team',
  team_page_subtitle: 'The people behind the magic',
}
for (const [key, value] of Object.entries(phase67Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 67 schema ready')

// ─── Phase 68 Schema ──────────────────────────────────────────────────────────

// CSAT (Customer Satisfaction) feedback
db.prepare(`
  CREATE TABLE IF NOT EXISTS csat_ratings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    page_path   TEXT NOT NULL DEFAULT '/',
    rating      INTEGER NOT NULL,
    comment     TEXT NOT NULL DEFAULT '',
    session_id  TEXT NOT NULL DEFAULT '',
    ip          TEXT NOT NULL DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now'))
  )
`).run()

const phase68Defaults = {
  csat_enabled: '0',
  csat_question: 'Was this page helpful?',
  csat_type: 'thumbs',
  csat_delay_ms: '3000',
  csat_show_comment: '1',
  csat_comment_placeholder: 'Tell us more (optional)\u2026',
  csat_thank_you_message: 'Thanks for your feedback!',
  csat_position: 'bottom-right',
}
for (const [key, value] of Object.entries(phase68Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 68 schema ready')

// ─── Phase 69 Schema ──────────────────────────────────────────────────────────

// GDPR Privacy Requests
db.prepare(`
  CREATE TABLE IF NOT EXISTS privacy_requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT NOT NULL DEFAULT 'export',
    customer_id  INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    email        TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'pending',
    token        TEXT NOT NULL DEFAULT '',
    notes        TEXT NOT NULL DEFAULT '',
    admin_notes  TEXT NOT NULL DEFAULT '',
    completed_at TEXT DEFAULT NULL,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
  )
`).run()

// Win-back Campaigns
db.prepare(`
  CREATE TABLE IF NOT EXISTS winback_campaigns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL DEFAULT 'Win-back Campaign',
    days_inactive   INTEGER NOT NULL DEFAULT 90,
    coupon_code     TEXT NOT NULL DEFAULT '',
    discount_pct    REAL NOT NULL DEFAULT 0,
    subject         TEXT NOT NULL DEFAULT 'We miss you!',
    body            TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'draft',
    sent_count      INTEGER DEFAULT 0,
    open_count      INTEGER DEFAULT 0,
    convert_count   INTEGER DEFAULT 0,
    last_sent_at    TEXT DEFAULT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS winback_sends (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id  INTEGER NOT NULL REFERENCES winback_campaigns(id) ON DELETE CASCADE,
    customer_id  INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    email        TEXT NOT NULL DEFAULT '',
    coupon_code  TEXT NOT NULL DEFAULT '',
    sent_at      TEXT DEFAULT (datetime('now')),
    opened       INTEGER DEFAULT 0,
    converted    INTEGER DEFAULT 0
  )
`).run()

// Customer Notification Preferences
db.prepare(`
  CREATE TABLE IF NOT EXISTS notification_prefs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id   INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    order_updates INTEGER DEFAULT 1,
    promotions    INTEGER DEFAULT 1,
    newsletter    INTEGER DEFAULT 1,
    back_in_stock INTEGER DEFAULT 1,
    price_drops   INTEGER DEFAULT 1,
    loyalty       INTEGER DEFAULT 1,
    digest        INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  )
`).run()

const phase69Defaults = {
  gdpr_privacy_page_title: 'Your Privacy',
  gdpr_privacy_page_subtitle: 'Manage your personal data',
  gdpr_data_export_enabled: '1',
  gdpr_deletion_enabled: '1',
  gdpr_deletion_delay_days: '30',
  gdpr_dpo_email: '',
  winback_enabled: '1',
  notification_prefs_enabled: '1',
}
for (const [key, value] of Object.entries(phase69Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 69 schema ready')

// ─── Phase 70 Schema ──────────────────────────────────────────────────────────

// Newsletter Email Templates
db.prepare(`
  CREATE TABLE IF NOT EXISTS email_templates_newsletter (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL DEFAULT 'My Template',
    subject     TEXT NOT NULL DEFAULT '',
    html_blocks TEXT NOT NULL DEFAULT '[]',
    preview_text TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'general',
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )
`).run()

// Stock update import log
db.prepare(`
  CREATE TABLE IF NOT EXISTS stock_imports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filename    TEXT NOT NULL DEFAULT '',
    total       INTEGER DEFAULT 0,
    updated     INTEGER DEFAULT 0,
    skipped     INTEGER DEFAULT 0,
    errors      TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT DEFAULT (datetime('now'))
  )
`).run()

const phase70Defaults = {
  welcome_email_enabled:   '0',
  welcome_email_message:   '',
  newsletter_from_name:    '',
  newsletter_reply_to:     '',
}
for (const [key, value] of Object.entries(phase70Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 70 schema ready')

// ─── Phase 71 Schema ──────────────────────────────────────────────────────────

// Journey events tracked inline in customer_journey.js router

// Shortcut Definitions (static — just for documentation + frontend display)
// No table needed — shortcuts are hardcoded in the frontend

// Admin dashboard widget layout preferences
db.prepare(`
  CREATE TABLE IF NOT EXISTS dashboard_widget_prefs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    layout    TEXT NOT NULL DEFAULT '[]',
    hidden    TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run()

const phase71Defaults = {
  customer_journey_enabled: '1',
  journey_track_logged_out: '1',
}
for (const [key, value] of Object.entries(phase71Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 71 schema ready')

// ─── Phase 72 Schema ──────────────────────────────────────────────────────────

// Add admin_reply column to product_reviews (safe migration)
try {
  db.prepare(`ALTER TABLE product_reviews ADD COLUMN admin_reply TEXT NOT NULL DEFAULT ''`).run()
  db.prepare(`ALTER TABLE product_reviews ADD COLUMN admin_reply_at TEXT`).run()
} catch {}

// Import history for CSV product imports
db.prepare(`
  CREATE TABLE IF NOT EXISTS import_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filename    TEXT NOT NULL DEFAULT '',
    mode        TEXT NOT NULL DEFAULT 'merge',
    created     INTEGER NOT NULL DEFAULT 0,
    updated     INTEGER NOT NULL DEFAULT 0,
    skipped     INTEGER NOT NULL DEFAULT 0,
    errors      TEXT NOT NULL DEFAULT '[]',
    imported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  )
`).run()

const phase72Defaults = {
  review_replies_enabled: '1',
  also_bought_enabled: '1',
  also_bought_limit: '4',
}
for (const [key, value] of Object.entries(phase72Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 72 schema ready')

// ─── Phase 73 Schema ──────────────────────────────────────────────────────────

// Quote Requests (B2B)
db.prepare(`
  CREATE TABLE IF NOT EXISTS quote_requests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reference       TEXT NOT NULL UNIQUE,
    customer_name   TEXT NOT NULL DEFAULT '',
    customer_email  TEXT NOT NULL DEFAULT '',
    customer_phone  TEXT NOT NULL DEFAULT '',
    company_name    TEXT NOT NULL DEFAULT '',
    items           TEXT NOT NULL DEFAULT '[]',
    notes           TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending',
    admin_notes     TEXT NOT NULL DEFAULT '',
    quoted_amount   REAL,
    valid_until     TEXT,
    customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  )
`).run()

// Review Photos — photos attached to product reviews
try {
  db.prepare(`ALTER TABLE product_reviews ADD COLUMN photos TEXT NOT NULL DEFAULT '[]'`).run()
} catch {}

// Price History — track price changes per product
db.prepare(`
  CREATE TABLE IF NOT EXISTS product_price_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price       REAL NOT NULL DEFAULT 0,
    sale_price  REAL,
    changed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    changed_by_name TEXT NOT NULL DEFAULT '',
    note        TEXT NOT NULL DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history(product_id, created_at DESC)`).run()

const phase73Defaults = {
  quote_requests_enabled:   '1',
  quote_valid_days:         '30',
  quote_intro_text:         'Request a custom quote for bulk orders or special pricing.',
  review_photos_enabled:    '1',
  review_photos_max:        '3',
  price_history_enabled:    '1',
}
for (const [key, value] of Object.entries(phase73Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 73 schema ready')

// ─── Phase 74 Schema ──────────────────────────────────────────────────────────

// Customer Feedback Board
db.prepare(`
  CREATE TABLE IF NOT EXISTS feedback_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL DEFAULT 'general',
    status          TEXT NOT NULL DEFAULT 'open',
    votes           INTEGER NOT NULL DEFAULT 0,
    customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name   TEXT NOT NULL DEFAULT 'Anonymous',
    customer_email  TEXT NOT NULL DEFAULT '',
    admin_response  TEXT NOT NULL DEFAULT '',
    admin_response_at TEXT,
    is_pinned       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS feedback_votes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id   INTEGER NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
    voter_session TEXT NOT NULL DEFAULT '',
    voter_email   TEXT NOT NULL DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now')),
    UNIQUE(feedback_id, voter_session)
  )
`).run()

// Order Disputes
db.prepare(`
  CREATE TABLE IF NOT EXISTS order_disputes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reference       TEXT NOT NULL UNIQUE,
    order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    order_number    TEXT NOT NULL DEFAULT '',
    customer_name   TEXT NOT NULL DEFAULT '',
    customer_email  TEXT NOT NULL DEFAULT '',
    reason          TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    evidence_urls   TEXT NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'open',
    resolution      TEXT NOT NULL DEFAULT '',
    refund_amount   REAL,
    admin_notes     TEXT NOT NULL DEFAULT '',
    resolved_at     TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  )
`).run()

// Inventory reorder_point column (safe migration)
try {
  db.prepare(`ALTER TABLE products ADD COLUMN reorder_point INTEGER NOT NULL DEFAULT 0`).run()
} catch {}
try {
  db.prepare(`ALTER TABLE products ADD COLUMN reorder_qty INTEGER NOT NULL DEFAULT 0`).run()
} catch {}
try {
  db.prepare(`ALTER TABLE products ADD COLUMN reorder_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL`).run()
} catch {}

// Reorder alerts log
db.prepare(`
  CREATE TABLE IF NOT EXISTS reorder_alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock_qty   INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 0,
    notified    INTEGER NOT NULL DEFAULT 0,
    notified_at TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  )
`).run()

const phase74Defaults = {
  feedback_board_enabled:  '1',
  feedback_board_title:    'Feedback & Ideas',
  feedback_board_subtitle: 'Share your ideas and vote on what you want to see next.',
  disputes_enabled:        '1',
  reorder_alerts_enabled:  '1',
  reorder_alert_email:     '',
}
for (const [key, value] of Object.entries(phase74Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 74 schema ready')

// ─── Phase 74b Schema (product labels) ────────────────────────────────────────
try {
  db.prepare(`ALTER TABLE products ADD COLUMN barcode TEXT`).run()
} catch {}

// ─── Phase 75 Schema ──────────────────────────────────────────────────────────

// Product cost price (for margin tracking)
try { db.prepare(`ALTER TABLE products ADD COLUMN cost_price REAL`).run() } catch {}

// Order admin notes (internal threaded notes, not customer-visible)
db.prepare(`
  CREATE TABLE IF NOT EXISTS order_admin_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    admin_id    INTEGER,
    admin_name  TEXT NOT NULL DEFAULT 'Admin',
    note        TEXT NOT NULL DEFAULT '',
    note_type   TEXT NOT NULL DEFAULT 'note',
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )
`).run()

// Changelog public visibility
const phase75Defaults = {
  margin_tracking_enabled: '1',
  changelog_public:        '0',
  changelog_public_title:  "What's New",
  changelog_public_subtitle: 'Latest updates and improvements.',
}
for (const [key, value] of Object.entries(phase75Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 75 schema ready')

// ── Phase 73 ─────────────────────────────────────────────────────────────────

// Product Configurators
db.prepare(`
  CREATE TABLE IF NOT EXISTS product_configurators (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    steps       TEXT NOT NULL DEFAULT '[]',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )
`).run()

// Segment bulk email campaigns
db.prepare(`
  CREATE TABLE IF NOT EXISTS segment_email_campaigns (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL DEFAULT '',
    subject          TEXT NOT NULL DEFAULT '',
    html_body        TEXT NOT NULL DEFAULT '',
    filter_type      TEXT NOT NULL DEFAULT 'all',
    filters          TEXT DEFAULT '{}',
    recipient_count  INTEGER NOT NULL DEFAULT 0,
    sent_count       INTEGER NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'pending',
    created_by       INTEGER,
    created_at       TEXT DEFAULT (datetime('now')),
    completed_at     TEXT
  )
`).run()

const phase73Defaults = {
  churn_analysis_enabled: '1',
  configurator_enabled:   '1',
  language_switcher:      '0',
  default_language:       'en',
  available_languages:    '["en"]',
}
for (const [key, value] of Object.entries(phase73Defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

console.log('Phase 73 schema ready')
