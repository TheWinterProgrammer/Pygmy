// Pygmy CMS — Social Media Scheduler API (Phase 67)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ─── Schema Init ─────────────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS social_accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    platform   TEXT NOT NULL,
    name       TEXT NOT NULL,
    handle     TEXT NOT NULL,
    access_token TEXT DEFAULT '',
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS social_posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id   INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'draft',
    content      TEXT NOT NULL DEFAULT '',
    media_url    TEXT DEFAULT '',
    link_url     TEXT DEFAULT '',
    scheduled_at TEXT DEFAULT NULL,
    published_at TEXT DEFAULT NULL,
    platform_post_id TEXT DEFAULT '',
    error_msg    TEXT DEFAULT '',
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_at)`).run()

// ─── Social Accounts ─────────────────────────────────────────────────────────

router.get('/accounts', auth, (req, res) => {
  const accounts = db.prepare(`SELECT id, platform, name, handle, active, created_at FROM social_accounts ORDER BY platform, name`).all()
  res.json(accounts)
})

router.post('/accounts', auth, (req, res) => {
  const { platform, name, handle, access_token = '', active = 1 } = req.body
  if (!platform || !name || !handle) return res.status(400).json({ error: 'platform, name and handle are required' })
  const result = db.prepare(
    `INSERT INTO social_accounts (platform, name, handle, access_token, active) VALUES (?, ?, ?, ?, ?)`
  ).run(platform, name, handle, access_token, active ? 1 : 0)
  res.json({ id: result.lastInsertRowid, platform, name, handle, active })
})

router.put('/accounts/:id', auth, (req, res) => {
  const { platform, name, handle, access_token, active } = req.body
  const existing = db.prepare(`SELECT * FROM social_accounts WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare(`
    UPDATE social_accounts SET platform=?, name=?, handle=?, access_token=?, active=? WHERE id=?
  `).run(
    platform ?? existing.platform,
    name ?? existing.name,
    handle ?? existing.handle,
    access_token ?? existing.access_token,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  )
  res.json({ ok: true })
})

router.delete('/accounts/:id', auth, (req, res) => {
  db.prepare(`DELETE FROM social_accounts WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// ─── Social Posts ─────────────────────────────────────────────────────────────

router.get('/', auth, (req, res) => {
  const { status, account_id, limit = 50, offset = 0 } = req.query
  let sql = `
    SELECT p.*, a.platform, a.name AS account_name, a.handle
    FROM social_posts p
    LEFT JOIN social_accounts a ON a.id = p.account_id
    WHERE 1=1`
  const params = []
  if (status) { sql += ` AND p.status = ?`; params.push(status) }
  if (account_id) { sql += ` AND p.account_id = ?`; params.push(account_id) }
  sql += ` ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC LIMIT ? OFFSET ?`
  params.push(Number(limit), Number(offset))
  const posts = db.prepare(sql).all(...params)
  const total = db.prepare(`SELECT COUNT(*) AS n FROM social_posts WHERE 1=1${status ? ' AND status=?' : ''}${account_id ? ' AND account_id=?' : ''}`).get(...params.slice(0, -2)).n
  res.json({ posts, total })
})

router.get('/stats', auth, (req, res) => {
  const total     = db.prepare(`SELECT COUNT(*) AS n FROM social_posts`).get().n
  const scheduled = db.prepare(`SELECT COUNT(*) AS n FROM social_posts WHERE status='scheduled'`).get().n
  const published = db.prepare(`SELECT COUNT(*) AS n FROM social_posts WHERE status='published'`).get().n
  const draft     = db.prepare(`SELECT COUNT(*) AS n FROM social_posts WHERE status='draft'`).get().n
  const failed    = db.prepare(`SELECT COUNT(*) AS n FROM social_posts WHERE status='failed'`).get().n
  const accounts  = db.prepare(`SELECT COUNT(*) AS n FROM social_accounts WHERE active=1`).get().n
  // Posts due in next 7 days
  const upcoming  = db.prepare(`SELECT COUNT(*) AS n FROM social_posts WHERE status='scheduled' AND scheduled_at BETWEEN datetime('now') AND datetime('now', '+7 days')`).get().n
  // By platform
  const byPlatform = db.prepare(`
    SELECT a.platform, COUNT(p.id) AS post_count
    FROM social_posts p
    LEFT JOIN social_accounts a ON a.id = p.account_id
    GROUP BY a.platform
  `).all()
  res.json({ total, scheduled, published, draft, failed, accounts, upcoming, byPlatform })
})

router.post('/', auth, (req, res) => {
  const { account_id, content, media_url = '', link_url = '', scheduled_at = null, status = 'draft' } = req.body
  if (!content) return res.status(400).json({ error: 'content is required' })
  const userId = req.user?.id ?? null
  const result = db.prepare(`
    INSERT INTO social_posts (account_id, content, media_url, link_url, scheduled_at, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(account_id ?? null, content, media_url, link_url, scheduled_at, status, userId)
  res.json({ id: result.lastInsertRowid })
})

router.put('/:id', auth, (req, res) => {
  const { content, media_url, link_url, scheduled_at, status, account_id } = req.body
  const existing = db.prepare(`SELECT * FROM social_posts WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare(`
    UPDATE social_posts SET
      account_id   = ?,
      content      = ?,
      media_url    = ?,
      link_url     = ?,
      scheduled_at = ?,
      status       = ?,
      updated_at   = datetime('now')
    WHERE id = ?
  `).run(
    account_id ?? existing.account_id,
    content ?? existing.content,
    media_url ?? existing.media_url,
    link_url ?? existing.link_url,
    scheduled_at !== undefined ? scheduled_at : existing.scheduled_at,
    status ?? existing.status,
    req.params.id
  )
  res.json({ ok: true })
})

router.delete('/:id', auth, (req, res) => {
  db.prepare(`DELETE FROM social_posts WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// POST /api/social-scheduler/:id/publish — mark as published (simulated)
router.post('/:id/publish', auth, (req, res) => {
  const post = db.prepare(`SELECT * FROM social_posts WHERE id = ?`).get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Not found' })
  db.prepare(`UPDATE social_posts SET status='published', published_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(req.params.id)
  res.json({ ok: true, published_at: new Date().toISOString() })
})

// GET /api/social-scheduler/calendar?year=&month= — posts for calendar view
router.get('/calendar', auth, (req, res) => {
  const { year, month } = req.query
  if (!year || !month) return res.status(400).json({ error: 'year and month required' })
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end   = `${year}-${String(month).padStart(2, '0')}-31`
  const posts = db.prepare(`
    SELECT p.id, p.status, p.content, p.scheduled_at, a.platform, a.handle
    FROM social_posts p
    LEFT JOIN social_accounts a ON a.id = p.account_id
    WHERE p.scheduled_at BETWEEN ? AND ?
    ORDER BY p.scheduled_at ASC
  `).all(start, end)
  res.json(posts)
})

export default router
