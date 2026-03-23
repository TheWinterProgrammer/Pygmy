// Pygmy CMS — Product Badges API (Phase 38)
// Admin-defined badge labels per product: "New", "Hot", "Staff Pick", etc.
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const BADGE_STYLES = ['default', 'red', 'green', 'blue', 'orange', 'purple', 'gold']

// ── GET /api/product-badges?product_id= — Public: get badges for a product ────
router.get('/', (req, res) => {
  const { product_id } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const rows = db.prepare(`
    SELECT * FROM product_badges WHERE product_id = ? ORDER BY sort_order ASC, id ASC
  `).all(Number(product_id))

  res.json(rows)
})

// ── GET /api/product-badges/all — Admin: all badges grouped by product ─────────
router.get('/all', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT pb.*, p.name AS product_name, p.slug AS product_slug
    FROM product_badges pb
    JOIN products p ON p.id = pb.product_id
    ORDER BY p.name ASC, pb.sort_order ASC
  `).all()
  res.json(rows)
})

// ── GET /api/product-badges/styles — Public: badge style options ───────────────
router.get('/styles', (req, res) => {
  res.json(BADGE_STYLES)
})

// ── POST /api/product-badges — Admin: create badge ────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { product_id, label, style = 'default', sort_order = 0 } = req.body
  if (!product_id || !label?.trim()) {
    return res.status(400).json({ error: 'product_id and label are required' })
  }

  const result = db.prepare(`
    INSERT INTO product_badges (product_id, label, style, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(Number(product_id), label.trim().slice(0, 32), style, Number(sort_order))

  const created = db.prepare('SELECT * FROM product_badges WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(created)
})

// ── PUT /api/product-badges/:id — Admin: update badge ────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const { label, style, sort_order } = req.body
  const existing = db.prepare('SELECT * FROM product_badges WHERE id = ?').get(Number(req.params.id))
  if (!existing) return res.status(404).json({ error: 'Badge not found' })

  db.prepare(`
    UPDATE product_badges SET
      label      = COALESCE(?, label),
      style      = COALESCE(?, style),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(
    label !== undefined ? label.trim().slice(0, 32) : null,
    style  !== undefined ? style : null,
    sort_order !== undefined ? Number(sort_order) : null,
    Number(req.params.id)
  )

  const updated = db.prepare('SELECT * FROM product_badges WHERE id = ?').get(Number(req.params.id))
  res.json(updated)
})

// ── DELETE /api/product-badges/:id — Admin: delete badge ─────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM product_badges WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

// ── DELETE /api/product-badges?product_id= — Admin: clear all for product ──────
router.delete('/', authMiddleware, (req, res) => {
  const { product_id } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  db.prepare('DELETE FROM product_badges WHERE product_id = ?').run(Number(product_id))
  res.json({ ok: true })
})

export default router
