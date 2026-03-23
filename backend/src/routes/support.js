// Pygmy CMS — Support Tickets API (Phase 32)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTkt(row) {
  if (!row) return null
  return {
    ...row,
    tags: (() => { try { return JSON.parse(row.tags || '[]') } catch { return [] } })(),
  }
}

function parseMsgRow(row) {
  if (!row) return null
  return {
    ...row,
    attachments: (() => { try { return JSON.parse(row.attachments || '[]') } catch { return [] } })(),
  }
}

function genTicketNumber() {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `TKT-${date}-${rand}`
}

function getEmailCfg() {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN
    ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','site_name','site_url',
     'support_notify_email','support_auto_reply_enabled','support_auto_reply_msg')
  `).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))
  return s
}

async function sendAutoReply(ticket) {
  const cfg = getEmailCfg()
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) return
  if (cfg.support_auto_reply_enabled !== '1') return
  const msg = (cfg.support_auto_reply_msg || "Thanks! We received your message.").replace(/{{ticket_number}}/g, ticket.ticket_number)
  const siteName = cfg.site_name || 'Pygmy CMS'
  const accent = '#b0303a'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:0;background:#1a1a1e;font-family:'Segoe UI',Arial,sans-serif;color:#e2e2e8}
.wrap{max-width:600px;margin:2rem auto;background:#22232a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
.header{background:${accent};padding:1.5rem 2rem}.header h1{margin:0;font-size:1.2rem;color:#fff;font-weight:700}
.body{padding:2rem;line-height:1.6;font-size:.92rem;color:#b0b0c0}
.ref{display:inline-block;background:rgba(176,48,58,0.2);border:1px solid ${accent};border-radius:8px;padding:.3rem .8rem;font-weight:700;color:${accent};margin:.5rem 0}
</style></head><body>
<div class="wrap"><div class="header"><h1>📧 ${siteName} Support</h1></div>
<div class="body">
<h2>Hi ${ticket.customer_name},</h2>
<p>${msg}</p>
<p>Your ticket reference: <span class="ref">#${ticket.ticket_number}</span></p>
<p>Subject: <strong>${ticket.subject}</strong></p>
<p style="margin-top:1.5rem;font-size:.8rem;color:#555">— ${siteName} Support Team</p>
</div></div></body></html>`
  try {
    await sendMailTo({
      smtp_host: cfg.smtp_host,
      smtp_port: cfg.smtp_port,
      smtp_user: cfg.smtp_user,
      smtp_pass: cfg.smtp_pass,
      smtp_from: cfg.smtp_from || cfg.smtp_user,
    }, {
      to: ticket.customer_email,
      subject: `[${ticket.ticket_number}] We received your message`,
      html,
      text: msg,
    })
  } catch (e) {
    console.error('[support] auto-reply error:', e.message)
  }
}

async function notifyAdmin(ticket, firstMessage) {
  const cfg = getEmailCfg()
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) return
  const to = cfg.support_notify_email
  if (!to) return
  const siteName = cfg.site_name || 'Pygmy CMS'
  const siteUrl = cfg.site_url || 'http://localhost:5173'
  const accent = '#b0303a'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:0;background:#1a1a1e;font-family:'Segoe UI',Arial,sans-serif;color:#e2e2e8}
.wrap{max-width:600px;margin:2rem auto;background:#22232a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
.header{background:${accent};padding:1.5rem 2rem}.header h1{margin:0;font-size:1.2rem;color:#fff;font-weight:700}
.body{padding:2rem;line-height:1.6;font-size:.92rem;color:#b0b0c0}
.msg-box{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:1rem;margin:1rem 0;font-style:italic}
.btn{display:inline-block;background:${accent};color:#fff;padding:.6rem 1.4rem;border-radius:8px;text-decoration:none;font-weight:600;margin-top:1rem}
</style></head><body>
<div class="wrap"><div class="header"><h1>🎫 New Support Ticket — ${siteName}</h1></div>
<div class="body">
<p><strong>Ticket:</strong> #${ticket.ticket_number}</p>
<p><strong>From:</strong> ${ticket.customer_name} &lt;${ticket.customer_email}&gt;</p>
<p><strong>Subject:</strong> ${ticket.subject}</p>
<p><strong>Priority:</strong> ${ticket.priority}</p>
<div class="msg-box">${firstMessage}</div>
<a href="${siteUrl}/support" class="btn">View in Admin Panel</a>
</div></div></body></html>`
  try {
    await sendMailTo({
      smtp_host: cfg.smtp_host,
      smtp_port: cfg.smtp_port,
      smtp_user: cfg.smtp_user,
      smtp_pass: cfg.smtp_pass,
      smtp_from: cfg.smtp_from || cfg.smtp_user,
    }, {
      to,
      subject: `[${ticket.ticket_number}] New ticket: ${ticket.subject}`,
      html,
      text: `New ticket from ${ticket.customer_name}: ${ticket.subject}\n\n${firstMessage}`,
    })
  } catch (e) {
    console.error('[support] admin notify error:', e.message)
  }
}

// ── Public: check online status ───────────────────────────────────────────────
router.get('/status', (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'support_online_hours'").get()
  const widgetRow = db.prepare("SELECT value FROM settings WHERE key = 'support_widget_enabled'").get()
  if (widgetRow?.value !== '1') return res.json({ online: false, enabled: false })

  let online = false
  try {
    const hours = JSON.parse(row?.value || '{}')
    const now = new Date()
    const days = ['sun','mon','tue','wed','thu','fri','sat']
    const dayKey = days[now.getDay()]
    const range = hours[dayKey] || ''
    if (range) {
      const [start, end] = range.split('-')
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      const current = now.getHours() * 60 + now.getMinutes()
      online = current >= sh * 60 + sm && current <= eh * 60 + em
    }
  } catch {}

  const greetingRow = db.prepare("SELECT value FROM settings WHERE key = 'support_widget_greeting'").get()
  const offlineRow = db.prepare("SELECT value FROM settings WHERE key = 'support_widget_offline_msg'").get()

  res.json({
    online,
    enabled: true,
    greeting: greetingRow?.value || 'Hi! How can we help?',
    offline_msg: offlineRow?.value || "We're offline. Leave a message!",
  })
})

// ── Public: create ticket (widget / contact page) ─────────────────────────────
router.post('/', async (req, res) => {
  const { subject, customer_name, customer_email, message, priority = 'normal', channel = 'widget', order_number, tags = [] } = req.body
  if (!subject || !customer_name || !customer_email || !message) {
    return res.status(400).json({ error: 'subject, customer_name, customer_email, message are required' })
  }

  let ticket_number = genTicketNumber()
  // Ensure unique
  while (db.prepare('SELECT id FROM support_tickets WHERE ticket_number = ?').get(ticket_number)) {
    ticket_number = genTicketNumber()
  }

  const create = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO support_tickets (ticket_number, subject, status, priority, channel, customer_name, customer_email, order_number, tags, last_reply_at)
      VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(ticket_number, subject, priority, channel, customer_name, customer_email, order_number || null, JSON.stringify(tags))

    const ticketId = result.lastInsertRowid

    db.prepare(`
      INSERT INTO ticket_messages (ticket_id, sender, sender_name, sender_email, message)
      VALUES (?, 'customer', ?, ?, ?)
    `).run(ticketId, customer_name, customer_email, message)

    return ticketId
  })

  const ticketId = create()
  const ticket = parseTkt(db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId))

  // Fire async emails
  sendAutoReply(ticket).catch(() => {})
  notifyAdmin(ticket, message).catch(() => {})

  res.status(201).json({ ticket_number: ticket.ticket_number, id: ticket.id })
})

// ── Public: get ticket by number + email (for customers to check status) ──────
router.post('/lookup', (req, res) => {
  const { ticket_number, email } = req.body
  if (!ticket_number || !email) return res.status(400).json({ error: 'ticket_number and email required' })
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE ticket_number = ? AND customer_email = ?').get(ticket_number, email)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  const messages = db.prepare(`
    SELECT * FROM ticket_messages WHERE ticket_id = ? AND is_internal = 0 ORDER BY created_at ASC
  `).all(ticket.id).map(parseMsgRow)
  res.json({ ticket: parseTkt(ticket), messages })
})

// ── Public: customer adds a reply to their own ticket ─────────────────────────
router.post('/:ticketNumber/reply', async (req, res) => {
  const { email, message, sender_name } = req.body
  if (!email || !message) return res.status(400).json({ error: 'email and message required' })
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE ticket_number = ?').get(req.params.ticketNumber)
  if (!ticket) return res.status(404).json({ error: 'Not found' })
  if (ticket.customer_email !== email) return res.status(403).json({ error: 'Forbidden' })

  db.prepare(`INSERT INTO ticket_messages (ticket_id, sender, sender_name, sender_email, message) VALUES (?, 'customer', ?, ?, ?)`).run(
    ticket.id, sender_name || ticket.customer_name, email, message
  )
  db.prepare("UPDATE support_tickets SET last_reply_at = datetime('now'), status = CASE WHEN status = 'waiting' THEN 'in_progress' ELSE status END WHERE id = ?").run(ticket.id)
  res.json({ ok: true })
})

// ─── Admin: list tickets ───────────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { status, priority, q, assigned_to, limit = 25, offset = 0 } = req.query
  let where = []
  const params = []

  if (status) { where.push('t.status = ?'); params.push(status) }
  if (priority) { where.push('t.priority = ?'); params.push(priority) }
  if (assigned_to) { where.push('t.assigned_to = ?'); params.push(Number(assigned_to)) }
  if (q) {
    where.push('(t.subject LIKE ? OR t.customer_name LIKE ? OR t.customer_email LIKE ? OR t.ticket_number LIKE ?)')
    const l = `%${q}%`; params.push(l, l, l, l)
  }

  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const rows = db.prepare(`
    SELECT t.*, u.name AS assigned_name,
      (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) AS message_count,
      (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND sender = 'customer' AND is_internal = 0) AS customer_messages
    FROM support_tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    ${w}
    ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
             t.last_reply_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`SELECT COUNT(*) AS c FROM support_tickets t ${w}`).get(...params).c
  res.json({ tickets: rows.map(parseTkt), total })
})

// ─── Admin: stats ─────────────────────────────────────────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS c FROM support_tickets").get().c
  const open = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE status = 'open'").get().c
  const in_progress = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE status = 'in_progress'").get().c
  const waiting = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE status = 'waiting'").get().c
  const resolved = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE status IN ('resolved','closed')").get().c
  const unread = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE is_read = 0").get().c
  const urgent = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE priority IN ('urgent','high') AND status NOT IN ('resolved','closed')").get().c
  res.json({ total, open, in_progress, waiting, resolved, unread, urgent })
})

// ─── Admin: single ticket ─────────────────────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Not found' })
  // Mark as read
  db.prepare('UPDATE support_tickets SET is_read = 1 WHERE id = ?').run(ticket.id)
  const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticket.id).map(parseMsgRow)
  res.json({ ticket: parseTkt(ticket), messages })
})

// ─── Admin: update ticket (status, priority, assign, tags) ────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Not found' })

  const { status, priority, assigned_to, tags, is_read } = req.body
  const updates = []
  const params = []

  if (status !== undefined) {
    updates.push('status = ?'); params.push(status)
    if (status === 'resolved') { updates.push("resolved_at = datetime('now')") }
    if (status === 'closed') { updates.push("closed_at = datetime('now')") }
  }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority) }
  if (assigned_to !== undefined) { updates.push('assigned_to = ?'); params.push(assigned_to) }
  if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)) }
  if (is_read !== undefined) { updates.push('is_read = ?'); params.push(is_read ? 1 : 0) }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' })
  db.prepare(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params, ticket.id)
  res.json(parseTkt(db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticket.id)))
})

// ─── Admin: post a reply (or internal note) ────────────────────────────────────
router.post('/:id/messages', authMiddleware, async (req, res) => {
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Not found' })

  const { message, is_internal = false } = req.body
  const agent = req.user
  if (!message) return res.status(400).json({ error: 'message required' })

  db.prepare(`INSERT INTO ticket_messages (ticket_id, sender, sender_name, sender_email, agent_id, message, is_internal)
    VALUES (?, 'agent', ?, ?, ?, ?, ?)`).run(
    ticket.id, agent.name || 'Support', agent.email, agent.id, message, is_internal ? 1 : 0
  )

  const newStatus = is_internal ? ticket.status : 'waiting'
  db.prepare("UPDATE support_tickets SET last_reply_at = datetime('now'), status = ? WHERE id = ?").run(newStatus, ticket.id)

  // Email customer when agent replies (non-internal)
  if (!is_internal) {
    const cfg = getEmailCfg()
    if (cfg.smtp_host && cfg.smtp_user && cfg.smtp_pass && ticket.customer_email) {
      const siteName = cfg.site_name || 'Pygmy CMS'
      const accent = '#b0303a'
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:0;background:#1a1a1e;font-family:'Segoe UI',Arial,sans-serif;color:#e2e2e8}
.wrap{max-width:600px;margin:2rem auto;background:#22232a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
.header{background:${accent};padding:1.5rem 2rem}.header h1{margin:0;font-size:1.2rem;color:#fff;font-weight:700}
.body{padding:2rem;line-height:1.6;font-size:.92rem;color:#b0b0c0}
.msg-box{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:1rem;margin:1rem 0}
</style></head><body>
<div class="wrap"><div class="header"><h1>💬 Reply from ${siteName} Support</h1></div>
<div class="body">
<p>Hi ${ticket.customer_name},</p>
<p>You have a new reply on ticket <strong>#${ticket.ticket_number}</strong>: <em>${ticket.subject}</em></p>
<div class="msg-box"><p>${message.replace(/\n/g, '<br>')}</p><p><strong>— ${agent.name || 'Support Team'}</strong></p></div>
<p style="margin-top:1.5rem;font-size:.8rem;color:#555">— ${siteName} Support Team</p>
</div></div></body></html>`

      sendMailTo({
        smtp_host: cfg.smtp_host,
        smtp_port: cfg.smtp_port,
        smtp_user: cfg.smtp_user,
        smtp_pass: cfg.smtp_pass,
        smtp_from: cfg.smtp_from || cfg.smtp_user,
      }, {
        to: ticket.customer_email,
        subject: `Re: [${ticket.ticket_number}] ${ticket.subject}`,
        html,
        text: message,
      }).catch(() => {})
    }
  }

  res.json({ ok: true, status: newStatus })
})

// ─── Admin: delete ticket ─────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const ticket = db.prepare('SELECT id FROM support_tickets WHERE id = ?').get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM support_tickets WHERE id = ?').run(ticket.id)
  res.json({ ok: true })
})

export default router
