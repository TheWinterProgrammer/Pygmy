// Pygmy CMS — Social Proof / Live Activity API (Phase 38)
// Tracks live viewers per page + recent purchase activity feed
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ── POST /api/social-proof/ping — Public: beacon "I'm viewing this page" ───────
// Session pings every 30s to stay "live". Expires after 90s without a ping.
router.post('/ping', (req, res) => {
  const { path, session_id } = req.body
  if (!path || !session_id) return res.status(400).json({ error: 'path and session_id required' })

  const expires = new Date(Date.now() + 90000).toISOString() // 90s TTL
  db.prepare(`
    INSERT INTO live_viewers (session_id, path, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET path = excluded.path, expires_at = excluded.expires_at
  `).run(session_id, path, expires)

  // Cleanup expired sessions lazily
  db.prepare("DELETE FROM live_viewers WHERE expires_at < datetime('now')").run()

  res.json({ ok: true })
})

// ── GET /api/social-proof/viewers?path= — Public: count live viewers ───────────
router.get('/viewers', (req, res) => {
  const { path } = req.query
  if (!path) return res.status(400).json({ error: 'path required' })

  // Cleanup expired first
  db.prepare("DELETE FROM live_viewers WHERE expires_at < datetime('now')").run()

  const count = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as c FROM live_viewers WHERE path = ?
  `).get(path)?.c ?? 0

  res.json({ viewers: count, path })
})

// ── POST /api/social-proof/purchase — Internal: record purchase event ──────────
// Called automatically from orders.js on new order
router.post('/purchase', (req, res) => {
  const { product_name, customer_name, customer_city, amount } = req.body
  if (!product_name) return res.status(400).json({ error: 'product_name required' })

  // Mask name: "Jane D." from "Jane Doe"
  const masked = maskName(customer_name || '')
  const city = customer_city || ''

  db.prepare(`
    INSERT INTO purchase_activity (product_name, customer_display, city, amount)
    VALUES (?, ?, ?, ?)
  `).run(product_name, masked, city, amount ?? null)

  // Prune to last 100 events
  const oldest = db.prepare('SELECT id FROM purchase_activity ORDER BY id DESC LIMIT -1 OFFSET 100').all().map(r => r.id)
  if (oldest.length) {
    db.prepare(`DELETE FROM purchase_activity WHERE id IN (${oldest.map(() => '?').join(',')})`).run(...oldest)
  }

  res.json({ ok: true })
})

// ── GET /api/social-proof/recent — Public: recent purchase activity feed ────────
router.get('/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || 5), 20)
  // Only return events from last 48h to keep it fresh
  const rows = db.prepare(`
    SELECT id, product_name, customer_display, city, amount, created_at
    FROM purchase_activity
    WHERE created_at >= datetime('now', '-48 hours')
    ORDER BY id DESC LIMIT ?
  `).all(limit)

  res.json(rows)
})

// ── GET /api/social-proof/admin — Admin: full stats ────────────────────────────
router.get('/admin', authMiddleware, (req, res) => {
  // Cleanup expired first
  db.prepare("DELETE FROM live_viewers WHERE expires_at < datetime('now')").run()

  const liveTotal   = db.prepare('SELECT COUNT(DISTINCT session_id) as c FROM live_viewers').get()?.c ?? 0
  const activityCount = db.prepare('SELECT COUNT(*) as c FROM purchase_activity').get()?.c ?? 0
  const topPages    = db.prepare(`
    SELECT path, COUNT(DISTINCT session_id) as viewers FROM live_viewers
    GROUP BY path ORDER BY viewers DESC LIMIT 10
  `).all()

  res.json({ live_viewers: liveTotal, purchase_events: activityCount, top_pages: topPages })
})

// ─── helpers ──────────────────────────────────────────────────────────────────

function maskName(name) {
  if (!name) return 'Someone'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 1) + '.'
  return parts[0] + ' ' + parts[parts.length - 1].slice(0, 1) + '.'
}

export default router
