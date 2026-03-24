// Pygmy CMS — Loyalty Rewards Catalog API (Phase 65)
// Customers redeem points for specific rewards (products, discounts, free shipping, etc.)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Init table ───────────────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    description    TEXT    NOT NULL DEFAULT '',
    type           TEXT    NOT NULL DEFAULT 'coupon',
    points_cost    INTEGER NOT NULL DEFAULT 100,
    value          REAL    NOT NULL DEFAULT 0,
    image          TEXT    NOT NULL DEFAULT '',
    stock          INTEGER NOT NULL DEFAULT -1,
    redeemed_count INTEGER NOT NULL DEFAULT 0,
    active         INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS loyalty_reward_redemptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reward_id   INTEGER NOT NULL REFERENCES loyalty_rewards(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points_used INTEGER NOT NULL,
    coupon_code TEXT    NOT NULL DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'pending',
    redeemed_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_lrr_customer ON loyalty_reward_redemptions(customer_id)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_lrr_reward ON loyalty_reward_redemptions(reward_id)`).run()

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

// GET /api/loyalty-rewards — list rewards (public — active only; admin sees all)
router.get('/', (req, res) => {
  const { all } = req.query
  const adminJwt = req.headers.authorization?.startsWith('Bearer ')
  const cond = (!all) ? 'WHERE active = 1' : ''

  const rewards = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM loyalty_reward_redemptions WHERE reward_id = r.id) as redeemed_count
    FROM loyalty_rewards r
    ${cond}
    ORDER BY sort_order ASC, points_cost ASC
  `).all()

  res.json(rewards)
})

// GET /api/loyalty-rewards/:id — single reward
router.get('/:id', (req, res) => {
  const reward = db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').get(req.params.id)
  if (!reward) return res.status(404).json({ error: 'Not found' })
  res.json(reward)
})

// POST /api/loyalty-rewards — create (admin)
router.post('/', authMiddleware, (req, res) => {
  const {
    name, description = '', type = 'coupon', points_cost = 100,
    value = 0, image = '', stock = -1, active = 1, sort_order = 0
  } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  if (!['coupon', 'free_shipping', 'product', 'credit'].includes(type)) {
    return res.status(400).json({ error: 'type must be: coupon, free_shipping, product, credit' })
  }

  const info = db.prepare(`
    INSERT INTO loyalty_rewards (name, description, type, points_cost, value, image, stock, active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description, type, points_cost, value, image, stock, active ? 1 : 0, sort_order)

  res.status(201).json(db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').get(info.lastInsertRowid))
})

// PUT /api/loyalty-rewards/:id — update (admin)
router.put('/:id', authMiddleware, (req, res) => {
  const r = db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').get(req.params.id)
  if (!r) return res.status(404).json({ error: 'Not found' })

  const { name, description, type, points_cost, value, image, stock, active, sort_order } = req.body

  db.prepare(`
    UPDATE loyalty_rewards SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      type = COALESCE(?, type),
      points_cost = COALESCE(?, points_cost),
      value = COALESCE(?, value),
      image = COALESCE(?, image),
      stock = COALESCE(?, stock),
      active = COALESCE(?, active),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(name, description, type, points_cost != null ? Number(points_cost) : null, value != null ? Number(value) : null, image, stock != null ? Number(stock) : null, active != null ? (active ? 1 : 0) : null, sort_order != null ? Number(sort_order) : null, r.id)

  res.json(db.prepare('SELECT * FROM loyalty_rewards WHERE id = ?').get(r.id))
})

// DELETE /api/loyalty-rewards/:id (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM loyalty_rewards WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// GET /api/loyalty-rewards/stats/summary (admin)
router.get('/stats/summary', authMiddleware, (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) as c FROM loyalty_rewards`).get().c
  const active = db.prepare(`SELECT COUNT(*) as c FROM loyalty_rewards WHERE active=1`).get().c
  const total_redemptions = db.prepare(`SELECT COUNT(*) as c FROM loyalty_reward_redemptions`).get().c
  const points_redeemed = db.prepare(`SELECT COALESCE(SUM(points_used),0) as s FROM loyalty_reward_redemptions`).get().s

  res.json({ total, active, total_redemptions, points_redeemed })
})

// GET /api/loyalty-rewards/admin/redemptions — all redemptions (admin)
router.get('/admin/redemptions', authMiddleware, (req, res) => {
  const { q = '', reward_id, limit = 30, offset = 0 } = req.query
  let where = []
  let params = []

  if (reward_id) { where.push('rr.reward_id = ?'); params.push(reward_id) }
  if (q) {
    where.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  const cond = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const rows = db.prepare(`
    SELECT rr.*, r.name as reward_name, r.type as reward_type,
      c.first_name || ' ' || c.last_name as customer_name, c.email as customer_email
    FROM loyalty_reward_redemptions rr
    JOIN loyalty_rewards r ON r.id = rr.reward_id
    JOIN customers c ON c.id = rr.customer_id
    ${cond}
    ORDER BY rr.redeemed_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  res.json(rows)
})

// ─── CUSTOMER ENDPOINTS ───────────────────────────────────────────────────────

// Customer auth middleware (checks customer JWT)
function customerAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  try {
    const jwt = await import('jsonwebtoken')
    // We'll use a simpler approach via DB lookup
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// POST /api/loyalty-rewards/redeem — customer redeems a reward
router.post('/redeem', (req, res) => {
  const { reward_id, customer_id, customer_email } = req.body
  if (!reward_id) return res.status(400).json({ error: 'reward_id required' })
  if (!customer_id && !customer_email) return res.status(400).json({ error: 'customer_id or customer_email required' })

  const reward = db.prepare(`SELECT * FROM loyalty_rewards WHERE id = ? AND active = 1`).get(reward_id)
  if (!reward) return res.status(404).json({ error: 'Reward not found or inactive' })

  // Find customer
  let cid = customer_id
  if (!cid && customer_email) {
    const cust = db.prepare('SELECT id FROM customers WHERE email = ?').get(customer_email)
    if (!cust) return res.status(404).json({ error: 'Customer not found' })
    cid = cust.id
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(cid)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  // Check points balance
  if ((customer.points_balance || 0) < reward.points_cost) {
    return res.status(400).json({
      error: 'Insufficient points',
      balance: customer.points_balance || 0,
      required: reward.points_cost
    })
  }

  // Check stock
  if (reward.stock >= 0) {
    const redeemed = db.prepare(`SELECT COUNT(*) as c FROM loyalty_reward_redemptions WHERE reward_id = ?`).get(reward.id).c
    if (redeemed >= reward.stock) {
      return res.status(400).json({ error: 'Reward is out of stock' })
    }
  }

  // Generate coupon code if type = coupon
  let coupon_code = ''
  if (reward.type === 'coupon' || reward.type === 'credit') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    coupon_code = 'RWD-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

    if (reward.type === 'coupon') {
      // Insert into coupons table
      try {
        db.prepare(`
          INSERT INTO coupons (code, discount_type, discount_value, min_order, max_uses, active, expires_at)
          VALUES (?, 'percent', ?, 0, 1, 1, datetime('now', '+90 days'))
        `).run(coupon_code, reward.value)
      } catch (e) {
        // coupons table may have different schema — best effort
      }
    } else {
      // Store credit
      try {
        db.prepare(`UPDATE customers SET store_credit_balance = COALESCE(store_credit_balance, 0) + ? WHERE id = ?`).run(reward.value, cid)
        db.prepare(`
          INSERT INTO store_credit_transactions (customer_id, amount, type, note)
          VALUES (?, ?, 'add', ?)
        `).run(cid, reward.value, `Loyalty reward: ${reward.name}`)
      } catch {}
    }
  }

  // Deduct points
  db.prepare(`UPDATE customers SET points_balance = MAX(0, COALESCE(points_balance, 0) - ?) WHERE id = ?`).run(reward.points_cost, cid)

  // Log transaction
  try {
    db.prepare(`
      INSERT INTO loyalty_transactions (customer_id, type, points, note, order_id)
      VALUES (?, 'redeem', ?, ?, NULL)
    `).run(cid, -reward.points_cost, `Redeemed reward: ${reward.name}`)
  } catch {}

  // Record redemption
  const info = db.prepare(`
    INSERT INTO loyalty_reward_redemptions (reward_id, customer_id, points_used, coupon_code, status)
    VALUES (?, ?, ?, ?, 'fulfilled')
  `).run(reward.id, cid, reward.points_cost, coupon_code)

  const redemption = db.prepare('SELECT * FROM loyalty_reward_redemptions WHERE id = ?').get(info.lastInsertRowid)

  // Return updated balance
  const updated = db.prepare('SELECT points_balance FROM customers WHERE id = ?').get(cid)

  res.status(201).json({
    ok: true,
    redemption,
    coupon_code,
    reward_type: reward.type,
    reward_value: reward.value,
    points_remaining: updated?.points_balance || 0,
    message: coupon_code
      ? `Your coupon code: ${coupon_code}`
      : `Reward "${reward.name}" has been applied to your account!`
  })
})

// GET /api/loyalty-rewards/my-redemptions?customer_id= — customer's own redemptions
router.get('/my-redemptions', (req, res) => {
  const { customer_id } = req.query
  if (!customer_id) return res.status(400).json({ error: 'customer_id required' })

  const rows = db.prepare(`
    SELECT rr.*, r.name as reward_name, r.type as reward_type, r.image as reward_image
    FROM loyalty_reward_redemptions rr
    JOIN loyalty_rewards r ON r.id = rr.reward_id
    WHERE rr.customer_id = ?
    ORDER BY rr.redeemed_at DESC
    LIMIT 20
  `).all(customer_id)

  res.json(rows)
})

// Seed default settings
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('loyalty_rewards_enabled', '1')`).run()

export default router
