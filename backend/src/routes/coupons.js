// Pygmy CMS — Coupons API (Advanced — Phase 30)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const COUPON_TYPES = ['percentage', 'fixed', 'free_shipping', 'bogo']

// ─── Parse coupon JSON fields ──────────────────────────────────────────────────
function parseCoupon(row) {
  if (!row) return null
  return {
    ...row,
    product_ids: (() => { try { return JSON.parse(row.product_ids || '[]') } catch { return [] } })(),
    category_ids: (() => { try { return JSON.parse(row.category_ids || '[]') } catch { return [] } })(),
  }
}

/**
 * Validate a coupon code against an order.
 * Returns { ok, discount, free_shipping, coupon } or { ok:false, error }.
 *
 * @param {string} code
 * @param {number} subtotal
 * @param {{ email?: string, items?: Array<{product_id, quantity, unit_price}> }} context
 */
function validateCouponLogic(code, subtotal, context = {}) {
  const coupon = db.prepare(`
    SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1
  `).get(code)

  if (!coupon) return { ok: false, error: 'Coupon code not found or inactive.' }

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, error: 'This coupon has expired.' }
  }

  // Check global max uses
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
    return { ok: false, error: 'This coupon has reached its usage limit.' }
  }

  // Check per-customer limit
  if (coupon.max_uses_per_customer > 0 && context.email) {
    const customerUses = db.prepare(
      "SELECT COUNT(*) as cnt FROM coupon_usage WHERE coupon_id = ? AND customer_email = ?"
    ).get(coupon.id, context.email.toLowerCase())?.cnt || 0
    if (customerUses >= coupon.max_uses_per_customer) {
      return { ok: false, error: `You can only use this coupon ${coupon.max_uses_per_customer} time(s).` }
    }
  }

  // Check min order amount
  if (coupon.min_order_amount > 0 && subtotal < coupon.min_order_amount) {
    return { ok: false, error: `Minimum order amount of ${coupon.min_order_amount} required for this coupon.` }
  }

  const productIds = (() => { try { return JSON.parse(coupon.product_ids || '[]') } catch { return [] } })()
  const categoryIds = (() => { try { return JSON.parse(coupon.category_ids || '[]') } catch { return [] } })()

  // Check product/category restrictions
  if ((productIds.length > 0 || categoryIds.length > 0) && context.items?.length) {
    const eligible = context.items.some(item => {
      if (productIds.length > 0 && productIds.includes(item.product_id)) return true
      if (categoryIds.length > 0) {
        const p = db.prepare("SELECT category FROM products WHERE id = ?").get(item.product_id)
        if (p && categoryIds.includes(p.category)) return true
      }
      return false
    })
    if (!eligible) {
      return { ok: false, error: 'This coupon does not apply to the items in your cart.' }
    }
  }

  // Calculate discount
  let discount = 0
  let free_shipping = false

  if (coupon.type === 'percentage') {
    // Apply only to eligible items if restricted
    let applicableSubtotal = subtotal
    if ((productIds.length > 0 || categoryIds.length > 0) && context.items?.length) {
      applicableSubtotal = context.items.reduce((sum, item) => {
        const inProducts = productIds.length > 0 && productIds.includes(item.product_id)
        if (inProducts) return sum + (item.unit_price * item.quantity)
        if (categoryIds.length > 0) {
          const p = db.prepare("SELECT category FROM products WHERE id = ?").get(item.product_id)
          if (p && categoryIds.includes(p.category)) return sum + (item.unit_price * item.quantity)
        }
        return sum
      }, 0)
    }
    discount = Math.min(applicableSubtotal, (applicableSubtotal * coupon.value) / 100)

  } else if (coupon.type === 'fixed') {
    discount = Math.min(subtotal, coupon.value)

  } else if (coupon.type === 'free_shipping') {
    free_shipping = true
    discount = 0  // discount on shipping handled at checkout

  } else if (coupon.type === 'bogo') {
    // Buy X get Y: find cheapest applicable item(s) for free/discounted
    if (context.items?.length && coupon.bogo_buy_qty > 0 && coupon.bogo_get_qty > 0) {
      const items = [...context.items].sort((a, b) => a.unit_price - b.unit_price)
      const totalQty = items.reduce((s, i) => s + i.quantity, 0)
      if (totalQty >= coupon.bogo_buy_qty + coupon.bogo_get_qty) {
        // Apply free discount to cheapest items (up to bogo_get_qty)
        let freeQtyRemaining = coupon.bogo_get_qty
        for (const item of items) {
          if (freeQtyRemaining <= 0) break
          const freeFromItem = Math.min(item.quantity, freeQtyRemaining)
          discount += item.unit_price * freeFromItem
          freeQtyRemaining -= freeFromItem
        }
      }
    }
  }

  return {
    ok: true,
    discount: Math.round(discount * 100) / 100,
    free_shipping,
    coupon,
  }
}

// ─── Public: Validate coupon ──────────────────────────────────────────────────
// POST /api/coupons/validate
router.post('/validate', (req, res) => {
  const { code, subtotal = 0, email, items } = req.body
  if (!code) return res.status(400).json({ error: 'Coupon code required' })

  const result = validateCouponLogic(code.trim(), parseFloat(subtotal) || 0, { email, items })
  if (!result.ok) return res.status(400).json({ error: result.error })

  res.json({
    ok: true,
    code: result.coupon.code,
    type: result.coupon.type,
    value: result.coupon.value,
    discount: result.discount,
    free_shipping: result.free_shipping,
  })
})

// Export the validator for use in orders route
export { validateCouponLogic }

// ─── Admin: List coupons ──────────────────────────────────────────────────────
// GET /api/coupons
router.get('/', authMiddleware, (req, res) => {
  const { q, active, type } = req.query
  let sql = 'SELECT * FROM coupons WHERE 1=1'
  const params = []

  if (q) { sql += ' AND code LIKE ?'; params.push(`%${q}%`) }
  if (active !== undefined) { sql += ' AND active = ?'; params.push(active === '1' ? 1 : 0) }
  if (type) { sql += ' AND type = ?'; params.push(type) }

  sql += ' ORDER BY created_at DESC'
  res.json(db.prepare(sql).all(...params).map(parseCoupon))
})

// ─── Admin: Get coupon usage history ─────────────────────────────────────────
// GET /api/coupons/:id/usage
router.get('/:id/usage', authMiddleware, (req, res) => {
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id)
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' })

  const usage = db.prepare(`
    SELECT * FROM coupon_usage
    WHERE coupon_id = ?
    ORDER BY used_at DESC
    LIMIT 100
  `).all(coupon.id)

  res.json({ coupon: parseCoupon(coupon), usage })
})

// ─── Admin: Create coupon ─────────────────────────────────────────────────────
// POST /api/coupons
router.post('/', authMiddleware, (req, res) => {
  const {
    code, type = 'percentage', value = 0,
    min_order_amount = 0, max_uses = 0, max_uses_per_customer = 0,
    expires_at = null, active = 1,
    product_ids = [], category_ids = [],
    bogo_buy_qty = 0, bogo_get_qty = 0, bogo_product_id = 0,
  } = req.body

  if (!code) return res.status(400).json({ error: 'Coupon code is required' })
  if (!COUPON_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${COUPON_TYPES.join(', ')}` })
  if (!['free_shipping', 'bogo'].includes(type) && value <= 0) return res.status(400).json({ error: 'value must be greater than 0' })
  if (type === 'percentage' && value > 100) return res.status(400).json({ error: 'Percentage cannot exceed 100' })

  try {
    const result = db.prepare(`
      INSERT INTO coupons (
        code, type, value, min_order_amount, max_uses, max_uses_per_customer,
        expires_at, active, product_ids, category_ids,
        bogo_buy_qty, bogo_get_qty, bogo_product_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim().toUpperCase(), type, parseFloat(value) || 0,
      parseFloat(min_order_amount) || 0, parseInt(max_uses) || 0,
      parseInt(max_uses_per_customer) || 0, expires_at || null,
      active ? 1 : 0,
      JSON.stringify(Array.isArray(product_ids) ? product_ids : []),
      JSON.stringify(Array.isArray(category_ids) ? category_ids : []),
      parseInt(bogo_buy_qty) || 0, parseInt(bogo_get_qty) || 0, parseInt(bogo_product_id) || 0,
    )
    res.status(201).json(parseCoupon(db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid)))
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'A coupon with that code already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ─── Admin: Update coupon ─────────────────────────────────────────────────────
// PUT /api/coupons/:id
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Coupon not found' })

  const {
    code = existing.code, type = existing.type, value = existing.value,
    min_order_amount = existing.min_order_amount, max_uses = existing.max_uses,
    max_uses_per_customer = existing.max_uses_per_customer,
    expires_at = existing.expires_at, active = existing.active,
    product_ids, category_ids,
    bogo_buy_qty = existing.bogo_buy_qty, bogo_get_qty = existing.bogo_get_qty,
    bogo_product_id = existing.bogo_product_id,
  } = req.body

  db.prepare(`
    UPDATE coupons SET
      code = ?, type = ?, value = ?, min_order_amount = ?,
      max_uses = ?, max_uses_per_customer = ?, expires_at = ?, active = ?,
      product_ids = ?, category_ids = ?,
      bogo_buy_qty = ?, bogo_get_qty = ?, bogo_product_id = ?
    WHERE id = ?
  `).run(
    code.trim().toUpperCase(), type, parseFloat(value) || 0,
    parseFloat(min_order_amount) || 0, parseInt(max_uses) || 0,
    parseInt(max_uses_per_customer) || 0, expires_at || null,
    active ? 1 : 0,
    product_ids !== undefined ? JSON.stringify(Array.isArray(product_ids) ? product_ids : []) : (existing.product_ids || '[]'),
    category_ids !== undefined ? JSON.stringify(Array.isArray(category_ids) ? category_ids : []) : (existing.category_ids || '[]'),
    parseInt(bogo_buy_qty) || 0, parseInt(bogo_get_qty) || 0, parseInt(bogo_product_id) || 0,
    existing.id
  )

  res.json(parseCoupon(db.prepare('SELECT * FROM coupons WHERE id = ?').get(existing.id)))
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
