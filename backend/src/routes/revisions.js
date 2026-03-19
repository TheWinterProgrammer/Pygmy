// Pygmy CMS — Content Revisions
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const MAX_REVISIONS = 20 // keep at most N revisions per entity

/**
 * Save a revision snapshot. Called internally from pages.js / posts.js on PUT.
 * snapshot = plain object (will be JSON-stringified)
 */
export function saveRevision(entityType, entityId, entityTitle, snapshot, userId, userName) {
  try {
    db.prepare(`
      INSERT INTO revisions (entity_type, entity_id, entity_title, snapshot, user_id, user_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entityType, entityId, entityTitle ?? '', JSON.stringify(snapshot), userId ?? null, userName ?? null)

    // Prune old revisions — keep only the latest MAX_REVISIONS
    const rows = db.prepare(`
      SELECT id FROM revisions
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `).all(entityType, entityId)

    if (rows.length > MAX_REVISIONS) {
      const toDelete = rows.slice(MAX_REVISIONS).map(r => r.id)
      const placeholders = toDelete.map(() => '?').join(',')
      db.prepare(`DELETE FROM revisions WHERE id IN (${placeholders})`).run(...toDelete)
    }
  } catch (e) {
    console.warn('saveRevision error:', e.message)
  }
}

// GET /api/revisions?entity_type=&entity_id= (auth)
router.get('/', authMiddleware, (req, res) => {
  const { entity_type, entity_id } = req.query
  if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' })

  const rows = db.prepare(`
    SELECT id, entity_type, entity_id, entity_title, user_id, user_name, created_at
    FROM revisions
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(entity_type, entity_id)

  res.json(rows)
})

// GET /api/revisions/:id — fetch snapshot (auth)
router.get('/:id', authMiddleware, (req, res) => {
  const rev = db.prepare('SELECT * FROM revisions WHERE id = ?').get(req.params.id)
  if (!rev) return res.status(404).json({ error: 'Revision not found' })
  res.json({ ...rev, snapshot: JSON.parse(rev.snapshot) })
})

// DELETE /api/revisions/:id (auth, admin only recommended)
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM revisions WHERE id = ?').run(req.params.id)
  res.json({ message: 'Deleted' })
})

// DELETE /api/revisions?entity_type=&entity_id= — purge all revisions for an entity (auth)
router.delete('/', authMiddleware, (req, res) => {
  const { entity_type, entity_id } = req.query
  if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' })
  const info = db.prepare('DELETE FROM revisions WHERE entity_type = ? AND entity_id = ?').run(entity_type, entity_id)
  res.json({ deleted: info.changes })
})

export default router
