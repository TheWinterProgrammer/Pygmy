// Media Alt Text Bulk Manager — Phase 60
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// GET /api/media-alt — paginated list of images with their alt text
router.get('/', auth, (req, res) => {
  const { limit = 50, offset = 0, q, missing_only } = req.query
  let query = `SELECT id, filename, original, url, mime_type, size, alt, width, height, created_at FROM media WHERE mime_type LIKE 'image/%'`
  const params = []
  if (q) { query += ` AND (original LIKE ? OR alt LIKE ?)`; params.push(`%${q}%`, `%${q}%`) }
  if (missing_only === '1') { query += ` AND (alt IS NULL OR alt = '')` }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
  params.push(Number(limit), Number(offset))
  const rows = db.prepare(query).all(...params)
  
  let countQuery = `SELECT COUNT(*) as total FROM media WHERE mime_type LIKE 'image/%'`
  const countParams = []
  if (q) { countQuery += ` AND (original LIKE ? OR alt LIKE ?)`; countParams.push(`%${q}%`, `%${q}%`) }
  if (missing_only === '1') { countQuery += ` AND (alt IS NULL OR alt = '')` }
  const { total } = db.prepare(countQuery).get(...countParams)
  
  const stats = db.prepare(`SELECT
    COUNT(*) as total_images,
    SUM(CASE WHEN alt IS NOT NULL AND alt != '' THEN 1 ELSE 0 END) as with_alt,
    SUM(CASE WHEN alt IS NULL OR alt = '' THEN 1 ELSE 0 END) as missing_alt
  FROM media WHERE mime_type LIKE 'image/%'`).get()

  res.json({ rows, total, stats })
})

// PUT /api/media-alt/:id — update alt text for one image
router.put('/:id', auth, (req, res) => {
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
  if (!media) return res.status(404).json({ error: 'Not found' })
  const alt = req.body.alt !== undefined ? String(req.body.alt) : ''
  db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(alt, media.id)
  res.json({ id: media.id, alt })
})

// POST /api/media-alt/bulk — bulk update alt texts
// Body: { updates: [{id, alt}] }
router.post('/bulk', auth, (req, res) => {
  const { updates } = req.body
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'updates array required' })
  }
  const stmt = db.prepare('UPDATE media SET alt = ? WHERE id = ?')
  const updateAll = db.transaction(() => {
    let updated = 0
    for (const { id, alt } of updates) {
      if (id && alt !== undefined) {
        stmt.run(String(alt), Number(id))
        updated++
      }
    }
    return updated
  })
  const updated = updateAll()
  res.json({ updated })
})

export default router
