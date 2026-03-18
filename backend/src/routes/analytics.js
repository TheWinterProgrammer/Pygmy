// Pygmy CMS — Analytics (page views)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// POST /api/analytics/view — increment view (public, fire-and-forget)
// Body: { entity_type: 'post'|'page'|'product', entity_id, entity_slug, entity_title }
router.post('/view', (req, res) => {
  const { entity_type, entity_id, entity_slug = '', entity_title = '' } = req.body
  if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' })

  db.prepare(`
    INSERT INTO page_views (entity_type, entity_id, entity_slug, entity_title, view_date, count)
    VALUES (?, ?, ?, ?, date('now'), 1)
    ON CONFLICT(entity_type, entity_id, view_date)
    DO UPDATE SET count = count + 1,
                  entity_slug  = excluded.entity_slug,
                  entity_title = excluded.entity_title
  `).run(entity_type, entity_id, entity_slug, entity_title)

  res.json({ ok: true })
})

// GET /api/analytics/top — top pages by views (auth)
// ?days=30&limit=10&type=post|page|product
router.get('/top', authMiddleware, (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365)
  const limit = Math.min(parseInt(req.query.limit) || 10, 50)
  const type = req.query.type || null

  let where = `view_date >= date('now', '-${days} days')`
  const params = []
  if (type) {
    where += ' AND entity_type = ?'
    params.push(type)
  }

  const rows = db.prepare(`
    SELECT entity_type, entity_id, entity_slug, entity_title,
           SUM(count) as total_views
    FROM page_views
    WHERE ${where}
    GROUP BY entity_type, entity_id
    ORDER BY total_views DESC
    LIMIT ${limit}
  `).all(...params)

  res.json(rows)
})

// GET /api/analytics/daily — daily view totals (auth)
// ?days=30&type=post|page|product&entity_id=
router.get('/daily', authMiddleware, (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365)
  const type = req.query.type || null
  const entity_id = req.query.entity_id || null

  let where = `view_date >= date('now', '-${days} days')`
  const params = []
  if (type) { where += ' AND entity_type = ?'; params.push(type) }
  if (entity_id) { where += ' AND entity_id = ?'; params.push(entity_id) }

  const rows = db.prepare(`
    SELECT view_date as date, SUM(count) as views
    FROM page_views
    WHERE ${where}
    GROUP BY view_date
    ORDER BY view_date ASC
  `).all(...params)

  // Fill in zero-view days so charts render smoothly
  const filled = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const found = rows.find(r => r.date === dateStr)
    filled.push({ date: dateStr, views: found ? found.views : 0 })
  }

  res.json(filled)
})

// GET /api/analytics/summary — overall totals for dashboard (auth)
router.get('/summary', authMiddleware, (req, res) => {
  const total = db.prepare('SELECT COALESCE(SUM(count),0) as views FROM page_views').get().views
  const today = db.prepare("SELECT COALESCE(SUM(count),0) as views FROM page_views WHERE view_date = date('now')").get().views
  const week = db.prepare("SELECT COALESCE(SUM(count),0) as views FROM page_views WHERE view_date >= date('now','-7 days')").get().views
  const month = db.prepare("SELECT COALESCE(SUM(count),0) as views FROM page_views WHERE view_date >= date('now','-30 days')").get().views

  // By type
  const byType = db.prepare(`
    SELECT entity_type, COALESCE(SUM(count),0) as views
    FROM page_views
    GROUP BY entity_type
  `).all()

  res.json({ total, today, week, month, byType })
})

export default router
