// Pygmy CMS — Customer LTV Analytics API (Phase 50)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function determineTier (totalSpent, totalOrders) {
  if (totalOrders === 0) return 'new'
  if (totalOrders === 1 && totalSpent < 50) return 'new'
  if (totalOrders <= 2 || totalSpent < 100) return 'occasional'
  if (totalOrders <= 5 || totalSpent < 500) return 'regular'
  if (totalOrders <= 15 || totalSpent < 2000) return 'loyal'
  return 'vip'
}

function computeAndStoreLtv (customerId) {
  const orders = db.prepare(`
    SELECT total, created_at FROM orders
    WHERE customer_id = ? AND status NOT IN ('cancelled', 'refunded')
    ORDER BY created_at ASC
  `).all(customerId)

  if (orders.length === 0) {
    db.prepare(`INSERT OR REPLACE INTO customer_ltv
      (customer_id, total_orders, total_spent, avg_order_value, first_order_date,
       last_order_date, days_as_customer, order_frequency, predicted_ltv, ltv_tier, updated_at)
      VALUES (?, 0, 0, 0, NULL, NULL, 0, 0, 0, 'new', datetime('now'))`).run(customerId)
    return
  }

  const totalOrders = orders.length
  const totalSpent  = orders.reduce((s, o) => s + (o.total || 0), 0)
  const avgOrderValue = totalSpent / totalOrders
  const firstDate   = orders[0].created_at
  const lastDate    = orders[orders.length - 1].created_at

  const firstMs = new Date(firstDate).getTime()
  const nowMs   = Date.now()
  const daysAsCustomer = Math.max(1, Math.floor((nowMs - firstMs) / 86400000))
  const orderFrequency = (totalOrders / daysAsCustomer) * 30 // orders per month
  const predictedLtv   = avgOrderValue * orderFrequency * 12 // 12-month projection
  const tier           = determineTier(totalSpent, totalOrders)

  db.prepare(`INSERT OR REPLACE INTO customer_ltv
    (customer_id, total_orders, total_spent, avg_order_value, first_order_date,
     last_order_date, days_as_customer, order_frequency, predicted_ltv, ltv_tier, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    customerId, totalOrders, totalSpent, avgOrderValue, firstDate, lastDate,
    daysAsCustomer, orderFrequency, predictedLtv, tier
  )
}

// ─── POST /api/customer-ltv/refresh — admin: recompute all customer LTVs ──────

router.post('/refresh', authMiddleware, (req, res) => {
  const customers = db.prepare(`SELECT id FROM customers`).all()
  let updated = 0
  for (const c of customers) {
    computeAndStoreLtv(c.id)
    updated++
  }
  res.json({ ok: true, updated })
})

// ─── POST /api/customer-ltv/refresh/:id — recompute one customer ──────────────

router.post('/refresh/:id', authMiddleware, (req, res) => {
  computeAndStoreLtv(req.params.id)
  res.json({ ok: true })
})

// ─── GET /api/customer-ltv — paginated, sortable, filterable list ─────────────

router.get('/', authMiddleware, (req, res) => {
  const { tier, sort = 'total_spent', order = 'desc', limit = 30, offset = 0, q = '' } = req.query

  const validSorts = ['total_spent', 'predicted_ltv', 'total_orders', 'avg_order_value', 'days_as_customer', 'order_frequency']
  const safeSort = validSorts.includes(sort) ? sort : 'total_spent'
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC'

  let sql = `
    SELECT l.*, c.first_name, c.last_name, c.email, c.created_at as customer_since, c.active
    FROM customer_ltv l
    JOIN customers c ON c.id = l.customer_id
    WHERE 1=1
  `
  const params = []
  if (tier) { sql += ` AND l.ltv_tier = ?`; params.push(tier) }
  if (q) { sql += ` AND (c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  sql += ` ORDER BY l.${safeSort} ${safeOrder} LIMIT ? OFFSET ?`
  params.push(Number(limit), Number(offset))

  const rows = db.prepare(sql).all(...params)
  const total = db.prepare(`SELECT COUNT(*) as c FROM customer_ltv l JOIN customers c ON c.id = l.customer_id WHERE 1=1`).get().c

  res.json({ rows, total })
})

// ─── GET /api/customer-ltv/summary — overall stats ────────────────────────────

router.get('/summary', authMiddleware, (req, res) => {
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total_customers,
      ROUND(AVG(total_spent), 2) as avg_ltv,
      ROUND(AVG(avg_order_value), 2) as avg_order_value,
      ROUND(AVG(order_frequency), 2) as avg_order_frequency,
      ROUND(SUM(total_spent), 2) as total_revenue_all_time,
      ROUND(AVG(predicted_ltv), 2) as avg_predicted_ltv,
      ROUND(SUM(predicted_ltv), 2) as total_predicted_revenue_12m
    FROM customer_ltv
  `).get()

  const tiers = db.prepare(`
    SELECT ltv_tier, COUNT(*) as count,
           ROUND(AVG(total_spent),2) as avg_spent,
           ROUND(AVG(predicted_ltv),2) as avg_predicted
    FROM customer_ltv
    GROUP BY ltv_tier
    ORDER BY CASE ltv_tier WHEN 'vip' THEN 0 WHEN 'loyal' THEN 1 WHEN 'regular' THEN 2 WHEN 'occasional' THEN 3 ELSE 4 END
  `).all()

  // Monthly revenue trend (last 12 months)
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, ROUND(SUM(total),2) as revenue, COUNT(*) as orders
    FROM orders
    WHERE status NOT IN ('cancelled','refunded')
      AND created_at >= datetime('now', '-12 months')
    GROUP BY month
    ORDER BY month ASC
  `).all()

  // Top VIP customers
  const topCustomers = db.prepare(`
    SELECT l.*, c.first_name, c.last_name, c.email
    FROM customer_ltv l
    JOIN customers c ON c.id = l.customer_id
    ORDER BY l.total_spent DESC
    LIMIT 10
  `).all()

  // Cohort analysis (customers by join month, their revenue)
  const cohorts = db.prepare(`
    SELECT strftime('%Y-%m', c.created_at) as cohort_month,
           COUNT(DISTINCT c.id) as customers,
           ROUND(COALESCE(SUM(o.total),0), 2) as total_revenue,
           COUNT(o.id) as total_orders
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled','refunded')
    WHERE c.created_at >= datetime('now', '-12 months')
    GROUP BY cohort_month
    ORDER BY cohort_month ASC
  `).all()

  res.json({ ...totals, tiers, monthly_revenue: monthlyRevenue, top_customers: topCustomers, cohorts })
})

// ─── GET /api/customer-ltv/:id — single customer LTV detail ──────────────────

router.get('/:id', authMiddleware, (req, res) => {
  let ltv = db.prepare(`SELECT l.*, c.first_name, c.last_name, c.email, c.created_at as customer_since
    FROM customer_ltv l JOIN customers c ON c.id = l.customer_id WHERE l.customer_id = ?`).get(req.params.id)

  if (!ltv) {
    // Compute on demand
    computeAndStoreLtv(req.params.id)
    ltv = db.prepare(`SELECT l.*, c.first_name, c.last_name, c.email, c.created_at as customer_since
      FROM customer_ltv l JOIN customers c ON c.id = l.customer_id WHERE l.customer_id = ?`).get(req.params.id)
  }

  if (!ltv) return res.status(404).json({ error: 'Customer not found' })

  // Monthly spending breakdown
  const monthlySpend = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, ROUND(SUM(total),2) as spent, COUNT(*) as orders
    FROM orders
    WHERE customer_id = ? AND status NOT IN ('cancelled','refunded')
    GROUP BY month ORDER BY month ASC
  `).all(req.params.id)

  // Top purchased products
  const topProducts = db.prepare(`
    SELECT p.name, p.slug, p.cover_image, SUM(oi.quantity) as qty, ROUND(SUM(oi.quantity * oi.unit_price), 2) as spent
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.customer_id = ? AND o.status NOT IN ('cancelled','refunded')
    GROUP BY p.id
    ORDER BY spent DESC
    LIMIT 5
  `).all(req.params.id)

  res.json({ ...ltv, monthly_spend: monthlySpend, top_products: topProducts })
})

export { computeAndStoreLtv }
export default router
