// Pygmy CMS — Supplier Management + Purchase Orders (Phase 39)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ── All Purchase Orders ───────────────────────────────────────────────────────
router.get('/purchase-orders/all', auth, (req, res) => {
  const { status, q } = req.query
  let sql = `
    SELECT po.*, s.name AS supplier_name
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    WHERE 1=1
  `
  const params = []
  if (status) { sql += ` AND po.status = ?`; params.push(status) }
  if (q)      { sql += ` AND (po.po_number LIKE ? OR s.name LIKE ?)`; params.push(`%${q}%`, `%${q}%`) }
  sql += ` ORDER BY po.created_at DESC LIMIT 100`
  res.json(db.prepare(sql).all(...params))
})

router.put('/purchase-orders/:id', auth, (req, res) => {
  const { status, items, total_cost, notes, expected_at, received_at } = req.body
  db.prepare(`
    UPDATE purchase_orders SET status=?, items=?, total_cost=?, notes=?, expected_at=?, received_at=?, updated_at=datetime('now')
    WHERE id=?
  `).run(status, JSON.stringify(items || []), total_cost || 0, notes || '', expected_at || null, received_at || null, req.params.id)

  if (status === 'received' && items?.length) {
    const updateStmt = db.prepare(`UPDATE products SET stock_quantity = stock_quantity + ? WHERE id=?`)
    for (const item of items) {
      if (item.product_id && item.qty) updateStmt.run(item.qty, item.product_id)
    }
  }
  res.json({ ok: true })
})

router.delete('/purchase-orders/:id', auth, (req, res) => {
  db.prepare('DELETE FROM purchase_orders WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ── Suppliers ─────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const q = req.query.q || ''
  const rows = db.prepare(`
    SELECT s.*,
           COUNT(DISTINCT p.id) AS product_count,
           COUNT(DISTINCT po.id) AS po_count
    FROM suppliers s
    LEFT JOIN products p ON p.supplier_id = s.id
    LEFT JOIN purchase_orders po ON po.supplier_id = s.id
    WHERE s.name LIKE ?
    GROUP BY s.id
    ORDER BY s.name ASC
  `).all(`%${q}%`)
  res.json(rows)
})

router.get('/:id', auth, (req, res) => {
  const s = db.prepare(`SELECT * FROM suppliers WHERE id=?`).get(req.params.id)
  if (!s) return res.status(404).json({ error: 'Supplier not found' })
  const products   = db.prepare(`SELECT id, name, slug, sku, price, stock_quantity FROM products WHERE supplier_id=?`).all(req.params.id)
  const recent_pos = db.prepare(`SELECT * FROM purchase_orders WHERE supplier_id=? ORDER BY created_at DESC LIMIT 10`).all(req.params.id)
  res.json({ ...s, products, recent_pos })
})

router.post('/', auth, (req, res) => {
  const { name, contact_name, email, phone, website, address, notes, active } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const info = db.prepare(`
    INSERT INTO suppliers (name, contact_name, email, phone, website, address, notes, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, contact_name || '', email || '', phone || '', website || '', address || '', notes || '', active !== false ? 1 : 0)
  res.json({ id: info.lastInsertRowid })
})

router.put('/:id', auth, (req, res) => {
  const { name, contact_name, email, phone, website, address, notes, active } = req.body
  db.prepare(`
    UPDATE suppliers SET name=?, contact_name=?, email=?, phone=?, website=?, address=?, notes=?, active=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, contact_name || '', email || '', phone || '', website || '', address || '', notes || '', active !== false ? 1 : 0, req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', auth, (req, res) => {
  db.prepare('UPDATE products SET supplier_id=NULL WHERE supplier_id=?').run(req.params.id)
  db.prepare('DELETE FROM suppliers WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// ── Purchase Orders per supplier ──────────────────────────────────────────────
router.get('/:supplier_id/purchase-orders', auth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM purchase_orders WHERE supplier_id=? ORDER BY created_at DESC`).all(req.params.supplier_id)
  res.json(rows)
})

router.post('/:supplier_id/purchase-orders', auth, (req, res) => {
  const { items, total_cost, notes, expected_at } = req.body
  const count = db.prepare(`SELECT COUNT(*) AS c FROM purchase_orders`).get().c
  const poNum = `PO-${new Date().getFullYear()}${String(count + 1).padStart(4, '0')}`
  const info = db.prepare(`
    INSERT INTO purchase_orders (supplier_id, po_number, status, items, total_cost, notes, expected_at)
    VALUES (?, ?, 'draft', ?, ?, ?, ?)
  `).run(req.params.supplier_id, poNum, JSON.stringify(items || []), total_cost || 0, notes || '', expected_at || null)
  res.json({ id: info.lastInsertRowid, po_number: poNum })
})

export default router
