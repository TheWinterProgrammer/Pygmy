// Pygmy CMS — Cookie Consent Manager (Phase 63)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const r = Router()

// Bootstrap table (idempotent)
db.prepare(`
  CREATE TABLE IF NOT EXISTS cookie_consents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    ip          TEXT NOT NULL DEFAULT '',
    categories  TEXT NOT NULL DEFAULT '{}',
    accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cookie_consents_session ON cookie_consents(session_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cookie_consents_date   ON cookie_consents(accepted_at)`).run()

// Seed default consent settings
const consentDefaults = {
  cookie_consent_enabled:     '1',
  cookie_consent_position:    'bottom',   // bottom | bottom-left | bottom-right
  cookie_consent_title:       'We use cookies',
  cookie_consent_message:     'We use cookies to enhance your browsing experience, serve personalised content, and analyse traffic. By clicking "Accept All" you consent to our use of cookies.',
  cookie_consent_btn_accept:  'Accept All',
  cookie_consent_btn_reject:  'Reject All',
  cookie_consent_btn_manage:  'Manage Preferences',
  cookie_consent_show_manage: '1',
  cookie_consent_analytics:   '1',   // analytics category enabled
  cookie_consent_marketing:   '1',   // marketing category enabled
  cookie_consent_preferences: '1',   // preferences category enabled
  cookie_consent_privacy_url: '',
  cookie_consent_cookie_url:  '',
  cookie_consent_expiry_days: '365',
}
for (const [key, value] of Object.entries(consentDefaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// ─── GET /api/cookie-consent/config — public banner config ───────────────────
r.get('/config', (req, res) => {
  const rows = db.prepare(
    `SELECT key, value FROM settings WHERE key LIKE 'cookie_consent_%'`
  ).all()
  const cfg = {}
  for (const { key, value } of rows) cfg[key] = value
  res.json(cfg)
})

// ─── POST /api/cookie-consent/record — record a consent event (public) ───────
r.post('/record', (req, res) => {
  const { session_id, categories = {} } = req.body
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  const ip = req.ip || req.headers['x-forwarded-for'] || ''
  const cats = JSON.stringify(categories)

  // Upsert by session_id
  const existing = db.prepare('SELECT id FROM cookie_consents WHERE session_id = ?').get(session_id)
  if (existing) {
    db.prepare(`UPDATE cookie_consents SET categories = ?, updated_at = datetime('now') WHERE session_id = ?`).run(cats, session_id)
  } else {
    db.prepare(`INSERT INTO cookie_consents (session_id, ip, categories) VALUES (?, ?, ?)`).run(session_id, ip.slice(0, 64), cats)
  }
  res.json({ ok: true })
})

// ─── GET /api/cookie-consent — admin: list consents (paginated) ───────────────
r.get('/', auth, (req, res) => {
  const { limit = 50, offset = 0, days = 30 } = req.query
  const since = `datetime('now', '-${parseInt(days)} days')`

  const rows = db.prepare(`
    SELECT * FROM cookie_consents
    WHERE accepted_at >= ${since}
    ORDER BY accepted_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset))

  const total = db.prepare(`SELECT COUNT(*) AS n FROM cookie_consents WHERE accepted_at >= ${since}`).get().n

  // Parse categories JSON for each row
  const parsed = rows.map(row => ({ ...row, categories: JSON.parse(row.categories || '{}') }))
  res.json({ consents: parsed, total })
})

// ─── GET /api/cookie-consent/stats — admin: consent stats ────────────────────
r.get('/stats', auth, (req, res) => {
  const { days = 30 } = req.query
  const since = `datetime('now', '-${parseInt(days)} days')`

  const total = db.prepare(`SELECT COUNT(*) AS n FROM cookie_consents WHERE accepted_at >= ${since}`).get().n

  // Count by category acceptance
  const rows = db.prepare(`SELECT categories FROM cookie_consents WHERE accepted_at >= ${since}`).all()
  const counts = { all: 0, analytics: 0, marketing: 0, preferences: 0, none: 0 }

  for (const row of rows) {
    const cats = JSON.parse(row.categories || '{}')
    const hasAnalytics = cats.analytics === true
    const hasMarketing = cats.marketing === true
    const hasPreferences = cats.preferences === true
    if (hasAnalytics && hasMarketing && hasPreferences) counts.all++
    else if (!hasAnalytics && !hasMarketing && !hasPreferences) counts.none++
    if (hasAnalytics) counts.analytics++
    if (hasMarketing) counts.marketing++
    if (hasPreferences) counts.preferences++
  }

  // Daily series
  const daily = db.prepare(`
    SELECT date(accepted_at) AS day, COUNT(*) AS n
    FROM cookie_consents
    WHERE accepted_at >= ${since}
    GROUP BY day ORDER BY day ASC
  `).all()

  res.json({ total, counts, daily })
})

// ─── DELETE /api/cookie-consent/:id — admin: delete a record ─────────────────
r.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM cookie_consents WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── DELETE /api/cookie-consent/purge/old — admin: purge old records ─────────
r.delete('/purge/old', auth, (req, res) => {
  const { days = 365 } = req.query
  const info = db.prepare(`DELETE FROM cookie_consents WHERE accepted_at < datetime('now', '-${parseInt(days)} days')`).run()
  res.json({ ok: true, deleted: info.changes })
})

export default r
