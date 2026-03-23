// volume_pricing.js — Volume / Tiered Pricing (Phase 40)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const r = Router()

// ── Public: get tiers for a product ────────────────────────────────────────────
r.get('/', (req, res) => {
  const { product_id } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  const tiers = db.prepare(`
    SELECT * FROM volume_pricing WHERE product_id = ? ORDER BY min_qty ASC
  `).all(product_id)
  res.json(tiers)
})

// ── Public: calculate price for qty ────────────────────────────────────────────
r.post('/calculate', (req, res) => {
  const { product_id, quantity } = req.body
  if (!product_id || !quantity) return res.status(400).json({ error: 'product_id and quantity required' })

  const product = db.prepare('SELECT price, sale_price FROM products WHERE id = ?').get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const basePrice = product.sale_price || product.price || 0
  const qty = Number(quantity)

  // Find the best (lowest price) applicable tier
  const tiers = db.prepare(`
    SELECT * FROM volume_pricing WHERE product_id = ? AND min_qty <= ? ORDER BY min_qty DESC LIMIT 1
  `).get(product_id, qty)

  const unit_price = tiers ? tiers.price : basePrice
  const tier_label = tiers ? tiers.label : null
  const savings = tiers ? ((basePrice - tiers.price) * qty).toFixed(2) : 0

  res.json({ unit_price, base_price: basePrice, tier_label, savings, quantity: qty, total: (unit_price * qty).toFixed(2) })
})

// ── Admin: create tier ─────────────────────────────────────────────────────────
r.post('/', auth, (req, res) => {
  const { product_id, min_qty, price, label = '' } = req.body
  if (!product_id || !min_qty || price === undefined) {
    return res.status(400).json({ error: 'product_id, min_qty, and price required' })
  }
  const result = db.prepare(`
    INSERT INTO volume_pricing (product_id, min_qty, price, label) VALUES (?, ?, ?, ?)
  `).run(product_id, min_qty, price, label)
  const tier = db.prepare('SELECT * FROM volume_pricing WHERE id = ?').get(result.lastInsertRowid)
  res.json(tier)
})

// ── Admin: update tier ─────────────────────────────────────────────────────────
r.put('/:id', auth, (req, res) => {
  const { min_qty, price, label } = req.body
  db.prepare(`
    UPDATE volume_pricing SET min_qty = COALESCE(?, min_qty), price = COALESCE(?, price), label = COALESCE(?, label)
    WHERE id = ?
  `).run(min_qty, price, label, req.params.id)
  const tier = db.prepare('SELECT * FROM volume_pricing WHERE id = ?').get(req.params.id)
  res.json(tier)
})

// ── Admin: delete tier ─────────────────────────────────────────────────────────
r.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM volume_pricing WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Admin: replace all tiers for a product ─────────────────────────────────────
r.put('/product/:productId', auth, (req, res) => {
  const { tiers } = req.body
  if (!Array.isArray(tiers)) return res.status(400).json({ error: 'tiers array required' })

  db.prepare('DELETE FROM volume_pricing WHERE product_id = ?').run(req.params.productId)

  for (const t of tiers) {
    if (t.min_qty && t.price !== undefined) {
      db.prepare('INSERT INTO volume_pricing (product_id, min_qty, price, label) VALUES (?, ?, ?, ?)')
        .run(req.params.productId, t.min_qty, t.price, t.label || '')
    }
  }

  const result = db.prepare('SELECT * FROM volume_pricing WHERE product_id = ? ORDER BY min_qty ASC')
    .all(req.params.productId)
  res.json(result)
})

export default r
