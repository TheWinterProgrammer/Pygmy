// Pygmy CMS — Email Template Manager API (Phase 31)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

function parseTpl(row) {
  if (!row) return null
  return {
    ...row,
    variables: (() => { try { return JSON.parse(row.variables || '[]') } catch { return [] } })(),
  }
}

// ─── List ──────────────────────────────────────────────────────────────────

router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM email_templates ORDER BY is_system DESC, name ASC').all()
  res.json(rows.map(parseTpl))
})

// ─── Get single ────────────────────────────────────────────────────────────

router.get('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(parseTpl(row))
})

// ─── Create (custom templates only) ───────────────────────────────────────

router.post('/', authMiddleware, (req, res) => {
  const { name, slug, subject, html_body, text_body, variables } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' })

  const exists = db.prepare('SELECT id FROM email_templates WHERE slug = ?').get(slug)
  if (exists) return res.status(400).json({ error: 'Slug already in use' })

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO email_templates (name, slug, subject, html_body, text_body, variables, is_system)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(
    name,
    slug,
    subject || '',
    html_body || '',
    text_body || '',
    JSON.stringify(variables || [])
  )
  res.status(201).json(parseTpl(db.prepare('SELECT * FROM email_templates WHERE id = ?').get(lastInsertRowid)))
})

// ─── Update ────────────────────────────────────────────────────────────────

router.put('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })

  const { name, subject, html_body, text_body, variables, active } = req.body
  db.prepare(`
    UPDATE email_templates
    SET name      = COALESCE(?, name),
        subject   = COALESCE(?, subject),
        html_body = COALESCE(?, html_body),
        text_body = COALESCE(?, text_body),
        variables = COALESCE(?, variables),
        active    = COALESCE(?, active),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? null,
    subject ?? null,
    html_body ?? null,
    text_body ?? null,
    variables ? JSON.stringify(variables) : null,
    active != null ? (active ? 1 : 0) : null,
    req.params.id
  )
  res.json(parseTpl(db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id)))
})

// ─── Delete (custom only) ──────────────────────────────────────────────────

router.delete('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.is_system) return res.status(403).json({ error: 'Cannot delete system templates' })
  db.prepare('DELETE FROM email_templates WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Preview endpoint ──────────────────────────────────────────────────────

router.post('/:id/preview', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })

  const vars = req.body.vars || {}
  let subject = row.subject
  let html    = row.html_body
  let text    = row.text_body

  Object.entries(vars).forEach(([k, v]) => {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g')
    subject = subject.replace(re, v)
    html    = html.replace(re, v)
    text    = text.replace(re, v)
  })

  // Highlight remaining tokens in preview
  html = html.replace(/\{\{([^}]+)\}\}/g, '<mark style="background:hsl(43,90%,50%);color:#222;padding:.1em .3em;border-radius:3px">{{$1}}</mark>')

  res.json({ subject, html, text })
})

// ─── Send test ─────────────────────────────────────────────────────────────

router.post('/:id/test', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })

  const { to } = req.body
  if (!to) return res.status(400).json({ error: 'to is required' })

  const cfg = db.prepare(`SELECT key, value FROM settings WHERE key IN ('smtp_host','smtp_user','smtp_pass','smtp_port','smtp_from','site_name')`).all()
  const s = {}
  cfg.forEach(r => (s[r.key] = r.value))
  if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) {
    return res.status(400).json({ error: 'SMTP not configured' })
  }

  // Replace tokens with sample data
  const samples = {
    customer_name: 'John Doe',
    order_number: 'ORD-260101-0001',
    return_id: '#42',
    reason: 'Item was damaged',
    refund_amount: '€29.99',
    refund_method: 'Original Payment Method',
    admin_notes: 'Your refund has been processed.',
    status_message: 'Your order is now being processed.',
    status_label: 'Processing',
    total: '€99.99',
    items_table: '<p><em>[Order items table would appear here]</em></p>',
    items_text: 'Product A × 2 — €49.99',
    totals_section: '<p><strong>Total: €99.99</strong></p>',
    shipping_section: '',
    downloads_section: '',
    order_notes: '',
    tracking_section: '',
    tracking_text: '',
    shipping_address: '123 Main St, Berlin, DE',
    contact_url: '#',
    site_name: s.site_name || 'Pygmy CMS',
  }

  let subject = row.subject
  let html    = row.html_body
  let text    = row.text_body

  Object.entries(samples).forEach(([k, v]) => {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g')
    subject = subject.replace(re, v)
    html    = html.replace(re, v)
    text    = text.replace(re, v)
  })
  subject = subject.replace(/\{\{[^}]+\}\}/g, '[variable]')
  html    = html.replace(/\{\{[^}]+\}\}/g, '[variable]')
  text    = text.replace(/\{\{[^}]+\}\}/g, '[variable]')

  const siteName = s.site_name || 'Pygmy CMS'
  const accent = '#b0303a'
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
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

  sendMailTo({ to, subject: `[TEST] ${subject}`, html: fullHtml, text })
    .then(() => res.json({ ok: true }))
    .catch(err => res.status(500).json({ error: err.message }))
})

// ─── Reset system template to default ─────────────────────────────────────

router.post('/:id/reset', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (!row.is_system) return res.status(400).json({ error: 'Only system templates can be reset' })
  // Re-run the seed (it's idempotent via INSERT OR IGNORE pattern — just delete and re-seed)
  res.json({ message: 'To reset, delete and re-run backend seed. Current template returned.', template: parseTpl(row) })
})

export default router
