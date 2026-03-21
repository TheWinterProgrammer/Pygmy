// Pygmy CMS — Product Reviews API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()

// ─── Public: Get approved reviews for a product ───────────────────────────────
// GET /api/reviews?product_id=5
router.get('/', (req, res) => {
  const { product_id, limit = 20, offset = 0 } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const reviews = db.prepare(`
    SELECT id, author_name, rating, title, body, created_at
    FROM product_reviews
    WHERE product_id = ? AND status = 'approved'
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(product_id), parseInt(limit), parseInt(offset))

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      ROUND(AVG(rating), 1) as avg_rating,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as r5,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as r4,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as r3,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as r2,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as r1
    FROM product_reviews
    WHERE product_id = ? AND status = 'approved'
  `).get(parseInt(product_id))

  res.json({ reviews, stats })
})

// ─── Public: Submit a review ──────────────────────────────────────────────────
// POST /api/reviews
router.post('/', (req, res) => {
  const { product_id, author_name, author_email = '', rating = 5, title = '', body = '' } = req.body

  if (!product_id) return res.status(400).json({ error: 'product_id is required' })
  if (!author_name?.trim()) return res.status(400).json({ error: 'Name is required' })
  if (!body?.trim()) return res.status(400).json({ error: 'Review text is required' })

  const ratingNum = Math.min(5, Math.max(1, parseInt(rating) || 5))

  // Check the product exists
  const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(parseInt(product_id))
  if (!product) return res.status(404).json({ error: 'Product not found' })

  // Check if reviews are enabled
  const settingsRows = db.prepare(`SELECT key, value FROM settings WHERE key IN ('reviews_enabled', 'reviews_require_approval')`).all()
  const settings = {}
  settingsRows.forEach(r => (settings[r.key] = r.value))
  if (settings.reviews_enabled === '0') {
    return res.status(403).json({ error: 'Reviews are currently disabled.' })
  }

  const status = settings.reviews_require_approval === '0' ? 'approved' : 'pending'

  const result = db.prepare(`
    INSERT INTO product_reviews (product_id, author_name, author_email, rating, title, body, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id,
    author_name.trim(),
    (author_email || '').trim().toLowerCase(),
    ratingNum,
    (title || '').trim(),
    body.trim(),
    status,
  )

  res.status(201).json({
    ok: true,
    status,
    message: status === 'approved'
      ? 'Thank you for your review!'
      : 'Thank you! Your review has been submitted and will appear after approval.',
  })
})

// ─── Admin: List all reviews ──────────────────────────────────────────────────
// GET /api/reviews/admin
router.get('/admin', authMiddleware, (req, res) => {
  const { status, product_id, limit = 50, offset = 0 } = req.query
  let sql = `
    SELECT r.*, p.name as product_name, p.slug as product_slug
    FROM product_reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE 1=1
  `
  const params = []
  if (status) { sql += ' AND r.status = ?'; params.push(status) }
  if (product_id) { sql += ' AND r.product_id = ?'; params.push(parseInt(product_id)) }
  sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  const reviews = db.prepare(sql).all(...params)

  const count = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending
    FROM product_reviews
  `).get()

  res.json({ reviews, ...count })
})

// ─── Admin: Update review status ──────────────────────────────────────────────
// PUT /api/reviews/:id
router.put('/:id', authMiddleware, (req, res) => {
  const review = db.prepare('SELECT * FROM product_reviews WHERE id = ?').get(req.params.id)
  if (!review) return res.status(404).json({ error: 'Review not found' })

  const { status } = req.body
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be pending, approved, or rejected' })
  }

  db.prepare('UPDATE product_reviews SET status = ? WHERE id = ?').run(status, review.id)
  logActivity(req.user?.id, `review_${status}`, 'review', review.id, `Review by ${review.author_name} — ${status}`)
  res.json(db.prepare('SELECT * FROM product_reviews WHERE id = ?').get(review.id))
})

// ─── Admin: Delete review ─────────────────────────────────────────────────────
// DELETE /api/reviews/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const review = db.prepare('SELECT * FROM product_reviews WHERE id = ?').get(req.params.id)
  if (!review) return res.status(404).json({ error: 'Review not found' })
  db.prepare('DELETE FROM product_reviews WHERE id = ?').run(review.id)
  res.json({ ok: true })
})

export default router
