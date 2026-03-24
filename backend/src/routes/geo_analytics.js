// Pygmy CMS — Geographic Sales Analytics
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/geo-analytics/overview — revenue + orders by country
router.get('/overview', authMiddleware, (req, res) => {
  const { days = '90' } = req.query
  const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString()

  // Orders by country
  const byCountry = db.prepare(`
    SELECT
      CASE WHEN shipping_country IS NULL OR shipping_country = '' THEN 'Unknown' ELSE shipping_country END AS country,
      COUNT(*) AS order_count,
      SUM(total) AS revenue,
      AVG(total) AS avg_order_value,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_orders
    FROM orders
    WHERE created_at >= ? AND status != 'cancelled'
    GROUP BY country
    ORDER BY revenue DESC
    LIMIT 50
  `).all(since)

  // Total for percentages
  const totals = db.prepare(`
    SELECT COUNT(*) AS total_orders, SUM(total) AS total_revenue
    FROM orders
    WHERE created_at >= ? AND status != 'cancelled'
  `).get(since)

  // Monthly breakdown by top 5 countries
  const top5 = byCountry.slice(0, 5).map(r => r.country)
  const placeholders = top5.map(() => '?').join(',')
  const monthly = top5.length > 0 ? db.prepare(`
    SELECT
      strftime('%Y-%m', created_at) AS month,
      CASE WHEN shipping_country IS NULL OR shipping_country = '' THEN 'Unknown' ELSE shipping_country END AS country,
      COUNT(*) AS order_count,
      SUM(total) AS revenue
    FROM orders
    WHERE created_at >= ? AND status != 'cancelled'
      AND (CASE WHEN shipping_country IS NULL OR shipping_country = '' THEN 'Unknown' ELSE shipping_country END) IN (${placeholders})
    GROUP BY month, country
    ORDER BY month ASC
  `).all(since, ...top5) : []

  // City breakdown (parsed from shipping_address)
  const byCityRaw = db.prepare(`
    SELECT shipping_address, shipping_country, total
    FROM orders
    WHERE created_at >= ? AND status != 'cancelled' AND shipping_address IS NOT NULL AND shipping_address != ''
    LIMIT 2000
  `).all(since)

  const cityMap = {}
  for (const o of byCityRaw) {
    // Try to extract city from address (last meaningful segment before country)
    const parts = (o.shipping_address || '').split(',').map(p => p.trim()).filter(Boolean)
    let city = 'Unknown'
    if (parts.length >= 2) {
      // Format: "Street, City, State ZIP, Country" → take second-to-last or penultimate
      const candidate = parts[parts.length - 2] || parts[parts.length - 1]
      // Strip ZIP codes
      city = candidate.replace(/\d{4,}/g, '').trim() || 'Unknown'
    }
    if (!city || city.length < 2) city = 'Unknown'
    const key = `${city}|${o.shipping_country || 'Unknown'}`
    if (!cityMap[key]) cityMap[key] = { city, country: o.shipping_country || 'Unknown', order_count: 0, revenue: 0 }
    cityMap[key].order_count++
    cityMap[key].revenue += o.total || 0
  }
  const cities = Object.values(cityMap).sort((a, b) => b.revenue - a.revenue).slice(0, 20)

  res.json({
    by_country: byCountry.map(r => ({
      ...r,
      revenue_pct: totals.total_revenue > 0 ? ((r.revenue / totals.total_revenue) * 100).toFixed(1) : '0.0',
      order_pct: totals.total_orders > 0 ? ((r.order_count / totals.total_orders) * 100).toFixed(1) : '0.0'
    })),
    totals,
    monthly,
    top5_countries: top5,
    cities
  })
})

// GET /api/geo-analytics/country/:code — detailed stats for one country
router.get('/country/:code', authMiddleware, (req, res) => {
  const { code } = req.params
  const { days = '90' } = req.query
  const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString()

  const country = code === 'Unknown' ? '' : code

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS order_count,
      SUM(total) AS revenue,
      AVG(total) AS avg_order_value,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      MIN(created_at) AS first_order,
      MAX(created_at) AS last_order
    FROM orders
    WHERE created_at >= ?
      AND (shipping_country = ? OR (? = '' AND (shipping_country IS NULL OR shipping_country = '')))
  `).get(since, country, country)

  const daily = db.prepare(`
    SELECT
      date(created_at) AS day,
      COUNT(*) AS order_count,
      SUM(total) AS revenue
    FROM orders
    WHERE created_at >= ?
      AND status != 'cancelled'
      AND (shipping_country = ? OR (? = '' AND (shipping_country IS NULL OR shipping_country = '')))
    GROUP BY day
    ORDER BY day ASC
  `).all(since, country, country)

  const topProducts = db.prepare(`
    SELECT
      json_extract(item.value, '$.name') AS product_name,
      COUNT(*) AS order_count,
      SUM(json_extract(item.value, '$.price') * json_extract(item.value, '$.qty')) AS revenue
    FROM orders o,
         json_each(o.items) AS item
    WHERE o.created_at >= ?
      AND o.status != 'cancelled'
      AND (o.shipping_country = ? OR (? = '' AND (o.shipping_country IS NULL OR o.shipping_country = '')))
    GROUP BY product_name
    ORDER BY revenue DESC
    LIMIT 10
  `).all(since, country, country)

  res.json({ stats, daily, top_products: topProducts })
})

export default router
