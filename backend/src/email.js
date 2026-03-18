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
