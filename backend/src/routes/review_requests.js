// review_requests.js — Review Request Automation (Phase 41)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const r = Router()

function getSettings() {
  return db.prepare('SELECT key, value FROM settings').all()
    .reduce((a, s) => { a[s.key] = s.value; return a }, {})
}

// ── Queue a review request (internal: called when order becomes completed/delivered) ─
export function queueReviewRequest(order) {
  const s = getSettings()
  if (!s.review_requests_enabled || s.review_requests_enabled === '0') return
  if (!order.customer_email) return

  const delayDays = parseInt(s.review_request_delay_days || '7', 10)
  const sendAfter = new Date()
  sendAfter.setDate(sendAfter.getDate() + delayDays)

  let items = []
  try { items = JSON.parse(order.items || '[]') } catch {}
  const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))]

  try {
    db.prepare(`
      INSERT OR IGNORE INTO review_requests
        (order_id, order_number, customer_email, customer_name, product_ids, send_after)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      order.id,
      order.order_number,
      order.customer_email,
      order.customer_name || '',
      JSON.stringify(productIds),
      sendAfter.toISOString()
    )
  } catch { /* already queued — ignore */ }
}

// ── Background processor (called every 10 min from index.js) ─────────────────
export async function processReviewRequests() {
  const s = getSettings()
  if (!s.review_requests_enabled || s.review_requests_enabled === '0') return

  const due = db.prepare(`
    SELECT * FROM review_requests
    WHERE status = 'pending' AND send_after <= datetime('now')
    LIMIT 10
  `).all()

  for (const rr of due) {
    try {
      const productIds = JSON.parse(rr.product_ids || '[]')

      // Get product names + slugs
      let products = []
      if (productIds.length) {
        products = db.prepare(
          `SELECT id, name, slug, cover_image FROM products WHERE id IN (${productIds.map(() => '?').join(',')}) AND status = 'published'`
        ).all(...productIds)
      }

      const siteName  = s.site_name  || 'Our Store'
      const siteUrl   = s.site_url   || ''
      const subject   = (s.review_request_subject || 'How was your order from {{site_name}}?')
        .replace(/\{\{site_name\}\}/g, siteName)
        .replace(/\{\{order_number\}\}/g, rr.order_number)

      const productRows = products.map(p => {
        const reviewUrl = `${siteUrl}/shop/${p.slug}#reviews`
        const img = p.cover_image ? `<img src="${siteUrl}${p.cover_image}" alt="${p.name}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-right:12px">` : ''
        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <div style="display:flex;align-items:center">
                ${img}
                <div>
                  <div style="font-weight:600;color:#e2e2e8">${p.name}</div>
                  <a href="${reviewUrl}" style="color:#b0303a;font-size:0.85rem">Leave a review →</a>
                </div>
              </div>
            </td>
          </tr>`
      }).join('')

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;padding:0;background:#1a1a1e;font-family:'Segoe UI',Arial,sans-serif;color:#e2e2e8}
  .wrap{max-width:600px;margin:2rem auto;background:#22232a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
  .header{background:#b0303a;padding:1.5rem 2rem}
  .body{padding:2rem;line-height:1.6;font-size:.92rem;color:#b0b0c0}
  .btn{display:inline-block;padding:.75rem 2rem;background:#b0303a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin-top:1rem}
  .footer{padding:1rem 2rem;text-align:center;font-size:.8rem;color:#666;border-top:1px solid rgba(255,255,255,0.06)}
</style></head><body>
<div class="wrap">
  <div class="header"><h1 style="margin:0;color:#fff;font-size:1.2rem">How did we do? ⭐</h1></div>
  <div class="body">
    <p>Hi ${rr.customer_name || 'there'},</p>
    <p>Thank you for your order <strong>#${rr.order_number}</strong> from <strong>${siteName}</strong>! We hope you love your purchase.</p>
    <p>We'd love to hear what you think. Your feedback helps other customers and helps us improve.</p>
    ${products.length ? `<table style="width:100%;border-collapse:collapse;margin:1.5rem 0">${productRows}</table>` : ''}
    ${siteUrl ? `<p style="text-align:center"><a href="${siteUrl}/shop" class="btn">Leave a Review</a></p>` : ''}
    <p style="margin-top:1.5rem;font-size:.85rem;color:#666">Thanks again for shopping with us!</p>
  </div>
  <div class="footer">${siteName}${siteUrl ? ` · <a href="${siteUrl}" style="color:#666">${siteUrl}</a>` : ''}</div>
</div>
</body></html>`

      await sendMailTo({
        to:      rr.customer_email,
        subject,
        html,
        text: `Hi ${rr.customer_name || 'there'}, thank you for your order #${rr.order_number}! We'd love your review. Visit ${siteUrl}/shop to leave one.`,
      })

      db.prepare(`UPDATE review_requests SET status = 'sent', sent_at = datetime('now') WHERE id = ?`).run(rr.id)
    } catch (err) {
      console.error('[review-requests] Failed to send to', rr.customer_email, err.message)
      db.prepare(`UPDATE review_requests SET status = 'skipped' WHERE id = ?`).run(rr.id)
    }
  }
}

// ── Admin: list review requests ────────────────────────────────────────────────
r.get('/', auth, (req, res) => {
  const { status, q, limit = 50, offset = 0 } = req.query
  let where = '1=1'
  const params = []
  if (status) { where += ' AND status = ?'; params.push(status) }
  if (q) { where += ' AND (customer_email LIKE ? OR order_number LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }

  const rows = db.prepare(`
    SELECT * FROM review_requests WHERE ${where}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`SELECT COUNT(*) as n FROM review_requests WHERE ${where}`).get(...params).n
  res.json({ rows, total })
})

// ── Admin: stats ───────────────────────────────────────────────────────────────
r.get('/stats', auth, (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
    FROM review_requests
  `).get()
  res.json(stats)
})

// ── Admin: manually trigger send for a request ─────────────────────────────────
r.post('/:id/send', auth, async (req, res) => {
  const rr = db.prepare('SELECT * FROM review_requests WHERE id = ?').get(req.params.id)
  if (!rr) return res.status(404).json({ error: 'Not found' })
  // Force it to be due now
  db.prepare(`UPDATE review_requests SET send_after = datetime('now'), status = 'pending' WHERE id = ?`).run(rr.id)
  await processReviewRequests()
  res.json({ ok: true })
})

// ── Admin: skip a request ──────────────────────────────────────────────────────
r.delete('/:id', auth, (req, res) => {
  db.prepare(`UPDATE review_requests SET status = 'skipped' WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

export default r
