// Pygmy CMS — Activity Log
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/activity — recent activity (auth)
router.get('/', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)
  const rows = db.prepare(`
    SELECT * FROM activity_log
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit)
  res.json(rows)
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
