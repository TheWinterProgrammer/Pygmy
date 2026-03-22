// Pygmy CMS — Affiliates & Referral Program API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genCode(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${slug}${rand}`
}

function parseAffiliate(row) {
  if (!row) return null
  return {
    ...row,
    commission_rate: parseFloat(row.commission_rate) || 0,
  }
}

// ─── Admin: List affiliates ────────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { q, status } = req.query
  let sql = `
    SELECT a.*,
      (SELECT COUNT(*) FROM affiliate_referrals r WHERE r.affiliate_id = a.id) AS referral_count,
      (SELECT COALESCE(SUM(r.order_amount), 0) FROM affiliate_referrals r WHERE r.affiliate_id = a.id AND r.status != 'rejected') AS total_revenue,
      (SELECT COALESCE(SUM(r.commission_amount), 0) FROM affiliate_referrals r WHERE r.affiliate_id = a.id AND r.status = 'approved') AS earned_commission,
      (SELECT COALESCE(SUM(p.amount), 0) FROM affiliate_payouts p WHERE p.affiliate_id = a.id AND p.status = 'paid') AS total_paid
    FROM affiliates a
    WHERE 1=1`
  const params = []
  if (q) {
    sql += ` AND (a.name LIKE ? OR a.email LIKE ? OR a.code LIKE ?)`
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (status) { sql += ` AND a.status = ?`; params.push(status) }
  sql += ` ORDER BY a.created_at DESC`
  const rows = db.prepare(sql).all(...params)
  res.json(rows.map(parseAffiliate))
})

// ─── Admin: Get single affiliate with recent referrals ────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const affiliate = db.prepare('SELECT * FROM affiliates WHERE id = ?').get(req.params.id)
  if (!affiliate) return res.status(404).json({ error: 'Not found' })
  const referrals = db.prepare(`
    SELECT r.*, o.order_number FROM affiliate_referrals r
    LEFT JOIN orders o ON r.order_id = o.id
    WHERE r.affiliate_id = ?
    ORDER BY r.created_at DESC LIMIT 50
  `).all(req.params.id)
  const payouts = db.prepare(`
    SELECT * FROM affiliate_payouts WHERE affiliate_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(req.params.id)
  res.json({ ...parseAffiliate(affiliate), referrals, payouts })
})

// ─── Admin: Create affiliate ───────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { name, email, commission_rate = 10, notes = '', code } = req.body
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' })
  const finalCode = (code || genCode(name)).toUpperCase()
  const existing = db.prepare('SELECT id FROM affiliates WHERE code = ?').get(finalCode)
  if (existing) return res.status(409).json({ error: 'Affiliate code already exists' })
  const result = db.prepare(`
    INSERT INTO affiliates (name, email, code, commission_rate, notes, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(name, email, finalCode, commission_rate, notes)
  const created = db.prepare('SELECT * FROM affiliates WHERE id = ?').get(result.lastInsertRowid)
  logActivity(req.user.id, 'affiliate.created', `Affiliate created: ${name} (${finalCode})`)
  res.status(201).json(parseAffiliate(created))
})

// ─── Admin: Update affiliate ───────────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const { name, email, commission_rate, notes, status } = req.body
  const affiliate = db.prepare('SELECT * FROM affiliates WHERE id = ?').get(req.params.id)
  if (!affiliate) return res.status(404).json({ error: 'Not found' })
  db.prepare(`
    UPDATE affiliates SET
      name = ?, email = ?, commission_rate = ?, notes = ?, status = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? affiliate.name,
    email ?? affiliate.email,
    commission_rate ?? affiliate.commission_rate,
    notes ?? affiliate.notes,
    status ?? affiliate.status,
    req.params.id
  )
  res.json(parseAffiliate(db.prepare('SELECT * FROM affiliates WHERE id = ?').get(req.params.id)))
})

// ─── Admin: Delete affiliate ───────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const affiliate = db.prepare('SELECT * FROM affiliates WHERE id = ?').get(req.params.id)
  if (!affiliate) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM affiliates WHERE id = ?').run(req.params.id)
  logActivity(req.user.id, 'affiliate.deleted', `Affiliate deleted: ${affiliate.name}`)
  res.json({ ok: true })
})

// ─── Public: Validate referral code ───────────────────────────────────────────
router.get('/public/validate/:code', (req, res) => {
  const affiliate = db.prepare(`
    SELECT id, name, code FROM affiliates WHERE code = ? AND status = 'active'
  `).get(req.params.code.toUpperCase())
  if (!affiliate) return res.status(404).json({ valid: false })
  res.json({ valid: true, affiliate })
})

// ─── Admin: Stats ──────────────────────────────────────────────────────────────
router.get('/admin/stats', authMiddleware, (req, res) => {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM affiliates WHERE status = 'active') AS active_affiliates,
      (SELECT COUNT(*) FROM affiliate_referrals) AS total_referrals,
      (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_referrals WHERE status = 'approved') AS total_commissions,
      (SELECT COALESCE(SUM(amount), 0) FROM affiliate_payouts WHERE status = 'paid') AS total_paid
  `).get()
  res.json(stats)
})

// ─── Admin: Referrals list ─────────────────────────────────────────────────────
router.get('/admin/referrals', authMiddleware, (req, res) => {
  const { affiliate_id, status, limit = 50, offset = 0 } = req.query
  let sql = `
    SELECT r.*, a.name AS affiliate_name, a.code AS affiliate_code, o.order_number
    FROM affiliate_referrals r
    JOIN affiliates a ON r.affiliate_id = a.id
    LEFT JOIN orders o ON r.order_id = o.id
    WHERE 1=1`
  const params = []
  if (affiliate_id) { sql += ` AND r.affiliate_id = ?`; params.push(affiliate_id) }
  if (status) { sql += ` AND r.status = ?`; params.push(status) }
  sql += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
  params.push(parseInt(limit), parseInt(offset))
  res.json(db.prepare(sql).all(...params))
})

// ─── Admin: Update referral status ────────────────────────────────────────────
router.put('/admin/referrals/:id', authMiddleware, (req, res) => {
  const { status } = req.body
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  db.prepare(`UPDATE affiliate_referrals SET status = ? WHERE id = ?`).run(status, req.params.id)
  res.json({ ok: true })
})

// ─── Admin: Create payout ──────────────────────────────────────────────────────
router.post('/admin/payouts', authMiddleware, (req, res) => {
  const { affiliate_id, amount, method = 'manual', notes = '' } = req.body
  if (!affiliate_id || !amount) return res.status(400).json({ error: 'affiliate_id and amount required' })
  const result = db.prepare(`
    INSERT INTO affiliate_payouts (affiliate_id, amount, method, notes, status)
    VALUES (?, ?, ?, ?, 'paid')
  `).run(affiliate_id, amount, method, notes)
  logActivity(req.user.id, 'affiliate.payout', `Payout of ${amount} to affiliate ${affiliate_id}`)
  res.status(201).json({ id: result.lastInsertRowid, ok: true })
})

// ─── Internal: Record a referral (called by orders route) ─────────────────────
export function recordReferral(affiliateCode, orderId, orderAmount) {
  try {
    const affiliate = db.prepare(`SELECT * FROM affiliates WHERE code = ? AND status = 'active'`).get(affiliateCode?.toUpperCase())
    if (!affiliate) return
    // Check not already recorded
    const existing = db.prepare('SELECT id FROM affiliate_referrals WHERE order_id = ?').get(orderId)
    if (existing) return
    const commission = Math.round((orderAmount * affiliate.commission_rate / 100) * 100) / 100
    db.prepare(`
      INSERT INTO affiliate_referrals (affiliate_id, order_id, order_amount, commission_amount, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(affiliate.id, orderId, orderAmount, commission)
  } catch (e) {
    console.error('recordReferral error:', e.message)
  }
}

export default router
