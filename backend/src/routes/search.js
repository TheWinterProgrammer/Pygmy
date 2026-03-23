// Pygmy CMS — Full-text search
// GET /api/search?q=<term>&limit=10&type=posts|pages|products|events&sort=relevance|date|name
// Searches published posts (title, excerpt, content) and published pages (title, content)

import { Router } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim()
  const limit = Math.min(Number(req.query.limit) || 10, 50)
  const type = req.query.type || 'all'   // all | posts | pages | products | events
  const sort = req.query.sort || 'relevance'  // relevance | date | name
  const session_id = req.query.session_id || null

  if (!q || q.length < 2) {
    return res.json({ posts: [], pages: [], products: [], events: [], query: q })
  }

  const pattern = `%${q}%`

  const sortPosts      = sort === 'date' ? 'p.published_at DESC' : sort === 'name' ? 'p.title ASC' : 'CASE WHEN p.title LIKE ? THEN 0 ELSE 1 END, p.published_at DESC'
  const sortPages      = sort === 'date' ? 'p.updated_at DESC'  : sort === 'name' ? 'p.title ASC' : 'CASE WHEN p.title LIKE ? THEN 0 ELSE 1 END, p.sort_order ASC'
  const sortProducts   = sort === 'date' ? 'p.created_at DESC'  : sort === 'name' ? 'p.name ASC'  : 'CASE WHEN p.name LIKE ? THEN 0 ELSE 1 END, p.created_at DESC'
  const sortEvents     = sort === 'date' ? 'e.start_date DESC'  : sort === 'name' ? 'e.title ASC' : 'CASE WHEN e.title LIKE ? THEN 0 ELSE 1 END, e.start_date ASC'
  const hasRelevance   = sort === 'relevance'

  // Search posts (published only)
  const posts = (type === 'all' || type === 'posts') ? db.prepare(`
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.published_at,
           c.name as category_name, c.slug as category_slug
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'published'
      AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)
    ORDER BY ${sortPosts}
    LIMIT ?
  `).all(...(hasRelevance ? [pattern, pattern, pattern, pattern, limit] : [pattern, pattern, pattern, limit])) : []

  // Search pages (published only)
  const pages = (type === 'all' || type === 'pages') ? db.prepare(`
    SELECT p.id, p.title, p.slug, p.meta_desc, p.updated_at
    FROM pages p
    WHERE p.status = 'published'
      AND (p.title LIKE ? OR p.content LIKE ?)
    ORDER BY ${sortPages}
    LIMIT ?
  `).all(...(hasRelevance ? [pattern, pattern, pattern, limit] : [pattern, pattern, limit])) : []

  // Search products (published only)
  const products = (type === 'all' || type === 'products') ? db.prepare(`
    SELECT p.id, p.name AS title, p.slug, p.excerpt, p.cover_image, p.price, p.sale_price,
           pc.name AS category_name
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE p.status = 'published'
      AND (p.name LIKE ? OR p.excerpt LIKE ? OR p.description LIKE ?)
    ORDER BY ${sortProducts}
    LIMIT ?
  `).all(...(hasRelevance ? [pattern, pattern, pattern, pattern, limit] : [pattern, pattern, pattern, limit])) : []

  // Search events (published only)
  const events = (type === 'all' || type === 'events') ? db.prepare(`
    SELECT e.id, e.title, e.slug, e.excerpt, e.cover_image, e.start_date, e.end_date, e.location, e.venue
    FROM events e
    WHERE e.status = 'published'
      AND (e.title LIKE ? OR e.excerpt LIKE ? OR e.description LIKE ? OR e.location LIKE ?)
    ORDER BY ${sortEvents}
    LIMIT ?
  `).all(...(hasRelevance ? [pattern, pattern, pattern, pattern, pattern, limit] : [pattern, pattern, pattern, pattern, limit])) : []

  const totalResults = posts.length + pages.length + products.length + events.length

  // Track search asynchronously (non-blocking)
  try {
    db.prepare(`
      INSERT INTO search_queries (query, results_count, session_id, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(q.toLowerCase(), totalResults, session_id)
  } catch (_) {}

  res.json({ posts, pages, products, events, query: q, total: totalResults, type, sort })
})

export default router
