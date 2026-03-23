// order_bumps.js — Checkout Order Bumps (Phase 41)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const r = Router()

// ── Public: get active bumps (for checkout page) ──────────────────────────────
r.get('/active', (req, res) => {
  const bumps = db.prepare(`
    SELECT ob.*, p.name as product_name, p.cover_image, p.price as base_price,
           p.sale_price, p.excerpt, p.status as product_status, p.stock_quantity,
           p.track_stock, p.allow_backorder
    FROM order_bumps ob
    JOIN products p ON p.id = ob.product_id
    WHERE ob.active = 1 AND p.status = 'published'
    ORDER BY ob.sort_order ASC, ob.id ASC
    LIMIT 3
  `).all()

  const symbol = db.prepare("SELECT value FROM settings WHERE key = 'shop_currency_symbol'").get()?.value || '€'

  const result = bumps.map(b => {
    const basePrice = b.sale_price || b.base_price || 0
    const discountedPrice = b.discount_pct > 0
      ? Math.round(basePrice * (1 - b.discount_pct / 100) * 100) / 100
      : basePrice
    const inStock = !b.track_stock || b.stock_quantity > 0 || b.allow_backorder

    return {
      id:              b.id,
      name:            b.name,
      product_id:      b.product_id,
      product_name:    b.product_name,
      cover_image:     b.cover_image,
      headline:        b.headline,
      subtext:         b.subtext,
      original_price:  basePrice,
      price:           discountedPrice,
      discount_pct:    b.discount_pct,
      currency_symbol: symbol,
      in_stock:        inStock,
    }
  }).filter(b => b.in_stock)

  // Track impressions
  if (result.length) {
    const ids = result.map(b => b.id)
    db.prepare(`UPDATE order_bumps SET impressions = impressions + 1 WHERE id IN (${ids.map(() => '?').join(',')})`)
      .run(...ids)
  }

  res.json(result)
})

// ── Public: record conversion ──────────────────────────────────────────────────
r.post('/:id/convert', (req, res) => {
  const bump = db.prepare('SELECT id FROM order_bumps WHERE id = ?').get(req.params.id)
  if (!bump) return res.status(404).json({ error: 'Not found' })
  db.prepare('UPDATE order_bumps SET conversions = conversions + 1 WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Admin: list all bumps ──────────────────────────────────────────────────────
r.get('/', auth, (req, res) => {
  const bumps = db.prepare(`
    SELECT ob.*, p.name as product_name, p.cover_image, p.price as base_price, p.sale_price
    FROM order_bumps ob
    JOIN products p ON p.id = ob.product_id
    ORDER BY ob.sort_order ASC, ob.id ASC
  `).all()
  res.json(bumps)
})

// ── Admin: create bump ─────────────────────────────────────────────────────────
r.post('/', auth, (req, res) => {
  const { name, product_id, headline = 'Special One-Time Offer!', subtext = '', discount_pct = 0, active = 1, sort_order = 0 } = req.body
  if (!name || !product_id) return res.status(400).json({ error: 'name and product_id required' })

  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id)
  if (!product) return res.status(400).json({ error: 'Product not found' })

  const result = db.prepare(`
    INSERT INTO order_bumps (name, product_id, headline, subtext, discount_pct, active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, product_id, headline, subtext, discount_pct, active ? 1 : 0, sort_order)

  const bump = db.prepare(`
    SELECT ob.*, p.name as product_name, p.cover_image, p.price as base_price, p.sale_price
    FROM order_bumps ob JOIN products p ON p.id = ob.product_id WHERE ob.id = ?
  `).get(result.lastInsertRowid)
  res.json(bump)
})

// ── Admin: update bump ─────────────────────────────────────────────────────────
r.put('/:id', auth, (req, res) => {
  const bump = db.prepare('SELECT * FROM order_bumps WHERE id = ?').get(req.params.id)
  if (!bump) return res.status(404).json({ error: 'Not found' })

  const { name, product_id, headline, subtext, discount_pct, active, sort_order } = req.body
  db.prepare(`
    UPDATE order_bumps SET
      name         = COALESCE(?, name),
      product_id   = COALESCE(?, product_id),
      headline     = COALESCE(?, headline),
      subtext      = COALESCE(?, subtext),
      discount_pct = COALESCE(?, discount_pct),
      active       = COALESCE(?, active),
      sort_order   = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(name, product_id, headline, subtext, discount_pct,
         active !== undefined ? (active ? 1 : 0) : null,
         sort_order, req.params.id)

  const updated = db.prepare(`
    SELECT ob.*, p.name as product_name, p.cover_image, p.price as base_price, p.sale_price
    FROM order_bumps ob JOIN products p ON p.id = ob.product_id WHERE ob.id = ?
  `).get(req.params.id)
  res.json(updated)
})

// ── Admin: delete bump ─────────────────────────────────────────────────────────
r.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM order_bumps WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Admin: stats ───────────────────────────────────────────────────────────────
r.get('/stats', auth, (req, res) => {
  const stats = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active,
           SUM(impressions) as total_impressions,
           SUM(conversions) as total_conversions
    FROM order_bumps
  `).get()
  const ctr = stats.total_impressions > 0
    ? ((stats.total_conversions / stats.total_impressions) * 100).toFixed(1)
    : '0.0'
  res.json({ ...stats, ctr })
})

export default r
