// Pygmy CMS — Shipping Zones & Rates API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Public: Get shipping options for a given country ─────────────────────────
// POST /api/shipping/calculate
// Body: { country_code: 'DE', subtotal: 49.99 }
router.post('/calculate', (req, res) => {
  const { country_code = '', subtotal = 0 } = req.body
  const code = (country_code || '').trim().toUpperCase()
  const sub = parseFloat(subtotal) || 0

  // Find matching zone (specific country first, then "rest of world" zones)
  const zones = db.prepare('SELECT * FROM shipping_zones ORDER BY id').all()

  let matchedZone = null
  for (const z of zones) {
    const countries = JSON.parse(z.countries || '[]')
    if (countries.length === 0) continue // skip catch-all in first pass
    if (countries.includes(code)) { matchedZone = z; break }
  }
  // Fallback to catch-all (empty countries array)
  if (!matchedZone) {
    matchedZone = zones.find(z => JSON.parse(z.countries || '[]').length === 0) || null
  }

  if (!matchedZone) {
    return res.json({ rates: [], zone: null })
  }

  const rates = db.prepare(`
    SELECT * FROM shipping_rates WHERE zone_id = ? AND active = 1 ORDER BY rate ASC
  `).all(matchedZone.id)

  // Resolve applicable rates, applying threshold logic
  const resolved = rates.map(r => {
    if (r.type === 'free') {
      return { id: r.id, name: r.name, cost: 0, free: true }
    }
    if (r.type === 'threshold') {
      const free = sub >= r.min_order
      return { id: r.id, name: r.name + (free ? ' (Free)' : ''), cost: free ? 0 : r.rate, free }
    }
    // flat
    return { id: r.id, name: r.name, cost: r.rate, free: false }
  })

  res.json({ rates: resolved, zone: matchedZone.name })
})

// ─── Admin: Zones CRUD ────────────────────────────────────────────────────────

router.get('/zones', authMiddleware, (req, res) => {
  const zones = db.prepare('SELECT * FROM shipping_zones ORDER BY id').all()
  const zonesWithRates = zones.map(z => {
    const rates = db.prepare('SELECT * FROM shipping_rates WHERE zone_id = ? ORDER BY id').all(z.id)
    return {
      ...z,
      countries: JSON.parse(z.countries || '[]'),
      rates,
    }
  })
  res.json(zonesWithRates)
})

router.post('/zones', authMiddleware, (req, res) => {
  const { name, countries = [] } = req.body
  if (!name) return res.status(400).json({ error: 'Zone name is required' })
  const result = db.prepare(`
    INSERT INTO shipping_zones (name, countries) VALUES (?, ?)
  `).run(name.trim(), JSON.stringify(countries))
  const zone = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ ...zone, countries: JSON.parse(zone.countries), rates: [] })
})

router.put('/zones/:id', authMiddleware, (req, res) => {
  const z = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(req.params.id)
  if (!z) return res.status(404).json({ error: 'Zone not found' })
  const { name = z.name, countries = JSON.parse(z.countries) } = req.body
  db.prepare('UPDATE shipping_zones SET name = ?, countries = ? WHERE id = ?')
    .run(name.trim(), JSON.stringify(countries), z.id)
  const updated = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(z.id)
  const rates = db.prepare('SELECT * FROM shipping_rates WHERE zone_id = ? ORDER BY id').all(z.id)
  res.json({ ...updated, countries: JSON.parse(updated.countries), rates })
})

router.delete('/zones/:id', authMiddleware, (req, res) => {
  const z = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(req.params.id)
  if (!z) return res.status(404).json({ error: 'Zone not found' })
  db.prepare('DELETE FROM shipping_zones WHERE id = ?').run(z.id) // cascades rates
  res.json({ ok: true })
})

// ─── Admin: Rates CRUD ────────────────────────────────────────────────────────

router.post('/zones/:zoneId/rates', authMiddleware, (req, res) => {
  const zone = db.prepare('SELECT id FROM shipping_zones WHERE id = ?').get(req.params.zoneId)
  if (!zone) return res.status(404).json({ error: 'Zone not found' })
  const { name = 'Standard Shipping', type = 'flat', rate = 0, min_order = 0, active = 1 } = req.body
  if (!['flat', 'free', 'threshold'].includes(type)) {
    return res.status(400).json({ error: 'type must be flat, free, or threshold' })
  }
  const result = db.prepare(`
    INSERT INTO shipping_rates (zone_id, name, type, rate, min_order, active) VALUES (?, ?, ?, ?, ?, ?)
  `).run(zone.id, name.trim(), type, parseFloat(rate) || 0, parseFloat(min_order) || 0, active ? 1 : 0)
  res.status(201).json(db.prepare('SELECT * FROM shipping_rates WHERE id = ?').get(result.lastInsertRowid))
})

router.put('/zones/:zoneId/rates/:rateId', authMiddleware, (req, res) => {
  const r = db.prepare('SELECT * FROM shipping_rates WHERE id = ? AND zone_id = ?').get(req.params.rateId, req.params.zoneId)
  if (!r) return res.status(404).json({ error: 'Rate not found' })
  const { name = r.name, type = r.type, rate = r.rate, min_order = r.min_order, active = r.active } = req.body
  db.prepare(`
    UPDATE shipping_rates SET name = ?, type = ?, rate = ?, min_order = ?, active = ? WHERE id = ?
  `).run(name.trim(), type, parseFloat(rate) || 0, parseFloat(min_order) || 0, active ? 1 : 0, r.id)
  res.json(db.prepare('SELECT * FROM shipping_rates WHERE id = ?').get(r.id))
})

router.delete('/zones/:zoneId/rates/:rateId', authMiddleware, (req, res) => {
  const r = db.prepare('SELECT * FROM shipping_rates WHERE id = ? AND zone_id = ?').get(req.params.rateId, req.params.zoneId)
  if (!r) return res.status(404).json({ error: 'Rate not found' })
  db.prepare('DELETE FROM shipping_rates WHERE id = ?').run(r.id)
  res.json({ ok: true })
})

export default router
