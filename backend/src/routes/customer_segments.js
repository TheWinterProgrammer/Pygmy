// Pygmy CMS — Customer Segments routes
// Phase 35
//
// GET    /api/customer-segments          list all segments with member_count
// POST   /api/customer-segments          create segment
// GET    /api/customer-segments/:id      segment + conditions + members preview
// PUT    /api/customer-segments/:id      update segment
// DELETE /api/customer-segments/:id      delete segment
// POST   /api/customer-segments/:id/evaluate  re-evaluate dynamic segment membership
// POST   /api/customer-segments/:id/enroll    enroll segment into an email sequence

import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Evaluate segment conditions → get matching customer IDs ──────────────────
function evaluateSegment(conditions) {
  if (!conditions || !conditions.length) {
    return db.prepare(`SELECT id, email, first_name, last_name FROM customers WHERE active = 1`).all()
  }

  // Build WHERE clauses for each condition
  let clauses = []
  let params = []

  for (const cond of conditions) {
    const { field, operator, value } = cond
    switch (field) {
      case 'total_orders':
        const orderSub = `(SELECT COUNT(*) FROM orders o WHERE o.customer_id = customers.id)`
        if (operator === 'gte') { clauses.push(`${orderSub} >= ?`); params.push(Number(value)) }
        else if (operator === 'lte') { clauses.push(`${orderSub} <= ?`); params.push(Number(value)) }
        else if (operator === 'eq') { clauses.push(`${orderSub} = ?`); params.push(Number(value)) }
        else if (operator === 'gt') { clauses.push(`${orderSub} > ?`); params.push(Number(value)) }
        break
      case 'total_spent':
        const spentSub = `(SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.customer_id = customers.id AND o.status != 'refunded')`
        if (operator === 'gte') { clauses.push(`${spentSub} >= ?`); params.push(Number(value)) }
        else if (operator === 'lte') { clauses.push(`${spentSub} <= ?`); params.push(Number(value)) }
        else if (operator === 'gt') { clauses.push(`${spentSub} > ?`); params.push(Number(value)) }
        break
      case 'last_order_days':
        // customers whose last order was within N days
        const lastOrderSub = `(SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = customers.id)`
        if (operator === 'within') { clauses.push(`${lastOrderSub} >= datetime('now', '-' || ? || ' days')`); params.push(Number(value)) }
        else if (operator === 'older_than') { clauses.push(`(${lastOrderSub} < datetime('now', '-' || ? || ' days') OR ${lastOrderSub} IS NULL)`); params.push(Number(value)) }
        break
      case 'has_subscription':
        if (value === 'true' || value === true) {
          clauses.push(`EXISTS (SELECT 1 FROM member_subscriptions ms WHERE ms.customer_id = customers.id AND ms.status IN ('active','trialing'))`)
        } else {
          clauses.push(`NOT EXISTS (SELECT 1 FROM member_subscriptions ms WHERE ms.customer_id = customers.id AND ms.status IN ('active','trialing'))`)
        }
        break
      case 'points_balance':
        if (operator === 'gte') { clauses.push(`customers.points_balance >= ?`); params.push(Number(value)) }
        else if (operator === 'lte') { clauses.push(`customers.points_balance <= ?`); params.push(Number(value)) }
        break
      case 'active':
        clauses.push(`customers.active = ?`)
        params.push(value === 'true' || value === true ? 1 : 0)
        break
      case 'country':
        // matches customers who have an address in this country
        if (operator === 'eq') {
          clauses.push(`EXISTS (SELECT 1 FROM customer_addresses ca WHERE ca.customer_id = customers.id AND LOWER(ca.country) = LOWER(?))`)
          params.push(value)
        }
        break
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return db.prepare(`SELECT id, email, first_name, last_name FROM customers ${where}`).all(...params)
}

// ─── GET /api/customer-segments ──────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT * FROM customer_segments ORDER BY created_at DESC`).all()
  res.json(rows.map(s => ({ ...s, conditions: JSON.parse(s.conditions || '[]') })))
})

// ─── POST /api/customer-segments ─────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { name, description = '', conditions = [], dynamic = 1 } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
  const condJson = JSON.stringify(conditions)
  const members = evaluateSegment(conditions)
  const info = db.prepare(`
    INSERT INTO customer_segments (name, description, conditions, dynamic, member_count, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name.trim(), description, condJson, dynamic ? 1 : 0, members.length, req.user.id)
  const seg = db.prepare(`SELECT * FROM customer_segments WHERE id = ?`).get(info.lastInsertRowid)
  res.status(201).json({ ...seg, conditions })
})

// ─── GET /api/customer-segments/:id ──────────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const seg = db.prepare(`SELECT * FROM customer_segments WHERE id = ?`).get(Number(req.params.id))
  if (!seg) return res.status(404).json({ error: 'Segment not found' })
  const conditions = JSON.parse(seg.conditions || '[]')
  const members = evaluateSegment(conditions).slice(0, 100) // preview first 100
  res.json({ ...seg, conditions, members_preview: members })
})

// ─── PUT /api/customer-segments/:id ──────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const seg = db.prepare(`SELECT * FROM customer_segments WHERE id = ?`).get(Number(req.params.id))
  if (!seg) return res.status(404).json({ error: 'Segment not found' })
  const { name, description, conditions, dynamic } = req.body
  const newConditions = conditions ?? JSON.parse(seg.conditions || '[]')
  const members = evaluateSegment(newConditions)
  db.prepare(`
    UPDATE customer_segments SET name = ?, description = ?, conditions = ?, dynamic = ?, member_count = ?, updated_at = datetime('now') WHERE id = ?
  `).run(
    name ?? seg.name,
    description ?? seg.description,
    JSON.stringify(newConditions),
    dynamic != null ? (dynamic ? 1 : 0) : seg.dynamic,
    members.length,
    seg.id
  )
  const updated = db.prepare(`SELECT * FROM customer_segments WHERE id = ?`).get(seg.id)
  res.json({ ...updated, conditions: newConditions })
})

// ─── DELETE /api/customer-segments/:id ───────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const seg = db.prepare(`SELECT * FROM customer_segments WHERE id = ?`).get(Number(req.params.id))
  if (!seg) return res.status(404).json({ error: 'Segment not found' })
  db.prepare(`DELETE FROM customer_segments WHERE id = ?`).run(seg.id)
  res.json({ message: 'Deleted' })
})

// ─── POST /api/customer-segments/:id/evaluate ────────────────────────────────
router.post('/:id/evaluate', authMiddleware, (req, res) => {
  const seg = db.prepare(`SELECT * FROM customer_segments WHERE id = ?`).get(Number(req.params.id))
  if (!seg) return res.status(404).json({ error: 'Segment not found' })
  const conditions = JSON.parse(seg.conditions || '[]')
  const members = evaluateSegment(conditions)
  db.prepare(`UPDATE customer_segments SET member_count = ?, updated_at = datetime('now') WHERE id = ?`).run(members.length, seg.id)
  res.json({ member_count: members.length, members: members.slice(0, 100) })
})

// ─── POST /api/customer-segments/:id/enroll ──────────────────────────────────
// Enroll all segment members into an email sequence
router.post('/:id/enroll', authMiddleware, (req, res) => {
  const seg = db.prepare(`SELECT * FROM customer_segments WHERE id = ?`).get(Number(req.params.id))
  if (!seg) return res.status(404).json({ error: 'Segment not found' })
  const { sequence_id } = req.body
  if (!sequence_id) return res.status(400).json({ error: 'sequence_id is required' })

  const seq = db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(Number(sequence_id))
  if (!seq) return res.status(404).json({ error: 'Sequence not found' })

  const firstStep = db.prepare(`SELECT * FROM email_sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC LIMIT 1`).get(seq.id)
  if (!firstStep) return res.status(400).json({ error: 'Sequence has no steps' })

  const conditions = JSON.parse(seg.conditions || '[]')
  const members = evaluateSegment(conditions)

  const nextSendAt = new Date()
  nextSendAt.setDate(nextSendAt.getDate() + (firstStep.delay_days || 0))
  nextSendAt.setHours(nextSendAt.getHours() + (firstStep.delay_hours || 0))

  let enrolled = 0, skipped = 0
  for (const m of members) {
    const email = m.email?.toLowerCase()
    if (!email) continue
    const existing = db.prepare(`SELECT id FROM email_sequence_enrollments WHERE sequence_id = ? AND email = ? AND status = 'active'`).get(seq.id, email)
    if (existing) { skipped++; continue }
    const name = [m.first_name, m.last_name].filter(Boolean).join(' ')
    db.prepare(`
      INSERT INTO email_sequence_enrollments (sequence_id, email, name, next_step, next_send_at, status)
      VALUES (?, ?, ?, 1, ?, 'active')
    `).run(seq.id, email, name, nextSendAt.toISOString())
    enrolled++
  }

  res.json({ enrolled, skipped, total_members: members.length })
})

export default router
