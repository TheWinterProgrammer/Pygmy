// Pygmy CMS — Newsletter routes
import { Router } from 'express'
import { randomBytes } from 'crypto'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendNewsletterCampaign } from '../email.js'
import { fireWebhooks } from './webhooks.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken() {
  return randomBytes(24).toString('hex')
}

// ─── Public: subscribe ────────────────────────────────────────────────────────

// POST /api/newsletter/subscribe
router.post('/subscribe', (req, res) => {
  const { email, name = '' } = req.body
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  // Check if newsletter is enabled
  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'newsletter_enabled'").get()
  if (!enabled || enabled.value !== '1') {
    return res.status(403).json({ error: 'Newsletter not available' })
  }

  try {
    const existing = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(email.toLowerCase())
    if (existing) {
      if (existing.status === 'active') {
        return res.json({ ok: true, message: "You're already subscribed!" })
      }
      // Re-subscribe
      db.prepare(`
        UPDATE subscribers
        SET status = 'active', name = ?, token = ?, unsubscribed_at = NULL, subscribed_at = datetime('now')
        WHERE email = ?
      `).run(name.trim(), makeToken(), email.toLowerCase())
      return res.json({ ok: true, message: 'Welcome back! You have been re-subscribed.' })
    }

    db.prepare(`
      INSERT INTO subscribers (email, name, token)
      VALUES (?, ?, ?)
    `).run(email.toLowerCase(), name.trim(), makeToken())

    fireWebhooks('subscriber.new', { email: email.toLowerCase(), name: name.trim() })
    res.status(201).json({ ok: true, message: 'Subscribed successfully!' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/newsletter/unsubscribe?token=... — public unsubscribe link
router.get('/unsubscribe', (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).send('<p>Invalid unsubscribe link.</p>')

  const sub = db.prepare('SELECT * FROM subscribers WHERE token = ?').get(token)
  if (!sub) return res.status(404).send('<p>Unsubscribe link not found or already used.</p>')

  db.prepare(`
    UPDATE subscribers
    SET status = 'unsubscribed', unsubscribed_at = datetime('now')
    WHERE token = ?
  `).run(token)

  res.send(`<!DOCTYPE html>
<html><head><title>Unsubscribed</title>
<style>
  body { font-family: sans-serif; background: #1a1b1f; color: #e2e2e2; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  .card { background: rgba(255,255,255,0.07); border-radius: 1rem; padding: 2.5rem; text-align:center; max-width:400px; }
  h1 { margin-top:0; } a { color: #d95f68; }
</style></head>
<body><div class="card">
  <h1>✅ Unsubscribed</h1>
  <p>You've been removed from the mailing list. You won't receive any more emails.</p>
</div></body></html>`)
})

// ─── Admin: subscriber management ────────────────────────────────────────────

// GET /api/newsletter/subscribers
router.get('/subscribers', authMiddleware, (req, res) => {
  const { status, q } = req.query
  let sql = 'SELECT * FROM subscribers'
  const params = []
  const conditions = []

  if (status) { conditions.push('status = ?'); params.push(status) }
  if (q) { conditions.push('(email LIKE ? OR name LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY subscribed_at DESC'

  const rows = db.prepare(sql).all(...params)
  const total = db.prepare('SELECT COUNT(*) as n FROM subscribers').get().n
  const active = db.prepare("SELECT COUNT(*) as n FROM subscribers WHERE status = 'active'").get().n

  res.json({ subscribers: rows, total, active })
})

// GET /api/newsletter/stats
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM subscribers').get().n
  const active = db.prepare("SELECT COUNT(*) as n FROM subscribers WHERE status = 'active'").get().n
  const unsubscribed = db.prepare("SELECT COUNT(*) as n FROM subscribers WHERE status = 'unsubscribed'").get().n
  const campaigns = db.prepare('SELECT COUNT(*) as n FROM newsletter_campaigns').get().n
  const last_sent = db.prepare('SELECT sent_at FROM newsletter_campaigns ORDER BY sent_at DESC LIMIT 1').get()

  res.json({ total, active, unsubscribed, campaigns, last_sent: last_sent?.sent_at || null })
})

// GET /api/newsletter/campaigns
router.get('/campaigns', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM newsletter_campaigns ORDER BY sent_at DESC').all()
  res.json(rows)
})

// PUT /api/newsletter/subscribers/:id — update status
router.put('/subscribers/:id', authMiddleware, (req, res) => {
  const { status } = req.body
  if (!['active', 'unsubscribed'].includes(status)) {
    return res.status(400).json({ error: 'status must be active or unsubscribed' })
  }
  const sub = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Subscriber not found' })

  db.prepare(`
    UPDATE subscribers
    SET status = ?,
        unsubscribed_at = CASE WHEN ? = 'unsubscribed' THEN datetime('now') ELSE NULL END
    WHERE id = ?
  `).run(status, status, req.params.id)

  res.json(db.prepare('SELECT * FROM subscribers WHERE id = ?').get(req.params.id))
})

// DELETE /api/newsletter/subscribers/:id
router.delete('/subscribers/:id', authMiddleware, (req, res) => {
  const sub = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(req.params.id)
  if (!sub) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM subscribers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/newsletter/send — send campaign to all active subscribers
router.post('/send', authMiddleware, async (req, res) => {
  const { subject, content } = req.body
  if (!subject?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'subject and content are required' })
  }

  const active = db.prepare("SELECT * FROM subscribers WHERE status = 'active'").all()
  if (active.length === 0) {
    return res.status(400).json({ error: 'No active subscribers to send to' })
  }

  // Record campaign first
  const campaign = db.prepare(`
    INSERT INTO newsletter_campaigns (subject, content, sent_to)
    VALUES (?, ?, ?)
  `).run(subject.trim(), content, active.length)

  // Fire and forget — send async
  res.json({ ok: true, sent_to: active.length, campaign_id: campaign.lastInsertRowid })

  // Send emails in background
  const siteName = db.prepare("SELECT value FROM settings WHERE key = 'site_name'").get()?.value || 'Pygmy CMS'
  const siteUrl  = db.prepare("SELECT value FROM settings WHERE key = 'site_url'").get()?.value || 'http://localhost:5174'

  for (const sub of active) {
    await sendNewsletterCampaign({
      to: sub.email,
      name: sub.name,
      subject,
      content,
      unsubscribeToken: sub.token,
      siteName,
      siteUrl,
    })
  }
})

export default router
