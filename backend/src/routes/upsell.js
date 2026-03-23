// Pygmy CMS — Post-Purchase Upsell Offers (Phase 39)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// GET /api/upsell/stats
router.get('/stats', auth, (req, res) => {
  const total   = db.prepare(`SELECT COUNT(*) AS c FROM upsell_offers`).get().c
  const active  = db.prepare(`SELECT COUNT(*) AS c FROM upsell_offers WHERE active=1`).get().c
  const conv    = db.prepare(`SELECT COUNT(*) AS c FROM upsell_conversions`).get().c
  const revenue = db.prepare(`SELECT IFNULL(SUM(revenue),0) AS r FROM upsell_conversions`).get().r
  res.json({ total, active, conversions: conv, revenue })
})

// GET /api/upsell/active?order_number=&product_ids=
router.get('/active', (req, res) => {
  const { order_number, product_ids } = req.query
  if (!order_number) return res.json(null)

  const enabled = db.prepare(`SELECT value FROM settings WHERE key='upsell_enabled'`).get()
  if (!enabled || enabled.value !== '1') return res.json(null)

  const alreadyConverted = db.prepare(`SELECT 1 FROM upsell_conversions WHERE order_number=?`).get(order_number)
  if (alreadyConverted) return res.json(null)

  const btnYes = db.prepare(`SELECT value FROM settings WHERE key='upsell_button_text'`).get()
  const btnNo  = db.prepare(`SELECT value FROM settings WHERE key='upsell_decline_text'`).get()

  let offer = db.prepare(`
    SELECT u.*, p.name AS product_name, p.price AS product_price, p.sale_price,
           p.cover_image, p.excerpt, p.slug AS product_slug
    FROM upsell_offers u
    JOIN products p ON p.id = u.product_id AND p.status='published'
    WHERE u.active=1 AND u.trigger_type='any'
    ORDER BY u.sort_order ASC LIMIT 1
  `).get()

  if (!offer && product_ids) {
    const ids = String(product_ids).split(',').map(Number).filter(Boolean)
    if (ids.length) {
      offer = db.prepare(`
        SELECT u.*, p.name AS product_name, p.price AS product_price, p.sale_price,
               p.cover_image, p.excerpt, p.slug AS product_slug
        FROM upsell_offers u
        JOIN products p ON p.id = u.product_id AND p.status='published'
        WHERE u.active=1 AND u.trigger_type='product'
              AND CAST(u.trigger_value AS INTEGER) IN (${ids.join(',')})
        ORDER BY u.sort_order ASC LIMIT 1
      `).get()
    }
  }

  if (!offer) return res.json(null)

  const basePrice   = parseFloat(offer.sale_price || offer.product_price || 0)
  const upsellPrice = offer.discount_pct > 0
    ? Math.round(basePrice * (1 - offer.discount_pct / 100) * 100) / 100
    : basePrice

  res.json({
    ...offer,
    upsell_price: upsellPrice,
    button_yes:   btnYes?.value || 'Yes! Add to My Order',
    button_no:    btnNo?.value  || 'No thanks',
  })
})

// GET /api/upsell
router.get('/', auth, (req, res) => {
  const offers = db.prepare(`
    SELECT u.*, p.name AS product_name, p.price AS product_price, p.cover_image,
           (SELECT COUNT(*) FROM upsell_conversions uc WHERE uc.offer_id = u.id) AS conversions,
           (SELECT IFNULL(SUM(uc.revenue),0) FROM upsell_conversions uc WHERE uc.offer_id = u.id) AS revenue
    FROM upsell_offers u
    JOIN products p ON p.id = u.product_id
    ORDER BY u.sort_order ASC, u.id DESC
  `).all()
  res.json(offers)
})

// POST /api/upsell
router.post('/', auth, (req, res) => {
  const { product_id, trigger_type, trigger_value, headline, subtext, discount_pct, active, sort_order } = req.body
  if (!product_id) return res.status(400).json({ error: 'product_id required' })
  const info = db.prepare(`
    INSERT INTO upsell_offers (product_id, trigger_type, trigger_value, headline, subtext, discount_pct, active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(product_id, trigger_type || 'any', trigger_value || '', headline || 'Special One-Time Offer!', subtext || '', discount_pct || 0, active !== false ? 1 : 0, sort_order || 0)
  res.json({ id: info.lastInsertRowid })
})

// PUT /api/upsell/:id
router.put('/:id', auth, (req, res) => {
  const { product_id, trigger_type, trigger_value, headline, subtext, discount_pct, active, sort_order } = req.body
  db.prepare(`
    UPDATE upsell_offers SET product_id=?, trigger_type=?, trigger_value=?, headline=?, subtext=?, discount_pct=?, active=?, sort_order=?
    WHERE id=?
  `).run(product_id, trigger_type || 'any', trigger_value || '', headline, subtext || '', discount_pct || 0, active !== false ? 1 : 0, sort_order || 0, req.params.id)
  res.json({ ok: true })
})

// DELETE /api/upsell/:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM upsell_offers WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/upsell/:id/convert
router.post('/:id/convert', (req, res) => {
  const { order_number, revenue } = req.body
  if (!order_number) return res.status(400).json({ error: 'order_number required' })
  db.prepare(`INSERT INTO upsell_conversions (offer_id, order_number, revenue) VALUES (?, ?, ?)`).run(req.params.id, order_number, revenue || 0)
  res.json({ ok: true })
})

export default router
