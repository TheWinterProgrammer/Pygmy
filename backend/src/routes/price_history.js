// Pygmy CMS — Product Price History API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Get price history for a product ─────────────────────────────────────────
// GET /api/price-history?product_id=5&limit=50
router.get('/', (req, res) => {
  const { product_id, limit = 50 } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const history = db.prepare(`
    SELECT id, price, sale_price, changed_by_name, note, created_at
    FROM product_price_history
    WHERE product_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(parseInt(product_id), parseInt(limit))

  res.json({ history })
})

// ─── Admin: Get price history with admin detail ───────────────────────────────
router.get('/admin', authMiddleware, (req, res) => {
  const { product_id, limit = 100 } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const history = db.prepare(`
    SELECT * FROM product_price_history
    WHERE product_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(parseInt(product_id), parseInt(limit))

  // Include current product price for context
  const product = db.prepare(`SELECT id, name, price, sale_price FROM products WHERE id = ?`).get(parseInt(product_id))

  res.json({ history, product })
})

// ─── Admin: Get price change stats across all products ────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const { days = 30 } = req.query
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT product_id) as products_changed,
      COUNT(*) as total_changes,
      MAX(created_at) as last_change
    FROM product_price_history
    WHERE created_at >= datetime('now', ?)
  `).get(`-${days} days`)

  const recent = db.prepare(`
    SELECT ph.*, p.name as product_name, p.slug as product_slug
    FROM product_price_history ph
    LEFT JOIN products p ON ph.product_id = p.id
    ORDER BY ph.created_at DESC
    LIMIT 20
  `).all()

  res.json({ ...stats, recent })
})

export default router
