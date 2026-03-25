// Pygmy CMS — Customer Notification Preferences API (Phase 69)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Customer self-service ────────────────────────────────────────────────────

// GET /api/notification-prefs/me — get own preferences (customer JWT)
router.get('/me', customerAuthMiddleware, (req, res) => {
  // Ensure row exists (create defaults on first access)
  db.prepare('INSERT OR IGNORE INTO notification_prefs (customer_id) VALUES (?)').run(req.customerId)
  const prefs = db.prepare('SELECT * FROM notification_prefs WHERE customer_id = ?').get(req.customerId)
  res.json(prefs)
})

// PUT /api/notification-prefs/me — update own preferences (customer JWT)
router.put('/me', customerAuthMiddleware, (req, res) => {
  const {
    order_updates,
    promotions,
    newsletter,
    back_in_stock,
    price_drops,
    loyalty,
    digest
  } = req.body

  // Ensure row exists
  db.prepare('INSERT OR IGNORE INTO notification_prefs (customer_id) VALUES (?)').run(req.customerId)

  const fields = { order_updates, promotions, newsletter, back_in_stock, price_drops, loyalty, digest }
  const updates = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) updates[k] = v ? 1 : 0
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const vals = Object.values(updates)
    db.prepare(`UPDATE notification_prefs SET ${setClauses}, updated_at = datetime('now') WHERE customer_id = ?`)
      .run(...vals, req.customerId)
  }

  const prefs = db.prepare('SELECT * FROM notification_prefs WHERE customer_id = ?').get(req.customerId)
  res.json(prefs)
})

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET /api/notification-prefs — admin list (with customer info)
router.get('/', authMiddleware, (req, res) => {
  const { q, limit = 50, offset = 0 } = req.query
  let sql = `
    SELECT np.*, c.email, c.first_name, c.last_name
    FROM notification_prefs np
    JOIN customers c ON c.id = np.customer_id
    WHERE 1=1
  `
  const params = []
  if (q) {
    sql += ' AND (c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY np.updated_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))
  const rows = db.prepare(sql).all(...params)
  res.json(rows)
})

// GET /api/notification-prefs/stats — summary for admin
router.get('/stats', authMiddleware, (req, res) => {
  const total        = db.prepare('SELECT COUNT(*) as n FROM notification_prefs').get().n
  const allOff       = db.prepare('SELECT COUNT(*) as n FROM notification_prefs WHERE order_updates=0 AND promotions=0 AND newsletter=0').get().n
  const noPromo      = db.prepare('SELECT COUNT(*) as n FROM notification_prefs WHERE promotions=0').get().n
  const noNewsletter = db.prepare('SELECT COUNT(*) as n FROM notification_prefs WHERE newsletter=0').get().n
  res.json({ total, all_unsubscribed: allOff, no_promotions: noPromo, no_newsletter: noNewsletter })
})

export default router
