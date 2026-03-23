// Pygmy CMS — Search Analytics API (Phase 34)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Public: Track a search ───────────────────────────────────────────────────
// POST /api/search-analytics/track  { query, results_count, session_id? }
router.post('/track', (req, res) => {
  const { query, results_count = 0, session_id = null, clicked_slug = null, clicked_type = null } = req.body
  if (!query || query.trim().length < 2) return res.json({ ok: true })

  db.prepare(`
    INSERT INTO search_queries (query, results_count, clicked_slug, clicked_type, session_id, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(query.trim().toLowerCase(), results_count, clicked_slug, clicked_type, session_id)

  res.json({ ok: true })
})

// ─── Public: Record click on a search result ──────────────────────────────────
// POST /api/search-analytics/click  { query, slug, type, session_id? }
router.post('/click', (req, res) => {
  const { query, slug, type, session_id } = req.body
  if (!query || !slug) return res.status(400).json({ error: 'query and slug required' })

  // Update the most recent search for this session/query with the clicked item
  const row = session_id
    ? db.prepare(`SELECT id FROM search_queries WHERE query = ? AND session_id = ? ORDER BY created_at DESC LIMIT 1`).get(query.toLowerCase(), session_id)
    : db.prepare(`SELECT id FROM search_queries WHERE query = ? ORDER BY created_at DESC LIMIT 1`).get(query.toLowerCase())

  if (row) {
    db.prepare('UPDATE search_queries SET clicked_slug = ?, clicked_type = ? WHERE id = ?').run(slug, type || null, row.id)
  }

  res.json({ ok: true })
})

// ─── Admin: Search analytics summary ──────────────────────────────────────────
// GET /api/search-analytics/summary?days=30
router.get('/summary', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM search_queries WHERE created_at >= datetime('now', '-${days} days')`).get().cnt
  const withResults = db.prepare(`SELECT COUNT(*) as cnt FROM search_queries WHERE results_count > 0 AND created_at >= datetime('now', '-${days} days')`).get().cnt
  const zeroResults = db.prepare(`SELECT COUNT(*) as cnt FROM search_queries WHERE results_count = 0 AND created_at >= datetime('now', '-${days} days')`).get().cnt
  const clicked = db.prepare(`SELECT COUNT(*) as cnt FROM search_queries WHERE clicked_slug IS NOT NULL AND created_at >= datetime('now', '-${days} days')`).get().cnt
  const uniqueQueries = db.prepare(`SELECT COUNT(DISTINCT query) as cnt FROM search_queries WHERE created_at >= datetime('now', '-${days} days')`).get().cnt

  res.json({
    total,
    with_results: withResults,
    zero_results: zeroResults,
    clicked,
    unique_queries: uniqueQueries,
    click_through_rate: total > 0 ? ((clicked / total) * 100).toFixed(1) : '0.0',
    zero_result_rate: total > 0 ? ((zeroResults / total) * 100).toFixed(1) : '0.0',
    days,
  })
})

// ─── Admin: Top queries ────────────────────────────────────────────────────────
// GET /api/search-analytics/top?days=30&limit=20
router.get('/top', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const queries = db.prepare(`
    SELECT
      query,
      COUNT(*) as searches,
      SUM(CASE WHEN results_count = 0 THEN 1 ELSE 0 END) as no_result_count,
      SUM(CASE WHEN clicked_slug IS NOT NULL THEN 1 ELSE 0 END) as clicks,
      AVG(results_count) as avg_results,
      MAX(created_at) as last_searched_at
    FROM search_queries
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY query
    ORDER BY searches DESC
    LIMIT ?
  `).all(limit)

  res.json({ queries, days })
})

// ─── Admin: Zero-result queries ────────────────────────────────────────────────
// GET /api/search-analytics/zero-results?days=30&limit=20
router.get('/zero-results', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const queries = db.prepare(`
    SELECT query, COUNT(*) as searches, MAX(created_at) as last_searched_at
    FROM search_queries
    WHERE results_count = 0 AND created_at >= datetime('now', '-${days} days')
    GROUP BY query
    ORDER BY searches DESC
    LIMIT ?
  `).all(limit)

  res.json({ queries, days })
})

// ─── Admin: Daily search volume ────────────────────────────────────────────────
// GET /api/search-analytics/daily?days=30
router.get('/daily', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)

  const rows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as searches,
           SUM(CASE WHEN results_count = 0 THEN 1 ELSE 0 END) as zero_results
    FROM search_queries
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all()

  // Fill gaps with 0s
  const map = new Map(rows.map(r => [r.date, r]))
  const filled = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    filled.push(map.get(key) || { date: key, searches: 0, zero_results: 0 })
  }

  res.json({ daily: filled, days })
})

// ─── Admin: Popular click-throughs ────────────────────────────────────────────
// GET /api/search-analytics/clicks?days=30
router.get('/clicks', authMiddleware, (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365)

  const rows = db.prepare(`
    SELECT clicked_slug, clicked_type, COUNT(*) as clicks
    FROM search_queries
    WHERE clicked_slug IS NOT NULL AND created_at >= datetime('now', '-${days} days')
    GROUP BY clicked_slug, clicked_type
    ORDER BY clicks DESC
    LIMIT 20
  `).all()

  res.json({ clicks: rows, days })
})

// ─── Public: Search suggestions (autocomplete) ────────────────────────────────
// GET /api/search-analytics/suggestions?q=foo&limit=5
router.get('/suggestions', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase()
  const limit = Math.min(Number(req.query.limit) || 5, 15)
  if (q.length < 2) return res.json({ suggestions: [] })

  const rows = db.prepare(`
    SELECT query, COUNT(*) as freq
    FROM search_queries
    WHERE query LIKE ? AND results_count > 0
    GROUP BY query
    ORDER BY freq DESC
    LIMIT ?
  `).all(`${q}%`, limit)

  res.json({ suggestions: rows.map(r => r.query) })
})

export default router
