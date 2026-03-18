// Pygmy CMS — Contact form routes
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, adminOnly } from '../middleware/auth.js'
import { notifyNewContact } from '../email.js'

const router = Router()

// POST /api/contact — public: submit a contact message
router.post('/', async (req, res) => {
  const { name, email, subject = '', message } = req.body
  if (!name || !email || !message)
    return res.status(400).json({ error: 'name, email and message are required' })

  // Basic email sanity check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' })

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress

  db.prepare(
    'INSERT INTO form_submissions (name, email, subject, message, ip) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, subject, message, ip)

  // Fire-and-forget email notification
  notifyNewContact({ name, email, subject, message }).catch(() => {})

  res.status(201).json({ message: 'Message received. Thank you!' })
})

// GET /api/contact — admin: list submissions
router.get('/', authMiddleware, adminOnly, (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query
  let query = 'SELECT * FROM form_submissions'
  const params = []

  if (status) {
    query += ' WHERE status = ?'
    params.push(status)
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  const rows = db.prepare(query).all(...params)
  const total = db.prepare(
    status
      ? 'SELECT COUNT(*) as n FROM form_submissions WHERE status = ?'
      : 'SELECT COUNT(*) as n FROM form_submissions'
  ).get(...(status ? [status] : [])).n

  res.json({ submissions: rows, total })
})

// GET /api/contact/stats — admin: unread count for dashboard
router.get('/stats', authMiddleware, adminOnly, (req, res) => {
  const total  = db.prepare('SELECT COUNT(*) as n FROM form_submissions').get().n
  const unread = db.prepare("SELECT COUNT(*) as n FROM form_submissions WHERE status='unread'").get().n
  res.json({ total, unread })
})

// PUT /api/contact/:id — admin: mark as read / archived
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const id = parseInt(req.params.id)
  const row = db.prepare('SELECT id FROM form_submissions WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'Submission not found' })

  const { status } = req.body
  if (!['unread', 'read', 'archived'].includes(status))
    return res.status(400).json({ error: 'status must be unread | read | archived' })

  db.prepare('UPDATE form_submissions SET status = ? WHERE id = ?').run(status, id)
  res.json({ message: 'Updated' })
})

// DELETE /api/contact/:id — admin: delete
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const id = parseInt(req.params.id)
  const row = db.prepare('SELECT id FROM form_submissions WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'Submission not found' })

  db.prepare('DELETE FROM form_submissions WHERE id = ?').run(id)
  res.json({ message: 'Deleted' })
})

export default router
