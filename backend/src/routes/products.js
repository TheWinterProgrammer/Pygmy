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
import multer from 'multer'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'
import { notifyLowStock } from '../email.js'

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

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
    track_stock: Boolean(row.track_stock),
    allow_backorder: Boolean(row.allow_backorder),
    stock_quantity: row.stock_quantity ?? 0,
    low_stock_threshold: row.low_stock_threshold ?? 5,
    is_digital: Boolean(row.is_digital),
    in_stock: !row.track_stock || row.stock_quantity > 0 || Boolean(row.allow_backorder),
    low_stock: Boolean(row.track_stock) && (row.stock_quantity ?? 0) <= (row.low_stock_threshold ?? 5) && (row.stock_quantity ?? 0) > 0,
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
    publish_at = null,
    track_stock = false, stock_quantity = 0,
    allow_backorder = false, low_stock_threshold = 5,
    is_digital = false,
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
       category_id, tags, status, featured, meta_title, meta_desc, publish_at,
       track_stock, stock_quantity, allow_backorder, low_stock_threshold, is_digital)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    name.trim(), slug, excerpt, description,
    price, sale_price, sku, cover_image,
    JSON.stringify(gallery), category_id,
    JSON.stringify(tags), finalStatus,
    featured ? 1 : 0, meta_title, meta_desc, finalPublishAt,
    track_stock ? 1 : 0,
    parseInt(stock_quantity) || 0,
    allow_backorder ? 1 : 0,
    parseInt(low_stock_threshold) || 5,
    is_digital ? 1 : 0,
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
    meta_title, meta_desc, publish_at,
    track_stock, stock_quantity, allow_backorder, low_stock_threshold,
    is_digital,
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
      track_stock = ?, stock_quantity = ?, allow_backorder = ?, low_stock_threshold = ?,
      is_digital = ?,
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
    track_stock !== undefined ? (track_stock ? 1 : 0) : existing.track_stock,
    stock_quantity !== undefined ? (parseInt(stock_quantity) || 0) : existing.stock_quantity,
    allow_backorder !== undefined ? (allow_backorder ? 1 : 0) : existing.allow_backorder,
    low_stock_threshold !== undefined ? (parseInt(low_stock_threshold) || 5) : existing.low_stock_threshold,
    is_digital !== undefined ? (is_digital ? 1 : 0) : existing.is_digital,
    existing.id
  )

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id)
  logActivity(req.user?.id, req.user?.name, 'updated product', 'product', updated.id, updated.name)

  // Fire low-stock / out-of-stock alert (async, non-blocking)
  if (updated.track_stock) {
    const prevQty = existing.stock_quantity ?? 0
    const newQty  = updated.stock_quantity ?? 0
    const thresh  = updated.low_stock_threshold ?? 5
    const siteSettings = db.prepare(`SELECT value FROM settings WHERE key = 'site_url'`).get()
    const adminUrl = `${siteSettings?.value || 'http://localhost:5173'}/products/${updated.id}`

    const wasOutOfStock = prevQty <= 0
    const isOutOfStock  = newQty <= 0 && !updated.allow_backorder
    const wasLow = prevQty > 0 && prevQty <= thresh
    const isLow  = newQty > 0 && newQty <= thresh

    // Alert on out-of-stock transition (new)
    if (isOutOfStock && !wasOutOfStock) {
      notifyLowStock({ productName: updated.name, slug: updated.slug, stockQuantity: newQty, threshold: thresh, isOutOfStock: true, adminUrl }).catch(() => {})
    }
    // Alert on low-stock transition (new)
    else if (isLow && !wasLow && !wasOutOfStock) {
      notifyLowStock({ productName: updated.name, slug: updated.slug, stockQuantity: newQty, threshold: thresh, isOutOfStock: false, adminUrl }).catch(() => {})
    }
  }

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

// GET /api/products/inventory — low-stock + out-of-stock report
router.get('/inventory', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, slug, sku, price, sale_price, stock_quantity,
           low_stock_threshold, allow_backorder, status
    FROM products
    WHERE track_stock = 1
    ORDER BY stock_quantity ASC
  `).all()

  const outOfStock = rows.filter(p => p.stock_quantity <= 0 && !p.allow_backorder)
  const lowStock   = rows.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold)
  const healthy    = rows.filter(p => p.stock_quantity > p.low_stock_threshold)

  res.json({ items: rows, outOfStock, lowStock, healthy })
})

// POST /api/products/bulk — bulk action on multiple products
router.post('/bulk', authMiddleware, (req, res) => {
  const { ids, action } = req.body
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' })
  if (!['publish', 'unpublish', 'delete'].includes(action)) return res.status(400).json({ error: 'Invalid action' })

  const now = new Date().toISOString()
  let affected = 0

  const doInTransaction = db.transaction(() => {
    for (const id of ids) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
      if (!product) continue
      if (action === 'delete') {
        db.prepare('DELETE FROM products WHERE id = ?').run(id)
        logActivity(req.user?.id, req.user?.name, 'deleted product', 'product', product.id, product.name)
      } else {
        const newStatus = action === 'publish' ? 'published' : 'draft'
        db.prepare(`UPDATE products SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, now, id)
        logActivity(req.user?.id, req.user?.name, `${action}ed product`, 'product', product.id, product.name)
      }
      affected++
    }
  })
  doInTransaction()
  res.json({ affected })
})

// ─── CSV Export ──────────────────────────────────────────────────────────────
// GET /api/products/export/csv
router.get('/export/csv', authMiddleware, (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all()

  const escape = v => {
    if (v == null) return ''
    const s = String(v)
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s
  }

  const headers = [
    'id','name','slug','excerpt','price','sale_price','sku',
    'status','featured','track_stock','stock_quantity','low_stock_threshold',
    'allow_backorders','weight','cover_image','gallery_images',
    'meta_title','meta_desc','tags','created_at'
  ]

  const rows = products.map(p => headers.map(h => escape(p[h])).join(','))
  const csv = [headers.join(','), ...rows].join('\n')

  const date = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="products-${date}.csv"`)
  res.send(csv)
})

// ─── CSV Import ──────────────────────────────────────────────────────────────
// POST /api/products/import/csv
// Accepts multipart form with a `file` field containing a CSV.
// Required columns: name, price
// Optional: slug, excerpt, sku, status, featured, sale_price, meta_title, meta_desc, tags, cover_image
router.post('/import/csv', authMiddleware, csvUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' })

  const mode = req.body.mode || 'merge' // merge | replace

  let text
  try {
    text = req.file.buffer.toString('utf-8')
  } catch {
    return res.status(400).json({ error: 'Could not read file as UTF-8 text' })
  }

  // Parse CSV manually (handles quoted fields with commas/newlines)
  function parseCSV(raw) {
    const lines = []
    let cur = '', inQ = false, row = []
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]
      if (ch === '"') {
        if (inQ && raw[i + 1] === '"') { cur += '"'; i++ }
        else { inQ = !inQ }
      } else if (ch === ',' && !inQ) {
        row.push(cur); cur = ''
      } else if ((ch === '\n' || ch === '\r') && !inQ) {
        if (ch === '\r' && raw[i + 1] === '\n') i++
        row.push(cur); cur = ''
        if (row.some(v => v !== '')) lines.push(row)
        row = []
      } else {
        cur += ch
      }
    }
    if (cur || row.length) { row.push(cur); if (row.some(v => v !== '')) lines.push(row) }
    return lines
  }

  const rows = parseCSV(text)
  if (rows.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' })

  const headers = rows[0].map(h => h.trim().toLowerCase())
  const get = (row, col) => {
    const idx = headers.indexOf(col)
    return idx >= 0 ? (row[idx] || '').trim() : ''
  }

  const report = { created: 0, updated: 0, skipped: 0, errors: [] }

  if (mode === 'replace') {
    db.prepare('DELETE FROM products').run()
  }

  const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    try {
      const name = get(row, 'name')
      if (!name) { report.skipped++; continue }

      const price = parseFloat(get(row, 'price')) || 0
      const salePrice = parseFloat(get(row, 'sale_price')) || null
      const slug = get(row, 'slug') || slugify(name)
      const status = ['published', 'draft'].includes(get(row, 'status')) ? get(row, 'status') : 'draft'
      const featured = get(row, 'featured') === '1' || get(row, 'featured') === 'true' ? 1 : 0
      const trackStock = get(row, 'track_stock') === '1' || get(row, 'track_stock') === 'true' ? 1 : 0
      const stockQty = parseInt(get(row, 'stock_quantity')) || 0
      const lowThreshold = parseInt(get(row, 'low_stock_threshold')) || 5
      const allowBackorders = get(row, 'allow_backorders') === '1' ? 1 : 0
      const weight = parseFloat(get(row, 'weight')) || null
      const sku = get(row, 'sku') || null
      const excerpt = get(row, 'excerpt') || null
      const coverImage = get(row, 'cover_image') || null
      const galleryImages = get(row, 'gallery_images') || '[]'
      const metaTitle = get(row, 'meta_title') || null
      const metaDesc = get(row, 'meta_desc') || null
      const tags = get(row, 'tags') || null

      // Check if product with this slug already exists
      const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)
      if (existing) {
        db.prepare(`
          UPDATE products SET
            name = ?, excerpt = ?, price = ?, sale_price = ?, sku = ?,
            status = ?, featured = ?, track_stock = ?, stock_quantity = ?,
            low_stock_threshold = ?, allow_backorders = ?, weight = ?,
            cover_image = ?, gallery_images = ?, meta_title = ?, meta_desc = ?,
            tags = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          name, excerpt, price, salePrice, sku, status, featured,
          trackStock, stockQty, lowThreshold, allowBackorders, weight,
          coverImage, galleryImages, metaTitle, metaDesc, tags, existing.id
        )
        report.updated++
      } else {
        db.prepare(`
          INSERT INTO products
            (name, slug, excerpt, price, sale_price, sku, status, featured,
             track_stock, stock_quantity, low_stock_threshold, allow_backorders,
             weight, cover_image, gallery_images, meta_title, meta_desc, tags)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          name, slug, excerpt, price, salePrice, sku, status, featured,
          trackStock, stockQty, lowThreshold, allowBackorders, weight,
          coverImage, galleryImages, metaTitle, metaDesc, tags
        )
        report.created++
      }
    } catch (e) {
      report.errors.push(`Row ${i + 1}: ${e.message}`)
    }
  }

  logActivity(req.user, 'import_csv', 'product', null, `Imported ${report.created} new, ${report.updated} updated`)
  res.json({ ok: true, mode, report })
})

export default router

// ─── Duplicate product ────────────────────────────────────────────────────────
// POST /api/products/:id/duplicate
router.post('/:id/duplicate', authMiddleware, (req, res) => {
  const orig = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!orig) return res.status(404).json({ error: 'Product not found' })

  const baseSlug = orig.slug + '-copy'
  let slug = baseSlug, n = 1
  while (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) {
    slug = `${baseSlug}-${n++}`
  }

  const result = db.prepare(`
    INSERT INTO products (title, slug, excerpt, content, cover_image, gallery,
      price, sale_price, sku, category_id, tags,
      status, featured, meta_title, meta_desc,
      track_stock, stock, allow_backorders, low_stock_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orig.title + ' (Copy)',
    slug,
    orig.excerpt || '',
    orig.content || '',
    orig.cover_image || '',
    orig.gallery || '[]',
    orig.price || 0,
    orig.sale_price || null,
    orig.sku ? orig.sku + '-copy' : '',
    orig.category_id || null,
    orig.tags || '[]',
    orig.featured || 0,
    orig.meta_title || '',
    orig.meta_desc || '',
    orig.track_stock || 0,
    orig.stock || 0,
    orig.allow_backorders || 0,
    orig.low_stock_threshold || 5,
  )

  const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(newProduct)
})
