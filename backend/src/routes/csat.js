// Pygmy CMS — CSAT (Customer Satisfaction) API (Phase 68)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ── Public ────────────────────────────────────────────────────────────────────

// GET /api/csat/config — widget configuration (public)
router.get('/config', (req, res) => {
  const rows = db.prepare(`
    SELECT key, value FROM settings
    WHERE key LIKE 'csat_%'
  `).all()
  const cfg = {}
  for (const r of rows) cfg[r.key] = r.value
  res.json(cfg)
})

// POST /api/csat — submit a rating (public)
router.post('/', (req, res) => {
  const { page_path = '/', rating, comment = '', session_id = '' } = req.body
  if (!rating || isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' })
  }

  // Dedup: same session + path within 24h
  const recent = db.prepare(`
    SELECT id FROM csat_ratings
    WHERE session_id = ? AND page_path = ?
      AND created_at > datetime('now', '-1 day')
  `).get(session_id, page_path)
  if (recent) return res.json({ ok: true, duplicate: true })

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || ''

  db.prepare(`
    INSERT INTO csat_ratings (page_path, rating, comment, session_id, ip)
    VALUES (?, ?, ?, ?, ?)
  `).run(page_path, Number(rating), comment.slice(0, 1000), session_id, ip)

  res.json({ ok: true })
})

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /api/csat — list ratings (admin)
router.get('/', authMiddleware, (req, res) => {
  const { page_path, days = 30, limit = 50, offset = 0 } = req.query
  const since = `datetime('now', '-${Math.min(Number(days), 365)} days')`

  let where = `WHERE created_at > ${since}`
  const params = []
  if (page_path) { where += ' AND page_path = ?'; params.push(page_path) }

  const rows = db.prepare(`
    SELECT * FROM csat_ratings
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`SELECT COUNT(*) as c FROM csat_ratings ${where}`).get(...params).c

  res.json({ ratings: rows, total })
})

// GET /api/csat/summary — analytics (admin)
router.get('/summary', authMiddleware, (req, res) => {
  const { days = 30 } = req.query
  const since = `datetime('now', '-${Math.min(Number(days), 365)} days')`

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(rating) as avg_rating,
      SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN comment != '' THEN 1 ELSE 0 END) as with_comment
    FROM csat_ratings
    WHERE created_at > ${since}
  `).get()

  // Daily breakdown
  const daily = db.prepare(`
    SELECT date(created_at) as day,
           COUNT(*) as total,
           AVG(rating) as avg_rating,
           SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive
    FROM csat_ratings
    WHERE created_at > ${since}
    GROUP BY day
    ORDER BY day ASC
  `).all()

  // Top pages by volume
  const topPages = db.prepare(`
    SELECT page_path,
           COUNT(*) as total,
           AVG(rating) as avg_rating,
           SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
           SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative
    FROM csat_ratings
    WHERE created_at > ${since}
    GROUP BY page_path
    ORDER BY total DESC
    LIMIT 20
  `).all()

  // Rating distribution
  const distribution = db.prepare(`
    SELECT rating, COUNT(*) as count
    FROM csat_ratings
    WHERE created_at > ${since}
    GROUP BY rating
    ORDER BY rating DESC
  `).all()

  // Recent comments
  const recentComments = db.prepare(`
    SELECT id, page_path, rating, comment, created_at
    FROM csat_ratings
    WHERE created_at > ${since} AND comment != ''
    ORDER BY created_at DESC
    LIMIT 20
  `).all()

  res.json({
    totals,
    daily,
    topPages,
    distribution,
    recentComments,
    satisfaction_score: totals.total > 0
      ? Math.round((totals.positive / totals.total) * 100)
      : null
  })
})

// DELETE /api/csat/:id — delete a rating (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM csat_ratings WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
