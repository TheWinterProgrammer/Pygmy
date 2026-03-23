// Pygmy CMS — Customer Notes / CRM Timeline API (Phase 37)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/customer-notes/:customerId — list notes for a customer
router.get('/:customerId', authMiddleware, (req, res) => {
  const { customerId } = req.params
  const notes = db.prepare(`
    SELECT * FROM customer_notes
    WHERE customer_id = ?
    ORDER BY pinned DESC, created_at DESC
  `).all(Number(customerId))
  res.json(notes)
})

// POST /api/customer-notes — create a note
router.post('/', authMiddleware, (req, res) => {
  const { customer_id, note, type = 'note', pinned = 0 } = req.body
  if (!customer_id || !note) return res.status(400).json({ error: 'customer_id and note are required' })

  const adminName = req.user?.name || 'Admin'
  const adminId = req.user?.id || null

  const result = db.prepare(`
    INSERT INTO customer_notes (customer_id, admin_id, admin_name, note, type, pinned)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(customer_id), adminId, adminName, note.trim(), type, pinned ? 1 : 0)

  const created = db.prepare('SELECT * FROM customer_notes WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(created)
})

// PUT /api/customer-notes/:id — update (pin/unpin, edit note text, change type)
router.put('/:id', authMiddleware, (req, res) => {
  const { note, type, pinned } = req.body
  const existing = db.prepare('SELECT * FROM customer_notes WHERE id = ?').get(Number(req.params.id))
  if (!existing) return res.status(404).json({ error: 'Note not found' })

  db.prepare(`
    UPDATE customer_notes SET
      note   = COALESCE(?, note),
      type   = COALESCE(?, type),
      pinned = COALESCE(?, pinned)
    WHERE id = ?
  `).run(
    note !== undefined ? note.trim() : null,
    type !== undefined ? type : null,
    pinned !== undefined ? (pinned ? 1 : 0) : null,
    Number(req.params.id)
  )

  const updated = db.prepare('SELECT * FROM customer_notes WHERE id = ?').get(Number(req.params.id))
  res.json(updated)
})

// DELETE /api/customer-notes/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM customer_notes WHERE id = ?').get(Number(req.params.id))
  if (!existing) return res.status(404).json({ error: 'Note not found' })
  db.prepare('DELETE FROM customer_notes WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

export default router
