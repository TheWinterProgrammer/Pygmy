// Pygmy CMS — Media upload + library
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import sharp from 'sharp'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

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

// GET /api/media
router.get('/', (req, res) => {
  const { limit = 50, offset = 0 } = req.query
  const rows = db.prepare('SELECT * FROM media ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset))
  const { total } = db.prepare('SELECT COUNT(*) as total FROM media').get()
  res.json({ media: rows, total })
})

// POST /api/media (auth)
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or unsupported type' })

  const file = req.file
  let width = null, height = null

  try {
    if (file.mimetype !== 'image/svg+xml') {
      const meta = await sharp(file.path).metadata()
      width = meta.width
      height = meta.height
    }
  } catch {}

  const url = `/uploads/media/${file.filename}`
  const info = db.prepare(`
    INSERT INTO media (filename, original, mime_type, size, width, height, alt, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(file.filename, file.originalname, file.mimetype, file.size, width, height, '', url)

  res.status(201).json(db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid))
})

// PUT /api/media/:id — update alt text (auth)
router.put('/:id', authMiddleware, (req, res) => {
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
  if (!media) return res.status(404).json({ error: 'Not found' })

  db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(req.body.alt || '', media.id)
  res.json(db.prepare('SELECT * FROM media WHERE id = ?').get(media.id))
})

// DELETE /api/media/:id (auth)
router.delete('/:id', authMiddleware, (req, res) => {
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
  if (!media) return res.status(404).json({ error: 'Not found' })

  const filePath = path.join(UPLOADS_DIR, media.filename)
  try { if (existsSync(filePath)) unlinkSync(filePath) } catch {}

  db.prepare('DELETE FROM media WHERE id = ?').run(media.id)
  res.json({ message: 'Deleted' })
})

export default router
