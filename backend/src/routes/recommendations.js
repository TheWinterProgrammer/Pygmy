// Pygmy CMS — Product Recommendations API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseProduct(row) {
  if (!row) return null
  return {
    ...row,
    gallery: (() => { try { return JSON.parse(row.gallery || '[]') } catch { return [] } })(),
    tags: (() => { try { return JSON.parse(row.tags || '[]') } catch { return [] } })(),
  }
}

// ── GET /api/recommendations?product_id=&type= — Public/Admin: list recs ─────
router.get('/', (req, res) => {
  const { product_id, type } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  let query = `
    SELECT pr.id, pr.product_id, pr.recommended_id, pr.type, pr.sort_order,
           p.name, p.slug, p.price, p.sale_price, p.cover_image, p.status,
           p.excerpt, p.stock_quantity, p.track_stock, p.allow_backorder
    FROM product_recommendations pr
    JOIN products p ON p.id = pr.recommended_id
    WHERE pr.product_id = ?
  `
  const params = [product_id]

  if (type) {
    query += ' AND pr.type = ?'
    params.push(type)
  }

  // Public: only show published recommended products
  const isAdmin = !!req.headers.authorization
  if (!isAdmin) {
    query += " AND p.status = 'published'"
  }

  query += ' ORDER BY pr.sort_order ASC, pr.id ASC'

  const rows = db.prepare(query).all(...params).map(parseProduct)
  res.json(rows)
})

// ── GET /api/recommendations/auto?product_id= — Public: smart auto-recs ─────
// Returns: same-category products ordered by sales (fallback to recent)
router.get('/auto', (req, res) => {
  const { product_id, limit = 4 } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  // Manual recommendations first
  const manual = db.prepare(`
    SELECT pr.recommended_id as id, p.name, p.slug, p.price, p.sale_price, p.cover_image, p.excerpt,
           p.stock_quantity, p.track_stock, p.allow_backorder, 'manual' as source
    FROM product_recommendations pr
    JOIN products p ON p.id = pr.recommended_id
    WHERE pr.product_id = ? AND p.status = 'published' AND pr.type = 'related'
    ORDER BY pr.sort_order ASC LIMIT ?
  `).all(product_id, parseInt(limit))

  if (manual.length >= parseInt(limit)) {
    return res.json(manual.map(parseProduct))
  }

  // Fill remaining with frequently bought together (from order data)
  const needed = parseInt(limit) - manual.length
  const manualIds = manual.map(r => r.id)

  // Build exclusion list
  const excludeIds = [parseInt(product_id), ...manualIds]
  const placeholders = excludeIds.map(() => '?').join(',')

  // Frequently bought together: find products that appear in the same orders
  const fbt = db.prepare(`
    SELECT oi2.product_id as id, COUNT(*) as co_count,
           p.name, p.slug, p.price, p.sale_price, p.cover_image, p.excerpt,
           p.stock_quantity, p.track_stock, p.allow_backorder
    FROM orders o
    JOIN (
      SELECT order_id FROM orders o2
      WHERE EXISTS (
        SELECT 1 FROM json_each(o2.items)
        WHERE json_extract(value, '$.product_id') = ?
      )
    ) matched ON matched.order_id = o.id
    JOIN json_each(o.items) oi2
    JOIN products p ON p.id = json_extract(oi2.value, '$.product_id')
    WHERE json_extract(oi2.value, '$.product_id') NOT IN (${placeholders})
      AND p.status = 'published'
    GROUP BY oi2.product_id
    ORDER BY co_count DESC
    LIMIT ?
  `).all(parseInt(product_id), ...excludeIds, needed)

  if (fbt.length >= needed) {
    return res.json([...manual, ...fbt].map(parseProduct))
  }

  // Final fallback: same category, random
  const stillNeeded = needed - fbt.length
  const fbtIds = fbt.map(r => r.id)
  const allExclude = [...excludeIds, ...fbtIds]
  const allPlaceholders = allExclude.map(() => '?').join(',')

  const fallback = db.prepare(`
    SELECT id, name, slug, price, sale_price, cover_image, excerpt,
           stock_quantity, track_stock, allow_backorder
    FROM products
    WHERE category = ? AND id NOT IN (${allPlaceholders}) AND status = 'published'
    ORDER BY RANDOM()
    LIMIT ?
  `).all(product.category, ...allExclude, stillNeeded)

  res.json([...manual, ...fbt, ...fallback].map(parseProduct))
})

// ── POST /api/recommendations — Admin: add recommendation ─────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { product_id, recommended_id, type = 'related', sort_order = 0 } = req.body
  if (!product_id || !recommended_id) {
    return res.status(400).json({ error: 'product_id and recommended_id required' })
  }
  if (product_id === recommended_id) {
    return res.status(400).json({ error: 'Cannot recommend a product to itself' })
  }

  try {
    const result = db.prepare(`
      INSERT OR IGNORE INTO product_recommendations (product_id, recommended_id, type, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(product_id, recommended_id, type, sort_order)

    if (result.changes === 0) {
      return res.status(409).json({ error: 'Recommendation already exists' })
    }

    res.status(201).json({ ok: true, id: result.lastInsertRowid })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/recommendations/:id — Admin: update sort order / type ─────────────
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare("SELECT * FROM product_recommendations WHERE id = ?").get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const { type = existing.type, sort_order = existing.sort_order } = req.body
  db.prepare("UPDATE product_recommendations SET type = ?, sort_order = ? WHERE id = ?")
    .run(type, sort_order, existing.id)

  res.json({ ok: true })
})

// ── DELETE /api/recommendations/:id — Admin: remove recommendation ─────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare("DELETE FROM product_recommendations WHERE id = ?").run(req.params.id)
  res.json({ ok: true })
})

// ── POST /api/recommendations/reorder — Admin: reorder ─────────────────────────
// Body: { product_id, type, order: [id, id, ...] }
router.post('/reorder', authMiddleware, (req, res) => {
  const { order = [] } = req.body
  const update = db.prepare("UPDATE product_recommendations SET sort_order = ? WHERE id = ?")
  const tx = db.transaction(() => {
    order.forEach((id, idx) => update.run(idx, id))
  })
  tx()
  res.json({ ok: true })
})

export default router
