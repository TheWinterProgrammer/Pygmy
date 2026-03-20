// Pygmy CMS — Media Folder CRUD
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// GET /api/media-folders
router.get('/', authMiddleware, (req, res) => {
  const folders = db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM media m WHERE m.folder_id = f.id) AS media_count
    FROM media_folders f
    ORDER BY f.name ASC
  `).all()
  res.json(folders)
})

// POST /api/media-folders
router.post('/', authMiddleware, (req, res) => {
  const { name, parent_id = null } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })

  // Generate unique slug
  let slug = slugify(name)
  const existing = db.prepare('SELECT id FROM media_folders WHERE slug = ?').get(slug)
  if (existing) slug = `${slug}-${Date.now()}`

  try {
    const info = db.prepare(
      'INSERT INTO media_folders (name, slug, parent_id) VALUES (?, ?, ?)'
    ).run(name, slug, parent_id || null)
    res.status(201).json(db.prepare('SELECT * FROM media_folders WHERE id = ?').get(info.lastInsertRowid))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/media-folders/:id
router.put('/:id', authMiddleware, (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })

  const folder = db.prepare('SELECT * FROM media_folders WHERE id = ?').get(req.params.id)
  if (!folder) return res.status(404).json({ error: 'Folder not found' })

  db.prepare('UPDATE media_folders SET name = ? WHERE id = ?').run(name, req.params.id)
  res.json(db.prepare('SELECT * FROM media_folders WHERE id = ?').get(req.params.id))
})

// DELETE /api/media-folders/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const folder = db.prepare('SELECT * FROM media_folders WHERE id = ?').get(req.params.id)
  if (!folder) return res.status(404).json({ error: 'Folder not found' })

  // Unassign media items in this folder (move to root)
  db.prepare('UPDATE media SET folder_id = NULL WHERE folder_id = ?').run(req.params.id)
  db.prepare('DELETE FROM media_folders WHERE id = ?').run(req.params.id)
  res.json({ message: 'Deleted' })
})

// PUT /api/media-folders/move-media — move a media item to a folder
router.post('/move-media', authMiddleware, (req, res) => {
  const { media_ids, folder_id } = req.body
  if (!Array.isArray(media_ids) || media_ids.length === 0) {
    return res.status(400).json({ error: 'media_ids array required' })
  }
  const placeholders = media_ids.map(() => '?').join(',')
  db.prepare(`UPDATE media SET folder_id = ? WHERE id IN (${placeholders})`).run(folder_id || null, ...media_ids)
  res.json({ message: 'Moved', count: media_ids.length })
})

export default router
