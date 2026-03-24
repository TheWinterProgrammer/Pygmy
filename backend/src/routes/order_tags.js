// Pygmy CMS — Order Tags API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// GET /api/order-tags — list all distinct tags (with usage count)
router.get('/', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT tag, COUNT(*) AS usage_count
    FROM order_tags
    GROUP BY tag
    ORDER BY usage_count DESC, tag ASC
  `).all()
  res.json(rows)
})

// GET /api/order-tags/order/:orderId — get tags for a specific order
router.get('/order/:orderId', auth, (req, res) => {
  const rows = db.prepare(`SELECT tag FROM order_tags WHERE order_id = ? ORDER BY tag`).all(req.params.orderId)
  res.json(rows.map(r => r.tag))
})

// POST /api/order-tags/order/:orderId — set tags for an order (replaces existing)
router.post('/order/:orderId', auth, (req, res) => {
  const { tags } = req.body
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array' })

  const clean = [...new Set(tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 20)

  db.prepare(`DELETE FROM order_tags WHERE order_id = ?`).run(req.params.orderId)
  const insert = db.prepare(`INSERT OR IGNORE INTO order_tags (order_id, tag) VALUES (?, ?)`)
  for (const tag of clean) insert.run(req.params.orderId, tag)

  // Update cached tags JSON on order row
  db.prepare(`UPDATE orders SET tags = ? WHERE id = ?`).run(JSON.stringify(clean), req.params.orderId)

  res.json({ ok: true, tags: clean })
})

// DELETE /api/order-tags/order/:orderId/:tag — remove a single tag
router.delete('/order/:orderId/:tag', auth, (req, res) => {
  db.prepare(`DELETE FROM order_tags WHERE order_id = ? AND tag = ?`).run(req.params.orderId, req.params.tag)

  const remaining = db.prepare(`SELECT tag FROM order_tags WHERE order_id = ? ORDER BY tag`).all(req.params.orderId).map(r => r.tag)
  db.prepare(`UPDATE orders SET tags = ? WHERE id = ?`).run(JSON.stringify(remaining), req.params.orderId)

  res.json({ ok: true, tags: remaining })
})

// POST /api/order-tags/bulk — add a tag to multiple orders at once
router.post('/bulk', auth, (req, res) => {
  const { order_ids, tag } = req.body
  if (!Array.isArray(order_ids) || !tag) return res.status(400).json({ error: 'order_ids and tag required' })

  const cleanTag = String(tag).trim().toLowerCase()
  const insert = db.prepare(`INSERT OR IGNORE INTO order_tags (order_id, tag) VALUES (?, ?)`)

  db.transaction(() => {
    for (const id of order_ids) {
      insert.run(id, cleanTag)
      const tags = db.prepare(`SELECT tag FROM order_tags WHERE order_id = ? ORDER BY tag`).all(id).map(r => r.tag)
      db.prepare(`UPDATE orders SET tags = ? WHERE id = ?`).run(JSON.stringify(tags), id)
    }
  })()

  res.json({ ok: true, updated: order_ids.length })
})

// GET /api/order-tags/by-tag/:tag — list orders with a specific tag
router.get('/by-tag/:tag', auth, (req, res) => {
  const { limit = 50, offset = 0 } = req.query
  const orders = db.prepare(`
    SELECT o.id, o.order_number, o.status, o.customer_name, o.customer_email,
           o.total, o.tags, o.created_at
    FROM orders o
    INNER JOIN order_tags ot ON ot.order_id = o.id
    WHERE ot.tag = ?
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.tag, parseInt(limit), parseInt(offset))

  const total = db.prepare(`SELECT COUNT(*) AS cnt FROM order_tags WHERE tag = ?`).get(req.params.tag)?.cnt || 0
  res.json({ orders, total })
})

export default router
