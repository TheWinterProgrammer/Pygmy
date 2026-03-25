// Pygmy CMS — Scheduled Content Queue API (Phase 68)
// Returns a unified list of all scheduled posts, pages, and products
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// GET /api/scheduled-queue — unified list of upcoming scheduled content
router.get('/', auth, (req, res) => {
  const { type, limit = 50 } = req.query
  const lim = Math.min(Number(limit) || 50, 200)

  const now = new Date().toISOString()

  let posts = []
  let pages = []
  let products = []

  if (!type || type === 'post') {
    posts = db.prepare(`
      SELECT id, 'post' AS entity_type, title, slug, status, publish_at AS scheduled_at, created_at,
             (SELECT name FROM users WHERE id = posts.author_id) AS author_name
      FROM posts
      WHERE status = 'scheduled' AND publish_at IS NOT NULL
      ORDER BY publish_at ASC
      LIMIT ?
    `).all(lim)
  }

  if (!type || type === 'page') {
    pages = db.prepare(`
      SELECT id, 'page' AS entity_type, title, slug, status, publish_at AS scheduled_at, created_at,
             NULL AS author_name
      FROM pages
      WHERE status = 'scheduled' AND publish_at IS NOT NULL
      ORDER BY publish_at ASC
      LIMIT ?
    `).all(lim)
  }

  if (!type || type === 'product') {
    products = db.prepare(`
      SELECT id, 'product' AS entity_type, name AS title, slug, status, publish_at AS scheduled_at, created_at,
             NULL AS author_name
      FROM products
      WHERE status = 'scheduled' AND publish_at IS NOT NULL
      ORDER BY publish_at ASC
      LIMIT ?
    `).all(lim)
  }

  // Merge and sort by scheduled_at
  const all = [...posts, ...pages, ...products]
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, lim)

  // Stats
  const stats = {
    posts: posts.length,
    pages: pages.length,
    products: products.length,
    total: posts.length + pages.length + products.length,
    overdue: all.filter(i => i.scheduled_at < now).length,
    upcoming_24h: all.filter(i => {
      const d = new Date(i.scheduled_at)
      const h24 = new Date(Date.now() + 24 * 60 * 60 * 1000)
      return d >= new Date() && d <= h24
    }).length,
  }

  res.json({ items: all, stats })
})

// POST /api/scheduled-queue/publish-now — force-publish a scheduled item immediately
router.post('/publish-now', auth, (req, res) => {
  const { entity_type, id } = req.body
  if (!entity_type || !id) return res.status(400).json({ error: 'entity_type and id required' })

  const now = new Date().toISOString()

  if (entity_type === 'post') {
    const post = db.prepare("SELECT id FROM posts WHERE id = ? AND status = 'scheduled'").get(id)
    if (!post) return res.status(404).json({ error: 'Scheduled post not found' })
    db.prepare("UPDATE posts SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?").run(now, now, id)
  } else if (entity_type === 'page') {
    const page = db.prepare("SELECT id FROM pages WHERE id = ? AND status = 'scheduled'").get(id)
    if (!page) return res.status(404).json({ error: 'Scheduled page not found' })
    db.prepare("UPDATE pages SET status = 'published', updated_at = ? WHERE id = ?").run(now, id)
  } else if (entity_type === 'product') {
    const product = db.prepare("SELECT id FROM products WHERE id = ? AND status = 'scheduled'").get(id)
    if (!product) return res.status(404).json({ error: 'Scheduled product not found' })
    db.prepare("UPDATE products SET status = 'published', updated_at = ? WHERE id = ?").run(now, id)
  } else {
    return res.status(400).json({ error: 'entity_type must be post, page, or product' })
  }

  res.json({ ok: true, message: 'Published immediately' })
})

// POST /api/scheduled-queue/unschedule — move back to draft
router.post('/unschedule', auth, (req, res) => {
  const { entity_type, id } = req.body
  if (!entity_type || !id) return res.status(400).json({ error: 'entity_type and id required' })

  const now = new Date().toISOString()

  if (entity_type === 'post') {
    db.prepare("UPDATE posts SET status = 'draft', publish_at = NULL, updated_at = ? WHERE id = ? AND status = 'scheduled'").run(now, id)
  } else if (entity_type === 'page') {
    db.prepare("UPDATE pages SET status = 'draft', publish_at = NULL, updated_at = ? WHERE id = ? AND status = 'scheduled'").run(now, id)
  } else if (entity_type === 'product') {
    db.prepare("UPDATE products SET status = 'draft', publish_at = NULL, updated_at = ? WHERE id = ? AND status = 'scheduled'").run(now, id)
  } else {
    return res.status(400).json({ error: 'entity_type must be post, page, or product' })
  }

  res.json({ ok: true, message: 'Moved back to draft' })
})

// POST /api/scheduled-queue/reschedule — change the scheduled date
router.post('/reschedule', auth, (req, res) => {
  const { entity_type, id, publish_at } = req.body
  if (!entity_type || !id || !publish_at) {
    return res.status(400).json({ error: 'entity_type, id, and publish_at required' })
  }

  // Validate publish_at is a valid date
  const d = new Date(publish_at)
  if (isNaN(d.getTime())) return res.status(400).json({ error: 'publish_at must be a valid ISO date' })

  const now = new Date().toISOString()
  const isoDate = d.toISOString()

  if (entity_type === 'post') {
    db.prepare("UPDATE posts SET publish_at = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'").run(isoDate, now, id)
  } else if (entity_type === 'page') {
    db.prepare("UPDATE pages SET publish_at = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'").run(isoDate, now, id)
  } else if (entity_type === 'product') {
    db.prepare("UPDATE products SET publish_at = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'").run(isoDate, now, id)
  } else {
    return res.status(400).json({ error: 'entity_type must be post, page, or product' })
  }

  res.json({ ok: true, message: 'Rescheduled', publish_at: isoDate })
})

// POST /api/scheduled-queue/bulk-publish — publish multiple items at once
router.post('/bulk-publish', auth, (req, res) => {
  const { items } = req.body // [{ entity_type, id }]
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items array required' })
  }

  const now = new Date().toISOString()
  let published = 0
  let skipped = 0

  const tx = db.transaction(() => {
    for (const { entity_type, id } of items) {
      if (!entity_type || !id) { skipped++; continue }

      let rows = 0
      if (entity_type === 'post') {
        rows = db.prepare("UPDATE posts SET status='published', published_at=?, updated_at=? WHERE id=? AND status='scheduled'").run(now, now, id).changes
      } else if (entity_type === 'page') {
        rows = db.prepare("UPDATE pages SET status='published', updated_at=? WHERE id=? AND status='scheduled'").run(now, id).changes
      } else if (entity_type === 'product') {
        rows = db.prepare("UPDATE products SET status='published', updated_at=? WHERE id=? AND status='scheduled'").run(now, id).changes
      }

      if (rows > 0) published++
      else skipped++
    }
  })

  tx()
  res.json({ ok: true, published, skipped })
})

export default router
