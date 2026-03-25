// Pygmy CMS — Customer Feedback Board API (Phase 74)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ── Public endpoints ──────────────────────────────────────────────────────────

// GET /api/feedback — public list
router.get('/', (req, res) => {
  const { category, status, sort = 'votes', limit = 20, offset = 0 } = req.query
  let where = []
  const params = []

  // Public only sees open/planned/in-progress/completed (not rejected/archived)
  const isAdmin = req.headers.authorization?.startsWith('Bearer ')
  if (!isAdmin) {
    where.push(`f.status != 'archived'`)
  }

  if (category) { where.push('f.category = ?'); params.push(category) }
  if (status)   { where.push('f.status = ?');   params.push(status) }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const orderMap = {
    votes: 'f.votes DESC, f.created_at DESC',
    newest: 'f.created_at DESC',
    oldest: 'f.created_at ASC',
    status: 'f.status ASC, f.votes DESC',
  }
  const orderClause = orderMap[sort] || orderMap.votes

  const items = db.prepare(`
    SELECT f.*, 
      CASE WHEN f.is_pinned = 1 THEN 0 ELSE 1 END as pin_order
    FROM feedback_items f
    ${whereClause}
    ORDER BY pin_order ASC, ${orderClause}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM feedback_items f ${whereClause}
  `).get(...params)?.c || 0

  // Stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(votes) as total_votes
    FROM feedback_items
  `).get()

  const categories = db.prepare(`
    SELECT category, COUNT(*) as count FROM feedback_items GROUP BY category ORDER BY count DESC
  `).all()

  res.json({ items, total, stats, categories })
})

// GET /api/feedback/:id
router.get('/:id', (req, res) => {
  const item = db.prepare(`SELECT * FROM feedback_items WHERE id = ?`).get(req.params.id)
  if (!item) return res.status(404).json({ error: 'Not found' })
  res.json(item)
})

// POST /api/feedback — submit new feedback
router.post('/', (req, res) => {
  const { title, description, category = 'general', customer_name = 'Anonymous', customer_email = '', customer_id } = req.body
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' })

  const info = db.prepare(`
    INSERT INTO feedback_items (title, description, category, customer_name, customer_email, customer_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title.trim(), (description || '').trim(), category, customer_name, customer_email, customer_id || null)

  const item = db.prepare(`SELECT * FROM feedback_items WHERE id = ?`).get(info.lastInsertRowid)
  res.status(201).json(item)
})

// POST /api/feedback/:id/vote — vote on feedback
router.post('/:id/vote', (req, res) => {
  const { voter_session, voter_email = '' } = req.body
  if (!voter_session) return res.status(400).json({ error: 'voter_session required' })

  const item = db.prepare(`SELECT * FROM feedback_items WHERE id = ?`).get(req.params.id)
  if (!item) return res.status(404).json({ error: 'Not found' })

  // Check if already voted
  const existing = db.prepare(`
    SELECT id FROM feedback_votes WHERE feedback_id = ? AND voter_session = ?
  `).get(req.params.id, voter_session)

  if (existing) {
    // Un-vote
    db.prepare(`DELETE FROM feedback_votes WHERE feedback_id = ? AND voter_session = ?`).run(req.params.id, voter_session)
    db.prepare(`UPDATE feedback_items SET votes = MAX(0, votes - 1), updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
    return res.json({ voted: false, votes: Math.max(0, item.votes - 1) })
  } else {
    // Vote
    db.prepare(`INSERT OR IGNORE INTO feedback_votes (feedback_id, voter_session, voter_email) VALUES (?, ?, ?)`).run(req.params.id, voter_session, voter_email)
    db.prepare(`UPDATE feedback_items SET votes = votes + 1, updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
    return res.json({ voted: true, votes: item.votes + 1 })
  }
})

// POST /api/feedback/:id/check-vote — check if session voted
router.post('/:id/check-vote', (req, res) => {
  const { voter_session } = req.body
  if (!voter_session) return res.json({ voted: false })
  const v = db.prepare(`SELECT id FROM feedback_votes WHERE feedback_id = ? AND voter_session = ?`).get(req.params.id, voter_session)
  res.json({ voted: !!v })
})

// ── Admin endpoints ───────────────────────────────────────────────────────────

// PUT /api/feedback/:id — admin update (status, admin_response, pin)
router.put('/:id', authMiddleware, (req, res) => {
  const { status, admin_response, is_pinned, title, description, category } = req.body
  const item = db.prepare(`SELECT * FROM feedback_items WHERE id = ?`).get(req.params.id)
  if (!item) return res.status(404).json({ error: 'Not found' })

  db.prepare(`
    UPDATE feedback_items SET
      status = COALESCE(?, status),
      admin_response = COALESCE(?, admin_response),
      admin_response_at = CASE WHEN ? IS NOT NULL AND ? != '' THEN datetime('now') ELSE admin_response_at END,
      is_pinned = COALESCE(?, is_pinned),
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      category = COALESCE(?, category),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    status ?? null,
    admin_response ?? null,
    admin_response, admin_response,
    is_pinned ?? null,
    title ?? null,
    description ?? null,
    category ?? null,
    req.params.id
  )

  const updated = db.prepare(`SELECT * FROM feedback_items WHERE id = ?`).get(req.params.id)
  res.json(updated)
})

// DELETE /api/feedback/:id
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM feedback_items WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// GET /api/feedback/admin/all — admin list (includes archived)
router.get('/admin/all', authMiddleware, (req, res) => {
  const { category, status, sort = 'newest', q, limit = 50, offset = 0 } = req.query
  let where = []
  const params = []

  if (category) { where.push('category = ?'); params.push(category) }
  if (status)   { where.push('status = ?');   params.push(status) }
  if (q)        { where.push('(title LIKE ? OR description LIKE ? OR customer_email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const orderMap = {
    votes: 'votes DESC, created_at DESC',
    newest: 'created_at DESC',
    oldest: 'created_at ASC',
  }
  const orderClause = orderMap[sort] || orderMap.newest

  const items = db.prepare(`
    SELECT * FROM feedback_items ${whereClause} ORDER BY is_pinned DESC, ${orderClause} LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`SELECT COUNT(*) as c FROM feedback_items ${whereClause}`).get(...params)?.c || 0

  res.json({ items, total })
})

export default router
