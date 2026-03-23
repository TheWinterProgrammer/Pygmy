// Pygmy CMS — Invoice Download (Phase 39)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function getSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings`).all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function buildInvoiceHTML(order, settings) {
  const items       = JSON.parse(order.items || '[]')
  const currency    = settings.shop_currency_symbol || '€'
  const siteName    = settings.site_name || 'Pygmy Shop'
  const siteUrl     = settings.site_url  || ''
  const logo        = settings.logo_url  || ''
  const taxReg      = settings.tax_registration_number || ''
  const taxEnabled  = settings.tax_enabled === '1'

  const itemRows = items.map(i => `
    <tr>
      <td class="item-name">${escHtml(i.name || i.product_name || '')}${i.variant_label ? `<br><small>${escHtml(i.variant_label)}</small>` : ''}</td>
      <td class="num">${i.quantity || i.qty || 1}</td>
      <td class="num">${currency}${parseFloat(i.unit_price || i.price || 0).toFixed(2)}</td>
      <td class="num">${currency}${(parseFloat(i.unit_price || i.price || 0) * (i.quantity || i.qty || 1)).toFixed(2)}</td>
    </tr>`).join('')

  const subtotal = parseFloat(order.subtotal || order.total || 0)
  const discount = parseFloat(order.discount_amount || 0)
  const shipping = parseFloat(order.shipping_cost   || 0)
  const tax      = parseFloat(order.tax_amount      || 0)
  const total    = parseFloat(order.total           || 0)
  const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${escHtml(order.order_number)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#222;background:#fff}
  .wrap{max-width:800px;margin:40px auto;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
  .brand{font-size:22px;font-weight:700;color:#c0392b}
  .brand img{max-height:48px}
  .invoice-meta{text-align:right}
  .invoice-meta h2{font-size:28px;font-weight:800;color:#c0392b;margin-bottom:4px}
  .invoice-meta p{color:#666;font-size:13px}
  hr{border:none;border-top:2px solid #eee;margin:24px 0}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}
  .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#aaa;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  thead th{background:#f7f7f7;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#666}
  thead th.num{text-align:right}
  tbody td{padding:10px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  .num{text-align:right}
  .item-name small{color:#888;font-size:12px}
  .totals{margin-left:auto;width:280px}
  .totals td{padding:6px 12px}
  .total-row td{font-weight:700;font-size:16px;border-top:2px solid #eee;padding-top:12px;color:#c0392b}
  .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:#e8f5e9;color:#2e7d32;text-transform:capitalize}
  .footer{margin-top:40px;font-size:12px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:20px}
  @media print{.wrap{margin:0;padding:20px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="brand">${logo ? `<img src="${siteUrl}${escHtml(logo)}" alt="${escHtml(siteName)}">` : escHtml(siteName)}</div>
    <div class="invoice-meta">
      <h2>INVOICE</h2>
      <p><strong>${escHtml(order.order_number)}</strong></p>
      <p>${orderDate}</p>
      <p style="margin-top:8px"><span class="badge">${escHtml(order.status || 'completed')}</span></p>
    </div>
  </div>
  <hr>
  <div class="two-col">
    <div>
      <div class="label">Bill To</div>
      <strong>${escHtml(order.customer_name || '')}</strong><br>
      ${order.customer_email ? `<a href="mailto:${escHtml(order.customer_email)}" style="color:#666">${escHtml(order.customer_email)}</a><br>` : ''}
      ${order.customer_phone ? `${escHtml(order.customer_phone)}<br>` : ''}
      ${order.shipping_address ? `<div style="margin-top:6px;color:#555">${escHtml(order.shipping_address).replace(/\n/g,'<br>')}</div>` : ''}
    </div>
    <div>
      <div class="label">Sold By</div>
      <strong>${escHtml(siteName)}</strong><br>
      ${siteUrl ? `<a href="${escHtml(siteUrl)}" style="color:#666">${escHtml(siteUrl)}</a><br>` : ''}
      ${taxEnabled && taxReg ? `<span style="color:#999;font-size:12px">Tax Reg: ${escHtml(taxReg)}</span>` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Total</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table class="totals">
    <tbody>
      <tr><td>Subtotal</td><td class="num">${currency}${subtotal.toFixed(2)}</td></tr>
      ${discount > 0 ? `<tr><td>Discount${order.coupon_code ? ` (${escHtml(order.coupon_code)})` : ''}</td><td class="num" style="color:#e74c3c">-${currency}${discount.toFixed(2)}</td></tr>` : ''}
      ${shipping > 0 ? `<tr><td>Shipping${order.shipping_rate_name ? ` (${escHtml(order.shipping_rate_name)})` : ''}</td><td class="num">${currency}${shipping.toFixed(2)}</td></tr>` : ''}
      ${taxEnabled && tax > 0 ? `<tr><td>${escHtml(order.tax_rate_name || 'VAT')}</td><td class="num">${currency}${tax.toFixed(2)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td class="num">${currency}${total.toFixed(2)}</td></tr>
    </tbody>
  </table>
  ${order.notes ? `<div style="margin-top:24px;padding:16px;background:#f9f9f9;border-radius:8px;font-size:13px;color:#555"><strong>Notes:</strong> ${escHtml(order.notes)}</div>` : ''}
  <div class="footer">
    ${siteUrl ? `<a href="${escHtml(siteUrl)}">${escHtml(siteUrl)}</a> · ` : ''}
    Thank you for your purchase!
  </div>
</div>
</body>
</html>`
}

// Public: GET /api/invoices/:orderNumber?email=
router.get('/:orderNumber', (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE order_number=?`).get(req.params.orderNumber)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  const email = (req.query.email || '').toLowerCase().trim()
  if (!email || order.customer_email?.toLowerCase() !== email) {
    return res.status(403).json({ error: 'Email does not match order' })
  }
  const html = buildInvoiceHTML(order, getSettings())
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// Admin: GET /api/invoices/:orderNumber/admin
router.get('/:orderNumber/admin', auth, (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE order_number=?`).get(req.params.orderNumber)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  const html = buildInvoiceHTML(order, getSettings())
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

export default router
