// Pygmy CMS — Product Configurator (Phase 73)
// Lets admins define multi-step configurator flows for products.
// Each configurator has steps, and each step has choices (with price adjustments).

import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()

function parseConf(row) {
  if (!row) return null
  return {
    ...row,
    steps: (() => { try { return JSON.parse(row.steps || '[]') } catch { return [] } })(),
  }
}

// ─── GET /api/product-configurator — list all configurators ──────────────────
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT pc.*, p.name as product_name, p.slug as product_slug
    FROM product_configurators pc
    LEFT JOIN products p ON p.id = pc.product_id
    ORDER BY pc.created_at DESC
  `).all()
  res.json(rows.map(parseConf))
})

// ─── GET /api/product-configurator/public/:productId — public access ─────────
router.get('/public/:productId', (req, res) => {
  const row = db.prepare(`
    SELECT pc.*, p.name as product_name, p.slug as product_slug
    FROM product_configurators pc
    LEFT JOIN products p ON p.id = pc.product_id
    WHERE pc.product_id = ? AND pc.active = 1
  `).get(req.params.productId)
  if (!row) return res.status(404).json({ error: 'No configurator found' })
  res.json(parseConf(row))
})

// ─── GET /api/product-configurator/:id ───────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const row = db.prepare(`
    SELECT pc.*, p.name as product_name, p.slug as product_slug
    FROM product_configurators pc
    LEFT JOIN products p ON p.id = pc.product_id
    WHERE pc.id = ?
  `).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(parseConf(row))
})

// ─── POST /api/product-configurator — create ─────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { product_id, name, description, steps = [], active = 1 } = req.body
  if (!product_id || !name) return res.status(400).json({ error: 'product_id and name are required' })

  const result = db.prepare(`
    INSERT INTO product_configurators (product_id, name, description, steps, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(product_id, name, description || '', JSON.stringify(steps), active ? 1 : 0)

  const created = db.prepare('SELECT * FROM product_configurators WHERE id = ?').get(result.lastInsertRowid)
  logActivity(db, req.user.id, req.user.name, 'create', 'product_configurator', created.id, name)
  res.status(201).json(parseConf(created))
})

// ─── PUT /api/product-configurator/:id — update ──────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM product_configurators WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const { product_id, name, description, steps, active } = req.body

  db.prepare(`
    UPDATE product_configurators
    SET product_id = ?, name = ?, description = ?, steps = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    product_id ?? existing.product_id,
    name ?? existing.name,
    description ?? existing.description,
    steps !== undefined ? JSON.stringify(steps) : existing.steps,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  )

  const updated = db.prepare('SELECT * FROM product_configurators WHERE id = ?').get(req.params.id)
  logActivity(db, req.user.id, req.user.name, 'update', 'product_configurator', updated.id, name || existing.name)
  res.json(parseConf(updated))
})

// ─── DELETE /api/product-configurator/:id ────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM product_configurators WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM product_configurators WHERE id = ?').run(req.params.id)
  logActivity(db, req.user.id, req.user.name, 'delete', 'product_configurator', req.params.id, existing.name)
  res.json({ ok: true })
})

// ─── POST /api/product-configurator/:id/toggle — activate/deactivate ─────────
router.post('/:id/toggle', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT active FROM product_configurators WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  const newActive = row.active ? 0 : 1
  db.prepare('UPDATE product_configurators SET active = ? WHERE id = ?').run(newActive, req.params.id)
  res.json({ active: newActive })
})

export default router
