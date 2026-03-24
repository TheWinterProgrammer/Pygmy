// Pygmy CMS — Shipping Labels API (Phase 57)
// Generates print-ready HTML shipping labels for orders.
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'pygmy-dev-secret-change-in-production'

const router = Router()

function authGuard(req, res, next) {
  // Accept Bearer header or ?token= query param (for browser <a href> links / window.open)
  const raw = (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7))
    || req.query.token
  if (!raw) return res.status(401).json({ error: 'No token provided' })
  try {
    req.user = jwt.verify(raw, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function getSiteSettings() {
  return db.prepare(`SELECT key, value FROM settings`).all()
    .reduce((a, r) => { a[r.key] = r.value; return a }, {})
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── GET /api/shipping-labels/:orderNumber — single label HTML ─────────────────
router.get('/:orderNumber', authGuard, (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE order_number = ?`).get(req.params.orderNumber)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const settings = getSiteSettings()
  const items = JSON.parse(order.items || '[]')

  const fromName    = settings.shipping_label_from_name    || settings.site_name || 'Sender'
  const fromAddr    = settings.shipping_label_from_address || ''
  const fromCity    = settings.shipping_label_from_city    || ''
  const fromZip     = settings.shipping_label_from_zip     || ''
  const fromCountry = settings.shipping_label_from_country || ''

  const toName    = order.customer_name || ''
  const toEmail   = order.customer_email || ''
  const toPhone   = order.customer_phone || ''
  const toAddress = order.shipping_address || ''

  // Parse shipping_address JSON if available
  let toAddrParsed = { line1: '', line2: '', city: '', state: '', zip: '', country: '' }
  try {
    const parsed = typeof toAddress === 'string' && toAddress.startsWith('{')
      ? JSON.parse(toAddress)
      : { line1: toAddress }
    Object.assign(toAddrParsed, parsed)
  } catch (_) {
    toAddrParsed.line1 = toAddress
  }

  const itemLines = items.map(item =>
    `<tr>
      <td>${escapeHtml(item.name || '')}</td>
      <td style="text-align:center">${item.qty || 1}</td>
      <td style="text-align:right">${item.variant_label ? `<small>${escapeHtml(item.variant_label)}</small>` : ''}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Shipping Label — ${escapeHtml(order.order_number)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      background: #fff;
      color: #000;
    }
    .label {
      width: 4in;
      min-height: 6in;
      border: 2px solid #000;
      padding: 0.25in;
      margin: 0.25in auto;
      display: flex;
      flex-direction: column;
      gap: 0.15in;
      page-break-after: always;
    }
    .label-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1.5px solid #000;
      padding-bottom: 0.1in;
      margin-bottom: 0.1in;
    }
    .site-name { font-size: 14px; font-weight: 900; letter-spacing: 0.05em; }
    .order-num { font-size: 10px; color: #444; margin-top: 2px; }

    .barcode-area {
      text-align: center;
      border: 1px dashed #999;
      padding: 0.08in;
      border-radius: 4px;
      font-size: 10px;
      color: #666;
    }
    .barcode-num { font-size: 14px; font-weight: 700; letter-spacing: 0.2em; color: #000; margin-top: 4px; }

    .address-section { display: flex; gap: 0.15in; }
    .addr-box {
      flex: 1;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 0.08in;
    }
    .addr-label {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #666;
      border-bottom: 1px solid #eee;
      margin-bottom: 4px;
      padding-bottom: 2px;
    }
    .addr-name { font-size: 12px; font-weight: 700; margin-bottom: 2px; }
    .addr-line { font-size: 10px; line-height: 1.5; }

    .to-box { border-color: #000; border-width: 2px; }
    .to-box .addr-name { font-size: 14px; }
    .to-box .addr-line { font-size: 11px; }

    .weight-section {
      display: flex;
      gap: 0.1in;
    }
    .weight-box {
      flex: 1;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 0.06in 0.08in;
    }
    .weight-box .label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
    .weight-box .value { font-size: 11px; font-weight: 700; margin-top: 2px; }

    .items-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .items-table th, .items-table td { padding: 3px 4px; border-bottom: 1px solid #eee; }
    .items-table th {
      text-align: left; font-weight: 700; font-size: 8px;
      text-transform: uppercase; letter-spacing: 0.06em; color: #666;
      border-bottom: 1px solid #ccc;
    }
    .items-section-title {
      font-size: 8px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: #666; margin-bottom: 4px;
    }

    .footer {
      margin-top: auto;
      text-align: center;
      font-size: 8px;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 0.08in;
    }

    @media print {
      body { margin: 0; }
      .label { margin: 0; border: 2px solid #000; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="text-align:center;padding:8px;">
    <button onclick="window.print()" style="padding:6px 18px;font-size:13px;cursor:pointer;border:1px solid #333;border-radius:4px;background:#000;color:#fff;">🖨️ Print Label</button>
    <button onclick="window.close()" style="padding:6px 14px;font-size:13px;cursor:pointer;border:1px solid #999;border-radius:4px;margin-left:8px;">✕ Close</button>
  </div>

  <div class="label">
    <!-- Header -->
    <div class="label-header">
      <div>
        <div class="site-name">${escapeHtml(settings.site_name || 'PYGMY')}</div>
        <div class="order-num">ORDER ${escapeHtml(order.order_number)}</div>
      </div>
      <div style="text-align:right;font-size:10px;color:#444;">
        <div>${new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <div style="margin-top:2px;font-weight:600;color:#000;">${order.shipping_rate_name || 'Standard'}</div>
      </div>
    </div>

    <!-- Barcode placeholder -->
    <div class="barcode-area">
      <div style="font-size:8px;color:#999;">TRACKING</div>
      <div class="barcode-num">${escapeHtml(order.tracking_number || order.order_number)}</div>
      ${order.tracking_carrier ? `<div style="font-size:9px;color:#666;margin-top:2px;">${escapeHtml(order.tracking_carrier)}</div>` : ''}
    </div>

    <!-- From / To addresses -->
    <div class="address-section">
      <div class="addr-box">
        <div class="addr-label">From</div>
        <div class="addr-name">${escapeHtml(fromName)}</div>
        <div class="addr-line">${escapeHtml(fromAddr)}</div>
        ${fromCity || fromZip ? `<div class="addr-line">${escapeHtml([fromCity, fromZip].filter(Boolean).join(', '))}</div>` : ''}
        ${fromCountry ? `<div class="addr-line">${escapeHtml(fromCountry)}</div>` : ''}
      </div>

      <div class="addr-box to-box">
        <div class="addr-label">Ship To</div>
        <div class="addr-name">${escapeHtml(toName)}</div>
        ${toAddrParsed.line1 ? `<div class="addr-line">${escapeHtml(toAddrParsed.line1)}</div>` : ''}
        ${toAddrParsed.line2 ? `<div class="addr-line">${escapeHtml(toAddrParsed.line2)}</div>` : ''}
        ${toAddrParsed.city || toAddrParsed.zip ? `<div class="addr-line">${escapeHtml([toAddrParsed.city, toAddrParsed.state, toAddrParsed.zip].filter(Boolean).join(', '))}</div>` : ''}
        ${toAddrParsed.country || order.shipping_country ? `<div class="addr-line">${escapeHtml(toAddrParsed.country || order.shipping_country)}</div>` : ''}
        ${toPhone ? `<div class="addr-line" style="margin-top:3px;color:#444">📞 ${escapeHtml(toPhone)}</div>` : ''}
      </div>
    </div>

    <!-- Weight / dimensions -->
    <div class="weight-section">
      <div class="weight-box">
        <div class="label">Items</div>
        <div class="value">${items.reduce((s, i) => s + (i.qty || 1), 0)} pcs</div>
      </div>
      <div class="weight-box">
        <div class="label">Total</div>
        <div class="value">${settings.shop_currency_symbol || '€'}${Number(order.total || 0).toFixed(2)}</div>
      </div>
      <div class="weight-box">
        <div class="label">Status</div>
        <div class="value" style="text-transform:capitalize">${escapeHtml(order.status || 'pending')}</div>
      </div>
    </div>

    <!-- Items list -->
    <div>
      <div class="items-section-title">Contents</div>
      <table class="items-table">
        <thead>
          <tr><th>Item</th><th style="text-align:center">Qty</th><th>Variant</th></tr>
        </thead>
        <tbody>
          ${itemLines}
        </tbody>
      </table>
    </div>

    ${order.notes ? `<div style="border:1px solid #eee;border-radius:4px;padding:6px;font-size:10px;color:#444;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</div>` : ''}

    <div class="footer">
      ${escapeHtml(settings.site_name || '')} · ${escapeHtml(settings.site_url || '')} · Printed ${new Date().toLocaleDateString()}
    </div>
  </div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// ── GET /api/shipping-labels/bulk — multi-order labels ────────────────────────
// ?ids=ORD-001,ORD-002 or ?status=pending
router.get('/bulk/print', authGuard, (req, res) => {
  const { ids, status, limit = 50 } = req.query

  let orders = []
  if (ids) {
    const orderNums = ids.split(',').map(s => s.trim()).filter(Boolean)
    orders = orderNums.map(num => db.prepare(`SELECT * FROM orders WHERE order_number = ?`).get(num)).filter(Boolean)
  } else if (status) {
    orders = db.prepare(`SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ?`).all(status, Number(limit))
  } else {
    return res.status(400).json({ error: 'Provide ids= or status=' })
  }

  if (!orders.length) return res.status(404).json({ error: 'No orders found' })

  // Redirect to single label for simplicity — in a real app you'd merge them
  // For bulk, return a list of label URLs
  const labelUrls = orders.map(o => `/api/shipping-labels/${o.order_number}`)
  res.json({ count: labelUrls.length, labels: labelUrls })
})

export default router
