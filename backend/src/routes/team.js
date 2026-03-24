// Pygmy CMS — Team Members API (Phase 67)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ─── Schema Init ─────────────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS team_members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL DEFAULT '',
    department  TEXT NOT NULL DEFAULT '',
    bio         TEXT NOT NULL DEFAULT '',
    photo       TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    linkedin    TEXT NOT NULL DEFAULT '',
    twitter     TEXT NOT NULL DEFAULT '',
    github      TEXT NOT NULL DEFAULT '',
    website     TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active',
    featured    INTEGER DEFAULT 0,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_team_status ON team_members(status)`).run()

// Helper
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/team — public list (active members)
// GET /api/team?all=1 — admin (all statuses)
router.get('/', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  const isAdmin = !!token && req.query.all === '1'
  const { department, q } = req.query
  let sql = `SELECT * FROM team_members WHERE 1=1`
  const params = []
  if (!isAdmin) { sql += ` AND status = 'active'` }
  if (department) { sql += ` AND department = ?`; params.push(department) }
  if (q) { sql += ` AND (name LIKE ? OR role LIKE ? OR bio LIKE ?)`; const like = `%${q}%`; params.push(like, like, like) }
  sql += ` ORDER BY sort_order ASC, name ASC`
  res.json(db.prepare(sql).all(...params))
})

router.get('/departments', (req, res) => {
  const depts = db.prepare(`SELECT DISTINCT department FROM team_members WHERE department != '' ORDER BY department`).all().map(r => r.department)
  res.json(depts)
})

router.get('/stats', auth, (req, res) => {
  const total   = db.prepare(`SELECT COUNT(*) AS n FROM team_members`).get().n
  const active  = db.prepare(`SELECT COUNT(*) AS n FROM team_members WHERE status='active'`).get().n
  const featured = db.prepare(`SELECT COUNT(*) AS n FROM team_members WHERE featured=1`).get().n
  const byDept  = db.prepare(`SELECT department, COUNT(*) AS count FROM team_members GROUP BY department ORDER BY count DESC`).all()
  res.json({ total, active, featured, byDept })
})

router.get('/:slug', (req, res) => {
  const member = db.prepare(`SELECT * FROM team_members WHERE slug = ?`).get(req.params.slug)
  if (!member) return res.status(404).json({ error: 'Not found' })
  res.json(member)
})

router.post('/', auth, (req, res) => {
  const { name, role = '', department = '', bio = '', photo = '', email = '', linkedin = '', twitter = '', github = '', website = '', status = 'active', featured = 0, sort_order = 0 } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const slug = slugify(name) + '-' + Date.now().toString(36)
  const result = db.prepare(`
    INSERT INTO team_members (name, slug, role, department, bio, photo, email, linkedin, twitter, github, website, status, featured, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, slug, role, department, bio, photo, email, linkedin, twitter, github, website, status, featured ? 1 : 0, sort_order)
  res.json({ id: result.lastInsertRowid, slug })
})

router.put('/:id', auth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM team_members WHERE id=?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const { name, role, department, bio, photo, email, linkedin, twitter, github, website, status, featured, sort_order } = req.body
  db.prepare(`
    UPDATE team_members SET
      name       = ?,
      role       = ?,
      department = ?,
      bio        = ?,
      photo      = ?,
      email      = ?,
      linkedin   = ?,
      twitter    = ?,
      github     = ?,
      website    = ?,
      status     = ?,
      featured   = ?,
      sort_order = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name       ?? existing.name,
    role       ?? existing.role,
    department ?? existing.department,
    bio        ?? existing.bio,
    photo      ?? existing.photo,
    email      ?? existing.email,
    linkedin   ?? existing.linkedin,
    twitter    ?? existing.twitter,
    github     ?? existing.github,
    website    ?? existing.website,
    status     ?? existing.status,
    featured   !== undefined ? (featured ? 1 : 0) : existing.featured,
    sort_order ?? existing.sort_order,
    req.params.id
  )
  res.json({ ok: true })
})

router.post('/reorder', auth, (req, res) => {
  const { order } = req.body // [id, id, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' })
  const stmt = db.prepare(`UPDATE team_members SET sort_order = ? WHERE id = ?`)
  db.transaction(() => order.forEach((id, i) => stmt.run(i, id)))()
  res.json({ ok: true })
})

router.delete('/:id', auth, (req, res) => {
  db.prepare(`DELETE FROM team_members WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

export default router
