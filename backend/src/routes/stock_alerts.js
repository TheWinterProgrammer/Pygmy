// Pygmy CMS — Back-in-Stock Alerts API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo as sendEmail } from '../email.js'

const router = Router()

// ── POST /api/stock-alerts/subscribe — Public: sign up for restock alert ─────
router.post('/subscribe', (req, res) => {
  const { product_id, email, name = '' } = req.body
  if (!product_id || !email) {
    return res.status(400).json({ error: 'product_id and email are required' })
  }

  const product = db.prepare("SELECT id, name, status, stock_quantity, track_stock, allow_backorder FROM products WHERE id = ?").get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  // If product is actually in stock, no need to sign up
  if (product.track_stock) {
    if (product.stock_quantity > 0 || product.allow_backorder) {
      return res.status(400).json({ error: 'This product is already in stock.' })
    }
  }

  try {
    db.prepare(`
      INSERT INTO stock_alerts (product_id, email, name)
      VALUES (?, ?, ?)
      ON CONFLICT(product_id, email) DO UPDATE SET notified = 0, notified_at = NULL, created_at = datetime('now')
    `).run(product_id, email.toLowerCase().trim(), name.trim())

    res.json({ ok: true, message: "You'll be notified when this product is back in stock." })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/stock-alerts?product_id= — Admin: list alerts ───────────────────
router.get('/', authMiddleware, (req, res) => {
  const { product_id, notified, limit = 50, offset = 0 } = req.query
  let query = `
    SELECT sa.*, p.name AS product_name, p.slug AS product_slug, p.stock_quantity
    FROM stock_alerts sa
    JOIN products p ON p.id = sa.product_id
    WHERE 1=1
  `
  const params = []

  if (product_id) {
    query += ' AND sa.product_id = ?'
    params.push(product_id)
  }
  if (notified !== undefined) {
    query += ' AND sa.notified = ?'
    params.push(notified === '1' ? 1 : 0)
  }

  const total = db.prepare(query.replace(/SELECT sa\.\*.*?FROM/, 'SELECT COUNT(*) as cnt FROM')).get(...params)?.cnt || 0
  query += ' ORDER BY sa.created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  const rows = db.prepare(query).all(...params)
  res.json({ alerts: rows, total })
})

// ── GET /api/stock-alerts/stats — Admin: overview stats ──────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as cnt FROM stock_alerts WHERE notified = 0").get().cnt
  const notified = db.prepare("SELECT COUNT(*) as cnt FROM stock_alerts WHERE notified = 1").get().cnt
  const products = db.prepare("SELECT COUNT(DISTINCT product_id) as cnt FROM stock_alerts WHERE notified = 0").get().cnt

  // Top products with most alerts
  const top = db.prepare(`
    SELECT sa.product_id, p.name, p.slug, p.stock_quantity, COUNT(*) as alert_count
    FROM stock_alerts sa
    JOIN products p ON p.id = sa.product_id
    WHERE sa.notified = 0
    GROUP BY sa.product_id
    ORDER BY alert_count DESC
    LIMIT 5
  `).all()

  res.json({ pending: total, notified, products_with_alerts: products, top_products: top })
})

// ── POST /api/stock-alerts/notify — Admin: manually send restock emails ───────
// Body: { product_id } — send to all pending subscribers for that product
router.post('/notify', authMiddleware, async (req, res) => {
  const { product_id } = req.body
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const alerts = db.prepare("SELECT * FROM stock_alerts WHERE product_id = ? AND notified = 0").all(product_id)
  if (!alerts.length) return res.json({ sent: 0, message: 'No pending alerts for this product.' })

  const settings = db.prepare("SELECT key, value FROM settings").all()
  const s = Object.fromEntries(settings.map(r => [r.key, r.value]))
  const siteUrl = s.site_url || 'http://localhost:5174'
  const siteName = s.site_name || 'Pygmy'
  const accentColor = s.accent_color || '#e05260'

  let sent = 0
  let errors = 0

  for (const alert of alerts) {
    try {
      const productUrl = `${siteUrl}/shop/${product.slug}`
      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#1a1a20;color:#e0e0e0;border-radius:12px;overflow:hidden;">
          <div style="background:${accentColor};padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:22px;">Back in Stock! 🎉</h1>
          </div>
          <div style="padding:32px;">
            <p>Hi ${alert.name || 'there'},</p>
            <p>Great news! <strong>${product.name}</strong> is back in stock and ready to order.</p>
            <div style="margin:24px 0;text-align:center;">
              <a href="${productUrl}" style="background:${accentColor};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
                Shop Now →
              </a>
            </div>
            <p style="font-size:13px;color:#888;">Don't wait — stock may be limited!</p>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0;">
            <p style="font-size:12px;color:#666;">You requested a back-in-stock alert from ${siteName}. If this wasn't you, please ignore this email.</p>
          </div>
        </div>
      `

      await sendEmail({
        to: alert.email,
        subject: `Back in Stock: ${product.name} — ${siteName}`,
        html,
      })

      db.prepare("UPDATE stock_alerts SET notified = 1, notified_at = datetime('now') WHERE id = ?").run(alert.id)
      sent++
    } catch (e) {
      errors++
    }
  }

  res.json({ sent, errors, total: alerts.length })
})

// ── DELETE /api/stock-alerts/:id — Admin: remove an alert ────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare("DELETE FROM stock_alerts WHERE id = ?").run(req.params.id)
  res.json({ ok: true })
})

// ─── Helper: auto-notify when product restocked ───────────────────────────────
export async function autoNotifyRestock(productId) {
  const pending = db.prepare("SELECT COUNT(*) as cnt FROM stock_alerts WHERE product_id = ? AND notified = 0").get(productId)
  if (!pending?.cnt) return

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId)
  if (!product) return

  const settings = db.prepare("SELECT key, value FROM settings").all()
  const s = Object.fromEntries(settings.map(r => [r.key, r.value]))
  const siteUrl = s.site_url || 'http://localhost:5174'
  const siteName = s.site_name || 'Pygmy'
  const accentColor = s.accent_color || '#e05260'

  const alerts = db.prepare("SELECT * FROM stock_alerts WHERE product_id = ? AND notified = 0").all(productId)
  for (const alert of alerts) {
    try {
      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#1a1a20;color:#e0e0e0;border-radius:12px;overflow:hidden;">
          <div style="background:${accentColor};padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:22px;">Back in Stock! 🎉</h1>
          </div>
          <div style="padding:32px;">
            <p>Hi ${alert.name || 'there'},</p>
            <p><strong>${product.name}</strong> is back in stock!</p>
            <div style="margin:24px 0;text-align:center;">
              <a href="${siteUrl}/shop/${product.slug}" style="background:${accentColor};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
                Shop Now →
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0;">
            <p style="font-size:12px;color:#666;">You requested a back-in-stock alert from ${siteName}.</p>
          </div>
        </div>
      `
      await sendEmail({ to: alert.email, subject: `Back in Stock: ${product.name} — ${siteName}`, html })
      db.prepare("UPDATE stock_alerts SET notified = 1, notified_at = datetime('now') WHERE id = ?").run(alert.id)
    } catch {}
  }
}

export default router
