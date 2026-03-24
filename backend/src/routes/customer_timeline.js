// Pygmy CMS — Customer Activity Timeline (Phase 61)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ── GET /api/customer-timeline/:customerId — full activity timeline ────────────
router.get('/:customerId', auth, (req, res) => {
  const { customerId } = req.params
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const events = []

  // Registration
  events.push({
    type: 'registered',
    icon: '👤',
    label: 'Account created',
    description: `Registered as ${customer.email}`,
    created_at: customer.created_at
  })

  // Orders
  const orders = db.prepare(`
    SELECT order_number, status, total, created_at, coupon_code, shipping_country
    FROM orders WHERE customer_id = ? ORDER BY created_at
  `).all(customerId)

  for (const o of orders) {
    events.push({
      type: 'order',
      icon: '🛍️',
      label: `Order #${o.order_number}`,
      description: `${o.status} · €${o.total.toFixed(2)}${o.coupon_code ? ` · Coupon: ${o.coupon_code}` : ''}`,
      meta: { order_number: o.order_number, status: o.status, total: o.total },
      created_at: o.created_at
    })
  }

  // Reviews (if table exists)
  try {
    const reviews = db.prepare(`
      SELECT r.id, r.rating, r.title, r.status, r.created_at, p.name as product_name
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      WHERE r.author_email = ?
      ORDER BY r.created_at
    `).all(customer.email)

    for (const r of reviews) {
      events.push({
        type: 'review',
        icon: '⭐',
        label: `Review on ${r.product_name}`,
        description: `${r.rating}★${r.title ? ` — "${r.title}"` : ''} (${r.status})`,
        meta: { rating: r.rating, status: r.status },
        created_at: r.created_at
      })
    }
  } catch (_) {}

  // Support tickets (if table exists)
  try {
    const tickets = db.prepare(`
      SELECT id, subject, status, created_at FROM support_tickets
      WHERE customer_email = ? ORDER BY created_at
    `).all(customer.email)

    for (const t of tickets) {
      events.push({
        type: 'support',
        icon: '🎫',
        label: `Support ticket: ${t.subject}`,
        description: `Status: ${t.status}`,
        meta: { ticket_id: t.id, status: t.status },
        created_at: t.created_at
      })
    }
  } catch (_) {}

  // Newsletter (if subscribed)
  try {
    const sub = db.prepare(`SELECT status, created_at FROM subscribers WHERE email = ?`).get(customer.email)
    if (sub) {
      events.push({
        type: 'newsletter',
        icon: '📧',
        label: sub.status === 'active' ? 'Subscribed to newsletter' : 'Unsubscribed from newsletter',
        description: `Newsletter status: ${sub.status}`,
        created_at: sub.created_at
      })
    }
  } catch (_) {}

  // Loyalty points events
  try {
    const loyalty = db.prepare(`
      SELECT type, points, note, created_at FROM loyalty_transactions
      WHERE customer_id = ? ORDER BY created_at
    `).all(customerId)

    for (const l of loyalty) {
      const isEarn = l.points > 0
      events.push({
        type: 'loyalty',
        icon: isEarn ? '🏆' : '💳',
        label: isEarn ? `Earned ${l.points} points` : `Redeemed ${Math.abs(l.points)} points`,
        description: l.note || `${l.type} transaction`,
        meta: { points: l.points, transaction_type: l.type },
        created_at: l.created_at
      })
    }
  } catch (_) {}

  // Gift registry creations
  try {
    const registries = db.prepare(`
      SELECT id, name, event_type, created_at FROM gift_registries
      WHERE customer_id = ? ORDER BY created_at
    `).all(customerId)

    for (const g of registries) {
      events.push({
        type: 'gift_registry',
        icon: '🎁',
        label: `Created gift registry: ${g.name}`,
        description: `Event type: ${g.event_type}`,
        created_at: g.created_at
      })
    }
  } catch (_) {}

  // Bookings
  try {
    const bookings = db.prepare(`
      SELECT b.reference, b.status, b.booking_date, b.booking_time, b.created_at,
             s.name as service_name
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.customer_email = ? ORDER BY b.created_at
    `).all(customer.email)

    for (const b of bookings) {
      events.push({
        type: 'booking',
        icon: '📅',
        label: `Booking ${b.reference}: ${b.service_name}`,
        description: `${b.booking_date} at ${b.booking_time} — ${b.status}`,
        meta: { reference: b.reference, status: b.status },
        created_at: b.created_at
      })
    }
  } catch (_) {}

  // Store credit adjustments
  try {
    const credits = db.prepare(`
      SELECT amount, reason, created_at FROM store_credit_transactions
      WHERE customer_id = ? ORDER BY created_at
    `).all(customerId)

    for (const c of credits) {
      events.push({
        type: 'store_credit',
        icon: c.amount > 0 ? '💰' : '💳',
        label: c.amount > 0 ? `Store credit added: €${c.amount.toFixed(2)}` : `Store credit used: €${Math.abs(c.amount).toFixed(2)}`,
        description: c.reason || 'Store credit transaction',
        created_at: c.created_at
      })
    }
  } catch (_) {}

  // Sort all events by date
  events.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  // Customer summary
  const summary = {
    total_orders: orders.length,
    total_spent: orders.reduce((s, o) => s + (o.total || 0), 0),
    first_order: orders[0]?.created_at || null,
    last_order: orders[orders.length - 1]?.created_at || null,
    points_balance: customer.points_balance || 0,
    store_credit: customer.store_credit_balance || 0
  }

  res.json({ customer, events, summary })
})

export default router
