// Pygmy CMS — Order Admin Notes API (Phase 75)
// Internal threaded admin notes per order — not visible to customers
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/order-admin-notes?order_id= — list notes for an order
router.get('/', authMiddleware, (req, res) => {
  const { order_id } = req.query
  if (!order_id) return res.status(400).json({ error: 'order_id required' })

  const notes = db.prepare(`
    SELECT * FROM order_admin_notes
    WHERE order_id = ?
    ORDER BY pinned DESC, created_at ASC
  `).all(Number(order_id))

  res.json(notes)
})

// POST /api/order-admin-notes — create a note
router.post('/', authMiddleware, (req, res) => {
  const { order_id, note, note_type = 'note', pinned = 0 } = req.body
  if (!order_id || !note?.trim()) {
    return res.status(400).json({ error: 'order_id and note are required' })
  }

  const adminName = req.user?.name || 'Admin'
  const adminId = req.user?.id || null

  const result = db.prepare(`
    INSERT INTO order_admin_notes (order_id, admin_id, admin_name, note, note_type, pinned)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(order_id), adminId, adminName, note.trim(), note_type, pinned ? 1 : 0)

  const created = db.prepare('SELECT * FROM order_admin_notes WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(created)
})

// PUT /api/order-admin-notes/:id — edit note or toggle pin
router.put('/:id', authMiddleware, (req, res) => {
  const { note, note_type, pinned } = req.body
  const existing = db.prepare('SELECT * FROM order_admin_notes WHERE id = ?').get(Number(req.params.id))
  if (!existing) return res.status(404).json({ error: 'Note not found' })

  db.prepare(`
    UPDATE order_admin_notes SET
      note       = COALESCE(?, note),
      note_type  = COALESCE(?, note_type),
      pinned     = COALESCE(?, pinned),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    note !== undefined ? note.trim() : null,
    note_type !== undefined ? note_type : null,
    pinned !== undefined ? (pinned ? 1 : 0) : null,
    existing.id
  )

  res.json(db.prepare('SELECT * FROM order_admin_notes WHERE id = ?').get(existing.id))
})

// DELETE /api/order-admin-notes/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM order_admin_notes WHERE id = ?').get(Number(req.params.id))
  if (!existing) return res.status(404).json({ error: 'Note not found' })
  db.prepare('DELETE FROM order_admin_notes WHERE id = ?').run(existing.id)
  res.json({ ok: true })
})

export default router
