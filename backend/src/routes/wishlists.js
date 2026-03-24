import { Router } from 'express'
import { randomBytes } from 'crypto'
import db from '../db.js'
import { customerAuthMiddleware as customerAuth } from '../middleware/auth.js'

const router = Router()

// Helper: parse product rows
function parseProduct(p) {
  try { p.gallery = JSON.parse(p.gallery || '[]') } catch { p.gallery = [] }
  try { p.badges = JSON.parse(p.badges || '[]') } catch { p.badges = [] }
  return p
}

// ── GET /api/wishlists/me ─────────────────────────────────────────────────────
router.get('/me', customerAuth, (req, res) => {
  const items = db.prepare(`
    SELECT w.id AS wishlist_id, w.added_at,
           p.id, p.name, p.slug, p.price, p.sale_price, p.cover_image, p.excerpt,
           p.status, p.track_stock, p.stock_quantity, p.gallery, p.badges,
           pc.name AS category_name
    FROM wishlists w
    JOIN products p ON p.id = w.product_id
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE w.customer_id = ?
    ORDER BY w.added_at DESC
  `).all(req.customerId)
  res.json(items.map(parseProduct))
})

// ── POST /api/wishlists/me ─── Add product ────────────────────────────────────
router.post('/me', customerAuth, (req, res) => {
  const { product_id } = req.body
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const product = db.prepare(`SELECT id FROM products WHERE id = ?`).get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  try {
    db.prepare(`INSERT OR IGNORE INTO wishlists (customer_id, product_id) VALUES (?, ?)`).run(req.customerId, product_id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── DELETE /api/wishlists/me/:productId ─── Remove product ───────────────────
router.delete('/me/:productId', customerAuth, (req, res) => {
  db.prepare(`DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?`)
    .run(req.customerId, req.params.productId)
  res.json({ ok: true })
})

// ── DELETE /api/wishlists/me ─── Clear wishlist ───────────────────────────────
router.delete('/me', customerAuth, (req, res) => {
  db.prepare(`DELETE FROM wishlists WHERE customer_id = ?`).run(req.customerId)
  res.json({ ok: true })
})

// ── GET /api/wishlists/me/ids ─── Just the product IDs (for sync) ─────────────
router.get('/me/ids', customerAuth, (req, res) => {
  const rows = db.prepare(`SELECT product_id FROM wishlists WHERE customer_id = ?`).all(req.customerId)
  res.json(rows.map(r => r.product_id))
})

// ─── Shared Wishlists (Phase 62) ──────────────────────────────────────────────

// ── GET /api/wishlists/me/shared — get own shared wishlist info ───────────────
router.get('/me/shared', customerAuth, (req, res) => {
  const shared = db.prepare(`SELECT * FROM shared_wishlists WHERE customer_id = ?`).get(req.customerId)
  res.json(shared || null)
})

// ── POST /api/wishlists/me/share — create or update shared wishlist ────────────
router.post('/me/share', customerAuth, (req, res) => {
  const { name = 'My Wishlist', public: isPublic = 1 } = req.body
  const existing = db.prepare(`SELECT * FROM shared_wishlists WHERE customer_id = ?`).get(req.customerId)

  if (existing) {
    db.prepare(`UPDATE shared_wishlists SET name = ?, public = ? WHERE id = ?`).run(name, isPublic ? 1 : 0, existing.id)
    return res.json(db.prepare(`SELECT * FROM shared_wishlists WHERE id = ?`).get(existing.id))
  }

  const share_code = randomBytes(8).toString('hex') // 16-char hex
  db.prepare(`INSERT INTO shared_wishlists (customer_id, share_code, name, public) VALUES (?, ?, ?, ?)`).run(
    req.customerId, share_code, name, isPublic ? 1 : 0
  )
  res.json(db.prepare(`SELECT * FROM shared_wishlists WHERE customer_id = ?`).get(req.customerId))
})

// ── DELETE /api/wishlists/me/shared — remove shared wishlist ─────────────────
router.delete('/me/shared', customerAuth, (req, res) => {
  db.prepare(`DELETE FROM shared_wishlists WHERE customer_id = ?`).run(req.customerId)
  res.json({ ok: true })
})

// ── GET /api/wishlists/shared/:code — public view ─────────────────────────────
router.get('/shared/:code', (req, res) => {
  const enabled = db.prepare(`SELECT value FROM settings WHERE key = 'shared_wishlists_enabled'`).get()
  if (enabled?.value !== '1') return res.status(404).json({ error: 'Shared wishlists are not enabled' })

  const shared = db.prepare(`SELECT * FROM shared_wishlists WHERE share_code = ? AND public = 1`).get(req.params.code)
  if (!shared) return res.status(404).json({ error: 'Wishlist not found or private' })

  // Get the customer's name (first name only for privacy)
  const customer = db.prepare(`SELECT first_name FROM customers WHERE id = ?`).get(shared.customer_id)

  const items = db.prepare(`
    SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.cover_image, p.excerpt,
           p.status, p.track_stock, p.stock_quantity, p.gallery, p.badges,
           pc.name AS category_name
    FROM wishlists w
    JOIN products p ON p.id = w.product_id AND p.status = 'published'
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE w.customer_id = ?
    ORDER BY w.added_at DESC
  `).all(shared.customer_id)

  res.json({
    share_code: shared.share_code,
    name: shared.name,
    owner_name: customer?.first_name || 'Someone',
    created_at: shared.created_at,
    items: items.map(parseProduct)
  })
})

export default router
