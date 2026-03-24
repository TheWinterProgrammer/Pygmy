import { Router } from 'express'
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

  // Check product exists
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

export default router
