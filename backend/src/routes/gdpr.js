// Pygmy CMS — GDPR Privacy Center API (Phase 69)
import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSetting (key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? ''
}

function getSiteName () {
  return getSetting('site_name') || 'Pygmy CMS'
}

// Build a full customer data export JSON
function buildCustomerExport (customerId) {
  const customer = db.prepare(
    'SELECT id, email, first_name, last_name, phone, created_at FROM customers WHERE id = ?'
  ).get(customerId)
  if (!customer) return null

  const addresses = db.prepare('SELECT * FROM customer_addresses WHERE customer_id = ?').all(customerId)

  const orders = db.prepare(
    'SELECT order_number, status, total, created_at FROM orders WHERE customer_id = ?'
  ).all(customerId)

  const reviews = db.prepare(
    'SELECT * FROM reviews WHERE customer_email = ?'
  ).all(customer.email)

  const loyaltyTx = db.prepare(
    'SELECT type, points, note, created_at FROM loyalty_transactions WHERE customer_id = ?'
  ).all(customerId)

  const wishlists = db.prepare(
    `SELECT p.name, p.slug FROM wishlists w JOIN products p ON p.id = w.product_id WHERE w.customer_id = ?`
  ).all(customerId)

  return {
    exported_at: new Date().toISOString(),
    profile: customer,
    addresses,
    orders,
    reviews,
    loyalty_transactions: loyaltyTx,
    wishlist: wishlists,
  }
}

// ─── Public: submit a privacy request ────────────────────────────────────────

// POST /api/gdpr/request — customer submits a data request
router.post('/request', (req, res) => {
  const { type = 'export', email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required' })
  if (!['export', 'delete'].includes(type)) return res.status(400).json({ error: 'Invalid type' })

  const gdprEnabled = getSetting(`gdpr_${type === 'export' ? 'data_export' : 'deletion'}_enabled`)
  if (gdprEnabled === '0') return res.status(403).json({ error: 'This request type is not enabled' })

  // Rate limit: max 2 pending requests per email
  const pending = db.prepare(
    `SELECT COUNT(*) as n FROM privacy_requests WHERE email = ? AND status = 'pending'`
  ).get(email).n
  if (pending >= 2) return res.status(429).json({ error: 'Too many pending requests for this email' })

  const customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email.toLowerCase())
  const token = crypto.randomBytes(32).toString('hex')

  const result = db.prepare(`
    INSERT INTO privacy_requests (type, customer_id, email, status, token)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(type, customer?.id ?? null, email.toLowerCase(), token)

  // Notify DPO / admin
  const dpoEmail = getSetting('gdpr_dpo_email') || getSetting('notify_email')
  if (dpoEmail) {
    const label = type === 'export' ? 'Data Export' : 'Account Deletion'
    sendMailTo({
      to: dpoEmail,
      subject: `[${getSiteName()}] New GDPR ${label} Request`,
      html: `<p>A new GDPR <strong>${label}</strong> request was submitted for <strong>${email}</strong>.</p>
             <p>Request ID: <strong>${result.lastInsertRowid}</strong></p>
             <p>Please process this request from your admin panel within 30 days.</p>`
    }).catch(() => {})
  }

  res.json({ ok: true, id: result.lastInsertRowid, message: `Your ${type} request has been submitted. We will process it within 30 days.` })
})

// GET /api/gdpr/download/:token — download data export (token-based, no login required)
router.get('/download/:token', (req, res) => {
  const req_ = db.prepare(
    `SELECT * FROM privacy_requests WHERE token = ? AND type = 'export' AND status = 'completed'`
  ).get(req.params.token)
  if (!req_) return res.status(404).json({ error: 'Export not found or not ready' })

  if (!req_.customer_id) return res.status(404).json({ error: 'Customer not found' })

  const data = buildCustomerExport(req_.customer_id)
  if (!data) return res.status(404).json({ error: 'Customer data not found' })

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="data-export-${req_.email}.json"`)
  res.send(JSON.stringify(data, null, 2))
})

// GET /api/gdpr/config — public widget config
router.get('/config', (req, res) => {
  res.json({
    data_export_enabled: getSetting('gdpr_data_export_enabled') !== '0',
    deletion_enabled: getSetting('gdpr_deletion_enabled') !== '0',
    title: getSetting('gdpr_privacy_page_title') || 'Your Privacy',
    subtitle: getSetting('gdpr_privacy_page_subtitle') || 'Manage your personal data',
    dpo_email: getSetting('gdpr_dpo_email'),
  })
})

// ─── Admin: manage privacy requests ──────────────────────────────────────────

// GET /api/gdpr/requests — list all requests
router.get('/requests', authMiddleware, (req, res) => {
  const { status, type, q, limit = 50, offset = 0 } = req.query
  let sql = 'SELECT * FROM privacy_requests WHERE 1=1'
  const params = []

  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (type)   { sql += ' AND type = ?';   params.push(type) }
  if (q)      { sql += ' AND email LIKE ?'; params.push(`%${q}%`) }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const rows = db.prepare(sql).all(...params)
  const total = db.prepare(`SELECT COUNT(*) as n FROM privacy_requests WHERE 1=1${status ? ' AND status=?' : ''}${type ? ' AND type=?' : ''}${q ? ' AND email LIKE ?' : ''}`).get(...params.slice(0, -2)).n
  res.json({ requests: rows, total })
})

// GET /api/gdpr/requests/stats — summary counts
router.get('/requests/stats', authMiddleware, (req, res) => {
  const total    = db.prepare(`SELECT COUNT(*) as n FROM privacy_requests`).get().n
  const pending  = db.prepare(`SELECT COUNT(*) as n FROM privacy_requests WHERE status='pending'`).get().n
  const completed = db.prepare(`SELECT COUNT(*) as n FROM privacy_requests WHERE status='completed'`).get().n
  const rejected  = db.prepare(`SELECT COUNT(*) as n FROM privacy_requests WHERE status='rejected'`).get().n
  const exports   = db.prepare(`SELECT COUNT(*) as n FROM privacy_requests WHERE type='export'`).get().n
  const deletions = db.prepare(`SELECT COUNT(*) as n FROM privacy_requests WHERE type='delete'`).get().n
  res.json({ total, pending, completed, rejected, exports, deletions })
})

// PUT /api/gdpr/requests/:id — update request (admin processes it)
router.put('/requests/:id', authMiddleware, async (req, res) => {
  const { status, admin_notes = '' } = req.body
  const req_ = db.prepare('SELECT * FROM privacy_requests WHERE id = ?').get(req.params.id)
  if (!req_) return res.status(404).json({ error: 'Not found' })

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE privacy_requests
    SET status = ?, admin_notes = ?, updated_at = ?,
        completed_at = CASE WHEN ? IN ('completed','rejected') THEN ? ELSE completed_at END
    WHERE id = ?
  `).run(status, admin_notes, now, status, now, req_.id)

  // If completing an export request, generate the download token email
  if (status === 'completed' && req_.type === 'export' && req_.customer_id) {
    const downloadUrl = `${getSetting('site_url') || 'http://localhost:5174'}/privacy/download/${req_.token}`
    await sendMailTo({
      to: req_.email,
      subject: `[${getSiteName()}] Your Data Export is Ready`,
      html: `<p>Hello,</p>
             <p>Your personal data export has been prepared. You can download it by clicking the link below:</p>
             <p><a href="${downloadUrl}" style="background:#dc3f55;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Download My Data</a></p>
             <p>This link contains all personal data we hold about you, including your profile, orders, and preferences.</p>
             <p>The <strong>${getSiteName()}</strong> team</p>`
    }).catch(() => {})
  }

  // If completing a deletion request, anonymise the customer data
  if (status === 'completed' && req_.type === 'delete' && req_.customer_id) {
    const anon = `deleted_${req_.customer_id}_${Date.now()}`
    db.prepare(`
      UPDATE customers
      SET email = ?, first_name = 'Deleted', last_name = 'User',
          phone = '', password = '', active = 0
      WHERE id = ?
    `).run(`${anon}@deleted.local`, req_.customer_id)

    // Remove addresses
    db.prepare('DELETE FROM customer_addresses WHERE customer_id = ?').run(req_.customer_id)

    await sendMailTo({
      to: req_.email,
      subject: `[${getSiteName()}] Your Account Has Been Deleted`,
      html: `<p>Hello,</p>
             <p>As requested, your personal data has been removed from <strong>${getSiteName()}</strong>.</p>
             <p>Your order history has been anonymised and retained for legal/accounting purposes.</p>
             <p>Thank you for using our platform.</p>
             <p>The <strong>${getSiteName()}</strong> team</p>`
    }).catch(() => {})
  }

  const updated = db.prepare('SELECT * FROM privacy_requests WHERE id = ?').get(req_.id)
  res.json(updated)
})

// DELETE /api/gdpr/requests/:id — delete request record
router.delete('/requests/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM privacy_requests WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
