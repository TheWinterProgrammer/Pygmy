// Pygmy CMS — Posts CRUD
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'
import { saveRevision } from './revisions.js'
import { fireWebhooks } from './webhooks.js'

const JWT_SECRET = process.env.JWT_SECRET || 'pygmy-secret-change-me'
const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || 'pygmy-customer-secret-change-in-production'

// Check if a customer token grants access to a given access_level
function customerHasAccess(req, accessLevel) {
  if (accessLevel === 'public') return true
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return false
  try {
    const payload = jwt.verify(header.slice(7), CUSTOMER_JWT_SECRET)
    if (payload.role !== 'customer') return false
    if (accessLevel === 'members') {
      // Any logged-in customer with an active subscription
      const sub = db.prepare(`
        SELECT id FROM member_subscriptions
        WHERE customer_id=? AND status IN ('active','trialing')
        LIMIT 1
      `).get(payload.id)
      return !!sub
    }
    return false
  } catch { return false }
}

function hasValidAuth(req) {
  const authHeader = req.headers['authorization'] || ''
  const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.preview_token || '')
  if (!raw) return false
  try { jwt.verify(raw, JWT_SECRET); return true } catch { return false }
}

const router = Router()

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function parsePost(post) {
  if (!post) return null
  let gallery = []
  try { gallery = JSON.parse(post.gallery || '[]') } catch {}
  return { ...post, tags: JSON.parse(post.tags || '[]'), gallery }
}

// ─── Categories ───────────────────────────────────────────────────────────────

// GET /api/posts/categories
router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY name ASC').all()
  res.json(cats)
})

router.post('/categories', authMiddleware, (req, res) => {
  const { name, slug } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const finalSlug = slug || slugify(name)
  try {
    const info = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, finalSlug)
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid))
  } catch {
    res.status(409).json({ error: 'Category slug already exists' })
  }
})

router.delete('/categories/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id)
  res.json({ message: 'Deleted' })
})

// ─── Posts ────────────────────────────────────────────────────────────────────

// GET /api/posts — public (published), supports ?category=&tag=&limit=&offset=
router.get('/', (req, res) => {
  const { category, tag, limit = 20, offset = 0, all } = req.query

  let where = all ? '1=1' : "p.status = 'published'"
  const params = []

  if (category) {
    where += ' AND c.slug = ?'
    params.push(category)
  }
  if (tag) {
    where += ' AND json_each.value = ?'
  }

  const rows = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.published_at DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  // Filter by tag in JS (simpler than SQLite JSON)
  let result = rows.map(parsePost)
  if (tag) result = result.filter(p => p.tags.includes(tag))

  const totalRow = db.prepare(`
    SELECT COUNT(*) as total FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${where.replace(' AND json_each.value = ?', '')}
  `).get(...params.filter((_, i) => !(tag && i === params.length - 1)))

  res.json({ posts: result, total: totalRow.total })
})

// POST /api/posts/bulk (auth) — { action: 'publish'|'unpublish'|'delete', ids: [] }
router.post('/bulk', authMiddleware, (req, res) => {
  const { action, ids } = req.body
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'action and ids[] required' })
  }
  const placeholders = ids.map(() => '?').join(',')

  if (action === 'delete') {
    const rows = db.prepare(`SELECT id, title FROM posts WHERE id IN (${placeholders})`).all(...ids)
    db.prepare(`DELETE FROM posts WHERE id IN (${placeholders})`).run(...ids)
    rows.forEach(r => logActivity(req.user?.id, req.user?.name, 'deleted post', 'post', r.id, r.title))
    return res.json({ affected: rows.length })
  }

  if (action === 'publish' || action === 'unpublish') {
    const newStatus = action === 'publish' ? 'published' : 'draft'
    const publishedAt = action === 'publish' ? new Date().toISOString() : null
    db.prepare(
      `UPDATE posts SET status=?, published_at=?, updated_at=datetime('now') WHERE id IN (${placeholders})`
    ).run(newStatus, publishedAt, ...ids)
    const rows = db.prepare(`SELECT id, title FROM posts WHERE id IN (${placeholders})`).all(...ids)
    rows.forEach(r => logActivity(req.user?.id, req.user?.name, `${action}ed post`, 'post', r.id, r.title))
    return res.json({ affected: rows.length })
  }

  res.status(400).json({ error: 'Unknown action' })
})

// GET /api/posts/authors — list all unique post authors
router.get('/authors', (req, res) => {
  const authors = db.prepare(`
    SELECT author_name, author_email,
           COUNT(*) as post_count,
           MAX(published_at) as last_published_at
    FROM posts
    WHERE status = 'published' AND author_name != ''
    GROUP BY author_name
    ORDER BY post_count DESC
  `).all()
  res.json(authors)
})

// GET /api/posts/author/:name — posts by author name (public)
router.get('/author/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name)
  const limit = Math.min(parseInt(req.query.limit) || 12, 50)
  const offset = parseInt(req.query.offset) || 0

  const rows = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'published' AND p.author_name = ?
    ORDER BY p.published_at DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(name, limit, offset).map(parsePost)

  const total = db.prepare(`
    SELECT COUNT(*) as total FROM posts WHERE status = 'published' AND author_name = ?
  `).get(name).total

  res.json({ posts: rows, total, author: name })
})

// GET /api/posts/:slug/related — 3 related posts by same category, falling back to recent
router.get('/:slug/related', (req, res) => {
  const post = db.prepare('SELECT id, category_id, tags FROM posts WHERE slug = ?').get(req.params.slug)
  if (!post) return res.json([])

  const limit = Math.min(parseInt(req.query.limit) || 3, 10)

  let related = []

  // 1. Try same category (excluding self)
  if (post.category_id) {
    related = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.category_id = ? AND p.id != ?
      ORDER BY p.published_at DESC, p.created_at DESC
      LIMIT ?
    `).all(post.category_id, post.id, limit)
  }

  // 2. If not enough, fill with recent posts
  if (related.length < limit) {
    const existing = related.map(r => r.id)
    existing.push(post.id)
    const placeholders = existing.map(() => '?').join(',')
    const extras = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.id NOT IN (${placeholders})
      ORDER BY p.published_at DESC, p.created_at DESC
      LIMIT ?
    `).all(...existing, limit - related.length)
    related = [...related, ...extras]
  }

  res.json(related.map(parsePost))
})

// GET /api/posts/:slug
// If a valid admin JWT is passed (Authorization header or ?preview_token=), drafts are returned too.
router.get('/:slug', (req, res) => {
  const isAdmin = hasValidAuth(req)
  const statusFilter = isAdmin
    ? "p.status IN ('published','draft','scheduled')"
    : "p.status = 'published'"
  const post = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ? AND ${statusFilter}
  `).get(req.params.slug)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  // Member-only content gating
  const accessLevel = post.access_level || 'public'
  if (!isAdmin && accessLevel !== 'public') {
    if (!customerHasAccess(req, accessLevel)) {
      // Return teaser (no content) with gated flag
      const { content: _omit, ...teaser } = parsePost(post)
      return res.json({ ...teaser, content: '', _gated: true, access_level: accessLevel })
    }
  }

  res.json({ ...parsePost(post), _preview: isAdmin && post.status !== 'published' })
})

// POST /api/posts (auth)
router.post('/', authMiddleware, (req, res) => {
  const { title, slug, excerpt, content, cover_image, gallery, category_id, tags, status, published_at, meta_title, meta_desc } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })

  const finalSlug = slug || slugify(title)
  const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(finalSlug)
  if (existing) return res.status(409).json({ error: 'Slug already exists' })

  const finalStatus = status || 'draft'
  let finalPublished = null
  if (finalStatus === 'published') finalPublished = published_at || new Date().toISOString()
  else if (finalStatus === 'scheduled') finalPublished = published_at || null

  const info = db.prepare(`
    INSERT INTO posts (title, slug, excerpt, content, cover_image, gallery, category_id, tags, status, published_at, meta_title, meta_desc, access_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, finalSlug,
    excerpt || null, content || '',
    cover_image || null,
    JSON.stringify(Array.isArray(gallery) ? gallery : []),
    category_id || null,
    JSON.stringify(Array.isArray(tags) ? tags : []),
    finalStatus, finalPublished,
    meta_title || null, meta_desc || null,
    req.body.access_level || 'public'
  )

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid)
  logActivity(req.user?.id, req.user?.name, 'created post', 'post', post.id, post.title)
  fireWebhooks('post.created', parsePost(post))
  if (finalStatus === 'published') fireWebhooks('post.published', parsePost(post))
  res.status(201).json(parsePost(post))
})

// PUT /api/posts/:id (auth)
router.put('/:id', authMiddleware, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  const { title, slug, excerpt, content, cover_image, gallery, category_id, tags, status, published_at, meta_title, meta_desc } = req.body
  const newSlug = slug || post.slug

  const conflict = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(newSlug, post.id)
  if (conflict) return res.status(409).json({ error: 'Slug already in use' })

  const parsedExisting = parsePost(post)
  const newStatus = status ?? post.status
  let newPublished = published_at ?? post.published_at
  if (newStatus === 'published' && !newPublished) newPublished = new Date().toISOString()
  if (newStatus === 'draft') newPublished = null
  // 'scheduled' keeps the provided published_at (future date)

  db.prepare(`
    UPDATE posts SET title=?, slug=?, excerpt=?, content=?, cover_image=?, gallery=?, category_id=?,
    tags=?, status=?, published_at=?, meta_title=?, meta_desc=?, access_level=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    title ?? post.title,
    newSlug,
    excerpt ?? post.excerpt,
    content ?? post.content,
    cover_image ?? post.cover_image,
    JSON.stringify(Array.isArray(gallery) ? gallery : parsedExisting.gallery),
    category_id ?? post.category_id,
    JSON.stringify(Array.isArray(tags) ? tags : parsedExisting.tags),
    newStatus, newPublished,
    meta_title ?? post.meta_title,
    meta_desc ?? post.meta_desc,
    req.body.access_level ?? post.access_level ?? 'public',
    post.id
  )

  const updated = parsePost(db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id))
  // Save a revision snapshot of the pre-update state
  saveRevision('post', post.id, post.title, parsePost(post), req.user?.id, req.user?.name)
  logActivity(req.user?.id, req.user?.name, 'updated post', 'post', updated.id, updated.title)
  fireWebhooks('post.updated', updated)
  if (newStatus === 'published' && post.status !== 'published') fireWebhooks('post.published', updated)
  res.json(updated)
})

// DELETE /api/posts/:id (auth)
router.delete('/:id', authMiddleware, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Post not found' })
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id)
  logActivity(req.user?.id, req.user?.name, 'deleted post', 'post', post.id, post.title)
  fireWebhooks('post.deleted', { id: post.id, title: post.title, slug: post.slug })
  res.json({ message: 'Deleted' })
})

// POST /api/posts/bulk — bulk action on multiple posts
router.post('/bulk', authMiddleware, (req, res) => {
  const { ids, action } = req.body
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' })
  if (!['publish', 'unpublish', 'delete'].includes(action)) return res.status(400).json({ error: 'Invalid action' })

  const now = new Date().toISOString()
  let affected = 0

  const doInTransaction = db.transaction(() => {
    for (const id of ids) {
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)
      if (!post) continue
      if (action === 'delete') {
        db.prepare('DELETE FROM posts WHERE id = ?').run(id)
        logActivity(req.user?.id, req.user?.name, 'deleted post', 'post', post.id, post.title)
        fireWebhooks('post.deleted', { id: post.id, title: post.title, slug: post.slug })
      } else {
        const newStatus = action === 'publish' ? 'published' : 'draft'
        const newPublished = action === 'publish' ? (post.published_at || now) : post.published_at
        db.prepare(`UPDATE posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ?`)
          .run(newStatus, newPublished, now, id)
        logActivity(req.user?.id, req.user?.name, `${action}ed post`, 'post', post.id, post.title)
        if (action === 'publish' && post.status !== 'published') {
          const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)
          fireWebhooks('post.published', parsePost(updated))
        }
      }
      affected++
    }
  })
  doInTransaction()
  res.json({ affected })
})

export default router

// ─── Duplicate post ───────────────────────────────────────────────────────────
// POST /api/posts/:id/duplicate
router.post('/:id/duplicate', authMiddleware, (req, res) => {
  const orig = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!orig) return res.status(404).json({ error: 'Post not found' })

  const baseSlug = orig.slug + '-copy'
  let slug = baseSlug, n = 1
  while (db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug)) {
    slug = `${baseSlug}-${n++}`
  }

  const result = db.prepare(`
    INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, tags,
      status, meta_title, meta_desc, author_id, author_name, author_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).run(
    orig.title + ' (Copy)',
    slug,
    orig.excerpt || '',
    orig.content || '',
    orig.cover_image || '',
    orig.category_id || null,
    orig.tags || '[]',
    orig.meta_title || '',
    orig.meta_desc || '',
    orig.author_id,
    orig.author_name,
    orig.author_email || '',
  )

  const newPost = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(newPost)
})
