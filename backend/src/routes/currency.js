// Pygmy CMS — Multi-Currency Exchange Rates API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ── GET /api/currency ─ List all active rates (public) ───────────────────────
router.get('/', (req, res) => {
  const { all } = req.query
  const base = db.prepare("SELECT value FROM settings WHERE key='base_currency'").get()?.value || 'EUR'
  const enabled = db.prepare("SELECT value FROM settings WHERE key='multicurrency_enabled'").get()?.value === '1'
  const baseSym = db.prepare("SELECT value FROM settings WHERE key='shop_currency_symbol'").get()?.value || '€'

  if (!enabled && !all) {
    return res.json({ enabled: false, base, base_symbol: baseSym, rates: [] })
  }

  const cond = all ? '' : 'WHERE active = 1'
  const rates = db.prepare(`SELECT * FROM currency_rates ${cond} ORDER BY code ASC`).all()
  res.json({ enabled, base, base_symbol: baseSym, rates })
})

// ── GET /api/currency/:code ─ Single rate ────────────────────────────────────
router.get('/:code', (req, res) => {
  const rate = db.prepare('SELECT * FROM currency_rates WHERE code = ?').get(req.params.code.toUpperCase())
  if (!rate) return res.status(404).json({ error: 'Currency not found' })
  res.json(rate)
})

// ── POST /api/currency ─ Create rate (admin) ─────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { code, symbol = '', rate = 1, active = 1 } = req.body
  if (!code || !code.match(/^[A-Z]{3}$/)) {
    return res.status(400).json({ error: 'code must be a 3-letter ISO currency code (e.g. USD)' })
  }
  if (isNaN(rate) || Number(rate) <= 0) {
    return res.status(400).json({ error: 'rate must be a positive number' })
  }

  try {
    const info = db.prepare(`
      INSERT INTO currency_rates (code, symbol, rate, active)
      VALUES (?, ?, ?, ?)
    `).run(code.toUpperCase(), symbol, Number(rate), active ? 1 : 0)
    res.status(201).json({ id: info.lastInsertRowid, code: code.toUpperCase() })
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Currency already exists' })
    }
    throw e
  }
})

// ── PUT /api/currency/:id ─ Update rate (admin) ──────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const { symbol, rate, active } = req.body
  const cur = db.prepare('SELECT * FROM currency_rates WHERE id = ?').get(req.params.id)
  if (!cur) return res.status(404).json({ error: 'Currency not found' })

  db.prepare(`
    UPDATE currency_rates SET
      symbol = COALESCE(?, symbol),
      rate   = COALESCE(?, rate),
      active = COALESCE(?, active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    symbol !== undefined ? symbol : null,
    rate !== undefined ? Number(rate) : null,
    active !== undefined ? (active ? 1 : 0) : null,
    cur.id,
  )
  res.json({ ok: true })
})

// ── DELETE /api/currency/:id ─ Delete rate (admin) ───────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const cur = db.prepare('SELECT * FROM currency_rates WHERE id = ?').get(req.params.id)
  if (!cur) return res.status(404).json({ error: 'Currency not found' })
  db.prepare('DELETE FROM currency_rates WHERE id = ?').run(cur.id)
  res.json({ ok: true })
})

// ── POST /api/currency/sync ─ Sync rates from open.er-api.com (admin) ────────
// Uses the free, no-key-required open.er-api.com endpoint.
router.post('/sync', authMiddleware, async (req, res) => {
  const base = db.prepare("SELECT value FROM settings WHERE key='base_currency'").get()?.value || 'EUR'
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`)
    if (!response.ok) throw new Error(`API returned ${response.status}`)
    const data = await response.json()
    if (data.result !== 'success') throw new Error('API returned failure result')

    const rates = data.rates
    const existing = db.prepare('SELECT code FROM currency_rates').all().map(r => r.code)
    let updated = 0, skipped = 0

    for (const code of existing) {
      if (rates[code]) {
        db.prepare(`UPDATE currency_rates SET rate = ?, updated_at = datetime('now') WHERE code = ?`)
          .run(rates[code], code)
        updated++
      } else {
        skipped++
      }
    }

    res.json({ ok: true, updated, skipped, base, timestamp: data.time_last_update_utc })
  } catch (e) {
    res.status(502).json({ error: `Rate sync failed: ${e.message}` })
  }
})

// ── POST /api/currency/convert ─ Convert an amount (public) ──────────────────
router.post('/convert', (req, res) => {
  const { amount, from, to } = req.body
  if (!amount || !to) return res.status(400).json({ error: 'amount and to are required' })

  const base = db.prepare("SELECT value FROM settings WHERE key='base_currency'").get()?.value || 'EUR'
  const fromCode = (from || base).toUpperCase()
  const toCode = to.toUpperCase()

  if (fromCode === toCode) return res.json({ converted: Number(amount), rate: 1 })

  const fromRate = fromCode === base ? 1
    : db.prepare('SELECT rate FROM currency_rates WHERE code = ? AND active = 1').get(fromCode)?.rate
  const toRate = toCode === base ? 1
    : db.prepare('SELECT rate FROM currency_rates WHERE code = ? AND active = 1').get(toCode)?.rate

  if (!fromRate) return res.status(404).json({ error: `Currency ${fromCode} not found or inactive` })
  if (!toRate) return res.status(404).json({ error: `Currency ${toCode} not found or inactive` })

  // Convert to base then to target
  const inBase = Number(amount) / fromRate
  const converted = Math.round(inBase * toRate * 100) / 100

  res.json({ converted, from: fromCode, to: toCode, rate: toRate / fromRate })
})

export default router
