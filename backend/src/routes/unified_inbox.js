// Pygmy CMS — Unified Inbox API (Phase 72)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/unified-inbox — combined inbox of support tickets, contact forms, order messages
router.get('/', authMiddleware, (req, res) => {
  const { q = '', type = '', limit = 50, offset = 0 } = req.query

  const searchLike = `%${q}%`

  // Support tickets
  let tickets = []
  if (!type || type === 'support') {
    tickets = db.prepare(`
      SELECT
        'support' as source,
        t.id,
        t.subject as subject,
        t.customer_name as sender_name,
        t.customer_email as sender_email,
        t.status,
        t.priority,
        t.created_at,
        t.updated_at,
        (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count,
        (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND is_internal = 0 AND created_at > COALESCE(
          (SELECT MAX(created_at) FROM ticket_messages WHERE ticket_id = t.id AND sender = 'admin'), '1970-01-01'
        )) as unread
      FROM support_tickets t
      WHERE (? = '' OR t.subject LIKE ? OR t.customer_name LIKE ? OR t.customer_email LIKE ?)
      ORDER BY t.updated_at DESC
      LIMIT 200
    `).all(q, searchLike, searchLike, searchLike)
  }

  // Contact form submissions
  let contacts = []
  if (!type || type === 'contact') {
    contacts = db.prepare(`
      SELECT
        'contact' as source,
        id,
        subject,
        name as sender_name,
        email as sender_email,
        status,
        NULL as priority,
        created_at,
        created_at as updated_at,
        1 as message_count,
        CASE WHEN status = 'unread' THEN 1 ELSE 0 END as unread
      FROM form_submissions
      WHERE (? = '' OR subject LIKE ? OR name LIKE ? OR email LIKE ?)
      ORDER BY created_at DESC
      LIMIT 200
    `).all(q, searchLike, searchLike, searchLike)
  }

  // Order admin messages (from order_timeline with action = 'message_sent')
  let orderMsgs = []
  if (!type || type === 'order') {
    orderMsgs = db.prepare(`
      SELECT
        'order' as source,
        ot.id,
        'Re: Order #' || o.order_number as subject,
        o.customer_name as sender_name,
        o.customer_email as sender_email,
        o.status,
        NULL as priority,
        ot.created_at,
        ot.created_at as updated_at,
        1 as message_count,
        0 as unread
      FROM order_timeline ot
      JOIN orders o ON o.id = ot.order_id
      WHERE ot.action = 'message_sent'
      AND (? = '' OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.order_number LIKE ?)
      ORDER BY ot.created_at DESC
      LIMIT 200
    `).all(q, searchLike, searchLike, searchLike)
  }

  const all = [...tickets, ...contacts, ...orderMsgs]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(Number(offset), Number(offset) + Number(limit))

  const unreadCount = (tickets.filter(t => t.unread > 0).length +
    contacts.filter(c => c.unread > 0).length)

  res.json({ items: all, unread_count: unreadCount })
})

// GET /api/unified-inbox/counts — badge counts
router.get('/counts', authMiddleware, (req, res) => {
  const supportOpen = db.prepare("SELECT COUNT(*) as n FROM support_tickets WHERE status IN ('open', 'in_progress')").get()?.n || 0
  const contactUnread = db.prepare("SELECT COUNT(*) as n FROM form_submissions WHERE status = 'unread'").get()?.n || 0
  const totalUnread = supportOpen + contactUnread
  res.json({ total: totalUnread, support: supportOpen, contact: contactUnread })
})

// GET /api/unified-inbox/thread/:source/:id — get full conversation thread
router.get('/thread/:source/:id', authMiddleware, (req, res) => {
  const { source, id } = req.params

  if (source === 'support') {
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id)
    if (!ticket) return res.status(404).json({ error: 'Not found' })
    const rawMessages = db.prepare(
      'SELECT *, message AS content FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC'
    ).all(id)
    return res.json({ source, entity: ticket, messages: rawMessages })
  }

  if (source === 'contact') {
    const sub = db.prepare('SELECT * FROM form_submissions WHERE id = ?').get(id)
    if (!sub) return res.status(404).json({ error: 'Not found' })
    // Mark as read
    db.prepare("UPDATE form_submissions SET status = 'read' WHERE id = ? AND status = 'unread'").run(id)
    return res.json({ source, entity: sub, messages: [{ sender: 'customer', content: sub.message, created_at: sub.created_at }] })
  }

  if (source === 'order') {
    const entry = db.prepare(`
      SELECT ot.*, o.order_number, o.customer_name, o.customer_email, o.status as order_status
      FROM order_timeline ot JOIN orders o ON o.id = ot.order_id
      WHERE ot.id = ?
    `).get(id)
    if (!entry) return res.status(404).json({ error: 'Not found' })
    return res.json({ source, entity: entry, messages: [{ sender: 'admin', content: entry.note, created_at: entry.created_at }] })
  }

  res.status(400).json({ error: 'Invalid source' })
})

// POST /api/unified-inbox/reply/:source/:id — reply to a thread
router.post('/reply/:source/:id', authMiddleware, (req, res) => {
  const { source, id } = req.params
  const { message, is_internal = false } = req.body
  const adminName = req.user?.name || 'Admin'

  if (!message?.trim()) return res.status(400).json({ error: 'Message required' })

  if (source === 'support') {
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id)
    if (!ticket) return res.status(404).json({ error: 'Not found' })

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO ticket_messages (ticket_id, sender, sender_name, message, is_internal, created_at)
      VALUES (?, 'agent', ?, ?, ?, datetime('now'))
    `).run(id, adminName, message, is_internal ? 1 : 0)

    // Update ticket updated_at and status
    if (!is_internal && ticket.status === 'open') {
      db.prepare("UPDATE support_tickets SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?").run(id)
    } else {
      db.prepare("UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?").run(id)
    }

    return res.json({ ok: true, id: lastInsertRowid })
  }

  if (source === 'contact') {
    // Mark as read + log reply in timeline
    db.prepare("UPDATE form_submissions SET status = 'read' WHERE id = ?").run(id)
    return res.json({ ok: true, note: 'Contact forms do not support threaded replies. Use email to respond.' })
  }

  res.status(400).json({ error: 'Invalid source or unsupported reply type' })
})

// PUT /api/unified-inbox/status/:source/:id — update status
router.put('/status/:source/:id', authMiddleware, (req, res) => {
  const { source, id } = req.params
  const { status } = req.body

  if (source === 'support') {
    db.prepare("UPDATE support_tickets SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id)
    return res.json({ ok: true })
  }

  if (source === 'contact') {
    db.prepare("UPDATE form_submissions SET status = ? WHERE id = ?").run(status, id)
    return res.json({ ok: true })
  }

  res.status(400).json({ error: 'Invalid source' })
})

export default router
