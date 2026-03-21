// Pygmy CMS — Tax Rates API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helper: get setting value ────────────────────────────────────────────────
function getSetting(key) {
  return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value
}

// ─── Admin: List all tax rates ────────────────────────────────────────────────
// GET /api/tax-rates
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM tax_rates ORDER BY priority DESC, id ASC').all()
  res.json(rows)
})

// ─── Admin: Create tax rate ───────────────────────────────────────────────────
// POST /api/tax-rates
router.post('/', authMiddleware, (req, res) => {
  const { name = 'VAT', country = '*', state = '', rate = 0, inclusive = 0, priority = 0, active = 1 } = req.body
  if (!name || rate === undefined) {
    return res.status(400).json({ error: 'name and rate are required' })
  }
  const result = db.prepare(`
    INSERT INTO tax_rates (name, country, state, rate, inclusive, priority, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), (country || '*').trim().toUpperCase(), (state || '').trim(), parseFloat(rate), inclusive ? 1 : 0, parseInt(priority) || 0, active ? 1 : 0)

  const row = db.prepare('SELECT * FROM tax_rates WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(row)
})

// ─── Admin: Update tax rate ───────────────────────────────────────────────────
// PUT /api/tax-rates/:id
router.put('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM tax_rates WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Tax rate not found' })

  const { name, country, state, rate, inclusive, priority, active } = req.body
  db.prepare(`
    UPDATE tax_rates SET
      name      = COALESCE(?, name),
      country   = COALESCE(?, country),
      state     = COALESCE(?, state),
      rate      = COALESCE(?, rate),
      inclusive = COALESCE(?, inclusive),
      priority  = COALESCE(?, priority),
      active    = COALESCE(?, active)
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : null,
    country !== undefined ? country.trim().toUpperCase() : null,
    state !== undefined ? state.trim() : null,
    rate !== undefined ? parseFloat(rate) : null,
    inclusive !== undefined ? (inclusive ? 1 : 0) : null,
    priority !== undefined ? (parseInt(priority) || 0) : null,
    active !== undefined ? (active ? 1 : 0) : null,
    row.id
  )
  const updated = db.prepare('SELECT * FROM tax_rates WHERE id = ?').get(row.id)
  res.json(updated)
})

// ─── Admin: Delete tax rate ───────────────────────────────────────────────────
// DELETE /api/tax-rates/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM tax_rates WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Tax rate not found' })
  db.prepare('DELETE FROM tax_rates WHERE id = ?').run(row.id)
  res.json({ ok: true })
})

// ─── Public: Calculate tax ────────────────────────────────────────────────────
// POST /api/tax-rates/calculate
router.post('/calculate', (req, res) => {
  const { country = '', subtotal = 0 } = req.body

  const taxEnabled = getSetting('tax_enabled')
  if (!taxEnabled || taxEnabled === '0') {
    return res.json({ tax_amount: 0, rate: 0, name: '', applicable_rate: null })
  }

  const sub = parseFloat(subtotal) || 0
  const countryUpper = (country || '').trim().toUpperCase()

  // Find active rate: exact country match first (highest priority), then '*' wildcard
  let applicable = null

  if (countryUpper) {
    applicable = db.prepare(`
      SELECT * FROM tax_rates
      WHERE active = 1 AND country = ?
      ORDER BY priority DESC LIMIT 1
    `).get(countryUpper)
  }

  if (!applicable) {
    applicable = db.prepare(`
      SELECT * FROM tax_rates
      WHERE active = 1 AND country = '*'
      ORDER BY priority DESC LIMIT 1
    `).get()
  }

  if (!applicable || !applicable.rate) {
    return res.json({ tax_amount: 0, rate: 0, name: '', applicable_rate: null })
  }

  const taxInclusive = getSetting('tax_inclusive') === '1'
  const rateVal = applicable.rate
  let tax_amount

  if (taxInclusive) {
    // Extract tax from price
    tax_amount = sub - (sub / (1 + rateVal / 100))
  } else {
    // Add tax on top
    tax_amount = sub * (rateVal / 100)
  }

  res.json({
    tax_amount: Math.round(tax_amount * 100) / 100,
    rate: rateVal,
    name: applicable.name,
    applicable_rate: applicable,
  })
})

export default router
