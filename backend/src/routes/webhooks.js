// Pygmy CMS — Webhook Manager
import { Router } from 'express'
import { createHmac } from 'crypto'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseWebhook(row) {
  return { ...row, events: JSON.parse(row.events || '[]'), active: !!row.active }
}

/**
 * Fire all active webhooks registered for a given event.
 * Runs async in the background — never throws to callers.
 * @param {string} event  e.g. 'post.published'
 * @param {object} payload  any JSON-serialisable data
 */
export async function fireWebhooks(event, payload) {
  let hooks
  try {
    hooks = db.prepare("SELECT * FROM webhooks WHERE active = 1").all()
      .map(parseWebhook)
      .filter(h => h.events.includes(event) || h.events.includes('*'))
  } catch { return }

  if (!hooks.length) return

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload })

  for (const hook of hooks) {
    ;(async () => {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Pygmy-CMS/1.0',
        'X-Pygmy-Event': event,
      }
      if (hook.secret) {
        const sig = createHmac('sha256', hook.secret).update(body).digest('hex')
        headers['X-Pygmy-Signature'] = `sha256=${sig}`
      }

      let status = null
      let errMsg = null
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        const res = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        })
        clearTimeout(timer)
        status = res.status
      } catch (e) {
        errMsg = e.message || 'Request failed'
      }

      try {
        db.prepare(`
          UPDATE webhooks
          SET last_triggered_at = datetime('now'),
              last_status = ?,
              last_error  = ?
          WHERE id = ?
        `).run(status, errMsg, hook.id)
      } catch {}
    })()
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/webhooks — list all (admin)
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all()
  res.json(rows.map(parseWebhook))
})

// GET /api/webhooks/events — list supported event names
router.get('/events', authMiddleware, (req, res) => {
  res.json([
    { value: '*',                  label: '* — All events' },
    { value: 'post.created',       label: 'Post created' },
    { value: 'post.updated',       label: 'Post updated' },
    { value: 'post.published',     label: 'Post published' },
    { value: 'post.deleted',       label: 'Post deleted' },
    { value: 'page.created',       label: 'Page created' },
    { value: 'page.updated',       label: 'Page updated' },
    { value: 'page.published',     label: 'Page published' },
    { value: 'page.deleted',       label: 'Page deleted' },
    { value: 'product.created',    label: 'Product created' },
    { value: 'product.updated',    label: 'Product updated' },
    { value: 'product.published',  label: 'Product published' },
    { value: 'product.deleted',    label: 'Product deleted' },
    { value: 'comment.approved',   label: 'Comment approved' },
    { value: 'form.submitted',     label: 'Form submitted' },
    { value: 'subscriber.new',     label: 'New newsletter subscriber' },
    { value: 'media.uploaded',     label: 'Media uploaded' },
  ])
})

// POST /api/webhooks — create
router.post('/', authMiddleware, (req, res) => {
  const { name, url, events = [], secret = '', active = 1 } = req.body
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' })
  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO webhooks (name, url, events, secret, active)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, JSON.stringify(events), secret, active ? 1 : 0)

  const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(lastInsertRowid)
  res.status(201).json(parseWebhook(row))
})

// PUT /api/webhooks/:id — update
router.put('/:id', authMiddleware, (req, res) => {
  const { name, url, events, secret, active } = req.body
  const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id)
  if (!hook) return res.status(404).json({ error: 'Webhook not found' })

  if (url) {
    try { new URL(url) } catch { return res.status(400).json({ error: 'Invalid URL' }) }
  }

  db.prepare(`
    UPDATE webhooks
    SET name = ?, url = ?, events = ?, secret = ?, active = ?
    WHERE id = ?
  `).run(
    name    ?? hook.name,
    url     ?? hook.url,
    events  !== undefined ? JSON.stringify(events) : hook.events,
    secret  !== undefined ? secret : hook.secret,
    active  !== undefined ? (active ? 1 : 0) : hook.active,
    hook.id
  )

  res.json(parseWebhook(db.prepare('SELECT * FROM webhooks WHERE id = ?').get(hook.id)))
})

// DELETE /api/webhooks/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const info = db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id)
  if (!info.changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

// POST /api/webhooks/:id/test — fire a test delivery
router.post('/:id/test', authMiddleware, async (req, res) => {
  const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id)
  if (!hook) return res.status(404).json({ error: 'Not found' })

  const parsed = parseWebhook(hook)
  const body = JSON.stringify({
    event: 'test',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test delivery from Pygmy CMS.' }
  })
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Pygmy-CMS/1.0',
    'X-Pygmy-Event': 'test',
  }
  if (parsed.secret) {
    const sig = createHmac('sha256', parsed.secret).update(body).digest('hex')
    headers['X-Pygmy-Signature'] = `sha256=${sig}`
  }

  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10_000)
    const r = await fetch(parsed.url, { method: 'POST', headers, body, signal: controller.signal })
    db.prepare(`UPDATE webhooks SET last_triggered_at=datetime('now'), last_status=?, last_error=NULL WHERE id=?`)
      .run(r.status, hook.id)
    res.json({ ok: true, status: r.status })
  } catch (e) {
    db.prepare(`UPDATE webhooks SET last_triggered_at=datetime('now'), last_status=NULL, last_error=? WHERE id=?`)
      .run(e.message, hook.id)
    res.status(502).json({ error: e.message })
  }
})

export default router
