// product_options.js — Product Customization Options (Phase 40)
import { Router } from 'express'
import db from '../db.js'
import auth from '../middleware/auth.js'

const r = Router()

// ── Public: get options for a product ──────────────────────────────────────────
r.get('/', (req, res) => {
  const { product_id } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  const opts = db.prepare(`
    SELECT * FROM product_custom_options WHERE product_id = ? ORDER BY sort_order ASC, id ASC
  `).all(product_id)
  res.json(opts.map(o => ({ ...o, options: JSON.parse(o.options || '[]') })))
})

// ── Admin: create option ────────────────────────────────────────────────────────
r.post('/', auth, (req, res) => {
  const { product_id, field_type = 'text', label, placeholder = '', options = [], required = 0, price_add = 0, sort_order = 0 } = req.body
  if (!product_id || !label) return res.status(400).json({ error: 'product_id and label required' })

  const result = db.prepare(`
    INSERT INTO product_custom_options (product_id, field_type, label, placeholder, options, required, price_add, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(product_id, field_type, label, placeholder, JSON.stringify(options), required ? 1 : 0, price_add, sort_order)

  const opt = db.prepare('SELECT * FROM product_custom_options WHERE id = ?').get(result.lastInsertRowid)
  res.json({ ...opt, options: JSON.parse(opt.options || '[]') })
})

// ── Admin: update option ────────────────────────────────────────────────────────
r.put('/:id', auth, (req, res) => {
  const { field_type, label, placeholder, options, required, price_add, sort_order } = req.body
  const existing = db.prepare('SELECT * FROM product_custom_options WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  db.prepare(`
    UPDATE product_custom_options SET
      field_type  = COALESCE(?, field_type),
      label       = COALESCE(?, label),
      placeholder = COALESCE(?, placeholder),
      options     = COALESCE(?, options),
      required    = COALESCE(?, required),
      price_add   = COALESCE(?, price_add),
      sort_order  = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(
    field_type, label, placeholder,
    options !== undefined ? JSON.stringify(options) : null,
    required !== undefined ? (required ? 1 : 0) : null,
    price_add, sort_order, req.params.id
  )

  const updated = db.prepare('SELECT * FROM product_custom_options WHERE id = ?').get(req.params.id)
  res.json({ ...updated, options: JSON.parse(updated.options || '[]') })
})

// ── Admin: delete option ────────────────────────────────────────────────────────
r.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM product_custom_options WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Admin: reorder options ──────────────────────────────────────────────────────
r.post('/reorder', auth, (req, res) => {
  const { product_id, order } = req.body
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' })
  order.forEach((id, i) => {
    db.prepare('UPDATE product_custom_options SET sort_order = ? WHERE id = ? AND product_id = ?')
      .run(i, id, product_id)
  })
  res.json({ ok: true })
})

export default r
