// Pygmy CMS — Product Specifications/Attributes
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/product-specs?product_id=
router.get('/', (req, res) => {
  const { product_id } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  const specs = db.prepare(`
    SELECT * FROM product_specs WHERE product_id = ? ORDER BY group_name, sort_order, id
  `).all(product_id)

  // Group by group_name
  const grouped = {}
  for (const spec of specs) {
    if (!grouped[spec.group_name]) grouped[spec.group_name] = []
    grouped[spec.group_name].push(spec)
  }

  res.json({ specs, grouped })
})

// POST /api/product-specs — create a spec
router.post('/', authMiddleware, (req, res) => {
  const { product_id, label, value, sort_order = 0, group_name = 'General' } = req.body
  if (!product_id || !label || !value) return res.status(400).json({ error: 'product_id, label, value required' })

  const r = db.prepare(`
    INSERT INTO product_specs (product_id, label, value, sort_order, group_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(product_id, label.trim(), value.trim(), sort_order, group_name.trim() || 'General')

  res.json(db.prepare('SELECT * FROM product_specs WHERE id = ?').get(r.lastInsertRowid))
})

// PUT /api/product-specs/:id
router.put('/:id', authMiddleware, (req, res) => {
  const { label, value, sort_order, group_name } = req.body
  const existing = db.prepare('SELECT * FROM product_specs WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  db.prepare(`
    UPDATE product_specs SET
      label = ?, value = ?, sort_order = ?, group_name = ?
    WHERE id = ?
  `).run(
    label ?? existing.label,
    value ?? existing.value,
    sort_order ?? existing.sort_order,
    group_name ?? existing.group_name,
    req.params.id
  )

  res.json(db.prepare('SELECT * FROM product_specs WHERE id = ?').get(req.params.id))
})

// DELETE /api/product-specs/:id
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM product_specs WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/product-specs/bulk — replace all specs for a product
router.post('/bulk', authMiddleware, (req, res) => {
  const { product_id, specs } = req.body
  if (!product_id || !Array.isArray(specs)) return res.status(400).json({ error: 'product_id and specs[] required' })

  const save = db.transaction(() => {
    db.prepare('DELETE FROM product_specs WHERE product_id = ?').run(product_id)
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i]
      if (!s.label || !s.value) continue
      db.prepare(`
        INSERT INTO product_specs (product_id, label, value, sort_order, group_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(product_id, s.label.trim(), s.value.trim(), i, s.group_name || 'General')
    }
  })
  save()

  const saved = db.prepare('SELECT * FROM product_specs WHERE product_id = ? ORDER BY group_name, sort_order').all(product_id)
  res.json({ ok: true, specs: saved })
})

export default router
