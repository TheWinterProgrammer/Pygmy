// Pygmy CMS — Live Chat API (Phase 65)
// Poll-based live chat: visitors open a session, send messages, admins reply.
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Init tables (inline schema) ─────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS live_chat_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key  TEXT    NOT NULL UNIQUE,
    visitor_name TEXT    NOT NULL DEFAULT 'Visitor',
    visitor_email TEXT   NOT NULL DEFAULT '',
    page_url     TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'open',
    assigned_to  TEXT    NOT NULL DEFAULT '',
    last_visitor_at TEXT,
    last_admin_at   TEXT,
    unread_admin    INTEGER NOT NULL DEFAULT 0,
    unread_visitor  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_lcs_key ON live_chat_sessions(session_key)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_lcs_status ON live_chat_sessions(status, created_at DESC)`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS live_chat_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER NOT NULL REFERENCES live_chat_sessions(id) ON DELETE CASCADE,
    sender       TEXT    NOT NULL DEFAULT 'visitor',
    body         TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_lcm_session ON live_chat_messages(session_id, created_at ASC)`).run()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEnabled() {
  return db.prepare(`SELECT value FROM settings WHERE key='live_chat_enabled'`).get()?.value === '1'
}

function getConfig() {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'live_chat_%'`).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))
  return s
}

// ─── PUBLIC ENDPOINTS ─────────────────────────────────────────────────────────

// GET /api/live-chat/config — public config for the widget
router.get('/config', (req, res) => {
  const s = getConfig()
  res.json({
    enabled: s.live_chat_enabled === '1',
    greeting: s.live_chat_greeting || 'Hi there 👋 How can we help you today?',
    offline_message: s.live_chat_offline_message || 'We\'re offline right now. Leave a message and we\'ll get back to you!',
    color: s.live_chat_color || '#e04858',
    button_label: s.live_chat_button_label || 'Chat with us',
    online_hours: s.live_chat_online_hours || '',
    is_online: s.live_chat_is_online === '1',
  })
})

// POST /api/live-chat/session — start or resume a chat session
router.post('/session', (req, res) => {
  if (!isEnabled()) return res.status(403).json({ error: 'Live chat is disabled' })

  const { session_key, visitor_name = 'Visitor', visitor_email = '', page_url = '' } = req.body
  if (!session_key) return res.status(400).json({ error: 'session_key required' })

  let session = db.prepare('SELECT * FROM live_chat_sessions WHERE session_key = ?').get(session_key)

  if (!session) {
    const info = db.prepare(`
      INSERT INTO live_chat_sessions (session_key, visitor_name, visitor_email, page_url)
      VALUES (?, ?, ?, ?)
    `).run(session_key, visitor_name, visitor_email, page_url)
    session = db.prepare('SELECT * FROM live_chat_sessions WHERE id = ?').get(info.lastInsertRowid)
  } else {
    // Update name/email if provided
    if (visitor_name !== 'Visitor' || visitor_email) {
      db.prepare(`
        UPDATE live_chat_sessions SET visitor_name=?, visitor_email=?, page_url=? WHERE id=?
      `).run(visitor_name || session.visitor_name, visitor_email || session.visitor_email, page_url || session.page_url, session.id)
      session = db.prepare('SELECT * FROM live_chat_sessions WHERE id = ?').get(session.id)
    }
  }

  res.json({ session_id: session.id, status: session.status })
})

// POST /api/live-chat/message — visitor sends a message
router.post('/message', (req, res) => {
  if (!isEnabled()) return res.status(403).json({ error: 'Live chat is disabled' })

  const { session_key, body } = req.body
  if (!session_key || !body?.trim()) return res.status(400).json({ error: 'session_key and body required' })

  const session = db.prepare('SELECT * FROM live_chat_sessions WHERE session_key = ?').get(session_key)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  if (session.status === 'closed') return res.status(400).json({ error: 'Chat session is closed' })

  const info = db.prepare(`
    INSERT INTO live_chat_messages (session_id, sender, body) VALUES (?, 'visitor', ?)
  `).run(session.id, body.trim())

  db.prepare(`
    UPDATE live_chat_sessions SET
      last_visitor_at = datetime('now'),
      unread_admin = unread_admin + 1,
      unread_visitor = 0
    WHERE id = ?
  `).run(session.id)

  const msg = db.prepare('SELECT * FROM live_chat_messages WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(msg)
})

// GET /api/live-chat/poll/:sessionKey — visitor polls for new messages
router.get('/poll/:sessionKey', (req, res) => {
  const session = db.prepare('SELECT * FROM live_chat_sessions WHERE session_key = ?').get(req.params.sessionKey)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const { since = 0 } = req.query
  const messages = db.prepare(`
    SELECT * FROM live_chat_messages
    WHERE session_id = ? AND id > ?
    ORDER BY created_at ASC
  `).all(session.id, Number(since))

  // Clear visitor unread
  if (messages.some(m => m.sender === 'admin')) {
    db.prepare(`UPDATE live_chat_sessions SET unread_visitor = 0 WHERE id = ?`).run(session.id)
  }

  res.json({
    session_id: session.id,
    status: session.status,
    assigned_to: session.assigned_to,
    messages,
    is_online: db.prepare(`SELECT value FROM settings WHERE key='live_chat_is_online'`).get()?.value === '1',
  })
})

// ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────

// GET /api/live-chat/sessions — list all sessions (admin)
router.get('/sessions', authMiddleware, (req, res) => {
  const { status = '', q = '', limit = 30, offset = 0 } = req.query
  let where = []
  let params = []

  if (status) { where.push('s.status = ?'); params.push(status) }
  if (q) {
    where.push('(s.visitor_name LIKE ? OR s.visitor_email LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }

  const cond = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const sessions = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM live_chat_messages WHERE session_id = s.id) as message_count,
      (SELECT body FROM live_chat_messages WHERE session_id = s.id ORDER BY id DESC LIMIT 1) as last_message
    FROM live_chat_sessions s
    ${cond}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM live_chat_sessions s ${cond}
  `).get(...params).c

  const stats = {
    open: db.prepare(`SELECT COUNT(*) as c FROM live_chat_sessions WHERE status='open'`).get().c,
    closed: db.prepare(`SELECT COUNT(*) as c FROM live_chat_sessions WHERE status='closed'`).get().c,
    total: db.prepare(`SELECT COUNT(*) as c FROM live_chat_sessions`).get().c,
    unread: db.prepare(`SELECT COUNT(*) as c FROM live_chat_sessions WHERE unread_admin > 0 AND status='open'`).get().c,
  }

  res.json({ sessions, total, stats })
})

// GET /api/live-chat/sessions/:id — single session with all messages (admin)
router.get('/sessions/:id', authMiddleware, (req, res) => {
  const session = db.prepare('SELECT * FROM live_chat_sessions WHERE id = ?').get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })

  const messages = db.prepare(`
    SELECT * FROM live_chat_messages WHERE session_id = ? ORDER BY created_at ASC
  `).all(session.id)

  // Clear admin unread
  db.prepare(`UPDATE live_chat_sessions SET unread_admin = 0 WHERE id = ?`).run(session.id)

  res.json({ ...session, messages })
})

// POST /api/live-chat/sessions/:id/reply — admin sends a message
router.post('/sessions/:id/reply', authMiddleware, (req, res) => {
  const session = db.prepare('SELECT * FROM live_chat_sessions WHERE id = ?').get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })
  if (session.status === 'closed') return res.status(400).json({ error: 'Session is closed' })

  const { body } = req.body
  if (!body?.trim()) return res.status(400).json({ error: 'body required' })

  const adminName = req.user?.name || 'Support'

  const info = db.prepare(`
    INSERT INTO live_chat_messages (session_id, sender, body) VALUES (?, ?, ?)
  `).run(session.id, `admin:${adminName}`, body.trim())

  db.prepare(`
    UPDATE live_chat_sessions SET
      last_admin_at = datetime('now'),
      assigned_to = ?,
      unread_visitor = unread_visitor + 1,
      unread_admin = 0
    WHERE id = ?
  `).run(adminName, session.id)

  const msg = db.prepare('SELECT * FROM live_chat_messages WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(msg)
})

// PUT /api/live-chat/sessions/:id — update session status / assign (admin)
router.put('/sessions/:id', authMiddleware, (req, res) => {
  const { status, assigned_to } = req.body
  const session = db.prepare('SELECT * FROM live_chat_sessions WHERE id = ?').get(req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })

  db.prepare(`
    UPDATE live_chat_sessions SET
      status = COALESCE(?, status),
      assigned_to = COALESCE(?, assigned_to)
    WHERE id = ?
  `).run(status || null, assigned_to !== undefined ? assigned_to : null, session.id)

  res.json(db.prepare('SELECT * FROM live_chat_sessions WHERE id = ?').get(session.id))
})

// DELETE /api/live-chat/sessions/:id — delete session (admin)
router.delete('/sessions/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM live_chat_sessions WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// GET /api/live-chat/admin-poll — admin polls for new unread sessions (for badge)
router.get('/admin-poll', authMiddleware, (req, res) => {
  const unread = db.prepare(`
    SELECT COUNT(*) as c FROM live_chat_sessions WHERE unread_admin > 0 AND status = 'open'
  `).get().c
  res.json({ unread })
})

// PUT /api/live-chat/online — toggle online status (admin)
router.put('/online', authMiddleware, (req, res) => {
  const { is_online } = req.body
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('live_chat_is_online', ?)`).run(is_online ? '1' : '0')
  res.json({ is_online })
})

// Seed settings
const liveChatDefaults = {
  live_chat_enabled: '0',
  live_chat_greeting: "Hi there 👋 How can we help you today?",
  live_chat_offline_message: "We're offline right now. Leave us a message!",
  live_chat_button_label: 'Chat with us',
  live_chat_color: '#e04858',
  live_chat_online_hours: '',
  live_chat_is_online: '0',
}
for (const [key, value] of Object.entries(liveChatDefaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

export default router
