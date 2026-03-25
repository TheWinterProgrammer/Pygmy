// Pygmy CMS — Product Label / Barcode Printer API (Phase 74)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/product-labels/products — list products for label printing
router.get('/products', authMiddleware, (req, res) => {
  const { q, category, limit = 100, offset = 0 } = req.query
  let where = []
  const params = []

  if (q) { where.push('(name LIKE ? OR sku LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (category) { where.push('category = ?'); params.push(category) }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const products = db.prepare(`
    SELECT id, name, slug, sku, price, sale_price, category, cover_image, stock_quantity, barcode
    FROM products
    ${whereClause}
    ORDER BY name ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset))

  const total = db.prepare(`SELECT COUNT(*) as c FROM products ${whereClause}`).get(...params)?.c || 0
  res.json({ products, total })
})

// GET /api/product-labels/print?ids=1,2,3&template=standard — print HTML page
router.get('/print', authMiddleware, (req, res) => {
  const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean)
  const template = req.query.template || 'standard'  // standard | compact | price_tag | shelf
  const copies = Math.min(parseInt(req.query.copies || 1), 10)
  const show_price = req.query.show_price !== '0'
  const show_sku = req.query.show_sku !== '0'
  const show_barcode = req.query.show_barcode !== '0'

  if (!ids.length) return res.status(400).json({ error: 'No product IDs provided' })

  const placeholders = ids.map(() => '?').join(',')
  const products = db.prepare(`
    SELECT id, name, sku, price, sale_price, cover_image, category
    FROM products WHERE id IN (${placeholders})
  `).all(...ids)

  if (!products.length) return res.status(404).json({ error: 'No products found' })

  // Settings for site info
  const settings = db.prepare(`SELECT key, value FROM settings WHERE key IN ('site_name', 'site_url', 'shop_currency_symbol')`).all()
  const cfg = Object.fromEntries(settings.map(s => [s.key, s.value]))
  const currency = cfg.shop_currency_symbol || '€'
  const siteName = cfg.site_name || 'Pygmy Store'

  // Generate barcode SVG (simple Code128-style visual using bars)
  function barcodePattern (text) {
    // Simple visual barcode: alternate bar widths based on char codes
    const bars = []
    let x = 0
    const guard = [2, 1, 2] // start/end guard bars
    guard.forEach(w => { bars.push({ x, w, fill: '#000' }); x += w + 1 })
    for (const ch of text) {
      const code = ch.charCodeAt(0)
      const wide = code % 3 === 0 ? 3 : code % 3 === 1 ? 2 : 1
      bars.push({ x, w: wide, fill: '#000' })
      x += wide + 1
      bars.push({ x, w: 1, fill: 'transparent' })
      x += 2
    }
    guard.forEach(w => { bars.push({ x, w, fill: '#000' }); x += w + 1 })
    const svgBars = bars.filter(b => b.fill === '#000')
      .map(b => `<rect x="${b.x}" y="0" width="${b.w}" height="40" fill="#000"/>`)
      .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="50" viewBox="0 0 ${x} 50">
      ${svgBars}
      <text x="${x/2}" y="48" text-anchor="middle" font-size="7" font-family="monospace">${text}</text>
    </svg>`
  }

  // Repeat products by copies
  const printItems = []
  for (const p of products) {
    for (let c = 0; c < copies; c++) printItems.push(p)
  }

  const templateStyles = {
    standard: `
      .label { width: 90mm; height: 50mm; padding: 4mm; box-sizing: border-box; border: 1px solid #ccc; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; }
      .label-name { font-size: 10pt; font-weight: bold; line-height: 1.2; overflow: hidden; max-height: 2.4em; }
      .label-sku { font-size: 7pt; color: #666; margin-top: 1mm; }
      .label-price { font-size: 14pt; font-weight: bold; color: #222; }
      .label-barcode { margin-top: 1mm; }
      .label-barcode svg { height: 30px; max-width: 100%; }
      .labels { display: flex; flex-wrap: wrap; gap: 3mm; padding: 5mm; }
    `,
    compact: `
      .label { width: 50mm; height: 30mm; padding: 2mm; box-sizing: border-box; border: 1px solid #ccc; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; }
      .label-name { font-size: 7pt; font-weight: bold; }
      .label-sku { font-size: 6pt; color: #666; }
      .label-price { font-size: 10pt; font-weight: bold; }
      .label-barcode svg { height: 20px; max-width: 100%; }
      .labels { display: flex; flex-wrap: wrap; gap: 2mm; padding: 3mm; }
    `,
    price_tag: `
      .label { width: 60mm; height: 40mm; padding: 3mm; box-sizing: border-box; border: 2px solid #000; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-inside: avoid; }
      .label-name { font-size: 9pt; font-weight: bold; }
      .label-price { font-size: 20pt; font-weight: bold; margin: 1mm 0; }
      .label-sku { font-size: 6pt; color: #666; }
      .label-barcode svg { height: 22px; max-width: 90%; }
      .labels { display: flex; flex-wrap: wrap; gap: 4mm; padding: 5mm; }
    `,
    shelf: `
      .label { width: 120mm; height: 30mm; padding: 3mm 4mm; box-sizing: border-box; border-bottom: 2px solid #333; display: flex; flex-direction: row; align-items: center; gap: 4mm; page-break-inside: avoid; }
      .label-name { font-size: 9pt; font-weight: bold; flex: 1; }
      .label-sku { font-size: 6pt; color: #666; }
      .label-price { font-size: 16pt; font-weight: bold; white-space: nowrap; }
      .label-barcode svg { height: 22px; }
      .labels { display: flex; flex-direction: column; gap: 0; padding: 5mm; }
    `,
  }

  const styles = templateStyles[template] || templateStyles.standard

  const labelsHtml = printItems.map(p => {
    const barcodeVal = p.sku || `PRD-${p.id}`
    const displayPrice = p.sale_price ? `<span style="text-decoration:line-through;font-size:9pt;color:#999">${currency}${parseFloat(p.price).toFixed(2)}</span> ${currency}${parseFloat(p.sale_price).toFixed(2)}` : `${currency}${parseFloat(p.price).toFixed(2)}`

    if (template === 'shelf') {
      return `
        <div class="label">
          <div>
            <div class="label-name">${p.name}</div>
            ${show_sku && p.sku ? `<div class="label-sku">SKU: ${p.sku}</div>` : ''}
          </div>
          ${show_barcode ? `<div class="label-barcode">${barcodePattern(barcodeVal)}</div>` : ''}
          ${show_price ? `<div class="label-price">${displayPrice}</div>` : ''}
        </div>`
    }

    return `
      <div class="label">
        <div class="label-name">${p.name}</div>
        ${show_sku && p.sku ? `<div class="label-sku">SKU: ${p.sku}</div>` : ''}
        ${show_price ? `<div class="label-price">${displayPrice}</div>` : ''}
        ${show_barcode ? `<div class="label-barcode">${barcodePattern(barcodeVal)}</div>` : ''}
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${siteName} — Product Labels</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; color: #000; }
    @page { margin: 5mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
    .no-print { position: fixed; top: 10px; right: 10px; z-index: 100; padding: 8px 16px; background: #333; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    ${styles}
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()">🖨️ Print Labels</button>
  <div class="labels">${labelsHtml}</div>
</body>
</html>`

  res.set('Content-Type', 'text/html')
  res.send(html)
})

// PUT /api/product-labels/barcode/:productId — set custom barcode on product
router.put('/barcode/:productId', authMiddleware, (req, res) => {
  const { barcode } = req.body
  db.prepare(`UPDATE products SET barcode = ?, updated_at = datetime('now') WHERE id = ?`).run(barcode || null, req.params.productId)
  res.json({ ok: true })
})

export default router
