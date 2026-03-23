// Pygmy CMS — Price Drop Alerts API (Phase 38)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

function getEmailCfg() {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN
    ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','site_name','site_url','shop_currency_symbol')
  `).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))
  return s
}

// ── POST /api/price-alerts/subscribe — Public: sign up for price drop ──────────
router.post('/subscribe', (req, res) => {
  const { product_id, email, name = '', target_price } = req.body
  if (!product_id || !email) {
    return res.status(400).json({ error: 'product_id and email are required' })
  }

  const product = db.prepare('SELECT id, name, price, sale_price FROM products WHERE id = ?').get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const currentPrice = product.sale_price || product.price

  try {
    db.prepare(`
      INSERT INTO price_alerts (product_id, email, name, target_price, current_price_at_signup)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(product_id, email) DO UPDATE SET
        target_price = excluded.target_price,
        current_price_at_signup = excluded.current_price_at_signup,
        notified = 0,
        notified_at = NULL,
        created_at = datetime('now')
    `).run(product_id, email.toLowerCase().trim(), name.trim(), target_price ?? null, currentPrice)

    res.json({ ok: true, message: "You'll be notified when the price drops." })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/price-alerts/unsubscribe — Public: remove alert by email+product
router.delete('/unsubscribe', (req, res) => {
  const { product_id, email } = req.body
  if (!product_id || !email) return res.status(400).json({ error: 'product_id and email required' })
  db.prepare('DELETE FROM price_alerts WHERE product_id = ? AND email = ?').run(product_id, email.toLowerCase().trim())
  res.json({ ok: true })
})

// ── GET /api/price-alerts — Admin: list alerts ─────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { product_id, notified, limit = 50, offset = 0 } = req.query
  let query = `
    SELECT pa.*, p.name AS product_name, p.slug AS product_slug, p.price AS current_price, p.sale_price
    FROM price_alerts pa
    JOIN products p ON p.id = pa.product_id
    WHERE 1=1
  `
  const params = []

  if (product_id) {
    query += ' AND pa.product_id = ?'
    params.push(product_id)
  }
  if (notified !== undefined) {
    query += ' AND pa.notified = ?'
    params.push(notified === '1' ? 1 : 0)
  }

  const total = db.prepare(query.replace(/SELECT pa\.\*.*?FROM/, 'SELECT COUNT(*) as cnt FROM')).get(...params)?.cnt || 0
  query += ' ORDER BY pa.created_at DESC LIMIT ? OFFSET ?'
  const items = db.prepare(query).all(...params, Number(limit), Number(offset))

  res.json({ items, total })
})

// ── GET /api/price-alerts/stats — Admin: overview ──────────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const pending  = db.prepare("SELECT COUNT(*) as c FROM price_alerts WHERE notified = 0").get()?.c ?? 0
  const notified = db.prepare("SELECT COUNT(*) as c FROM price_alerts WHERE notified = 1").get()?.c ?? 0
  const products = db.prepare("SELECT COUNT(DISTINCT product_id) as c FROM price_alerts WHERE notified = 0").get()?.c ?? 0
  const top = db.prepare(`
    SELECT p.id, p.name, p.slug, p.price, p.sale_price, COUNT(pa.id) as alert_count
    FROM price_alerts pa JOIN products p ON p.id = pa.product_id
    WHERE pa.notified = 0
    GROUP BY pa.product_id ORDER BY alert_count DESC LIMIT 5
  `).all()

  res.json({ pending, notified, products_with_alerts: products, top_products: top })
})

// ── POST /api/price-alerts/notify/:productId — Admin: send price drop emails ───
router.post('/notify/:productId', authMiddleware, async (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const currentPrice = product.sale_price || product.price
  const cfg = getEmailCfg()
  const symbol = cfg.shop_currency_symbol || '€'
  const siteName = cfg.site_name || 'Pygmy CMS'
  const siteUrl = cfg.site_url || 'http://localhost:5174'

  // Get pending alerts for this product
  const alerts = db.prepare(`
    SELECT * FROM price_alerts WHERE product_id = ? AND notified = 0
  `).all(product.id)

  if (!alerts.length) return res.json({ sent: 0, message: 'No pending alerts' })
  if (!cfg.smtp_host || !cfg.smtp_user) return res.status(400).json({ error: 'SMTP not configured' })

  let sent = 0, failed = 0
  for (const alert of alerts) {
    // Only notify if current price is lower than target price (or no target set)
    if (alert.target_price && currentPrice > parseFloat(alert.target_price)) continue
    try {
      await sendMailTo(cfg, alert.email, `Price Drop Alert — ${product.name}`, `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#e05a6a;">📉 Price Drop!</h2>
          <p>Hi ${alert.name || 'there'},</p>
          <p>Great news! The price of <strong>${product.name}</strong> has dropped.</p>
          <table style="border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 16px 8px 0;color:#999;">Previous price</td>
                <td style="padding:8px 0;text-decoration:line-through;">${symbol}${parseFloat(alert.current_price_at_signup).toFixed(2)}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;color:#999;">New price</td>
                <td style="padding:8px 0;font-size:1.25rem;font-weight:700;color:#e05a6a;">${symbol}${parseFloat(currentPrice).toFixed(2)}</td></tr>
          </table>
          <a href="${siteUrl}/shop/${product.slug}" style="display:inline-block;background:#e05a6a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Shop Now →</a>
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
          <p style="font-size:.8rem;color:#999;">${siteName} · <a href="${siteUrl}">Visit store</a></p>
        </div>
      `)
      db.prepare('UPDATE price_alerts SET notified = 1, notified_at = datetime(\'now\') WHERE id = ?').run(alert.id)
      sent++
    } catch { failed++ }
  }

  res.json({ sent, failed })
})

// ── DELETE /api/price-alerts/:id — Admin: delete alert ─────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM price_alerts WHERE id = ?').run(Number(req.params.id))
  res.json({ ok: true })
})

// ── Exported helper: auto-notify pending price alerts for a product ─────────────
export async function autoNotifyPriceDrop(productId, newPrice) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
  if (!product) return

  const cfg = getEmailCfg()
  if (!cfg.smtp_host || !cfg.smtp_user) return

  const symbol = cfg.shop_currency_symbol || '€'
  const siteName = cfg.site_name || 'Pygmy CMS'
  const siteUrl = cfg.site_url || 'http://localhost:5174'

  const alerts = db.prepare(`
    SELECT * FROM price_alerts WHERE product_id = ? AND notified = 0
  `).all(productId)

  for (const alert of alerts) {
    // Only notify if target price is met (or no specific target)
    if (alert.target_price && newPrice > parseFloat(alert.target_price)) continue
    // Only notify if price actually dropped vs signup price
    if (newPrice >= parseFloat(alert.current_price_at_signup)) continue

    try {
      await sendMailTo(cfg, alert.email, `Price Drop Alert — ${product.name}`, `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#e05a6a;">📉 Price Drop!</h2>
          <p>Hi ${alert.name || 'there'},</p>
          <p>Great news! The price of <strong>${product.name}</strong> has just dropped.</p>
          <table style="border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 16px 8px 0;color:#999;">Previous price</td>
                <td style="padding:8px 0;text-decoration:line-through;">${symbol}${parseFloat(alert.current_price_at_signup).toFixed(2)}</td></tr>
            <tr><td style="padding:8px 16px 8px 0;color:#999;">New price</td>
                <td style="padding:8px 0;font-size:1.25rem;font-weight:700;color:#e05a6a;">${symbol}${parseFloat(newPrice).toFixed(2)}</td></tr>
          </table>
          <a href="${siteUrl}/shop/${product.slug}" style="display:inline-block;background:#e05a6a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Shop Now →</a>
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
          <p style="font-size:.8rem;color:#999;">${siteName}</p>
        </div>
      `)
      db.prepare("UPDATE price_alerts SET notified = 1, notified_at = datetime('now') WHERE id = ?").run(alert.id)
    } catch { /* non-critical */ }
  }
}

export default router
