// Pygmy CMS — Navigation CRUD
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function buildTree(rows) {
  const map = {}
  rows.forEach(r => map[r.id] = { ...r, children: [] })
  const roots = []
  rows.forEach(r => {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id])
    } else {
      roots.push(map[r.id])
    }
  })
  return roots
}

// GET /api/navigation — public
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM navigation ORDER BY sort_order ASC').all()
  res.json(buildTree(rows))
})

// POST /api/navigation (auth)
router.post('/', authMiddleware, (req, res) => {
  const { label, url, target, sort_order, parent_id } = req.body
  if (!label || !url) return res.status(400).json({ error: 'Label and URL required' })

  const info = db.prepare(`
    INSERT INTO navigation (label, url, target, sort_order, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(label, url, target || '_self', sort_order || 0, parent_id || null)

  res.status(201).json(db.prepare('SELECT * FROM navigation WHERE id = ?').get(info.lastInsertRowid))
})

// PUT /api/navigation/:id (auth)
router.put('/:id', authMiddleware, (req, res) => {
  const item = db.prepare('SELECT * FROM navigation WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'Not found' })

  const { label, url, target, sort_order, parent_id } = req.body
  db.prepare(`
    UPDATE navigation SET label=?, url=?, target=?, sort_order=?, parent_id=? WHERE id=?
  `).run(
    label ?? item.label,
    url ?? item.url,
    target ?? item.target,
    sort_order ?? item.sort_order,
    parent_id !== undefined ? parent_id : item.parent_id,
    item.id
  )

  res.json(db.prepare('SELECT * FROM navigation WHERE id = ?').get(item.id))
})

// DELETE /api/navigation/:id (auth)
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM navigation WHERE id = ?').run(req.params.id)
  res.json({ message: 'Deleted' })
})

// PUT /api/navigation/reorder — bulk reorder (auth)
router.put('/reorder', authMiddleware, (req, res) => {
  const { items } = req.body // [{id, sort_order, parent_id}]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' })

  const update = db.prepare('UPDATE navigation SET sort_order=?, parent_id=? WHERE id=?')
  const tx = db.transaction(() => {
    items.forEach(({ id, sort_order, parent_id }) => update.run(sort_order, parent_id || null, id))
  })
  tx()
  res.json({ message: 'Reordered' })
})

export default router
