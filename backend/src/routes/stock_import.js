// Pygmy CMS — Bulk Stock CSV Import (Phase 70)
import { Router } from 'express'
import multer from 'multer'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'
import { logStockChange } from './stock_history.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// Parse simple CSV with quoting support
function parseCsvLine(line) {
  const fields = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      fields.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur.trim())
  return fields
}

// GET /api/stock-import/template — download CSV template
router.get('/template', authMiddleware, (req, res) => {
  const csv = 'sku,stock_quantity,low_stock_threshold\n' +
    'EXAMPLE-SKU-001,25,5\n' +
    'EXAMPLE-SKU-002,0,3\n'
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="stock-import-template.csv"')
  res.send(csv)
})

// GET /api/stock-import/history — list past imports
router.get('/history', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM stock_imports ORDER BY created_at DESC LIMIT 50').all()
  rows.forEach(r => {
    try { r.errors = JSON.parse(r.errors) } catch { r.errors = [] }
  })
  res.json(rows)
})

// POST /api/stock-import — upload and process CSV
router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const csv = req.file.buffer.toString('utf8')
  const lines = csv.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return res.status(400).json({ error: 'CSV is empty or has no data rows' })

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
  const skuIdx = headers.indexOf('sku')
  const qtyIdx = headers.indexOf('stock_quantity')
  const threshIdx = headers.indexOf('low_stock_threshold')

  if (skuIdx === -1 || qtyIdx === -1) {
    return res.status(400).json({ error: 'CSV must have columns: sku, stock_quantity' })
  }

  let updated = 0, skipped = 0
  const errors = []

  const processRows = db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i])
      const sku = row[skuIdx]?.trim()
      const qtyRaw = row[qtyIdx]?.trim()

      if (!sku) { errors.push(`Row ${i+1}: empty SKU`); skipped++; continue }

      const qty = parseInt(qtyRaw, 10)
      if (isNaN(qty) || qty < 0) {
        errors.push(`Row ${i+1}: invalid quantity "${qtyRaw}" for SKU ${sku}`)
        skipped++; continue
      }

      const product = db.prepare('SELECT id, stock_quantity FROM products WHERE sku = ?').get(sku)
      if (!product) {
        errors.push(`Row ${i+1}: SKU not found "${sku}"`)
        skipped++; continue
      }

      // Update stock
      const oldQty = product.stock_quantity ?? 0
      const updates = { stock_quantity: qty }

      if (threshIdx !== -1 && row[threshIdx]?.trim()) {
        const thresh = parseInt(row[threshIdx], 10)
        if (!isNaN(thresh)) updates.low_stock_threshold = thresh
      }

      let sql = 'UPDATE products SET stock_quantity = ?'
      const params = [qty]
      if (updates.low_stock_threshold !== undefined) {
        sql += ', low_stock_threshold = ?'
        params.push(updates.low_stock_threshold)
      }
      sql += ' WHERE id = ?'
      params.push(product.id)
      db.prepare(sql).run(...params)

      // Log stock change
      try {
        logStockChange({
          productId: product.id,
          oldQty,
          newQty: qty,
          reason: 'csv_import',
          note: `Bulk import: ${req.file.originalname}`,
        })
      } catch (_) {}

      updated++
    }
  })

  processRows()

  const filename = req.file.originalname
  const total = lines.length - 1
  db.prepare(`
    INSERT INTO stock_imports (filename, total, updated, skipped, errors)
    VALUES (?, ?, ?, ?, ?)
  `).run(filename, total, updated, skipped, JSON.stringify(errors))

  logActivity(req, 'stock_import', 'stock', null, `CSV: ${filename} — ${updated} updated, ${skipped} skipped`)

  res.json({ ok: true, total, updated, skipped, errors })
})

export default router
