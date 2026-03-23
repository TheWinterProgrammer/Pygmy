// waitlist.js — Product Waitlist (Phase 40)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const r = Router()

// ── Public: join waitlist ──────────────────────────────────────────────────────
r.post('/', async (req, res) => {
  const { product_id, email, name = '', variant_key = '' } = req.body
  if (!product_id || !email) return res.status(400).json({ error: 'product_id and email required' })

  const product = db.prepare('SELECT id, name, status, stock_quantity, track_stock, allow_backorder FROM products WHERE id = ?').get(product_id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  // Only allow joining if out of stock or product is unavailable
  const isOos = product.track_stock && product.stock_quantity <= 0 && !product.allow_backorder
  if (!isOos) return res.status(400).json({ error: 'Product is currently in stock — no waitlist needed' })

  try {
    db.prepare(`
      INSERT OR IGNORE INTO product_waitlist (product_id, email, name, variant_key)
      VALUES (?, ?, ?, ?)
    `).run(product_id, email.toLowerCase(), name, variant_key)
    res.json({ ok: true, message: 'You\'ve been added to the waitlist!' })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ── Public: check if email is on waitlist ──────────────────────────────────────
r.get('/check', (req, res) => {
  const { product_id, email, variant_key = '' } = req.query
  if (!product_id || !email) return res.status(400).json({ error: 'product_id and email required' })
  const entry = db.prepare(`
    SELECT id FROM product_waitlist WHERE product_id = ? AND email = ? AND variant_key = ?
  `).get(product_id, email.toLowerCase(), variant_key)
  res.json({ on_waitlist: !!entry })
})

// ── Admin: list waitlist entries ───────────────────────────────────────────────
r.get('/', auth, (req, res) => {
  const { product_id, notified, q, limit = 50, offset = 0 } = req.query
  let where = []
  const params = []

  if (product_id) { where.push('w.product_id = ?'); params.push(product_id) }
  if (notified !== undefined) { where.push('w.notified = ?'); params.push(notified === '1' ? 1 : 0) }
  if (q) { where.push('(w.email LIKE ? OR w.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const items = db.prepare(`
    SELECT w.*, p.name AS product_name, p.slug AS product_slug, p.stock_quantity
    FROM product_waitlist w
    JOIN products p ON p.id = w.product_id
    ${whereStr}
    ORDER BY w.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM product_waitlist w ${whereStr}
  `).get(...params).c

  res.json({ items, total })
})

// ── Admin: stats ───────────────────────────────────────────────────────────────
r.get('/stats', auth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM product_waitlist').get().c
  const pending = db.prepare('SELECT COUNT(*) as c FROM product_waitlist WHERE notified = 0').get().c
  const notified = db.prepare('SELECT COUNT(*) as c FROM product_waitlist WHERE notified = 1').get().c
  const products = db.prepare(`
    SELECT p.id, p.name, p.slug, p.stock_quantity, COUNT(w.id) AS watchers
    FROM product_waitlist w
    JOIN products p ON p.id = w.product_id
    WHERE w.notified = 0
    GROUP BY p.id
    ORDER BY watchers DESC
    LIMIT 10
  `).all()
  res.json({ total, pending, notified, products })
})

// ── Admin: notify waitlist for a product ──────────────────────────────────────
r.post('/notify/:productId', auth, async (req, res) => {
  const { productId } = req.params
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const settings = db.prepare('SELECT key, value FROM settings').all()
    .reduce((acc, s) => { acc[s.key] = s.value; return acc }, {})

  const siteUrl = settings.site_url || 'http://localhost:5174'
  const siteName = settings.site_name || 'Pygmy'

  const entries = db.prepare(`
    SELECT * FROM product_waitlist WHERE product_id = ? AND notified = 0
  `).all(productId)

  if (!entries.length) return res.json({ sent: 0, message: 'No pending waitlist entries' })

  let sent = 0
  for (const entry of entries) {
    const subject = (settings.waitlist_notify_email_subject || 'Good news! {{product}} is back in stock')
      .replace('{{product}}', product.name)

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#c84b4b">🎉 Good news from ${siteName}!</h2>
        <p>Hi ${entry.name || 'there'},</p>
        <p><strong>${product.name}</strong> is back in stock and ready for you!</p>
        <a href="${siteUrl}/shop/${product.slug}" style="display:inline-block;background:#c84b4b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Shop Now →
        </a>
        <p style="color:#888;font-size:12px;margin-top:32px">
          You signed up for back-in-stock alerts at ${siteName}.<br>
          <a href="${siteUrl}/shop/${product.slug}" style="color:#888">Visit store</a>
        </p>
      </div>
    `

    try {
      await sendMailTo(entry.email, subject, html)
      db.prepare('UPDATE product_waitlist SET notified = 1, notified_at = datetime(\'now\') WHERE id = ?').run(entry.id)
      sent++
    } catch {}
  }

  res.json({ sent, total: entries.length })
})

// ── Admin: delete entry ────────────────────────────────────────────────────────
r.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM product_waitlist WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default r
