// Pygmy CMS — Stock Change History API (Phase 50)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

/**
 * Log a stock change. Called internally by products route and order processing.
 */
export function logStockChange({ productId, oldQty, newQty, reason = 'manual', orderId = null, adminId = null, adminName = null, note = null }) {
  try {
    db.prepare(`
      INSERT INTO stock_history (product_id, old_qty, new_qty, change_amt, reason, order_id, admin_id, admin_name, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(productId, oldQty, newQty, newQty - oldQty, reason, orderId, adminId, adminName, note)
  } catch {}
}

// GET /api/stock-history/:productId — list history for a product (admin)
router.get('/:productId', authMiddleware, (req, res) => {
  const limit  = parseInt(req.query.limit) || 50
  const offset = parseInt(req.query.offset) || 0

  const rows = db.prepare(`
    SELECT sh.*, p.name as product_name, p.sku
    FROM stock_history sh
    JOIN products p ON sh.product_id = p.id
    WHERE sh.product_id = ?
    ORDER BY sh.created_at DESC
    LIMIT ? OFFSET ?
  `).all(Number(req.params.productId), limit, offset)

  const total = db.prepare('SELECT COUNT(*) as c FROM stock_history WHERE product_id = ?').get(Number(req.params.productId)).c

  res.json({ history: rows, total })
})

// GET /api/stock-history — all recent stock changes (admin, for global stock audit)
router.get('/', authMiddleware, (req, res) => {
  const limit  = parseInt(req.query.limit) || 100
  const offset = parseInt(req.query.offset) || 0
  const q = req.query.q

  let sql = `
    SELECT sh.*, p.name as product_name, p.sku
    FROM stock_history sh
    JOIN products p ON sh.product_id = p.id
    WHERE 1=1
  `
  const params = []
  if (q) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)'
    params.push(`%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY sh.created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const rows = db.prepare(sql).all(...params)
  const total = db.prepare('SELECT COUNT(*) as c FROM stock_history').get().c

  res.json({ history: rows, total })
})

// POST /api/stock-history/adjust — manual stock adjustment (admin)
router.post('/adjust', authMiddleware, (req, res) => {
  const { product_id, adjustment, note } = req.body
  if (!product_id || adjustment === undefined) {
    return res.status(400).json({ error: 'product_id and adjustment are required' })
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id))
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const oldQty = product.stock_quantity ?? 0
  const newQty = Math.max(0, oldQty + parseInt(adjustment))

  db.prepare('UPDATE products SET stock_quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newQty, product.id)

  logStockChange({
    productId: product.id,
    oldQty,
    newQty,
    reason: 'adjustment',
    adminId: req.user?.id,
    adminName: req.user?.name,
    note: note || `Manual adjustment: ${adjustment > 0 ? '+' : ''}${adjustment}`,
  })

  res.json({ ok: true, old_qty: oldQty, new_qty: newQty, product_id: product.id })
})

export default router
