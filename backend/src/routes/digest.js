// Pygmy CMS — Smart Digest Email API (Phase 36)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCfg() {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (
    'smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from',
    'site_name','site_url','notify_email',
    'digest_enabled','digest_frequency','digest_recipients','digest_last_sent'
  )`).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))
  return s
}

function buildDigestData(since) {
  const sinceStr = since.toISOString()

  // Orders in period
  const ordersRow = db.prepare(`
    SELECT COUNT(*) as count, ROUND(COALESCE(SUM(total), 0), 2) as revenue
    FROM orders WHERE created_at >= ?
  `).get(sinceStr) || { count: 0, revenue: 0 }

  // New subscribers
  const subscribers = db.prepare(`
    SELECT COUNT(*) as count FROM subscribers WHERE created_at >= ?
  `).get(sinceStr)?.count || 0

  // New customers
  const newCustomers = db.prepare(`
    SELECT COUNT(*) as count FROM customers WHERE created_at >= ?
  `).get(sinceStr)?.count || 0

  // Page views
  const pageViews = db.prepare(`
    SELECT COALESCE(SUM(count), 0) as total FROM page_views WHERE date >= DATE(?)
  `).get(sinceStr)?.total || 0

  // Pending comments
  const pendingComments = db.prepare(`
    SELECT COUNT(*) as count FROM comments WHERE status = 'pending'
  `).get()?.count || 0

  // Pending reviews
  const pendingReviews = db.prepare(`
    SELECT COUNT(*) as count FROM product_reviews WHERE status = 'pending'
  `).get()?.count || 0

  // Support tickets
  const openTickets = db.prepare(`
    SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('open','in_progress')
  `).get()?.count || 0

  // Top posts by views
  const topPages = db.prepare(`
    SELECT entity_type, entity_id, SUM(count) as views, date
    FROM page_views
    WHERE date >= DATE(?)
    GROUP BY entity_type, entity_id
    ORDER BY views DESC
    LIMIT 5
  `).all(sinceStr)

  // Abandoned carts
  const abandonedCarts = db.prepare(`
    SELECT COUNT(*) as count FROM abandoned_carts
    WHERE recovered = 0 AND created_at >= ?
  `).get(sinceStr)?.count || 0

  // Low stock products
  const lowStock = db.prepare(`
    SELECT COUNT(*) as count FROM products
    WHERE track_stock = 1 AND stock_quantity <= low_stock_threshold AND stock_quantity > 0
  `).get()?.count || 0

  const outOfStock = db.prepare(`
    SELECT COUNT(*) as count FROM products
    WHERE track_stock = 1 AND stock_quantity <= 0 AND allow_backorder = 0 AND status = 'published'
  `).get()?.count || 0

  return {
    period_start: sinceStr,
    orders: { count: ordersRow.count, revenue: ordersRow.revenue },
    subscribers,
    new_customers: newCustomers,
    page_views: pageViews,
    pending_comments: pendingComments,
    pending_reviews: pendingReviews,
    open_tickets: openTickets,
    abandoned_carts: abandonedCarts,
    inventory: { low_stock: lowStock, out_of_stock: outOfStock },
    top_pages: topPages,
  }
}

function buildDigestHtml(data, cfg, label) {
  const siteName = cfg.site_name || 'Pygmy CMS'
  const siteUrl = cfg.site_url || 'http://localhost:5174'
  const adminUrl = (cfg.site_url || 'http://localhost:5173').replace('5174', '5173')

  const fmt = (n, prefix = '') => `${prefix}${Number(n || 0).toLocaleString()}`
  const currency = cfg.shop_currency_symbol || '€'

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; background: #0f0f12; color: #e0e0e0; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #1a1a22, #23232f); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px; }
  .logo { font-size: 2rem; font-weight: 900; color: #e05252; letter-spacing: -1px; }
  .subtitle { color: #888; font-size: 0.9rem; margin-top: 4px; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat { background: #1a1a22; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; text-align: center; }
  .stat-num { font-size: 1.8rem; font-weight: 700; color: #e05252; }
  .stat-label { font-size: 0.78rem; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .section { background: #1a1a22; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px; margin-bottom: 16px; }
  .section h3 { margin: 0 0 12px; font-size: 0.9rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.08em; }
  .alert { background: rgba(224,82,82,0.1); border: 1px solid rgba(224,82,82,0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; font-size: 0.9rem; }
  .btn { display: inline-block; background: #e05252; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 12px; }
  .footer { text-align: center; color: #555; font-size: 0.8rem; margin-top: 24px; }
</style>
</head><body><div class="wrap">

<div class="header">
  <div class="logo">🪆 ${siteName}</div>
  <div class="subtitle">${label} Digest Report</div>
</div>

<div class="stat-grid">
  <div class="stat">
    <div class="stat-num">${fmt(data.orders.count)}</div>
    <div class="stat-label">Orders</div>
  </div>
  <div class="stat">
    <div class="stat-num">${currency}${fmt(data.orders.revenue)}</div>
    <div class="stat-label">Revenue</div>
  </div>
  <div class="stat">
    <div class="stat-num">${fmt(data.page_views)}</div>
    <div class="stat-label">Page Views</div>
  </div>
  <div class="stat">
    <div class="stat-num">${fmt(data.subscribers)}</div>
    <div class="stat-label">New Subscribers</div>
  </div>
  <div class="stat">
    <div class="stat-num">${fmt(data.new_customers)}</div>
    <div class="stat-label">New Customers</div>
  </div>
  <div class="stat">
    <div class="stat-num">${fmt(data.abandoned_carts)}</div>
    <div class="stat-label">Abandoned Carts</div>
  </div>
</div>

${data.pending_comments > 0 || data.pending_reviews > 0 || data.open_tickets > 0 || data.inventory.out_of_stock > 0 ? `
<div class="section">
  <h3>⚠️ Needs Attention</h3>
  ${data.pending_comments > 0 ? `<div class="alert">💬 <strong>${data.pending_comments}</strong> comment${data.pending_comments !== 1 ? 's' : ''} awaiting moderation</div>` : ''}
  ${data.pending_reviews > 0 ? `<div class="alert">⭐ <strong>${data.pending_reviews}</strong> review${data.pending_reviews !== 1 ? 's' : ''} awaiting approval</div>` : ''}
  ${data.open_tickets > 0 ? `<div class="alert">🎫 <strong>${data.open_tickets}</strong> open support ticket${data.open_tickets !== 1 ? 's' : ''}</div>` : ''}
  ${data.inventory.out_of_stock > 0 ? `<div class="alert">🚨 <strong>${data.inventory.out_of_stock}</strong> product${data.inventory.out_of_stock !== 1 ? 's' : ''} out of stock</div>` : ''}
  ${data.inventory.low_stock > 0 ? `<div class="alert">⚠️ <strong>${data.inventory.low_stock}</strong> product${data.inventory.low_stock !== 1 ? 's' : ''} running low on stock</div>` : ''}
</div>` : ''}

<div style="text-align:center">
  <a href="${adminUrl}/dashboard" class="btn">📊 Open Dashboard</a>
</div>

<div class="footer">
  <p>This digest was sent by ${siteName} CMS · <a href="${siteUrl}" style="color:#888">${siteUrl}</a></p>
  <p>To manage digest settings, go to Settings → Digest Emails</p>
</div>

</div></body></html>`
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/digest/settings — get current settings (admin)
router.get('/settings', authMiddleware, (req, res) => {
  const cfg = getCfg()
  res.json({
    enabled: cfg.digest_enabled === '1',
    frequency: cfg.digest_frequency || 'weekly',
    recipients: cfg.digest_recipients || cfg.notify_email || '',
    last_sent: cfg.digest_last_sent || null,
  })
})

// PUT /api/digest/settings — update settings (admin)
router.put('/settings', authMiddleware, (req, res) => {
  const { enabled, frequency, recipients } = req.body

  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)

  if (enabled !== undefined) upsert.run('digest_enabled', enabled ? '1' : '0')
  if (frequency) upsert.run('digest_frequency', frequency)
  if (recipients !== undefined) upsert.run('digest_recipients', recipients)

  res.json({ ok: true })
})

// GET /api/digest/preview?period=weekly — preview data without sending (admin)
router.get('/preview', authMiddleware, (req, res) => {
  const period = req.query.period || 'weekly'
  const days = period === 'daily' ? 1 : period === 'monthly' ? 30 : 7
  const since = new Date(Date.now() - days * 86400000)
  const data = buildDigestData(since)
  res.json(data)
})

// POST /api/digest/send — send digest now (admin)
router.post('/send', authMiddleware, async (req, res) => {
  const { period = 'weekly', recipients: customRecipients } = req.body
  const cfg = getCfg()

  if (!cfg.smtp_host || !cfg.smtp_user) {
    return res.status(400).json({ error: 'SMTP not configured. Please set up SMTP in Settings.' })
  }

  const recipients = (customRecipients || cfg.digest_recipients || cfg.notify_email || '').split(',').map(e => e.trim()).filter(Boolean)
  if (!recipients.length) {
    return res.status(400).json({ error: 'No recipients configured. Set digest_recipients in Settings → Digest Emails.' })
  }

  const days = period === 'daily' ? 1 : period === 'monthly' ? 30 : 7
  const label = period === 'daily' ? 'Daily' : period === 'monthly' ? 'Monthly' : 'Weekly'
  const since = new Date(Date.now() - days * 86400000)
  const data = buildDigestData(since)
  const html = buildDigestHtml(data, cfg, label)

  const siteName = cfg.site_name || 'Pygmy CMS'
  const subject = `${siteName} — ${label} Digest Report`

  const results = []
  for (const email of recipients) {
    try {
      await sendMailTo(email, subject, html)
      results.push({ email, sent: true })
    } catch (err) {
      results.push({ email, sent: false, error: err.message })
    }
  }

  // Update last_sent timestamp
  db.prepare(`INSERT INTO settings (key, value) VALUES ('digest_last_sent', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run()

  res.json({ ok: true, period, recipients: results, data })
})

// POST /api/digest/process — auto-send due digests (called by scheduler)
export async function processDigest() {
  const cfg = getCfg()
  if (cfg.digest_enabled !== '1') return

  const freq = cfg.digest_frequency || 'weekly'
  const lastSent = cfg.digest_last_sent ? new Date(cfg.digest_last_sent) : null
  const now = new Date()

  let shouldSend = false
  if (!lastSent) {
    shouldSend = true
  } else if (freq === 'daily') {
    shouldSend = (now - lastSent) >= 23 * 3600000 // 23h to allow for drift
  } else if (freq === 'weekly') {
    shouldSend = (now - lastSent) >= 6.9 * 24 * 3600000
  } else if (freq === 'monthly') {
    shouldSend = (now - lastSent) >= 29 * 24 * 3600000
  }

  if (!shouldSend) return

  const recipients = (cfg.digest_recipients || cfg.notify_email || '').split(',').map(e => e.trim()).filter(Boolean)
  if (!recipients.length || !cfg.smtp_host) return

  const days = freq === 'daily' ? 1 : freq === 'monthly' ? 30 : 7
  const label = freq === 'daily' ? 'Daily' : freq === 'monthly' ? 'Monthly' : 'Weekly'
  const since = new Date(Date.now() - days * 86400000)
  const data = buildDigestData(since)
  const html = buildDigestHtml(data, cfg, label)
  const subject = `${cfg.site_name || 'Pygmy CMS'} — ${label} Digest Report`

  for (const email of recipients) {
    try { await sendMailTo(email, subject, html) } catch {}
  }

  db.prepare(`INSERT INTO settings (key, value) VALUES ('digest_last_sent', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run()

  console.log(`[Digest] Sent ${label.toLowerCase()} digest to ${recipients.length} recipient(s)`)
}

router.post('/process', authMiddleware, async (req, res) => {
  await processDigest()
  res.json({ ok: true })
})

export default router
