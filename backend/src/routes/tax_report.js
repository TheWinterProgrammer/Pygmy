// Pygmy CMS — Tax Report API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// GET /api/tax-report — summary tax accounting report
router.get('/', auth, (req, res) => {
  const { from, to, country } = req.query
  const where = [`o.status NOT IN ('cancelled','refunded')`]
  const params = []

  if (from)    { where.push("date(o.created_at) >= date(?)"); params.push(from) }
  if (to)      { where.push("date(o.created_at) <= date(?)"); params.push(to) }
  if (country) { where.push("o.shipping_country = ?"); params.push(country) }

  const whereStr = 'WHERE ' + where.join(' AND ')

  const summary = db.prepare(`
    SELECT
      COUNT(*)                                      AS order_count,
      SUM(o.total)                                  AS gross_revenue,
      SUM(COALESCE(o.tax_amount, 0))                AS total_tax,
      SUM(o.total - COALESCE(o.tax_amount, 0))      AS net_revenue,
      SUM(COALESCE(o.shipping_cost, 0))             AS total_shipping,
      SUM(COALESCE(o.discount_amount, 0))           AS total_discounts
    FROM orders o ${whereStr}
  `).get(...params)

  const byRate = db.prepare(`
    SELECT
      COALESCE(o.tax_rate_name, 'No Tax') AS rate_name,
      COUNT(*) AS order_count,
      SUM(COALESCE(o.tax_amount, 0)) AS tax_collected,
      SUM(o.total) AS gross,
      SUM(o.total - COALESCE(o.tax_amount, 0)) AS net
    FROM orders o ${whereStr}
    GROUP BY rate_name
    ORDER BY tax_collected DESC
  `).all(...params)

  const byCountry = db.prepare(`
    SELECT
      COALESCE(o.shipping_country, 'Unknown') AS country,
      COUNT(*) AS order_count,
      SUM(COALESCE(o.tax_amount, 0)) AS tax_collected,
      SUM(o.total) AS gross
    FROM orders o ${whereStr}
    GROUP BY country
    ORDER BY tax_collected DESC
  `).all(...params)

  const monthly = db.prepare(`
    SELECT
      strftime('%Y-%m', o.created_at) AS month,
      COUNT(*) AS order_count,
      SUM(COALESCE(o.tax_amount, 0)) AS tax_collected,
      SUM(o.total) AS gross,
      SUM(o.total - COALESCE(o.tax_amount, 0)) AS net
    FROM orders o ${whereStr}
    GROUP BY month
    ORDER BY month
  `).all(...params)

  res.json({ summary, byRate, byCountry, monthly })
})

// GET /api/tax-report/export/csv
router.get('/export/csv', auth, (req, res) => {
  const { from, to, country } = req.query
  const where = [`o.status NOT IN ('cancelled','refunded')`]
  const params = []

  if (from)    { where.push("date(o.created_at) >= date(?)"); params.push(from) }
  if (to)      { where.push("date(o.created_at) <= date(?)"); params.push(to) }
  if (country) { where.push("o.shipping_country = ?"); params.push(country) }

  const whereStr = 'WHERE ' + where.join(' AND ')

  const rows = db.prepare(`
    SELECT o.order_number, o.status, o.customer_name, o.customer_email,
           o.shipping_country, o.tax_rate_name,
           o.total, o.tax_amount, o.shipping_cost, o.discount_amount,
           (o.total - COALESCE(o.tax_amount,0)) AS net_amount,
           o.created_at
    FROM orders o ${whereStr}
    ORDER BY o.created_at DESC
  `).all(...params)

  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = ['Order #', 'Status', 'Customer', 'Email', 'Country', 'Tax Rate', 'Gross', 'Tax', 'Shipping', 'Discount', 'Net', 'Date']
  const csv = [header.join(',')]
  for (const r of rows) {
    csv.push([
      escape(r.order_number), r.status, escape(r.customer_name), escape(r.customer_email),
      escape(r.shipping_country), escape(r.tax_rate_name),
      (r.total||0).toFixed(2), (r.tax_amount||0).toFixed(2),
      (r.shipping_cost||0).toFixed(2), (r.discount_amount||0).toFixed(2),
      (r.net_amount||0).toFixed(2), r.created_at
    ].join(','))
  }

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="tax-report.csv"')
  res.send(csv.join('\n'))
})

// GET /api/tax-report/countries — for filter dropdown
router.get('/countries', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT shipping_country AS country
    FROM orders
    WHERE shipping_country IS NOT NULL AND shipping_country != ''
    ORDER BY country
  `).all()
  res.json(rows.map(r => r.country))
})

export default router
