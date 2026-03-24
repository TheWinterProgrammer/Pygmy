// Pygmy CMS — Order Multi-Shipment Tracking API (Phase 54)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// Ensure table exists (safe migration)
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS order_shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      carrier TEXT,
      tracking_number TEXT,
      tracking_url TEXT,
      items TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      shipped_at TEXT,
      delivered_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
} catch {}

function parseShipment(row) {
  if (!row) return null
  return {
    ...row,
    items: (() => { try { return JSON.parse(row.items || '[]') } catch { return [] } })(),
  }
}

// GET /api/order-shipments?order_id= — list shipments for an order (admin)
router.get('/', authMiddleware, (req, res) => {
  const { order_id } = req.query
  if (!order_id) return res.status(400).json({ error: 'order_id required' })
  const rows = db.prepare(
    'SELECT * FROM order_shipments WHERE order_id = ? ORDER BY created_at ASC'
  ).all(Number(order_id)).map(parseShipment)
  res.json(rows)
})

// GET /api/order-shipments/public/:orderNumber — public tracking (by order number)
router.get('/public/:orderNumber', (req, res) => {
  const order = db.prepare('SELECT id, order_number, status FROM orders WHERE order_number = ?').get(req.params.orderNumber)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  const shipments = db.prepare(
    "SELECT carrier, tracking_number, tracking_url, status, shipped_at, delivered_at FROM order_shipments WHERE order_id = ? AND status != 'pending'"
  ).all(order.id).map(parseShipment)
  res.json({ order_number: order.order_number, order_status: order.status, shipments })
})

// POST /api/order-shipments — create a shipment (admin)
router.post('/', authMiddleware, (req, res) => {
  const { order_id, carrier, tracking_number, tracking_url, items = [], status = 'pending', notes } = req.body
  if (!order_id) return res.status(400).json({ error: 'order_id required' })

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(order_id))
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO order_shipments (order_id, carrier, tracking_number, tracking_url, items, status, notes,
      shipped_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?,
      CASE WHEN ? = 'shipped' THEN datetime('now') ELSE NULL END,
      datetime('now'), datetime('now'))
  `).run(Number(order_id), carrier || null, tracking_number || null, tracking_url || null,
      JSON.stringify(Array.isArray(items) ? items : []), status, notes || null, status)

  const shipment = parseShipment(db.prepare('SELECT * FROM order_shipments WHERE id = ?').get(lastInsertRowid))

  // Add order timeline event
  if (tracking_number) {
    try {
      db.prepare(`
        INSERT INTO order_timeline (order_id, event_type, message, notify_customer, created_by, created_at)
        VALUES (?, 'shipment', ?, 0, ?, datetime('now'))
      `).run(Number(order_id), `Shipment created${carrier ? ` via ${carrier}` : ''}: ${tracking_number}`, req.user?.name || 'admin')
    } catch {}
  }

  res.status(201).json(shipment)
})

// PUT /api/order-shipments/:id — update a shipment (admin)
router.put('/:id', authMiddleware, (req, res) => {
  const shipment = db.prepare('SELECT * FROM order_shipments WHERE id = ?').get(Number(req.params.id))
  if (!shipment) return res.status(404).json({ error: 'Shipment not found' })

  const { carrier, tracking_number, tracking_url, items, status, notes, shipped_at, delivered_at } = req.body

  const newStatus = status || shipment.status
  const shippedAt = newStatus === 'shipped' && !shipment.shipped_at
    ? new Date().toISOString()
    : (shipped_at !== undefined ? shipped_at : shipment.shipped_at)
  const deliveredAt = newStatus === 'delivered' && !shipment.delivered_at
    ? new Date().toISOString()
    : (delivered_at !== undefined ? delivered_at : shipment.delivered_at)

  db.prepare(`
    UPDATE order_shipments SET
      carrier = COALESCE(?, carrier),
      tracking_number = COALESCE(?, tracking_number),
      tracking_url = COALESCE(?, tracking_url),
      items = COALESCE(?, items),
      status = ?,
      notes = COALESCE(?, notes),
      shipped_at = ?,
      delivered_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(carrier, tracking_number, tracking_url,
    items ? JSON.stringify(items) : null,
    newStatus, notes, shippedAt, deliveredAt, shipment.id)

  res.json(parseShipment(db.prepare('SELECT * FROM order_shipments WHERE id = ?').get(shipment.id)))
})

// DELETE /api/order-shipments/:id — delete a shipment (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  const shipment = db.prepare('SELECT * FROM order_shipments WHERE id = ?').get(Number(req.params.id))
  if (!shipment) return res.status(404).json({ error: 'Shipment not found' })
  db.prepare('DELETE FROM order_shipments WHERE id = ?').run(shipment.id)
  res.json({ ok: true })
})

export default router

// GET /api/order-shipments/recent — list recent shipments across all orders (admin)
router.get('/recent', authMiddleware, (req, res) => {
  const { q, status, limit = 50, offset = 0 } = req.query
  let where = 'WHERE 1=1'
  const params = []

  if (status) {
    where += ' AND s.status = ?'
    params.push(status)
  }

  if (q) {
    where += ' AND (o.order_number LIKE ? OR s.tracking_number LIKE ? OR s.carrier LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  const rows = db.prepare(`
    SELECT s.*, o.order_number, o.customer_name, o.customer_email
    FROM order_shipments s
    LEFT JOIN orders o ON o.id = s.order_id
    ${where}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset)).map(r => ({
    ...parseShipment(r),
    order_number: r.order_number,
    customer_name: r.customer_name,
    customer_email: r.customer_email,
  }))

  res.json(rows)
})
