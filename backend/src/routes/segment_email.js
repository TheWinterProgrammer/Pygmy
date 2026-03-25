// Pygmy CMS — Bulk Email to Customer Segment (Phase 73)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'
import { logActivity } from './activity.js'

const router = Router()

// ─── GET /api/segment-email/campaigns — list past bulk campaigns ─────────────
router.get('/campaigns', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM segment_email_campaigns
    ORDER BY created_at DESC LIMIT 50
  `).all()
  res.json(rows.map(r => ({
    ...r,
    filters: (() => { try { return JSON.parse(r.filters || '{}') } catch { return {} } })(),
  })))
})

// ─── GET /api/segment-email/preview — count recipients before sending ─────────
router.get('/preview', authMiddleware, (req, res) => {
  const { segment_id, churn_risk, dormant_days, tag_id, q = '' } = req.query

  const customers = getTargetCustomers({ segment_id, churn_risk, dormant_days, tag_id, q })
  res.json({
    count: customers.length,
    sample: customers.slice(0, 5).map(c => ({ id: c.id, email: c.email, name: `${c.first_name || ''} ${c.last_name || ''}`.trim() })),
  })
})

// ─── POST /api/segment-email/send — send bulk email ──────────────────────────
router.post('/send', authMiddleware, async (req, res) => {
  const { subject, html_body, segment_id, churn_risk, dormant_days, tag_id, q = '', campaign_name } = req.body
  if (!subject || !html_body) return res.status(400).json({ error: 'subject and html_body are required' })

  const customers = getTargetCustomers({ segment_id, churn_risk, dormant_days, tag_id, q })
  if (!customers.length) return res.status(400).json({ error: 'No matching customers found' })

  const siteName = db.prepare("SELECT value FROM settings WHERE key = 'site_name'").get()?.value || 'Pygmy'
  const siteUrl = db.prepare("SELECT value FROM settings WHERE key = 'site_url'").get()?.value || ''

  // Insert campaign record
  const filters = JSON.stringify({ segment_id, churn_risk, dormant_days, tag_id, q })
  const campaign = db.prepare(`
    INSERT INTO segment_email_campaigns
    (name, subject, html_body, filter_type, filters, recipient_count, sent_count, status, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'sending', ?, datetime('now'))
  `).run(
    campaign_name || `Bulk Email ${new Date().toLocaleDateString()}`,
    subject, html_body,
    segment_id ? 'segment' : churn_risk ? 'churn_risk' : dormant_days ? 'dormant' : tag_id ? 'tag' : 'all',
    filters,
    customers.length,
    req.user.id
  )
  const campaignId = campaign.lastInsertRowid

  // Send emails (async, don't block response)
  res.json({ campaign_id: campaignId, recipient_count: customers.length, status: 'sending' })

  let sentCount = 0
  const updateInterval = 10

  for (const customer of customers) {
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email

    // Personalise: replace {{name}}, {{email}}, {{site_name}}, {{site_url}}
    const personalised = html_body
      .replace(/\{\{name\}\}/gi, name)
      .replace(/\{\{first_name\}\}/gi, customer.first_name || name)
      .replace(/\{\{email\}\}/gi, customer.email)
      .replace(/\{\{site_name\}\}/gi, siteName)
      .replace(/\{\{site_url\}\}/gi, siteUrl)

    const wrappedHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:1rem;color:#222">
        ${personalised}
        <hr style="margin:2rem 0;border-color:#eee"/>
        <p style="font-size:11px;color:#999;text-align:center">
          ${siteName} · <a href="${siteUrl}" style="color:#999">${siteUrl}</a>
        </p>
      </div>`

    try {
      await sendMailTo({ to: customer.email, subject, html: wrappedHtml })
      sentCount++
    } catch {
      // continue sending to others
    }

    if (sentCount % updateInterval === 0) {
      db.prepare('UPDATE segment_email_campaigns SET sent_count = ? WHERE id = ?').run(sentCount, campaignId)
    }
  }

  // Finalise campaign
  db.prepare(`
    UPDATE segment_email_campaigns
    SET sent_count = ?, status = 'completed', completed_at = datetime('now')
    WHERE id = ?
  `).run(sentCount, campaignId)

  logActivity(db, req.user.id, req.user.name, 'send', 'segment_email', campaignId,
    `${campaign_name || 'Bulk email'} — ${sentCount}/${customers.length} sent`)
})

// ─── GET /api/segment-email/campaigns/:id — campaign detail ──────────────────
router.get('/campaigns/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM segment_email_campaigns WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({
    ...row,
    filters: (() => { try { return JSON.parse(row.filters || '{}') } catch { return {} } })(),
  })
})

// ─── DELETE /api/segment-email/campaigns/:id ─────────────────────────────────
router.delete('/campaigns/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM segment_email_campaigns WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Helper: resolve target customer list ────────────────────────────────────
function getTargetCustomers({ segment_id, churn_risk, dormant_days, tag_id, q }) {
  let baseQuery = `
    SELECT DISTINCT c.id, c.email, c.first_name, c.last_name,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.total), 0) as total_spent,
      CAST(julianday('now') - julianday(COALESCE(MAX(o.created_at), c.created_at)) AS INTEGER) as days_since_last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
    WHERE c.active = 1
  `
  const params = []

  if (q) {
    baseQuery += ` AND (c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)`
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  if (tag_id) {
    baseQuery += ` AND c.id IN (SELECT customer_id FROM customer_tag_assignments WHERE tag_id = ?)`
    params.push(Number(tag_id))
  }

  baseQuery += ` GROUP BY c.id HAVING c.email IS NOT NULL AND c.email != ''`

  if (dormant_days) {
    baseQuery += ` AND days_since_last_order >= ?`
    params.push(Number(dormant_days))
  }

  let customers = db.prepare(baseQuery).all(...params)

  // Filter by segment or churn_risk (requires RFM calculation)
  if (segment_id) {
    // Load segment conditions
    const seg = db.prepare('SELECT * FROM customer_segments WHERE id = ?').get(segment_id)
    if (seg) {
      const conditions = (() => { try { return JSON.parse(seg.conditions || '[]') } catch { return [] } })()
      customers = filterByConditions(customers, conditions)
    }
  }

  if (churn_risk) {
    customers = applyChurnFilter(customers, churn_risk)
  }

  return customers
}

function filterByConditions(customers, conditions) {
  if (!conditions.length) return customers
  return customers.filter(c => {
    return conditions.every(cond => {
      const { field, operator, value } = cond
      switch (field) {
        case 'total_orders':
          if (operator === 'gte') return c.total_orders >= Number(value)
          if (operator === 'lte') return c.total_orders <= Number(value)
          if (operator === 'gt')  return c.total_orders > Number(value)
          if (operator === 'eq')  return c.total_orders === Number(value)
          break
        case 'total_spent':
          if (operator === 'gte') return c.total_spent >= Number(value)
          if (operator === 'lte') return c.total_spent <= Number(value)
          break
        case 'last_order_days':
          if (operator === 'within')    return c.days_since_last_order <= Number(value)
          if (operator === 'older_than') return c.days_since_last_order > Number(value)
          break
      }
      return true
    })
  })
}

function applyChurnFilter(customers, risk) {
  // Quick heuristic without full RFM (for performance)
  return customers.filter(c => {
    const days = c.days_since_last_order || 0
    const orders = c.total_orders || 0
    if (risk === 'high')   return days > 90  || (orders === 1 && days > 30)
    if (risk === 'medium') return (days > 30 && days <= 90)
    if (risk === 'low')    return days <= 30 && orders > 1
    return true
  })
}

export default router
