// inventory_locations.js — Multi-Location Inventory (Phase 41)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const r = Router()

// ── List locations ─────────────────────────────────────────────────────────────
r.get('/', auth, (req, res) => {
  const locations = db.prepare(`
    SELECT l.*,
      (SELECT COUNT(DISTINCT product_id) FROM inventory_stock WHERE location_id = l.id) as product_count,
      (SELECT COALESCE(SUM(quantity), 0) FROM inventory_stock WHERE location_id = l.id) as total_stock
    FROM inventory_locations l
    ORDER BY l.is_default DESC, l.name ASC
  `).all()
  res.json(locations)
})

// ── Create location ────────────────────────────────────────────────────────────
r.post('/', auth, (req, res) => {
  const { name, code, address = '', active = 1 } = req.body
  if (!name || !code) return res.status(400).json({ error: 'name and code required' })

  try {
    const result = db.prepare(`
      INSERT INTO inventory_locations (name, code, address, active)
      VALUES (?, ?, ?, ?)
    `).run(name, code.toUpperCase(), address, active ? 1 : 0)
    const loc = db.prepare('SELECT * FROM inventory_locations WHERE id = ?').get(result.lastInsertRowid)
    res.json(loc)
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Location code must be unique' : e.message })
  }
})

// ── Update location ────────────────────────────────────────────────────────────
r.put('/:id', auth, (req, res) => {
  const loc = db.prepare('SELECT * FROM inventory_locations WHERE id = ?').get(req.params.id)
  if (!loc) return res.status(404).json({ error: 'Not found' })

  const { name, code, address, active, is_default } = req.body

  // If setting as default, clear existing default
  if (is_default) {
    db.prepare('UPDATE inventory_locations SET is_default = 0').run()
  }

  try {
    db.prepare(`
      UPDATE inventory_locations SET
        name       = COALESCE(?, name),
        code       = COALESCE(?, code),
        address    = COALESCE(?, address),
        active     = COALESCE(?, active),
        is_default = COALESCE(?, is_default)
      WHERE id = ?
    `).run(name, code ? code.toUpperCase() : null, address,
           active !== undefined ? (active ? 1 : 0) : null,
           is_default !== undefined ? (is_default ? 1 : 0) : null,
           req.params.id)
    res.json(db.prepare('SELECT * FROM inventory_locations WHERE id = ?').get(req.params.id))
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Location code must be unique' : e.message })
  }
})

// ── Delete location ────────────────────────────────────────────────────────────
r.delete('/:id', auth, (req, res) => {
  const loc = db.prepare('SELECT * FROM inventory_locations WHERE id = ?').get(req.params.id)
  if (!loc) return res.status(404).json({ error: 'Not found' })
  if (loc.is_default) return res.status(400).json({ error: 'Cannot delete the default location' })

  // Move stock to default location or just remove
  db.prepare('DELETE FROM inventory_stock WHERE location_id = ?').run(req.params.id)
  db.prepare('DELETE FROM inventory_locations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Get stock for a product across all locations ───────────────────────────────
r.get('/stock/:productId', auth, (req, res) => {
  const locations = db.prepare(`
    SELECT l.id, l.name, l.code, l.active, l.is_default,
           COALESCE(s.quantity, 0) as quantity,
           COALESCE(s.reserved, 0) as reserved,
           COALESCE(s.low_threshold, 5) as low_threshold
    FROM inventory_locations l
    LEFT JOIN inventory_stock s ON s.location_id = l.id AND s.product_id = ?
    WHERE l.active = 1
    ORDER BY l.is_default DESC, l.name ASC
  `).all(req.params.productId)
  res.json(locations)
})

// ── Update stock at a specific location ───────────────────────────────────────
r.put('/stock/:productId', auth, (req, res) => {
  const { location_id, quantity, reserved, low_threshold } = req.body
  if (!location_id || quantity === undefined) return res.status(400).json({ error: 'location_id and quantity required' })

  db.prepare(`
    INSERT INTO inventory_stock (product_id, location_id, quantity, reserved, low_threshold)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(product_id, location_id) DO UPDATE SET
      quantity = excluded.quantity,
      reserved = COALESCE(excluded.reserved, reserved),
      low_threshold = COALESCE(excluded.low_threshold, low_threshold),
      updated_at = datetime('now')
  `).run(
    req.params.productId,
    location_id,
    Number(quantity),
    reserved !== undefined ? Number(reserved) : 0,
    low_threshold !== undefined ? Number(low_threshold) : 5
  )

  // Also update main products.stock_quantity to be the sum across all locations
  const settings = db.prepare("SELECT value FROM settings WHERE key = 'multi_location_enabled'").get()
  if (settings?.value === '1') {
    const total = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_stock WHERE product_id = ?
    `).get(req.params.productId).total
    db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(total, req.params.productId)
  }

  res.json({ ok: true })
})

// ── Batch stock for all products at a location ────────────────────────────────
r.get('/stock', auth, (req, res) => {
  const { location_id } = req.query
  if (!location_id) return res.status(400).json({ error: 'location_id required' })

  const rows = db.prepare(`
    SELECT p.id, p.name, p.sku, p.cover_image, p.status,
           COALESCE(s.quantity, 0) as quantity,
           COALESCE(s.reserved, 0) as reserved,
           COALESCE(s.low_threshold, 5) as low_threshold
    FROM products p
    LEFT JOIN inventory_stock s ON s.product_id = p.id AND s.location_id = ?
    WHERE p.status = 'published'
    ORDER BY p.name ASC
  `).all(location_id)
  res.json(rows)
})

// ── Summary stats ──────────────────────────────────────────────────────────────
r.get('/summary', auth, (req, res) => {
  const locations = db.prepare(`SELECT COUNT(*) as total, SUM(active) as active FROM inventory_locations`).get()
  const stock = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total_stock, COALESCE(SUM(reserved), 0) as total_reserved FROM inventory_stock`).get()
  const lowStock = db.prepare(`SELECT COUNT(*) as n FROM inventory_stock WHERE quantity <= low_threshold AND quantity > 0`).get().n
  const outOfStock = db.prepare(`SELECT COUNT(*) as n FROM inventory_stock WHERE quantity <= 0`).get().n
  res.json({ ...locations, ...stock, low_stock: lowStock, out_of_stock: outOfStock })
})

export default r
