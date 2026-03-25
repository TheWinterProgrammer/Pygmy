// Pygmy CMS — Customer Journey Analytics API (Phase 71)
// Tracks page visit sequences → shop → cart → checkout → order
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Schema Init ─────────────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS journey_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL DEFAULT '',
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL DEFAULT '',
    page_path   TEXT NOT NULL DEFAULT '/',
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id   INTEGER DEFAULT NULL,
    entity_slug TEXT NOT NULL DEFAULT '',
    referrer    TEXT NOT NULL DEFAULT '',
    utm_source  TEXT NOT NULL DEFAULT '',
    utm_medium  TEXT NOT NULL DEFAULT '',
    utm_campaign TEXT NOT NULL DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_journey_session ON journey_events(session_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_journey_type ON journey_events(event_type)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_journey_created ON journey_events(created_at)`).run()

// ─── Public: Track event ─────────────────────────────────────────────────────

// POST /api/customer-journey/track
router.post('/track', (req, res) => {
  const {
    session_id = '',
    customer_id = null,
    event_type = 'page_view',
    page_path = '/',
    entity_type = '',
    entity_id = null,
    entity_slug = '',
    referrer = '',
    utm_source = '',
    utm_medium = '',
    utm_campaign = ''
  } = req.body

  if (!session_id || !event_type) {
    return res.status(400).json({ error: 'session_id and event_type required' })
  }

  // Dedup: ignore same session+event+path within 30 seconds
  const recent = db.prepare(`
    SELECT id FROM journey_events
    WHERE session_id = ? AND event_type = ? AND page_path = ?
      AND created_at > datetime('now', '-30 seconds')
  `).get(session_id, event_type, page_path)
  if (recent) return res.json({ ok: true, deduped: true })

  db.prepare(`
    INSERT INTO journey_events
      (session_id, customer_id, event_type, page_path, entity_type, entity_id, entity_slug,
       referrer, utm_source, utm_medium, utm_campaign)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session_id, customer_id, event_type, page_path, entity_type, entity_id || null,
    entity_slug, referrer, utm_source, utm_medium, utm_campaign
  )

  res.json({ ok: true })
})

// ─── Admin: Analytics ────────────────────────────────────────────────────────

// GET /api/customer-journey/funnel?days=30
// Returns a funnel breakdown of the customer journey stages
router.get('/funnel', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)
  const since = `datetime('now', '-${days} days')`

  // Count unique sessions at each stage
  const landing = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM journey_events
    WHERE event_type = 'page_view' AND created_at > ${since}
  `).get()

  const productView = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM journey_events
    WHERE event_type = 'product_view' AND created_at > ${since}
  `).get()

  const addToCart = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM journey_events
    WHERE event_type = 'add_to_cart' AND created_at > ${since}
  `).get()

  const checkoutStart = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM journey_events
    WHERE event_type = 'checkout_start' AND created_at > ${since}
  `).get()

  const purchase = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM journey_events
    WHERE event_type = 'purchase' AND created_at > ${since}
  `).get()

  const stages = [
    { stage: 'Landing', count: landing.count },
    { stage: 'Product View', count: productView.count },
    { stage: 'Add to Cart', count: addToCart.count },
    { stage: 'Checkout Start', count: checkoutStart.count },
    { stage: 'Purchase', count: purchase.count }
  ]

  // Add conversion rates between stages
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].count
    const curr = stages[i].count
    stages[i].conversion_rate = prev > 0 ? Math.round((curr / prev) * 100) : 0
    stages[i].drop_off = prev > 0 ? Math.round(((prev - curr) / prev) * 100) : 0
  }

  res.json({ stages, days })
})

// GET /api/customer-journey/paths?days=30&limit=20
// Most common entry page paths (first touch)
router.get('/paths', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  // Entry pages (first event per session)
  const entryPages = db.prepare(`
    SELECT page_path, COUNT(*) as sessions,
           SUM(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) as conversions
    FROM (
      SELECT session_id, page_path, event_type,
             ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at ASC) as rn
      FROM journey_events
      WHERE created_at > datetime('now', '-${days} days')
    )
    WHERE rn = 1
    GROUP BY page_path
    ORDER BY sessions DESC
    LIMIT ?
  `).all(limit)

  entryPages.forEach(p => {
    p.conversion_rate = p.sessions > 0 ? Math.round((p.conversions / p.sessions) * 100) : 0
  })

  res.json({ entry_pages: entryPages, days })
})

// GET /api/customer-journey/sources?days=30
// Traffic sources and UTM breakdown
router.get('/sources', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)

  const sources = db.prepare(`
    SELECT
      CASE
        WHEN utm_source != '' THEN utm_source
        WHEN referrer LIKE '%google%' THEN 'google'
        WHEN referrer LIKE '%facebook%' THEN 'facebook'
        WHEN referrer LIKE '%twitter%' OR referrer LIKE '%t.co%' THEN 'twitter'
        WHEN referrer LIKE '%instagram%' THEN 'instagram'
        WHEN referrer LIKE '%linkedin%' THEN 'linkedin'
        WHEN referrer = '' THEN 'direct'
        ELSE 'referral'
      END as source,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(*) as events
    FROM journey_events
    WHERE event_type = 'page_view' AND created_at > datetime('now', '-${days} days')
    GROUP BY source
    ORDER BY sessions DESC
    LIMIT 20
  `).all()

  const utmCampaigns = db.prepare(`
    SELECT utm_campaign, utm_medium, COUNT(DISTINCT session_id) as sessions
    FROM journey_events
    WHERE utm_campaign != '' AND created_at > datetime('now', '-${days} days')
    GROUP BY utm_campaign, utm_medium
    ORDER BY sessions DESC
    LIMIT 10
  `).all()

  res.json({ sources, utm_campaigns: utmCampaigns, days })
})

// GET /api/customer-journey/sessions?days=7&limit=20
// Recent session journeys (full path per session)
router.get('/sessions', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 30)
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  // Get sessions that ended in purchase
  const convertedSessions = db.prepare(`
    SELECT DISTINCT session_id FROM journey_events
    WHERE event_type = 'purchase'
      AND created_at > datetime('now', '-${days} days')
    LIMIT ?
  `).all(limit)

  const sessions = []
  for (const { session_id } of convertedSessions) {
    const events = db.prepare(`
      SELECT event_type, page_path, entity_slug, created_at
      FROM journey_events
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(session_id)
    if (events.length > 0) {
      sessions.push({
        session_id: session_id.slice(0, 8) + '…',
        events,
        steps: events.length,
        converted: true
      })
    }
  }

  res.json({ sessions, days })
})

// GET /api/customer-journey/summary?days=30
// Quick summary stats
router.get('/summary', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)
  const since = `datetime('now', '-${days} days')`

  const totals = db.prepare(`
    SELECT
      COUNT(DISTINCT session_id) as total_sessions,
      COUNT(*) as total_events,
      COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN session_id END) as conversions,
      COUNT(DISTINCT CASE WHEN customer_id IS NOT NULL THEN session_id END) as logged_in_sessions
    FROM journey_events
    WHERE created_at > ${since}
  `).get()

  totals.conversion_rate = totals.total_sessions > 0
    ? Math.round((totals.conversions / totals.total_sessions) * 100)
    : 0

  // Daily session counts
  const daily = db.prepare(`
    SELECT date(created_at) as date, COUNT(DISTINCT session_id) as sessions,
           COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN session_id END) as conversions
    FROM journey_events
    WHERE created_at > ${since}
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all()

  // Top converting products
  const topProducts = db.prepare(`
    SELECT entity_slug, COUNT(DISTINCT session_id) as views
    FROM journey_events
    WHERE event_type = 'product_view' AND created_at > ${since} AND entity_slug != ''
    GROUP BY entity_slug
    ORDER BY views DESC
    LIMIT 5
  `).all()

  res.json({ totals, daily, top_products: topProducts, days })
})

export default router
