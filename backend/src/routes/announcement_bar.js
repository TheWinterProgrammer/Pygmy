// Pygmy CMS — Announcement Bar API (Phase 30)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function parseBar(row) {
  if (!row) return null
  return {
    ...row,
    active: !!row.active,
    dismissable: !!row.dismissable,
  }
}

function isLive(bar) {
  if (!bar.active) return false
  const now = new Date()
  if (bar.starts_at && new Date(bar.starts_at) > now) return false
  if (bar.ends_at && new Date(bar.ends_at) < now) return false
  return true
}

// ── GET /api/announcement-bars/live — public: currently-active bar ────────────
router.get('/live', (req, res) => {
  const rows = db.prepare(`SELECT * FROM announcement_bars WHERE active = 1 ORDER BY id DESC`).all().map(parseBar)
  const live = rows.find(isLive) || null
  res.json(live)
})

// ── GET /api/announcement-bars — admin: all bars ──────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT * FROM announcement_bars ORDER BY created_at DESC`).all().map(parseBar)
  res.json(rows.map(bar => ({ ...bar, is_live: isLive(bar) })))
})

// ── POST /api/announcement-bars — admin: create ───────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const {
    message, link_url = null, link_label = null,
    bg_color = '#c0392b', text_color = '#ffffff',
    dismissable = 1, active = 0,
    starts_at = null, ends_at = null, position = 'top'
  } = req.body

  if (!message) return res.status(400).json({ error: 'message required' })

  const result = db.prepare(`
    INSERT INTO announcement_bars (message, link_url, link_label, bg_color, text_color,
      dismissable, active, starts_at, ends_at, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(message, link_url, link_label, bg_color, text_color,
    dismissable ? 1 : 0, active ? 1 : 0, starts_at, ends_at, position)

  res.status(201).json({ ok: true, id: result.lastInsertRowid })
})

// ── PUT /api/announcement-bars/:id — admin: update ───────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM announcement_bars WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const {
    message = existing.message,
    link_url = existing.link_url,
    link_label = existing.link_label,
    bg_color = existing.bg_color,
    text_color = existing.text_color,
    dismissable, active,
    starts_at = existing.starts_at,
    ends_at = existing.ends_at,
    position = existing.position
  } = req.body

  db.prepare(`
    UPDATE announcement_bars SET message=?, link_url=?, link_label=?, bg_color=?,
      text_color=?, dismissable=?, active=?, starts_at=?, ends_at=?, position=?
    WHERE id=?
  `).run(
    message, link_url, link_label, bg_color, text_color,
    dismissable !== undefined ? (dismissable ? 1 : 0) : existing.dismissable,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    starts_at, ends_at, position, existing.id
  )
  res.json({ ok: true })
})

// ── PUT /api/announcement-bars/:id/activate — admin: quick toggle ─────────────
router.put('/:id/activate', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM announcement_bars WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  // Deactivate all others first (only one active at a time)
  db.prepare('UPDATE announcement_bars SET active = 0').run()
  db.prepare('UPDATE announcement_bars SET active = 1 WHERE id = ?').run(existing.id)
  res.json({ ok: true })
})

// ── DELETE /api/announcement-bars/:id — admin: delete ─────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM announcement_bars WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
