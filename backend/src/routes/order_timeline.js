// Pygmy CMS — Order Timeline API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const EVENT_ICONS = {
  note: '📝',
  status_change: '🔄',
  payment: '💳',
  shipment: '📦',
  refund: '↩️',
  system: '⚙️',
}

// ── GET /api/order-timeline/:orderId — Get timeline for an order ──────────────
router.get('/:orderId', authMiddleware, (req, res) => {
  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(req.params.orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const events = db.prepare(`
    SELECT * FROM order_timeline
    WHERE order_id = ?
    ORDER BY created_at ASC
  `).all(req.params.orderId)

  res.json(events.map(e => ({
    ...e,
    icon: EVENT_ICONS[e.event_type] || '📋',
    is_customer_visible: !!e.is_customer_visible,
  })))
})

// ── GET /api/order-timeline/:orderId/public — Customer-visible events only ────
// Used on public order confirmation / account order detail
router.get('/:orderId/public', (req, res) => {
  const order = db.prepare("SELECT id, order_number FROM orders WHERE order_number = ?").get(req.params.orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const events = db.prepare(`
    SELECT id, event_type, message, created_at FROM order_timeline
    WHERE order_id = ? AND is_customer_visible = 1
    ORDER BY created_at ASC
  `).all(order.id)

  res.json(events.map(e => ({
    ...e,
    icon: EVENT_ICONS[e.event_type] || '📋',
  })))
})

// ── POST /api/order-timeline — Add an event/note ──────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const {
    order_id,
    event_type = 'note',
    message,
    is_customer_visible = false,
  } = req.body

  if (!order_id || !message?.trim()) {
    return res.status(400).json({ error: 'order_id and message are required' })
  }

  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(order_id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const validTypes = ['note', 'status_change', 'payment', 'shipment', 'refund', 'system']
  if (!validTypes.includes(event_type)) {
    return res.status(400).json({ error: `Invalid event_type. Must be one of: ${validTypes.join(', ')}` })
  }

  const result = db.prepare(`
    INSERT INTO order_timeline (order_id, event_type, message, is_customer_visible, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    order_id,
    event_type,
    message.trim(),
    is_customer_visible ? 1 : 0,
    req.user?.name || req.user?.email || 'admin'
  )

  const created = db.prepare("SELECT * FROM order_timeline WHERE id = ?").get(result.lastInsertRowid)
  res.status(201).json({
    ...created,
    icon: EVENT_ICONS[created.event_type] || '📋',
    is_customer_visible: !!created.is_customer_visible,
  })
})

// ── DELETE /api/order-timeline/:id — Remove a timeline event ─────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const event = db.prepare("SELECT * FROM order_timeline WHERE id = ?").get(req.params.id)
  if (!event) return res.status(404).json({ error: 'Event not found' })

  // Prevent deletion of system events
  if (event.event_type === 'status_change' || event.event_type === 'system') {
    return res.status(403).json({ error: 'System events cannot be deleted' })
  }

  db.prepare("DELETE FROM order_timeline WHERE id = ?").run(req.params.id)
  res.json({ ok: true })
})

export default router

// ─── Helper: add a system timeline event (called from orders route) ───────────
export function addOrderEvent(orderId, eventType, message, isCustomerVisible = false, createdBy = 'system') {
  try {
    db.prepare(`
      INSERT INTO order_timeline (order_id, event_type, message, is_customer_visible, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(orderId, eventType, message, isCustomerVisible ? 1 : 0, createdBy)
  } catch {}
}
