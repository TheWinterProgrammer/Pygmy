// Pygmy CMS — Email Sequences (Drip Campaigns) routes
// Phase 35
//
// Sequences:
//   GET    /api/email-sequences               list all sequences with step + enrollment counts
//   POST   /api/email-sequences               create sequence
//   GET    /api/email-sequences/:id           get sequence + steps
//   PUT    /api/email-sequences/:id           update sequence
//   DELETE /api/email-sequences/:id           delete sequence (cascade steps + enrollments)
//   PUT    /api/email-sequences/:id/status    change status: draft|active|paused
//
// Steps:
//   GET    /api/email-sequences/:id/steps     list steps
//   POST   /api/email-sequences/:id/steps     create step
//   PUT    /api/email-sequences/:id/steps/:sid  update step
//   DELETE /api/email-sequences/:id/steps/:sid  delete step
//   POST   /api/email-sequences/:id/steps/reorder  reorder steps
//
// Enrollments:
//   GET    /api/email-sequences/:id/enrollments   list enrollments
//   POST   /api/email-sequences/:id/enroll        enroll email(s)
//   DELETE /api/email-sequences/:id/enrollments/:eid  remove enrollment
//   POST   /api/email-sequences/process           process due emails (cron trigger)
//
// Stats:
//   GET    /api/email-sequences/stats          overall stats

import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo as sendMail } from '../email.js'

const router = Router()

// ─── Helper: enrich sequence with counts ──────────────────────────────────────
function enrichSequence(seq) {
  if (!seq) return null
  const stepCount = db.prepare(`SELECT COUNT(*) as c FROM email_sequence_steps WHERE sequence_id = ?`).get(seq.id).c
  const activeEnrollments = db.prepare(`SELECT COUNT(*) as c FROM email_sequence_enrollments WHERE sequence_id = ? AND status = 'active'`).get(seq.id).c
  const completedEnrollments = db.prepare(`SELECT COUNT(*) as c FROM email_sequence_enrollments WHERE sequence_id = ? AND status = 'completed'`).get(seq.id).c
  return { ...seq, step_count: stepCount, active_enrollments: activeEnrollments, completed_enrollments: completedEnrollments }
}

// ─── GET /api/email-sequences/stats ──────────────────────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) as c FROM email_sequences`).get().c
  const active = db.prepare(`SELECT COUNT(*) as c FROM email_sequences WHERE status = 'active'`).get().c
  const totalEnrollments = db.prepare(`SELECT COUNT(*) as c FROM email_sequence_enrollments`).get().c
  const activeEnrollments = db.prepare(`SELECT COUNT(*) as c FROM email_sequence_enrollments WHERE status = 'active'`).get().c
  const completedEnrollments = db.prepare(`SELECT COUNT(*) as c FROM email_sequence_enrollments WHERE status = 'completed'`).get().c
  res.json({ total, active, total_enrollments: totalEnrollments, active_enrollments: activeEnrollments, completed_enrollments: completedEnrollments })
})

// ─── POST /api/email-sequences/process ──────────────────────────────────────
router.post('/process', authMiddleware, async (req, res) => {
  const now = new Date().toISOString()
  const due = db.prepare(`
    SELECT e.*, s.name as seq_name, s.status as seq_status
    FROM email_sequence_enrollments e
    JOIN email_sequences s ON s.id = e.sequence_id
    WHERE e.status = 'active' AND e.next_send_at <= ? AND s.status = 'active'
    LIMIT 50
  `).all(now)

  let sent = 0, failed = 0

  for (const enrollment of due) {
    const step = db.prepare(`
      SELECT * FROM email_sequence_steps
      WHERE sequence_id = ? AND step_number = ?
    `).get(enrollment.sequence_id, enrollment.next_step)

    if (!step) {
      // No more steps → mark completed
      db.prepare(`UPDATE email_sequence_enrollments SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).run(enrollment.id)
      continue
    }

    try {
      // Personalize subject/body
      const subject = step.subject.replace('{{name}}', enrollment.name || 'there')
      const body = step.body.replace(/\{\{name\}\}/g, enrollment.name || 'there').replace(/\{\{email\}\}/g, enrollment.email)

      await sendMail({
        to: enrollment.email,
        subject,
        html: body,
      })

      // Find next step
      const nextStep = db.prepare(`
        SELECT * FROM email_sequence_steps
        WHERE sequence_id = ? AND step_number > ?
        ORDER BY step_number ASC LIMIT 1
      `).get(enrollment.sequence_id, step.step_number)

      if (nextStep) {
        const nextSendAt = new Date()
        nextSendAt.setDate(nextSendAt.getDate() + nextStep.delay_days)
        nextSendAt.setHours(nextSendAt.getHours() + nextStep.delay_hours)
        db.prepare(`
          UPDATE email_sequence_enrollments
          SET next_step = ?, next_send_at = ?
          WHERE id = ?
        `).run(nextStep.step_number, nextSendAt.toISOString(), enrollment.id)
      } else {
        db.prepare(`UPDATE email_sequence_enrollments SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).run(enrollment.id)
      }
      sent++
    } catch (err) {
      db.prepare(`UPDATE email_sequence_enrollments SET status = 'failed' WHERE id = ?`).run(enrollment.id)
      failed++
    }
  }

  res.json({ processed: due.length, sent, failed })
})

// ─── GET /api/email-sequences ─────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT * FROM email_sequences ORDER BY created_at DESC`).all()
  res.json(rows.map(enrichSequence))
})

// ─── POST /api/email-sequences ────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { name, description = '', trigger_type = 'manual', trigger_config = '{}' } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
  const info = db.prepare(`
    INSERT INTO email_sequences (name, description, trigger_type, trigger_config, status, created_by)
    VALUES (?, ?, ?, ?, 'draft', ?)
  `).run(name.trim(), description, trigger_type, typeof trigger_config === 'object' ? JSON.stringify(trigger_config) : trigger_config, req.user.id)
  res.status(201).json(enrichSequence(db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(info.lastInsertRowid)))
})

// ─── GET /api/email-sequences/:id ────────────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const seq = db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(Number(req.params.id))
  if (!seq) return res.status(404).json({ error: 'Sequence not found' })
  const steps = db.prepare(`SELECT * FROM email_sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC`).all(seq.id)
  res.json({ ...enrichSequence(seq), steps })
})

// ─── PUT /api/email-sequences/:id ────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const seq = db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(Number(req.params.id))
  if (!seq) return res.status(404).json({ error: 'Sequence not found' })
  const { name, description, trigger_type, trigger_config } = req.body
  db.prepare(`
    UPDATE email_sequences SET name = ?, description = ?, trigger_type = ?, trigger_config = ?, updated_at = datetime('now') WHERE id = ?
  `).run(
    name ?? seq.name,
    description ?? seq.description,
    trigger_type ?? seq.trigger_type,
    trigger_config != null ? (typeof trigger_config === 'object' ? JSON.stringify(trigger_config) : trigger_config) : seq.trigger_config,
    seq.id
  )
  res.json(enrichSequence(db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(seq.id)))
})

// ─── PUT /api/email-sequences/:id/status ─────────────────────────────────────
router.put('/:id/status', authMiddleware, (req, res) => {
  const seq = db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(Number(req.params.id))
  if (!seq) return res.status(404).json({ error: 'Sequence not found' })
  const { status } = req.body
  if (!['draft', 'active', 'paused'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
  db.prepare(`UPDATE email_sequences SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, seq.id)
  res.json(enrichSequence(db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(seq.id)))
})

// ─── DELETE /api/email-sequences/:id ─────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const seq = db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(Number(req.params.id))
  if (!seq) return res.status(404).json({ error: 'Sequence not found' })
  db.prepare(`DELETE FROM email_sequences WHERE id = ?`).run(seq.id)
  res.json({ message: 'Deleted' })
})

// ─── Steps CRUD ───────────────────────────────────────────────────────────────

router.get('/:id/steps', authMiddleware, (req, res) => {
  const steps = db.prepare(`SELECT * FROM email_sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC`).all(Number(req.params.id))
  res.json(steps)
})

router.post('/:id/steps', authMiddleware, (req, res) => {
  const seq = db.prepare(`SELECT id FROM email_sequences WHERE id = ?`).get(Number(req.params.id))
  if (!seq) return res.status(404).json({ error: 'Sequence not found' })
  const { subject, body = '', delay_days = 0, delay_hours = 0 } = req.body
  if (!subject?.trim()) return res.status(400).json({ error: 'subject is required' })
  // Auto-assign step_number as max+1
  const maxStep = db.prepare(`SELECT MAX(step_number) as m FROM email_sequence_steps WHERE sequence_id = ?`).get(seq.id).m || 0
  const info = db.prepare(`
    INSERT INTO email_sequence_steps (sequence_id, step_number, subject, body, delay_days, delay_hours)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(seq.id, maxStep + 1, subject.trim(), body, Number(delay_days), Number(delay_hours))
  res.status(201).json(db.prepare(`SELECT * FROM email_sequence_steps WHERE id = ?`).get(info.lastInsertRowid))
})

router.put('/:id/steps/:sid', authMiddleware, (req, res) => {
  const step = db.prepare(`SELECT * FROM email_sequence_steps WHERE id = ? AND sequence_id = ?`).get(Number(req.params.sid), Number(req.params.id))
  if (!step) return res.status(404).json({ error: 'Step not found' })
  const { subject, body, delay_days, delay_hours } = req.body
  db.prepare(`UPDATE email_sequence_steps SET subject = ?, body = ?, delay_days = ?, delay_hours = ? WHERE id = ?`).run(
    subject ?? step.subject, body ?? step.body, delay_days ?? step.delay_days, delay_hours ?? step.delay_hours, step.id
  )
  res.json(db.prepare(`SELECT * FROM email_sequence_steps WHERE id = ?`).get(step.id))
})

router.delete('/:id/steps/:sid', authMiddleware, (req, res) => {
  const step = db.prepare(`SELECT * FROM email_sequence_steps WHERE id = ? AND sequence_id = ?`).get(Number(req.params.sid), Number(req.params.id))
  if (!step) return res.status(404).json({ error: 'Step not found' })
  db.prepare(`DELETE FROM email_sequence_steps WHERE id = ?`).run(step.id)
  // Renumber remaining steps
  const remaining = db.prepare(`SELECT id FROM email_sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC`).all(Number(req.params.id))
  remaining.forEach((s, i) => db.prepare(`UPDATE email_sequence_steps SET step_number = ? WHERE id = ?`).run(i + 1, s.id))
  res.json({ message: 'Deleted' })
})

router.post('/:id/steps/reorder', authMiddleware, (req, res) => {
  const { order } = req.body // array of step IDs in new order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of step IDs' })
  order.forEach((sid, i) => {
    db.prepare(`UPDATE email_sequence_steps SET step_number = ? WHERE id = ? AND sequence_id = ?`).run(i + 1, sid, Number(req.params.id))
  })
  res.json(db.prepare(`SELECT * FROM email_sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC`).all(Number(req.params.id)))
})

// ─── Enrollments ─────────────────────────────────────────────────────────────

router.get('/:id/enrollments', authMiddleware, (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query
  const where = status ? `WHERE e.sequence_id = ? AND e.status = ?` : `WHERE e.sequence_id = ?`
  const params = status ? [Number(req.params.id), status, Number(limit), Number(offset)] : [Number(req.params.id), Number(limit), Number(offset)]
  const rows = db.prepare(`SELECT * FROM email_sequence_enrollments ${where} ORDER BY enrolled_at DESC LIMIT ? OFFSET ?`).all(...params)
  const total = db.prepare(`SELECT COUNT(*) as c FROM email_sequence_enrollments ${where.replace('LIMIT ? OFFSET ?', '')}`).get(...params.slice(0, -2)).c
  res.json({ rows, total })
})

router.post('/:id/enroll', authMiddleware, (req, res) => {
  const seq = db.prepare(`SELECT * FROM email_sequences WHERE id = ?`).get(Number(req.params.id))
  if (!seq) return res.status(404).json({ error: 'Sequence not found' })

  let emails = req.body.emails || (req.body.email ? [{ email: req.body.email, name: req.body.name || '' }] : [])
  if (!emails.length) return res.status(400).json({ error: 'emails array is required' })

  const firstStep = db.prepare(`SELECT * FROM email_sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC LIMIT 1`).get(seq.id)
  if (!firstStep) return res.status(400).json({ error: 'Sequence has no steps' })

  const nextSendAt = new Date()
  nextSendAt.setDate(nextSendAt.getDate() + (firstStep.delay_days || 0))
  nextSendAt.setHours(nextSendAt.getHours() + (firstStep.delay_hours || 0))

  let enrolled = 0, skipped = 0
  for (const { email, name = '' } of emails) {
    if (!email) continue
    // Skip if already active
    const existing = db.prepare(`SELECT id FROM email_sequence_enrollments WHERE sequence_id = ? AND email = ? AND status = 'active'`).get(seq.id, email.toLowerCase())
    if (existing) { skipped++; continue }
    db.prepare(`
      INSERT INTO email_sequence_enrollments (sequence_id, email, name, next_step, next_send_at, status)
      VALUES (?, ?, ?, 1, ?, 'active')
    `).run(seq.id, email.toLowerCase(), name, nextSendAt.toISOString())
    enrolled++
  }

  res.json({ enrolled, skipped })
})

router.delete('/:id/enrollments/:eid', authMiddleware, (req, res) => {
  const enrollment = db.prepare(`SELECT * FROM email_sequence_enrollments WHERE id = ? AND sequence_id = ?`).get(Number(req.params.eid), Number(req.params.id))
  if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' })
  db.prepare(`DELETE FROM email_sequence_enrollments WHERE id = ?`).run(enrollment.id)
  res.json({ message: 'Removed' })
})

export default router
