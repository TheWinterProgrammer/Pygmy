// backend/src/routes/vendors.js
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { authMiddleware as adminAuth } from '../middleware/auth.js'

const router = express.Router()
const VENDOR_JWT_SECRET = process.env.VENDOR_JWT_SECRET || 'vendor-secret-dev'

// ─── Vendor Auth Middleware ───────────────────────────────────────────────────
export function vendorAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(auth.slice(7), VENDOR_JWT_SECRET)
    if (payload.type !== 'vendor') return res.status(401).json({ error: 'Not a vendor token' })
    const vendor = db.prepare(`SELECT * FROM vendors WHERE id = ?`).get(payload.id)
    if (!vendor || vendor.status === 'suspended') return res.status(401).json({ error: 'Vendor account suspended or not found' })
    req.vendor = vendor
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

function makeToken(vendor) {
  return jwt.sign({ id: vendor.id, email: vendor.email, type: 'vendor' }, VENDOR_JWT_SECRET, { expiresIn: '30d' })
}

function safeVendor(v) {
  const { password, ...safe } = v
  return safe
}

// ─── Public: Register ─────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, slug, email, password, description } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' })
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const existing = db.prepare(`SELECT id FROM vendors WHERE email = ? OR slug = ?`).get(email, finalSlug)
    if (existing) return res.status(409).json({ error: 'Email or slug already taken' })
    const hash = await bcrypt.hash(password, 12)
    const auto = db.prepare(`SELECT value FROM settings WHERE key = 'marketplace_auto_approve'`).get()
    const status = auto?.value === '1' ? 'active' : 'pending'
    const result = db.prepare(`
      INSERT INTO vendors (name, slug, email, password, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, finalSlug, email, hash, description || '', status)
    const vendor = db.prepare(`SELECT * FROM vendors WHERE id = ?`).get(result.lastInsertRowid)
    res.status(201).json({ vendor: safeVendor(vendor), token: makeToken(vendor) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Public: Login ────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const vendor = db.prepare(`SELECT * FROM vendors WHERE email = ?`).get(email)
    if (!vendor) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, vendor.password)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    if (vendor.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })
    res.json({ vendor: safeVendor(vendor), token: makeToken(vendor) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Vendor: Me ───────────────────────────────────────────────────────────────
router.get('/me', vendorAuthMiddleware, (req, res) => {
  res.json(safeVendor(req.vendor))
})

router.put('/me', vendorAuthMiddleware, (req, res) => {
  const { name, description, logo, banner, payout_info } = req.body
  db.prepare(`
    UPDATE vendors SET name=COALESCE(?,name), description=COALESCE(?,description),
    logo=COALESCE(?,logo), banner=COALESCE(?,banner), payout_info=COALESCE(?,payout_info),
    updated_at=datetime('now') WHERE id=?
  `).run(name||null, description||null, logo||null, banner||null,
    payout_info ? JSON.stringify(payout_info) : null, req.vendor.id)
  const updated = db.prepare(`SELECT * FROM vendors WHERE id=?`).get(req.vendor.id)
  res.json(safeVendor(updated))
})

// ─── Vendor: Products ─────────────────────────────────────────────────────────
router.get('/me/products', vendorAuthMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT * FROM products WHERE vendor_id = ? ORDER BY created_at DESC`).all(req.vendor.id)
  res.json(rows)
})

router.post('/me/products', vendorAuthMiddleware, (req, res) => {
  const { name, slug, excerpt, description, price, sale_price, sku, cover_image, category_id, tags, status } = req.body
  if (!name || !price) return res.status(400).json({ error: 'name and price required' })
  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const result = db.prepare(`
    INSERT INTO products (name, slug, excerpt, description, price, sale_price, sku, cover_image, category_id, tags, status, vendor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, finalSlug, excerpt||'', description||'', price, sale_price||null, sku||null, cover_image||null, category_id||null, tags||'[]', status||'draft', req.vendor.id)
  res.status(201).json(db.prepare(`SELECT * FROM products WHERE id=?`).get(result.lastInsertRowid))
})

router.put('/me/products/:id', vendorAuthMiddleware, (req, res) => {
  const product = db.prepare(`SELECT * FROM products WHERE id=? AND vendor_id=?`).get(req.params.id, req.vendor.id)
  if (!product) return res.status(404).json({ error: 'Not found or not yours' })
  const { name, excerpt, description, price, sale_price, sku, cover_image, category_id, tags, status } = req.body
  db.prepare(`
    UPDATE products SET name=COALESCE(?,name), excerpt=COALESCE(?,excerpt), description=COALESCE(?,description),
    price=COALESCE(?,price), sale_price=?, sku=COALESCE(?,sku), cover_image=COALESCE(?,cover_image),
    category_id=COALESCE(?,category_id), tags=COALESCE(?,tags), status=COALESCE(?,status), updated_at=datetime('now')
    WHERE id=?
  `).run(name||null, excerpt||null, description||null, price||null, sale_price||null, sku||null, cover_image||null, category_id||null, tags||null, status||null, req.params.id)
  res.json(db.prepare(`SELECT * FROM products WHERE id=?`).get(req.params.id))
})

router.delete('/me/products/:id', vendorAuthMiddleware, (req, res) => {
  const product = db.prepare(`SELECT * FROM products WHERE id=? AND vendor_id=?`).get(req.params.id, req.vendor.id)
  if (!product) return res.status(404).json({ error: 'Not found or not yours' })
  db.prepare(`DELETE FROM products WHERE id=?`).run(req.params.id)
  res.json({ ok: true })
})

// ─── Vendor: Orders ───────────────────────────────────────────────────────────
router.get('/me/orders', vendorAuthMiddleware, (req, res) => {
  const { limit = 50, offset = 0 } = req.query
  const rows = db.prepare(`
    SELECT * FROM vendor_order_items WHERE vendor_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(req.vendor.id, +limit, +offset)
  const total = db.prepare(`SELECT COUNT(*) as c FROM vendor_order_items WHERE vendor_id=?`).get(req.vendor.id)
  res.json({ items: rows, total: total.c })
})

// ─── Vendor: Stats ────────────────────────────────────────────────────────────
router.get('/me/stats', vendorAuthMiddleware, (req, res) => {
  const v = db.prepare(`SELECT * FROM vendors WHERE id=?`).get(req.vendor.id)
  const orderCount = db.prepare(`SELECT COUNT(DISTINCT order_id) as c FROM vendor_order_items WHERE vendor_id=?`).get(req.vendor.id)
  const paid = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM vendor_payouts WHERE vendor_id=? AND status='paid'`).get(req.vendor.id)
  const pending_payout = Math.max(0, (v.total_sales - v.total_commission) - paid.total)
  const recent = db.prepare(`SELECT * FROM vendor_order_items WHERE vendor_id=? ORDER BY created_at DESC LIMIT 5`).all(req.vendor.id)
  const productCount = db.prepare(`SELECT COUNT(*) as c FROM products WHERE vendor_id=?`).get(req.vendor.id)
  res.json({
    total_sales: v.total_sales,
    total_commission: v.total_commission,
    net_earnings: v.total_sales - v.total_commission,
    pending_payout,
    order_count: orderCount.c,
    product_count: productCount.c,
    recent_orders: recent
  })
})

// ─── Vendor: Payouts ─────────────────────────────────────────────────────────
router.get('/me/payouts', vendorAuthMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT * FROM vendor_payouts WHERE vendor_id=? ORDER BY created_at DESC`).all(req.vendor.id)
  res.json(rows)
})

// ─── Public: List Active Vendors (marketplace storefront) ─────────────────────
router.get('/public', (req, res) => {
  const enabled = db.prepare(`SELECT value FROM settings WHERE key='marketplace_enabled'`).get()?.value
  if (enabled !== '1') return res.json({ vendors: [] })
  const { q, limit = 24, offset = 0 } = req.query
  let where = [`v.status = 'active'`]
  const params = []
  if (q) { where.push(`(v.name LIKE ? OR v.description LIKE ?)`); params.push(`%${q}%`, `%${q}%`) }
  const clause = 'WHERE ' + where.join(' AND ')
  const rows = db.prepare(`
    SELECT v.id, v.name, v.slug, v.description, v.logo, v.banner, v.total_sales, v.created_at,
           COUNT(p.id) as product_count
    FROM vendors v
    LEFT JOIN products p ON p.vendor_id = v.id AND p.status = 'published'
    ${clause}
    GROUP BY v.id
    ORDER BY v.total_sales DESC, v.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, +limit, +offset)
  const total = db.prepare(`SELECT COUNT(*) as c FROM vendors v ${clause}`).get(...params)
  res.json({ vendors: rows, total: total.c })
})

// ─── Public: Single Vendor Storefront ─────────────────────────────────────────
router.get('/public/:slug', (req, res) => {
  const enabled = db.prepare(`SELECT value FROM settings WHERE key='marketplace_enabled'`).get()?.value
  if (enabled !== '1') return res.status(404).json({ error: 'Marketplace not enabled' })
  const vendor = db.prepare(`
    SELECT id, name, slug, description, logo, banner, total_sales, created_at
    FROM vendors WHERE slug=? AND status='active'
  `).get(req.params.slug)
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' })
  const { q, category, limit = 24, offset = 0 } = req.query
  let where = [`p.vendor_id = ?`, `p.status = 'published'`]
  const pParams = [vendor.id]
  if (q) { where.push(`(p.name LIKE ? OR p.excerpt LIKE ?)`); pParams.push(`%${q}%`, `%${q}%`) }
  if (category) { where.push(`p.category_id = ?`); pParams.push(category) }
  const clause = 'WHERE ' + where.join(' AND ')
  const products = db.prepare(`
    SELECT p.id, p.name, p.slug, p.excerpt, p.price, p.sale_price, p.cover_image,
           p.tags, p.status, p.featured, p.stock_quantity, p.track_stock, p.allow_backorder,
           pc.name as category_name
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    ${clause}
    ORDER BY p.featured DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...pParams, +limit, +offset)
  const total = db.prepare(`SELECT COUNT(*) as c FROM products p ${clause}`).get(...pParams)
  const productCount = db.prepare(`SELECT COUNT(*) as c FROM products WHERE vendor_id=? AND status='published'`).get(vendor.id)
  res.json({ vendor: { ...vendor, product_count: productCount.c }, products, total: total.c })
})

// ─── Admin: List Vendors ──────────────────────────────────────────────────────
router.get('/', adminAuth, (req, res) => {
  const { q, status, limit = 50, offset = 0 } = req.query
  let where = []
  const params = []
  if (q) { where.push(`(v.name LIKE ? OR v.email LIKE ?)`); params.push(`%${q}%`, `%${q}%`) }
  if (status) { where.push(`v.status = ?`); params.push(status) }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const rows = db.prepare(`
    SELECT v.*, COUNT(p.id) as product_count
    FROM vendors v
    LEFT JOIN products p ON p.vendor_id = v.id
    ${clause}
    GROUP BY v.id
    ORDER BY v.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, +limit, +offset)
  const total = db.prepare(`SELECT COUNT(*) as c FROM vendors v ${clause}`).get(...params)
  res.json({ vendors: rows.map(safeVendor), total: total.c })
})

// ─── Admin: Stats ─────────────────────────────────────────────────────────────
router.get('/stats', adminAuth, (req, res) => {
  const stats = db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status='suspended' THEN 1 ELSE 0 END) as suspended,
    COALESCE(SUM(total_sales),0) as gmv,
    COALESCE(SUM(total_commission),0) as commissions
  FROM vendors`).get()
  res.json(stats)
})

// ─── Admin: Single Vendor ─────────────────────────────────────────────────────
router.get('/:id', adminAuth, (req, res) => {
  const vendor = db.prepare(`SELECT * FROM vendors WHERE id=?`).get(req.params.id)
  if (!vendor) return res.status(404).json({ error: 'Not found' })
  res.json(safeVendor(vendor))
})

router.put('/:id', adminAuth, (req, res) => {
  const { name, email, status, commission_rate } = req.body
  db.prepare(`
    UPDATE vendors SET name=COALESCE(?,name), email=COALESCE(?,email),
    status=COALESCE(?,status), commission_rate=COALESCE(?,commission_rate),
    updated_at=datetime('now') WHERE id=?
  `).run(name||null, email||null, status||null, commission_rate??null, req.params.id)
  const updated = db.prepare(`SELECT * FROM vendors WHERE id=?`).get(req.params.id)
  if (!updated) return res.status(404).json({ error: 'Not found' })
  res.json(safeVendor(updated))
})

router.delete('/:id', adminAuth, (req, res) => {
  db.prepare(`DELETE FROM vendors WHERE id=?`).run(req.params.id)
  res.json({ ok: true })
})

// ─── Admin: Vendor Products ───────────────────────────────────────────────────
router.get('/:id/products', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM products WHERE vendor_id=? ORDER BY created_at DESC`).all(req.params.id)
  res.json(rows)
})

// ─── Admin: Vendor Orders ─────────────────────────────────────────────────────
router.get('/:id/orders', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM vendor_order_items WHERE vendor_id=? ORDER BY created_at DESC LIMIT 100`).all(req.params.id)
  res.json(rows)
})

// ─── Admin: Payouts ───────────────────────────────────────────────────────────
router.post('/:id/payouts', adminAuth, (req, res) => {
  const { amount, note } = req.body
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount required' })
  const result = db.prepare(`
    INSERT INTO vendor_payouts (vendor_id, amount, status, note, paid_at)
    VALUES (?, ?, 'paid', ?, datetime('now'))
  `).run(req.params.id, amount, note||null)
  res.status(201).json(db.prepare(`SELECT * FROM vendor_payouts WHERE id=?`).get(result.lastInsertRowid))
})

router.get('/:id/payouts', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM vendor_payouts WHERE vendor_id=? ORDER BY created_at DESC`).all(req.params.id)
  res.json(rows)
})

// ─── Helper: Record vendor sale ───────────────────────────────────────────────
export async function recordVendorSale(orderId, orderNumber, items) {
  try {
    if (!items || !items.length) return
    const insertItem = db.prepare(`
      INSERT INTO vendor_order_items (vendor_id, order_id, order_number, product_id, product_name, quantity, unit_price, subtotal, commission_rate, commission_amount, vendor_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const updateVendor = db.prepare(`
      UPDATE vendors SET total_sales = total_sales + ?, total_commission = total_commission + ? WHERE id=?
    `)
    for (const item of items) {
      if (!item.product_id) continue
      const product = db.prepare(`SELECT vendor_id FROM products WHERE id=?`).get(item.product_id)
      if (!product?.vendor_id) continue
      const vendor = db.prepare(`SELECT commission_rate FROM vendors WHERE id=?`).get(product.vendor_id)
      if (!vendor) continue
      const subtotal = item.unit_price * item.quantity
      const commRate = vendor.commission_rate
      const commAmt = +(subtotal * commRate / 100).toFixed(2)
      const vendorAmt = +(subtotal - commAmt).toFixed(2)
      insertItem.run(product.vendor_id, orderId, orderNumber, item.product_id, item.name, item.quantity, item.unit_price, subtotal, commRate, commAmt, vendorAmt)
      updateVendor.run(subtotal, commAmt, product.vendor_id)
    }
  } catch (e) {
    console.error('recordVendorSale error:', e.message)
  }
}

export default router
