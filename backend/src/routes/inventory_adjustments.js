// Pygmy CMS — Inventory Adjustment Log API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// GET /api/inventory-adjustments — list adjustments (filterable)
router.get('/', auth, (req, res) => {
  const { product_id, reason, from, to, limit = 50, offset = 0 } = req.query
  const where = []
  const params = []

  if (product_id) { where.push('ia.product_id = ?'); params.push(product_id) }
  if (reason)     { where.push('ia.reason = ?'); params.push(reason) }
  if (from)       { where.push("date(ia.created_at) >= date(?)"); params.push(from) }
  if (to)         { where.push("date(ia.created_at) <= date(?)"); params.push(to) }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const rows = db.prepare(`
    SELECT ia.*, p.name AS product_name, p.sku, u.name AS user_name
    FROM inventory_adjustments ia
    LEFT JOIN products p ON p.id = ia.product_id
    LEFT JOIN users u ON u.id = ia.user_id
    ${whereStr}
    ORDER BY ia.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`
    SELECT COUNT(*) AS cnt FROM inventory_adjustments ia ${whereStr}
  `).get(...params)?.cnt || 0

  res.json({ adjustments: rows, total })
})

// GET /api/inventory-adjustments/stats — summary stats
router.get('/stats', auth, (req, res) => {
  const { days = 30 } = req.query
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_adjustments,
      SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END) AS total_added,
      SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END) AS total_removed,
      COUNT(DISTINCT product_id) AS products_adjusted
    FROM inventory_adjustments
    WHERE created_at >= datetime('now', ?)
  `).get(`-${days} days`)

  const byReason = db.prepare(`
    SELECT reason, COUNT(*) AS cnt, SUM(qty_change) AS net_change
    FROM inventory_adjustments
    WHERE created_at >= datetime('now', ?)
    GROUP BY reason
    ORDER BY cnt DESC
  `).all(`-${days} days`)

  const daily = db.prepare(`
    SELECT date(created_at) AS day,
           SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END) AS added,
           SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END) AS removed
    FROM inventory_adjustments
    WHERE created_at >= datetime('now', ?)
    GROUP BY day
    ORDER BY day
  `).all(`-${days} days`)

  res.json({ stats, byReason, daily })
})

// GET /api/inventory-adjustments/export/csv — CSV export
router.get('/export/csv', auth, (req, res) => {
  const { product_id, reason, from, to } = req.query
  const where = []
  const params = []

  if (product_id) { where.push('ia.product_id = ?'); params.push(product_id) }
  if (reason)     { where.push('ia.reason = ?'); params.push(reason) }
  if (from)       { where.push("date(ia.created_at) >= date(?)"); params.push(from) }
  if (to)         { where.push("date(ia.created_at) <= date(?)"); params.push(to) }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const rows = db.prepare(`
    SELECT ia.id, p.name AS product_name, p.sku, ia.reason, ia.qty_before,
           ia.qty_change, ia.qty_after, ia.note, u.name AS user_name, ia.created_at
    FROM inventory_adjustments ia
    LEFT JOIN products p ON p.id = ia.product_id
    LEFT JOIN users u ON u.id = ia.user_id
    ${whereStr}
    ORDER BY ia.created_at DESC
  `).all(...params)

  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = ['ID', 'Product', 'SKU', 'Reason', 'Before', 'Change', 'After', 'Note', 'User', 'Date']
  const csv = [header.join(',')]
  for (const r of rows) {
    csv.push([r.id, escape(r.product_name), escape(r.sku), r.reason, r.qty_before, r.qty_change, r.qty_after, escape(r.note), escape(r.user_name), r.created_at].join(','))
  }

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="inventory-adjustments.csv"')
  res.send(csv.join('\n'))
})

// GET /api/inventory-adjustments/product/:productId — history for one product
router.get('/product/:productId', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT ia.*, u.name AS user_name
    FROM inventory_adjustments ia
    LEFT JOIN users u ON u.id = ia.user_id
    WHERE ia.product_id = ?
    ORDER BY ia.created_at DESC
    LIMIT 100
  `).all(req.params.productId)
  res.json(rows)
})

// POST /api/inventory-adjustments — create a manual stock adjustment
router.post('/', auth, (req, res) => {
  const { product_id, qty_change, reason = 'manual', note } = req.body
  if (!product_id || qty_change === undefined) {
    return res.status(400).json({ error: 'product_id and qty_change required' })
  }

  const product = db.prepare(`SELECT id, name, stock_quantity, track_stock FROM products WHERE id = ?`).get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const qty_before = product.stock_quantity || 0
  const qty_after  = qty_before + parseInt(qty_change)

  db.prepare(`UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?`).run(qty_after, product_id)

  const result = db.prepare(`
    INSERT INTO inventory_adjustments (product_id, user_id, reason, qty_before, qty_change, qty_after, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(product_id, req.user?.id || null, reason, qty_before, parseInt(qty_change), qty_after, note || null)

  res.json({
    ok: true,
    id: result.lastInsertRowid,
    product_name: product.name,
    qty_before,
    qty_change: parseInt(qty_change),
    qty_after
  })
})

export default router
