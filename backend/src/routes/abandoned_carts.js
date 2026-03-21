// Pygmy CMS — Abandoned Cart Recovery API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

// ─── Public: Track / update an abandoned cart ─────────────────────────────────
// POST /api/abandoned-carts/track
// Body: { session_id, email?, name?, items[], subtotal }
// Called by the frontend cart store on item add / checkout page entry.
router.post('/track', (req, res) => {
  const { session_id, email = '', name = '', items = [], subtotal = 0 } = req.body
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
  const itemsJson = JSON.stringify(items)

  const existing = db.prepare('SELECT id FROM abandoned_carts WHERE session_id = ?').get(session_id)
  if (existing) {
    db.prepare(`
      UPDATE abandoned_carts
      SET email = COALESCE(NULLIF(?, ''), email),
          name  = COALESCE(NULLIF(?, ''), name),
          items = ?, subtotal = ?,
          updated_at = datetime('now')
      WHERE session_id = ?
    `).run(email, name, itemsJson, subtotal, session_id)
  } else {
    db.prepare(`
      INSERT INTO abandoned_carts (session_id, email, name, items, subtotal, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(session_id, email, name, itemsJson, subtotal, ip)
  }

  res.json({ ok: true })
})

// ─── Public: Mark cart recovered (called on successful order) ─────────────────
// POST /api/abandoned-carts/recover
// Body: { session_id }
router.post('/recover', (req, res) => {
  const { session_id } = req.body
  if (!session_id) return res.json({ ok: true })
  db.prepare(`
    UPDATE abandoned_carts SET recovered = 1, updated_at = datetime('now') WHERE session_id = ?
  `).run(session_id)
  res.json({ ok: true })
})

// ─── Admin: List abandoned carts ──────────────────────────────────────────────
// GET /api/abandoned-carts
// Query: ?q=, ?recovered=0|1, ?notified=0|1, ?hours_old=1
router.get('/', authMiddleware, (req, res) => {
  const { q, recovered, notified, hours_old = 1, limit = 50, offset = 0 } = req.query

  let sql = `SELECT * FROM abandoned_carts WHERE 1=1`
  const params = []

  // Only show carts idle for at least N hours by default (genuinely abandoned)
  const minHours = parseFloat(hours_old) || 1
  sql += ` AND updated_at <= datetime('now', '-${minHours} hours')`

  if (recovered !== undefined) { sql += ' AND recovered = ?'; params.push(parseInt(recovered)) }
  if (notified !== undefined)  { sql += ' AND notified = ?';  params.push(parseInt(notified)) }
  if (q) {
    sql += ' AND (email LIKE ? OR name LIKE ?)'
    params.push(`%${q}%`, `%${q}%`)
  }

  sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  const rows = db.prepare(sql).all(...params)

  const parsed = rows.map(r => ({
    ...r,
    items: JSON.parse(r.items || '[]'),
  }))

  const total = db.prepare(`
    SELECT COUNT(*) as n FROM abandoned_carts
    WHERE updated_at <= datetime('now', '-${minHours} hours') AND recovered = 0
  `).get().n

  res.json({ carts: parsed, total })
})

// ─── Admin: Send recovery email to one or many carts ─────────────────────────
// POST /api/abandoned-carts/notify
// Body: { ids: [1,2,3] }
router.post('/notify', authMiddleware, async (req, res) => {
  const { ids = [] } = req.body
  if (!ids.length) return res.status(400).json({ error: 'ids required' })

  const settingRows = db.prepare(`
    SELECT key, value FROM settings
    WHERE key IN ('site_name','site_url','shop_currency_symbol','smtp_host','smtp_user','smtp_pass','smtp_from','notify_email')
  `).all()
  const s = {}
  settingRows.forEach(r => (s[r.key] = r.value))
  const siteUrl = s.site_url || 'http://localhost:5174'
  const siteName = s.site_name || 'Pygmy CMS'
  const sym = s.shop_currency_symbol || '€'

  let sent = 0, skipped = 0

  for (const id of ids) {
    const cart = db.prepare('SELECT * FROM abandoned_carts WHERE id = ?').get(id)
    if (!cart || !cart.email) { skipped++; continue }

    const items = JSON.parse(cart.items || '[]')
    const itemRows = items.map(i =>
      `<tr>
        <td style="padding:.4rem .75rem;">${i.name || i.product_name || 'Product'}</td>
        <td style="padding:.4rem .75rem; text-align:center;">×${i.quantity}</td>
        <td style="padding:.4rem .75rem; text-align:right;">${sym}${Number(i.unit_price || 0).toFixed(2)}</td>
      </tr>`
    ).join('')

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Your cart is waiting</title></head>
<body style="font-family:sans-serif;color:#111;background:#f9f9f9;margin:0;padding:0;">
  <div style="max-width:560px;margin:2rem auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#111;color:#fff;padding:1.5rem 2rem;">
      <h1 style="margin:0;font-size:1.4rem;">${siteName}</h1>
      <p style="margin:.3rem 0 0;opacity:.7;font-size:.9rem;">You left something behind…</p>
    </div>
    <div style="padding:1.75rem 2rem;">
      <p>Hi${cart.name ? ' ' + cart.name.split(' ')[0] : ''},</p>
      <p>You left items in your cart. Your selection is saved — head back and complete your purchase.</p>
      <table style="width:100%;border-collapse:collapse;margin:1.25rem 0;">
        <thead>
          <tr style="border-bottom:2px solid #eee;">
            <th style="text-align:left;padding:.4rem .75rem;font-size:.8rem;color:#666;">Item</th>
            <th style="padding:.4rem .75rem;font-size:.8rem;color:#666;">Qty</th>
            <th style="text-align:right;padding:.4rem .75rem;font-size:.8rem;color:#666;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr style="border-top:2px solid #eee;">
            <td colspan="2" style="padding:.6rem .75rem;font-weight:700;">Total</td>
            <td style="text-align:right;padding:.6rem .75rem;font-weight:700;">${sym}${Number(cart.subtotal).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="text-align:center;margin:1.5rem 0;">
        <a href="${siteUrl}/checkout" style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;padding:.75rem 2rem;border-radius:6px;font-weight:700;font-size:1rem;">Complete My Order →</a>
      </div>
      <p style="font-size:.85rem;color:#666;">This email was sent because you started a checkout on ${siteName}. If this wasn't you, please ignore this message.</p>
    </div>
  </div>
</body></html>`

    try {
      await sendMailTo({
        to: cart.email,
        subject: `You left something in your cart — ${siteName}`,
        html,
        text: `Hi${cart.name ? ' ' + cart.name : ''},\n\nYou left items in your cart totalling ${sym}${Number(cart.subtotal).toFixed(2)}.\n\nComplete your order: ${siteUrl}/checkout`,
      })
      db.prepare(`
        UPDATE abandoned_carts SET notified = 1, notified_at = datetime('now') WHERE id = ?
      `).run(id)
      sent++
    } catch {
      skipped++
    }
  }

  res.json({ ok: true, sent, skipped })
})

// ─── Admin: Delete cart record ────────────────────────────────────────────────
// DELETE /api/abandoned-carts/:id
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM abandoned_carts WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Admin: Stats ─────────────────────────────────────────────────────────────
// GET /api/abandoned-carts/stats
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) as n FROM abandoned_carts WHERE recovered = 0 AND updated_at <= datetime('now', '-1 hours')`).get().n
  const notified = db.prepare(`SELECT COUNT(*) as n FROM abandoned_carts WHERE notified = 1 AND recovered = 0`).get().n
  const recovered = db.prepare(`SELECT COUNT(*) as n FROM abandoned_carts WHERE recovered = 1`).get().n
  const revenue = db.prepare(`SELECT COALESCE(SUM(subtotal), 0) as v FROM abandoned_carts WHERE recovered = 0 AND updated_at <= datetime('now', '-1 hours')`).get().v
  res.json({ total, notified, recovered, revenue })
})

export default router
