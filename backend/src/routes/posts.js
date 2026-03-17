// Pygmy CMS — Posts CRUD
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function parsePost(post) {
  if (!post) return null
  return { ...post, tags: JSON.parse(post.tags || '[]') }
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

// GET /api/posts/:slug
router.get('/:slug', (req, res) => {
  const post = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ?
  `).get(req.params.slug)
  if (!post) return res.status(404).json({ error: 'Post not found' })
  res.json(parsePost(post))
})

// POST /api/posts (auth)
router.post('/', authMiddleware, (req, res) => {
  const { title, slug, excerpt, content, cover_image, category_id, tags, status, published_at, meta_title, meta_desc } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })

  const finalSlug = slug || slugify(title)
  const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(finalSlug)
  if (existing) return res.status(409).json({ error: 'Slug already exists' })

  const finalStatus = status || 'draft'
  const finalPublished = finalStatus === 'published' ? (published_at || new Date().toISOString()) : null

  const info = db.prepare(`
    INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, tags, status, published_at, meta_title, meta_desc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, finalSlug,
    excerpt || null, content || '',
    cover_image || null,
    category_id || null,
    JSON.stringify(Array.isArray(tags) ? tags : []),
    finalStatus, finalPublished,
    meta_title || null, meta_desc || null
  )

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(parsePost(post))
})

// PUT /api/posts/:id (auth)
router.put('/:id', authMiddleware, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  const { title, slug, excerpt, content, cover_image, category_id, tags, status, published_at, meta_title, meta_desc } = req.body
  const newSlug = slug || post.slug

  const conflict = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(newSlug, post.id)
  if (conflict) return res.status(409).json({ error: 'Slug already in use' })

  const parsedExisting = parsePost(post)
  const newStatus = status ?? post.status
  let newPublished = published_at ?? post.published_at
  if (newStatus === 'published' && !newPublished) newPublished = new Date().toISOString()
  if (newStatus === 'draft') newPublished = null

  db.prepare(`
    UPDATE posts SET title=?, slug=?, excerpt=?, content=?, cover_image=?, category_id=?,
    tags=?, status=?, published_at=?, meta_title=?, meta_desc=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    title ?? post.title,
    newSlug,
    excerpt ?? post.excerpt,
    content ?? post.content,
    cover_image ?? post.cover_image,
    category_id ?? post.category_id,
    JSON.stringify(Array.isArray(tags) ? tags : parsedExisting.tags),
    newStatus, newPublished,
    meta_title ?? post.meta_title,
    meta_desc ?? post.meta_desc,
    post.id
  )

  res.json(parsePost(db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id)))
})

// DELETE /api/posts/:id (auth)
router.delete('/:id', authMiddleware, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Post not found' })
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id)
  res.json({ message: 'Deleted' })
})

export default router
