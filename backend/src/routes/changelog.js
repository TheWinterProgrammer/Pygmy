// Pygmy CMS — Changelog / Release Notes API (Phase 57)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ── GET /api/changelog — public: published entries ────────────────────────────
router.get('/', (req, res) => {
  const { all, type, limit = 20, offset = 0 } = req.query
  const isAdmin = req.headers.authorization?.startsWith('Bearer ')

  let where = isAdmin && all ? '' : "WHERE status = 'published'"
  const params = []

  if (type && type !== 'all') {
    where += (where ? ' AND' : 'WHERE') + ` type = ?`
    params.push(type)
  }

  const rows = db.prepare(`
    SELECT * FROM changelog_entries ${where}
    ORDER BY COALESCE(published_at, created_at) DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`SELECT COUNT(*) as c FROM changelog_entries ${where}`).get(...params)?.c || 0

  res.json({ entries: rows, total })
})

// ── GET /api/changelog/stats — admin stats ────────────────────────────────────
router.get('/stats', auth, (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) as c FROM changelog_entries`).get()?.c || 0
  const published = db.prepare(`SELECT COUNT(*) as c FROM changelog_entries WHERE status='published'`).get()?.c || 0
  const byType = db.prepare(`
    SELECT type, COUNT(*) as count FROM changelog_entries GROUP BY type ORDER BY count DESC
  `).all()
  res.json({ total, published, drafts: total - published, byType })
})

// ── GET /api/changelog/:id — single entry ─────────────────────────────────────
router.get('/:id', (req, res) => {
  const entry = db.prepare(`SELECT * FROM changelog_entries WHERE id = ?`).get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'Entry not found' })
  if (entry.status !== 'published' && !req.headers.authorization) {
    return res.status(404).json({ error: 'Entry not found' })
  }
  res.json(entry)
})

// ── POST /api/changelog — create entry (admin) ────────────────────────────────
router.post('/', auth, (req, res) => {
  const { version, title, content = '', type = 'feature', status = 'draft', published_at } = req.body
  if (!version || !title) return res.status(400).json({ error: 'version and title are required' })

  const validTypes = ['feature', 'improvement', 'bugfix', 'breaking', 'security', 'deprecation']
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'invalid type' })

  const pubAt = status === 'published' ? (published_at || new Date().toISOString()) : null

  const info = db.prepare(`
    INSERT INTO changelog_entries (version, title, content, type, status, published_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(version, title, content, type, status, pubAt)

  res.status(201).json({ id: info.lastInsertRowid })
})

// ── PUT /api/changelog/:id — update entry (admin) ─────────────────────────────
router.put('/:id', auth, (req, res) => {
  const entry = db.prepare(`SELECT * FROM changelog_entries WHERE id = ?`).get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'Entry not found' })

  const { version, title, content, type, status, published_at } = req.body

  let pubAt = entry.published_at
  if (status === 'published' && entry.status !== 'published') {
    pubAt = published_at || new Date().toISOString()
  } else if (status === 'draft') {
    pubAt = null
  } else if (published_at !== undefined) {
    pubAt = published_at
  }

  db.prepare(`
    UPDATE changelog_entries SET
      version      = COALESCE(?, version),
      title        = COALESCE(?, title),
      content      = COALESCE(?, content),
      type         = COALESCE(?, type),
      status       = COALESCE(?, status),
      published_at = ?,
      updated_at   = datetime('now')
    WHERE id = ?
  `).run(
    version ?? null, title ?? null, content ?? null,
    type ?? null, status ?? null, pubAt, entry.id
  )

  res.json({ ok: true })
})

// ── DELETE /api/changelog/:id — delete entry (admin) ──────────────────────────
router.delete('/:id', auth, (req, res) => {
  const entry = db.prepare(`SELECT id FROM changelog_entries WHERE id = ?`).get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'Entry not found' })
  db.prepare(`DELETE FROM changelog_entries WHERE id = ?`).run(entry.id)
  res.json({ ok: true })
})

export default router
