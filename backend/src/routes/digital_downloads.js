// Pygmy CMS — Digital Downloads API
// Manages downloadable files per product + secure token-based download links
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { randomBytes, createHash } from 'crypto'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOWNLOADS_DIR = path.join(__dirname, '../../uploads/downloads')
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })

const router = Router()

// ── Multer storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOWNLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const unique = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`
    cb(null, unique)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateToken() {
  return randomBytes(32).toString('hex')
}

function humanSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++ }
  return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// ── Admin: list digital files for a product ───────────────────────────────────
// GET /api/digital-downloads/files?product_id=
router.get('/files', authMiddleware, (req, res) => {
  const { product_id } = req.query
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const files = db.prepare(`
    SELECT * FROM digital_files WHERE product_id = ? ORDER BY sort_order ASC, id ASC
  `).all(parseInt(product_id))

  res.json(files.map(f => ({ ...f, size_human: humanSize(f.file_size) })))
})

// ── Admin: upload a digital file for a product ────────────────────────────────
// POST /api/digital-downloads/files
router.post('/files', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' })

  const { product_id, label, download_limit = 0, expires_days = 0 } = req.body
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  // Verify product exists
  const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(parseInt(product_id))
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const result = db.prepare(`
    INSERT INTO digital_files (product_id, label, filename, original_name, file_size, mime_type, download_limit, expires_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parseInt(product_id),
    (label || req.file.originalname).trim(),
    req.file.filename,
    req.file.originalname,
    req.file.size,
    req.file.mimetype,
    parseInt(download_limit) || 0,
    parseInt(expires_days) || 0
  )

  const file = db.prepare('SELECT * FROM digital_files WHERE id = ?').get(result.lastInsertRowid)

  logActivity(req, 'upload', 'digital_file', file.id, `${file.label} → ${product.name}`)

  res.status(201).json({ ...file, size_human: humanSize(file.file_size) })
})

// ── Admin: update a digital file metadata ─────────────────────────────────────
// PUT /api/digital-downloads/files/:id
router.put('/files/:id', authMiddleware, (req, res) => {
  const file = db.prepare('SELECT * FROM digital_files WHERE id = ?').get(parseInt(req.params.id))
  if (!file) return res.status(404).json({ error: 'File not found' })

  const { label, download_limit, expires_days, sort_order } = req.body

  db.prepare(`
    UPDATE digital_files
    SET label = ?, download_limit = ?, expires_days = ?, sort_order = ?
    WHERE id = ?
  `).run(
    (label ?? file.label).trim(),
    download_limit !== undefined ? parseInt(download_limit) : file.download_limit,
    expires_days !== undefined ? parseInt(expires_days) : file.expires_days,
    sort_order !== undefined ? parseInt(sort_order) : file.sort_order,
    file.id
  )

  res.json(db.prepare('SELECT * FROM digital_files WHERE id = ?').get(file.id))
})

// ── Admin: delete a digital file ──────────────────────────────────────────────
// DELETE /api/digital-downloads/files/:id
router.delete('/files/:id', authMiddleware, (req, res) => {
  const file = db.prepare('SELECT * FROM digital_files WHERE id = ?').get(parseInt(req.params.id))
  if (!file) return res.status(404).json({ error: 'File not found' })

  // Delete physical file
  const filePath = path.join(DOWNLOADS_DIR, file.filename)
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}

  db.prepare('DELETE FROM digital_files WHERE id = ?').run(file.id)

  logActivity(req, 'delete', 'digital_file', file.id, file.label)
  res.json({ ok: true })
})

// ── Admin: list download tokens (for an order) ────────────────────────────────
// GET /api/digital-downloads/tokens?order_id=
router.get('/tokens', authMiddleware, (req, res) => {
  const { order_id } = req.query
  if (!order_id) return res.status(400).json({ error: 'order_id required' })

  const tokens = db.prepare(`
    SELECT dt.*, df.label, df.original_name, df.mime_type
    FROM download_tokens dt
    JOIN digital_files df ON df.id = dt.file_id
    WHERE dt.order_id = ?
    ORDER BY dt.created_at ASC
  `).all(parseInt(order_id))

  res.json(tokens)
})

// ── Public: secure file download via token ────────────────────────────────────
// GET /api/digital-downloads/:token
router.get('/:token', (req, res) => {
  const { token } = req.params

  const record = db.prepare(`
    SELECT dt.*, df.filename, df.original_name, df.mime_type, df.download_limit, df.expires_days
    FROM download_tokens dt
    JOIN digital_files df ON df.id = dt.file_id
    WHERE dt.token = ?
  `).get(token)

  if (!record) {
    return res.status(404).send('Download link not found or has expired.')
  }

  // Check expiry
  if (record.expires_at) {
    const expiry = new Date(record.expires_at)
    if (expiry < new Date()) {
      return res.status(410).send('This download link has expired.')
    }
  }

  // Check download limit
  if (record.download_limit > 0 && record.download_count >= record.download_limit) {
    return res.status(410).send('This download link has reached its maximum number of uses.')
  }

  const filePath = path.join(DOWNLOADS_DIR, record.filename)
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found on server.')
  }

  // Increment download count
  db.prepare('UPDATE download_tokens SET download_count = download_count + 1 WHERE id = ?').run(record.id)

  // Stream the file
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.original_name)}"`)
  res.setHeader('Content-Type', record.mime_type || 'application/octet-stream')
  res.setHeader('Content-Length', fs.statSync(filePath).size)

  const stream = fs.createReadStream(filePath)
  stream.pipe(res)
})

// ── Admin: manually issue download tokens for an order ────────────────────────
// POST /api/digital-downloads/issue
router.post('/issue', authMiddleware, (req, res) => {
  const { order_id } = req.body
  if (!order_id) return res.status(400).json({ error: 'order_id required' })

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(parseInt(order_id))
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const tokens = issueDownloadTokensForOrder(order)
  res.json({ ok: true, tokens_issued: tokens.length, tokens })
})

// ── Admin: overview of all digital products + files + token stats ─────────────
// GET /api/digital-downloads/admin/overview
router.get('/admin/overview', authMiddleware, (req, res) => {
  const digitalProducts = db.prepare(`
    SELECT p.id, p.name, p.slug, p.cover_image, p.status
    FROM products p
    WHERE p.is_digital = 1
    ORDER BY p.name ASC
  `).all()

  const now = new Date().toISOString()

  const products = digitalProducts.map(p => {
    const files = db.prepare(`
      SELECT id, label, original_name, file_size, mime_type, download_limit, expires_days
      FROM digital_files WHERE product_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(p.id)

    // Get token stats for this product's files
    const fileIds = files.map(f => f.id)
    const tokenCount = fileIds.length
      ? db.prepare(`SELECT COUNT(*) as c FROM download_tokens WHERE file_id IN (${fileIds.map(() => '?').join(',')}) AND (expires_at IS NULL OR expires_at > ?)`).get(...fileIds, now)?.c || 0
      : 0
    const totalDownloads = fileIds.length
      ? db.prepare(`SELECT COALESCE(SUM(download_count),0) as s FROM download_tokens WHERE file_id IN (${fileIds.map(() => '?').join(',')})`).get(...fileIds)?.s || 0
      : 0

    // Recent tokens (last 10 across all files for this product)
    const recentOrders = fileIds.length
      ? db.prepare(`
          SELECT dt.token, dt.customer_email, dt.expires_at, dt.download_count, dt.download_limit,
                 df.label as file_label,
                 o.order_number
          FROM download_tokens dt
          JOIN digital_files df ON df.id = dt.file_id
          JOIN orders o ON o.id = dt.order_id
          WHERE dt.file_id IN (${fileIds.map(() => '?').join(',')})
          ORDER BY dt.created_at DESC LIMIT 10
        `).all(...fileIds).map(t => ({
          ...t,
          expired: t.expires_at ? t.expires_at < now : false,
          exhausted: t.download_limit > 0 && t.download_count >= t.download_limit,
        }))
      : []

    return {
      ...p,
      files: files.map(f => ({ ...f, size_human: humanSize(f.file_size) })),
      file_count: files.length,
      token_count: tokenCount,
      total_downloads: totalDownloads,
      recentOrders,
    }
  })

  // Global stats
  const totalFiles = db.prepare('SELECT COUNT(*) as c FROM digital_files').get()?.c || 0
  const activeTokens = db.prepare(`SELECT COUNT(*) as c FROM download_tokens WHERE (expires_at IS NULL OR expires_at > ?)`).get(now)?.c || 0
  const totalDownloads = db.prepare('SELECT COALESCE(SUM(download_count),0) as s FROM download_tokens').get()?.s || 0

  res.json({
    stats: {
      products: products.length,
      files: totalFiles,
      activeTokens,
      totalDownloads,
    },
    products,
  })
})

// ── Exported helper: issue download tokens for all digital products in an order
export function issueDownloadTokensForOrder(order) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || [])
  const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))]
  if (!productIds.length) return []

  const issued = []

  for (const productId of productIds) {
    // Find all digital files for this product
    const files = db.prepare('SELECT * FROM digital_files WHERE product_id = ?').all(productId)
    if (!files.length) continue

    for (const file of files) {
      // Check if token already exists for this order+file
      const existing = db.prepare(
        'SELECT id FROM download_tokens WHERE order_id = ? AND file_id = ?'
      ).get(order.id, file.id)
      if (existing) continue

      const token = generateToken()

      // Calculate expiry date
      let expiresAt = null
      if (file.expires_days > 0) {
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + file.expires_days)
        expiresAt = expiry.toISOString()
      }

      const result = db.prepare(`
        INSERT INTO download_tokens (order_id, file_id, customer_email, token, expires_at, download_limit)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(order.id, file.id, order.customer_email, token, expiresAt, file.download_limit)

      issued.push({
        id: result.lastInsertRowid,
        token,
        file_id: file.id,
        label: file.label,
        original_name: file.original_name,
        expires_at: expiresAt,
        download_limit: file.download_limit,
      })
    }
  }

  return issued
}

// ── Public: get download links for an order (by order_number + email) ─────────
// POST /api/digital-downloads/order-links
router.post('/order-links', (req, res) => {
  const { order_number, email } = req.body
  if (!order_number || !email) {
    return res.status(400).json({ error: 'order_number and email are required' })
  }

  const order = db.prepare(`
    SELECT id FROM orders
    WHERE order_number = ? AND customer_email = ? COLLATE NOCASE
  `).get(order_number.trim(), email.trim().toLowerCase())

  if (!order) return res.status(404).json({ error: 'Order not found' })

  const tokens = db.prepare(`
    SELECT dt.token, dt.expires_at, dt.download_count, dt.download_limit,
           df.label, df.original_name, df.mime_type, df.file_size
    FROM download_tokens dt
    JOIN digital_files df ON df.id = dt.file_id
    WHERE dt.order_id = ? AND dt.customer_email = ? COLLATE NOCASE
    ORDER BY dt.created_at ASC
  `).all(order.id, email.trim().toLowerCase())

  const now = new Date()
  const result = tokens.map(t => ({
    ...t,
    expired: t.expires_at ? new Date(t.expires_at) < now : false,
    exhausted: t.download_limit > 0 && t.download_count >= t.download_limit,
    download_url: `/api/digital-downloads/${t.token}`,
    size_human: humanSize(t.file_size),
  }))

  res.json(result)
})

export default router
