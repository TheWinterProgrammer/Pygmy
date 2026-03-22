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

// ── Public: purchase a gift card (customer-facing) ────────────────────────────
// POST /api/gift-cards/purchase
// Creates a gift card in 'pending_payment' status; after payment confirmation (manual or webhook),
// admin can activate it. For a real store you'd integrate a payment processor.
// For Pygmy (no payment processor), we create it active and treat it as a manual flow.
router.post('/purchase', (req, res) => {
  const {
    value,
    recipient_name = '',
    recipient_email = '',
    sender_name = '',
    message = '',
    purchaser_email = '',
  } = req.body

  if (!value || isNaN(value) || Number(value) <= 0) {
    return res.status(400).json({ error: 'value must be a positive number' })
  }
  if (!purchaser_email || !purchaser_email.includes('@')) {
    return res.status(400).json({ error: 'purchaser_email is required' })
  }

  // Check gift cards are enabled
  const gcEnabled = db.prepare("SELECT value FROM settings WHERE key='gift_cards_enabled'").get()?.value
  if (gcEnabled !== '1') return res.status(403).json({ error: 'Gift cards are not available' })

  const code = generateCode()
  const settings = db.prepare('SELECT key, value FROM settings').all()
  const s = Object.fromEntries(settings.map(r => [r.key, r.value]))

  db.prepare(`
    INSERT INTO gift_cards (code, initial_value, balance, currency, recipient_name, recipient_email, sender_name, message, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL)
  `).run(
    code,
    Number(value),
    Number(value),
    s.shop_currency || 'EUR',
    recipient_name.trim(),
    recipient_email.trim(),
    sender_name.trim(),
    message.trim(),
  )

  // Log transaction
  db.prepare(`
    INSERT INTO gift_card_transactions (gift_card_id, type, amount, balance_after, note)
    VALUES (last_insert_rowid(), 'issue', ?, ?, ?)
  `).run(Number(value), Number(value), `Purchased by ${purchaser_email}`)

  const sym = s.shop_currency_symbol || '€'
  const siteName = s.site_name || 'Pygmy'

  // If SMTP configured + recipient email provided, attempt to send gift card email
  // (fire-and-forget, import done inline to avoid circular dep)
  import('../email.js').then(({ sendMailTo }) => {
    const recipientHtml = `
      <p>You've received a <strong>${sym}${Number(value).toFixed(2)}</strong> gift card from <strong>${sender_name || 'someone special'}</strong>!</p>
      ${message ? `<blockquote style="border-left:3px solid rgba(255,255,255,.2);padding-left:1em;margin:1em 0;color:#b0b0c0;font-style:italic">"${message}"</blockquote>` : ''}
      <div style="margin:1.5rem 0;padding:1.25rem;background:rgba(255,255,255,.06);border-radius:10px;text-align:center;">
        <div style="font-size:.82rem;color:#888;margin-bottom:.4rem">Your gift card code:</div>
        <div style="font-size:1.6rem;font-weight:800;letter-spacing:.1em;color:#e2e2e8;">${code}</div>
        <div style="font-size:.82rem;color:hsl(355,70%,60%);margin-top:.4rem">Balance: ${sym}${Number(value).toFixed(2)}</div>
      </div>
      <p style="font-size:.85rem;color:#888">Enter this code at checkout to redeem your gift card.</p>
    `
    const purchaserHtml = `
      <p>Your gift card purchase was successful!</p>
      <p>A <strong>${sym}${Number(value).toFixed(2)}</strong> gift card with code <strong>${code}</strong> has been ${recipient_email ? `sent to ${recipient_email}` : 'created'}.</p>
      <p style="font-size:.85rem;color:#888">Keep this email as a backup in case the recipient doesn't receive theirs.</p>
    `

    const wrapSimple = (body) => `<!DOCTYPE html><html><head><style>body{margin:0;padding:0;background:#1a1a1e;font-family:sans-serif;color:#e2e2e8}.w{max-width:580px;margin:2rem auto;background:#22232a;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}.h{background:hsl(355,70%,28%);padding:1.25rem 1.75rem}.h h1{margin:0;font-size:1.2rem;color:#fff}.b{padding:1.75rem}.f{padding:1rem 1.75rem;border-top:1px solid rgba(255,255,255,.07);font-size:.75rem;color:#555;text-align:center}</style></head><body><div class="w"><div class="h"><h1>🎁 ${siteName} Gift Card</h1></div><div class="b">${body}</div><div class="f">© ${new Date().getFullYear()} ${siteName}</div></div></body></html>`

    if (recipient_email) {
      sendMailTo({ to: recipient_email, subject: `🎁 You've received a gift card from ${siteName}!`, html: wrapSimple(recipientHtml), text: `Gift card code: ${code}\nBalance: ${sym}${Number(value).toFixed(2)}` }).catch(() => {})
    }
    if (purchaser_email && purchaser_email !== recipient_email) {
      sendMailTo({ to: purchaser_email, subject: `🎁 Your ${siteName} gift card purchase`, html: wrapSimple(purchaserHtml), text: `Your gift card code: ${code}\nBalance: ${sym}${Number(value).toFixed(2)}` }).catch(() => {})
    }
  }).catch(() => {})

  res.status(201).json({ code, value: Number(value), currency: s.shop_currency || 'EUR', currency_symbol: sym })
})

// ── Public: get purchasable denominations ─────────────────────────────────────
// GET /api/gift-cards/denominations
router.get('/denominations', (req, res) => {
  const gcEnabled = db.prepare("SELECT value FROM settings WHERE key='gift_cards_enabled'").get()?.value
  if (gcEnabled !== '1') return res.json({ enabled: false, denominations: [] })

  const denoms = db.prepare("SELECT value FROM settings WHERE key='gift_card_denominations'").get()?.value
  const sym = db.prepare("SELECT value FROM settings WHERE key='shop_currency_symbol'").get()?.value || '€'
  const currency = db.prepare("SELECT value FROM settings WHERE key='shop_currency'").get()?.value || 'EUR'

  let denomList = [25, 50, 100]
  if (denoms) {
    try {
      denomList = JSON.parse(denoms)
    } catch {
      denomList = denoms.split(',').map(v => parseFloat(v.trim())).filter(n => !isNaN(n) && n > 0)
    }
  }

  res.json({ enabled: true, denominations: denomList, currency, currency_symbol: sym })
})
