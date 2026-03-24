// Pygmy CMS — Order Print View (Phase 61)
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'pygmy-dev-secret-change-in-production'

function authGuard(req, res, next) {
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

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function statusColor(status) {
  const map = {
    pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6',
    completed: '#10b981', cancelled: '#ef4444', refunded: '#6b7280'
  }
  return map[status] || '#6b7280'
}

// ── GET /api/order-print/:orderNumber — printable order detail ────────────────
router.get('/:orderNumber', authGuard, (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE order_number = ?`).get(req.params.orderNumber)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const settings = getSettings()
  const currency = settings.shop_currency_symbol || '€'
  const siteName = settings.site_name || 'Pygmy'
  const items = JSON.parse(order.items || '[]')

  // Fetch shipments if available
  let shipments = []
  try {
    shipments = db.prepare(`SELECT * FROM order_shipments WHERE order_id = ? ORDER BY created_at`).all(order.id)
  } catch (_) {}

  // Fetch order tags if available
  let tags = []
  try {
    tags = db.prepare(`SELECT tag, color FROM order_tags WHERE order_id = ?`).all(order.id)
  } catch (_) {}

  // Fetch timeline if available
  let timeline = []
  try {
    timeline = db.prepare(`
      SELECT event_type, description, actor_name, created_at
      FROM order_timeline WHERE order_id = ? ORDER BY created_at
    `).all(order.id)
  } catch (_) {}

  const itemRows = items.map(it => `
    <tr>
      <td>${esc(it.name)}${it.variant_label ? `<br><small style="color:#888">${esc(it.variant_label)}</small>` : ''}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:right">${currency}${(it.unit_price || 0).toFixed(2)}</td>
      <td style="text-align:right">${currency}${((it.unit_price || 0) * (it.quantity || 1)).toFixed(2)}</td>
    </tr>
  `).join('')

  const trackingSection = shipments.length ? `
    <div class="section">
      <h3>Shipments &amp; Tracking</h3>
      ${shipments.map(s => `
        <div class="shipment-card">
          <strong>${esc(s.carrier || 'Carrier')}</strong>
          ${s.tracking_number ? `<span class="tracking-num">${esc(s.tracking_number)}</span>` : ''}
          ${s.tracking_url ? `<a href="${esc(s.tracking_url)}" class="track-link" target="_blank">Track Shipment →</a>` : ''}
          <span class="status-pill" style="background:${statusColor(s.status)}">${esc(s.status)}</span>
          ${s.shipped_at ? `<span class="meta">Shipped: ${new Date(s.shipped_at).toLocaleDateString()}</span>` : ''}
          ${s.notes ? `<div class="notes">${esc(s.notes)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : ''

  const timelineSection = timeline.length ? `
    <div class="section no-print">
      <h3>Order Timeline</h3>
      <div class="timeline">
        ${timeline.map(t => `
          <div class="tl-item">
            <div class="tl-dot"></div>
            <div class="tl-body">
              <div class="tl-event">${esc(t.event_type?.replace(/_/g,' '))}</div>
              <div class="tl-desc">${esc(t.description || '')}</div>
              <div class="tl-meta">${t.actor_name ? esc(t.actor_name) + ' · ' : ''}${new Date(t.created_at).toLocaleString()}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : ''

  const tagsHtml = tags.length ? `
    <div class="tags-row">
      ${tags.map(t => `<span class="tag-pill" style="background:${esc(t.color || '#6b7280')}">${esc(t.tag)}</span>`).join('')}
    </div>
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Order ${esc(order.order_number)} — ${esc(siteName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 24px; max-width: 860px; margin: 0 auto; }
    .print-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; background: #d94f5a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
    .print-btn:hover { background: #c0404b; }
    @media print { .print-btn { display: none !important; } .no-print { display: none !important; } }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 20px; }
    .site-name { font-size: 20px; font-weight: 800; color: #111; }
    .order-meta { text-align: right; }
    .order-num { font-size: 18px; font-weight: 700; }
    .status-pill { display: inline-block; padding: 3px 10px; border-radius: 99px; color: white; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta { color: #6b7280; font-size: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    @media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
    .info-block h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 8px; }
    .info-block p { line-height: 1.7; }
    .section { margin-bottom: 24px; }
    .section h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
    table.items { width: 100%; border-collapse: collapse; }
    table.items th { background: #f9fafb; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    table.items td { padding: 10px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    table.items tr:last-child td { border-bottom: none; }
    .totals { margin-left: auto; max-width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .totals-row.grand { font-size: 16px; font-weight: 800; border-top: 2px solid #111; margin-top: 6px; padding-top: 10px; }
    .notes-box { background: #fefce8; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; }
    .shipment-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .tracking-num { font-family: monospace; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
    .track-link { color: #d94f5a; text-decoration: none; font-weight: 600; }
    .tags-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .tag-pill { color: white; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 99px; }
    .timeline { border-left: 2px solid #e5e7eb; padding-left: 16px; }
    .tl-item { position: relative; padding: 0 0 16px 0; }
    .tl-dot { position: absolute; left: -20px; top: 3px; width: 8px; height: 8px; background: #d94f5a; border-radius: 50%; }
    .tl-event { font-weight: 600; text-transform: capitalize; }
    .tl-desc { color: #4b5563; margin-top: 2px; }
    .tl-meta { color: #9ca3af; font-size: 11px; margin-top: 2px; }
    .footer { text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print Order</button>

  <div class="header">
    <div>
      <div class="site-name">${esc(siteName)}</div>
      ${settings.site_url ? `<div class="meta">${esc(settings.site_url)}</div>` : ''}
    </div>
    <div class="order-meta">
      <div class="order-num">${esc(order.order_number)}</div>
      <div style="margin:4px 0">
        <span class="status-pill" style="background:${statusColor(order.status)}">${esc(order.status)}</span>
      </div>
      <div class="meta">Placed: ${new Date(order.created_at).toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' })}</div>
      ${tagsHtml}
    </div>
  </div>

  <div class="grid-2">
    <div class="info-block">
      <h4>Customer</h4>
      <p>
        <strong>${esc(order.customer_name)}</strong><br>
        ${esc(order.customer_email)}<br>
        ${order.customer_phone ? esc(order.customer_phone) : ''}
      </p>
    </div>
    <div class="info-block">
      <h4>Shipping Address</h4>
      <p>${esc(order.shipping_address || 'N/A').replace(/\n/g,'<br>')}</p>
      ${order.shipping_country ? `<p class="meta" style="margin-top:4px">Country: ${esc(order.shipping_country)}</p>` : ''}
    </div>
  </div>

  ${order.coupon_code || order.notes ? `
  <div class="grid-2">
    ${order.coupon_code ? `<div class="info-block"><h4>Coupon</h4><p>${esc(order.coupon_code)}</p></div>` : '<div></div>'}
    ${order.notes ? `<div class="info-block"><h4>Order Notes</h4><div class="notes-box">${esc(order.notes)}</div></div>` : '<div></div>'}
  </div>
  ` : ''}

  <div class="section">
    <h3>Items</h3>
    <table class="items">
      <thead>
        <tr>
          <th>Product</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals" style="margin-top:16px">
      <div class="totals-row"><span>Subtotal</span><span>${currency}${(order.subtotal ?? order.total).toFixed(2)}</span></div>
      ${order.discount_amount > 0 ? `<div class="totals-row"><span>Discount${order.coupon_code ? ` (${esc(order.coupon_code)})` : ''}</span><span>−${currency}${order.discount_amount.toFixed(2)}</span></div>` : ''}
      ${order.auto_discount_amount > 0 ? `<div class="totals-row"><span>Auto Discount</span><span>−${currency}${order.auto_discount_amount.toFixed(2)}</span></div>` : ''}
      ${order.shipping_cost > 0 ? `<div class="totals-row"><span>Shipping${order.shipping_rate_name ? ` (${esc(order.shipping_rate_name)})` : ''}</span><span>${currency}${order.shipping_cost.toFixed(2)}</span></div>` : (order.shipping_cost === 0 && order.shipping_country ? `<div class="totals-row"><span>Shipping</span><span>Free</span></div>` : '')}
      ${order.tax_amount > 0 ? `<div class="totals-row"><span>Tax${order.tax_rate_name ? ` (${esc(order.tax_rate_name)})` : ''}</span><span>${currency}${order.tax_amount.toFixed(2)}</span></div>` : ''}
      ${order.charity_amount > 0 ? `<div class="totals-row"><span>Charity Donation</span><span>${currency}${order.charity_amount.toFixed(2)}</span></div>` : ''}
      <div class="totals-row grand"><span>Total</span><span>${currency}${order.total.toFixed(2)}</span></div>
    </div>
  </div>

  ${trackingSection}
  ${timelineSection}

  <div class="footer">
    ${esc(siteName)} · Order ${esc(order.order_number)} · Generated ${new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' })}
  </div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

export default router
