// Pygmy CMS — Subscription Plans + Member Management API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function addPeriod(interval, days = 0) {
  const d = new Date()
  if (days) { d.setDate(d.getDate() + days); return d.toISOString() }
  if (interval === 'year') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

function parseFeatures(f) {
  if (!f) return []
  try { return JSON.parse(f) } catch { return [] }
}

// ── ADMIN: Plans CRUD ────────────────────────────────────────────────────────

// GET /api/subscriptions/plans  (public — for pricing page)
router.get('/plans', (req, res) => {
  const admin = !!req.headers.authorization
  const plans = db.prepare(
    admin
      ? `SELECT * FROM subscription_plans ORDER BY sort_order, id`
      : `SELECT * FROM subscription_plans WHERE active=1 ORDER BY sort_order, id`
  ).all()
  res.json(plans.map(p => ({ ...p, features: parseFeatures(p.features) })))
})

// POST /api/subscriptions/plans
router.post('/plans', authMiddleware, (req, res) => {
  const { name, description = '', price = 0, interval = 'month', trial_days = 0, features = [], active = 1, sort_order = 0 } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const slug = slugify(name)
  try {
    const result = db.prepare(`
      INSERT INTO subscription_plans (name, slug, description, price, interval, trial_days, features, active, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(name, slug, description, price, interval, trial_days, JSON.stringify(features), active ? 1 : 0, sort_order)
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id=?').get(result.lastInsertRowid)
    logActivity(req.user.id, req.user.name, 'create', 'subscription_plan', plan.id, `Created plan: ${plan.name}`)
    res.status(201).json({ ...plan, features: parseFeatures(plan.features) })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/subscriptions/plans/:id
router.put('/plans/:id', authMiddleware, (req, res) => {
  const { name, description, price, interval, trial_days, features, active, sort_order } = req.body
  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id=?').get(req.params.id)
  if (!plan) return res.status(404).json({ error: 'Not found' })
  db.prepare(`
    UPDATE subscription_plans SET
      name=?, description=?, price=?, interval=?, trial_days=?,
      features=?, active=?, sort_order=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    name ?? plan.name,
    description ?? plan.description,
    price ?? plan.price,
    interval ?? plan.interval,
    trial_days ?? plan.trial_days,
    JSON.stringify(features ?? parseFeatures(plan.features)),
    active !== undefined ? (active ? 1 : 0) : plan.active,
    sort_order ?? plan.sort_order,
    plan.id
  )
  const updated = db.prepare('SELECT * FROM subscription_plans WHERE id=?').get(plan.id)
  res.json({ ...updated, features: parseFeatures(updated.features) })
})

// DELETE /api/subscriptions/plans/:id
router.delete('/plans/:id', authMiddleware, (req, res) => {
  const active = db.prepare(`SELECT COUNT(*) as c FROM member_subscriptions WHERE plan_id=? AND status='active'`).get(req.params.id)
  if (active.c > 0) return res.status(409).json({ error: `Cannot delete plan with ${active.c} active subscriptions` })
  db.prepare('DELETE FROM subscription_plans WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ── ADMIN: Members management ─────────────────────────────────────────────────

// GET /api/subscriptions/members?status=&q=&limit=&offset=
router.get('/members', authMiddleware, (req, res) => {
  const { status, q = '', limit = 50, offset = 0 } = req.query
  const like = `%${q}%`
  let where = `WHERE (c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)`
  const params = [like, like, like]
  if (status) { where += ` AND s.status = ?`; params.push(status) }
  params.push(+limit, +offset)
  const rows = db.prepare(`
    SELECT s.*, sp.name as plan_name, sp.interval as plan_interval, sp.price as plan_price,
           c.email, c.first_name, c.last_name
    FROM member_subscriptions s
    JOIN customers c ON s.customer_id = c.id
    JOIN subscription_plans sp ON s.plan_id = sp.id
    ${where}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params)
  const total = db.prepare(`
    SELECT COUNT(*) as c FROM member_subscriptions s
    JOIN customers c ON s.customer_id = c.id
    ${where.replace('LIMIT ? OFFSET ?', '')}
  `).get(...params.slice(0, -2))?.c ?? 0
  res.json({ members: rows, total })
})

// GET /api/subscriptions/stats
router.get('/stats', authMiddleware, (req, res) => {
  const active = db.prepare(`SELECT COUNT(*) as c FROM member_subscriptions WHERE status='active'`).get().c
  const trialing = db.prepare(`SELECT COUNT(*) as c FROM member_subscriptions WHERE status='trialing'`).get().c
  const cancelled = db.prepare(`SELECT COUNT(*) as c FROM member_subscriptions WHERE status='cancelled'`).get().c
  const expired = db.prepare(`SELECT COUNT(*) as c FROM member_subscriptions WHERE status='expired'`).get().c
  const mrr = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN sp.interval='month' THEN sp.price WHEN sp.interval='year' THEN sp.price/12 ELSE 0 END), 0) as mrr
    FROM member_subscriptions s JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.status='active'
  `).get().mrr ?? 0
  res.json({ active, trialing, cancelled, expired, mrr: Math.round(mrr * 100) / 100 })
})

// POST /api/subscriptions/members  (admin-grant a subscription)
router.post('/members', authMiddleware, (req, res) => {
  const { customer_id, plan_id, status = 'active', trial_days = 0, notes = '' } = req.body
  if (!customer_id || !plan_id) return res.status(400).json({ error: 'customer_id and plan_id required' })
  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id=?').get(plan_id)
  if (!plan) return res.status(404).json({ error: 'Plan not found' })
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(customer_id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const now = new Date().toISOString()
  const periodEnd = addPeriod(plan.interval)
  const trialEnds = trial_days > 0 ? addPeriod(null, trial_days) : null
  const effectiveStatus = trial_days > 0 ? 'trialing' : status

  const result = db.prepare(`
    INSERT INTO member_subscriptions
      (customer_id, plan_id, status, current_period_start, current_period_end, trial_ends_at, notes)
    VALUES (?,?,?,?,?,?,?)
  `).run(customer_id, plan_id, effectiveStatus, now, periodEnd, trialEnds, notes)

  // Update customer plan_id
  db.prepare(`UPDATE customers SET plan_id=? WHERE id=?`).run(plan_id, customer_id)

  logActivity(req.user.id, req.user.name, 'create', 'member_subscription', result.lastInsertRowid,
    `Granted ${plan.name} to ${customer.email}`)

  const sub = db.prepare('SELECT * FROM member_subscriptions WHERE id=?').get(result.lastInsertRowid)
  res.status(201).json(sub)
})

// PUT /api/subscriptions/members/:id  (admin update status/notes)
router.put('/members/:id', authMiddleware, (req, res) => {
  const { status, notes, cancel_at_end } = req.body
  const sub = db.prepare('SELECT * FROM member_subscriptions WHERE id=?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })

  const cancelledAt = status === 'cancelled' && sub.status !== 'cancelled' ? new Date().toISOString() : sub.cancelled_at

  db.prepare(`
    UPDATE member_subscriptions SET
      status=?, notes=?, cancel_at_end=?, cancelled_at=?, updated_at=datetime('now')
    WHERE id=?
  `).run(status ?? sub.status, notes ?? sub.notes, cancel_at_end !== undefined ? (cancel_at_end ? 1 : 0) : sub.cancel_at_end, cancelledAt, sub.id)

  // If cancelled, clear plan_id on customer
  if (status === 'cancelled' || status === 'expired') {
    db.prepare(`UPDATE customers SET plan_id=NULL WHERE id=? AND plan_id=?`).run(sub.customer_id, sub.plan_id)
  }

  res.json(db.prepare('SELECT * FROM member_subscriptions WHERE id=?').get(sub.id))
})

// DELETE /api/subscriptions/members/:id
router.delete('/members/:id', authMiddleware, (req, res) => {
  const sub = db.prepare('SELECT * FROM member_subscriptions WHERE id=?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM member_subscriptions WHERE id=?').run(sub.id)
  db.prepare(`UPDATE customers SET plan_id=NULL WHERE id=? AND plan_id=?`).run(sub.customer_id, sub.plan_id)
  res.json({ ok: true })
})

// ── CUSTOMER: Own subscription ────────────────────────────────────────────────

// GET /api/subscriptions/me
router.get('/me', customerAuthMiddleware, (req, res) => {
  const sub = db.prepare(`
    SELECT s.*, sp.name as plan_name, sp.description as plan_description,
           sp.price, sp.interval, sp.features as plan_features
    FROM member_subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.customer_id = ? AND s.status IN ('active','trialing')
    ORDER BY s.created_at DESC LIMIT 1
  `).get(req.customer.id)
  if (!sub) return res.json({ subscription: null })
  res.json({ subscription: { ...sub, plan_features: parseFeatures(sub.plan_features) } })
})

// POST /api/subscriptions/cancel  (customer self-cancel)
router.post('/cancel', customerAuthMiddleware, (req, res) => {
  const sub = db.prepare(`
    SELECT * FROM member_subscriptions WHERE customer_id=? AND status IN ('active','trialing')
    ORDER BY created_at DESC LIMIT 1
  `).get(req.customer.id)
  if (!sub) return res.status(404).json({ error: 'No active subscription' })
  db.prepare(`UPDATE member_subscriptions SET cancel_at_end=1, updated_at=datetime('now') WHERE id=?`).run(sub.id)
  res.json({ ok: true, message: 'Subscription will cancel at end of current period.' })
})

// POST /api/subscriptions/reactivate  (customer reactivate a cancel_at_end sub)
router.post('/reactivate', customerAuthMiddleware, (req, res) => {
  const sub = db.prepare(`
    SELECT * FROM member_subscriptions WHERE customer_id=? AND status IN ('active','trialing') AND cancel_at_end=1
    ORDER BY created_at DESC LIMIT 1
  `).get(req.customer.id)
  if (!sub) return res.status(404).json({ error: 'No subscription pending cancellation' })
  db.prepare(`UPDATE member_subscriptions SET cancel_at_end=0, updated_at=datetime('now') WHERE id=?`).run(sub.id)
  res.json({ ok: true, message: 'Subscription reactivated.' })
})

// ── REVENUE REPORTS ───────────────────────────────────────────────────────────

// GET /api/subscriptions/revenue?days=30
router.get('/revenue', authMiddleware, (req, res) => {
  const { days = 30, period = 'daily' } = req.query

  // Orders revenue over time
  const ordersTimeSeries = db.prepare(`
    SELECT date(created_at) as date, 
           COUNT(*) as orders,
           COALESCE(SUM(total), 0) as revenue
    FROM orders
    WHERE status NOT IN ('cancelled','refunded')
      AND date(created_at) >= date('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date
  `).all(+days)

  // By product category
  const byCategory = db.prepare(`
    SELECT COALESCE(pc.name, 'Uncategorized') as category,
           COUNT(DISTINCT o.id) as orders,
           COALESCE(SUM(o.total), 0) as revenue
    FROM orders o
    JOIN products p ON json_each.value IS NOT NULL
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    CROSS JOIN json_each(o.items)
    WHERE o.status NOT IN ('cancelled','refunded')
      AND date(o.created_at) >= date('now', '-' || ? || ' days')
    GROUP BY pc.name
    ORDER BY revenue DESC
    LIMIT 10
  `).all(+days)

  // Top products by revenue  
  const topProducts = db.prepare(`
    SELECT 
      json_extract(item.value, '$.name') as product_name,
      SUM(CAST(json_extract(item.value, '$.qty') AS INTEGER)) as units,
      SUM(
        CAST(json_extract(item.value, '$.qty') AS INTEGER) *
        CAST(json_extract(item.value, '$.price') AS REAL)
      ) as revenue
    FROM orders o, json_each(o.items) item
    WHERE o.status NOT IN ('cancelled','refunded')
      AND date(o.created_at) >= date('now', '-' || ? || ' days')
    GROUP BY json_extract(item.value, '$.name')
    ORDER BY revenue DESC
    LIMIT 10
  `).all(+days)

  // Revenue summary
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total ELSE 0 END), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') AND date(created_at) >= date('now', '-1 days') THEN total ELSE 0 END), 0) as today_revenue,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') AND date(created_at) >= date('now', '-7 days') THEN total ELSE 0 END), 0) as week_revenue,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') AND date(created_at) >= date('now', '-30 days') THEN total ELSE 0 END), 0) as month_revenue,
      COALESCE(AVG(CASE WHEN status NOT IN ('cancelled','refunded') THEN total ELSE NULL END), 0) as avg_order_value,
      COALESCE(SUM(CASE WHEN status='refunded' THEN total ELSE 0 END), 0) as refunded_revenue,
      COALESCE(SUM(CASE WHEN status='cancelled' THEN total ELSE 0 END), 0) as cancelled_revenue
    FROM orders
    WHERE date(created_at) >= date('now', '-' || ? || ' days')
  `).get(+days)

  // Status breakdown
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
    FROM orders
    WHERE date(created_at) >= date('now', '-' || ? || ' days')
    GROUP BY status ORDER BY count DESC
  `).all(+days)

  // Coupon usage
  const couponUsage = db.prepare(`
    SELECT coupon_code, COUNT(*) as uses, COALESCE(SUM(discount_amount),0) as total_discount
    FROM orders
    WHERE coupon_code != '' AND date(created_at) >= date('now', '-' || ? || ' days')
    GROUP BY coupon_code ORDER BY uses DESC LIMIT 10
  `).all(+days)

  // Shipping revenue
  const shippingRevenue = db.prepare(`
    SELECT COALESCE(SUM(shipping_cost),0) as shipping_revenue
    FROM orders
    WHERE status NOT IN ('cancelled','refunded')
      AND date(created_at) >= date('now', '-' || ? || ' days')
  `).get(+days)

  // Tax collected
  const taxCollected = db.prepare(`
    SELECT COALESCE(SUM(tax_amount),0) as tax_collected
    FROM orders
    WHERE status NOT IN ('cancelled','refunded')
      AND date(created_at) >= date('now', '-' || ? || ' days')
  `).get(+days)

  res.json({
    summary: {
      ...summary,
      shipping_revenue: shippingRevenue?.shipping_revenue ?? 0,
      tax_collected: taxCollected?.tax_collected ?? 0
    },
    timeSeries: ordersTimeSeries,
    topProducts,
    byStatus,
    couponUsage
  })
})

// GET /api/subscriptions/revenue/export?days=30 (CSV)
router.get('/revenue/export', authMiddleware, (req, res) => {
  const { days = 30 } = req.query
  const rows = db.prepare(`
    SELECT date(created_at) as date,
           COUNT(*) as orders,
           COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total ELSE 0 END), 0) as revenue,
           COALESCE(SUM(CASE WHEN status='refunded' THEN total ELSE 0 END), 0) as refunded,
           COALESCE(SUM(shipping_cost), 0) as shipping,
           COALESCE(SUM(tax_amount), 0) as tax
    FROM orders
    WHERE date(created_at) >= date('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date
  `).all(+days)

  const header = 'Date,Orders,Revenue,Refunded,Shipping,Tax\n'
  const csv = header + rows.map(r =>
    `${r.date},${r.orders},${r.revenue.toFixed(2)},${r.refunded.toFixed(2)},${r.shipping.toFixed(2)},${r.tax.toFixed(2)}`
  ).join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="revenue-${days}d.csv"`)
  res.send(csv)
})

export default router
