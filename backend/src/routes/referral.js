// Pygmy CMS — Customer Referral Program API (Phase 39)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function genCode(name = '') {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'ref'
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${slug}${rand}`
}

function getSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (
    'referral_enabled','referral_reward_amount','referral_min_order','store_credit_enabled'
  )`).all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

// ── Customer: get or create own referral code ─────────────────────────────────
router.get('/my-code', customerAuthMiddleware, (req, res) => {
  const settings = getSettings()
  const customer = db.prepare('SELECT id, first_name, last_name, email FROM customers WHERE id = ?').get(req.customer.id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  let ref = db.prepare('SELECT * FROM referral_codes WHERE customer_id = ?').get(req.customer.id)
  if (!ref) {
    const code = genCode(`${customer.first_name || ''}${customer.last_name || ''}`)
    db.prepare(`INSERT INTO referral_codes (customer_id, code) VALUES (?, ?)`).run(req.customer.id, code)
    ref = db.prepare('SELECT * FROM referral_codes WHERE customer_id = ?').get(req.customer.id)
  }

  const events = db.prepare(`
    SELECT * FROM referral_events WHERE referrer_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(req.customer.id)

  res.json({
    code: ref.code,
    times_used: ref.times_used,
    credit_earned: ref.credit_earned,
    referral_enabled: settings.referral_enabled === '1',
    reward_amount: parseFloat(settings.referral_reward_amount || '10'),
    min_order: parseFloat(settings.referral_min_order || '0'),
    events,
  })
})

// ── Public: validate a referral code (used at registration/checkout) ──────────
router.get('/validate/:code', (req, res) => {
  const ref = db.prepare(`
    SELECT rc.*, c.first_name, c.last_name
    FROM referral_codes rc
    JOIN customers c ON c.id = rc.customer_id
    WHERE rc.code = ?
  `).get(req.params.code.toUpperCase())
  if (!ref) return res.status(404).json({ error: 'Invalid referral code' })

  const settings = getSettings()
  if (settings.referral_enabled !== '1') return res.status(400).json({ error: 'Referral program is not active' })

  res.json({
    valid: true,
    code: ref.code,
    referrer_name: `${ref.first_name || ''} ${ref.last_name || ''}`.trim(),
    reward_amount: parseFloat(settings.referral_reward_amount || '10'),
  })
})

// ── Internal helper (called from orders route after order placed) ─────────────
export function processReferralReward(orderId, customerEmail, orderTotal) {
  try {
    const settings = getSettings()
    if (settings.referral_enabled !== '1') return

    const minOrder = parseFloat(settings.referral_min_order || '0')
    if (minOrder > 0 && orderTotal < minOrder) return

    const rewardAmount = parseFloat(settings.referral_reward_amount || '10')

    // find unprocessed referral event for this customer
    const event = db.prepare(`
      SELECT re.*, rc.customer_id as referrer_id
      FROM referral_events re
      JOIN referral_codes rc ON rc.code = re.referral_code
      WHERE re.referred_email = ? AND re.reward_given = 0
      LIMIT 1
    `).get(customerEmail)

    if (!event) return

    // update event
    db.prepare(`
      UPDATE referral_events
      SET order_id = ?, reward_given = 1, reward_amount = ?
      WHERE id = ?
    `).run(orderId, rewardAmount, event.id)

    // credit referrer
    db.prepare('UPDATE customers SET store_credit_balance = store_credit_balance + ? WHERE id = ?').run(rewardAmount, event.referrer_id)
    db.prepare(`INSERT INTO store_credit_transactions (customer_id, amount, type, note, order_id) VALUES (?, ?, 'referral', ?, ?)`).run(event.referrer_id, rewardAmount, `Referral reward for ${customerEmail}`, orderId)

    // update referral code stats
    db.prepare('UPDATE referral_codes SET times_used = times_used + 1, credit_earned = credit_earned + ? WHERE code = ?').run(rewardAmount, event.referral_code)

    console.log(`🎁 Referral reward €${rewardAmount} issued to customer #${event.referrer_id}`)
  } catch (e) {
    console.warn('Referral reward error:', e.message)
  }
}

// ── Public: record referral event (when referred customer registers) ───────────
router.post('/register', (req, res) => {
  const { code, email } = req.body
  if (!code || !email) return res.status(400).json({ error: 'code and email required' })

  const settings = getSettings()
  if (settings.referral_enabled !== '1') return res.status(400).json({ error: 'Referral program is not active' })

  const ref = db.prepare('SELECT * FROM referral_codes WHERE code = ?').get(code.toUpperCase())
  if (!ref) return res.status(404).json({ error: 'Invalid referral code' })

  // check if email already registered/rewarded
  const existing = db.prepare('SELECT id FROM referral_events WHERE referred_email = ?').get(email)
  if (existing) return res.status(409).json({ error: 'Email already used a referral' })

  // prevent self-referral
  const referrer = db.prepare('SELECT email FROM customers WHERE id = ?').get(ref.customer_id)
  if (referrer?.email === email) return res.status(400).json({ error: 'Cannot refer yourself' })

  db.prepare(`
    INSERT INTO referral_events (referral_code, referrer_id, referred_email)
    VALUES (?, ?, ?)
  `).run(code.toUpperCase(), ref.customer_id, email)

  res.json({ ok: true })
})

// ── Admin: list all referral codes ───────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { q = '' } = req.query
  const search = `%${q}%`
  const rows = db.prepare(`
    SELECT rc.*, c.first_name, c.last_name, c.email as customer_email
    FROM referral_codes rc
    JOIN customers c ON c.id = rc.customer_id
    WHERE (c.email LIKE ? OR c.first_name LIKE ? OR rc.code LIKE ?)
    ORDER BY rc.credit_earned DESC, rc.times_used DESC
    LIMIT 100
  `).all(search, search, search)
  res.json(rows)
})

// ── Admin: list referral events ───────────────────────────────────────────────
router.get('/events', authMiddleware, (req, res) => {
  const { limit = 50, offset = 0 } = req.query
  const rows = db.prepare(`
    SELECT re.*, rc.customer_id as referrer_id,
           c.first_name || ' ' || c.last_name as referrer_name,
           o.order_number
    FROM referral_events re
    JOIN referral_codes rc ON rc.code = re.referral_code
    JOIN customers c ON c.id = rc.customer_id
    LEFT JOIN orders o ON o.id = re.order_id
    ORDER BY re.created_at DESC
    LIMIT ? OFFSET ?
  `).all(Number(limit), Number(offset))
  const total = db.prepare('SELECT COUNT(*) as c FROM referral_events').get()?.c || 0
  res.json({ rows, total })
})

// ── Admin: stats ──────────────────────────────────────────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const totalCodes = db.prepare('SELECT COUNT(*) as c FROM referral_codes').get()?.c || 0
  const totalEvents = db.prepare('SELECT COUNT(*) as c FROM referral_events').get()?.c || 0
  const rewarded = db.prepare('SELECT COUNT(*) as c FROM referral_events WHERE reward_given = 1').get()?.c || 0
  const totalCredit = db.prepare('SELECT COALESCE(SUM(credit_earned),0) as v FROM referral_codes').get()?.v || 0
  const settings = getSettings()
  res.json({
    total_codes: totalCodes,
    total_events: totalEvents,
    rewarded,
    pending: totalEvents - rewarded,
    total_credit_issued: totalCredit,
    reward_amount: parseFloat(settings.referral_reward_amount || '10'),
    enabled: settings.referral_enabled === '1',
  })
})

export default router
