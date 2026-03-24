// Pygmy CMS — Bulk Product Price Editor (Phase 61)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ── GET /api/bulk-price/products — list products with pricing ─────────────────
router.get('/products', auth, (req, res) => {
  const { q, category, limit = 200, offset = 0 } = req.query
  const params = []
  let where = 'WHERE 1=1'

  if (q) {
    where += ` AND (p.name LIKE ? OR p.sku LIKE ?)`
    params.push(`%${q}%`, `%${q}%`)
  }
  if (category) {
    where += ` AND p.category_id = ?`
    params.push(parseInt(category))
  }

  const rows = db.prepare(`
    SELECT p.id, p.name, p.sku, p.price, p.sale_price, p.status,
           pc.name as category_name,
           p.track_stock, p.stock_quantity
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    ${where}
    ORDER BY p.name
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`
    SELECT COUNT(*) as n FROM products p ${where}
  `).get(...params)?.n || 0

  res.json({ products: rows, total })
})

// ── POST /api/bulk-price/preview — preview what changes will look like ─────────
router.post('/preview', auth, (req, res) => {
  const { product_ids, operation, value, apply_to, min_price } = req.body
  // operation: 'set_price' | 'set_sale' | 'increase_pct' | 'decrease_pct' | 'increase_fixed' | 'decrease_fixed' | 'clear_sale'
  // apply_to: 'price' | 'sale_price' | 'both'

  if (!product_ids?.length) return res.status(400).json({ error: 'product_ids required' })

  const placeholders = product_ids.map(() => '?').join(',')
  const products = db.prepare(`
    SELECT id, name, price, sale_price FROM products WHERE id IN (${placeholders})
  `).all(...product_ids)

  const preview = products.map(p => {
    let newPrice = p.price
    let newSalePrice = p.sale_price

    function applyOp(current) {
      const cur = parseFloat(current) || 0
      const val = parseFloat(value) || 0
      let result
      switch (operation) {
        case 'set_price':
        case 'set_sale':
          result = val; break
        case 'increase_pct':
          result = cur * (1 + val / 100); break
        case 'decrease_pct':
          result = cur * (1 - val / 100); break
        case 'increase_fixed':
          result = cur + val; break
        case 'decrease_fixed':
          result = cur - val; break
        default:
          result = cur
      }
      const minP = parseFloat(min_price) || 0
      return Math.max(minP, Math.round(result * 100) / 100)
    }

    if (operation === 'clear_sale') {
      newSalePrice = null
    } else if (operation === 'set_sale') {
      newSalePrice = applyOp(p.sale_price ?? p.price)
    } else if (apply_to === 'price' || apply_to === 'both') {
      newPrice = applyOp(p.price)
      if (apply_to === 'both' && p.sale_price != null) {
        newSalePrice = applyOp(p.sale_price)
      }
    } else if (apply_to === 'sale_price') {
      newSalePrice = applyOp(p.sale_price ?? p.price)
    }

    return {
      id: p.id,
      name: p.name,
      old_price: p.price,
      old_sale_price: p.sale_price,
      new_price: newPrice,
      new_sale_price: newSalePrice,
      price_change: newPrice - p.price,
      sale_change: newSalePrice != null ? (newSalePrice - (p.sale_price ?? p.price)) : null
    }
  })

  res.json({ preview })
})

// ── POST /api/bulk-price/apply — apply the price changes ──────────────────────
router.post('/apply', auth, (req, res) => {
  const { changes } = req.body
  // changes: [{ id, new_price, new_sale_price }]
  if (!changes?.length) return res.status(400).json({ error: 'changes required' })

  const stmt = db.prepare(`
    UPDATE products SET price = ?, sale_price = ?, updated_at = datetime('now') WHERE id = ?
  `)

  const applyAll = db.transaction(() => {
    for (const c of changes) {
      stmt.run(
        parseFloat(c.new_price),
        c.new_sale_price != null ? parseFloat(c.new_sale_price) : null,
        c.id
      )
    }
  })

  applyAll()

  res.json({ ok: true, updated: changes.length })
})

// ── GET /api/bulk-price/categories — for filter dropdown ──────────────────────
router.get('/categories', auth, (req, res) => {
  const rows = db.prepare('SELECT id, name FROM product_categories ORDER BY name').all()
  res.json(rows)
})

export default router
