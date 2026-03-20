// Pygmy CMS — Coupons API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCoupon(row) {
  return row
}

/**
 * Validate a coupon code against an order subtotal.
 * Returns { ok, discount, coupon } or { ok:false, error }.
 */
function validateCouponLogic(code, subtotal) {
  const coupon = db.prepare(`
    SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1
  `).get(code)

  if (!coupon) return { ok: false, error: 'Coupon code not found or inactive.' }

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, error: 'This coupon has expired.' }
  }

  // Check max uses
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
    return { ok: false, error: 'This coupon has reached its usage limit.' }
  }

  // Check min order amount
  if (coupon.min_order_amount > 0 && subtotal < coupon.min_order_amount) {
    return { ok: false, error: `Minimum order amount of ${coupon.min_order_amount} required for this coupon.` }
  }

  // Calculate discount
  let discount = 0
  if (coupon.type === 'percentage') {
    discount = Math.min(subtotal, (subtotal * coupon.value) / 100)
  } else if (coupon.type === 'fixed') {
    discount = Math.min(subtotal, coupon.value)
  }

  return { ok: true, discount: Math.round(discount * 100) / 100, coupon }
}

// ─── Public: Validate coupon ──────────────────────────────────────────────────
// POST /api/coupons/validate
router.post('/validate', (req, res) => {
  const { code, subtotal = 0 } = req.body
  if (!code) return res.status(400).json({ error: 'Coupon code required' })

  const result = validateCouponLogic(code.trim(), parseFloat(subtotal) || 0)
  if (!result.ok) return res.status(400).json({ error: result.error })

  res.json({
    ok: true,
    code: result.coupon.code,
    type: result.coupon.type,
    value: result.coupon.value,
    discount: result.discount,
  })
})

// Export the validator for use in orders route
export { validateCouponLogic }

// ─── Admin: List coupons ──────────────────────────────────────────────────────
// GET /api/coupons
router.get('/', authMiddleware, (req, res) => {
  const { q, active } = req.query
  let sql = 'SELECT * FROM coupons WHERE 1=1'
  const params = []

  if (q) {
    sql += ' AND code LIKE ?'
    params.push(`%${q}%`)
  }
  if (active !== undefined) {
    sql += ' AND active = ?'
    params.push(active === '1' ? 1 : 0)
  }

  sql += ' ORDER BY created_at DESC'
  res.json(db.prepare(sql).all(...params))
})

// ─── Admin: Create coupon ─────────────────────────────────────────────────────
// POST /api/coupons
router.post('/', authMiddleware, (req, res) => {
  const {
    code, type = 'percentage', value = 0,
    min_order_amount = 0, max_uses = 0, expires_at = null, active = 1,
  } = req.body

  if (!code) return res.status(400).json({ error: 'Coupon code is required' })
  if (!['percentage', 'fixed'].includes(type)) return res.status(400).json({ error: 'type must be percentage or fixed' })
  if (value <= 0) return res.status(400).json({ error: 'value must be greater than 0' })
  if (type === 'percentage' && value > 100) return res.status(400).json({ error: 'Percentage cannot exceed 100' })

  try {
    const result = db.prepare(`
      INSERT INTO coupons (code, type, value, min_order_amount, max_uses, expires_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim().toUpperCase(),
      type,
      parseFloat(value),
      parseFloat(min_order_amount) || 0,
      parseInt(max_uses) || 0,
      expires_at || null,
      active ? 1 : 0,
    )
    const created = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(created)
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A coupon with that code already exists' })
    }
    res.status(500).json({ error: err.message })
  }
})

// ─── Admin: Update coupon ─────────────────────────────────────────────────────
// PUT /api/coupons/:id
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Coupon not found' })

  const {
    code = existing.code,
    type = existing.type,
    value = existing.value,
    min_order_amount = existing.min_order_amount,
    max_uses = existing.max_uses,
    expires_at = existing.expires_at,
    active = existing.active,
  } = req.body

  db.prepare(`
    UPDATE coupons SET
      code = ?, type = ?, value = ?, min_order_amount = ?,
      max_uses = ?, expires_at = ?, active = ?
    WHERE id = ?
  `).run(
    code.trim().toUpperCase(),
    type,
    parseFloat(value),
    parseFloat(min_order_amount) || 0,
    parseInt(max_uses) || 0,
    expires_at || null,
    active ? 1 : 0,
    existing.id
  )

  res.json(db.prepare('SELECT * FROM coupons WHERE id = ?').get(existing.id))
})

// ─── Admin: Delete coupon ─────────────────────────────────────────────────────
// DELETE /api/coupons/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Coupon not found' })
  db.prepare('DELETE FROM coupons WHERE id = ?').run(existing.id)
  res.json({ ok: true })
})

export default router
