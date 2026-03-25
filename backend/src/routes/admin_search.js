// Pygmy CMS — Admin Global Search API (Phase 68)
// Searches live content across posts, pages, products, orders, customers, media
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/admin-search?q=<term>&limit=5 — admin global search
router.get('/', authMiddleware, (req, res) => {
  const q = (req.query.q || '').trim()
  const limit = Math.min(Number(req.query.limit) || 5, 20)

  if (!q || q.length < 2) {
    return res.json({ posts: [], pages: [], products: [], orders: [], customers: [], media: [] })
  }

  const pattern = `%${q}%`

  // Posts
  const posts = db.prepare(`
    SELECT id, title, slug, status
    FROM posts
    WHERE title LIKE ? OR excerpt LIKE ?
    ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, created_at DESC
    LIMIT ?
  `).all(pattern, pattern, limit)

  // Pages
  const pages = db.prepare(`
    SELECT id, title, slug, status
    FROM pages
    WHERE title LIKE ?
    ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, sort_order ASC
    LIMIT ?
  `).all(pattern, limit)

  // Products
  const products = db.prepare(`
    SELECT id, name AS title, slug, status, cover_image, price
    FROM products
    WHERE name LIKE ? OR sku LIKE ? OR excerpt LIKE ?
    ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, created_at DESC
    LIMIT ?
  `).all(pattern, pattern, pattern, limit)

  // Orders — by number or customer email/name
  const orders = db.prepare(`
    SELECT id, order_number, customer_name, customer_email, status, total
    FROM orders
    WHERE order_number LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(pattern, pattern, pattern, limit)

  // Customers
  const customers = db.prepare(`
    SELECT id, first_name || ' ' || COALESCE(last_name,'') AS title, email AS subtitle
    FROM customers
    WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(pattern, pattern, pattern, limit)

  // Media
  const media = db.prepare(`
    SELECT id, original_name AS title, url, mime_type
    FROM media
    WHERE original_name LIKE ? OR alt_text LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(pattern, pattern, limit)

  res.json({ posts, pages, products, orders, customers, media })
})

export default router
