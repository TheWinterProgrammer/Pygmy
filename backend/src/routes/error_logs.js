// Pygmy CMS — 404 / Error Log Tracker (Phase 61)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ── Ensure table ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS error_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    path        TEXT    NOT NULL,
    method      TEXT    NOT NULL DEFAULT 'GET',
    status_code INTEGER NOT NULL DEFAULT 404,
    referrer    TEXT,
    user_agent  TEXT,
    ip          TEXT,
    resolved    INTEGER NOT NULL DEFAULT 0,
    redirect_to TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_error_logs_path ON error_logs(path);
  CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
`)

// ── POST /api/error-logs — record a 404 from the public frontend ──────────────
router.post('/', (req, res) => {
  const { path: reqPath, referrer, user_agent, status_code = 404 } = req.body
  if (!reqPath) return res.status(400).json({ error: 'path required' })

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip

  // Deduplicate: if same path seen in last 5 min from same IP, skip
  const recent = db.prepare(`
    SELECT id FROM error_logs WHERE path = ? AND ip = ?
    AND created_at > datetime('now', '-5 minutes') LIMIT 1
  `).get(reqPath, ip)

  if (!recent) {
    db.prepare(`
      INSERT INTO error_logs (path, method, status_code, referrer, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reqPath, req.method, status_code, referrer || null, user_agent || null, ip)
  }

  res.json({ ok: true })
})

// ── GET /api/error-logs/summary — stats overview ──────────────────────────────
router.get('/summary', auth, (req, res) => {
  const { days = 30 } = req.query
  const cutoff = `datetime('now', '-${parseInt(days)} days')`

  const total = db.prepare(`SELECT COUNT(*) as n FROM error_logs WHERE created_at > ${cutoff}`).get()?.n || 0
  const unique = db.prepare(`SELECT COUNT(DISTINCT path) as n FROM error_logs WHERE created_at > ${cutoff}`).get()?.n || 0
  const unresolved = db.prepare(`SELECT COUNT(*) as n FROM error_logs WHERE resolved = 0 AND created_at > ${cutoff}`).get()?.n || 0
  const resolved = db.prepare(`SELECT COUNT(*) as n FROM error_logs WHERE resolved = 1 AND created_at > ${cutoff}`).get()?.n || 0

  res.json({ total, unique, unresolved, resolved, days })
})

// ── GET /api/error-logs/top — top 404 paths ───────────────────────────────────
router.get('/top', auth, (req, res) => {
  const { days = 30, limit = 50 } = req.query
  const cutoff = `datetime('now', '-${parseInt(days)} days')`

  const rows = db.prepare(`
    SELECT path, COUNT(*) as hits, MAX(created_at) as last_seen,
           MAX(resolved) as resolved, MAX(redirect_to) as redirect_to
    FROM error_logs
    WHERE created_at > ${cutoff}
    GROUP BY path
    ORDER BY hits DESC
    LIMIT ?
  `).all(parseInt(limit))

  // For each path, check if a redirect already exists
  const redirects = db.prepare('SELECT from_path, to_path FROM redirects').all()
  const redirectMap = {}
  for (const r of redirects) redirectMap[r.from_path] = r.to_path

  const result = rows.map(row => ({
    ...row,
    existing_redirect: redirectMap[row.path] || null
  }))

  res.json(result)
})

// ── GET /api/error-logs/daily — daily count ───────────────────────────────────
router.get('/daily', auth, (req, res) => {
  const { days = 30 } = req.query
  const n = parseInt(days)

  const rows = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as hits
    FROM error_logs
    WHERE created_at > datetime('now', '-${n} days')
    GROUP BY date(created_at)
    ORDER BY day
  `).all()

  // Fill gaps
  const map = {}
  for (const r of rows) map[r.day] = r.hits
  const filled = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    filled.push({ day: d, hits: map[d] || 0 })
  }

  res.json(filled)
})

// ── GET /api/error-logs/referrers — top referrers hitting 404s ────────────────
router.get('/referrers', auth, (req, res) => {
  const { days = 30, limit = 20 } = req.query
  const cutoff = `datetime('now', '-${parseInt(days)} days')`

  const rows = db.prepare(`
    SELECT referrer, COUNT(*) as hits
    FROM error_logs
    WHERE referrer IS NOT NULL AND referrer != '' AND created_at > ${cutoff}
    GROUP BY referrer
    ORDER BY hits DESC
    LIMIT ?
  `).all(parseInt(limit))

  res.json(rows)
})

// ── GET /api/error-logs — full paginated list ─────────────────────────────────
router.get('/', auth, (req, res) => {
  const { q, resolved, limit = 50, offset = 0, days = 30 } = req.query
  const cutoff = `datetime('now', '-${parseInt(days)} days')`
  const params = []
  let where = `WHERE created_at > ${cutoff}`

  if (q) {
    where += ` AND path LIKE ?`
    params.push(`%${q}%`)
  }
  if (resolved !== undefined) {
    where += ` AND resolved = ?`
    params.push(resolved === '1' ? 1 : 0)
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM error_logs ${where}`).get(...params)?.n || 0
  const rows = db.prepare(`
    SELECT * FROM error_logs ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  res.json({ total, rows })
})

// ── PUT /api/error-logs/:id/resolve — mark as resolved + optional redirect ────
router.put('/:id/resolve', auth, (req, res) => {
  const { redirect_to, create_redirect } = req.body
  const log = db.prepare('SELECT * FROM error_logs WHERE id = ?').get(req.params.id)
  if (!log) return res.status(404).json({ error: 'Not found' })

  db.prepare(`UPDATE error_logs SET resolved = 1, redirect_to = ? WHERE id = ?`)
    .run(redirect_to || null, log.id)

  // Also mark all same-path entries resolved
  db.prepare(`UPDATE error_logs SET resolved = 1 WHERE path = ?`).run(log.path)

  // Optionally create a redirect
  if (create_redirect && redirect_to) {
    const existing = db.prepare('SELECT id FROM redirects WHERE from_path = ?').get(log.path)
    if (!existing) {
      db.prepare(`INSERT INTO redirects (from_path, to_path, type) VALUES (?, ?, '301')`)
        .run(log.path, redirect_to)
    }
  }

  res.json({ ok: true })
})

// ── DELETE /api/error-logs/:id — delete entry ─────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM error_logs WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── DELETE /api/error-logs — bulk clear (with filter) ─────────────────────────
router.delete('/', auth, (req, res) => {
  const { resolved, days } = req.query
  let where = ''
  const params = []

  if (resolved !== undefined) {
    where = 'WHERE resolved = ?'
    params.push(resolved === '1' ? 1 : 0)
  } else if (days) {
    where = `WHERE created_at < datetime('now', '-${parseInt(days)} days')`
  }

  const result = db.prepare(`DELETE FROM error_logs ${where}`).run(...params)
  res.json({ deleted: result.changes })
})

export default router
