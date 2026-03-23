// Pygmy CMS — SMS Management API (Phase 48)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendSms } from '../sms.js'

const router = Router()

// ── GET /api/sms/log — List SMS log (admin) ───────────────────────────────────
router.get('/log', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const offset = parseInt(req.query.offset) || 0
  const status = req.query.status
  const q = req.query.q

  let sql = 'SELECT * FROM sms_log WHERE 1=1'
  const params = []
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (q) { sql += ' AND (to_number LIKE ? OR message LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const rows = db.prepare(sql).all(...params)
  const total = db.prepare('SELECT COUNT(*) as c FROM sms_log' + (status ? ' WHERE status = ?' : '')).get(...(status ? [status] : [])).c
  res.json({ logs: rows, total })
})

// ── GET /api/sms/stats — Stats ────────────────────────────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as c FROM sms_log").get().c
  const sent  = db.prepare("SELECT COUNT(*) as c FROM sms_log WHERE status = 'sent'").get().c
  const failed = db.prepare("SELECT COUNT(*) as c FROM sms_log WHERE status = 'failed'").get().c
  const today = db.prepare("SELECT COUNT(*) as c FROM sms_log WHERE date(created_at) = date('now')").get().c
  res.json({ total, sent, failed, today })
})

// ── POST /api/sms/send — Send a test SMS (admin) ──────────────────────────────
router.post('/send', authMiddleware, async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) return res.status(400).json({ error: 'to and message are required' })
  const result = await sendSms(to, message, { entityType: 'manual', entityId: null })
  if (result.ok) return res.json({ ok: true, message: 'SMS sent successfully' })
  res.status(400).json({ ok: false, error: result.error })
})

export default router
