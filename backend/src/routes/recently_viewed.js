// Pygmy CMS — Recently Viewed Products API (Phase 37)
import { Router } from 'express'
import db from '../db.js'

const router = Router()

// POST /api/recently-viewed — track a product view
router.post('/', (req, res) => {
  const { session_id, product_id } = req.body
  if (!session_id || !product_id) return res.status(400).json({ error: 'session_id and product_id required' })

  // Keep last 20 per session; upsert to update viewed_at
  db.prepare(`
    INSERT INTO recently_viewed (session_id, product_id, viewed_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(session_id, product_id) DO UPDATE SET viewed_at = datetime('now')
  `).run(session_id, Number(product_id))

  // Prune to 20 most recent for this session
  const ids = db.prepare(`
    SELECT id FROM recently_viewed WHERE session_id = ?
    ORDER BY viewed_at DESC LIMIT -1 OFFSET 20
  `).all(session_id).map(r => r.id)
  if (ids.length) {
    db.prepare(`DELETE FROM recently_viewed WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
  }

  res.json({ ok: true })
})

// GET /api/recently-viewed?session_id=&exclude= — get recently viewed products
router.get('/', (req, res) => {
  const { session_id, exclude, limit = 8 } = req.query
  if (!session_id) return res.json([])

  const excludeId = exclude ? Number(exclude) : null
  const rows = db.prepare(`
    SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.cover_image, p.status,
           rv.viewed_at
    FROM recently_viewed rv
    JOIN products p ON p.id = rv.product_id
    WHERE rv.session_id = ?
      AND p.status = 'published'
      ${excludeId ? 'AND p.id != ?' : ''}
    ORDER BY rv.viewed_at DESC
    LIMIT ?
  `).all(...[session_id, ...(excludeId ? [excludeId] : []), Number(limit)])

  res.json(rows)
})

// DELETE /api/recently-viewed?session_id= — clear history
router.delete('/', (req, res) => {
  const { session_id } = req.query
  if (!session_id) return res.status(400).json({ error: 'session_id required' })
  db.prepare('DELETE FROM recently_viewed WHERE session_id = ?').run(session_id)
  res.json({ ok: true })
})

export default router
