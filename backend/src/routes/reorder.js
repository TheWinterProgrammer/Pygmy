// Pygmy CMS — Inventory Reorder Points API (Phase 74)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

// GET /api/reorder — list products with reorder points
router.get('/', authMiddleware, (req, res) => {
  const { risk, q, limit = 100, offset = 0 } = req.query
  let where = [`track_stock = 1`]
  const params = []

  if (q) { where.push('(name LIKE ? OR sku LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }

  // Risk filter
  let having = ''
  if (risk === 'critical') having = `HAVING stock_quantity <= 0`
  else if (risk === 'low')  having = `HAVING reorder_point > 0 AND stock_quantity > 0 AND stock_quantity <= reorder_point`
  else if (risk === 'ok')   having = `HAVING reorder_point > 0 AND stock_quantity > reorder_point`
  else if (risk === 'no_reorder') having = `HAVING reorder_point = 0`

  const whereClause = `WHERE ${where.join(' AND ')}`

  const products = db.prepare(`
    SELECT
      p.id, p.name, p.sku, p.price, p.cover_image, p.category,
      p.stock_quantity, p.reorder_point, p.reorder_qty, p.low_stock_threshold, p.backorders_allowed,
      s.name as supplier_name,
      CASE
        WHEN p.stock_quantity <= 0 THEN 'critical'
        WHEN p.reorder_point > 0 AND p.stock_quantity <= p.reorder_point THEN 'low'
        WHEN p.reorder_point > 0 THEN 'ok'
        ELSE 'no_reorder'
      END as risk_level
    FROM products p
    LEFT JOIN suppliers s ON p.reorder_supplier_id = s.id
    ${whereClause}
    ${having}
    ORDER BY
      CASE WHEN stock_quantity <= 0 THEN 0
           WHEN reorder_point > 0 AND stock_quantity <= reorder_point THEN 1
           ELSE 2 END,
      stock_quantity ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM products ${whereClause}
  `).get(...params)?.c || 0

  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN reorder_point > 0 AND stock_quantity > 0 AND stock_quantity <= reorder_point THEN 1 ELSE 0 END) as at_reorder,
      SUM(CASE WHEN reorder_point > 0 AND stock_quantity > reorder_point THEN 1 ELSE 0 END) as ok,
      SUM(CASE WHEN reorder_point = 0 AND track_stock = 1 THEN 1 ELSE 0 END) as no_reorder,
      COUNT(*) as tracked
    FROM products WHERE track_stock = 1
  `).get()

  res.json({ products, total, stats })
})

// PUT /api/reorder/:productId — set reorder point/qty/supplier
router.put('/:productId', authMiddleware, (req, res) => {
  const { reorder_point, reorder_qty, reorder_supplier_id } = req.body
  db.prepare(`
    UPDATE products SET
      reorder_point = COALESCE(?, reorder_point),
      reorder_qty = COALESCE(?, reorder_qty),
      reorder_supplier_id = COALESCE(?, reorder_supplier_id),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    reorder_point ?? null,
    reorder_qty ?? null,
    reorder_supplier_id ?? null,
    req.params.productId
  )

  const product = db.prepare(`SELECT id, name, stock_quantity, reorder_point, reorder_qty FROM products WHERE id = ?`).get(req.params.productId)
  res.json(product)
})

// POST /api/reorder/bulk-set — bulk set reorder points
router.post('/bulk-set', authMiddleware, (req, res) => {
  const { updates } = req.body  // [{product_id, reorder_point, reorder_qty}]
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' })

  const stmt = db.prepare(`
    UPDATE products SET reorder_point = ?, reorder_qty = ?, updated_at = datetime('now') WHERE id = ?
  `)
  const run = db.transaction(() => {
    for (const u of updates) {
      stmt.run(u.reorder_point ?? 0, u.reorder_qty ?? 0, u.product_id)
    }
  })
  run()
  res.json({ ok: true, updated: updates.length })
})

// GET /api/reorder/alerts — recent alerts
router.get('/alerts', authMiddleware, (req, res) => {
  const alerts = db.prepare(`
    SELECT ra.*, p.name as product_name, p.sku
    FROM reorder_alerts ra
    JOIN products p ON ra.product_id = p.id
    ORDER BY ra.created_at DESC
    LIMIT 100
  `).all()
  res.json(alerts)
})

// POST /api/reorder/check — run reorder check + send notifications
router.post('/check', authMiddleware, async (req, res) => {
  const settings = db.prepare(`SELECT key, value FROM settings WHERE key IN ('reorder_alerts_enabled', 'reorder_alert_email', 'notify_email', 'site_name')`).all()
  const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]))

  if (cfg.reorder_alerts_enabled === '0') return res.json({ ok: true, checked: 0, alerts: [] })

  // Find products at or below reorder point that haven't been alerted recently (within 24h)
  const atRisk = db.prepare(`
    SELECT p.id, p.name, p.sku, p.stock_quantity, p.reorder_point, p.reorder_qty
    FROM products p
    WHERE p.track_stock = 1
      AND p.reorder_point > 0
      AND p.stock_quantity <= p.reorder_point
      AND NOT EXISTS (
        SELECT 1 FROM reorder_alerts ra
        WHERE ra.product_id = p.id
          AND ra.notified = 1
          AND ra.created_at > datetime('now', '-24 hours')
      )
  `).all()

  const insertAlert = db.prepare(`
    INSERT INTO reorder_alerts (product_id, stock_qty, reorder_point) VALUES (?, ?, ?)
  `)
  const markNotified = db.prepare(`UPDATE reorder_alerts SET notified = 1, notified_at = datetime('now') WHERE id = ?`)

  const newAlerts = []
  for (const p of atRisk) {
    const row = insertAlert.run(p.id, p.stock_quantity, p.reorder_point)
    newAlerts.push({ ...p, alert_id: row.lastInsertRowid })
  }

  // Send email if configured
  const alertEmail = cfg.reorder_alert_email || cfg.notify_email
  if (alertEmail && newAlerts.length > 0) {
    try {
      const rows = newAlerts.map(p =>
        `<tr><td>${p.name}</td><td style="text-align:center">${p.sku || '—'}</td><td style="text-align:center;color:${p.stock_quantity <= 0 ? '#e74c3c' : '#e67e22'}">${p.stock_quantity}</td><td style="text-align:center">${p.reorder_point}</td><td style="text-align:center">${p.reorder_qty || '—'}</td></tr>`
      ).join('')

      await sendMailTo(alertEmail, `⚠️ Reorder Alert — ${newAlerts.length} product(s) need restocking`, `
        <h2 style="color:#e67e22">⚠️ Reorder Alert from ${cfg.site_name || 'Pygmy'}</h2>
        <p>${newAlerts.length} product(s) have reached their reorder point and need restocking:</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif">
          <thead><tr style="background:#f5f5f5">
            <th>Product</th><th>SKU</th><th>Current Stock</th><th>Reorder Point</th><th>Suggested Qty</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px"><a href="${cfg.site_url || '#'}/admin/inventory">View Inventory</a></p>
      `)

      for (const a of newAlerts) markNotified.run(a.alert_id)
    } catch (err) {
      console.error('Reorder alert email failed:', err.message)
    }
  } else {
    for (const a of newAlerts) markNotified.run(a.alert_id)
  }

  res.json({ ok: true, checked: atRisk.length, alerts: newAlerts })
})

export default router
