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
    shipping_cost = 0, shipping_zone = '', shipping_method = '',
    shipping_country = '', shipping_rate_name = '',
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

  const shippingCostNum = Math.max(0, parseFloat(shipping_cost) || 0)
  const computedTotal = Math.max(0, computedSubtotal - discountAmount + shippingCostNum)
  const orderNumber = generateOrderNumber()

  // Use a transaction: insert order + decrement stock + increment coupon uses
  const placeOrder = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO orders (order_number, status, customer_name, customer_email, customer_phone,
        shipping_address, items, subtotal, discount_amount, shipping_cost, shipping_zone, shipping_method,
        shipping_country, shipping_rate_name, total, coupon_code, notes)
      VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber,
      customer_name.trim(),
      customer_email.trim().toLowerCase(),
      (customer_phone || '').trim(),
      (shipping_address || '').trim(),
      JSON.stringify(validatedItems),
      computedSubtotal,
      discountAmount,
      shippingCostNum,
      (shipping_zone || '').trim(),
      (shipping_method || '').trim(),
      (shipping_country || '').trim().toUpperCase(),
      (shipping_rate_name || '').trim(),
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
    shipping_cost: order.shipping_cost,
    shipping_zone: order.shipping_zone,
    shipping_method: order.shipping_method,
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

// ─── Public: Order lookup by order_number + email ────────────────────────────
// POST /api/orders/lookup
router.post('/lookup', (req, res) => {
  const { order_number, email } = req.body
  if (!order_number || !email) {
    return res.status(400).json({ error: 'order_number and email are required' })
  }
  const order = db.prepare(`
    SELECT * FROM orders
    WHERE UPPER(order_number) = UPPER(?) AND LOWER(customer_email) = LOWER(?)
  `).get(order_number.trim(), email.trim())

  if (!order) return res.status(404).json({ error: 'Order not found. Please check your order number and email address.' })

  res.json({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    customer_name: order.customer_name,
    items: JSON.parse(order.items || '[]'),
    subtotal: order.subtotal,
    discount_amount: order.discount_amount,
    shipping_cost: order.shipping_cost,
    shipping_zone: order.shipping_zone,
    shipping_method: order.shipping_method,
    coupon_code: order.coupon_code,
    total: order.total,
    notes: order.notes,
    shipping_address: order.shipping_address,
    created_at: order.created_at,
    updated_at: order.updated_at,
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
    discount_amount: order.discount_amount,
    shipping_cost: order.shipping_cost,
    shipping_zone: order.shipping_zone,
    shipping_method: order.shipping_method,
    coupon_code: order.coupon_code,
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

// ─── Admin: Invoice HTML (print-ready) ───────────────────────────────────────
// GET /api/orders/:id/invoice
router.get('/:id/invoice', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const settingRows = db.prepare(`SELECT key, value FROM settings WHERE key IN ('site_name','shop_currency_symbol','site_logo')`).all()
  const s = {}
  settingRows.forEach(r => (s[r.key] = r.value))
  const siteName = s.site_name || 'Pygmy CMS'
  const sym = s.shop_currency_symbol || '€'
  const items = JSON.parse(order.items || '[]')

  const itemRows = items.map(i => `
    <tr>
      <td>${i.name || i.product_id}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${sym}${Number(i.unit_price || 0).toFixed(2)}</td>
      <td style="text-align:right">${sym}${Number(i.line_total || 0).toFixed(2)}</td>
    </tr>
  `).join('')

  const discountRow = order.discount_amount > 0 ? `
    <tr class="subtotal-row">
      <td colspan="3" style="text-align:right">Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}</td>
      <td style="text-align:right">−${sym}${Number(order.discount_amount).toFixed(2)}</td>
    </tr>` : ''

  const shippingRow = order.shipping_cost > 0 ? `
    <tr class="subtotal-row">
      <td colspan="3" style="text-align:right">Shipping${order.shipping_method ? ` (${order.shipping_method})` : ''}</td>
      <td style="text-align:right">${sym}${Number(order.shipping_cost).toFixed(2)}</td>
    </tr>` : `
    <tr class="subtotal-row">
      <td colspan="3" style="text-align:right">Shipping</td>
      <td style="text-align:right">Free</td>
    </tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice ${order.order_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; background: #fff; font-size: 13px; }
    .page { max-width: 760px; margin: 0 auto; padding: 2.5rem 2rem; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2.5rem; border-bottom: 2px solid #111; padding-bottom: 1.25rem; }
    .header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; }
    .header .meta { text-align: right; font-size: 12px; color: #555; line-height: 1.8; }
    .meta strong { color: #111; font-size: 13px; }
    .bill-section { display: flex; gap: 2rem; margin-bottom: 2rem; }
    .bill-box { flex: 1; }
    .bill-box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #888; margin-bottom: .4rem; }
    .bill-box p { line-height: 1.7; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    thead th { background: #111; color: #fff; padding: .5rem .75rem; text-align: left; font-size: 12px; font-weight: 600; }
    thead th:nth-child(2), thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    tbody td { padding: .55rem .75rem; border-bottom: 1px solid #eee; vertical-align: top; }
    .subtotal-row td { border-bottom: none; color: #555; padding: .3rem .75rem; }
    .total-row td { border-top: 2px solid #111; font-weight: 700; font-size: 15px; padding: .6rem .75rem; }
    .status-badge { display: inline-block; padding: .2em .75em; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; background: #f0f0f0; color: #333; }
    .footer { margin-top: 3rem; border-top: 1px solid #eee; padding-top: 1rem; font-size: 11px; color: #aaa; text-align: center; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
      .page { padding: 1rem; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="no-print" style="margin-bottom:1rem; display:flex; gap:.5rem;">
    <button onclick="window.print()" style="padding:.4rem 1rem;background:#111;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;">🖨️ Print / Save PDF</button>
    <button onclick="window.close()" style="padding:.4rem 1rem;background:#eee;color:#333;border:none;border-radius:4px;cursor:pointer;font-size:13px;">✕ Close</button>
  </div>
  <div class="header">
    <div>
      <h1>${siteName}</h1>
      <div style="margin-top:.3rem; color:#555; font-size:12px;">Invoice / Order Confirmation</div>
    </div>
    <div class="meta">
      <strong>${order.order_number}</strong><br>
      Date: ${new Date(order.created_at).toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' })}<br>
      Status: <span class="status-badge">${order.status}</span>
    </div>
  </div>

  <div class="bill-section">
    <div class="bill-box">
      <h4>Billed To</h4>
      <p>
        <strong>${order.customer_name}</strong><br>
        ${order.customer_email}<br>
        ${order.customer_phone ? order.customer_phone + '<br>' : ''}
        ${order.shipping_address ? order.shipping_address.replace(/\n/g, '<br>') : ''}
      </p>
    </div>
    ${order.shipping_zone ? `<div class="bill-box">
      <h4>Shipping</h4>
      <p>Zone: ${order.shipping_zone}<br>${order.shipping_method || ''}</p>
    </div>` : ''}
    ${order.notes ? `<div class="bill-box">
      <h4>Notes</h4>
      <p>${order.notes.replace(/\n/g, '<br>')}</p>
    </div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="subtotal-row">
        <td colspan="3" style="text-align:right; padding-top:.75rem;">Subtotal</td>
        <td style="text-align:right; padding-top:.75rem;">${sym}${Number(order.subtotal).toFixed(2)}</td>
      </tr>
      ${discountRow}
      ${shippingRow}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">Total</td>
        <td style="text-align:right">${sym}${Number(order.total).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">Thank you for your order. If you have any questions, please contact us.</div>
</div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html')
  res.send(html)
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
