// Pygmy CMS — Pages CRUD
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'
import { saveRevision } from './revisions.js'
import { fireWebhooks } from './webhooks.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'pygmy-secret-change-me'

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function hasValidAuth(req) {
  const authHeader = req.headers['authorization'] || ''
  const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.preview_token || '')
  if (!raw) return false
  try { jwt.verify(raw, JWT_SECRET); return true } catch { return false }
}

// POST /api/pages/bulk (auth) — { action: 'publish'|'unpublish'|'delete', ids: [] }
router.post('/bulk', authMiddleware, (req, res) => {
  const { action, ids } = req.body
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'action and ids[] required' })
  }
  const placeholders = ids.map(() => '?').join(',')

  if (action === 'delete') {
    const rows = db.prepare(`SELECT id, title FROM pages WHERE id IN (${placeholders})`).all(...ids)
    db.prepare(`DELETE FROM pages WHERE id IN (${placeholders})`).run(...ids)
    rows.forEach(r => logActivity(req.user?.id, req.user?.name, 'deleted page', 'page', r.id, r.title))
    return res.json({ affected: rows.length })
  }

  if (action === 'publish' || action === 'unpublish') {
    const newStatus = action === 'publish' ? 'published' : 'draft'
    const publishAt = action === 'publish' ? new Date().toISOString() : null
    db.prepare(
      `UPDATE pages SET status=?, publish_at=?, updated_at=datetime('now') WHERE id IN (${placeholders})`
    ).run(newStatus, publishAt, ...ids)
    const rows = db.prepare(`SELECT id, title FROM pages WHERE id IN (${placeholders})`).all(...ids)
    rows.forEach(r => logActivity(req.user?.id, req.user?.name, `${action}ed page`, 'page', r.id, r.title))
    return res.json({ affected: rows.length })
  }

  res.status(400).json({ error: 'Unknown action' })
})

// GET /api/pages — public list (published)
router.get('/', (req, res) => {
  const { all } = req.query
  // If ?all=1 is passed with auth, return all pages (for admin)
  const rows = all
    ? db.prepare('SELECT * FROM pages ORDER BY sort_order ASC, created_at DESC').all()
    : db.prepare("SELECT * FROM pages WHERE status='published' ORDER BY sort_order ASC").all()
  res.json(rows)
})

// GET /api/pages/:slug — public single page (drafts visible with valid admin JWT)
router.get('/:slug', (req, res) => {
  const isAdmin = hasValidAuth(req)
  const statusFilter = isAdmin ? "status IN ('published','draft','scheduled')" : "status='published'"
  const page = db.prepare(`SELECT * FROM pages WHERE slug = ? AND ${statusFilter}`).get(req.params.slug)
  if (!page) return res.status(404).json({ error: 'Page not found' })
  res.json({ ...page, _preview: isAdmin && page.status !== 'published' })
})

// POST /api/pages — create (auth)
router.post('/', authMiddleware, (req, res) => {
  const { title, slug, content, meta_title, meta_desc, status, sort_order, publish_at } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })

  const finalSlug = slug || slugify(title)

  const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(finalSlug)
  if (existing) return res.status(409).json({ error: 'Slug already exists' })

  const finalStatus = status || 'draft'
  let finalPublishAt = null
  if (finalStatus === 'published') finalPublishAt = publish_at || new Date().toISOString()
  else if (finalStatus === 'scheduled') finalPublishAt = publish_at || null

  const stmt = db.prepare(`
    INSERT INTO pages (title, slug, content, meta_title, meta_desc, status, sort_order, publish_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const info = stmt.run(
    title, finalSlug,
    content || '',
    meta_title || null, meta_desc || null,
    finalStatus,
    sort_order || 0,
    finalPublishAt
  )
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(info.lastInsertRowid)
  logActivity(req.user?.id, req.user?.name, 'created page', 'page', page.id, page.title)
  fireWebhooks('page.created', page)
  if (finalStatus === 'published') fireWebhooks('page.published', page)
  res.status(201).json(page)
})

// PUT /api/pages/:id — update (auth)
router.put('/:id', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: 'Page not found' })

  const { title, slug, content, meta_title, meta_desc, status, sort_order, publish_at } = req.body
  const newSlug = slug || page.slug

  // Check slug conflict (excluding self)
  const conflict = db.prepare('SELECT id FROM pages WHERE slug = ? AND id != ?').get(newSlug, page.id)
  if (conflict) return res.status(409).json({ error: 'Slug already in use' })

  const newStatus = status ?? page.status
  let newPublishAt = publish_at !== undefined ? publish_at : page.publish_at
  if (newStatus === 'published' && !newPublishAt) newPublishAt = new Date().toISOString()
  if (newStatus === 'draft') newPublishAt = null

  db.prepare(`
    UPDATE pages SET title=?, slug=?, content=?, meta_title=?, meta_desc=?, status=?, sort_order=?, publish_at=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    title ?? page.title,
    newSlug,
    content ?? page.content,
    meta_title ?? page.meta_title,
    meta_desc ?? page.meta_desc,
    newStatus,
    sort_order ?? page.sort_order,
    newPublishAt,
    page.id
  )

  const updated = db.prepare('SELECT * FROM pages WHERE id = ?').get(page.id)
  // Save a revision snapshot of the pre-update state
  saveRevision('page', page.id, page.title, page, req.user?.id, req.user?.name)
  logActivity(req.user?.id, req.user?.name, 'updated page', 'page', updated.id, updated.title)
  fireWebhooks('page.updated', updated)
  if (newStatus === 'published' && page.status !== 'published') fireWebhooks('page.published', updated)
  res.json(updated)
})

// DELETE /api/pages/:id (auth)
router.delete('/:id', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: 'Page not found' })
  db.prepare('DELETE FROM pages WHERE id = ?').run(page.id)
  logActivity(req.user?.id, req.user?.name, 'deleted page', 'page', page.id, page.title)
  fireWebhooks('page.deleted', { id: page.id, title: page.title, slug: page.slug })
  res.json({ message: 'Deleted' })
})

// POST /api/pages/bulk — bulk action on multiple pages
router.post('/bulk', authMiddleware, (req, res) => {
  const { ids, action } = req.body
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' })
  if (!['publish', 'unpublish', 'delete'].includes(action)) return res.status(400).json({ error: 'Invalid action' })

  const now = new Date().toISOString()
  let affected = 0

  const doInTransaction = db.transaction(() => {
    for (const id of ids) {
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id)
      if (!page) continue
      if (action === 'delete') {
        db.prepare('DELETE FROM pages WHERE id = ?').run(id)
        logActivity(req.user?.id, req.user?.name, 'deleted page', 'page', page.id, page.title)
        fireWebhooks('page.deleted', { id: page.id, title: page.title, slug: page.slug })
      } else {
        const newStatus = action === 'publish' ? 'published' : 'draft'
        db.prepare(`UPDATE pages SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, now, id)
        logActivity(req.user?.id, req.user?.name, `${action}ed page`, 'page', page.id, page.title)
        if (action === 'publish' && page.status !== 'published') {
          const updated = db.prepare('SELECT * FROM pages WHERE id = ?').get(id)
          fireWebhooks('page.published', updated)
        }
      }
      affected++
    }
  })
  doInTransaction()
  res.json({ affected })
})

export default router
