// Pygmy CMS — Customer Groups + Group Pricing API (Phase 41)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseGroup(row) {
  if (!row) return null
  return row
}

// ── Admin: list all groups ────────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { q = '', active } = req.query
  let sql = `
    SELECT cg.*,
      COUNT(DISTINCT cgm.customer_id) AS member_count,
      COUNT(DISTINCT cgp.product_id)  AS price_override_count
    FROM customer_groups cg
    LEFT JOIN customer_group_members cgm ON cgm.group_id = cg.id
    LEFT JOIN customer_group_pricing  cgp ON cgp.group_id = cg.id
    WHERE cg.name LIKE ?
  `
  const params = [`%${q}%`]
  if (active !== undefined) { sql += ' AND cg.active = ?'; params.push(active === '1' ? 1 : 0) }
  sql += ' GROUP BY cg.id ORDER BY cg.name'
  res.json(db.prepare(sql).all(...params))
})

// ── Admin: get single group ───────────────────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const group = db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(req.params.id)
  if (!group) return res.status(404).json({ error: 'Not found' })

  const members = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.email, cgm.added_at
    FROM customer_group_members cgm
    JOIN customers c ON c.id = cgm.customer_id
    WHERE cgm.group_id = ?
    ORDER BY c.first_name, c.last_name
  `).all(req.params.id)

  const prices = db.prepare(`
    SELECT cgp.*, p.name AS product_name, p.slug AS product_slug, p.price AS base_price
    FROM customer_group_pricing cgp
    JOIN products p ON p.id = cgp.product_id
    WHERE cgp.group_id = ?
    ORDER BY p.name
  `).all(req.params.id)

  res.json({ ...group, members, prices })
})

// ── Admin: create group ───────────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { name, slug, description = '', discount_pct = 0, active = 1, color = '#6366f1' } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' })
  try {
    const info = db.prepare(`
      INSERT INTO customer_groups (name, slug, description, discount_pct, active, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, slug, description, discount_pct, active ? 1 : 0, color)
    res.status(201).json(db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(info.lastInsertRowid))
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Name or slug already exists' })
    throw e
  }
})

// ── Admin: update group ───────────────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const { name, slug, description, discount_pct, active, color } = req.body
  const g = db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(req.params.id)
  if (!g) return res.status(404).json({ error: 'Not found' })
  try {
    db.prepare(`
      UPDATE customer_groups
      SET name = ?, slug = ?, description = ?, discount_pct = ?, active = ?, color = ?
      WHERE id = ?
    `).run(
      name ?? g.name, slug ?? g.slug, description ?? g.description,
      discount_pct ?? g.discount_pct, active !== undefined ? (active ? 1 : 0) : g.active,
      color ?? g.color, req.params.id
    )
    res.json(db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(req.params.id))
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Name or slug already exists' })
    throw e
  }
})

// ── Admin: delete group ───────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM customer_groups WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Admin: add members to group ───────────────────────────────────────────────
router.post('/:id/members', authMiddleware, (req, res) => {
  const { customer_ids } = req.body
  if (!Array.isArray(customer_ids) || !customer_ids.length)
    return res.status(400).json({ error: 'customer_ids array required' })
  const insert = db.prepare('INSERT OR IGNORE INTO customer_group_members (group_id, customer_id) VALUES (?, ?)')
  const insertMany = db.transaction((ids) => ids.forEach(cid => insert.run(req.params.id, cid)))
  insertMany(customer_ids)
  res.json({ ok: true, added: customer_ids.length })
})

// ── Admin: remove member from group ──────────────────────────────────────────
router.delete('/:id/members/:customerId', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM customer_group_members WHERE group_id = ? AND customer_id = ?')
    .run(req.params.id, req.params.customerId)
  res.json({ ok: true })
})

// ── Admin: set group pricing for a product ────────────────────────────────────
router.put('/:id/pricing/:productId', authMiddleware, (req, res) => {
  const { price } = req.body
  if (price === undefined || price === null) return res.status(400).json({ error: 'price required' })
  db.prepare(`
    INSERT INTO customer_group_pricing (group_id, product_id, price)
    VALUES (?, ?, ?)
    ON CONFLICT(group_id, product_id) DO UPDATE SET price = excluded.price
  `).run(req.params.id, req.params.productId, price)
  res.json({ ok: true })
})

// ── Admin: remove group pricing for a product ─────────────────────────────────
router.delete('/:id/pricing/:productId', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM customer_group_pricing WHERE group_id = ? AND product_id = ?')
    .run(req.params.id, req.params.productId)
  res.json({ ok: true })
})

// ── Public / Customer: get my group discount for a product ───────────────────
// Used by checkout to apply group price
router.get('/me/price/:productId', customerAuthMiddleware, (req, res) => {
  const customerId = req.customer.id
  const productId  = req.params.productId
  // Find group membership + best (lowest) price override or highest discount
  const groupPrice = db.prepare(`
    SELECT MIN(cgp.price) AS group_price
    FROM customer_group_members cgm
    JOIN customer_group_pricing cgp ON cgp.group_id = cgm.group_id AND cgp.product_id = ?
    WHERE cgm.customer_id = ?
  `).get(productId, customerId)

  if (groupPrice?.group_price !== null && groupPrice?.group_price !== undefined) {
    return res.json({ group_price: groupPrice.group_price, source: 'price_override' })
  }

  // Fall back to group discount_pct
  const discount = db.prepare(`
    SELECT MAX(cg.discount_pct) AS discount_pct
    FROM customer_group_members cgm
    JOIN customer_groups cg ON cg.id = cgm.group_id
    WHERE cgm.customer_id = ? AND cg.active = 1
  `).get(customerId)

  const product = db.prepare('SELECT price FROM products WHERE id = ?').get(productId)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const pct = discount?.discount_pct ?? 0
  if (pct > 0) {
    return res.json({
      group_price: +(product.price * (1 - pct / 100)).toFixed(2),
      source: 'group_discount',
      discount_pct: pct
    })
  }

  res.json({ group_price: null, source: 'none' })
})

// ── Admin: get groups a customer belongs to ───────────────────────────────────
router.get('/customer/:customerId', authMiddleware, (req, res) => {
  const groups = db.prepare(`
    SELECT cg.*
    FROM customer_group_members cgm
    JOIN customer_groups cg ON cg.id = cgm.group_id
    WHERE cgm.customer_id = ?
    ORDER BY cg.name
  `).all(req.params.customerId)
  res.json(groups)
})

export default router
