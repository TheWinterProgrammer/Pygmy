import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ── Public: get active charity campaign ───────────────────────────────────────
router.get('/active', (req, res) => {
  const enabled = db.prepare(`SELECT value FROM settings WHERE key = 'charity_enabled'`).get()
  if (!enabled || enabled.value !== '1') return res.json(null)

  const campaign = db.prepare(`
    SELECT * FROM charity_campaigns WHERE active = 1 ORDER BY id DESC LIMIT 1
  `).get()
  if (!campaign) return res.json(null)

  campaign.fixed_amounts = JSON.parse(campaign.fixed_amounts || '[]')
  res.json(campaign)
})

// ── Admin: list campaigns ─────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const campaigns = db.prepare(`SELECT * FROM charity_campaigns ORDER BY id DESC`).all()
  campaigns.forEach(c => { c.fixed_amounts = JSON.parse(c.fixed_amounts || '[]') })
  res.json(campaigns)
})

// ── Admin: stats ──────────────────────────────────────────────────────────────
router.get('/stats', auth, (req, res) => {
  const totals = db.prepare(`
    SELECT COUNT(*) AS total_campaigns,
           SUM(total_raised) AS total_raised,
           SUM(donation_count) AS total_donations
    FROM charity_campaigns
  `).get()

  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month,
           SUM(amount) AS total,
           COUNT(*) AS count
    FROM charity_donations
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `).all()

  res.json({ ...totals, monthly })
})

// ── Admin: create campaign ────────────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  const { name, description, logo, mode, fixed_amounts, active } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const result = db.prepare(`
    INSERT INTO charity_campaigns (name, description, logo, mode, fixed_amounts, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, description || '', logo || null, mode || 'roundup',
         JSON.stringify(fixed_amounts || [1, 2, 5]), active != null ? (active ? 1 : 0) : 1)
  res.json({ id: result.lastInsertRowid })
})

// ── Admin: update campaign ────────────────────────────────────────────────────
router.put('/:id', auth, (req, res) => {
  const { name, description, logo, mode, fixed_amounts, active } = req.body
  db.prepare(`
    UPDATE charity_campaigns SET name=?, description=?, logo=?, mode=?, fixed_amounts=?,
      active=?, updated_at=datetime('now') WHERE id=?
  `).run(name, description || '', logo || null, mode || 'roundup',
         JSON.stringify(fixed_amounts || [1, 2, 5]), active ? 1 : 0, req.params.id)
  res.json({ ok: true })
})

// ── Admin: delete campaign ────────────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  db.prepare(`DELETE FROM charity_campaigns WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// ── Admin: donations list for a campaign ─────────────────────────────────────
router.get('/:id/donations', auth, (req, res) => {
  const { limit = 50, offset = 0 } = req.query
  const rows = db.prepare(`
    SELECT * FROM charity_donations WHERE campaign_id = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, parseInt(limit), parseInt(offset))
  const count = db.prepare(`SELECT COUNT(*) AS n FROM charity_donations WHERE campaign_id = ?`).get(req.params.id)
  res.json({ donations: rows, total: count.n })
})

export default router
