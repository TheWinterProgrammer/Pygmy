// Pygmy CMS — Admin Quick Notes API (Phase 33)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/quick-notes  → list notes for the current user
router.get('/', authMiddleware, (req, res) => {
  const notes = db.prepare(`
    SELECT * FROM quick_notes WHERE user_id = ? ORDER BY pinned DESC, updated_at DESC
  `).all(req.user.id)
  res.json({ notes })
})

// POST /api/quick-notes  → create note
router.post('/', authMiddleware, (req, res) => {
  const { content = '', color = 'yellow', pinned = 0 } = req.body
  if (!content.trim()) return res.status(400).json({ error: 'Content required' })
  const result = db.prepare(`
    INSERT INTO quick_notes (user_id, content, color, pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(req.user.id, content.trim(), color, pinned ? 1 : 0)
  const note = db.prepare('SELECT * FROM quick_notes WHERE id = ?').get(result.lastInsertRowid)
  res.json({ note })
})

// PUT /api/quick-notes/:id  → update note
router.put('/:id', authMiddleware, (req, res) => {
  const note = db.prepare('SELECT * FROM quick_notes WHERE id = ?').get(req.params.id)
  if (!note) return res.status(404).json({ error: 'Not found' })
  if (note.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  const { content, color, pinned } = req.body
  db.prepare(`
    UPDATE quick_notes SET
      content   = COALESCE(?, content),
      color     = COALESCE(?, color),
      pinned    = COALESCE(?, pinned),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    content !== undefined ? content.trim() : null,
    color    !== undefined ? color          : null,
    pinned   !== undefined ? (pinned ? 1 : 0) : null,
    req.params.id
  )
  const updated = db.prepare('SELECT * FROM quick_notes WHERE id = ?').get(req.params.id)
  res.json({ note: updated })
})

// DELETE /api/quick-notes/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const note = db.prepare('SELECT * FROM quick_notes WHERE id = ?').get(req.params.id)
  if (!note) return res.status(404).json({ error: 'Not found' })
  if (note.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  db.prepare('DELETE FROM quick_notes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
