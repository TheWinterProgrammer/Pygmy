import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { randomBytes } from 'crypto'
import { logActivity } from './activity.js'

const router = Router()

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateCode() {
  // Format: PYGM-XXXX-XXXX-XXXX (uppercase alphanumeric, no ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `PYGM-${seg()}-${seg()}-${seg()}`
}

function isExpired(card) {
  if (!card.expires_at) return false
  return new Date(card.expires_at) < new Date()
}

// ── Public: validate/check a gift card code ──────────────────────────────────
// Must be registered BEFORE /:id routes to avoid being caught by the param route
router.post('/validate', (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'code required' })

  const card = db.prepare('SELECT * FROM gift_cards WHERE code = ?').get(code.trim().toUpperCase())
  if (!card) return res.status(404).json({ error: 'Invalid gift card code' })
  if (card.status !== 'active') return res.status(400).json({ error: 'Gift card is not active' })
  const expired = card.expires_at && new Date(card.expires_at) < new Date()
  if (expired) return res.status(400).json({ error: 'Gift card has expired' })
  if (card.balance <= 0) return res.status(400).json({ error: 'Gift card has no remaining balance' })

  res.json({
    valid: true,
    code: card.code,
    balance: card.balance,
    initial_value: card.initial_value,
    currency: card.currency,
    expires_at: card.expires_at,
  })
})

// ── Admin: stats ─────────────────────────────────────────────────────────────
router.get('/admin/stats', authMiddleware, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM gift_cards').get().n
  const active = db.prepare("SELECT COUNT(*) as n FROM gift_cards WHERE status = 'active'").get().n
  const totalIssued = db.prepare('SELECT COALESCE(SUM(initial_value), 0) as v FROM gift_cards').get().v
  const totalBalance = db.prepare("SELECT COALESCE(SUM(balance), 0) as v FROM gift_cards WHERE status = 'active'").get().v
  const totalRedeemed = db.prepare("SELECT COALESCE(SUM(ABS(amount)), 0) as v FROM gift_card_transactions WHERE type = 'redeem'").get().v

  res.json({ total, active, totalIssued, totalBalance, totalRedeemed })
})

// ── Admin: list all gift cards ────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { q = '', status = '', limit = 50, offset = 0 } = req.query
  const conditions = []
  const params = []

  if (q) {
    conditions.push(`(g.code LIKE ? OR g.recipient_name LIKE ? OR g.recipient_email LIKE ? OR g.sender_name LIKE ?)`)
    const like = `%${q}%`
    params.push(like, like, like, like)
  }
  if (status) {
    conditions.push(`g.status = ?`)
    params.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const cards = db.prepare(`
    SELECT g.*, u.name AS created_by_name
    FROM gift_cards g
    LEFT JOIN users u ON u.id = g.created_by
    ${where}
    ORDER BY g.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`SELECT COUNT(*) as n FROM gift_cards g ${where}`).get(...params).n

  res.json({ cards, total })
})

// ── Admin: single gift card + transactions ───────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const card = db.prepare(`
    SELECT g.*, u.name AS created_by_name
    FROM gift_cards g LEFT JOIN users u ON u.id = g.created_by
    WHERE g.id = ?
  `).get(req.params.id)
  if (!card) return res.status(404).json({ error: 'Gift card not found' })

  const transactions = db.prepare(`
    SELECT t.*, o.order_number
    FROM gift_card_transactions t
    LEFT JOIN orders o ON o.id = t.order_id
    WHERE t.gift_card_id = ?
    ORDER BY t.created_at DESC
  `).all(card.id)

  res.json({ card, transactions })
})

// ── Admin: create gift card ──────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const {
    value,
    recipient_name = '',
    recipient_email = '',
    sender_name = '',
    message = '',
    expires_at = null,
    custom_code = null,
  } = req.body

  if (!value || isNaN(value) || Number(value) <= 0) {
    return res.status(400).json({ error: 'value must be a positive number' })
  }

  const code = custom_code?.trim().toUpperCase() || generateCode()

  // Check code uniqueness
  if (db.prepare('SELECT id FROM gift_cards WHERE code = ?').get(code)) {
    return res.status(409).json({ error: 'Gift card code already exists' })
  }

  const settings = db.prepare('SELECT key, value FROM settings').all()
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]))

  const info = db.prepare(`
    INSERT INTO gift_cards (code, initial_value, balance, currency, recipient_name, recipient_email, sender_name, message, status, expires_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(
    code,
    Number(value),
    Number(value),
    settingsMap.shop_currency || 'EUR',
    recipient_name,
    recipient_email,
    sender_name,
    message,
    expires_at || null,
    req.user?.id || null,
  )

  logActivity(req.user?.id, req.user?.name, 'create', 'gift_card', info.lastInsertRowid, code)
  res.status(201).json({ id: info.lastInsertRowid, code })
})

// ── Admin: update gift card ───────────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const card = db.prepare('SELECT * FROM gift_cards WHERE id = ?').get(req.params.id)
  if (!card) return res.status(404).json({ error: 'Gift card not found' })

  const {
    status,
    recipient_name,
    recipient_email,
    sender_name,
    message,
    expires_at,
  } = req.body

  db.prepare(`
    UPDATE gift_cards SET
      status = COALESCE(?, status),
      recipient_name = COALESCE(?, recipient_name),
      recipient_email = COALESCE(?, recipient_email),
      sender_name = COALESCE(?, sender_name),
      message = COALESCE(?, message),
      expires_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    status ?? null,
    recipient_name ?? null,
    recipient_email ?? null,
    sender_name ?? null,
    message ?? null,
    expires_at ?? null,
    card.id,
  )

  logActivity(req.user?.id, req.user?.name, 'update', 'gift_card', card.id, card.code)
  res.json({ ok: true })
})

// ── Admin: manually adjust balance ──────────────────────────────────────────
router.post('/:id/adjust', authMiddleware, (req, res) => {
  const card = db.prepare('SELECT * FROM gift_cards WHERE id = ?').get(req.params.id)
  if (!card) return res.status(404).json({ error: 'Gift card not found' })

  const { amount, note = '' } = req.body
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'amount required' })

  const newBalance = Math.max(0, card.balance + Number(amount))

  db.prepare(`UPDATE gift_cards SET balance = ?, updated_at = datetime('now') WHERE id = ?`).run(newBalance, card.id)

  db.prepare(`
    INSERT INTO gift_card_transactions (gift_card_id, type, amount, balance_after, note)
    VALUES (?, 'adjust', ?, ?, ?)
  `).run(card.id, Number(amount), newBalance, note)

  res.json({ ok: true, new_balance: newBalance })
})

// ── Admin: delete gift card ──────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const card = db.prepare('SELECT * FROM gift_cards WHERE id = ?').get(req.params.id)
  if (!card) return res.status(404).json({ error: 'Gift card not found' })
  db.prepare('DELETE FROM gift_cards WHERE id = ?').run(card.id)
  logActivity(req.user?.id, req.user?.name, 'delete', 'gift_card', card.id, card.code)
  res.json({ ok: true })
})

// ── Internal: redeem gift card at checkout ───────────────────────────────────
// Called from orders.js — not a public route, exported as helper
export function redeemGiftCard(code, orderTotal, orderId) {
  const card = db.prepare('SELECT * FROM gift_cards WHERE code = ?').get(code?.trim().toUpperCase())
  if (!card || card.status !== 'active' || isExpired(card) || card.balance <= 0) {
    return { ok: false, error: 'Invalid or expired gift card', discount: 0 }
  }

  const discount = Math.min(card.balance, orderTotal)
  const newBalance = Math.max(0, card.balance - discount)
  const newStatus = newBalance === 0 ? 'used' : 'active'

  db.prepare(`UPDATE gift_cards SET balance = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newBalance, newStatus, card.id)

  db.prepare(`
    INSERT INTO gift_card_transactions (gift_card_id, order_id, type, amount, balance_after, note)
    VALUES (?, ?, 'redeem', ?, ?, ?)
  `).run(card.id, orderId, -discount, newBalance, `Redeemed on order`)

  return { ok: true, discount, code: card.code, new_balance: newBalance }
}

export default router
