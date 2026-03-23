// Pygmy CMS — Bulk Coupon Campaigns (Phase 46)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

/**
 * Generate a random coupon code with a given prefix and length.
 */
function genCode(prefix, len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = prefix ? prefix.toUpperCase() + '-' : ''
  for (let i = 0; i < len; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function parseCampaign(c) {
  if (!c) return null
  return { ...c, product_ids: safeJSON(c.product_ids, []), category_ids: safeJSON(c.category_ids, []) }
}
function safeJSON(v, fb) { try { return JSON.parse(v || 'null') ?? fb } catch { return fb } }

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns CRUD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM coupons WHERE campaign_id = c.id) as total_codes,
      (SELECT COUNT(*) FROM coupons WHERE campaign_id = c.id AND used_count > 0) as used_codes
    FROM coupon_campaigns c ORDER BY c.created_at DESC
  `).all()
  res.json(rows.map(parseCampaign))
})

router.post('/', auth, (req, res) => {
  const {
    name, description,
    discount_type = 'percentage', discount_value = 10,
    expires_at, min_order_amount = 0, max_uses_per_code = 1,
    prefix = '', code_count = 50, code_length = 8,
    product_ids = [], category_ids = [],
  } = req.body

  if (!name) return res.status(400).json({ error: 'name required' })
  if (code_count < 1 || code_count > 5000) return res.status(400).json({ error: 'code_count must be 1–5000' })

  const r = db.prepare(`
    INSERT INTO coupon_campaigns
      (name, description, discount_type, discount_value, expires_at, min_order_amount, max_uses_per_code, prefix, code_count, code_length, product_ids, category_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description || '', discount_type, discount_value, expires_at || null, min_order_amount, max_uses_per_code, prefix, code_count, code_length, JSON.stringify(product_ids), JSON.stringify(category_ids))

  const campaignId = r.lastInsertRowid

  // Generate bulk coupon codes
  const existingCodes = new Set(db.prepare('SELECT code FROM coupons').all().map(c => c.code))
  const ins = db.prepare(`
    INSERT INTO coupons (code, type, value, expires_at, min_order_amount, max_uses, max_uses_per_customer, product_ids, category_ids, active, campaign_id)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?)
  `)

  let generated = 0
  let attempts = 0
  while (generated < code_count && attempts < code_count * 10) {
    attempts++
    const code = genCode(prefix, code_length)
    if (existingCodes.has(code)) continue
    existingCodes.add(code)
    ins.run(code, discount_type, discount_value, expires_at || null, min_order_amount, max_uses_per_code, JSON.stringify(product_ids), JSON.stringify(category_ids), campaignId)
    generated++
  }

  db.prepare('UPDATE coupon_campaigns SET codes_generated = ? WHERE id = ?').run(generated, campaignId)

  res.status(201).json({ ...parseCampaign(db.prepare('SELECT * FROM coupon_campaigns WHERE id = ?').get(campaignId)), generated })
})

router.put('/:id', auth, (req, res) => {
  const c = db.prepare('SELECT id FROM coupon_campaigns WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Campaign not found' })

  const { name, description, expires_at, active } = req.body
  db.prepare(`UPDATE coupon_campaigns SET name=COALESCE(?,name), description=COALESCE(?,description), expires_at=?, active=COALESCE(?,active), updated_at=datetime('now') WHERE id=?`)
    .run(name || null, description || null, expires_at || null, active != null ? (active ? 1 : 0) : null, req.params.id)

  // Optionally update expiry on all child coupons too
  if (expires_at !== undefined) {
    db.prepare('UPDATE coupons SET expires_at = ? WHERE campaign_id = ?').run(expires_at || null, req.params.id)
  }

  res.json(parseCampaign(db.prepare('SELECT * FROM coupon_campaigns WHERE id = ?').get(req.params.id)))
})

router.delete('/:id', auth, (req, res) => {
  const c = db.prepare('SELECT id FROM coupon_campaigns WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'Campaign not found' })
  // Cascade delete coupons for this campaign
  db.prepare('DELETE FROM coupons WHERE campaign_id = ? AND used_count = 0').run(req.params.id)
  db.prepare('DELETE FROM coupon_campaigns WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// List codes for a campaign
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/codes', auth, (req, res) => {
  const { q, used, limit = 200, offset = 0 } = req.query
  let where = 'WHERE campaign_id = ?'
  const params = [req.params.id]
  if (q) { where += ' AND code LIKE ?'; params.push(`%${q}%`) }
  if (used === '1') { where += ' AND used_count > 0' }
  if (used === '0') { where += ' AND used_count = 0' }

  const total = db.prepare(`SELECT COUNT(*) as n FROM coupons ${where}`).get(...params).n
  const codes = db.prepare(`SELECT id, code, used_count, active, expires_at FROM coupons ${where} ORDER BY code LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset))
  res.json({ codes, total })
})

// Export CSV
router.get('/:id/export', auth, (req, res) => {
  const campaign = db.prepare('SELECT * FROM coupon_campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  const codes = db.prepare('SELECT code, used_count, active FROM coupons WHERE campaign_id = ? ORDER BY code').all(req.params.id)
  const lines = ['code,discount_type,discount_value,used,active']
  for (const c of codes) {
    lines.push(`${c.code},${campaign.discount_type},${campaign.discount_value},${c.used_count > 0 ? 'yes' : 'no'},${c.active ? 'yes' : 'no'}`)
  }

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.id}-codes.csv"`)
  res.send(lines.join('\n'))
})

// Stats for a campaign
router.get('/:id/stats', auth, (req, res) => {
  const campaign = db.prepare('SELECT * FROM coupon_campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  const total   = db.prepare('SELECT COUNT(*) as n FROM coupons WHERE campaign_id = ?').get(req.params.id).n
  const used    = db.prepare('SELECT COUNT(*) as n FROM coupons WHERE campaign_id = ? AND used_count > 0').get(req.params.id).n
  const unused  = total - used
  const revenue = db.prepare(`
    SELECT COALESCE(SUM(o.total),0) as rev FROM orders o
    JOIN coupons cp ON cp.code = o.coupon_code
    WHERE cp.campaign_id = ?
  `).get(req.params.id).rev
  const discount_given = db.prepare(`
    SELECT COALESCE(SUM(o.discount_amount),0) as disc FROM orders o
    JOIN coupons cp ON cp.code = o.coupon_code
    WHERE cp.campaign_id = ?
  `).get(req.params.id).disc

  res.json({ total, used, unused, revenue, discount_given, campaign: parseCampaign(campaign) })
})

export default router
