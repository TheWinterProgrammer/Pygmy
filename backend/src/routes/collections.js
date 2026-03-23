// Pygmy CMS — Product Collections (Phase 39)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// GET /api/collections
router.get('/', (req, res) => {
  const isAdmin = req.headers.authorization?.startsWith('Bearer ')
  const filter  = isAdmin ? '' : 'WHERE c.active = 1'
  const rows = db.prepare(`
    SELECT c.*,
           COUNT(cp.product_id) AS product_count
    FROM collections c
    LEFT JOIN collection_products cp ON cp.collection_id = c.id
    ${filter}
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all()
  res.json(rows)
})

// GET /api/collections/:slug — public, returns products
router.get('/:slug', (req, res) => {
  const col = db.prepare(`SELECT * FROM collections WHERE slug = ?`).get(req.params.slug)
  if (!col) return res.status(404).json({ error: 'Collection not found' })
  const products = db.prepare(`
    SELECT p.*, cp.sort_order AS col_sort
    FROM products p
    JOIN collection_products cp ON cp.product_id = p.id
    WHERE cp.collection_id = ? AND p.status = 'published'
    ORDER BY cp.sort_order ASC, p.name ASC
  `).all(col.id)
  res.json({ ...col, products })
})

// POST /api/collections
router.post('/', auth, (req, res) => {
  const { name, slug, description, cover_image, sort_order, active, seo_title, seo_desc } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' })
  const info = db.prepare(`
    INSERT INTO collections (name, slug, description, cover_image, sort_order, active, seo_title, seo_desc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, slug, description || '', cover_image || '', sort_order || 0, active !== false ? 1 : 0, seo_title || '', seo_desc || '')
  res.json({ id: info.lastInsertRowid, ...req.body })
})

// PUT /api/collections/:id
router.put('/:id', auth, (req, res) => {
  const { name, slug, description, cover_image, sort_order, active, seo_title, seo_desc } = req.body
  db.prepare(`
    UPDATE collections SET name=?, slug=?, description=?, cover_image=?, sort_order=?, active=?, seo_title=?, seo_desc=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, slug, description || '', cover_image || '', sort_order || 0, active !== false ? 1 : 0, seo_title || '', seo_desc || '', req.params.id)
  res.json({ ok: true })
})

// DELETE /api/collections/:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM collections WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// GET /api/collections/:id/products — admin product list by numeric id
router.get('/:id/products', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.slug, p.cover_image, p.price, p.status, cp.sort_order
    FROM products p
    JOIN collection_products cp ON cp.product_id = p.id
    WHERE cp.collection_id = ?
    ORDER BY cp.sort_order ASC
  `).all(req.params.id)
  res.json(rows)
})

// PUT /api/collections/:id/products — replace product list
router.put('/:id/products', auth, (req, res) => {
  const { product_ids } = req.body
  db.prepare('DELETE FROM collection_products WHERE collection_id=?').run(req.params.id)
  const stmt = db.prepare('INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)')
  ;(product_ids || []).forEach((pid, idx) => stmt.run(req.params.id, pid, idx))
  res.json({ ok: true })
})

export default router
