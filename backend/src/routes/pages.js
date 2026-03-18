// Pygmy CMS — Pages CRUD
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// GET /api/pages — public list (published)
router.get('/', (req, res) => {
  const { all } = req.query
  // If ?all=1 is passed with auth, return all pages (for admin)
  const rows = all
    ? db.prepare('SELECT * FROM pages ORDER BY sort_order ASC, created_at DESC').all()
    : db.prepare("SELECT * FROM pages WHERE status='published' ORDER BY sort_order ASC").all()
  res.json(rows)
})

// GET /api/pages/:slug — public single page
router.get('/:slug', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get(req.params.slug)
  if (!page) return res.status(404).json({ error: 'Page not found' })
  res.json(page)
})

// POST /api/pages — create (auth)
router.post('/', authMiddleware, (req, res) => {
  const { title, slug, content, meta_title, meta_desc, status, sort_order } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })

  const finalSlug = slug || slugify(title)

  const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(finalSlug)
  if (existing) return res.status(409).json({ error: 'Slug already exists' })

  const stmt = db.prepare(`
    INSERT INTO pages (title, slug, content, meta_title, meta_desc, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const info = stmt.run(
    title, finalSlug,
    content || '',
    meta_title || null, meta_desc || null,
    status || 'draft',
    sort_order || 0
  )
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(info.lastInsertRowid)
  logActivity(req.user?.id, req.user?.name, 'created page', 'page', page.id, page.title)
  res.status(201).json(page)
})

// PUT /api/pages/:id — update (auth)
router.put('/:id', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: 'Page not found' })

  const { title, slug, content, meta_title, meta_desc, status, sort_order } = req.body
  const newSlug = slug || page.slug

  // Check slug conflict (excluding self)
  const conflict = db.prepare('SELECT id FROM pages WHERE slug = ? AND id != ?').get(newSlug, page.id)
  if (conflict) return res.status(409).json({ error: 'Slug already in use' })

  db.prepare(`
    UPDATE pages SET title=?, slug=?, content=?, meta_title=?, meta_desc=?, status=?, sort_order=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    title ?? page.title,
    newSlug,
    content ?? page.content,
    meta_title ?? page.meta_title,
    meta_desc ?? page.meta_desc,
    status ?? page.status,
    sort_order ?? page.sort_order,
    page.id
  )

  const updated = db.prepare('SELECT * FROM pages WHERE id = ?').get(page.id)
  logActivity(req.user?.id, req.user?.name, 'updated page', 'page', updated.id, updated.title)
  res.json(updated)
})

// DELETE /api/pages/:id (auth)
router.delete('/:id', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: 'Page not found' })
  db.prepare('DELETE FROM pages WHERE id = ?').run(page.id)
  logActivity(req.user?.id, req.user?.name, 'deleted page', 'page', page.id, page.title)
  res.json({ message: 'Deleted' })
})

export default router
