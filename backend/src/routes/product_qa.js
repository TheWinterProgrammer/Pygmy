// Pygmy CMS — Product Q&A API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ── GET /api/product-qa?product_id= ─────────────────────────────────────────
router.get('/', (req, res) => {
  const { product_id, status, limit = 50, offset = 0 } = req.query
  if (!product_id && !status) return res.status(400).json({ error: 'product_id required' })

  let query = 'WHERE 1=1'
  const params = []

  if (product_id) {
    query += ' AND product_id = ?'
    params.push(product_id)
  }

  // Public: only published; Admin with status param: filter by status
  const isAdmin = !!req.headers.authorization
  if (!isAdmin || !status) {
    query += " AND status = 'published'"
  } else if (status !== 'all') {
    query += ' AND status = ?'
    params.push(status)
  }

  const rows = db.prepare(`
    SELECT id, product_id, question, answer, customer_name, status, is_featured, created_at
    FROM product_qa ${query}
    ORDER BY is_featured DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`SELECT COUNT(*) as n FROM product_qa ${query}`).get(...params)?.n ?? 0

  res.json({ items: rows, total })
})

// ── POST /api/product-qa ─ Public submit question ────────────────────────────
router.post('/', (req, res) => {
  const { product_id, question, customer_name, customer_email } = req.body
  if (!product_id || !question?.trim()) {
    return res.status(400).json({ error: 'product_id and question required' })
  }
  const result = db.prepare(`
    INSERT INTO product_qa (product_id, question, customer_name, customer_email, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(product_id, question.trim(), (customer_name || 'Anonymous').trim(), (customer_email || '').trim())

  res.status(201).json({ id: result.lastInsertRowid, message: 'Question submitted for review' })
})

// ── PUT /api/product-qa/:id ─ Admin: answer + change status ─────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const { answer, status, is_featured, question } = req.body
  const qa = db.prepare('SELECT * FROM product_qa WHERE id = ?').get(req.params.id)
  if (!qa) return res.status(404).json({ error: 'Not found' })

  db.prepare(`
    UPDATE product_qa
    SET answer = ?, status = ?, is_featured = ?, question = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    answer !== undefined ? answer : qa.answer,
    status || qa.status,
    is_featured !== undefined ? (is_featured ? 1 : 0) : qa.is_featured,
    question !== undefined ? question : qa.question,
    req.params.id
  )

  res.json(db.prepare('SELECT * FROM product_qa WHERE id = ?').get(req.params.id))
})

// ── DELETE /api/product-qa/:id ───────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM product_qa WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── GET /api/product-qa/stats ─ Admin stats ──────────────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const total    = db.prepare("SELECT COUNT(*) as n FROM product_qa").get().n
  const pending  = db.prepare("SELECT COUNT(*) as n FROM product_qa WHERE status='pending'").get().n
  const published = db.prepare("SELECT COUNT(*) as n FROM product_qa WHERE status='published'").get().n
  res.json({ total, pending, published })
})

export default router
