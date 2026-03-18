// Pygmy CMS — Redirect Manager
// GET    /api/redirects       — list all (auth)
// POST   /api/redirects       — create (auth)  { from_path, to_path, type }
// PUT    /api/redirects/:id   — update (auth)
// DELETE /api/redirects/:id   — delete (auth)
// GET    /api/redirects/check?path= — internal: check if a path has a redirect (public)

import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()

// GET /api/redirects — list all
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM redirects ORDER BY created_at DESC').all()
  res.json(rows)
})

// GET /api/redirects/check?path= — check if a redirect exists (used by middleware)
router.get('/check', (req, res) => {
  const p = req.query.path
  if (!p) return res.json(null)
  const row = db.prepare('SELECT * FROM redirects WHERE from_path = ?').get(p)
  res.json(row || null)
})

// POST /api/redirects — create
router.post('/', authMiddleware, (req, res) => {
  const { from_path, to_path, type = '301' } = req.body
  if (!from_path || !to_path) return res.status(400).json({ error: 'from_path and to_path required' })
  if (!['301', '302'].includes(type)) return res.status(400).json({ error: 'type must be 301 or 302' })

  // Normalise: ensure leading slash
  const from = from_path.startsWith('/') ? from_path : '/' + from_path
  const to   = to_path.startsWith('/') || to_path.startsWith('http') ? to_path : '/' + to_path

  const existing = db.prepare('SELECT id FROM redirects WHERE from_path = ?').get(from)
  if (existing) return res.status(409).json({ error: 'A redirect from that path already exists' })

  const info = db.prepare(
    'INSERT INTO redirects (from_path, to_path, type) VALUES (?, ?, ?)'
  ).run(from, to, type)

  const row = db.prepare('SELECT * FROM redirects WHERE id = ?').get(info.lastInsertRowid)
  logActivity(req.user?.id, req.user?.name, 'created redirect', 'redirect', row.id, `${from} → ${to}`)
  res.status(201).json(row)
})

// PUT /api/redirects/:id — update
router.put('/:id', authMiddleware, (req, res) => {
  const redirect = db.prepare('SELECT * FROM redirects WHERE id = ?').get(req.params.id)
  if (!redirect) return res.status(404).json({ error: 'Redirect not found' })

  const { from_path, to_path, type } = req.body
  const newType = type || redirect.type
  if (!['301', '302'].includes(newType)) return res.status(400).json({ error: 'type must be 301 or 302' })

  const from = from_path ? (from_path.startsWith('/') ? from_path : '/' + from_path) : redirect.from_path
  const to   = to_path   ? (to_path.startsWith('/') || to_path.startsWith('http') ? to_path : '/' + to_path) : redirect.to_path

  if (from !== redirect.from_path) {
    const conflict = db.prepare('SELECT id FROM redirects WHERE from_path = ? AND id != ?').get(from, redirect.id)
    if (conflict) return res.status(409).json({ error: 'A redirect from that path already exists' })
  }

  db.prepare('UPDATE redirects SET from_path=?, to_path=?, type=? WHERE id=?').run(from, to, newType, redirect.id)
  const updated = db.prepare('SELECT * FROM redirects WHERE id = ?').get(redirect.id)
  logActivity(req.user?.id, req.user?.name, 'updated redirect', 'redirect', redirect.id, `${from} → ${to}`)
  res.json(updated)
})

// DELETE /api/redirects/:id — delete
router.delete('/:id', authMiddleware, (req, res) => {
  const redirect = db.prepare('SELECT * FROM redirects WHERE id = ?').get(req.params.id)
  if (!redirect) return res.status(404).json({ error: 'Redirect not found' })

  db.prepare('DELETE FROM redirects WHERE id = ?').run(redirect.id)
  logActivity(req.user?.id, req.user?.name, 'deleted redirect', 'redirect', redirect.id, redirect.from_path)
  res.json({ message: 'Deleted' })
})

export default router
