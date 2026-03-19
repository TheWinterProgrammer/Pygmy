// Pygmy CMS — Custom Form Builder routes
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'
import nodemailer from 'nodemailer'

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTransporter () {
  const s = key => db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value || ''
  const host = s('smtp_host')
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port: parseInt(s('smtp_port')) || 587,
    secure: false,
    auth: { user: s('smtp_user'), pass: s('smtp_pass') },
  })
}

// ── Public: list active forms (minimal) ───────────────────────────────────────
router.get('/', (req, res) => {
  if (req.query.all === '1') {
    // Admin: return all forms with submission counts
    const forms = db.prepare(`
      SELECT f.*,
        (SELECT COUNT(*) FROM custom_form_submissions WHERE form_id = f.id) AS total_submissions,
        (SELECT COUNT(*) FROM custom_form_submissions WHERE form_id = f.id AND status = 'unread') AS unread_count
      FROM custom_forms f
      ORDER BY f.created_at DESC
    `).all()
    return res.json(forms)
  }
  // Public: only active forms, no submissions counts
  const forms = db.prepare(`
    SELECT id, name, slug, description, fields, success_message
    FROM custom_forms WHERE status = 'active'
    ORDER BY name
  `).all()
  res.json(forms)
})

// ── Public: get single form by slug ──────────────────────────────────────────
router.get('/:slug', (req, res) => {
  const form = db.prepare(`
    SELECT id, name, slug, description, fields, success_message
    FROM custom_forms
    WHERE slug = ? AND status = 'active'
  `).get(req.params.slug)
  if (!form) return res.status(404).json({ error: 'Form not found' })
  res.json(form)
})

// ── Admin: create form ────────────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { name, slug, description = '', fields = '[]', success_message = 'Thank you! Your message has been sent.', email_notify = '', status = 'active' } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' })

  try {
    const info = db.prepare(`
      INSERT INTO custom_forms (name, slug, description, fields, success_message, email_notify, status)
      VALUES (?,?,?,?,?,?,?)
    `).run(name, slug, description, typeof fields === 'string' ? fields : JSON.stringify(fields), success_message, email_notify, status)

    logActivity(req, 'created', 'form', info.lastInsertRowid, name)
    res.status(201).json({ id: info.lastInsertRowid })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already in use' })
    throw e
  }
})

// ── Admin: update form ────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const { name, slug, description, fields, success_message, email_notify, status } = req.body
  const existing = db.prepare('SELECT * FROM custom_forms WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Form not found' })

  const updated = {
    name: name ?? existing.name,
    slug: slug ?? existing.slug,
    description: description ?? existing.description,
    fields: fields !== undefined ? (typeof fields === 'string' ? fields : JSON.stringify(fields)) : existing.fields,
    success_message: success_message ?? existing.success_message,
    email_notify: email_notify ?? existing.email_notify,
    status: status ?? existing.status,
  }

  try {
    db.prepare(`
      UPDATE custom_forms
      SET name=?, slug=?, description=?, fields=?, success_message=?, email_notify=?, status=?, updated_at=datetime('now')
      WHERE id=?
    `).run(updated.name, updated.slug, updated.description, updated.fields, updated.success_message, updated.email_notify, updated.status, req.params.id)
    logActivity(req, 'updated', 'form', req.params.id, updated.name)
    res.json({ ok: true })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already in use' })
    throw e
  }
})

// ── Admin: delete form ────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const form = db.prepare('SELECT * FROM custom_forms WHERE id = ?').get(req.params.id)
  if (!form) return res.status(404).json({ error: 'Form not found' })
  db.prepare('DELETE FROM custom_forms WHERE id = ?').run(req.params.id)
  logActivity(req, 'deleted', 'form', req.params.id, form.name)
  res.json({ ok: true })
})

// ── Public: submit a form ─────────────────────────────────────────────────────
router.post('/:slug/submit', (req, res) => {
  const form = db.prepare(`
    SELECT * FROM custom_forms WHERE slug = ? AND status = 'active'
  `).get(req.params.slug)
  if (!form) return res.status(404).json({ error: 'Form not found' })

  const fields = JSON.parse(form.fields || '[]')
  const data = {}
  const errors = []

  // Validate + collect submitted values
  for (const field of fields) {
    if (!field.name) continue
    const val = req.body[field.name]
    if (field.required && (val === undefined || val === null || val === '')) {
      errors.push(`${field.label || field.name} is required`)
    } else {
      data[field.name] = val ?? ''
    }
  }

  if (errors.length > 0) return res.status(422).json({ errors })

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || ''
  db.prepare(`
    INSERT INTO custom_form_submissions (form_id, form_name, data, ip)
    VALUES (?,?,?,?)
  `).run(form.id, form.name, JSON.stringify(data), ip)

  // Email notification
  if (form.email_notify) {
    try {
      const transporter = getTransporter()
      const from = db.prepare("SELECT value FROM settings WHERE key='smtp_from'").get()?.value || form.email_notify
      if (transporter) {
        const dataHtml = Object.entries(data)
          .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:600">${k}</td><td style="padding:4px 8px">${v}</td></tr>`)
          .join('')
        transporter.sendMail({
          from,
          to: form.email_notify,
          subject: `New "${form.name}" form submission`,
          html: `<p>A new form submission was received.</p><table>${dataHtml}</table>`,
        }).catch(() => {})
      }
    } catch {}
  }

  res.json({ ok: true, message: form.success_message })
})

// ── Admin: list submissions for a form ────────────────────────────────────────
router.get('/:id/submissions', authMiddleware, (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query
  let where = 'form_id = ?'
  const params = [req.params.id]
  if (status) { where += ' AND status = ?'; params.push(status) }

  const total = db.prepare(`SELECT COUNT(*) as n FROM custom_form_submissions WHERE ${where}`).get(...params).n
  const rows = db.prepare(`
    SELECT * FROM custom_form_submissions WHERE ${where}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  res.json({ total, rows })
})

// ── Admin: update submission status ──────────────────────────────────────────
router.put('/:id/submissions/:subId', authMiddleware, (req, res) => {
  const { status } = req.body
  if (!['unread', 'read', 'archived'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
  db.prepare('UPDATE custom_form_submissions SET status = ? WHERE id = ? AND form_id = ?')
    .run(status, req.params.subId, req.params.id)
  res.json({ ok: true })
})

// ── Admin: delete submission ──────────────────────────────────────────────────
router.delete('/:id/submissions/:subId', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM custom_form_submissions WHERE id = ? AND form_id = ?')
    .run(req.params.subId, req.params.id)
  res.json({ ok: true })
})

export default router
