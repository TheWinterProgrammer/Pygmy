// Pygmy CMS — Activity Log
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/activity — paginated activity log (auth)
router.get('/', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200)
  const offset = parseInt(req.query.offset) || 0
  const { q = '', entity_type = '', action: actionFilter = '' } = req.query

  const conditions = []
  const params = []

  if (q) {
    conditions.push(`(user_name LIKE ? OR action LIKE ? OR entity_type LIKE ? OR entity_title LIKE ?)`)
    const like = `%${q}%`
    params.push(like, like, like, like)
  }
  if (entity_type) { conditions.push('entity_type = ?'); params.push(entity_type) }
  if (actionFilter) { conditions.push('action LIKE ?'); params.push(`%${actionFilter}%`) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const items = db.prepare(`SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)
  const total = db.prepare(`SELECT COUNT(*) as n FROM activity_log ${where}`).get(...params).n

  res.json({ items, total })
})

// GET /api/activity/export/csv — download activity log as CSV (auth)
router.get('/export/csv', authMiddleware, (req, res) => {
  const { q = '', entity_type = '', action: actionFilter = '', from = '', to = '' } = req.query

  const conditions = []
  const params = []

  if (q) {
    conditions.push(`(user_name LIKE ? OR action LIKE ? OR entity_type LIKE ? OR entity_title LIKE ?)`)
    const like = `%${q}%`
    params.push(like, like, like, like)
  }
  if (entity_type) { conditions.push('entity_type = ?'); params.push(entity_type) }
  if (actionFilter) { conditions.push('action LIKE ?'); params.push(`%${actionFilter}%`) }
  if (from) { conditions.push('date(created_at) >= ?'); params.push(from) }
  if (to) { conditions.push('date(created_at) <= ?'); params.push(to) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT 5000`).all(...params)

  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = 'id,user_name,action,entity_type,entity_id,entity_title,created_at'
  const csv = [header, ...rows.map(r =>
    [r.id, r.user_name, r.action, r.entity_type, r.entity_id, r.entity_title, r.created_at]
      .map(esc).join(',')
  )].join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="activity-log-${new Date().toISOString().slice(0,10)}.csv"`)
  res.send(csv)
})

// POST /api/activity — internal: log an action (auth)
router.post('/', authMiddleware, (req, res) => {
  const { action, entity_type, entity_id, entity_title } = req.body
  if (!action) return res.status(400).json({ error: 'action required' })
  db.prepare(`
    INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, entity_title)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, req.user.name, action, entity_type || null, entity_id || null, entity_title || null)
  res.status(201).json({ ok: true })
})

export default router

// ─── Helper exported for internal use ────────────────────────────────────────
export function logActivity(userId, userName, action, entityType = null, entityId = null, entityTitle = null) {
  try {
    db.prepare(`
      INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, entity_title)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId || null, userName || 'system', action, entityType, entityId, entityTitle)
  } catch (e) {
    // non-fatal
  }
}
