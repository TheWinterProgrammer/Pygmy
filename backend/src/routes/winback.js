// Pygmy CMS — Win-back Campaigns API (Phase 69)
import { Router } from 'express'
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

function getSiteUrl () {
  return getSetting('site_url') || 'http://localhost:5174'
}

// Find customers inactive for N+ days who haven't been sent this campaign
function getLapsedCustomers (campaignId, daysInactive) {
  const cutoff = new Date(Date.now() - daysInactive * 86400000).toISOString().slice(0, 10)
  return db.prepare(`
    SELECT c.id, c.email, c.first_name, c.last_name, MAX(o.created_at) as last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE c.active = 1
      AND c.email NOT LIKE '%@deleted.local'
      AND c.id NOT IN (
        SELECT customer_id FROM winback_sends WHERE campaign_id = ? AND customer_id IS NOT NULL
      )
    GROUP BY c.id
    HAVING last_order < ? OR last_order IS NULL
    ORDER BY last_order ASC
    LIMIT 500
  `).all(campaignId, cutoff)
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// GET /api/winback — list all campaigns
router.get('/', authMiddleware, (req, res) => {
  const campaigns = db.prepare('SELECT * FROM winback_campaigns ORDER BY created_at DESC').all()
  res.json(campaigns)
})

// GET /api/winback/stats — summary
router.get('/stats', authMiddleware, (req, res) => {
  const total    = db.prepare('SELECT COUNT(*) as n FROM winback_campaigns').get().n
  const active   = db.prepare(`SELECT COUNT(*) as n FROM winback_campaigns WHERE status='active'`).get().n
  const sent     = db.prepare('SELECT SUM(sent_count) as n FROM winback_campaigns').get().n || 0
  const converts = db.prepare('SELECT SUM(convert_count) as n FROM winback_campaigns').get().n || 0
  res.json({ total, active, total_sent: sent, total_conversions: converts })
})

// GET /api/winback/:id/preview — preview lapsed customers without sending
router.get('/:id/preview', authMiddleware, (req, res) => {
  const campaign = db.prepare('SELECT * FROM winback_campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Not found' })
  const customers = getLapsedCustomers(campaign.id, campaign.days_inactive)
  res.json({ count: customers.length, customers: customers.slice(0, 20) })
})

// GET /api/winback/:id/sends — send history for a campaign
router.get('/:id/sends', authMiddleware, (req, res) => {
  const sends = db.prepare(`
    SELECT ws.*, c.first_name, c.last_name
    FROM winback_sends ws
    LEFT JOIN customers c ON c.id = ws.customer_id
    WHERE ws.campaign_id = ?
    ORDER BY ws.sent_at DESC
    LIMIT 200
  `).all(req.params.id)
  res.json(sends)
})

// POST /api/winback — create campaign
router.post('/', authMiddleware, (req, res) => {
  const {
    name = 'Win-back Campaign',
    days_inactive = 90,
    coupon_code = '',
    discount_pct = 0,
    subject = 'We miss you!',
    body = '',
    status = 'draft'
  } = req.body
  const result = db.prepare(`
    INSERT INTO winback_campaigns (name, days_inactive, coupon_code, discount_pct, subject, body, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, days_inactive, coupon_code, discount_pct, subject, body, status)
  const campaign = db.prepare('SELECT * FROM winback_campaigns WHERE id = ?').get(result.lastInsertRowid)
  res.json(campaign)
})

// PUT /api/winback/:id — update campaign
router.put('/:id', authMiddleware, (req, res) => {
  const campaign = db.prepare('SELECT * FROM winback_campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Not found' })
  const {
    name = campaign.name,
    days_inactive = campaign.days_inactive,
    coupon_code = campaign.coupon_code,
    discount_pct = campaign.discount_pct,
    subject = campaign.subject,
    body = campaign.body,
    status = campaign.status
  } = req.body
  db.prepare(`
    UPDATE winback_campaigns
    SET name=?, days_inactive=?, coupon_code=?, discount_pct=?, subject=?, body=?, status=?, updated_at=datetime('now')
    WHERE id = ?
  `).run(name, days_inactive, coupon_code, discount_pct, subject, body, status, req.params.id)
  const updated = db.prepare('SELECT * FROM winback_campaigns WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// DELETE /api/winback/:id — delete campaign
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM winback_campaigns WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Send ─────────────────────────────────────────────────────────────────────

// POST /api/winback/:id/send — execute a campaign (fire emails)
router.post('/:id/send', authMiddleware, async (req, res) => {
  const campaign = db.prepare('SELECT * FROM winback_campaigns WHERE id = ?').get(req.params.id)
  if (!campaign) return res.status(404).json({ error: 'Not found' })

  const customers = getLapsedCustomers(campaign.id, campaign.days_inactive)
  if (customers.length === 0) {
    return res.json({ sent: 0, message: 'No lapsed customers found for this campaign' })
  }

  const siteName = getSiteName()
  const siteUrl = getSiteUrl()
  let sent = 0
  let failed = 0

  for (const cust of customers) {
    const firstName = cust.first_name || 'there'
    // Build personalised email
    let emailBody = campaign.body
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{site_name\}\}/gi, siteName)
      .replace(/\{\{coupon_code\}\}/gi, campaign.coupon_code || '')
      .replace(/\{\{discount_pct\}\}/gi, campaign.discount_pct > 0 ? `${campaign.discount_pct}%` : '')

    // Generate per-customer coupon if campaign has a discount % but no static code
    let personalCoupon = campaign.coupon_code
    if (campaign.discount_pct > 0 && !campaign.coupon_code) {
      const code = `WINBACK-${cust.id}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      personalCoupon = code
      // Insert coupon into coupons table
      try {
        db.prepare(`
          INSERT OR IGNORE INTO coupons (code, discount_type, discount_value, max_uses, active, expires_at)
          VALUES (?, 'percent', ?, 1, 1, datetime('now', '+30 days'))
        `).run(code, campaign.discount_pct)
      } catch (_) { /* coupons table might not have all columns */ }
    }

    const ctaHtml = personalCoupon
      ? `<p style="margin:24px 0">Use code <strong style="font-size:1.2em;background:#f5f5f5;padding:6px 14px;border-radius:4px;letter-spacing:2px">${personalCoupon}</strong> for ${campaign.discount_pct > 0 ? `${campaign.discount_pct}% off` : 'your exclusive discount'}!</p>`
      : ''

    const fullHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
        <h2 style="color:#dc3f55">${siteName} misses you!</h2>
        <div>${emailBody}</div>
        ${ctaHtml}
        <p style="margin:24px 0">
          <a href="${siteUrl}/shop" style="background:#dc3f55;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">
            Shop Now →
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:0.8em;color:#888">You're receiving this because you have an account with ${siteName}. <a href="${siteUrl}/account">Manage preferences</a>.</p>
      </div>
    `

    try {
      await sendMailTo({ to: cust.email, subject: campaign.subject.replace(/\{\{first_name\}\}/gi, firstName), html: fullHtml })
      db.prepare(`
        INSERT INTO winback_sends (campaign_id, customer_id, email, coupon_code)
        VALUES (?, ?, ?, ?)
      `).run(campaign.id, cust.id, cust.email, personalCoupon)
      sent++
    } catch (_) {
      failed++
    }
  }

  // Update campaign stats
  db.prepare(`
    UPDATE winback_campaigns
    SET sent_count = sent_count + ?, status = 'active', last_sent_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(sent, campaign.id)

  res.json({ sent, failed, message: `Win-back emails sent to ${sent} customer(s)` })
})

// POST /api/winback/track/open — pixel tracking (fire-and-forget)
router.get('/track/open', (req, res) => {
  const { c } = req.query
  if (c) {
    db.prepare('UPDATE winback_sends SET opened = 1 WHERE id = ?').run(Number(c))
    // Update campaign open count
    const send_ = db.prepare('SELECT campaign_id FROM winback_sends WHERE id = ?').get(Number(c))
    if (send_) db.prepare('UPDATE winback_campaigns SET open_count = open_count + 1 WHERE id = ?').run(send_.campaign_id)
  }
  // Return a 1×1 transparent gif
  res.setHeader('Content-Type', 'image/gif')
  res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'))
})

// POST /api/winback/track/convert — record a conversion
router.post('/track/convert', (req, res) => {
  const { send_id } = req.body
  if (!send_id) return res.json({ ok: false })
  const send_ = db.prepare('SELECT * FROM winback_sends WHERE id = ?').get(send_id)
  if (!send_) return res.json({ ok: false })
  db.prepare('UPDATE winback_sends SET converted = 1 WHERE id = ?').run(send_id)
  db.prepare('UPDATE winback_campaigns SET convert_count = convert_count + 1 WHERE id = ?').run(send_.campaign_id)
  res.json({ ok: true })
})

export default router
