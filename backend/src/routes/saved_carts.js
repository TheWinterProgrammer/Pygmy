// Pygmy CMS — Saved Carts (Cross-device Persistence) API (Phase 38)
// Lets logged-in customers save their cart server-side and load it on any device
import { Router } from 'express'
import db from '../db.js'
import { customerAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// ── GET /api/saved-carts/me — Customer: load saved cart ──────────────────────
router.get('/me', customerAuthMiddleware, (req, res) => {
  const customerId = req.customer.id
  const cart = db.prepare(`
    SELECT * FROM saved_carts WHERE customer_id = ?
  `).get(customerId)

  if (!cart) return res.json({ items: [], subtotal: 0 })

  let items = []
  try { items = JSON.parse(cart.items || '[]') } catch {}

  // Validate items against current product prices
  const validatedItems = []
  for (const item of items) {
    const product = db.prepare(`
      SELECT id, name, slug, price, sale_price, cover_image, status,
             track_stock, stock_quantity, allow_backorder
      FROM products WHERE id = ?
    `).get(item.product_id)

    if (!product || product.status !== 'published') continue

    // Check stock
    if (product.track_stock && product.stock_quantity <= 0 && !product.allow_backorder) continue

    validatedItems.push({
      ...item,
      unit_price: product.sale_price || product.price, // refresh price
      name: product.name,
      slug: product.slug,
      cover_image: product.cover_image,
    })
  }

  res.json({
    items: validatedItems,
    subtotal: validatedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    updated_at: cart.updated_at,
  })
})

// ── PUT /api/saved-carts/me — Customer: save/overwrite cart ──────────────────
router.put('/me', customerAuthMiddleware, (req, res) => {
  const customerId = req.customer.id
  const { items = [] } = req.body

  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })

  db.prepare(`
    INSERT INTO saved_carts (customer_id, items)
    VALUES (?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET items = excluded.items, updated_at = datetime('now')
  `).run(customerId, JSON.stringify(items))

  res.json({ ok: true })
})

// ── DELETE /api/saved-carts/me — Customer: clear saved cart ──────────────────
router.delete('/me', customerAuthMiddleware, (req, res) => {
  db.prepare('DELETE FROM saved_carts WHERE customer_id = ?').run(req.customer.id)
  res.json({ ok: true })
})

export default router
