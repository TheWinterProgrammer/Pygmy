// Pygmy CMS — Loyalty Points API
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || 'pygmy-customer-secret-change-in-production'

const router = Router()

// ─── Helper: get setting value ────────────────────────────────────────────────
function getSetting(key) {
  return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value
}

// ─── Helper: resolve customer from JWT ───────────────────────────────────────
function resolveCustomer(req) {
  try {
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      const payload = jwt.verify(header.slice(7), CUSTOMER_JWT_SECRET)
      if (payload.role === 'customer') return payload.id
    }
  } catch {}
  return null
}

// ─── Customer: Get balance ────────────────────────────────────────────────────
// GET /api/loyalty/balance
router.get('/balance', (req, res) => {
  const customerId = resolveCustomer(req)
  if (!customerId) return res.status(401).json({ error: 'Authentication required' })

  const customer = db.prepare('SELECT id, points_balance FROM customers WHERE id = ?').get(customerId)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const loyaltyEnabled = getSetting('loyalty_enabled') === '1'
  const minRedeem = parseInt(getSetting('loyalty_min_redeem') || '100')
  const redemptionRate = parseInt(getSetting('loyalty_redemption_rate') || '100')

  const balance = customer.points_balance || 0
  const worth = balance / redemptionRate

  res.json({
    balance,
    worth,
    loyalty_enabled: loyaltyEnabled,
    min_redeem: minRedeem,
    redemption_rate: redemptionRate,
  })
})

// ─── Customer: Get transaction history ───────────────────────────────────────
// GET /api/loyalty/transactions
router.get('/transactions', (req, res) => {
  const customerId = resolveCustomer(req)
  if (!customerId) return res.status(401).json({ error: 'Authentication required' })

  const rows = db.prepare(`
    SELECT lt.*, o.order_number
    FROM loyalty_transactions lt
    LEFT JOIN orders o ON o.id = lt.order_id
    WHERE lt.customer_id = ?
    ORDER BY lt.created_at DESC
    LIMIT 50
  `).all(customerId)

  res.json(rows)
})

// ─── Customer: Redeem points ──────────────────────────────────────────────────
// POST /api/loyalty/redeem
router.post('/redeem', (req, res) => {
  const customerId = resolveCustomer(req)
  if (!customerId) return res.status(401).json({ error: 'Authentication required' })

  const loyaltyEnabled = getSetting('loyalty_enabled') === '1'
  if (!loyaltyEnabled) return res.status(400).json({ error: 'Loyalty program is not enabled' })

  const { points } = req.body
  const pointsNum = parseInt(points)
  if (!pointsNum || pointsNum <= 0) return res.status(400).json({ error: 'Invalid points amount' })

  const minRedeem = parseInt(getSetting('loyalty_min_redeem') || '100')
  if (pointsNum < minRedeem) {
    return res.status(400).json({ error: `Minimum redemption is ${minRedeem} points` })
  }

  const customer = db.prepare('SELECT id, points_balance FROM customers WHERE id = ?').get(customerId)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  if (customer.points_balance < pointsNum) {
    return res.status(400).json({ error: `Insufficient points. You have ${customer.points_balance} points.` })
  }

  const redemptionRate = parseInt(getSetting('loyalty_redemption_rate') || '100')
  const discount = pointsNum / redemptionRate

  res.json({
    discount: Math.round(discount * 100) / 100,
    points_used: pointsNum,
    remaining_balance: customer.points_balance - pointsNum,
  })
})

// ─── Customer: Get tier info + progress ──────────────────────────────────────
// GET /api/loyalty/tier
router.get('/tier', (req, res) => {
  const customerId = resolveCustomer(req)
  if (!customerId) return res.status(401).json({ error: 'Authentication required' })

  const customer = db.prepare('SELECT id, points_balance, loyalty_tier_id FROM customers WHERE id = ?').get(customerId)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const tiersEnabled = getSetting('loyalty_tiers_enabled') === '1'
  if (!tiersEnabled) return res.json({ tiers_enabled: false })

  const tiers = db.prepare(`
    SELECT id, name, slug, min_points, earn_multiplier, color, icon, perks, sort_order
    FROM loyalty_tiers WHERE active = 1
    ORDER BY min_points ASC
  `).all().map(t => {
    try { t.perks = JSON.parse(t.perks || '[]') } catch { t.perks = [] }
    return t
  })

  const balance = customer.points_balance || 0

  // Find current tier (highest min_points not exceeding balance)
  const currentTier = [...tiers].reverse().find(t => balance >= t.min_points) || null

  // Find next tier (first tier above balance)
  const nextTier = tiers.find(t => balance < t.min_points) || null

  let progress = 100
  let pointsToNext = 0
  if (nextTier) {
    const tierStart = currentTier ? currentTier.min_points : 0
    const tierRange = nextTier.min_points - tierStart
    progress = tierRange > 0 ? Math.round(((balance - tierStart) / tierRange) * 100) : 100
    pointsToNext = nextTier.min_points - balance
  }

  res.json({
    tiers_enabled: true,
    balance,
    current_tier: currentTier,
    next_tier: nextTier,
    progress_pct: progress,
    points_to_next: pointsToNext,
    all_tiers: tiers,
  })
})

// ─── Admin: List customers with points ───────────────────────────────────────
// GET /api/loyalty/admin/customers
router.get('/admin/customers', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT id, email, first_name, last_name, points_balance
    FROM customers
    WHERE points_balance > 0
    ORDER BY points_balance DESC
    LIMIT 100
  `).all()
  res.json(rows)
})

// ─── Admin: Manual points adjustment ─────────────────────────────────────────
// POST /api/loyalty/admin/adjust
router.post('/admin/adjust', authMiddleware, (req, res) => {
  const { customer_id, points, note = '' } = req.body
  if (!customer_id || points === undefined) {
    return res.status(400).json({ error: 'customer_id and points are required' })
  }

  const customer = db.prepare('SELECT id, points_balance FROM customers WHERE id = ?').get(customer_id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const pointsNum = parseInt(points)
  if (isNaN(pointsNum)) return res.status(400).json({ error: 'Points must be a number' })

  const newBalance = Math.max(0, customer.points_balance + pointsNum)

  const adjust = db.transaction(() => {
    db.prepare(`
      INSERT INTO loyalty_transactions (customer_id, type, points, note)
      VALUES (?, 'adjust', ?, ?)
    `).run(customer_id, pointsNum, (note || '').trim())

    db.prepare(`
      UPDATE customers SET points_balance = ? WHERE id = ?
    `).run(newBalance, customer_id)
  })

  adjust()

  res.json({ ok: true, new_balance: newBalance })
})

// ─── Admin: Get transaction history for a customer ────────────────────────────
// GET /api/loyalty/admin/transactions/:customer_id
router.get('/admin/transactions/:customer_id', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT lt.*, o.order_number
    FROM loyalty_transactions lt
    LEFT JOIN orders o ON o.id = lt.order_id
    WHERE lt.customer_id = ?
    ORDER BY lt.created_at DESC
    LIMIT 10
  `).all(req.params.customer_id)
  res.json(rows)
})

export default router
