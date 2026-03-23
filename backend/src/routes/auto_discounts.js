// Pygmy CMS — Cart-Level Auto Discounts (BOGO / Buy X Get Y) API (Phase 50)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive (rule) {
  if (!rule.active) return false
  const now = new Date().toISOString()
  if (rule.starts_at && rule.starts_at > now) return false
  if (rule.ends_at   && rule.ends_at   < now) return false
  if (rule.max_uses_total > 0 && rule.uses_count >= rule.max_uses_total) return false
  return true
}

function expandRule (rule) {
  if (!rule) return null
  const buyProduct = rule.buy_product_id
    ? db.prepare(`SELECT id, name, slug, cover_image, price FROM products WHERE id = ?`).get(rule.buy_product_id)
    : null
  const getProduct = rule.get_product_id
    ? db.prepare(`SELECT id, name, slug, cover_image, price FROM products WHERE id = ?`).get(rule.get_product_id)
    : null
  return { ...rule, buy_product: buyProduct, get_product: getProduct }
}

// ─── ADMIN CRUD ───────────────────────────────────────────────────────────────

router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT * FROM auto_discounts ORDER BY created_at DESC`).all()
  res.json(rows.map(expandRule))
})

router.get('/stats', authMiddleware, (req, res) => {
  const total  = db.prepare(`SELECT COUNT(*) as c FROM auto_discounts`).get().c
  const active = db.prepare(`SELECT COUNT(*) as c FROM auto_discounts WHERE active = 1`).get().c
  const uses   = db.prepare(`SELECT COALESCE(SUM(uses_count),0) as c FROM auto_discounts`).get().c
  const byType = db.prepare(`SELECT type, COUNT(*) as count FROM auto_discounts GROUP BY type`).all()
  res.json({ total, active, uses, by_type: byType })
})

router.get('/:id', authMiddleware, (req, res) => {
  const rule = db.prepare(`SELECT * FROM auto_discounts WHERE id = ?`).get(req.params.id)
  if (!rule) return res.status(404).json({ error: 'Not found' })
  res.json(expandRule(rule))
})

router.post('/', authMiddleware, (req, res) => {
  const {
    name, type = 'bogo', description, buy_product_id, buy_quantity = 1,
    get_product_id, get_quantity = 1, get_discount = 100,
    min_spend = 0, nth_item = 3, max_uses_total = 0, starts_at, ends_at, active = 1
  } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const info = db.prepare(`
    INSERT INTO auto_discounts
      (name, type, description, buy_product_id, buy_quantity, get_product_id, get_quantity,
       get_discount, min_spend, nth_item, max_uses_total, starts_at, ends_at, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, type, description || '', buy_product_id || null, buy_quantity, get_product_id || null,
    get_quantity, get_discount, min_spend, nth_item, max_uses_total, starts_at || null, ends_at || null, active ? 1 : 0)
  res.json({ ok: true, id: info.lastInsertRowid })
})

router.put('/:id', authMiddleware, (req, res) => {
  const {
    name, type, description, buy_product_id, buy_quantity,
    get_product_id, get_quantity, get_discount, min_spend, nth_item,
    max_uses_total, starts_at, ends_at, active
  } = req.body
  db.prepare(`
    UPDATE auto_discounts SET
      name           = COALESCE(?, name),
      type           = COALESCE(?, type),
      description    = COALESCE(?, description),
      buy_product_id = COALESCE(?, buy_product_id),
      buy_quantity   = COALESCE(?, buy_quantity),
      get_product_id = COALESCE(?, get_product_id),
      get_quantity   = COALESCE(?, get_quantity),
      get_discount   = COALESCE(?, get_discount),
      min_spend      = COALESCE(?, min_spend),
      nth_item       = COALESCE(?, nth_item),
      max_uses_total = COALESCE(?, max_uses_total),
      starts_at      = COALESCE(?, starts_at),
      ends_at        = COALESCE(?, ends_at),
      active         = COALESCE(?, active)
    WHERE id = ?
  `).run(name ?? null, type ?? null, description ?? null,
    buy_product_id !== undefined ? (buy_product_id || null) : null,
    buy_quantity ?? null, get_product_id !== undefined ? (get_product_id || null) : null,
    get_quantity ?? null, get_discount ?? null, min_spend ?? null, nth_item ?? null,
    max_uses_total ?? null, starts_at ?? null, ends_at ?? null,
    active !== undefined ? (active ? 1 : 0) : null, req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM auto_discounts WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// ─── PUBLIC: evaluate cart against active auto-discount rules ──────────────────
// POST /api/auto-discounts/evaluate
// Body: { items: [{ product_id, quantity, unit_price }], subtotal }
// Returns: { applied: [{ rule_id, name, description, discount_amount, free_items[] }], total_discount }

router.post('/evaluate', (req, res) => {
  const { items = [], subtotal = 0 } = req.body
  const setting = db.prepare(`SELECT value FROM settings WHERE key = 'auto_discounts_enabled'`).get()
  if (setting?.value !== '1') return res.json({ applied: [], total_discount: 0 })

  const rules = db.prepare(`SELECT * FROM auto_discounts WHERE active = 1`).all().filter(isActive)

  const applied = []

  for (const rule of rules) {
    let discountAmount = 0
    let freeItems = []

    if (rule.type === 'bogo' || rule.type === 'buy_x_get_y') {
      // Find buy item in cart
      const buyItem = rule.buy_product_id
        ? items.find(i => i.product_id === rule.buy_product_id && i.quantity >= rule.buy_quantity)
        : (items.reduce((s, i) => s + i.quantity, 0) >= rule.buy_quantity ? { product_id: null } : null)

      if (!buyItem) continue

      // Find get item in cart
      const getItem = rule.get_product_id
        ? items.find(i => i.product_id === rule.get_product_id)
        : items.find(i => i.product_id !== rule.buy_product_id) // any other product

      if (!getItem) continue

      const freeQty = Math.min(rule.get_quantity, getItem.quantity)
      discountAmount = (getItem.unit_price * freeQty * rule.get_discount) / 100
      freeItems = [{ product_id: getItem.product_id, quantity: freeQty, discount_pct: rule.get_discount }]

    } else if (rule.type === 'spend_x_get_y') {
      if (subtotal < rule.min_spend) continue

      const getItem = rule.get_product_id
        ? items.find(i => i.product_id === rule.get_product_id)
        : null
      if (getItem) {
        const freeQty = Math.min(rule.get_quantity, getItem.quantity)
        discountAmount = (getItem.unit_price * freeQty * rule.get_discount) / 100
        freeItems = [{ product_id: getItem.product_id, quantity: freeQty, discount_pct: rule.get_discount }]
      } else {
        // Flat discount on order
        discountAmount = Math.min(rule.min_spend * (rule.get_discount / 100), subtotal)
      }

    } else if (rule.type === 'nth_free') {
      // Every Nth item is free
      const sortedItems = [...items].sort((a, b) => a.unit_price - b.unit_price)
      let totalQty = 0
      let totalDisc = 0
      for (const item of sortedItems) {
        for (let q = 0; q < item.quantity; q++) {
          totalQty++
          if (totalQty % rule.nth_item === 0) {
            totalDisc += item.unit_price * (rule.get_discount / 100)
            freeItems.push({ product_id: item.product_id, quantity: 1, discount_pct: rule.get_discount })
          }
        }
      }
      discountAmount = totalDisc
    }

    if (discountAmount > 0) {
      applied.push({
        rule_id: rule.id,
        name: rule.name,
        description: rule.description,
        type: rule.type,
        discount_amount: Math.round(discountAmount * 100) / 100,
        free_items: freeItems,
      })
    }
  }

  const total_discount = applied.reduce((s, a) => s + a.discount_amount, 0)
  res.json({ applied, total_discount: Math.round(total_discount * 100) / 100 })
})

// ─── Record use (called after order placement) ────────────────────────────────
router.post('/record-use', (req, res) => {
  const { rule_ids = [] } = req.body
  for (const id of rule_ids) {
    db.prepare(`UPDATE auto_discounts SET uses_count = uses_count + 1 WHERE id = ?`).run(id)
  }
  res.json({ ok: true })
})

export default router
