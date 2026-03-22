// Pygmy CMS — Flash Sales API (Phase 30)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function parseFs(row) {
  if (!row) return null
  return {
    ...row,
    applies_to_ids: (() => { try { return JSON.parse(row.applies_to_ids || '[]') } catch { return [] } })(),
    active: !!row.active,
    show_countdown: !!row.show_countdown,
  }
}

function isActive(fs) {
  const now = new Date()
  if (!fs.active) return false
  if (fs.starts_at && new Date(fs.starts_at) > now) return false
  if (fs.ends_at && new Date(fs.ends_at) < now) return false
  if (fs.max_uses > 0 && fs.uses_count >= fs.max_uses) return false
  return true
}

// ── GET /api/flash-sales — list (public: active only; admin: all) ─────────────
router.get('/', (req, res) => {
  const isAdmin = !!req.headers.authorization
  let rows = db.prepare(`SELECT * FROM flash_sales ORDER BY created_at DESC`).all().map(parseFs)
  if (!isAdmin) {
    rows = rows.filter(isActive)
  }
  // Add live is_active field
  res.json(rows.map(fs => ({ ...fs, is_active: isActive(fs) })))
})

// ── GET /api/flash-sales/current — public: single currently-active sale ───────
router.get('/current', (req, res) => {
  const rows = db.prepare(`SELECT * FROM flash_sales WHERE active = 1 ORDER BY created_at DESC`).all().map(parseFs)
  const current = rows.filter(isActive)[0] || null
  res.json(current ? { ...current, is_active: true } : null)
})

// ── GET /api/flash-sales/:id ──────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM flash_sales WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  const fs = parseFs(row)
  res.json({ ...fs, is_active: isActive(fs) })
})

// ── POST /api/flash-sales — admin: create ────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const {
    name, slug, description = '',
    discount_type = 'percent', discount_value = 0,
    applies_to = 'all', applies_to_ids = [],
    min_purchase = 0, max_uses = 0,
    starts_at = null, ends_at = null,
    active = 1, show_countdown = 1,
    badge_label = 'Flash Sale'
  } = req.body

  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' })

  try {
    const result = db.prepare(`
      INSERT INTO flash_sales (name, slug, description, discount_type, discount_value,
        applies_to, applies_to_ids, min_purchase, max_uses, starts_at, ends_at,
        active, show_countdown, badge_label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, slug, description, discount_type, discount_value,
      applies_to, JSON.stringify(applies_to_ids), min_purchase, max_uses,
      starts_at, ends_at, active ? 1 : 0, show_countdown ? 1 : 0, badge_label
    )
    res.status(201).json({ ok: true, id: result.lastInsertRowid })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/flash-sales/:id — admin: update ─────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM flash_sales WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const {
    name = existing.name,
    slug = existing.slug,
    description = existing.description,
    discount_type = existing.discount_type,
    discount_value = existing.discount_value,
    applies_to = existing.applies_to,
    applies_to_ids,
    min_purchase = existing.min_purchase,
    max_uses = existing.max_uses,
    starts_at = existing.starts_at,
    ends_at = existing.ends_at,
    active,
    show_countdown,
    badge_label = existing.badge_label
  } = req.body

  const idsJson = applies_to_ids !== undefined
    ? JSON.stringify(applies_to_ids)
    : existing.applies_to_ids

  try {
    db.prepare(`
      UPDATE flash_sales SET name=?, slug=?, description=?, discount_type=?,
        discount_value=?, applies_to=?, applies_to_ids=?, min_purchase=?,
        max_uses=?, starts_at=?, ends_at=?, active=?, show_countdown=?, badge_label=?
      WHERE id=?
    `).run(
      name, slug, description, discount_type, discount_value,
      applies_to, idsJson, min_purchase, max_uses, starts_at, ends_at,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      show_countdown !== undefined ? (show_countdown ? 1 : 0) : existing.show_countdown,
      badge_label, existing.id
    )
    res.json({ ok: true })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/flash-sales/:id — admin: delete ───────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM flash_sales WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── POST /api/flash-sales/:id/apply — public: apply sale to cart ──────────────
// Body: { items: [{product_id, price, quantity, category}], cart_total }
// Returns: { discount_amount, items_with_discount[], flash_sale }
router.post('/:id/apply', (req, res) => {
  const row = db.prepare('SELECT * FROM flash_sales WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Flash sale not found' })
  const fs = parseFs(row)
  if (!isActive(fs)) return res.status(400).json({ error: 'Flash sale is not active' })

  const { items = [], cart_total = 0 } = req.body

  if (fs.min_purchase > 0 && cart_total < fs.min_purchase) {
    return res.status(400).json({
      error: `Minimum purchase of ${fs.min_purchase} required for this flash sale`
    })
  }

  let discount_amount = 0

  if (fs.discount_type === 'free_shipping') {
    return res.json({ discount_amount: 0, free_shipping: true, flash_sale: fs })
  }

  // Filter eligible items
  let eligible = items
  if (fs.applies_to === 'products') {
    eligible = items.filter(i => fs.applies_to_ids.includes(i.product_id))
  } else if (fs.applies_to === 'category') {
    eligible = items.filter(i => fs.applies_to_ids.includes(i.category))
  }

  const eligibleSubtotal = eligible.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0)

  if (fs.discount_type === 'percent') {
    discount_amount = Math.round(eligibleSubtotal * (fs.discount_value / 100) * 100) / 100
  } else if (fs.discount_type === 'fixed') {
    discount_amount = Math.min(fs.discount_value, eligibleSubtotal)
  }

  res.json({ discount_amount, free_shipping: false, flash_sale: fs })
})

export default router
