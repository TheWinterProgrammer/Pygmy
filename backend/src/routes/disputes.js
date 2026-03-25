// Pygmy CMS — Order Dispute Resolution API (Phase 74)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function genRef () {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'
  let s = 'DSP-'
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// ── Public endpoints ──────────────────────────────────────────────────────────

// POST /api/disputes — open a dispute
router.post('/', (req, res) => {
  const { order_number, customer_email, customer_name, reason, description, evidence_urls = [] } = req.body
  if (!order_number || !customer_email || !reason || !description) {
    return res.status(400).json({ error: 'order_number, customer_email, reason, and description are required' })
  }

  // Validate order exists and email matches
  const order = db.prepare(`
    SELECT id, order_number, customer_email FROM orders WHERE order_number = ?
  `).get(order_number)

  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.customer_email.toLowerCase() !== customer_email.toLowerCase()) {
    return res.status(403).json({ error: 'Email does not match order' })
  }

  // Check for existing open dispute
  const existing = db.prepare(`
    SELECT id FROM order_disputes WHERE order_number = ? AND status NOT IN ('resolved', 'rejected', 'closed')
  `).get(order_number)
  if (existing) {
    return res.status(409).json({ error: 'An open dispute already exists for this order', dispute_id: existing.id })
  }

  let ref
  for (let i = 0; i < 10; i++) {
    const candidate = genRef()
    const clash = db.prepare(`SELECT id FROM order_disputes WHERE reference = ?`).get(candidate)
    if (!clash) { ref = candidate; break }
  }

  const info = db.prepare(`
    INSERT INTO order_disputes
      (reference, order_id, order_number, customer_name, customer_email, reason, description, evidence_urls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ref, order.id, order_number, customer_name || '', customer_email, reason, description, JSON.stringify(evidence_urls))

  res.status(201).json({
    ok: true,
    reference: ref,
    id: info.lastInsertRowid,
    message: 'Your dispute has been submitted. We will review it and respond within 3 business days.'
  })
})

// GET /api/disputes/lookup — customer lookup by order + email
router.get('/lookup', (req, res) => {
  const { order_number, email } = req.query
  if (!order_number || !email) return res.status(400).json({ error: 'order_number and email required' })

  const dispute = db.prepare(`
    SELECT id, reference, order_number, reason, description, status, resolution, created_at, updated_at
    FROM order_disputes
    WHERE order_number = ? AND customer_email = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(order_number, email)

  if (!dispute) return res.status(404).json({ error: 'No dispute found' })
  res.json(dispute)
})

// ── Admin endpoints ───────────────────────────────────────────────────────────

// GET /api/disputes — admin list
router.get('/', authMiddleware, (req, res) => {
  const { status, q, limit = 50, offset = 0 } = req.query
  let where = []
  const params = []

  if (status) { where.push('status = ?'); params.push(status) }
  if (q)      { where.push('(order_number LIKE ? OR customer_email LIKE ? OR customer_name LIKE ? OR reference LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const disputes = db.prepare(`
    SELECT * FROM order_disputes ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`SELECT COUNT(*) as c FROM order_disputes ${whereClause}`).get(...params)?.c || 0

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN refund_amount > 0 THEN refund_amount ELSE 0 END) as total_refunded
    FROM order_disputes
  `).get()

  disputes.forEach(d => {
    try { d.evidence_urls = JSON.parse(d.evidence_urls || '[]') } catch { d.evidence_urls = [] }
  })

  res.json({ disputes, total, stats })
})

// GET /api/disputes/:id
router.get('/:id', authMiddleware, (req, res) => {
  const d = db.prepare(`SELECT * FROM order_disputes WHERE id = ?`).get(req.params.id)
  if (!d) return res.status(404).json({ error: 'Not found' })
  try { d.evidence_urls = JSON.parse(d.evidence_urls || '[]') } catch { d.evidence_urls = [] }
  res.json(d)
})

// PUT /api/disputes/:id — update status, resolution, refund
router.put('/:id', authMiddleware, (req, res) => {
  const { status, resolution, refund_amount, admin_notes } = req.body
  const d = db.prepare(`SELECT * FROM order_disputes WHERE id = ?`).get(req.params.id)
  if (!d) return res.status(404).json({ error: 'Not found' })

  const resolved_at = (status === 'resolved' || status === 'rejected') ? `datetime('now')` : null

  db.prepare(`
    UPDATE order_disputes SET
      status = COALESCE(?, status),
      resolution = COALESCE(?, resolution),
      refund_amount = COALESCE(?, refund_amount),
      admin_notes = COALESCE(?, admin_notes),
      resolved_at = CASE WHEN ? IS NOT NULL THEN datetime('now') ELSE resolved_at END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    status ?? null,
    resolution ?? null,
    refund_amount ?? null,
    admin_notes ?? null,
    (status === 'resolved' || status === 'rejected') ? 1 : null,
    req.params.id
  )

  // Log to order timeline if order linked
  if (status && d.order_id) {
    try {
      db.prepare(`
        INSERT INTO order_timeline (order_id, event_type, message, created_by)
        VALUES (?, 'dispute_update', ?, 'admin')
      `).run(d.order_id, `Dispute ${d.reference}: status changed to ${status}`)
    } catch {}
  }

  const updated = db.prepare(`SELECT * FROM order_disputes WHERE id = ?`).get(req.params.id)
  try { updated.evidence_urls = JSON.parse(updated.evidence_urls || '[]') } catch { updated.evidence_urls = [] }
  res.json(updated)
})

// DELETE /api/disputes/:id
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM order_disputes WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

export default router
