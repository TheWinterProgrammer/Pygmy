// Pygmy CMS — Custom Order Statuses (Phase 59)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/order-statuses — list all statuses (built-in + custom)
router.get('/', authMiddleware, (req, res) => {
  const custom = db.prepare(`SELECT * FROM custom_order_statuses ORDER BY sort_order, id`).all()
  // Built-in statuses
  const builtIn = [
    { id: 'pending',    name: 'Pending',    color: '#f59e0b', is_default: 1, is_builtin: true, description: 'Order received, awaiting payment confirmation' },
    { id: 'processing', name: 'Processing', color: '#3b82f6', is_default: 0, is_builtin: true, description: 'Payment confirmed, preparing order' },
    { id: 'shipped',    name: 'Shipped',    color: '#8b5cf6', is_default: 0, is_builtin: true, description: 'Order shipped, in transit' },
    { id: 'completed',  name: 'Completed',  color: '#10b981', is_default: 0, is_builtin: true, description: 'Order delivered and completed' },
    { id: 'cancelled',  name: 'Cancelled',  color: '#ef4444', is_default: 0, is_builtin: true, description: 'Order was cancelled' },
    { id: 'refunded',   name: 'Refunded',   color: '#6b7280', is_default: 0, is_builtin: true, description: 'Order was refunded' },
  ]
  res.json({ built_in: builtIn, custom })
})

// POST /api/order-statuses — create custom status
router.post('/', authMiddleware, (req, res) => {
  const { slug, name, color = '#6366f1', description = '', sort_order = 0, notify_customer = 0, email_subject = '', email_body = '' } = req.body
  if (!slug || !name) return res.status(400).json({ error: 'slug and name required' })
  
  // Validate slug not a built-in
  const builtIns = ['pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded']
  if (builtIns.includes(slug)) return res.status(409).json({ error: 'That slug is a built-in status' })
  
  const existing = db.prepare(`SELECT id FROM custom_order_statuses WHERE slug = ?`).get(slug)
  if (existing) return res.status(409).json({ error: 'Status slug already exists' })
  
  const result = db.prepare(`
    INSERT INTO custom_order_statuses (slug, name, color, description, sort_order, notify_customer, email_subject, email_body)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(slug, name, color, description, sort_order, notify_customer ? 1 : 0, email_subject, email_body)
  res.json(db.prepare(`SELECT * FROM custom_order_statuses WHERE id = ?`).get(result.lastInsertRowid))
})

// PUT /api/order-statuses/:id — update custom status
router.put('/:id', authMiddleware, (req, res) => {
  const { name, color, description, sort_order, notify_customer, email_subject, email_body } = req.body
  const s = db.prepare(`SELECT id FROM custom_order_statuses WHERE id = ?`).get(Number(req.params.id))
  if (!s) return res.status(404).json({ error: 'Not found' })
  db.prepare(`
    UPDATE custom_order_statuses SET
      name = COALESCE(?, name),
      color = COALESCE(?, color),
      description = COALESCE(?, description),
      sort_order = COALESCE(?, sort_order),
      notify_customer = COALESCE(?, notify_customer),
      email_subject = COALESCE(?, email_subject),
      email_body = COALESCE(?, email_body),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name, color, description, sort_order, notify_customer != null ? (notify_customer ? 1 : 0) : null, email_subject, email_body, Number(req.params.id))
  res.json(db.prepare(`SELECT * FROM custom_order_statuses WHERE id = ?`).get(Number(req.params.id)))
})

// DELETE /api/order-statuses/:id — delete custom status
router.delete('/:id', authMiddleware, (req, res) => {
  // Check if any orders have this status
  const s = db.prepare(`SELECT slug FROM custom_order_statuses WHERE id = ?`).get(Number(req.params.id))
  if (!s) return res.status(404).json({ error: 'Not found' })
  const inUse = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = ?`).get(s.slug).c
  if (inUse > 0) return res.status(409).json({ error: `Cannot delete: ${inUse} orders use this status. Reassign them first.` })
  db.prepare(`DELETE FROM custom_order_statuses WHERE id = ?`).run(Number(req.params.id))
  res.json({ ok: true })
})

// GET /api/order-statuses/all-options — returns all statuses for select dropdowns
router.get('/all-options', (req, res) => {
  const builtIns = [
    { slug: 'pending',    name: 'Pending',    color: '#f59e0b' },
    { slug: 'processing', name: 'Processing', color: '#3b82f6' },
    { slug: 'shipped',    name: 'Shipped',    color: '#8b5cf6' },
    { slug: 'completed',  name: 'Completed',  color: '#10b981' },
    { slug: 'cancelled',  name: 'Cancelled',  color: '#ef4444' },
    { slug: 'refunded',   name: 'Refunded',   color: '#6b7280' },
  ]
  const custom = db.prepare(`SELECT slug, name, color FROM custom_order_statuses WHERE active = 1 ORDER BY sort_order, id`).all()
  res.json([...builtIns, ...custom])
})

export default router
