// Pygmy CMS — Stock Forecasting API (Phase 41)
// Analyzes historical order velocity to predict stockouts
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ── GET /api/stock-forecast ──────────────────────────────────────────────────
// Returns forecasting data for all tracked products
router.get('/', authMiddleware, (req, res) => {
  const { days = 30, limit = 50, offset = 0, filter = 'all' } = req.query
  const lookbackDays = Math.max(7, Math.min(365, Number(days)))
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString()

  // Get all tracked products
  const products = db.prepare(`
    SELECT p.id, p.name, p.slug, p.sku, p.cover_image,
           p.stock_quantity, p.low_stock_threshold, p.allow_backorder, p.track_stock
    FROM products p
    WHERE p.track_stock = 1
    ORDER BY p.name
  `).all()

  // Get order items in the lookback window to compute velocity
  const orderItems = db.prepare(`
    SELECT json_extract(item.value, '$.product_id') AS product_id,
           CAST(json_extract(item.value, '$.quantity') AS INTEGER) AS qty,
           o.created_at
    FROM orders o, json_each(o.items) AS item
    WHERE o.created_at >= ?
      AND o.status NOT IN ('cancelled', 'refunded')
  `).all(cutoff)

  // Aggregate by product_id
  const salesMap = {}
  for (const row of orderItems) {
    if (!row.product_id) continue
    if (!salesMap[row.product_id]) salesMap[row.product_id] = 0
    salesMap[row.product_id] += (row.qty || 1)
  }

  const forecasts = products.map(p => {
    const totalSold    = salesMap[p.id] || 0
    const dailyVelocity = totalSold / lookbackDays
    const currentStock  = p.stock_quantity || 0
    let daysUntilStockout = null
    let stockoutDate      = null

    if (dailyVelocity > 0 && currentStock > 0) {
      daysUntilStockout = Math.floor(currentStock / dailyVelocity)
      stockoutDate      = new Date(Date.now() + daysUntilStockout * 86400000).toISOString().split('T')[0]
    } else if (currentStock <= 0) {
      daysUntilStockout = 0
      stockoutDate      = 'already_out'
    }

    // Suggested reorder quantity: cover 30 days of velocity + safety stock (15 days)
    const reorderSuggestion = dailyVelocity > 0
      ? Math.ceil(dailyVelocity * 45)  // 30 days demand + 50% safety
      : 0

    // Risk level
    let risk = 'healthy'
    if (currentStock <= 0) risk = 'out_of_stock'
    else if (daysUntilStockout !== null && daysUntilStockout <= 7) risk = 'critical'
    else if (daysUntilStockout !== null && daysUntilStockout <= 30) risk = 'warning'
    else if (currentStock <= (p.low_stock_threshold || 5)) risk = 'low'

    return {
      ...p,
      total_sold:         totalSold,
      daily_velocity:     +dailyVelocity.toFixed(3),
      days_until_stockout: daysUntilStockout,
      stockout_date:      stockoutDate,
      reorder_suggestion: reorderSuggestion,
      risk,
    }
  })

  // Filter by risk
  let filtered = forecasts
  if (filter === 'critical') filtered = forecasts.filter(f => f.risk === 'critical' || f.risk === 'out_of_stock')
  else if (filter === 'warning') filtered = forecasts.filter(f => f.risk === 'warning' || f.risk === 'critical' || f.risk === 'out_of_stock')
  else if (filter === 'healthy') filtered = forecasts.filter(f => f.risk === 'healthy')
  else if (filter === 'no_movement') filtered = forecasts.filter(f => f.daily_velocity === 0 && f.stock_quantity > 0)

  // Sort by risk then by days_until_stockout asc
  const riskOrder = { out_of_stock: 0, critical: 1, warning: 2, low: 3, healthy: 4 }
  filtered.sort((a, b) => {
    const rd = (riskOrder[a.risk] ?? 5) - (riskOrder[b.risk] ?? 5)
    if (rd !== 0) return rd
    const ad = a.days_until_stockout ?? 9999
    const bd = b.days_until_stockout ?? 9999
    return ad - bd
  })

  const total = filtered.length
  const page  = filtered.slice(Number(offset), Number(offset) + Number(limit))

  // Summary stats
  const summary = {
    total_tracked:  products.length,
    out_of_stock:   forecasts.filter(f => f.risk === 'out_of_stock').length,
    critical:       forecasts.filter(f => f.risk === 'critical').length,
    warning:        forecasts.filter(f => f.risk === 'warning').length,
    low:            forecasts.filter(f => f.risk === 'low').length,
    healthy:        forecasts.filter(f => f.risk === 'healthy').length,
    no_movement:    forecasts.filter(f => f.daily_velocity === 0 && f.stock_quantity > 0).length,
    lookback_days:  lookbackDays,
  }

  res.json({ summary, total, items: page })
})

// ── GET /api/stock-forecast/:productId ──────────────────────────────────────
// Returns day-by-day sales history + projection for a single product
router.get('/:productId', authMiddleware, (req, res) => {
  const { days = 30 } = req.query
  const lookbackDays = Math.max(7, Math.min(365, Number(days)))
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString()

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  // Daily sales history
  const dailySales = db.prepare(`
    SELECT date(o.created_at) AS sale_date,
           SUM(CAST(json_extract(item.value, '$.quantity') AS INTEGER)) AS qty
    FROM orders o, json_each(o.items) AS item
    WHERE o.created_at >= ?
      AND json_extract(item.value, '$.product_id') = ?
      AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY date(o.created_at)
    ORDER BY sale_date
  `).all(cutoff, req.params.productId)

  // Fill zero days
  const salesByDate = {}
  dailySales.forEach(r => (salesByDate[r.sale_date] = r.qty))

  const history = []
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    history.push({ date: d, qty: salesByDate[d] || 0 })
  }

  const totalSold     = history.reduce((s, r) => s + r.qty, 0)
  const dailyVelocity = totalSold / lookbackDays
  const currentStock  = product.stock_quantity || 0

  // Project forward 60 days
  const projection = []
  let projectedStock = currentStock
  for (let i = 1; i <= 60; i++) {
    projectedStock = Math.max(0, projectedStock - dailyVelocity)
    const d = new Date(Date.now() + i * 86400000).toISOString().split('T')[0]
    projection.push({ date: d, projected_stock: +projectedStock.toFixed(1) })
  }

  res.json({
    product: { id: product.id, name: product.name, slug: product.slug, stock_quantity: currentStock },
    daily_velocity: +dailyVelocity.toFixed(3),
    total_sold:     totalSold,
    lookback_days:  lookbackDays,
    reorder_suggestion: dailyVelocity > 0 ? Math.ceil(dailyVelocity * 45) : 0,
    history,
    projection,
  })
})

export default router
