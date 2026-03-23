// Pygmy CMS — Content Calendar API (Phase 33)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/content-calendar?year=&month=
// Returns all content items with publish dates in the given month
router.get('/', authMiddleware, (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear()
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1)

  const pad   = (n) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const end   = `${year}-${pad(month)}-31`

  const posts = db.prepare(`
    SELECT id, title, slug, status, published_at, publish_at,
           'post' AS content_type, cover_image
    FROM posts
    WHERE (
      (status = 'published' AND published_at BETWEEN ? AND ?)
      OR (status = 'scheduled' AND publish_at BETWEEN ? AND ?)
      OR (status = 'draft' AND created_at BETWEEN ? AND ?)
    )
    ORDER BY COALESCE(publish_at, published_at, created_at)
  `).all(start, end, start, end, start, end)

  const pages = db.prepare(`
    SELECT id, title, slug, status, published_at, publish_at,
           'page' AS content_type, NULL AS cover_image
    FROM pages
    WHERE (
      (status = 'published' AND published_at BETWEEN ? AND ?)
      OR (status = 'scheduled' AND publish_at BETWEEN ? AND ?)
      OR (status = 'draft' AND created_at BETWEEN ? AND ?)
    )
    ORDER BY COALESCE(publish_at, published_at, created_at)
  `).all(start, end, start, end, start, end)

  const events = db.prepare(`
    SELECT id, title, slug, status, start_date AS published_at, start_date AS publish_at,
           'event' AS content_type, cover_image
    FROM events
    WHERE start_date BETWEEN ? AND ?
    ORDER BY start_date
  `).all(start, end)

  const products = db.prepare(`
    SELECT id, name AS title, slug, status, created_at AS published_at, NULL AS publish_at,
           'product' AS content_type, cover_image
    FROM products
    WHERE status = 'published' AND created_at BETWEEN ? AND ?
    ORDER BY created_at
  `).all(start, end)

  // Group by date
  const calendar = {}
  const allItems = [...posts, ...pages, ...events, ...products]

  for (const item of allItems) {
    const dateStr = (item.publish_at || item.published_at || '').split('T')[0].split(' ')[0]
    if (!dateStr) continue
    if (!calendar[dateStr]) calendar[dateStr] = []
    calendar[dateStr].push({
      id: item.id,
      title: item.title,
      slug: item.slug,
      status: item.status,
      content_type: item.content_type,
      cover_image: item.cover_image || null,
      date: dateStr,
    })
  }

  // Also return flat list for list view
  const list = allItems.map(item => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    status: item.status,
    content_type: item.content_type,
    cover_image: item.cover_image || null,
    date: (item.publish_at || item.published_at || '').split('T')[0].split(' ')[0],
  })).filter(i => i.date).sort((a, b) => a.date.localeCompare(b.date))

  res.json({ calendar, list, year, month })
})

// GET /api/content-calendar/upcoming?limit=10
// Returns next N upcoming scheduled items
router.get('/upcoming', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50)
  const now = new Date().toISOString().split('T')[0]

  const scheduled = db.prepare(`
    SELECT id, title, slug, 'post' AS content_type, publish_at AS date, status
    FROM posts WHERE status = 'scheduled' AND publish_at >= ?
    UNION ALL
    SELECT id, title, slug, 'page' AS content_type, publish_at AS date, status
    FROM pages WHERE status = 'scheduled' AND publish_at >= ?
    ORDER BY date ASC LIMIT ?
  `).all(now, now, limit)

  res.json({ items: scheduled })
})

export default router
