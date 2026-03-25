// Pygmy CMS — Quote Requests (B2B) API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'
import { sendMailTo } from '../email.js'

const router = Router()

function generateRef () {
  return 'QTE-' + Math.random().toString(36).substring(2, 10).toUpperCase()
}

// ─── Public: Submit quote request ────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    customer_name, customer_email, customer_phone = '', company_name = '',
    items = [], notes = '', customer_id
  } = req.body

  if (!customer_name?.trim()) return res.status(400).json({ error: 'Name is required' })
  if (!customer_email?.trim()) return res.status(400).json({ error: 'Email is required' })
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'At least one item is required' })

  const reference = generateRef()
  const itemsJson = JSON.stringify(items)

  db.prepare(`
    INSERT INTO quote_requests
      (reference, customer_name, customer_email, customer_phone, company_name, items, notes, customer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(reference, customer_name.trim(), customer_email.trim(), customer_phone, company_name, itemsJson, notes, customer_id || null)

  // Email admin notification
  const settings = db.prepare(`SELECT key, value FROM settings WHERE key IN ('site_name', 'notify_email', 'site_url')`).all()
  const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]))
  if (cfg.notify_email) {
    sendMailTo(cfg.notify_email, `New Quote Request ${reference} — ${cfg.site_name || 'Pygmy'}`, `
      <h2>New Quote Request</h2>
      <p><strong>Reference:</strong> ${reference}</p>
      <p><strong>From:</strong> ${customer_name} (${customer_email})</p>
      <p><strong>Company:</strong> ${company_name || '—'}</p>
      <p><strong>Items:</strong></p>
      <ul>${items.map(i => `<li>${i.product_name || i.product_id} × ${i.qty || 1}</li>`).join('')}</ul>
      <p><strong>Notes:</strong> ${notes || '—'}</p>
    `).catch(() => {})
  }

  res.json({ ok: true, reference })
})

// ─── Public: Check quote status by reference + email ─────────────────────────
router.post('/status', (req, res) => {
  const { reference, email } = req.body
  if (!reference || !email) return res.status(400).json({ error: 'reference and email required' })

  const quote = db.prepare(`
    SELECT id, reference, status, quoted_amount, valid_until, admin_notes, items, created_at, updated_at
    FROM quote_requests
    WHERE reference = ? AND customer_email = ?
  `).get(reference, email)

  if (!quote) return res.status(404).json({ error: 'Quote not found' })
  quote.items = JSON.parse(quote.items || '[]')
  res.json(quote)
})

// ─── Admin: List all quotes ───────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { q = '', status = '', limit = 50, offset = 0 } = req.query
  let where = 'WHERE 1=1'
  const params = []

  if (q) {
    where += ` AND (customer_name LIKE ? OR customer_email LIKE ? OR company_name LIKE ? OR reference LIKE ?)`
    const like = `%${q}%`
    params.push(like, like, like, like)
  }
  if (status) { where += ' AND status = ?'; params.push(status) }

  const quotes = db.prepare(`
    SELECT * FROM quote_requests ${where}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM quote_requests ${where}`).get(...params).cnt

  quotes.forEach(q => { q.items = JSON.parse(q.items || '[]') })
  res.json({ quotes, total })
})

// ─── Admin: Get single quote ──────────────────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const quote = db.prepare(`SELECT * FROM quote_requests WHERE id = ?`).get(req.params.id)
  if (!quote) return res.status(404).json({ error: 'Not found' })
  quote.items = JSON.parse(quote.items || '[]')
  res.json(quote)
})

// ─── Admin: Update quote (status, quoted_amount, admin_notes, valid_until) ───
router.put('/:id', authMiddleware, async (req, res) => {
  const { status, quoted_amount, admin_notes, valid_until } = req.body
  const quote = db.prepare(`SELECT * FROM quote_requests WHERE id = ?`).get(req.params.id)
  if (!quote) return res.status(404).json({ error: 'Not found' })

  const newStatus = status || quote.status
  const newAmount = quoted_amount !== undefined ? parseFloat(quoted_amount) : quote.quoted_amount
  const newNotes  = admin_notes  !== undefined ? admin_notes  : quote.admin_notes
  const newUntil  = valid_until  !== undefined ? valid_until  : quote.valid_until

  db.prepare(`
    UPDATE quote_requests
    SET status = ?, quoted_amount = ?, admin_notes = ?, valid_until = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, newAmount, newNotes, newUntil, req.params.id)

  // Notify customer when quote becomes "quoted" or "rejected"
  if ((newStatus === 'quoted' || newStatus === 'rejected') && newStatus !== quote.status) {
    const settings = db.prepare(`SELECT key, value FROM settings WHERE key IN ('site_name', 'site_url')`).all()
    const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]))
    const subject = newStatus === 'quoted'
      ? `Your Quote ${quote.reference} is Ready — ${cfg.site_name || 'Pygmy'}`
      : `Update on Your Quote ${quote.reference}`
    const body = newStatus === 'quoted' ? `
      <h2>Your Quote is Ready!</h2>
      <p>Dear ${quote.customer_name},</p>
      <p>We've prepared your quote <strong>${quote.reference}</strong>.</p>
      <p><strong>Quoted Amount: €${newAmount?.toFixed(2) || '—'}</strong></p>
      ${newUntil ? `<p>Valid until: ${newUntil}</p>` : ''}
      ${newNotes ? `<p>Notes: ${newNotes}</p>` : ''}
      <p>Contact us to proceed with your order.</p>
    ` : `
      <h2>Update on Your Quote Request</h2>
      <p>Dear ${quote.customer_name},</p>
      <p>Regarding quote <strong>${quote.reference}</strong>: ${newNotes || 'Unfortunately we are unable to fulfill this request at this time.'}</p>
    `
    sendMailTo(quote.customer_email, subject, body).catch(() => {})
  }

  logActivity(req.user?.id, req.user?.name, 'update', 'quote_request', req.params.id, quote.reference)
  res.json({ ok: true })
})

// ─── Admin: Delete quote ──────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM quote_requests WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// ─── Admin: Stats ─────────────────────────────────────────────────────────────
router.get('/stats/summary', authMiddleware, (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='quoted'  THEN 1 ELSE 0 END) as quoted,
      SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected,
      ROUND(SUM(CASE WHEN status='accepted' THEN quoted_amount ELSE 0 END), 2) as total_value
    FROM quote_requests
  `).get()
  res.json(stats)
})

export default router
