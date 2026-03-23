// Pygmy CMS — SMS Notification Helper (Phase 48)
// Supports Twilio. Provider is loaded lazily so the app boots fine without credentials.

import db from './db.js'

function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'sms_%'").all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function logSms({ to, message, status, error = null, entityType = null, entityId = null }) {
  try {
    db.prepare(`
      INSERT INTO sms_log (to_number, message, status, error, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(to, message, status, error, entityType, String(entityId ?? ''))
  } catch {}
}

/**
 * Send an SMS via the configured provider.
 * @param {string} to  E.164 phone number (e.g. +491234567890)
 * @param {string} message  Plain-text body
 * @param {object} meta  Optional: { entityType, entityId }
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendSms(to, message, meta = {}) {
  const s = getSettings()
  if (s.sms_enabled !== '1') return { ok: false, error: 'SMS disabled' }
  if (!to || !message) return { ok: false, error: 'Missing to/message' }

  // Currently only Twilio is supported
  if (s.sms_provider === 'twilio') {
    const sid = s.sms_account_sid
    const token = s.sms_auth_token
    const from = s.sms_from_number
    if (!sid || !token || !from) {
      logSms({ to, message, status: 'failed', error: 'Twilio credentials not configured', ...meta })
      return { ok: false, error: 'Twilio credentials not configured' }
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
      const body = new URLSearchParams({ To: to, From: from, Body: message })
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      const json = await resp.json()
      if (resp.ok && json.sid) {
        logSms({ to, message, status: 'sent', ...meta })
        return { ok: true, sid: json.sid }
      } else {
        const errMsg = json.message || 'Twilio API error'
        logSms({ to, message, status: 'failed', error: errMsg, ...meta })
        return { ok: false, error: errMsg }
      }
    } catch (e) {
      logSms({ to, message, status: 'failed', error: e.message, ...meta })
      return { ok: false, error: e.message }
    }
  }

  return { ok: false, error: `Unknown SMS provider: ${s.sms_provider}` }
}

/**
 * Substitute {{variable}} placeholders in a template string.
 */
export function fillSmsTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

/**
 * Fire an order confirmation SMS to the customer (non-blocking).
 */
export async function sendOrderConfirmSms(order) {
  const s = getSettings()
  if (s.sms_enabled !== '1' || s.sms_order_confirm !== '1') return
  const phone = order.customer_phone?.trim()
  if (!phone) return

  const msg = fillSmsTemplate(s.sms_order_message || 'Your order {{order_number}} is confirmed!', {
    name: order.customer_name?.split(' ')[0] || 'there',
    order_number: order.order_number,
    total: `${order.total?.toFixed(2)}`,
  })
  sendSms(phone, msg, { entityType: 'order', entityId: order.id }).catch(() => {})

  // Admin notification
  if (s.sms_notify_admin === '1' && s.sms_admin_number) {
    const adminMsg = `New order ${order.order_number} from ${order.customer_name} — €${order.total?.toFixed(2)}`
    sendSms(s.sms_admin_number, adminMsg, { entityType: 'order', entityId: order.id }).catch(() => {})
  }
}

/**
 * Fire a shipped notification SMS to the customer (non-blocking).
 */
export async function sendShippedSms(order) {
  const s = getSettings()
  if (s.sms_enabled !== '1' || s.sms_order_shipped !== '1') return
  const phone = order.customer_phone?.trim()
  if (!phone) return

  const msg = fillSmsTemplate(s.sms_shipped_message || 'Your order {{order_number}} has shipped!', {
    name: order.customer_name?.split(' ')[0] || 'there',
    order_number: order.order_number,
    tracking_url: order.tracking_url || '',
  })
  sendSms(phone, msg, { entityType: 'order', entityId: order.id }).catch(() => {})
}
