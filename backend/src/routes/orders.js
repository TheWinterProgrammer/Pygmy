// Pygmy CMS — Orders API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'
import { fireWebhooks } from './webhooks.js'
import { sendOrderConfirmation, sendOrderStatusUpdate } from '../email.js'
import { validateCouponLogic } from './coupons.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderNumber() {
  const date = new Date()
  const yy = String(date.getFullYear()).slice(2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `ORD-${yy}${mm}${dd}-${rand}`
}

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded']

// ─── Public: Create order (checkout) ─────────────────────────────────────────
// POST /api/orders
router.post('/', (req, res) => {
  const {
    customer_name, customer_email, customer_phone,
    shipping_address, items, subtotal, total, notes,
    coupon_code = '',
  } = req.body

  if (!customer_name || !customer_email) {
    return res.status(400).json({ error: 'customer_name and customer_email are required' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' })
  }

  // Validate each cart item against actual product prices (fraud guard)
  let computedSubtotal = 0
  const validatedItems = []
  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity < 1) {
      return res.status(400).json({ error: 'Invalid item in cart' })
    }
    const product = db.prepare(`
      SELECT id, name, price, sale_price, slug, cover_image,
             track_stock, stock_quantity, allow_backorder
      FROM products WHERE id = ? AND status = 'published'
    `).get(item.product_id)

    if (!product) {
      return res.status(400).json({ error: `Product ${item.product_id} not found or unavailable` })
    }

    // Stock check
    if (product.track_stock && !product.allow_backorder && product.stock_quantity < item.quantity) {
      const avail = product.stock_quantity
      return res.status(400).json({
        error: `"${product.name}" only has ${avail} unit${avail !== 1 ? 's' : ''} in stock.`,
      })
    }

    const unitPrice = product.sale_price ?? product.price ?? 0
    const lineTotal = unitPrice * item.quantity
    computedSubtotal += lineTotal
    validatedItems.push({
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      cover_image: product.cover_image || null,
      unit_price: unitPrice,
      quantity: item.quantity,
      line_total: lineTotal,
    })
  }

  // Apply coupon discount
  let discountAmount = 0
  let appliedCoupon = ''
  if (coupon_code && coupon_code.trim()) {
    const couponResult = validateCouponLogic(coupon_code.trim(), computedSubtotal)
    if (!couponResult.ok) {
      return res.status(400).json({ error: couponResult.error })
    }
    discountAmount = couponResult.discount
    appliedCoupon = couponResult.coupon.code
  }

  const computedTotal = Math.max(0, computedSubtotal - discountAmount)
  const orderNumber = generateOrderNumber()

  // Use a transaction: insert order + decrement stock + increment coupon uses
  const placeOrder = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO orders (order_number, status, customer_name, customer_email, customer_phone,
        shipping_address, items, subtotal, discount_amount, total, coupon_code, notes)
      VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber,
      customer_name.trim(),
      customer_email.trim().toLowerCase(),
      (customer_phone || '').trim(),
      (shipping_address || '').trim(),
      JSON.stringify(validatedItems),
      computedSubtotal,
      discountAmount,
      computedTotal,
      appliedCoupon,
      (notes || '').trim()
    )

    // Decrement stock for tracked products
    for (const item of validatedItems) {
      const p = db.prepare('SELECT track_stock FROM products WHERE id = ?').get(item.product_id)
      if (p?.track_stock) {
        db.prepare(`
          UPDATE products
          SET stock_quantity = MAX(0, stock_quantity - ?),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(item.quantity, item.product_id)
      }
    }

    // Increment coupon used_count
    if (appliedCoupon) {
      db.prepare(`
        UPDATE coupons SET used_count = used_count + 1 WHERE code = ? COLLATE NOCASE
      `).run(appliedCoupon)
    }

    return result.lastInsertRowid
  })

  const newId = placeOrder()
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(newId)

  // Send webhook (fire-and-forget)
  try { fireWebhooks('order.created', { order_number: orderNumber, total: computedTotal }) } catch {}

  // Send order confirmation email (fire-and-forget)
  sendOrderConfirmation({ ...order, items: validatedItems }).catch(() => {})

  res.status(201).json({
    id: order.id,
    order_number: order.order_number,
    subtotal: order.subtotal,
    discount_amount: order.discount_amount,
    total: order.total,
    coupon_code: order.coupon_code,
    status: order.status,
  })
})

// ─── Admin: List orders ───────────────────────────────────────────────────────
// GET /api/orders
router.get('/', authMiddleware, (req, res) => {
  const { status, q, limit = 50, offset = 0 } = req.query

  let sql = 'SELECT * FROM orders WHERE 1=1'
  const params = []

  if (status && ORDER_STATUSES.includes(status)) {
    sql += ' AND status = ?'
    params.push(status)
  }

  if (q) {
    sql += ' AND (customer_name LIKE ? OR customer_email LIKE ? OR order_number LIKE ?)'
    const like = `%${q}%`
    params.push(like, like, like)
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  const rows = db.prepare(sql).all(...params)

  // Count for pagination
  let countSql = 'SELECT COUNT(*) as count FROM orders WHERE 1=1'
  const countParams = params.slice(0, params.length - 2) // remove limit/offset
  if (status && ORDER_STATUSES.includes(status)) {}
  const total = db.prepare(countSql).get().count

  res.json({
    orders: rows.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })),
    total,
  })
})

// ─── Admin: Get single order ──────────────────────────────────────────────────
// GET /api/orders/:id
router.get('/:id', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json({ ...order, items: JSON.parse(order.items || '[]') })
})

// ─── Public: Get order by order_number (for confirmation page) ───────────────
// GET /api/orders/confirm/:orderNumber
router.get('/confirm/:orderNumber', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  // Return limited public data (no customer email for privacy)
  res.json({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    customer_name: order.customer_name,
    items: JSON.parse(order.items || '[]'),
    subtotal: order.subtotal,
    total: order.total,
    created_at: order.created_at,
  })
})

// ─── Admin: Update order status / notes ──────────────────────────────────────
// PUT /api/orders/:id
router.put('/:id', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const { status, notes } = req.body
  if (status && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}` })
  }

  db.prepare(`
    UPDATE orders SET
      status = COALESCE(?, status),
      notes  = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status || null, notes ?? null, order.id)

  const statusChanged = status && status !== order.status
  if (statusChanged) {
    logActivity(req.user, 'update_status', 'order', order.id, `#${order.order_number} → ${status}`)
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)

  // Send status update email to customer (fire-and-forget)
  if (statusChanged) {
    fireWebhooks('order.status_changed', { order_number: updated.order_number, status: updated.status }).catch?.(() => {})
    sendOrderStatusUpdate({ ...updated, items: JSON.parse(updated.items || '[]') }).catch(() => {})
  }

  res.json({ ...updated, items: JSON.parse(updated.items || '[]') })
})

// ─── Admin: Delete order ──────────────────────────────────────────────────────
// DELETE /api/orders/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  db.prepare('DELETE FROM orders WHERE id = ?').run(order.id)
  logActivity(req.user, 'delete', 'order', order.id, `#${order.order_number}`)
  res.json({ ok: true })
})

// ─── Admin: CSV Export ────────────────────────────────────────────────────────
// GET /api/orders/export/csv
router.get('/export/csv', authMiddleware, (req, res) => {
  const { status, from, to } = req.query
  let sql = 'SELECT * FROM orders WHERE 1=1'
  const params = []
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (from)   { sql += ' AND created_at >= ?'; params.push(from) }
  if (to)     { sql += ' AND created_at <= ?'; params.push(to + 'T23:59:59') }
  sql += ' ORDER BY created_at DESC'

  const orders = db.prepare(sql).all(...params)

  const escape = v => {
    if (v == null) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const headers = ['order_number','status','customer_name','customer_email','customer_phone',
    'shipping_address','subtotal','discount_amount','coupon_code','total','notes','created_at']

  const rows = orders.map(o => headers.map(h => escape(o[h])).join(','))
  const csv = [headers.join(','), ...rows].join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="orders-export-${new Date().toISOString().slice(0,10)}.csv"`)
  res.send(csv)
})

// ─── Admin: Stats ─────────────────────────────────────────────────────────────
// GET /api/orders/stats
router.get('/stats/summary', authMiddleware, (req, res) => {
  const total       = db.prepare('SELECT COUNT(*) as c FROM orders').get().c
  const pending     = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c
  const processing  = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'processing'").get().c
  const completed   = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'completed'").get().c
  const revenue     = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM orders WHERE status IN ('completed','processing','shipped')").get().r
  const revenueMonth = db.prepare(`
    SELECT COALESCE(SUM(total),0) as r FROM orders
    WHERE status IN ('completed','processing','shipped')
    AND created_at >= datetime('now', 'start of month')
  `).get().r

  res.json({ total, pending, processing, completed, revenue, revenue_month: revenueMonth })
})

export default router
