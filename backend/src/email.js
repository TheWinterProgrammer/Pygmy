// Pygmy CMS — Email notification service (nodemailer)
import nodemailer from 'nodemailer'
import db from './db.js'

/**
 * Load SMTP config from settings table.
 * Returns null if not configured.
 */
function getSmtpConfig() {
  const rows = db.prepare(`
    SELECT key, value FROM settings
    WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','notify_email',
                  'notify_new_comment','notify_new_contact','site_name')
  `).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))
  if (!s.smtp_host || !s.smtp_user || !s.smtp_pass || !s.notify_email) return null
  return s
}

/**
 * Send an email using configured SMTP.
 * Silently swallows errors (notifications are best-effort).
 */
async function sendMail({ subject, html, text }) {
  const cfg = getSmtpConfig()
  if (!cfg) return

  try {
    const transport = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port) || 587,
      secure: parseInt(cfg.smtp_port) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    })

    await transport.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to: cfg.notify_email,
      subject: `[${cfg.site_name || 'Pygmy CMS'}] ${subject}`,
      html,
      text,
    })
  } catch (err) {
    console.warn('📧 Email send failed (non-fatal):', err.message)
  }
}

// ─── Notification templates ───────────────────────────────────────────────────

export async function notifyNewComment({ postTitle, authorName, authorEmail, content, postUrl }) {
  const cfg = getSmtpConfig()
  if (!cfg || cfg.notify_new_comment !== '1') return

  await sendMail({
    subject: `New comment on "${postTitle}"`,
    text: `${authorName} (${authorEmail}) left a comment:\n\n${content}\n\nPost: ${postUrl}`,
    html: `
      <h2>New comment on <em>${postTitle}</em></h2>
      <p><strong>${authorName}</strong> &lt;${authorEmail}&gt; wrote:</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:1em;color:#555">${content.replace(/\n/g, '<br>')}</blockquote>
      <p><a href="${postUrl}">View post →</a></p>
      <hr>
      <small>Pygmy CMS — go to your admin panel to approve or mark as spam.</small>
    `,
  })
}

export async function notifyNewContact({ name, email, subject, message }) {
  const cfg = getSmtpConfig()
  if (!cfg || cfg.notify_new_contact !== '1') return

  await sendMail({
    subject: `New contact message${subject ? ': ' + subject : ''}`,
    text: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
    html: `
      <h2>New contact message</h2>
      <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
      ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
      <p><strong>Message:</strong></p>
      <blockquote style="border-left:3px solid #ccc;padding-left:1em;color:#555">${message.replace(/\n/g, '<br>')}</blockquote>
      <hr>
      <small>Pygmy CMS — reply directly to this email or use your admin panel.</small>
    `,
  })
}

/**
 * Send a direct email (to any address, not just notify_email).
 * Used for customer-facing transactional emails.
 */
async function sendMailTo({ to, subject, html, text }) {
  const cfg = getSmtpConfig()
  if (!cfg) return

  try {
    const transport = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port) || 587,
      secure: parseInt(cfg.smtp_port) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    })

    await transport.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject,
      html,
      text,
    })
  } catch (err) {
    console.warn(`📧 Transactional email to ${to} failed (non-fatal):`, err.message)
  }
}

/**
 * Shared order email HTML wrapper — dark glass-inspired branded template.
 */
function orderEmailHtml({ siteName, heading, bodyHtml, footerNote = '' }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#1a1a1e; font-family: 'Segoe UI', Arial, sans-serif; color:#e2e2e8; }
    .wrap { max-width:600px; margin:2rem auto; background:#22232a; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
    .header { background:hsl(355,70%,30%); padding:1.5rem 2rem; }
    .header h1 { margin:0; font-size:1.3rem; color:#fff; font-weight:700; letter-spacing:.03em; }
    .header .site-name { font-size:.85rem; color:rgba(255,255,255,.7); margin-top:.2rem; }
    .body { padding:2rem; }
    .body h2 { margin:0 0 .75rem; font-size:1.1rem; color:#e2e2e8; }
    .body p { margin:0 0 1rem; line-height:1.6; color:#b0b0c0; font-size:.92rem; }
    .order-table { width:100%; border-collapse:collapse; margin:1.25rem 0; font-size:.88rem; }
    .order-table th { text-align:left; padding:.4rem .75rem; color:#888; font-weight:600; border-bottom:1px solid rgba(255,255,255,.08); }
    .order-table td { padding:.5rem .75rem; border-bottom:1px solid rgba(255,255,255,.05); color:#ccc; vertical-align:top; }
    .order-table td.price { text-align:right; white-space:nowrap; }
    .totals { margin:1rem 0; background:rgba(255,255,255,.04); border-radius:8px; padding:.75rem 1rem; }
    .totals-row { display:flex; justify-content:space-between; font-size:.88rem; padding:.25rem 0; color:#b0b0c0; }
    .totals-row.total { font-weight:700; font-size:1rem; color:#e2e2e8; border-top:1px solid rgba(255,255,255,.08); padding-top:.5rem; margin-top:.25rem; }
    .badge { display:inline-block; padding:.25em .65em; border-radius:999px; font-size:.78rem; font-weight:600; background:hsl(355,70%,22%); color:hsl(355,70%,70%); }
    .footer { padding:1.25rem 2rem; border-top:1px solid rgba(255,255,255,.06); font-size:.78rem; color:#555; text-align:center; }
    a { color:hsl(355,70%,58%); }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${heading}</h1>
      <div class="site-name">${siteName}</div>
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">${footerNote || `© ${new Date().getFullYear()} ${siteName}`}</div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Build a simple text + HTML items table from an order's items array.
 */
function buildItemsTable(items, currencySymbol = '€') {
  const html = `
    <table class="order-table">
      <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th class="price">Total</th></tr></thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td>${i.name || i.product_id}</td>
            <td>${i.quantity}</td>
            <td>${currencySymbol}${Number(i.unit_price || 0).toFixed(2)}</td>
            <td class="price">${currencySymbol}${Number(i.line_total || 0).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
  const text = items.map(i =>
    `  ${i.name || i.product_id} × ${i.quantity}  —  ${currencySymbol}${Number(i.line_total || 0).toFixed(2)}`
  ).join('\n')
  return { html, text }
}

/**
 * Load order-related settings from DB.
 */
function getOrderEmailSettings() {
  const rows = db.prepare(`
    SELECT key, value FROM settings
    WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','notify_email',
                  'notify_new_order','notify_order_status','site_name',
                  'shop_currency_symbol','order_confirmation_subject','order_status_subject')
  `).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))
  return s
}

/**
 * Send order confirmation email to customer + admin notification.
 * Called after a successful order creation.
 */
export async function sendOrderConfirmation(order) {
  const cfg = getOrderEmailSettings()
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) return

  const siteName = cfg.site_name || 'Pygmy CMS'
  const sym = cfg.shop_currency_symbol || '€'
  const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || [])
  const { html: itemsHtml, text: itemsText } = buildItemsTable(items, sym)

  const discountRow = order.discount_amount > 0
    ? `<div class="totals-row"><span>Discount (${order.coupon_code})</span><span>−${sym}${Number(order.discount_amount).toFixed(2)}</span></div>`
    : ''
  const discountText = order.discount_amount > 0
    ? `\nDiscount (${order.coupon_code}): -${sym}${Number(order.discount_amount).toFixed(2)}`
    : ''

  // ─── Customer confirmation ─────────────────────────────────────────────────
  const custSubject = (cfg.order_confirmation_subject || 'Your order has been received — #{order_number}')
    .replace('#{order_number}', order.order_number)

  const custBodyHtml = `
    <h2>Hi ${order.customer_name},</h2>
    <p>Thanks for your order! We've received it and will be in touch shortly.</p>
    <p><strong>Order number:</strong> <span class="badge">${order.order_number}</span></p>
    ${itemsHtml}
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${sym}${Number(order.subtotal).toFixed(2)}</span></div>
      ${discountRow}
      <div class="totals-row total"><span>Total</span><span>${sym}${Number(order.total).toFixed(2)}</span></div>
    </div>
    ${order.shipping_address ? `<p><strong>Shipping to:</strong><br>${order.shipping_address.replace(/\n/g, '<br>')}</p>` : ''}
  `

  const custBodyText = `Hi ${order.customer_name},\n\nThanks for your order!\n\nOrder: ${order.order_number}\n\n${itemsText}${discountText}\nTotal: ${sym}${Number(order.total).toFixed(2)}`

  await sendMailTo({
    to: order.customer_email,
    subject: custSubject,
    html: orderEmailHtml({ siteName, heading: `Order Confirmed ✓`, bodyHtml: custBodyHtml }),
    text: custBodyText,
  })

  // ─── Admin notification ────────────────────────────────────────────────────
  if (cfg.notify_new_order === '1' && cfg.notify_email) {
    const adminBodyHtml = `
      <h2>New order placed</h2>
      <p><strong>Order:</strong> <span class="badge">${order.order_number}</span><br>
         <strong>Customer:</strong> ${order.customer_name} &lt;${order.customer_email}&gt;<br>
         ${order.customer_phone ? `<strong>Phone:</strong> ${order.customer_phone}<br>` : ''}
         ${order.shipping_address ? `<strong>Shipping:</strong><br>${order.shipping_address.replace(/\n/g, '<br>')}` : ''}
      </p>
      ${itemsHtml}
      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><span>${sym}${Number(order.subtotal).toFixed(2)}</span></div>
        ${discountRow}
        <div class="totals-row total"><span>Total</span><span>${sym}${Number(order.total).toFixed(2)}</span></div>
      </div>
      ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
    `

    const cfg2 = getSmtpConfig()
    if (cfg2) {
      try {
        const transport = nodemailer.createTransport({
          host: cfg2.smtp_host,
          port: parseInt(cfg2.smtp_port) || 587,
          secure: parseInt(cfg2.smtp_port) === 465,
          auth: { user: cfg2.smtp_user, pass: cfg2.smtp_pass },
        })
        await transport.sendMail({
          from: cfg2.smtp_from || cfg2.smtp_user,
          to: cfg2.notify_email,
          subject: `[${siteName}] New Order ${order.order_number} — ${sym}${Number(order.total).toFixed(2)}`,
          html: orderEmailHtml({ siteName, heading: `New Order: ${order.order_number}`, bodyHtml: adminBodyHtml }),
          text: `New order ${order.order_number} from ${order.customer_name} (${order.customer_email})\nTotal: ${sym}${Number(order.total).toFixed(2)}\n\n${itemsText}`,
        })
      } catch (err) {
        console.warn('📧 Admin order notification failed (non-fatal):', err.message)
      }
    }
  }
}

/**
 * Send order status update email to customer.
 * Called when admin changes the order status.
 */
export async function sendOrderStatusUpdate(order) {
  const cfg = getOrderEmailSettings()
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) return
  if (cfg.notify_order_status !== '1') return

  const siteName = cfg.site_name || 'Pygmy CMS'
  const sym = cfg.shop_currency_symbol || '€'
  const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || [])
  const { html: itemsHtml } = buildItemsTable(items, sym)

  const statusMessages = {
    pending:     'Your order has been received and is awaiting processing.',
    processing:  'Great news! Your order is now being processed.',
    shipped:     'Your order is on its way! 🚀',
    completed:   'Your order has been delivered. Thank you for shopping with us!',
    cancelled:   'Your order has been cancelled. Please contact us if you have questions.',
    refunded:    'Your refund has been processed. Please allow a few business days to reflect.',
  }

  const statusMsg = statusMessages[order.status] || `Your order status has been updated to: ${order.status}.`

  const subject = (cfg.order_status_subject || 'Order #{order_number} status update')
    .replace('#{order_number}', order.order_number)

  const bodyHtml = `
    <h2>Hi ${order.customer_name},</h2>
    <p>${statusMsg}</p>
    <p><strong>Order number:</strong> <span class="badge">${order.order_number}</span><br>
       <strong>New status:</strong> ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
    ${itemsHtml}
    <div class="totals">
      <div class="totals-row total"><span>Total</span><span>${sym}${Number(order.total).toFixed(2)}</span></div>
    </div>
    ${order.notes ? `<p><strong>Order notes:</strong> ${order.notes}</p>` : ''}
  `

  await sendMailTo({
    to: order.customer_email,
    subject,
    html: orderEmailHtml({ siteName, heading: `Order Update: ${order.order_number}`, bodyHtml }),
    text: `Hi ${order.customer_name},\n\n${statusMsg}\n\nOrder: ${order.order_number}\nStatus: ${order.status}\nTotal: ${sym}${Number(order.total).toFixed(2)}`,
  })
}

export async function sendTestEmail() {
  return sendMail({
    subject: 'Test email from Pygmy CMS',
    text: 'If you received this, your SMTP settings are working correctly.',
    html: '<p>If you received this, your <strong>SMTP settings</strong> are working correctly. 🎉</p>',
  })
}

export async function sendNewsletterCampaign({ to, name, subject, content, unsubscribeToken, siteName, siteUrl }) {
  const cfg = getSmtpConfig()
  if (!cfg) return

  const unsubUrl = `${siteUrl.replace(/\/$/, '')}/api/newsletter/unsubscribe?token=${unsubscribeToken}`
  const greeting = name ? `Hi ${name},` : 'Hello,'

  try {
    const transport = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port) || 587,
      secure: parseInt(cfg.smtp_port) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    })

    await transport.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${siteName}] ${subject}`,
      text: `${greeting}\n\n${content}\n\n---\nUnsubscribe: ${unsubUrl}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <p>${greeting}</p>
          <div style="line-height:1.6">${content.replace(/\n/g, '<br>')}</div>
          <hr style="margin-top:2rem;border:none;border-top:1px solid #ddd">
          <p style="font-size:0.8rem;color:#888">
            You're receiving this because you subscribed to ${siteName}.<br>
            <a href="${unsubUrl}" style="color:#888">Unsubscribe</a>
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.warn(`📧 Newsletter send to ${to} failed (non-fatal):`, err.message)
  }
}
