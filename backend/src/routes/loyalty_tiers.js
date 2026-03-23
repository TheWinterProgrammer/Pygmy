// Pygmy CMS — Loyalty Tiers API (Phase 42)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const r = Router()

function parseTier(row) {
  if (!row) return null
  return { ...row, perks: (() => { try { return JSON.parse(row.perks || '[]') } catch { return [] } })() }
}

// ── GET /api/loyalty-tiers — List all tiers ───────────────────────────────────
r.get('/', (req, res) => {
  const tiers = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM customers WHERE loyalty_tier_id = t.id) as member_count
    FROM loyalty_tiers t
    ORDER BY t.sort_order ASC, t.min_points ASC
  `).all().map(parseTier)
  res.json(tiers)
})

// ── POST /api/loyalty-tiers — Create tier ────────────────────────────────────
r.post('/', auth, (req, res) => {
  const { name, slug, min_points = 0, earn_multiplier = 1.0, color = '#888888', icon = '⭐', perks = [], sort_order = 0, active = 1 } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' })
  try {
    const result = db.prepare(`
      INSERT INTO loyalty_tiers (name, slug, min_points, earn_multiplier, color, icon, perks, sort_order, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, slug, min_points, earn_multiplier, color, icon, JSON.stringify(perks), sort_order, active ? 1 : 0)
    res.json(parseTier(db.prepare('SELECT * FROM loyalty_tiers WHERE id = ?').get(result.lastInsertRowid)))
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Slug must be unique' : e.message })
  }
})

// ── PUT /api/loyalty-tiers/:id — Update tier ─────────────────────────────────
r.put('/:id', auth, (req, res) => {
  const tier = db.prepare('SELECT * FROM loyalty_tiers WHERE id = ?').get(req.params.id)
  if (!tier) return res.status(404).json({ error: 'Not found' })
  const { name, slug, min_points, earn_multiplier, color, icon, perks, sort_order, active } = req.body
  try {
    db.prepare(`
      UPDATE loyalty_tiers SET
        name            = COALESCE(?, name),
        slug            = COALESCE(?, slug),
        min_points      = COALESCE(?, min_points),
        earn_multiplier = COALESCE(?, earn_multiplier),
        color           = COALESCE(?, color),
        icon            = COALESCE(?, icon),
        perks           = COALESCE(?, perks),
        sort_order      = COALESCE(?, sort_order),
        active          = COALESCE(?, active)
      WHERE id = ?
    `).run(name, slug, min_points, earn_multiplier, color, icon,
           perks !== undefined ? JSON.stringify(perks) : null,
           sort_order, active !== undefined ? (active ? 1 : 0) : null,
           req.params.id)
    res.json(parseTier(db.prepare('SELECT * FROM loyalty_tiers WHERE id = ?').get(req.params.id)))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ── DELETE /api/loyalty-tiers/:id ────────────────────────────────────────────
r.delete('/:id', auth, (req, res) => {
  db.prepare('UPDATE customers SET loyalty_tier_id = NULL WHERE loyalty_tier_id = ?').run(req.params.id)
  db.prepare('DELETE FROM loyalty_tiers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── POST /api/loyalty-tiers/recalculate — Recalculate all customer tiers ─────
r.post('/recalculate', auth, (req, res) => {
  const tiers = db.prepare('SELECT * FROM loyalty_tiers WHERE active = 1 ORDER BY min_points DESC').all()
  const customers = db.prepare('SELECT id, points_balance FROM customers').all()
  let updated = 0
  for (const customer of customers) {
    const tier = tiers.find(t => customer.points_balance >= t.min_points) || null
    const tierId = tier?.id || null
    const current = db.prepare('SELECT loyalty_tier_id FROM customers WHERE id = ?').get(customer.id)
    if (current?.loyalty_tier_id !== tierId) {
      db.prepare('UPDATE customers SET loyalty_tier_id = ?, loyalty_tier_updated_at = datetime("now") WHERE id = ?').run(tierId, customer.id)
      updated++
    }
  }
  res.json({ ok: true, updated })
})

// ── GET /api/loyalty-tiers/customer/:id — Get tier info for a customer ────────
r.get('/customer/:id', auth, (req, res) => {
  const customer = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.email, c.points_balance, c.loyalty_tier_id,
           t.name as tier_name, t.slug as tier_slug, t.color as tier_color,
           t.icon as tier_icon, t.earn_multiplier, t.perks as tier_perks,
           t.min_points as tier_min_points
    FROM customers c
    LEFT JOIN loyalty_tiers t ON t.id = c.loyalty_tier_id
    WHERE c.id = ?
  `).get(req.params.id)
  if (!customer) return res.status(404).json({ error: 'Not found' })

  // Find next tier
  const nextTier = db.prepare(`
    SELECT * FROM loyalty_tiers
    WHERE min_points > ? AND active = 1
    ORDER BY min_points ASC LIMIT 1
  `).get(customer.points_balance || 0)

  const perks = (() => { try { return JSON.parse(customer.tier_perks || '[]') } catch { return [] } })()
  const nextPerks = nextTier ? (() => { try { return JSON.parse(nextTier.perks || '[]') } catch { return [] } })() : null

  res.json({
    ...customer,
    tier_perks: perks,
    next_tier: nextTier ? { ...nextTier, perks: nextPerks, points_needed: nextTier.min_points - (customer.points_balance || 0) } : null,
  })
})

export default r
