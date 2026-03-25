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
    SELECT id, author_name, rating, title, body, photos, admin_reply, admin_reply_at, created_at
    FROM product_reviews
    WHERE product_id = ? AND status = 'approved'
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(product_id), parseInt(limit), parseInt(offset))

  reviews.forEach(r => { try { r.photos = JSON.parse(r.photos || '[]') } catch { r.photos = [] } })

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

  // Accept optional photos array (URLs from already-uploaded media)
  const photosRaw = req.body.photos
  let photosJson = '[]'
  if (Array.isArray(photosRaw) && photosRaw.length > 0) {
    const maxPhotos = parseInt(settings.review_photos_max || '3')
    photosJson = JSON.stringify(photosRaw.slice(0, maxPhotos))
  }

  const result = db.prepare(`
    INSERT INTO product_reviews (product_id, author_name, author_email, rating, title, body, status, photos)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id,
    author_name.trim(),
    (author_email || '').trim().toLowerCase(),
    ratingNum,
    (title || '').trim(),
    body.trim(),
    status,
    photosJson,
  )

  res.status(201).json({
    ok: true,
    status,
    message: status === 'approved'
      ? 'Thank you for your review!'
      : 'Thank you! Your review has been submitted and will appear after approval.',
  })
})

// ─── Admin: Review analytics ─────────────────────────────────────────────────
// GET /api/reviews/analytics?days=30
router.get('/analytics', authMiddleware, (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365)

  // Overall stats
  const overall = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected,
      ROUND(AVG(CASE WHEN status='approved' THEN rating END), 2) as avg_rating,
      SUM(CASE WHEN status='approved' AND rating=5 THEN 1 ELSE 0 END) as r5,
      SUM(CASE WHEN status='approved' AND rating=4 THEN 1 ELSE 0 END) as r4,
      SUM(CASE WHEN status='approved' AND rating=3 THEN 1 ELSE 0 END) as r3,
      SUM(CASE WHEN status='approved' AND rating=2 THEN 1 ELSE 0 END) as r2,
      SUM(CASE WHEN status='approved' AND rating=1 THEN 1 ELSE 0 END) as r1
    FROM product_reviews
  `).get()

  // Daily review submissions for the period
  const daily = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count,
           ROUND(AVG(rating), 2) as avg_rating
    FROM product_reviews
    WHERE created_at >= datetime('now', ? || ' days')
    GROUP BY day
    ORDER BY day ASC
  `).all(`-${days}`)

  // Top rated products (min 3 reviews)
  const topProducts = db.prepare(`
    SELECT p.id, p.name, p.slug, p.cover_image,
           COUNT(r.id) as review_count,
           ROUND(AVG(r.rating), 2) as avg_rating
    FROM product_reviews r
    JOIN products p ON r.product_id = p.id
    WHERE r.status = 'approved'
    GROUP BY r.product_id
    HAVING review_count >= 1
    ORDER BY avg_rating DESC, review_count DESC
    LIMIT 10
  `).all()

  // Lowest rated products (min 2 reviews)
  const worstProducts = db.prepare(`
    SELECT p.id, p.name, p.slug,
           COUNT(r.id) as review_count,
           ROUND(AVG(r.rating), 2) as avg_rating
    FROM product_reviews r
    JOIN products p ON r.product_id = p.id
    WHERE r.status = 'approved'
    GROUP BY r.product_id
    HAVING review_count >= 2
    ORDER BY avg_rating ASC, review_count DESC
    LIMIT 5
  `).all()

  // Recent period stats
  const period = db.prepare(`
    SELECT COUNT(*) as count, ROUND(AVG(rating), 2) as avg_rating
    FROM product_reviews
    WHERE status = 'approved' AND created_at >= datetime('now', ? || ' days')
  `).get(`-${days}`)

  res.json({ overall, daily, topProducts, worstProducts, period })
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

// ─── Admin: Export reviews as CSV ─────────────────────────────────────────────
// GET /api/reviews/export/csv?status=approved
router.get('/export/csv', authMiddleware, (req, res) => {
  const { status } = req.query
  let sql = `
    SELECT r.id, r.author_name, r.author_email, r.rating, r.title, r.body, r.status, r.created_at,
           p.name as product_name, p.slug as product_slug
    FROM product_reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE 1=1
  `
  const params = []
  if (status) { sql += ' AND r.status = ?'; params.push(status) }
  sql += ' ORDER BY r.created_at DESC LIMIT 5000'
  const rows = db.prepare(sql).all(...params)

  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const headers = ['id', 'product_name', 'product_slug', 'author_name', 'author_email', 'rating', 'title', 'body', 'status', 'created_at']
  const csv = [
    headers.join(','),
    ...rows.map(r => [r.id, r.product_name, r.product_slug, r.author_name, r.author_email, r.rating, r.title, r.body, r.status, r.created_at].map(esc).join(','))
  ].join('\n')

  const date = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="reviews-${date}.csv"`)
  res.send(csv)
})

export default router


// ─── Admin: Reply to a review ────────────────────────────────────────────────
// POST /api/reviews/:id/reply { reply }
router.post('/:id/reply', authMiddleware, (req, res) => {
  const review = db.prepare('SELECT * FROM product_reviews WHERE id = ?').get(req.params.id)
  if (!review) return res.status(404).json({ error: 'Review not found' })

  const { reply } = req.body
  if (!reply || !reply.trim()) return res.status(400).json({ error: 'Reply text required' })

  db.prepare(`
    UPDATE product_reviews SET admin_reply = ?, admin_reply_at = datetime('now') WHERE id = ?
  `).run(reply.trim(), review.id)

  res.json({ ok: true })
})

// DELETE /api/reviews/:id/reply — remove admin reply
router.delete('/:id/reply', authMiddleware, (req, res) => {
  db.prepare(`UPDATE product_reviews SET admin_reply = '', admin_reply_at = NULL WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})
