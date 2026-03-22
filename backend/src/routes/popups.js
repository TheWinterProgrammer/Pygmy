// Pygmy CMS — Pop-up Builder API (Phase 30)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function parsePopup(row) {
  if (!row) return null
  return {
    ...row,
    show_on_paths: (() => { try { return JSON.parse(row.show_on_paths || '[]') } catch { return [] } })(),
    active: !!row.active,
    show_once: !!row.show_once,
  }
}

// ── GET /api/popups — public: active popups; admin: all ───────────────────────
router.get('/', (req, res) => {
  const isAdmin = !!req.headers.authorization
  let rows
  if (isAdmin) {
    rows = db.prepare(`SELECT * FROM popups ORDER BY created_at DESC`).all().map(parsePopup)
  } else {
    rows = db.prepare(`SELECT * FROM popups WHERE active = 1 ORDER BY id DESC`).all().map(parsePopup)
  }
  res.json(rows)
})

// ── GET /api/popups/:id — single popup ───────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM popups WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(parsePopup(row))
})

// ── POST /api/popups — admin: create ─────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const {
    name, type = 'newsletter',
    title = '', body = '',
    cta_label = '', cta_url = '',
    image_url = null,
    trigger = 'timed', trigger_delay = 5,
    show_once = 1, cookie_days = 30,
    show_on = 'all', show_on_paths = [],
    bg_color = 'rgba(0,0,0,0.85)',
    active = 0
  } = req.body

  if (!name) return res.status(400).json({ error: 'name required' })

  const result = db.prepare(`
    INSERT INTO popups (name, type, title, body, cta_label, cta_url, image_url,
      trigger, trigger_delay, show_once, cookie_days, show_on, show_on_paths,
      bg_color, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, type, title, body, cta_label, cta_url, image_url,
    trigger, trigger_delay, show_once ? 1 : 0, cookie_days,
    show_on, JSON.stringify(show_on_paths), bg_color, active ? 1 : 0
  )
  res.status(201).json({ ok: true, id: result.lastInsertRowid })
})

// ── PUT /api/popups/:id — admin: update ───────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM popups WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const p = parsePopup(existing)
  const {
    name = p.name, type = p.type,
    title = p.title, body = p.body,
    cta_label = p.cta_label, cta_url = p.cta_url,
    image_url = p.image_url,
    trigger = p.trigger, trigger_delay = p.trigger_delay,
    show_once, cookie_days = p.cookie_days,
    show_on = p.show_on, show_on_paths,
    bg_color = p.bg_color, active
  } = req.body

  const pathsJson = show_on_paths !== undefined
    ? JSON.stringify(show_on_paths)
    : existing.show_on_paths

  db.prepare(`
    UPDATE popups SET name=?, type=?, title=?, body=?, cta_label=?, cta_url=?,
      image_url=?, trigger=?, trigger_delay=?, show_once=?, cookie_days=?,
      show_on=?, show_on_paths=?, bg_color=?, active=?
    WHERE id=?
  `).run(
    name, type, title, body, cta_label, cta_url, image_url,
    trigger, trigger_delay,
    show_once !== undefined ? (show_once ? 1 : 0) : existing.show_once,
    cookie_days, show_on, pathsJson, bg_color,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    existing.id
  )
  res.json({ ok: true })
})

// ── DELETE /api/popups/:id — admin: delete ────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM popups WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── POST /api/popups/:id/track — public: track display/conversion ──────────────
// Body: { event: 'display' | 'conversion' }
router.post('/:id/track', (req, res) => {
  const { event } = req.body
  if (event === 'display') {
    db.prepare('UPDATE popups SET display_count = display_count + 1 WHERE id = ?').run(req.params.id)
  } else if (event === 'conversion') {
    db.prepare('UPDATE popups SET conversion_count = conversion_count + 1 WHERE id = ?').run(req.params.id)
  }
  res.json({ ok: true })
})

export default router
