// Pygmy CMS — Canned Responses API (Phase 67)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ─── Schema Init ─────────────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS canned_responses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    shortcut   TEXT NOT NULL DEFAULT '',
    body       TEXT NOT NULL DEFAULT '',
    category   TEXT NOT NULL DEFAULT 'general',
    scope      TEXT NOT NULL DEFAULT 'both',
    use_count  INTEGER DEFAULT 0,
    active     INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_canned_shortcut ON canned_responses(shortcut)`).run()

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/', auth, (req, res) => {
  const { q, category, scope, active } = req.query
  let sql = `SELECT * FROM canned_responses WHERE 1=1`
  const params = []
  if (q) {
    sql += ` AND (title LIKE ? OR shortcut LIKE ? OR body LIKE ?)`
    const like = `%${q}%`
    params.push(like, like, like)
  }
  if (category) { sql += ` AND category = ?`; params.push(category) }
  if (scope && scope !== 'both') { sql += ` AND (scope = ? OR scope = 'both')`; params.push(scope) }
  if (active !== undefined) { sql += ` AND active = ?`; params.push(active === '1' ? 1 : 0) }
  sql += ` ORDER BY category ASC, title ASC`
  res.json(db.prepare(sql).all(...params))
})

router.get('/categories', auth, (req, res) => {
  const cats = db.prepare(`SELECT DISTINCT category FROM canned_responses ORDER BY category`).all().map(r => r.category)
  res.json(cats)
})

// GET /api/canned-responses/search?q= — for quick typeahead in chat/support
router.get('/search', auth, (req, res) => {
  const { q, scope } = req.query
  if (!q) return res.json([])
  const like = `%${q}%`
  let sql = `SELECT id, title, shortcut, body, category FROM canned_responses WHERE active=1 AND (title LIKE ? OR shortcut LIKE ?)`
  const params = [like, like]
  if (scope) { sql += ` AND (scope=? OR scope='both')`; params.push(scope) }
  sql += ` ORDER BY use_count DESC LIMIT 10`
  res.json(db.prepare(sql).all(...params))
})

router.post('/', auth, (req, res) => {
  const { title, shortcut = '', body, category = 'general', scope = 'both', active = 1 } = req.body
  if (!title || !body) return res.status(400).json({ error: 'title and body required' })
  const result = db.prepare(`
    INSERT INTO canned_responses (title, shortcut, body, category, scope, active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, shortcut.toLowerCase(), body, category, scope, active ? 1 : 0, req.user?.id ?? null)
  res.json({ id: result.lastInsertRowid })
})

router.put('/:id', auth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM canned_responses WHERE id=?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const { title, shortcut, body, category, scope, active } = req.body
  db.prepare(`
    UPDATE canned_responses SET
      title    = ?,
      shortcut = ?,
      body     = ?,
      category = ?,
      scope    = ?,
      active   = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title    ?? existing.title,
    shortcut !== undefined ? shortcut.toLowerCase() : existing.shortcut,
    body     ?? existing.body,
    category ?? existing.category,
    scope    ?? existing.scope,
    active   !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  )
  res.json({ ok: true })
})

// POST /api/canned-responses/:id/use — increment use counter
router.post('/:id/use', auth, (req, res) => {
  db.prepare(`UPDATE canned_responses SET use_count = use_count + 1 WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', auth, (req, res) => {
  db.prepare(`DELETE FROM canned_responses WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

router.get('/stats', auth, (req, res) => {
  const total   = db.prepare(`SELECT COUNT(*) AS n FROM canned_responses`).get().n
  const active  = db.prepare(`SELECT COUNT(*) AS n FROM canned_responses WHERE active=1`).get().n
  const totalUse = db.prepare(`SELECT SUM(use_count) AS n FROM canned_responses`).get().n ?? 0
  const topUsed = db.prepare(`SELECT id, title, shortcut, use_count FROM canned_responses ORDER BY use_count DESC LIMIT 5`).all()
  const byCat   = db.prepare(`SELECT category, COUNT(*) AS count FROM canned_responses GROUP BY category ORDER BY count DESC`).all()
  res.json({ total, active, totalUse, topUsed, byCat })
})

export default router
