// Pygmy CMS — Dedicated Preorders API (Phase 54)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function parseProduct(row) {
  if (!row) return null
  return {
    ...row,
    tags: (() => { try { return JSON.parse(row.tags || '[]') } catch { return [] } })(),
    preorder_enabled: Boolean(row.preorder_enabled),
  }
}

// GET /api/preorders — list all products with preorder enabled (admin)
router.get('/', authMiddleware, (req, res) => {
  const { q, status, limit = 100, offset = 0 } = req.query
  let where = "WHERE p.preorder_enabled = 1"
  const params = []

  if (q) {
    where += ' AND (p.name LIKE ? OR p.sku LIKE ?)'
    params.push(`%${q}%`, `%${q}%`)
  }

  if (status === 'open') {
    where += ' AND (p.preorder_limit = 0 OR p.preorder_count < p.preorder_limit)'
  } else if (status === 'full') {
    where += ' AND p.preorder_limit > 0 AND p.preorder_count >= p.preorder_limit'
  }

  const products = db.prepare(`
    SELECT p.id, p.name, p.slug, p.sku, p.cover_image, p.status, p.stock_quantity,
           p.preorder_enabled, p.preorder_message, p.preorder_release_date,
           p.preorder_limit, p.preorder_count,
           p.created_at, p.updated_at
    FROM products p
    ${where}
    ORDER BY p.preorder_release_date ASC, p.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset)).map(parseProduct)

  const total = db.prepare(`SELECT COUNT(*) as c FROM products p ${where}`).get(...params)?.c || 0

  // Enrich with order data — count orders containing preorder items
  const enriched = products.map(p => {
    const orderCount = db.prepare(`
      SELECT COUNT(DISTINCT o.id) as c FROM orders o
      WHERE o.status NOT IN ('cancelled', 'refunded')
        AND o.items LIKE ?
    `).get(`%"product_id":${p.id}%`)?.c || 0
    return { ...p, order_count: orderCount }
  })

  res.json({ products: enriched, total })
})

// GET /api/preorders/stats — summary stats
router.get('/stats', authMiddleware, (req, res) => {
  const now = new Date().toISOString()
  const in30 = new Date(Date.now() + 30 * 86400 * 1000).toISOString()

  const total = db.prepare("SELECT COUNT(*) as c FROM products WHERE preorder_enabled = 1").get()?.c || 0
  const totalReservations = db.prepare("SELECT COALESCE(SUM(preorder_count),0) as s FROM products WHERE preorder_enabled = 1").get()?.s || 0
  const full = db.prepare("SELECT COUNT(*) as c FROM products WHERE preorder_enabled = 1 AND preorder_limit > 0 AND preorder_count >= preorder_limit").get()?.c || 0
  const releasingSoon = db.prepare(`
    SELECT COUNT(*) as c FROM products
    WHERE preorder_enabled = 1 AND preorder_release_date IS NOT NULL
      AND preorder_release_date >= ? AND preorder_release_date <= ?
  `).get(now, in30)?.c || 0

  res.json({ total, total_reservations: totalReservations, full, open: total - full, releasing_soon: releasingSoon })
})

// POST /api/preorders/:id/release — disable preorder on a product, optionally add stock
router.post('/:id/release', authMiddleware, (req, res) => {
  const { add_stock = 0, note = 'Preorder released' } = req.body
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id))
  if (!product) return res.status(404).json({ error: 'Product not found' })
  if (!product.preorder_enabled) return res.status(400).json({ error: 'Product is not in preorder mode' })

  db.prepare('UPDATE products SET preorder_enabled = 0 WHERE id = ?').run(product.id)

  if (add_stock > 0) {
    const newStock = (product.stock_quantity || 0) + Number(add_stock)
    db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newStock, product.id)

    // Log stock adjustment
    try {
      db.prepare(`
        INSERT INTO stock_history (product_id, adjustment, stock_before, stock_after, reason, note, created_at)
        VALUES (?, ?, ?, ?, 'preorder_release', ?, datetime('now'))
      `).run(product.id, Number(add_stock), product.stock_quantity || 0, newStock, note)
    } catch {}
  }

  // Log activity
  try {
    db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, entity_name, user_name, details, created_at)
      VALUES ('preorder_released', 'product', ?, ?, 'admin', ?, datetime('now'))
    `).run(product.id, product.name, JSON.stringify({ add_stock, note }))
  } catch {}

  res.json({ ok: true, product_id: product.id, stock_added: add_stock })
})

// POST /api/preorders/bulk-release — release multiple products from preorder
router.post('/bulk-release', authMiddleware, (req, res) => {
  const { ids = [], add_stock = 0 } = req.body
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' })

  const released = []
  for (const id of ids) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND preorder_enabled = 1').get(Number(id))
    if (!product) continue
    db.prepare('UPDATE products SET preorder_enabled = 0 WHERE id = ?').run(product.id)
    if (add_stock > 0) {
      const newStock = (product.stock_quantity || 0) + Number(add_stock)
      db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newStock, product.id)
    }
    released.push(product.id)
  }

  res.json({ ok: true, released: released.length, ids: released })
})

// GET /api/preorders/:id/orders — orders containing a specific preorder product
router.get('/:id/orders', authMiddleware, (req, res) => {
  const { limit = 50, offset = 0 } = req.query
  const rows = db.prepare(`
    SELECT id, order_number, customer_name, customer_email, total, status, created_at
    FROM orders
    WHERE status NOT IN ('cancelled', 'refunded')
      AND items LIKE ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(`%"product_id":${Number(req.params.id)}%`, Number(limit), Number(offset))
  res.json(rows)
})

export default router
