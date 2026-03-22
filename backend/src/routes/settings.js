// Pygmy CMS — Settings routes
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendTestEmail } from '../email.js'

const router = Router()

// GET /api/settings — public (needed for frontend to render site name, hero, etc.)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const result = {}
  rows.forEach(r => result[r.key] = r.value)
  res.json(result)
})

// PUT /api/settings — batch update (auth)
router.put('/', authMiddleware, (req, res) => {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `)
  const tx = db.transaction((pairs) => {
    for (const [key, value] of pairs) {
      upsert.run(key, String(value))
    }
  })
  tx(Object.entries(req.body))
  res.json({ message: 'Settings saved' })
})

// PUT /api/settings/:key (auth)
router.put('/:key', authMiddleware, (req, res) => {
  const { value } = req.body
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(req.params.key, String(value))
  res.json({ key: req.params.key, value })
})

// POST /api/settings/test-email — send a test email to configured notify_email (auth)
router.post('/test-email', authMiddleware, async (req, res) => {
  try {
    await sendTestEmail()
    res.json({ message: 'Test email sent! Check your inbox.' })
  } catch (err) {
    res.status(500).json({ error: `Failed to send: ${err.message}` })
  }
})

// GET /api/settings/email-preview — preview email template HTML (auth)
router.get('/email-preview', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const accentColor = s.email_accent_color || 'hsl(355, 70%, 30%)'
  const footerText = s.email_footer_text || `© ${new Date().getFullYear()} ${s.site_name || 'Pygmy'}`
  const logoUrl = s.email_logo_url || ''
  const customCss = s.email_custom_css || ''
  const siteName = s.site_name || 'Pygmy CMS'
  const sym = s.shop_currency_symbol || '€'
  const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${siteName}" style="max-height:40px;max-width:160px;margin-bottom:.5rem;display:block;" />` : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;padding:0;background:#1a1a1e;font-family:'Segoe UI',Arial,sans-serif;color:#e2e2e8}
    .wrap{max-width:600px;margin:2rem auto;background:#22232a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}
    .header{background:${accentColor};padding:1.5rem 2rem}
    .header h1{margin:0;font-size:1.3rem;color:#fff;font-weight:700;letter-spacing:.03em}
    .header .site-name{font-size:.85rem;color:rgba(255,255,255,.7);margin-top:.2rem}
    .body{padding:2rem}
    .body p{margin:0 0 1rem;line-height:1.6;color:#b0b0c0;font-size:.92rem}
    .order-table{width:100%;border-collapse:collapse;margin:1.25rem 0;font-size:.88rem}
    .order-table th{text-align:left;padding:.4rem .75rem;color:#888;font-weight:600;border-bottom:1px solid rgba(255,255,255,.08)}
    .order-table td{padding:.5rem .75rem;border-bottom:1px solid rgba(255,255,255,.05);color:#ccc;vertical-align:top}
    .order-table td.price{text-align:right;white-space:nowrap}
    .totals{margin:1rem 0;background:rgba(255,255,255,.04);border-radius:8px;padding:.75rem 1rem}
    .totals-row{display:flex;justify-content:space-between;font-size:.88rem;padding:.25rem 0;color:#b0b0c0}
    .totals-row.total{font-weight:700;font-size:1rem;color:#e2e2e8;border-top:1px solid rgba(255,255,255,.08);padding-top:.5rem;margin-top:.25rem}
    .footer{padding:1.25rem 2rem;border-top:1px solid rgba(255,255,255,.06);font-size:.78rem;color:#555;text-align:center}
    a{color:hsl(355,70%,58%)}
    ${customCss}
  </style></head><body>
    <div class="wrap">
      <div class="header">
        ${logoHtml}
        <h1>Your order has been received!</h1>
        <div class="site-name">${siteName}</div>
      </div>
      <div class="body">
        <p>Hi Jane,</p>
        <p>Thanks for your order! Here's a summary:</p>
        <table class="order-table">
          <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th class="price">Total</th></tr></thead>
          <tbody>
            <tr><td>Example Product</td><td>2</td><td>${sym}29.99</td><td class="price">${sym}59.98</td></tr>
            <tr><td>Another Item</td><td>1</td><td>${sym}14.99</td><td class="price">${sym}14.99</td></tr>
          </tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><span>${sym}74.97</span></div>
          <div class="totals-row"><span>Shipping</span><span>${sym}4.99</span></div>
          <div class="totals-row total"><span>Total</span><span>${sym}79.96</span></div>
        </div>
        <p><strong>Shipping to:</strong><br>Jane Smith<br>123 Main St<br>Berlin, Germany 10115</p>
      </div>
      <div class="footer">${footerText}</div>
    </div>
  </body></html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

export default router
