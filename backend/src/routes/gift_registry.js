// Pygmy CMS — Gift Registry API (Phase 50)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify (str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function genSlug (title) {
  const base = slugify(title)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${base}-${rand}`
}

function expandRegistry (reg) {
  if (!reg) return null
  const items = db.prepare(`
    SELECT ri.*, p.name, p.slug as product_slug, p.price, p.sale_price,
           p.cover_image, p.status
    FROM gift_registry_items ri
    JOIN products p ON p.id = ri.product_id
    WHERE ri.registry_id = ?
    ORDER BY ri.added_at ASC
  `).all(reg.id)

  // Attach purchase list per item
  for (const item of items) {
    item.purchases = db.prepare(`
      SELECT giver_name, giver_email, quantity, message, purchased_at
      FROM gift_registry_purchases
      WHERE item_id = ?
      ORDER BY purchased_at DESC
    `).all(item.id)
    item.purchased_qty = item.purchases.reduce((s, p) => s + p.quantity, 0)
    item.remaining = Math.max(0, item.quantity - item.purchased_qty)
  }

  const customer = reg.customer_id
    ? db.prepare(`SELECT id, first_name, last_name, email FROM customers WHERE id = ?`).get(reg.customer_id)
    : null

  return { ...reg, items, customer }
}

// ─── PUBLIC: get by slug ───────────────────────────────────────────────────────

router.get('/public/:slug', (req, res) => {
  const reg = db.prepare(`SELECT * FROM gift_registries WHERE slug = ? AND is_public = 1 AND status = 'active'`).get(req.params.slug)
  if (!reg) return res.status(404).json({ error: 'Registry not found' })
  res.json(expandRegistry(reg))
})

// ─── PUBLIC: search registries ─────────────────────────────────────────────────

router.get('/search', (req, res) => {
  const q = `%${req.query.q || ''}%`
  const rows = db.prepare(`
    SELECT id, title, slug, event_type, event_date, description, status,
           (SELECT COUNT(*) FROM gift_registry_items WHERE registry_id = gift_registries.id) as item_count
    FROM gift_registries
    WHERE is_public = 1 AND status = 'active' AND title LIKE ?
    ORDER BY event_date ASC NULLS LAST
    LIMIT 20
  `).all(q)
  res.json(rows)
})

// ─── PUBLIC: record a gift purchase ────────────────────────────────────────────

router.post('/purchase', (req, res) => {
  const { registry_id, item_id, giver_name, giver_email, quantity = 1, message, order_id } = req.body
  if (!registry_id || !item_id) return res.status(400).json({ error: 'registry_id and item_id required' })

  const item = db.prepare(`SELECT * FROM gift_registry_items WHERE id = ? AND registry_id = ?`).get(item_id, registry_id)
  if (!item) return res.status(404).json({ error: 'Item not found in registry' })

  // Check remaining
  const already = db.prepare(`SELECT COALESCE(SUM(quantity),0) as total FROM gift_registry_purchases WHERE item_id = ?`).get(item_id).total
  const remaining = item.quantity - already
  if (quantity > remaining) return res.status(400).json({ error: `Only ${remaining} remaining on this item` })

  const info = db.prepare(`
    INSERT INTO gift_registry_purchases (registry_id, item_id, giver_name, giver_email, quantity, message, order_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(registry_id, item_id, giver_name || 'Anonymous', giver_email || '', quantity, message || '', order_id || null)

  // Update purchased count on item
  db.prepare(`UPDATE gift_registry_items SET purchased = (
    SELECT COALESCE(SUM(quantity),0) FROM gift_registry_purchases WHERE item_id = ?
  ) WHERE id = ?`).run(item_id, item_id)

  res.json({ ok: true, id: info.lastInsertRowid })
})

// ─── CUSTOMER: list own registries ─────────────────────────────────────────────

router.get('/me', customerAuthMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM gift_registry_items WHERE registry_id = r.id) as item_count,
      (SELECT COUNT(*) FROM gift_registry_purchases WHERE registry_id = r.id) as purchase_count
    FROM gift_registries r
    WHERE customer_id = ?
    ORDER BY r.created_at DESC
  `).all(req.customer.id)
  res.json(rows)
})

router.get('/me/:id', customerAuthMiddleware, (req, res) => {
  const reg = db.prepare(`SELECT * FROM gift_registries WHERE id = ? AND customer_id = ?`).get(req.params.id, req.customer.id)
  if (!reg) return res.status(404).json({ error: 'Registry not found' })
  res.json(expandRegistry(reg))
})

router.post('/me', customerAuthMiddleware, (req, res) => {
  const { title = 'My Gift Registry', event_type = 'wedding', event_date, description, thank_you, is_public = 1 } = req.body
  const slug = genSlug(title)
  const info = db.prepare(`
    INSERT INTO gift_registries (title, slug, customer_id, event_type, event_date, description, thank_you, is_public)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, slug, req.customer.id, event_type, event_date || null, description || '', thank_you || '', is_public ? 1 : 0)
  res.json({ ok: true, id: info.lastInsertRowid, slug })
})

router.put('/me/:id', customerAuthMiddleware, (req, res) => {
  const { title, event_type, event_date, description, thank_you, is_public, status } = req.body
  const reg = db.prepare(`SELECT * FROM gift_registries WHERE id = ? AND customer_id = ?`).get(req.params.id, req.customer.id)
  if (!reg) return res.status(404).json({ error: 'Not found' })
  db.prepare(`
    UPDATE gift_registries SET
      title       = COALESCE(?, title),
      event_type  = COALESCE(?, event_type),
      event_date  = COALESCE(?, event_date),
      description = COALESCE(?, description),
      thank_you   = COALESCE(?, thank_you),
      is_public   = COALESCE(?, is_public),
      status      = COALESCE(?, status)
    WHERE id = ?
  `).run(title ?? null, event_type ?? null, event_date ?? null, description ?? null, thank_you ?? null, is_public !== undefined ? (is_public ? 1 : 0) : null, status ?? null, reg.id)
  res.json({ ok: true })
})

router.delete('/me/:id', customerAuthMiddleware, (req, res) => {
  const info = db.prepare(`DELETE FROM gift_registries WHERE id = ? AND customer_id = ?`).run(req.params.id, req.customer.id)
  if (!info.changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

// ─── CUSTOMER: manage items ────────────────────────────────────────────────────

router.post('/me/:id/items', customerAuthMiddleware, (req, res) => {
  const { product_id, quantity = 1, notes } = req.body
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  const reg = db.prepare(`SELECT id FROM gift_registries WHERE id = ? AND customer_id = ?`).get(req.params.id, req.customer.id)
  if (!reg) return res.status(404).json({ error: 'Registry not found' })
  const existing = db.prepare(`SELECT id FROM gift_registry_items WHERE registry_id = ? AND product_id = ?`).get(reg.id, product_id)
  if (existing) return res.status(400).json({ error: 'Product already in registry' })
  const info = db.prepare(`INSERT INTO gift_registry_items (registry_id, product_id, quantity, notes) VALUES (?, ?, ?, ?)`).run(reg.id, product_id, quantity, notes || '')
  res.json({ ok: true, id: info.lastInsertRowid })
})

router.put('/me/:id/items/:itemId', customerAuthMiddleware, (req, res) => {
  const { quantity, notes } = req.body
  const reg = db.prepare(`SELECT id FROM gift_registries WHERE id = ? AND customer_id = ?`).get(req.params.id, req.customer.id)
  if (!reg) return res.status(404).json({ error: 'Registry not found' })
  db.prepare(`UPDATE gift_registry_items SET quantity = COALESCE(?, quantity), notes = COALESCE(?, notes) WHERE id = ? AND registry_id = ?`).run(quantity ?? null, notes ?? null, req.params.itemId, reg.id)
  res.json({ ok: true })
})

router.delete('/me/:id/items/:itemId', customerAuthMiddleware, (req, res) => {
  const reg = db.prepare(`SELECT id FROM gift_registries WHERE id = ? AND customer_id = ?`).get(req.params.id, req.customer.id)
  if (!reg) return res.status(404).json({ error: 'Registry not found' })
  db.prepare(`DELETE FROM gift_registry_items WHERE id = ? AND registry_id = ?`).run(req.params.itemId, reg.id)
  res.json({ ok: true })
})

// ─── ADMIN: list all registries ────────────────────────────────────────────────

router.get('/', authMiddleware, (req, res) => {
  const { q = '', status, event_type, limit = 30, offset = 0 } = req.query
  let sql = `
    SELECT r.*,
      c.first_name, c.last_name, c.email as customer_email,
      (SELECT COUNT(*) FROM gift_registry_items WHERE registry_id = r.id) as item_count,
      (SELECT COUNT(*) FROM gift_registry_purchases WHERE registry_id = r.id) as purchase_count
    FROM gift_registries r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE 1=1
  `
  const params = []
  if (q) { sql += ` AND (r.title LIKE ? OR c.email LIKE ? OR c.first_name LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (status) { sql += ` AND r.status = ?`; params.push(status) }
  if (event_type) { sql += ` AND r.event_type = ?`; params.push(event_type) }
  sql += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
  params.push(Number(limit), Number(offset))
  const rows = db.prepare(sql).all(...params)
  const total = db.prepare(`SELECT COUNT(*) as c FROM gift_registries`).get().c
  res.json({ rows, total })
})

router.get('/:id', authMiddleware, (req, res) => {
  const reg = db.prepare(`SELECT * FROM gift_registries WHERE id = ?`).get(req.params.id)
  if (!reg) return res.status(404).json({ error: 'Not found' })
  res.json(expandRegistry(reg))
})

router.put('/:id', authMiddleware, (req, res) => {
  const { title, event_type, event_date, description, thank_you, is_public, status } = req.body
  db.prepare(`
    UPDATE gift_registries SET
      title = COALESCE(?, title), event_type = COALESCE(?, event_type),
      event_date = COALESCE(?, event_date), description = COALESCE(?, description),
      thank_you = COALESCE(?, thank_you), is_public = COALESCE(?, is_public), status = COALESCE(?, status)
    WHERE id = ?
  `).run(title ?? null, event_type ?? null, event_date ?? null, description ?? null, thank_you ?? null, is_public !== undefined ? (is_public ? 1 : 0) : null, status ?? null, req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM gift_registries WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// ─── ADMIN: stats ──────────────────────────────────────────────────────────────

router.get('/stats/summary', authMiddleware, (req, res) => {
  const total      = db.prepare(`SELECT COUNT(*) as c FROM gift_registries`).get().c
  const active     = db.prepare(`SELECT COUNT(*) as c FROM gift_registries WHERE status = 'active'`).get().c
  const items      = db.prepare(`SELECT COUNT(*) as c FROM gift_registry_items`).get().c
  const purchased  = db.prepare(`SELECT COALESCE(SUM(quantity),0) as c FROM gift_registry_purchases`).get().c
  const by_type    = db.prepare(`SELECT event_type, COUNT(*) as count FROM gift_registries GROUP BY event_type`).all()
  res.json({ total, active, items, purchased, by_type })
})

export default router
