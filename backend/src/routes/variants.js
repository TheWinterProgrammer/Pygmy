// Pygmy CMS — Product Variants API
// GET    /api/variants?product_id=   → list variants for a product
// POST   /api/variants               → create variant group (auth)
// PUT    /api/variants/:id           → update variant group (auth)
// DELETE /api/variants/:id           → delete variant group (auth)
// PUT    /api/variants/options/:id   → update a single option (auth)
// DELETE /api/variants/options/:id   → delete a single option (auth)

import express from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseVariant(row, options) {
  return {
    id:         row.id,
    product_id: row.product_id,
    name:       row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    options:    options || [],
  }
}

function getVariantsForProduct(productId) {
  const variants = db.prepare(`
    SELECT * FROM product_variants WHERE product_id = ? ORDER BY id
  `).all(productId)

  return variants.map(v => {
    const opts = db.prepare(`
      SELECT * FROM product_variant_options WHERE variant_id = ? ORDER BY sort_order, id
    `).all(v.id)
    return parseVariant(v, opts)
  })
}

// ─── GET /api/variants?product_id= ────────────────────────────────────────────
router.get('/', (req, res) => {
  const { product_id } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  res.json(getVariantsForProduct(Number(product_id)))
})

// ─── POST /api/variants ─────────────────────────────────────────────────────
// Body: { product_id, name, options: [{ label, price_adj, sku_suffix, stock }] }
router.post('/', authMiddleware, (req, res) => {
  const { product_id, name, options = [] } = req.body
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  if (!name?.trim()) return res.status(400).json({ error: 'name required' })

  const variantInfo = db.prepare(`
    INSERT INTO product_variants (product_id, name) VALUES (?,?)
  `).run(Number(product_id), name.trim())

  const variantId = variantInfo.lastInsertRowid

  const insertOpt = db.prepare(`
    INSERT INTO product_variant_options (variant_id, label, price_adj, sku_suffix, stock, sort_order)
    VALUES (?,?,?,?,?,?)
  `)

  options.forEach((opt, i) => {
    insertOpt.run(
      variantId,
      opt.label?.trim() || '',
      Number(opt.price_adj) || 0,
      opt.sku_suffix?.trim() || '',
      opt.stock !== undefined ? Number(opt.stock) : -1,
      i,
    )
  })

  const created = getVariantsForProduct(Number(product_id))
  const variant  = created.find(v => v.id === variantId)
  res.status(201).json(variant)
})

// ─── PUT /api/variants/:id ──────────────────────────────────────────────────
// Full replace: name + options array
router.put('/:id', authMiddleware, (req, res) => {
  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.id)
  if (!variant) return res.status(404).json({ error: 'Variant not found' })

  const { name, options = [] } = req.body

  db.prepare(`
    UPDATE product_variants SET name = ?, updated_at = datetime('now') WHERE id = ?
  `).run(name?.trim() || variant.name, variant.id)

  // Delete old options + re-insert
  db.prepare('DELETE FROM product_variant_options WHERE variant_id = ?').run(variant.id)

  const insertOpt = db.prepare(`
    INSERT INTO product_variant_options (variant_id, label, price_adj, sku_suffix, stock, sort_order)
    VALUES (?,?,?,?,?,?)
  `)
  options.forEach((opt, i) => {
    insertOpt.run(
      variant.id,
      opt.label?.trim() || '',
      Number(opt.price_adj) || 0,
      opt.sku_suffix?.trim() || '',
      opt.stock !== undefined ? Number(opt.stock) : -1,
      i,
    )
  })

  const opts = db.prepare(`
    SELECT * FROM product_variant_options WHERE variant_id = ? ORDER BY sort_order, id
  `).all(variant.id)
  const updated = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variant.id)
  res.json(parseVariant(updated, opts))
})

// ─── DELETE /api/variants/:id ───────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.id)
  if (!variant) return res.status(404).json({ error: 'Variant not found' })
  db.prepare('DELETE FROM product_variants WHERE id = ?').run(variant.id)
  res.json({ success: true })
})

export default router
