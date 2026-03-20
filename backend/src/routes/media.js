// Pygmy CMS — Media upload + library
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, unlinkSync, renameSync } from 'fs'
import sharp from 'sharp'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

// File size threshold above which we auto-convert to WebP (200 KB)
const OPTIMIZE_THRESHOLD = 200 * 1024

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, '../../uploads/media')

if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext)
      .toLowerCase().replace(/[^a-z0-9]/g, '-')
    cb(null, `${Date.now()}-${base}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    cb(null, allowed.includes(file.mimetype))
  }
})

const router = Router()

// GET /api/media — supports ?folder_id=<id|null>
router.get('/', (req, res) => {
  const { limit = 50, offset = 0, folder_id } = req.query
  let rows, total

  if (folder_id === 'null' || folder_id === '0') {
    // Root (no folder)
    rows = db.prepare('SELECT * FROM media WHERE folder_id IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset))
    total = db.prepare('SELECT COUNT(*) as total FROM media WHERE folder_id IS NULL').get().total
  } else if (folder_id) {
    rows = db.prepare('SELECT * FROM media WHERE folder_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(folder_id), Number(limit), Number(offset))
    total = db.prepare('SELECT COUNT(*) as total FROM media WHERE folder_id = ?').get(Number(folder_id)).total
  } else {
    rows = db.prepare('SELECT * FROM media ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset))
    total = db.prepare('SELECT COUNT(*) as total FROM media').get().total
  }

  res.json({ media: rows, total })
})

// POST /api/media (auth)
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or unsupported type' })

  let file = req.file
  let width = null, height = null
  let finalFilename = file.filename
  let finalMime = file.mimetype
  let finalSize = file.size

  try {
    if (!['image/svg+xml', 'image/gif'].includes(file.mimetype)) {
      const meta = await sharp(file.path).metadata()
      width = meta.width
      height = meta.height

      // Auto-optimize: convert JPEG/PNG/WebP to WebP when above threshold
      const shouldOptimize = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        && (file.size > OPTIMIZE_THRESHOLD || file.mimetype !== 'image/webp')

      if (shouldOptimize) {
        const base = path.basename(file.filename, path.extname(file.filename))
        const webpFilename = `${base}.webp`
        const webpPath = path.join(UPLOADS_DIR, webpFilename)

        const optimized = await sharp(file.path)
          .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(webpPath)

        // Remove original, swap to WebP version
        try { unlinkSync(file.path) } catch {}

        finalFilename = webpFilename
        finalMime = 'image/webp'
        finalSize = optimized.size
        width = optimized.width
        height = optimized.height
      }
    }
  } catch (e) {
    console.warn('sharp processing error (non-fatal):', e.message)
    // Continue with original file if optimization fails
    finalFilename = file.filename
    finalMime = file.mimetype
    finalSize = file.size
  }

  const url = `/uploads/media/${finalFilename}`
  const folderId = req.body.folder_id ? parseInt(req.body.folder_id) : null
  const info = db.prepare(`
    INSERT INTO media (filename, original, mime_type, size, width, height, alt, url, folder_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(finalFilename, file.originalname, finalMime, finalSize, width, height, '', url, folderId)

  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid)
  logActivity(req.user?.id, req.user?.name, 'uploaded media', 'media', media.id, file.originalname)
  res.status(201).json(media)
})

// PUT /api/media/:id — update alt text and/or folder_id (auth)
router.put('/:id', authMiddleware, (req, res) => {
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
  if (!media) return res.status(404).json({ error: 'Not found' })

  const alt = req.body.alt !== undefined ? req.body.alt : media.alt
  const folder_id = req.body.folder_id !== undefined
    ? (req.body.folder_id === null || req.body.folder_id === '' ? null : parseInt(req.body.folder_id))
    : media.folder_id

  db.prepare('UPDATE media SET alt = ?, folder_id = ? WHERE id = ?').run(alt, folder_id, media.id)
  res.json(db.prepare('SELECT * FROM media WHERE id = ?').get(media.id))
})

// DELETE /api/media/:id (auth)
router.delete('/:id', authMiddleware, (req, res) => {
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
  if (!media) return res.status(404).json({ error: 'Not found' })

  const filePath = path.join(UPLOADS_DIR, media.filename)
  try { if (existsSync(filePath)) unlinkSync(filePath) } catch {}

  db.prepare('DELETE FROM media WHERE id = ?').run(media.id)
  logActivity(req.user?.id, req.user?.name, 'deleted media', 'media', media.id, media.original)
  res.json({ message: 'Deleted' })
})

export default router
