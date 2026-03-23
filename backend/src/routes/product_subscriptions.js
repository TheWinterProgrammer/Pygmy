// Pygmy CMS — Product Subscriptions API (Phase 42)
// Subscribe-and-save: customers subscribe to receive a product on a recurring interval
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'

const r = Router()

// ─── Admin: List all subscription plans for a product ────────────────────────
r.get('/plans', authMiddleware, (req, res) => {
  const { product_id } = req.query
  let query = `
    SELECT ps.*,
           p.name as product_name, p.slug as product_slug, p.price as product_price, p.cover_image,
           (SELECT COUNT(*) FROM customer_subscriptions_orders cso WHERE cso.subscription_id = ps.id AND cso.status = 'active') as active_subscribers
    FROM product_subscriptions ps
    JOIN products p ON p.id = ps.product_id
    WHERE 1=1
  `
  const params = []
  if (product_id) { query += ' AND ps.product_id = ?'; params.push(product_id) }
  query += ' ORDER BY ps.interval_days ASC'
  res.json(db.prepare(query).all(...params))
})

// ─── Public: Get subscription plans for a product ────────────────────────────
r.get('/plans/public', (req, res) => {
  const { product_id } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  const plans = db.prepare(`
    SELECT id, interval_days, interval_label, discount_pct
    FROM product_subscriptions
    WHERE product_id = ? AND active = 1
    ORDER BY interval_days ASC
  `).all(product_id)
  res.json(plans)
})

// ─── Admin: Create subscription plan ─────────────────────────────────────────
r.post('/plans', authMiddleware, (req, res) => {
  const { product_id, interval_days = 30, interval_label = 'Monthly', discount_pct = 0, active = 1 } = req.body
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const result = db.prepare(`
    INSERT INTO product_subscriptions (product_id, interval_days, interval_label, discount_pct, active)
    VALUES (?, ?, ?, ?, ?)
  `).run(product_id, interval_days, interval_label, discount_pct, active ? 1 : 0)

  // Enable subscription on product
  db.prepare('UPDATE products SET subscription_enabled = 1 WHERE id = ?').run(product_id)

  res.json(db.prepare('SELECT * FROM product_subscriptions WHERE id = ?').get(result.lastInsertRowid))
})

// ─── Admin: Update plan ────────────────────────────────────────────────────────
r.put('/plans/:id', authMiddleware, (req, res) => {
  const plan = db.prepare('SELECT * FROM product_subscriptions WHERE id = ?').get(req.params.id)
  if (!plan) return res.status(404).json({ error: 'Not found' })
  const { interval_days, interval_label, discount_pct, active } = req.body
  db.prepare(`
    UPDATE product_subscriptions SET
      interval_days  = COALESCE(?, interval_days),
      interval_label = COALESCE(?, interval_label),
      discount_pct   = COALESCE(?, discount_pct),
      active         = COALESCE(?, active)
    WHERE id = ?
  `).run(interval_days, interval_label, discount_pct, active !== undefined ? (active ? 1 : 0) : null, req.params.id)
  res.json(db.prepare('SELECT * FROM product_subscriptions WHERE id = ?').get(req.params.id))
})

// ─── Admin: Delete plan ────────────────────────────────────────────────────────
r.delete('/plans/:id', authMiddleware, (req, res) => {
  const plan = db.prepare('SELECT * FROM product_subscriptions WHERE id = ?').get(req.params.id)
  if (!plan) return res.status(404).json({ error: 'Not found' })
  const hasActive = db.prepare("SELECT COUNT(*) as n FROM customer_subscriptions_orders WHERE subscription_id = ? AND status = 'active'").get(req.params.id)
  if (hasActive.n > 0) return res.status(400).json({ error: 'Cannot delete plan with active subscribers. Pause it instead.' })
  db.prepare('DELETE FROM product_subscriptions WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Admin: List all customer subscription orders ─────────────────────────────
r.get('/orders', authMiddleware, (req, res) => {
  const { q = '', status, product_id, limit = 50, offset = 0 } = req.query
  const search = `%${q}%`
  let where = 'WHERE 1=1'
  const params = []
  if (q) { where += ' AND (c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)'; params.push(search, search, search) }
  if (status) { where += ' AND cso.status = ?'; params.push(status) }
  if (product_id) { where += ' AND cso.product_id = ?'; params.push(product_id) }

  const rows = db.prepare(`
    SELECT cso.*,
           c.first_name, c.last_name, c.email,
           p.name as product_name, p.cover_image,
           ps.interval_label, ps.discount_pct
    FROM customer_subscriptions_orders cso
    JOIN customers c ON c.id = cso.customer_id
    JOIN products p ON p.id = cso.product_id
    JOIN product_subscriptions ps ON ps.id = cso.subscription_id
    ${where}
    ORDER BY cso.next_order_date ASC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`
    SELECT COUNT(*) as n FROM customer_subscriptions_orders cso
    JOIN customers c ON c.id = cso.customer_id
    ${where}
  `).get(...params)

  res.json({ orders: rows, total: total.n })
})

// ─── Admin: Stats ─────────────────────────────────────────────────────────────
r.get('/stats', authMiddleware, (req, res) => {
  const active = db.prepare("SELECT COUNT(*) as n FROM customer_subscriptions_orders WHERE status = 'active'").get().n
  const paused = db.prepare("SELECT COUNT(*) as n FROM customer_subscriptions_orders WHERE status = 'paused'").get().n
  const cancelled = db.prepare("SELECT COUNT(*) as n FROM customer_subscriptions_orders WHERE status = 'cancelled'").get().n
  const total = db.prepare("SELECT COUNT(*) as n FROM customer_subscriptions_orders").get().n
  const dueSoon = db.prepare("SELECT COUNT(*) as n FROM customer_subscriptions_orders WHERE status = 'active' AND next_order_date <= datetime('now', '+7 days')").get().n
  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(cso.unit_price * cso.quantity * cso.total_orders), 0) as rev
    FROM customer_subscriptions_orders cso WHERE total_orders > 0
  `).get().rev || 0
  res.json({ active, paused, cancelled, total, due_soon: dueSoon, total_revenue: totalRevenue })
})

// ─── Admin: Update subscription order status ──────────────────────────────────
r.put('/orders/:id', authMiddleware, (req, res) => {
  const sub = db.prepare('SELECT * FROM customer_subscriptions_orders WHERE id = ?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })
  const { status, next_order_date, notes } = req.body
  db.prepare(`
    UPDATE customer_subscriptions_orders SET
      status          = COALESCE(?, status),
      next_order_date = COALESCE(?, next_order_date),
      notes           = COALESCE(?, notes),
      cancelled_at    = CASE WHEN ? = 'cancelled' AND cancelled_at IS NULL THEN datetime('now') ELSE cancelled_at END
    WHERE id = ?
  `).run(status, next_order_date, notes, status, req.params.id)
  res.json(db.prepare('SELECT * FROM customer_subscriptions_orders WHERE id = ?').get(req.params.id))
})

// ─── Customer: Get my subscriptions ───────────────────────────────────────────
r.get('/me', customerAuthMiddleware, (req, res) => {
  const subs = db.prepare(`
    SELECT cso.*,
           p.name as product_name, p.slug as product_slug, p.cover_image,
           ps.interval_label, ps.discount_pct
    FROM customer_subscriptions_orders cso
    JOIN products p ON p.id = cso.product_id
    JOIN product_subscriptions ps ON ps.id = cso.subscription_id
    WHERE cso.customer_id = ?
    ORDER BY cso.created_at DESC
  `).all(req.customer.id)
  res.json(subs)
})

// ─── Customer: Subscribe to a product plan ────────────────────────────────────
r.post('/subscribe', customerAuthMiddleware, (req, res) => {
  const { subscription_id, quantity = 1 } = req.body
  if (!subscription_id) return res.status(400).json({ error: 'subscription_id required' })

  const plan = db.prepare(`
    SELECT ps.*, p.price, p.sale_price, p.stock_quantity, p.track_stock, p.allow_backorder
    FROM product_subscriptions ps JOIN products p ON p.id = ps.product_id
    WHERE ps.id = ? AND ps.active = 1
  `).get(subscription_id)
  if (!plan) return res.status(404).json({ error: 'Subscription plan not found or inactive' })

  // Check stock
  if (plan.track_stock && plan.stock_quantity <= 0 && !plan.allow_backorder) {
    return res.status(400).json({ error: 'Product is out of stock' })
  }

  // Calculate price with discount
  const basePrice = plan.sale_price || plan.price
  const unitPrice = plan.discount_pct > 0 ? Math.round(basePrice * (1 - plan.discount_pct / 100) * 100) / 100 : basePrice

  // Next order date = today + interval_days
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + plan.interval_days)

  const result = db.prepare(`
    INSERT INTO customer_subscriptions_orders
      (customer_id, product_id, subscription_id, status, quantity, unit_price, next_order_date)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
  `).run(req.customer.id, plan.product_id, subscription_id, quantity, unitPrice, nextDate.toISOString())

  res.json(db.prepare('SELECT * FROM customer_subscriptions_orders WHERE id = ?').get(result.lastInsertRowid))
})

// ─── Customer: Cancel/pause subscription ──────────────────────────────────────
r.put('/me/:id', customerAuthMiddleware, (req, res) => {
  const sub = db.prepare('SELECT * FROM customer_subscriptions_orders WHERE id = ? AND customer_id = ?').get(req.params.id, req.customer.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })
  const { status, next_order_date } = req.body
  if (!['active', 'paused', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
  db.prepare(`
    UPDATE customer_subscriptions_orders SET status = ?, next_order_date = COALESCE(?, next_order_date),
      cancelled_at = CASE WHEN ? = 'cancelled' AND cancelled_at IS NULL THEN datetime('now') ELSE cancelled_at END
    WHERE id = ?
  `).run(status, next_order_date, status, req.params.id)
  res.json({ ok: true })
})

export default r
