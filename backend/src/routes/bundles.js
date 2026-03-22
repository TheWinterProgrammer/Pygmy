// Pygmy CMS — Product Bundles API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function bundleWithItems(bundle) {
  if (!bundle) return null
  const items = db.prepare(`
    SELECT bi.*, p.name, p.slug, p.price, p.sale_price, p.cover_image, p.status
    FROM bundle_items bi
    JOIN products p ON bi.product_id = p.id
    WHERE bi.bundle_id = ?
    ORDER BY bi.id ASC
  `).all(bundle.id)

  // Compute bundle price
  let originalTotal = 0
  for (const item of items) {
    const price = item.sale_price && item.sale_price > 0 ? item.sale_price : item.price
    originalTotal += price * item.quantity
  }
  let bundlePrice = originalTotal
  if (bundle.discount_type === 'percent') {
    bundlePrice = originalTotal * (1 - bundle.discount_value / 100)
  } else if (bundle.discount_type === 'fixed') {
    bundlePrice = Math.max(0, originalTotal - bundle.discount_value)
  }

  return {
    ...bundle,
    items,
    original_total: Math.round(originalTotal * 100) / 100,
    bundle_price: Math.round(bundlePrice * 100) / 100,
    savings: Math.round((originalTotal - bundlePrice) * 100) / 100,
  }
}

// ── GET /api/bundles ─ List bundles ──────────────────────────────────────────
router.get('/', (req, res) => {
  const { all } = req.query
  const cond = (!all || !req.headers.authorization) ? "WHERE b.status = 'published'" : ''
  const bundles = db.prepare(`SELECT * FROM product_bundles b ${cond} ORDER BY b.created_at DESC`).all()
  res.json(bundles.map(bundleWithItems))
})

// ── GET /api/bundles/id/:id ─ Single bundle by ID (admin) ────────────────────
router.get('/id/:id', authMiddleware, (req, res) => {
  const bundle = db.prepare('SELECT * FROM product_bundles WHERE id = ?').get(req.params.id)
  if (!bundle) return res.status(404).json({ error: 'Bundle not found' })
  res.json(bundleWithItems(bundle))
})

// ── GET /api/bundles/:slug ─ Single bundle ───────────────────────────────────
router.get('/:slug', (req, res) => {
  const bundle = db.prepare('SELECT * FROM product_bundles WHERE slug = ?').get(req.params.slug)
  if (!bundle) return res.status(404).json({ error: 'Bundle not found' })
  const withItems = bundleWithItems(bundle)
  if (bundle.status !== 'published' && !req.headers.authorization) {
    return res.status(404).json({ error: 'Bundle not found' })
  }
  res.json(withItems)
})

// ── POST /api/bundles ─ Create bundle (admin) ────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const {
    name,
    slug,
    description = '',
    discount_type = 'percent',
    discount_value = 0,
    cover_image = '',
    status = 'draft',
    items = [],
  } = req.body

  if (!name) return res.status(400).json({ error: 'name is required' })
  if (items.length < 2) return res.status(400).json({ error: 'A bundle must contain at least 2 products' })

  const finalSlug = slug ? slugify(slug) : slugify(name)

  if (db.prepare('SELECT id FROM product_bundles WHERE slug = ?').get(finalSlug)) {
    return res.status(409).json({ error: 'Slug already exists' })
  }

  const info = db.prepare(`
    INSERT INTO product_bundles (name, slug, description, discount_type, discount_value, cover_image, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, finalSlug, description, discount_type, Number(discount_value), cover_image, status)

  const bundleId = info.lastInsertRowid
  const insertItem = db.prepare('INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES (?, ?, ?)')
  const insertMany = db.transaction(() => {
    for (const item of items) {
      if (item.product_id && item.quantity > 0) {
        insertItem.run(bundleId, item.product_id, item.quantity)
      }
    }
  })
  insertMany()

  logActivity(req.user?.id, req.user?.name, 'create', 'bundle', bundleId, name)
  res.status(201).json({ id: bundleId, slug: finalSlug })
})

// ── PUT /api/bundles/:id ─ Update bundle (admin) ─────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const bundle = db.prepare('SELECT * FROM product_bundles WHERE id = ?').get(req.params.id)
  if (!bundle) return res.status(404).json({ error: 'Bundle not found' })

  const {
    name, slug, description, discount_type, discount_value, cover_image, status, items,
  } = req.body

  let newSlug = bundle.slug
  if (slug && slugify(slug) !== bundle.slug) {
    newSlug = slugify(slug)
    if (db.prepare('SELECT id FROM product_bundles WHERE slug = ? AND id != ?').get(newSlug, bundle.id)) {
      return res.status(409).json({ error: 'Slug already taken' })
    }
  } else if (name && !slug) {
    // Don't auto-reslug on name change
  }

  db.prepare(`
    UPDATE product_bundles SET
      name           = COALESCE(?, name),
      slug           = ?,
      description    = COALESCE(?, description),
      discount_type  = COALESCE(?, discount_type),
      discount_value = COALESCE(?, discount_value),
      cover_image    = COALESCE(?, cover_image),
      status         = COALESCE(?, status),
      updated_at     = datetime('now')
    WHERE id = ?
  `).run(
    name ?? null, newSlug,
    description ?? null, discount_type ?? null,
    discount_value !== undefined ? Number(discount_value) : null,
    cover_image ?? null, status ?? null, bundle.id,
  )

  // Replace items if provided
  if (Array.isArray(items)) {
    db.prepare('DELETE FROM bundle_items WHERE bundle_id = ?').run(bundle.id)
    const insertItem = db.prepare('INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES (?, ?, ?)')
    const insertMany = db.transaction(() => {
      for (const item of items) {
        if (item.product_id && item.quantity > 0) {
          insertItem.run(bundle.id, item.product_id, item.quantity)
        }
      }
    })
    insertMany()
  }

  logActivity(req.user?.id, req.user?.name, 'update', 'bundle', bundle.id, name || bundle.name)
  res.json({ ok: true })
})

// ── DELETE /api/bundles/:id ─ Delete bundle (admin) ──────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const bundle = db.prepare('SELECT * FROM product_bundles WHERE id = ?').get(req.params.id)
  if (!bundle) return res.status(404).json({ error: 'Bundle not found' })
  db.prepare('DELETE FROM product_bundles WHERE id = ?').run(bundle.id)
  logActivity(req.user?.id, req.user?.name, 'delete', 'bundle', bundle.id, bundle.name)
  res.json({ ok: true })
})

export default router
