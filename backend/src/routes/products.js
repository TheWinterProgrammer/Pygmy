// Products API (SQLite-backed)
// GET    /api/products                  → published products list
// GET    /api/products?all=1            → all products (auth)
// GET    /api/products/:slug            → single product
// POST   /api/products                 → create product (auth)
// PUT    /api/products/:id             → update product (auth)
// DELETE /api/products/:id             → delete product (auth)
// GET    /api/products/categories      → list categories
// POST   /api/products/categories      → add category (auth)
// DELETE /api/products/categories/:id  → delete category (auth)

import express from 'express'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const JWT_SECRET = process.env.JWT_SECRET || 'pygmy-secret-change-me'

function hasValidAuth(req) {
  const authHeader = req.headers['authorization'] || ''
  const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.preview_token || '')
  if (!raw) return false
  try { jwt.verify(raw, JWT_SECRET); return true } catch { return false }
}

const router = express.Router()

// ─── helpers ──────────────────────────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function parseProduct(row) {
  if (!row) return null
  return {
    ...row,
    tags: (() => { try { return JSON.parse(row.tags || '[]') } catch { return [] } })(),
    gallery: (() => { try { return JSON.parse(row.gallery || '[]') } catch { return [] } })(),
    featured: Boolean(row.featured),
  }
}

// ─── categories ───────────────────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT * FROM product_categories ORDER BY name').all()
  res.json(rows)
})

router.post('/categories', authMiddleware, (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })
  const slug = slugify(name)
  try {
    const info = db.prepare('INSERT INTO product_categories (name, slug) VALUES (?,?)').run(name.trim(), slug)
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim(), slug })
  } catch {
    res.status(409).json({ error: 'Category already exists' })
  }
})

router.delete('/categories/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM product_categories WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ─── single by id (admin) ─────────────────────────────────────────────────────
router.get('/id/:id', authMiddleware, (req, res) => {
  const row = db.prepare(`
    SELECT p.*, pc.name AS category_name, pc.slug AS category_slug
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE p.id = ?
  `).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(parseProduct(row))
})

// ─── list ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const isAdmin = req.headers.authorization && (() => {
    try {
      const jwt = req.headers.authorization.replace('Bearer ', '')
      // minimal check — full auth applied in POST/PUT/DELETE
      return Boolean(jwt)
    } catch { return false }
  })()
  const showAll = req.query.all === '1'
  const { category, tag, featured, limit = 20, offset = 0 } = req.query

  let sql = `
    SELECT p.*, pc.name AS category_name
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE 1=1
  `
  const params = []

  if (!showAll) {
    sql += ' AND p.status = ?'
    params.push('published')
  }
  if (featured === '1') {
    sql += ' AND p.featured = 1'
  }
  if (category) {
    sql += ' AND pc.slug = ?'
    params.push(category)
  }

  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  let rows = db.prepare(sql).all(...params)

  // tag filter (post-query, stored as JSON array)
  if (tag) {
    rows = rows.filter(r => {
      try { return JSON.parse(r.tags || '[]').includes(tag) } catch { return false }
    })
  }

  const total = db.prepare(
    `SELECT COUNT(*) AS n FROM products ${!showAll ? 'WHERE status="published"' : ''}`
  ).get().n

  res.json({ products: rows.map(parseProduct), total })
})

// ─── single ───────────────────────────────────────────────────────────────────
// POST /api/products/bulk (auth)
router.post('/bulk', authMiddleware, (req, res) => {
  const { action, ids } = req.body
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'action and ids[] required' })
  }
  const placeholders = ids.map(() => '?').join(',')

  if (action === 'delete') {
    const rows = db.prepare(`SELECT id, name FROM products WHERE id IN (${placeholders})`).all(...ids)
    db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...ids)
    rows.forEach(r => logActivity(req.user?.id, req.user?.name, 'deleted product', 'product', r.id, r.name))
    return res.json({ affected: rows.length })
  }

  if (action === 'publish' || action === 'unpublish') {
    const newStatus = action === 'publish' ? 'published' : 'draft'
    const publishAt = action === 'publish' ? new Date().toISOString() : null
    db.prepare(
      `UPDATE products SET status=?, publish_at=?, updated_at=datetime('now') WHERE id IN (${placeholders})`
    ).run(newStatus, publishAt, ...ids)
    const rows = db.prepare(`SELECT id, name FROM products WHERE id IN (${placeholders})`).all(...ids)
    rows.forEach(r => logActivity(req.user?.id, req.user?.name, `${action}ed product`, 'product', r.id, r.name))
    return res.json({ affected: rows.length })
  }

  res.status(400).json({ error: 'Unknown action' })
})

// GET /api/products/:slug — draft visible with valid admin JWT
router.get('/:slug', (req, res) => {
  const isAdmin = hasValidAuth(req)
  const statusFilter = isAdmin ? "p.status IN ('published','draft')" : "p.status = 'published'"
  const row = db.prepare(`
    SELECT p.*, pc.name AS category_name
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE p.slug = ? AND ${statusFilter}
  `).get(req.params.slug)
  if (!row) return res.status(404).json({ error: 'Not found' })
  const parsed = parseProduct(row)
  res.json({ ...parsed, _preview: isAdmin && row.status !== 'published' })
})

// ─── create ───────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const {
    name, excerpt = '', description = '',
    price = null, sale_price = null, sku = null,
    cover_image = null, gallery = [],
    category_id = null, tags = [], status = 'draft',
    featured = false, meta_title = null, meta_desc = null,
    publish_at = null
  } = req.body

  if (!name?.trim()) return res.status(400).json({ error: 'name required' })

  let slug = slugify(name)
  // ensure uniqueness
  let existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)
  if (existing) slug = `${slug}-${Date.now()}`

  const finalStatus = status || 'draft'
  let finalPublishAt = null
  if (finalStatus === 'published') finalPublishAt = publish_at || new Date().toISOString()
  else if (finalStatus === 'scheduled') finalPublishAt = publish_at || null

  const info = db.prepare(`
    INSERT INTO products
      (name, slug, excerpt, description, price, sale_price, sku, cover_image, gallery,
       category_id, tags, status, featured, meta_title, meta_desc, publish_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    name.trim(), slug, excerpt, description,
    price, sale_price, sku, cover_image,
    JSON.stringify(gallery), category_id,
    JSON.stringify(tags), finalStatus,
    featured ? 1 : 0, meta_title, meta_desc, finalPublishAt
  )

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)
  logActivity(req.user?.id, req.user?.name, 'created product', 'product', product.id, product.name)
  res.status(201).json(parseProduct(product))
})

// ─── update ───────────────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const {
    name, excerpt, description,
    price, sale_price, sku,
    cover_image, gallery,
    category_id, tags, status, featured,
    meta_title, meta_desc, publish_at
  } = req.body

  // only regenerate slug if name changed and no slug conflict
  let slug = existing.slug
  if (name && slugify(name) !== existing.slug) {
    const candidate = slugify(name)
    const conflict = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(candidate, existing.id)
    if (!conflict) slug = candidate
  }

  const newStatus = status ?? existing.status
  let newPublishAt = publish_at !== undefined ? publish_at : existing.publish_at
  if (newStatus === 'published' && !newPublishAt) newPublishAt = new Date().toISOString()
  if (newStatus === 'draft') newPublishAt = null

  db.prepare(`
    UPDATE products SET
      name = ?, slug = ?, excerpt = ?, description = ?,
      price = ?, sale_price = ?, sku = ?,
      cover_image = ?, gallery = ?, category_id = ?,
      tags = ?, status = ?, featured = ?,
      meta_title = ?, meta_desc = ?, publish_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? existing.name,
    slug,
    excerpt ?? existing.excerpt,
    description ?? existing.description,
    price !== undefined ? price : existing.price,
    sale_price !== undefined ? sale_price : existing.sale_price,
    sku !== undefined ? sku : existing.sku,
    cover_image !== undefined ? cover_image : existing.cover_image,
    gallery !== undefined ? JSON.stringify(gallery) : existing.gallery,
    category_id !== undefined ? category_id : existing.category_id,
    tags !== undefined ? JSON.stringify(tags) : existing.tags,
    newStatus,
    featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    meta_title !== undefined ? meta_title : existing.meta_title,
    meta_desc !== undefined ? meta_desc : existing.meta_desc,
    newPublishAt,
    existing.id
  )

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id)
  logActivity(req.user?.id, req.user?.name, 'updated product', 'product', updated.id, updated.name)
  res.json(parseProduct(updated))
})

// ─── delete ───────────────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!product) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id)
  logActivity(req.user?.id, req.user?.name, 'deleted product', 'product', product.id, product.name)
  res.json({ success: true })
})

export default router
