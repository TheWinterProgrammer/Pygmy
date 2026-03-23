// Pygmy CMS — Web Push Notifications API (Phase 37)
import { Router } from 'express'
import webpush from 'web-push'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function getVapidKeys () {
  const publicKey  = db.prepare(`SELECT value FROM settings WHERE key = 'push_vapid_public'`).get()?.value
  const privateKey = db.prepare(`SELECT value FROM settings WHERE key = 'push_vapid_private'`).get()?.value
  const subject    = db.prepare(`SELECT value FROM settings WHERE key = 'push_vapid_subject'`).get()?.value || 'mailto:admin@pygmy.local'
  return { publicKey, privateKey, subject }
}

function configureWebPush () {
  const { publicKey, privateKey, subject } = getVapidKeys()
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    return true
  }
  return false
}

// ── VAPID Key Management ──────────────────────────────────────────────────────

// GET /api/push/vapid-public — return public VAPID key (public endpoint for SW)
router.get('/vapid-public', (req, res) => {
  const { publicKey } = getVapidKeys()
  if (!publicKey) return res.status(404).json({ error: 'Web Push not configured' })
  res.json({ publicKey })
})

// POST /api/push/generate-vapid — generate + store new VAPID keys (admin)
router.post('/generate-vapid', authMiddleware, (req, res) => {
  const keys = webpush.generateVAPIDKeys()
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
  upsert.run('push_vapid_public', keys.publicKey)
  upsert.run('push_vapid_private', keys.privateKey)
  res.json({ publicKey: keys.publicKey, message: 'VAPID keys generated and saved' })
})

// ── Subscription Management ───────────────────────────────────────────────────

// POST /api/push/subscribe — register a push subscription (public)
router.post('/subscribe', (req, res) => {
  const { subscription, session_id, page_path } = req.body
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription object' })

  const endpoint = subscription.endpoint
  const p256dh   = subscription.keys?.p256dh || ''
  const auth     = subscription.keys?.auth    || ''

  db.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, session_id, page_path)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh     = excluded.p256dh,
      auth       = excluded.auth,
      session_id = COALESCE(excluded.session_id, push_subscriptions.session_id),
      active     = 1,
      updated_at = datetime('now')
  `).run(endpoint, p256dh, auth, session_id || null, page_path || '/')

  res.json({ ok: true })
})

// DELETE /api/push/unsubscribe — remove subscription (public, by endpoint)
router.delete('/unsubscribe', (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' })
  db.prepare(`UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?`).run(endpoint)
  res.json({ ok: true })
})

// GET /api/push/subscriptions — list subscriptions (admin)
router.get('/subscriptions', authMiddleware, (req, res) => {
  const total  = db.prepare(`SELECT COUNT(*) AS c FROM push_subscriptions WHERE active = 1`).get().c
  const recent = db.prepare(`
    SELECT id, endpoint, session_id, page_path, active, created_at, updated_at
    FROM push_subscriptions WHERE active = 1
    ORDER BY created_at DESC LIMIT 100
  `).all()
  res.json({ total, subscriptions: recent })
})

// ── Campaigns ────────────────────────────────────────────────────────────────

// GET /api/push/campaigns — list all campaigns (admin)
router.get('/campaigns', authMiddleware, (req, res) => {
  const campaigns = db.prepare(`
    SELECT * FROM push_campaigns ORDER BY created_at DESC
  `).all()
  res.json(campaigns)
})

// GET /api/push/campaigns/:id — single campaign (admin)
router.get('/campaigns/:id', authMiddleware, (req, res) => {
  const c = db.prepare(`SELECT * FROM push_campaigns WHERE id = ?`).get(Number(req.params.id))
  if (!c) return res.status(404).json({ error: 'Campaign not found' })
  res.json(c)
})

// POST /api/push/campaigns — create a campaign (admin)
router.post('/campaigns', authMiddleware, (req, res) => {
  const { title, body, icon, image, url, badge, schedule_at } = req.body
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' })

  const result = db.prepare(`
    INSERT INTO push_campaigns (title, body, icon, image, url, badge, schedule_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    body.trim(),
    icon  || null,
    image || null,
    url   || null,
    badge || null,
    schedule_at || null,
    schedule_at ? 'scheduled' : 'draft'
  )

  const campaign = db.prepare(`SELECT * FROM push_campaigns WHERE id = ?`).get(result.lastInsertRowid)
  res.status(201).json(campaign)
})

// PUT /api/push/campaigns/:id — update campaign (admin)
router.put('/campaigns/:id', authMiddleware, (req, res) => {
  const { title, body, icon, image, url, badge, schedule_at, status } = req.body
  const existing = db.prepare(`SELECT * FROM push_campaigns WHERE id = ?`).get(Number(req.params.id))
  if (!existing) return res.status(404).json({ error: 'Campaign not found' })
  if (existing.status === 'sent') return res.status(400).json({ error: 'Cannot edit a sent campaign' })

  db.prepare(`
    UPDATE push_campaigns SET
      title       = COALESCE(?, title),
      body        = COALESCE(?, body),
      icon        = ?,
      image       = ?,
      url         = ?,
      badge       = ?,
      schedule_at = ?,
      status      = COALESCE(?, status)
    WHERE id = ?
  `).run(
    title?.trim() || null, body?.trim() || null,
    icon !== undefined ? (icon || null) : existing.icon,
    image !== undefined ? (image || null) : existing.image,
    url !== undefined ? (url || null) : existing.url,
    badge !== undefined ? (badge || null) : existing.badge,
    schedule_at !== undefined ? (schedule_at || null) : existing.schedule_at,
    status || null,
    Number(req.params.id)
  )

  res.json(db.prepare(`SELECT * FROM push_campaigns WHERE id = ?`).get(Number(req.params.id)))
})

// DELETE /api/push/campaigns/:id — delete draft campaign (admin)
router.delete('/campaigns/:id', authMiddleware, (req, res) => {
  const c = db.prepare(`SELECT * FROM push_campaigns WHERE id = ?`).get(Number(req.params.id))
  if (!c) return res.status(404).json({ error: 'Campaign not found' })
  db.prepare(`DELETE FROM push_campaigns WHERE id = ?`).run(Number(req.params.id))
  res.json({ ok: true })
})

// POST /api/push/campaigns/:id/send — send a campaign immediately (admin)
router.post('/campaigns/:id/send', authMiddleware, async (req, res) => {
  const campaign = db.prepare(`SELECT * FROM push_campaigns WHERE id = ?`).get(Number(req.params.id))
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (campaign.status === 'sent') return res.status(400).json({ error: 'Campaign already sent' })

  if (!configureWebPush()) {
    return res.status(400).json({ error: 'VAPID keys not configured. Generate them in Settings → Web Push.' })
  }

  const subs = db.prepare(`SELECT * FROM push_subscriptions WHERE active = 1`).all()
  if (!subs.length) return res.status(400).json({ error: 'No active subscribers' })

  const payload = JSON.stringify({
    title:  campaign.title,
    body:   campaign.body,
    icon:   campaign.icon  || '/favicon.ico',
    image:  campaign.image || undefined,
    badge:  campaign.badge || undefined,
    data:   { url: campaign.url || '/' }
  })

  let sent = 0, failed = 0
  const failedEndpoints = []

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    }
    try {
      await webpush.sendNotification(pushSub, payload)
      sent++
    } catch (err) {
      failed++
      failedEndpoints.push(sub.endpoint)
      // 410 Gone or 404 = subscription expired, mark inactive
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare(`UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?`).run(sub.endpoint)
      }
    }
  }

  db.prepare(`
    UPDATE push_campaigns SET
      status    = 'sent',
      sent_at   = datetime('now'),
      sent_count = ?,
      fail_count = ?
    WHERE id = ?
  `).run(sent, failed, Number(req.params.id))

  res.json({ ok: true, sent, failed, total: subs.length })
})

// GET /api/push/stats — overview stats (admin)
router.get('/stats', authMiddleware, (req, res) => {
  const subscribers = db.prepare(`SELECT COUNT(*) AS c FROM push_subscriptions WHERE active = 1`).get().c
  const total_campaigns = db.prepare(`SELECT COUNT(*) AS c FROM push_campaigns`).get().c
  const sent_campaigns  = db.prepare(`SELECT COUNT(*) AS c FROM push_campaigns WHERE status = 'sent'`).get().c
  const total_sent      = db.prepare(`SELECT COALESCE(SUM(sent_count), 0) AS c FROM push_campaigns`).get().c
  res.json({ subscribers, total_campaigns, sent_campaigns, total_sent })
})

export default router
