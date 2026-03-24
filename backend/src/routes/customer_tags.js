// Pygmy CMS — Customer Tags (Phase 59)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/customer-tags — list all tags with usage count
router.get('/', authMiddleware, (req, res) => {
  const tags = db.prepare(`
    SELECT t.id, t.name, t.color, t.created_at,
      COUNT(ct.customer_id) AS customer_count
    FROM customer_tag_definitions t
    LEFT JOIN customer_tag_assignments ct ON ct.tag_id = t.id
    GROUP BY t.id
    ORDER BY customer_count DESC, t.name
  `).all()
  res.json(tags)
})

// POST /api/customer-tags — create tag
router.post('/', authMiddleware, (req, res) => {
  const { name, color = '#6366f1' } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const existing = db.prepare(`SELECT id FROM customer_tag_definitions WHERE name = ?`).get(name.trim())
  if (existing) return res.status(409).json({ error: 'Tag already exists', id: existing.id })
  const result = db.prepare(`INSERT INTO customer_tag_definitions (name, color) VALUES (?, ?)`).run(name.trim(), color)
  res.json(db.prepare(`SELECT * FROM customer_tag_definitions WHERE id = ?`).get(result.lastInsertRowid))
})

// PUT /api/customer-tags/:id — rename/recolor
router.put('/:id', authMiddleware, (req, res) => {
  const { name, color } = req.body
  db.prepare(`UPDATE customer_tag_definitions SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?`).run(name, color, Number(req.params.id))
  res.json(db.prepare(`SELECT * FROM customer_tag_definitions WHERE id = ?`).get(Number(req.params.id)))
})

// DELETE /api/customer-tags/:id — delete tag + all assignments
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM customer_tag_definitions WHERE id = ?`).run(Number(req.params.id))
  res.json({ ok: true })
})

// GET /api/customer-tags/customer/:customerId — get tags for a customer
router.get('/customer/:customerId', authMiddleware, (req, res) => {
  const tags = db.prepare(`
    SELECT t.id, t.name, t.color
    FROM customer_tag_assignments cta
    JOIN customer_tag_definitions t ON t.id = cta.tag_id
    WHERE cta.customer_id = ?
    ORDER BY t.name
  `).all(Number(req.params.customerId))
  res.json(tags)
})

// POST /api/customer-tags/customer/:customerId — assign tag(s) to customer
router.post('/customer/:customerId', authMiddleware, (req, res) => {
  const customerId = Number(req.params.customerId)
  const { tag_ids } = req.body
  if (!tag_ids || !Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids array required' })
  const insert = db.prepare(`INSERT OR IGNORE INTO customer_tag_assignments (customer_id, tag_id) VALUES (?, ?)`)
  const tx = db.transaction(() => tag_ids.forEach(tid => insert.run(customerId, tid)))
  tx()
  const tags = db.prepare(`
    SELECT t.id, t.name, t.color
    FROM customer_tag_assignments cta
    JOIN customer_tag_definitions t ON t.id = cta.tag_id
    WHERE cta.customer_id = ?
  `).all(customerId)
  res.json(tags)
})

// DELETE /api/customer-tags/customer/:customerId/:tagId — remove tag from customer
router.delete('/customer/:customerId/:tagId', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM customer_tag_assignments WHERE customer_id = ? AND tag_id = ?`).run(Number(req.params.customerId), Number(req.params.tagId))
  res.json({ ok: true })
})

// GET /api/customer-tags/:id/customers — get customers with a specific tag
router.get('/:id/customers', authMiddleware, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const customers = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.email, c.created_at
    FROM customer_tag_assignments cta
    JOIN customers c ON c.id = cta.customer_id
    WHERE cta.tag_id = ?
    ORDER BY c.first_name, c.last_name
    LIMIT ? OFFSET ?
  `).all(Number(req.params.id), limit, offset)
  const total = db.prepare(`SELECT COUNT(*) AS c FROM customer_tag_assignments WHERE tag_id = ?`).get(Number(req.params.id)).c
  res.json({ customers, total })
})

// POST /api/customer-tags/bulk-tag — assign tag to multiple customers
router.post('/bulk-tag', authMiddleware, (req, res) => {
  const { customer_ids, tag_id } = req.body
  if (!customer_ids || !Array.isArray(customer_ids) || !tag_id) {
    return res.status(400).json({ error: 'customer_ids array and tag_id required' })
  }
  const insert = db.prepare(`INSERT OR IGNORE INTO customer_tag_assignments (customer_id, tag_id) VALUES (?, ?)`)
  const tx = db.transaction(() => customer_ids.forEach(cid => insert.run(cid, tag_id)))
  tx()
  res.json({ ok: true, tagged: customer_ids.length })
})

export default router
