// Pygmy CMS — Returns & Refunds API (Phase 31)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

function parseReturn(row) {
  if (!row) return null
  return {
    ...row,
    items: (() => { try { return JSON.parse(row.items || '[]') } catch { return [] } })(),
  }
}

function getEmailCfg() {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN
    ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','site_name','site_url','shop_currency_symbol')
  `).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))
  return s
}

async function sendReturnEmail(slug, vars) {
  const tpl = db.prepare('SELECT * FROM email_templates WHERE slug = ? AND active = 1').get(slug)
  if (!tpl) return
  const cfg = getEmailCfg()
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) return
  if (!vars.to) return

  let subject = tpl.subject
  let html = tpl.html_body
  let text = tpl.text_body

  // Replace {{variable}} tokens
  Object.entries(vars).forEach(([k, v]) => {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g')
    subject = subject.replace(re, v ?? '')
    html    = html.replace(re, v ?? '')
    text    = text.replace(re, v ?? '')
  })

  // Remaining unreplaced tokens → empty string
  subject = subject.replace(/\{\{[^}]+\}\}/g, '')
  html    = html.replace(/\{\{[^}]+\}\}/g, '')
  text    = text.replace(/\{\{[^}]+\}\}/g, '')

  const siteName = cfg.site_name || 'Pygmy CMS'
  const accent = '#b0303a'

  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{margin:0;padding:0;background:#1a1a1e;font-family:'Segoe UI',Arial,sans-serif;color:#e2e2e8}
.wrap{max-width:600px;margin:2rem auto;background:#22232a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
.header{background:${accent};padding:1.5rem 2rem}
.header h1{margin:0;font-size:1.2rem;color:#fff;font-weight:700}
.body{padding:2rem;line-height:1.6;font-size:.92rem;color:#b0b0c0}
.body h2{color:#e2e2e8;margin:0 0 .75rem}
.body strong{color:#e2e2e8}
.footer{padding:1.25rem 2rem;border-top:1px solid rgba(255,255,255,.06);font-size:.78rem;color:#555;text-align:center}
a{color:hsl(355,70%,58%)}
</style></head>
<body><div class="wrap">
  <div class="header"><h1>${siteName}</h1></div>
  <div class="body">${html}</div>
  <div class="footer">&copy; ${new Date().getFullYear()} ${siteName}</div>
</div></body></html>`

  try {
    const nodemailer = (await import('nodemailer')).default
    const transport = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port) || 587,
      secure: parseInt(cfg.smtp_port) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    })
    await transport.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to: vars.to,
      subject,
      html: fullHtml,
      text,
    })
  } catch (err) {
    console.warn('📧 Return email failed (non-fatal):', err.message)
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────

router.get('/stats', authMiddleware, (req, res) => {
  const total   = db.prepare("SELECT COUNT(*) as n FROM order_returns").get().n
  const pending = db.prepare("SELECT COUNT(*) as n FROM order_returns WHERE status='pending'").get().n
  const approved  = db.prepare("SELECT COUNT(*) as n FROM order_returns WHERE status='approved'").get().n
  const refunded  = db.prepare("SELECT COUNT(*) as n FROM order_returns WHERE status='refunded'").get().n
  const rejected  = db.prepare("SELECT COUNT(*) as n FROM order_returns WHERE status='rejected'").get().n
  const totalRefunded = db.prepare("SELECT COALESCE(SUM(refund_amount),0) as v FROM order_returns WHERE status='refunded'").get().v
  res.json({ total, pending, approved, refunded, rejected, totalRefunded })
})

// ─── List ──────────────────────────────────────────────────────────────────

router.get('/', authMiddleware, (req, res) => {
  const { status, q, limit = 20, offset = 0 } = req.query
  let where = []
  let params = []
  if (status) { where.push('status = ?'); params.push(status) }
  if (q) {
    where.push('(customer_name LIKE ? OR customer_email LIKE ? OR order_number LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const rows = db.prepare(`SELECT * FROM order_returns ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), parseInt(offset))
  const total = db.prepare(`SELECT COUNT(*) as n FROM order_returns ${whereClause}`).get(...params).n
  res.json({ returns: rows.map(parseReturn), total })
})

// ─── Get single ────────────────────────────────────────────────────────────

router.get('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM order_returns WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(parseReturn(row))
})

// ─── Create return (customer-facing, no auth required) ────────────────────

router.post('/', (req, res) => {
  const { order_number, customer_email, reason, notes, items } = req.body
  if (!order_number || !customer_email) {
    return res.status(400).json({ error: 'order_number and customer_email are required' })
  }

  // Look up the order for customer_name
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ? AND customer_email = ? COLLATE NOCASE")
    .get(order_number, customer_email)

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO order_returns (order_id, order_number, customer_name, customer_email, reason, notes, items)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    order?.id || null,
    order_number,
    order?.customer_name || '',
    customer_email,
    reason || '',
    notes || '',
    JSON.stringify(items || [])
  )

  const ret = parseReturn(db.prepare('SELECT * FROM order_returns WHERE id = ?').get(lastInsertRowid))

  // Send confirmation email
  const cfg = getEmailCfg()
  sendReturnEmail('return_received', {
    to: customer_email,
    customer_name: ret.customer_name || customer_email,
    order_number,
    return_id: `#${ret.id}`,
    reason: reason || 'Not specified',
    contact_url: `${cfg.site_url || ''}/contact`,
  }).catch(() => {})

  res.status(201).json(ret)
})

// ─── Update return (admin) ──────────────────────────────────────────────────

router.put('/:id', authMiddleware, (req, res) => {
  const { status, refund_amount, refund_method, admin_notes, items } = req.body
  const existing = db.prepare('SELECT * FROM order_returns WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const prevStatus = existing.status
  db.prepare(`
    UPDATE order_returns
    SET status = COALESCE(?, status),
        refund_amount = COALESCE(?, refund_amount),
        refund_method = COALESCE(?, refund_method),
        admin_notes   = COALESCE(?, admin_notes),
        items         = COALESCE(?, items),
        updated_at    = datetime('now')
    WHERE id = ?
  `).run(
    status ?? null,
    refund_amount != null ? parseFloat(refund_amount) : null,
    refund_method ?? null,
    admin_notes ?? null,
    items ? JSON.stringify(items) : null,
    req.params.id
  )

  const updated = parseReturn(db.prepare('SELECT * FROM order_returns WHERE id = ?').get(req.params.id))
  const cfg = getEmailCfg()
  const sym = cfg.shop_currency_symbol || '€'

  // Send status-change emails
  if (status && status !== prevStatus) {
    if (status === 'approved' || status === 'refunded') {
      sendReturnEmail('return_approved', {
        to: updated.customer_email,
        customer_name: updated.customer_name || updated.customer_email,
        order_number: updated.order_number,
        refund_amount: `${sym}${Number(updated.refund_amount).toFixed(2)}`,
        refund_method: updated.refund_method === 'store_credit' ? 'Store Credit'
                     : updated.refund_method === 'manual' ? 'Manual Transfer'
                     : 'Original Payment Method',
        admin_notes: updated.admin_notes || '',
      }).catch(() => {})
    } else if (status === 'rejected') {
      sendReturnEmail('return_rejected', {
        to: updated.customer_email,
        customer_name: updated.customer_name || updated.customer_email,
        order_number: updated.order_number,
        admin_notes: updated.admin_notes || '',
        contact_url: `${cfg.site_url || ''}/contact`,
      }).catch(() => {})
    }
  }

  res.json(updated)
})

// ─── Delete ──────────────────────────────────────────────────────────────

router.delete('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT id FROM order_returns WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM order_returns WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
