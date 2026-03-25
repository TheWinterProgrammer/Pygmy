// Pygmy CMS — Dashboard Widget Preferences API (Phase 71)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/widget-prefs — get this user's widget prefs
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id
  const row = db.prepare('SELECT layout, hidden FROM dashboard_widget_prefs WHERE user_id = ?').get(userId)
  if (!row) {
    return res.json({ layout: [], hidden: [] })
  }
  let layout = [], hidden = []
  try { layout = JSON.parse(row.layout) } catch {}
  try { hidden = JSON.parse(row.hidden) } catch {}
  res.json({ layout, hidden })
})

// PUT /api/widget-prefs — save layout + hidden list
router.put('/', authMiddleware, (req, res) => {
  const userId = req.user.id
  const { layout = [], hidden = [] } = req.body

  db.prepare(`
    INSERT INTO dashboard_widget_prefs (user_id, layout, hidden, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET layout = excluded.layout, hidden = excluded.hidden, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(layout), JSON.stringify(hidden))

  res.json({ ok: true })
})

// DELETE /api/widget-prefs — reset to defaults
router.delete('/', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM dashboard_widget_prefs WHERE user_id = ?').run(req.user.id)
  res.json({ ok: true })
})

export default router
