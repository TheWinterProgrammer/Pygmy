// Pygmy CMS — Scheduled Email Reports
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

function getSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN ('site_name','site_url','shop_currency_symbol','notify_email')`).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))
  return s
}

function buildReportHtml(reportTypes, settings) {
  const symbol = settings.shop_currency_symbol || '€'
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const sections = []

  if (reportTypes.includes('orders')) {
    const stats = db.prepare(`
      SELECT COUNT(*) AS total, SUM(total) AS revenue,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
      FROM orders WHERE created_at >= ?
    `).get(since)
    sections.push(`
      <h3 style="color:#e05560;margin:0 0 10px">🛒 Orders (Last 7 Days)</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1)">Total Orders</td><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1);font-weight:bold">${stats.total || 0}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1)">Revenue</td><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1);font-weight:bold">${symbol}${(stats.revenue || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1)">Pending</td><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1)">${stats.pending || 0}</td></tr>
        <tr><td style="padding:8px">Completed</td><td style="padding:8px">${stats.completed || 0}</td></tr>
      </table>
    `)
  }

  if (reportTypes.includes('revenue')) {
    const daily = db.prepare(`
      SELECT date(created_at) AS day, SUM(total) AS revenue, COUNT(*) AS orders
      FROM orders WHERE created_at >= ? AND status != 'cancelled'
      GROUP BY day ORDER BY day ASC
    `).all(since)
    const rows = daily.map(d => `<tr><td style="padding:6px 8px">${d.day}</td><td style="padding:6px 8px">${d.orders}</td><td style="padding:6px 8px;font-weight:bold">${symbol}${(d.revenue||0).toFixed(2)}</td></tr>`).join('')
    sections.push(`
      <h3 style="color:#e05560;margin:0 0 10px">💰 Daily Revenue (Last 7 Days)</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:rgba(255,255,255,0.05)"><th style="padding:6px 8px;text-align:left">Date</th><th style="padding:6px 8px;text-align:left">Orders</th><th style="padding:6px 8px;text-align:left">Revenue</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" style="padding:8px;color:#888">No data</td></tr>'}</tbody>
      </table>
    `)
  }

  if (reportTypes.includes('customers')) {
    const stats = db.prepare(`
      SELECT COUNT(*) AS new_customers FROM customers WHERE created_at >= ?
    `).get(since)
    const top = db.prepare(`
      SELECT c.first_name || ' ' || c.last_name AS name, c.email, COUNT(o.id) AS orders, SUM(o.total) AS spent
      FROM customers c
      JOIN orders o ON o.customer_id = c.id
      WHERE o.created_at >= ?
      GROUP BY c.id ORDER BY spent DESC LIMIT 5
    `).all(since)
    const rows = top.map(r => `<tr><td style="padding:6px 8px">${r.name || r.email}</td><td style="padding:6px 8px">${r.orders}</td><td style="padding:6px 8px">${symbol}${(r.spent||0).toFixed(2)}</td></tr>`).join('')
    sections.push(`
      <h3 style="color:#e05560;margin:0 0 10px">👥 Customers (Last 7 Days)</h3>
      <p style="margin:0 0 10px;color:#ccc">New customers: <strong>${stats.new_customers}</strong></p>
      ${top.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:rgba(255,255,255,0.05)"><th style="padding:6px 8px;text-align:left">Customer</th><th style="padding:6px 8px;text-align:left">Orders</th><th style="padding:6px 8px;text-align:left">Spent</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : ''}
    `)
  }

  if (reportTypes.includes('products')) {
    const top = db.prepare(`
      SELECT
        json_extract(item.value, '$.name') AS name,
        SUM(json_extract(item.value, '$.qty')) AS qty_sold,
        SUM(json_extract(item.value, '$.price') * json_extract(item.value, '$.qty')) AS revenue
      FROM orders o, json_each(o.items) AS item
      WHERE o.created_at >= ? AND o.status != 'cancelled'
      GROUP BY name ORDER BY revenue DESC LIMIT 5
    `).all(since)
    const rows = top.map(r => `<tr><td style="padding:6px 8px">${r.name}</td><td style="padding:6px 8px">${r.qty_sold}</td><td style="padding:6px 8px">${symbol}${(r.revenue||0).toFixed(2)}</td></tr>`).join('')
    sections.push(`
      <h3 style="color:#e05560;margin:0 0 10px">🛍️ Top Products (Last 7 Days)</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:rgba(255,255,255,0.05)"><th style="padding:6px 8px;text-align:left">Product</th><th style="padding:6px 8px;text-align:left">Sold</th><th style="padding:6px 8px;text-align:left">Revenue</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" style="padding:8px;color:#888">No data</td></tr>'}</tbody>
      </table>
    `)
  }

  if (reportTypes.includes('subscribers')) {
    const stats = db.prepare(`
      SELECT COUNT(*) AS new_subs FROM subscribers WHERE created_at >= ?
    `).get(since)
    const total = db.prepare(`SELECT COUNT(*) AS n FROM subscribers WHERE status = 'active'`).get()
    sections.push(`
      <h3 style="color:#e05560;margin:0 0 10px">📧 Newsletter (Last 7 Days)</h3>
      <p style="margin:0 0 20px;color:#ccc">New subscribers: <strong>${stats.new_subs}</strong> · Total active: <strong>${total.n}</strong></p>
    `)
  }

  const siteName = settings.site_name || 'Pygmy'
  const siteUrl = settings.site_url || ''
  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#1a1b1e;font-family:Poppins,sans-serif;color:#e2e8f0">
      <div style="max-width:620px;margin:40px auto;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#e05560,#c0392b);padding:30px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:1.6rem">${siteName}</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:0.9rem">📊 Weekly Report</p>
        </div>
        <div style="padding:30px">
          ${sections.join('\n')}
          ${siteUrl ? `<p style="margin:20px 0 0;text-align:center"><a href="${siteUrl}/admin" style="color:#e05560">Open Admin Panel →</a></p>` : ''}
        </div>
        <div style="padding:15px;background:rgba(0,0,0,0.2);text-align:center;font-size:0.8rem;color:#888">
          This report was generated automatically by ${siteName} on ${new Date().toUTCString()}
        </div>
      </div>
    </body></html>
  `
}

// Calculate next send timestamp
function calcNextSend(report) {
  const now = new Date()
  const [h, m] = (report.send_time || '08:00').split(':').map(Number)

  if (report.frequency === 'daily') {
    const next = new Date(now)
    next.setUTCHours(h, m, 0, 0)
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString()
  }

  if (report.frequency === 'weekly') {
    const dow = report.day_of_week ?? 1 // 0=Sun,1=Mon,...
    const next = new Date(now)
    next.setUTCHours(h, m, 0, 0)
    const diff = (dow - next.getUTCDay() + 7) % 7 || 7
    next.setUTCDate(next.getUTCDate() + diff)
    return next.toISOString()
  }

  if (report.frequency === 'monthly') {
    const dom = report.day_of_month ?? 1
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dom, h, m, 0))
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1)
    }
    return next.toISOString()
  }

  return null
}

// GET /api/scheduled-reports
router.get('/', authMiddleware, (req, res) => {
  const reports = db.prepare('SELECT * FROM scheduled_reports ORDER BY id DESC').all()
  res.json(reports.map(r => ({
    ...r,
    recipients: JSON.parse(r.recipients || '[]'),
    report_types: JSON.parse(r.report_types || '[]')
  })))
})

// POST /api/scheduled-reports
router.post('/', authMiddleware, (req, res) => {
  const { name, frequency = 'weekly', day_of_week = 1, day_of_month = 1, send_time = '08:00', recipients = [], report_types = ['orders', 'revenue'], active = 1 } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  if (!recipients.length) return res.status(400).json({ error: 'at least one recipient required' })

  const now = new Date().toISOString()
  const nextSend = calcNextSend({ frequency, day_of_week, day_of_month, send_time })

  const r = db.prepare(`
    INSERT INTO scheduled_reports (name, frequency, day_of_week, day_of_month, send_time, recipients, report_types, next_send_at, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, frequency, day_of_week, day_of_month, send_time,
    JSON.stringify(recipients), JSON.stringify(report_types),
    nextSend, active ? 1 : 0, now, now)

  const created = db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(r.lastInsertRowid)
  res.json({ ...created, recipients: JSON.parse(created.recipients), report_types: JSON.parse(created.report_types) })
})

// PUT /api/scheduled-reports/:id
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const { name, frequency, day_of_week, day_of_month, send_time, recipients, report_types, active } = req.body
  const updated = {
    name: name ?? existing.name,
    frequency: frequency ?? existing.frequency,
    day_of_week: day_of_week ?? existing.day_of_week,
    day_of_month: day_of_month ?? existing.day_of_month,
    send_time: send_time ?? existing.send_time,
    recipients: JSON.stringify(recipients ?? JSON.parse(existing.recipients)),
    report_types: JSON.stringify(report_types ?? JSON.parse(existing.report_types)),
    active: active !== undefined ? (active ? 1 : 0) : existing.active,
  }
  updated.next_send_at = calcNextSend(updated)

  db.prepare(`
    UPDATE scheduled_reports SET name=?, frequency=?, day_of_week=?, day_of_month=?, send_time=?, recipients=?, report_types=?, next_send_at=?, active=?, updated_at=datetime('now')
    WHERE id = ?
  `).run(updated.name, updated.frequency, updated.day_of_week, updated.day_of_month, updated.send_time,
    updated.recipients, updated.report_types, updated.next_send_at, updated.active, req.params.id)

  const saved = db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(req.params.id)
  res.json({ ...saved, recipients: JSON.parse(saved.recipients), report_types: JSON.parse(saved.report_types) })
})

// DELETE /api/scheduled-reports/:id
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM scheduled_reports WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/scheduled-reports/:id/send — manual test send
router.post('/:id/send', authMiddleware, async (req, res) => {
  const report = db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(req.params.id)
  if (!report) return res.status(404).json({ error: 'Not found' })

  const reportTypes = JSON.parse(report.report_types || '[]')
  const recipients = JSON.parse(report.recipients || '[]')
  const settings = getSettings()

  if (!recipients.length) return res.status(400).json({ error: 'No recipients configured' })

  const html = buildReportHtml(reportTypes, settings)
  const siteName = settings.site_name || 'Pygmy'

  let sent = 0, errors = []
  for (const to of recipients) {
    try {
      await sendMailTo({ to, subject: `${siteName} — ${report.name}`, html })
      sent++
    } catch (e) {
      errors.push({ to, error: e.message })
    }
  }

  db.prepare(`UPDATE scheduled_reports SET last_sent_at = datetime('now') WHERE id = ?`).run(req.params.id)
  res.json({ ok: true, sent, errors })
})

// Internal processor — called from scheduler
export async function processScheduledReports() {
  const now = new Date().toISOString()
  const due = db.prepare(`
    SELECT * FROM scheduled_reports
    WHERE active = 1 AND next_send_at IS NOT NULL AND next_send_at <= ?
  `).all(now)

  for (const report of due) {
    const reportTypes = JSON.parse(report.report_types || '[]')
    const recipients = JSON.parse(report.recipients || '[]')
    const settings = getSettings()

    if (!recipients.length) continue

    const html = buildReportHtml(reportTypes, settings)
    const siteName = settings.site_name || 'Pygmy'

    for (const to of recipients) {
      try {
        await sendMailTo({ to, subject: `${siteName} — ${report.name}`, html })
      } catch (e) {
        // best-effort
      }
    }

    const nextSend = calcNextSend(report)
    db.prepare(`
      UPDATE scheduled_reports SET last_sent_at = datetime('now'), next_send_at = ? WHERE id = ?
    `).run(nextSend, report.id)
  }
}

export default router
