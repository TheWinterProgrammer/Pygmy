// Pygmy CMS — Product Margin Analytics API (Phase 75)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/margin — paginated list of products with margin data
router.get('/', authMiddleware, (req, res) => {
  const { q, category, sort = 'margin_asc', limit = 50, offset = 0 } = req.query
  const lim = Math.min(Number(limit) || 50, 200)
  const off = Number(offset) || 0

  let where = []
  const params = []

  if (q) { where.push('(name LIKE ? OR sku LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (category) { where.push('category_id = (SELECT id FROM product_categories WHERE name = ?)'); params.push(category) }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  let orderBy = 'margin_pct ASC'
  if (sort === 'margin_desc')  orderBy = 'margin_pct DESC'
  else if (sort === 'revenue') orderBy = 'revenue_est DESC'
  else if (sort === 'name')    orderBy = 'name ASC'
  else if (sort === 'price')   orderBy = 'price DESC'

  const products = db.prepare(`
    SELECT
      p.id, p.name, p.slug, p.sku, p.cover_image,
      p.price, p.sale_price, p.cost_price,
      p.status, p.stock_quantity, p.track_stock,
      pc.name AS category,
      -- Effective selling price
      CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END AS effective_price,
      -- Margin amount
      CASE WHEN p.cost_price IS NOT NULL AND p.cost_price > 0
        THEN (CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) - p.cost_price
        ELSE NULL
      END AS margin_amt,
      -- Margin percentage
      CASE WHEN p.cost_price IS NOT NULL AND p.cost_price > 0
           AND (CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) > 0
        THEN ROUND(
          (((CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) - p.cost_price)
           / (CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END))
          * 100, 1)
        ELSE NULL
      END AS margin_pct,
      -- Units sold (from order items)
      COALESCE((
        SELECT SUM(json_each.value->>'quantity')
        FROM orders o, json_each(o.items)
        WHERE json_each.value->>'product_id' = CAST(p.id AS TEXT)
          AND o.status NOT IN ('cancelled','refunded')
      ), 0) AS units_sold
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, lim, off)

  const total = db.prepare(`SELECT COUNT(*) as c FROM products ${whereClause}`).get(...params)?.c || 0

  res.json({ products, total })
})

// GET /api/margin/summary — aggregate margin stats
router.get('/summary', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT
      COUNT(*) AS total_products,
      SUM(CASE WHEN cost_price IS NOT NULL AND cost_price > 0 THEN 1 ELSE 0 END) AS with_cost,
      ROUND(AVG(CASE
        WHEN cost_price IS NOT NULL AND cost_price > 0
             AND (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) > 0
        THEN ((CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) - cost_price)
             / (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) * 100
        ELSE NULL END), 1) AS avg_margin_pct,
      SUM(CASE
        WHEN cost_price IS NOT NULL AND cost_price > 0
          AND (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) > 0
          AND ((CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) - cost_price)
              / (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) * 100 < 20
        THEN 1 ELSE 0 END) AS low_margin_count,
      SUM(CASE
        WHEN cost_price IS NOT NULL AND cost_price > 0
          AND (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) > 0
          AND ((CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) - cost_price) < 0
        THEN 1 ELSE 0 END) AS negative_margin_count
    FROM products
    WHERE status = 'published'
  `).get() || {}

  // Best and worst margin products
  const best = db.prepare(`
    SELECT id, name, sku, price, sale_price, cost_price,
      ROUND(
        ((CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) - cost_price)
        / (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) * 100
      , 1) AS margin_pct
    FROM products
    WHERE cost_price IS NOT NULL AND cost_price > 0
      AND (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) > 0
      AND status = 'published'
    ORDER BY margin_pct DESC
    LIMIT 5
  `).all()

  const worst = db.prepare(`
    SELECT id, name, sku, price, sale_price, cost_price,
      ROUND(
        ((CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) - cost_price)
        / (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) * 100
      , 1) AS margin_pct
    FROM products
    WHERE cost_price IS NOT NULL AND cost_price > 0
      AND (CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END) > 0
      AND status = 'published'
    ORDER BY margin_pct ASC
    LIMIT 5
  `).all()

  // Category breakdown
  const byCategory = db.prepare(`
    SELECT
      COALESCE(pc.name, 'Uncategorized') AS category,
      COUNT(*) AS products,
      ROUND(AVG(CASE
        WHEN p.cost_price IS NOT NULL AND p.cost_price > 0
          AND (CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) > 0
        THEN ((CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) - p.cost_price)
             / (CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) * 100
        ELSE NULL END), 1) AS avg_margin_pct
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE p.status = 'published' AND p.cost_price IS NOT NULL AND p.cost_price > 0
    GROUP BY COALESCE(pc.name, 'Uncategorized')
    ORDER BY avg_margin_pct DESC
  `).all()

  res.json({ ...rows, best, worst, byCategory })
})

// GET /api/margin/export/csv — export margin data as CSV
router.get('/export/csv', authMiddleware, (req, res) => {
  const products = db.prepare(`
    SELECT
      p.id, p.name, p.sku, p.status,
      p.price, p.sale_price, p.cost_price,
      CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END AS effective_price,
      CASE WHEN p.cost_price IS NOT NULL AND p.cost_price > 0
        THEN ROUND((CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) - p.cost_price, 2)
        ELSE ''
      END AS margin_amt,
      CASE WHEN p.cost_price IS NOT NULL AND p.cost_price > 0
           AND (CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) > 0
        THEN ROUND(((CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) - p.cost_price)
             / (CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 THEN p.sale_price ELSE p.price END) * 100, 1)
        ELSE ''
      END AS margin_pct,
      COALESCE(pc.name, '') AS category
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    ORDER BY p.name ASC
  `).all()

  const headers = ['ID', 'Name', 'SKU', 'Status', 'Price', 'Sale Price', 'Cost Price', 'Effective Price', 'Margin Amt', 'Margin %', 'Category']
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`

  const csvRows = [
    headers.map(esc).join(','),
    ...products.map(p => [
      p.id, esc(p.name), esc(p.sku ?? ''), esc(p.status),
      p.price ?? '', p.sale_price ?? '', p.cost_price ?? '',
      p.effective_price ?? '', p.margin_amt ?? '', p.margin_pct ?? '',
      esc(p.category)
    ].join(','))
  ]

  const date = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="product-margins-${date}.csv"`)
  res.send(csvRows.join('\n'))
})

// PUT /api/margin/:id — update cost_price for a product
router.put('/:id', authMiddleware, (req, res) => {
  const { cost_price } = req.body
  const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(Number(req.params.id))
  if (!product) return res.status(404).json({ error: 'Product not found' })

  db.prepare(`UPDATE products SET cost_price = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(cost_price !== undefined && cost_price !== '' ? Number(cost_price) : null, product.id)

  res.json(db.prepare('SELECT id, name, price, sale_price, cost_price FROM products WHERE id = ?').get(product.id))
})

export default router
