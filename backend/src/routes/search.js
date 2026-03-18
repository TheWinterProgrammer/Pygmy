// Pygmy CMS — Full-text search
// GET /api/search?q=<term>&limit=10
// Searches published posts (title, excerpt, content) and published pages (title, content)

import { Router } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim()
  const limit = Math.min(Number(req.query.limit) || 10, 50)

  if (!q || q.length < 2) {
    return res.json({ posts: [], pages: [] })
  }

  const pattern = `%${q}%`

  // Search posts (published only)
  const posts = db.prepare(`
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.published_at,
           c.name as category_name, c.slug as category_slug
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'published'
      AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)
    ORDER BY
      CASE WHEN p.title LIKE ? THEN 0 ELSE 1 END,
      p.published_at DESC
    LIMIT ?
  `).all(pattern, pattern, pattern, pattern, limit)

  // Search pages (published only)
  const pages = db.prepare(`
    SELECT id, title, slug, meta_desc
    FROM pages
    WHERE status = 'published'
      AND (title LIKE ? OR content LIKE ?)
    ORDER BY
      CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
      sort_order ASC
    LIMIT ?
  `).all(pattern, pattern, pattern, limit)

  // Search products (published only)
  const products = db.prepare(`
    SELECT p.id, p.name AS title, p.slug, p.excerpt, p.cover_image, p.price, p.sale_price,
           pc.name AS category_name
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE p.status = 'published'
      AND (p.name LIKE ? OR p.excerpt LIKE ? OR p.description LIKE ?)
    ORDER BY
      CASE WHEN p.name LIKE ? THEN 0 ELSE 1 END,
      p.created_at DESC
    LIMIT ?
  `).all(pattern, pattern, pattern, pattern, limit)

  res.json({ posts, pages, products, query: q })
})

export default router
