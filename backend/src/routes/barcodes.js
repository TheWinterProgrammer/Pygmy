// Pygmy CMS — Barcode/QR Generator API (Phase 72)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/barcodes/product/:id — get QR data for a product
router.get('/product/:id', authMiddleware, (req, res) => {
  const product = db.prepare('SELECT id, name, slug, sku, price FROM products WHERE id = ?').get(req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const settings = db.prepare("SELECT value FROM settings WHERE key = 'site_url'").get()
  const siteUrl = settings?.value || 'http://localhost:5174'
  const productUrl = `${siteUrl}/shop/${product.slug}`

  res.json({
    product,
    qr_data: productUrl,
    barcode_data: product.sku || `PYGMY-${product.id}`,
    product_url: productUrl
  })
})

// GET /api/barcodes/products — bulk QR data for all/selected products
router.get('/products', authMiddleware, (req, res) => {
  const { ids } = req.query // comma-separated product IDs
  const settings = db.prepare("SELECT value FROM settings WHERE key = 'site_url'").get()
  const siteUrl = settings?.value || 'http://localhost:5174'

  let products
  if (ids) {
    const idArr = ids.split(',').map(Number).filter(Boolean)
    const placeholders = idArr.map(() => '?').join(',')
    products = db.prepare(`SELECT id, name, slug, sku, price FROM products WHERE id IN (${placeholders})`).all(...idArr)
  } else {
    products = db.prepare("SELECT id, name, slug, sku, price FROM products WHERE status = 'published' ORDER BY name LIMIT 100").all()
  }

  const result = products.map(p => ({
    product: p,
    qr_data: `${siteUrl}/shop/${p.slug}`,
    barcode_data: p.sku || `PYGMY-${p.id}`,
    product_url: `${siteUrl}/shop/${p.slug}`
  }))

  res.json(result)
})

// GET /api/barcodes/print/:id — printable HTML page with QR code and barcode
router.get('/print/:id', authMiddleware, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('site_url', 'site_name')").all()
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]))
  const siteUrl = settingsMap.site_url || 'http://localhost:5174'
  const siteName = settingsMap.site_name || 'Pygmy'
  const productUrl = `${siteUrl}/shop/${product.slug}`
  const sku = product.sku || `PYGMY-${product.id}`
  const price = product.sale_price || product.price

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Product Label — ${product.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .label-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px; }
    .label {
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px;
      width: 200px;
      text-align: center;
      page-break-inside: avoid;
    }
    .label-name { font-weight: 700; font-size: 12px; margin-bottom: 6px; line-height: 1.3; }
    .label-sku { font-size: 10px; color: #666; margin-bottom: 6px; font-family: monospace; }
    .label-price { font-size: 16px; font-weight: 900; color: #c0392b; margin-bottom: 6px; }
    .qr-wrap { display: flex; justify-content: center; margin: 8px 0; }
    .label-site { font-size: 9px; color: #999; margin-top: 4px; }
    .controls { padding: 16px; display: flex; gap: 12px; }
    .btn { padding: 8px 16px; border-radius: 6px; cursor: pointer; border: none; font-size: 14px; }
    .btn-primary { background: #c0392b; color: white; }
    .btn-secondary { background: #eee; color: #333; }
    @media print { .controls { display: none; } }
  </style>
</head>
<body>
  <div class="controls">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Print Labels</button>
    <button class="btn btn-secondary" onclick="history.back()">← Back</button>
    <span style="font-size:13px;color:#666;line-height:2;margin-left:8px;">Showing label for: <strong>${product.name}</strong></span>
  </div>
  <div class="label-grid" id="labels"></div>
  <script>
    const COUNT = 9; // 3×3 grid
    const container = document.getElementById('labels');
    for (let i = 0; i < COUNT; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'label';
      wrapper.innerHTML = \`
        <div class="label-name">${product.name}</div>
        <div class="label-sku">SKU: ${sku}</div>
        <div class="label-price">€${Number(price || 0).toFixed(2)}</div>
        <div class="qr-wrap" id="qr-\${i}"></div>
        <div class="label-site">${siteName}</div>
      \`;
      container.appendChild(wrapper);
      new QRCode(document.getElementById('qr-' + i), {
        text: '${productUrl}',
        width: 96,
        height: 96,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  </script>
</body>
</html>`

  res.set('Content-Type', 'text/html').send(html)
})

// GET /api/barcodes/sheet — bulk label sheet
router.get('/sheet', authMiddleware, (req, res) => {
  const { ids, copies = 1 } = req.query
  if (!ids) return res.status(400).json({ error: 'ids required' })

  const idArr = ids.split(',').map(Number).filter(Boolean)
  const placeholders = idArr.map(() => '?').join(',')
  const products = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...idArr)
  if (!products.length) return res.status(404).json({ error: 'No products found' })

  const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('site_url', 'site_name')").all()
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]))
  const siteUrl = settingsMap.site_url || 'http://localhost:5174'
  const siteName = settingsMap.site_name || 'Pygmy'

  const labelItems = []
  for (const p of products) {
    for (let i = 0; i < Number(copies); i++) {
      labelItems.push(p)
    }
  }

  const labelsHtml = labelItems.map((p, idx) => {
    const sku = p.sku || `PYGMY-${p.id}`
    const price = p.sale_price || p.price
    const url = `${siteUrl}/shop/${p.slug}`
    return `<div class="label">
      <div class="label-name">${p.name}</div>
      <div class="label-sku">SKU: ${sku}</div>
      <div class="label-price">€${Number(price || 0).toFixed(2)}</div>
      <div class="qr-wrap" id="qr-${idx}"></div>
      <div class="label-site">${siteName}</div>
      <script>
        (function(){
          var qr = new QRCode(document.getElementById('qr-${idx}'), {
            text: '${url}', width: 80, height: 80,
            colorDark: '#000', colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.M
          });
        })();
      </scr\ipt>
    </div>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Product Labels</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .label-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 16px; }
    .label { border: 1px solid #333; border-radius: 8px; padding: 10px; text-align: center; page-break-inside: avoid; }
    .label-name { font-weight: 700; font-size: 11px; margin-bottom: 4px; line-height: 1.3; }
    .label-sku { font-size: 9px; color: #666; margin-bottom: 4px; font-family: monospace; }
    .label-price { font-size: 14px; font-weight: 900; color: #c0392b; margin-bottom: 4px; }
    .qr-wrap { display: flex; justify-content: center; margin: 6px 0; }
    .label-site { font-size: 8px; color: #999; }
    .controls { padding: 16px; display: flex; gap: 12px; }
    .btn { padding: 8px 16px; border-radius: 6px; cursor: pointer; border: none; font-size: 14px; }
    .btn-primary { background: #c0392b; color: white; }
    @media print { .controls { display: none; } }
  </style>
</head>
<body>
  <div class="controls">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Print ${labelItems.length} Labels</button>
    <button class="btn" style="background:#eee" onclick="history.back()">← Back</button>
  </div>
  <div class="label-grid">
    ${labelsHtml}
  </div>
</body>
</html>`

  res.set('Content-Type', 'text/html').send(html)
})

export default router
