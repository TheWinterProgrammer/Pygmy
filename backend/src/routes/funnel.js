// Pygmy CMS — Sales Funnel Analytics (Phase 63)
// Tracks: product_view → add_to_cart → checkout_start → order_placed
// Provides funnel summary + per-product breakdown + daily trends.
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const r = Router()

// Bootstrap table
db.prepare(`
  CREATE TABLE IF NOT EXISTS funnel_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type  TEXT NOT NULL,   -- product_view | add_to_cart | checkout_start | order_placed
    product_id  INTEGER,
    product_slug TEXT NOT NULL DEFAULT '',
    session_id  TEXT NOT NULL DEFAULT '',
    order_number TEXT,
    value       REAL,            -- order total for order_placed
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_funnel_event_type  ON funnel_events(event_type)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_funnel_date        ON funnel_events(created_at)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_funnel_session     ON funnel_events(session_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_funnel_product     ON funnel_events(product_id)`).run()

// ─── POST /api/funnel/event — record an event (public, fire-and-forget) ───────
r.post('/event', (req, res) => {
  const { event_type, product_id, product_slug, session_id, order_number, value } = req.body
  const valid = ['product_view', 'add_to_cart', 'checkout_start', 'order_placed']
  if (!event_type || !valid.includes(event_type)) {
    return res.status(400).json({ error: `event_type must be one of: ${valid.join(', ')}` })
  }
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  db.prepare(`
    INSERT INTO funnel_events (event_type, product_id, product_slug, session_id, order_number, value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    event_type,
    product_id ? parseInt(product_id) : null,
    product_slug || '',
    session_id,
    order_number || null,
    value ? parseFloat(value) : null
  )

  res.json({ ok: true })
})

// ─── GET /api/funnel/summary — overall funnel metrics ────────────────────────
r.get('/summary', auth, (req, res) => {
  const { days = 30 } = req.query
  const since = `datetime('now', '-${parseInt(days)} days')`

  const counts = {}
  const stages = ['product_view', 'add_to_cart', 'checkout_start', 'order_placed']

  for (const stage of stages) {
    const row = db.prepare(`
      SELECT COUNT(DISTINCT session_id) AS n
      FROM funnel_events
      WHERE event_type = ? AND created_at >= ${since}
    `).get(stage)
    counts[stage] = row.n
  }

  // Conversion rates between stages
  const cr = (a, b) => a > 0 ? Math.round((b / a) * 1000) / 10 : 0
  const conversions = {
    view_to_cart:      cr(counts.product_view,  counts.add_to_cart),
    cart_to_checkout:  cr(counts.add_to_cart,   counts.checkout_start),
    checkout_to_order: cr(counts.checkout_start, counts.order_placed),
    overall:           cr(counts.product_view,  counts.order_placed),
  }

  // Revenue from completed orders in this window
  const revenue = db.prepare(`
    SELECT COALESCE(SUM(value), 0) AS total, COUNT(*) AS orders
    FROM funnel_events
    WHERE event_type = 'order_placed' AND created_at >= ${since}
  `).get()

  res.json({ counts, conversions, revenue: revenue.total, orders: revenue.orders })
})

// ─── GET /api/funnel/daily — daily event counts per stage ────────────────────
r.get('/daily', auth, (req, res) => {
  const { days = 30 } = req.query
  const since = `datetime('now', '-${parseInt(days)} days')`

  const rows = db.prepare(`
    SELECT date(created_at) AS day, event_type, COUNT(DISTINCT session_id) AS n
    FROM funnel_events
    WHERE created_at >= ${since}
    GROUP BY day, event_type
    ORDER BY day ASC
  `).all()

  // Build day-keyed map
  const byDay = {}
  for (const row of rows) {
    if (!byDay[row.day]) byDay[row.day] = { day: row.day, product_view: 0, add_to_cart: 0, checkout_start: 0, order_placed: 0 }
    byDay[row.day][row.event_type] = row.n
  }

  res.json(Object.values(byDay))
})

// ─── GET /api/funnel/products — per-product funnel breakdown ─────────────────
r.get('/products', auth, (req, res) => {
  const { days = 30, limit = 20, offset = 0 } = req.query
  const since = `datetime('now', '-${parseInt(days)} days')`

  // Get top products by view count
  const products = db.prepare(`
    SELECT
      fe.product_id,
      fe.product_slug,
      p.name AS product_name,
      p.cover_image,
      COUNT(DISTINCT CASE WHEN fe.event_type = 'product_view'    THEN fe.session_id END) AS views,
      COUNT(DISTINCT CASE WHEN fe.event_type = 'add_to_cart'     THEN fe.session_id END) AS carts,
      COUNT(DISTINCT CASE WHEN fe.event_type = 'checkout_start'  THEN fe.session_id END) AS checkouts,
      COUNT(DISTINCT CASE WHEN fe.event_type = 'order_placed'    THEN fe.session_id END) AS orders
    FROM funnel_events fe
    LEFT JOIN products p ON p.id = fe.product_id
    WHERE fe.created_at >= ${since} AND fe.product_id IS NOT NULL
    GROUP BY fe.product_id
    ORDER BY views DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset))

  const total = db.prepare(`
    SELECT COUNT(DISTINCT product_id) AS n FROM funnel_events
    WHERE created_at >= ${since} AND product_id IS NOT NULL
  `).get().n

  // Add conversion rates
  const result = products.map(p => ({
    ...p,
    view_to_cart: p.views > 0 ? Math.round((p.carts / p.views) * 1000) / 10 : 0,
    cart_to_order: p.carts > 0 ? Math.round((p.orders / p.carts) * 1000) / 10 : 0,
  }))

  res.json({ products: result, total })
})

// ─── GET /api/funnel/sessions — session-level funnel paths (for debugging) ───
r.get('/sessions', auth, (req, res) => {
  const { days = 7, limit = 50 } = req.query
  const since = `datetime('now', '-${parseInt(days)} days')`

  const rows = db.prepare(`
    SELECT
      session_id,
      GROUP_CONCAT(event_type ORDER BY created_at ASC) AS path,
      MIN(created_at) AS started_at,
      MAX(created_at) AS last_event,
      MAX(CASE WHEN event_type = 'order_placed' THEN order_number END) AS order_number,
      MAX(CASE WHEN event_type = 'order_placed' THEN value END) AS order_value,
      COUNT(*) AS event_count
    FROM funnel_events
    WHERE created_at >= ${since}
    GROUP BY session_id
    ORDER BY started_at DESC
    LIMIT ?
  `).all(parseInt(limit))

  res.json(rows)
})

export default r
