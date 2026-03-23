// packing_slips.js — Packing Slips (Phase 40)
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'pygmy-dev-secret-change-in-production'

const r = Router()

function authGuard(req, res, next) {
  // Accept Bearer header or ?token= query param (for browser <a> links)
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

r.get('/:orderNumber', authGuard, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, c.first_name, c.last_name, c.email AS c_email
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.order_number = ?
  `).get(req.params.orderNumber)

  if (!order) return res.status(404).json({ error: 'Order not found' })

  const settings = db.prepare('SELECT key, value FROM settings').all()
    .reduce((acc, s) => { acc[s.key] = s.value; return acc }, {})

  let items = []
  try { items = JSON.parse(order.items || '[]') } catch {}

  const siteName = settings.site_name || 'Pygmy'
  const siteUrl = settings.site_url || ''
  const logo = settings.logo || ''
  const symbol = settings.shop_currency_symbol || '€'

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee">${item.name || ''}${item.variant_label ? ` <span style="color:#888;font-size:12px">(${item.variant_label})</span>` : ''}${item.customizations ? `<br><span style="color:#555;font-size:11px">${
        Object.entries(item.customizations || {}).map(([k,v]) => `${k}: ${v}`).join(' · ')
      }</span>` : ''}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center">${item.quantity || 1}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right">${symbol}${Number(item.unit_price || item.price || 0).toFixed(2)}</td>
    </tr>
  `).join('')

  const shippingAddr = order.shipping_address || ''
  const customerEmail = order.customer_email || order.c_email || ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Packing Slip — ${order.order_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; background: #fff; padding: 32px; max-width: 700px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #222; padding-bottom: 20px; }
    .site-name { font-size: 22px; font-weight: 700; color: #222; }
    .slip-label { font-size: 18px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .meta { font-size: 12px; color: #555; margin-top: 4px; }
    .order-info { display: flex; gap: 24px; margin-bottom: 24px; }
    .info-block { flex: 1; padding: 14px; border: 1px solid #ddd; border-radius: 6px; }
    .info-block h4 { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 8px; }
    .info-block p { font-size: 13px; line-height: 1.6; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #e8f4fd; color: #1a6fa0; }
    .status-badge.completed { background: #e8fbe8; color: #1a7a1a; }
    .status-badge.pending { background: #fff8e1; color: #9a6a00; }
    .status-badge.cancelled { background: #fde8e8; color: #a01a1a; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    thead th { background: #f5f5f5; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
    thead th:nth-child(2), thead th:nth-child(3) { text-align: center; }
    thead th:last-child { text-align: right; }
    .totals { margin-top: 8px; border-top: 2px solid #222; padding-top: 12px; max-width: 260px; margin-left: auto; }
    .totals tr td { padding: 5px 4px; font-size: 13px; }
    .totals tr td:last-child { text-align: right; font-weight: 600; }
    .totals .grand-total td { font-size: 15px; font-weight: 700; border-top: 1px solid #222; padding-top: 10px; }
    .notes { margin-top: 24px; padding: 14px; background: #fffde7; border: 1px solid #f5e27a; border-radius: 6px; }
    .notes h4 { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 6px; }
    .footer { margin-top: 36px; border-top: 1px solid #ddd; padding-top: 16px; text-align: center; color: #999; font-size: 11px; }
    .barcode-area { margin-top: 24px; text-align: center; padding: 16px; border: 1px dashed #ccc; border-radius: 6px; }
    .barcode-text { font-family: monospace; font-size: 18px; letter-spacing: 4px; color: #333; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none !important; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px">
    <button onclick="window.print()" style="background:#222;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px">🖨️ Print Packing Slip</button>
  </div>

  <div class="header">
    <div>
      ${logo ? `<img src="${siteUrl}${logo}" alt="${siteName}" style="height:40px;margin-bottom:8px;display:block">` : `<div class="site-name">${siteName}</div>`}
      <div class="slip-label">Packing Slip</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:700">#${order.order_number}</div>
      <div class="meta">Ordered: ${new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div style="margin-top:6px">
        <span class="status-badge ${order.status}">${order.status}</span>
      </div>
    </div>
  </div>

  <div class="order-info">
    <div class="info-block">
      <h4>Ship To</h4>
      <p>
        <strong>${order.customer_name || ''}</strong><br>
        ${shippingAddr ? shippingAddr.replace(/\n/g, '<br>') : '<em style="color:#999">No address provided</em>'}
      </p>
    </div>
    <div class="info-block">
      <h4>Customer</h4>
      <p>
        ${customerEmail ? `📧 ${customerEmail}<br>` : ''}
        ${order.customer_phone ? `📞 ${order.customer_phone}<br>` : ''}
        ${order.shipping_country ? `🌍 ${order.shipping_country}` : ''}
      </p>
    </div>
    <div class="info-block">
      <h4>Shipping Method</h4>
      <p>
        ${order.shipping_rate_name || '<em style="color:#999">Standard</em>'}<br>
        ${order.shipping_cost > 0 ? `Cost: ${symbol}${Number(order.shipping_cost).toFixed(2)}` : '<span style="color:#1a7a1a">Free Shipping</span>'}
      </p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr>
        <td>Subtotal</td>
        <td>${symbol}${Number(order.subtotal || 0).toFixed(2)}</td>
      </tr>
      ${order.discount_amount > 0 ? `<tr><td>Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}</td><td style="color:#1a7a1a">−${symbol}${Number(order.discount_amount).toFixed(2)}</td></tr>` : ''}
      ${order.shipping_cost > 0 ? `<tr><td>Shipping</td><td>${symbol}${Number(order.shipping_cost).toFixed(2)}</td></tr>` : ''}
      ${order.tax_amount > 0 ? `<tr><td>Tax${order.tax_rate_name ? ` (${order.tax_rate_name})` : ''}</td><td>${symbol}${Number(order.tax_amount).toFixed(2)}</td></tr>` : ''}
      <tr class="grand-total">
        <td>Total</td>
        <td>${symbol}${Number(order.total).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${order.notes ? `<div class="notes"><h4>Order Notes</h4><p>${order.notes}</p></div>` : ''}

  <div class="barcode-area">
    <div style="font-size:11px;color:#999;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Order Reference</div>
    <div class="barcode-text">${order.order_number}</div>
  </div>

  <div class="footer">
    ${siteUrl ? `<a href="${siteUrl}" style="color:#999">${siteUrl}</a> · ` : ''}Thank you for your order!
  </div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html')
  res.send(html)
})

export default r
