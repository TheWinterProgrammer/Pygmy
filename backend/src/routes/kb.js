// Pygmy CMS — Knowledge Base API
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ─── Helper ───────────────────────────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ─── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  const { all } = req.query
  // Check if admin token present
  const token = req.headers.authorization?.split(' ')[1]
  const isAdmin = !!token && all === '1'
  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM kb_articles a WHERE a.category_id = c.id AND a.status = 'published') AS article_count
    FROM kb_categories c
    WHERE 1=1`
  if (!isAdmin) sql += ` AND c.active = 1`
  sql += ` ORDER BY c.sort_order ASC, c.name ASC`
  res.json(db.prepare(sql).all())
})

router.post('/categories', auth, (req, res) => {
  const { name, slug, description = '', icon = '📖', color = '#e05562', sort_order = 0, active = 1 } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const finalSlug = slug || slugify(name)
  const result = db.prepare(`
    INSERT INTO kb_categories (name, slug, description, icon, color, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, finalSlug, description, icon, color, sort_order, active ? 1 : 0)
  res.status(201).json(db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(result.lastInsertRowid))
})

router.put('/categories/:id', auth, (req, res) => {
  const { name, slug, description, icon, color, sort_order, active } = req.body
  const existing = db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare(`
    UPDATE kb_categories SET
      name = ?, slug = ?, description = ?, icon = ?, color = ?,
      sort_order = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? existing.name,
    slug ?? existing.slug,
    description ?? existing.description,
    icon ?? existing.icon,
    color ?? existing.color,
    sort_order ?? existing.sort_order,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  )
  res.json(db.prepare('SELECT * FROM kb_categories WHERE id = ?').get(req.params.id))
})

router.delete('/categories/:id', auth, (req, res) => {
  const result = db.prepare('DELETE FROM kb_categories WHERE id = ?').run(req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

// ─── Articles (admin) ─────────────────────────────────────────────────────────
router.get('/articles', auth, (req, res) => {
  const { status, category_id, q } = req.query
  let sql = `
    SELECT a.*, c.name AS category_name, c.slug AS category_slug
    FROM kb_articles a
    LEFT JOIN kb_categories c ON a.category_id = c.id
    WHERE 1=1`
  const params = []
  if (status) { sql += ` AND a.status = ?`; params.push(status) }
  if (category_id) { sql += ` AND a.category_id = ?`; params.push(category_id) }
  if (q) { sql += ` AND (a.title LIKE ? OR a.excerpt LIKE ?)`; params.push(`%${q}%`, `%${q}%`) }
  sql += ` ORDER BY a.sort_order ASC, a.created_at DESC`
  res.json(db.prepare(sql).all(...params))
})

router.get('/articles/public', (req, res) => {
  const { category_id, q, limit = 50 } = req.query
  let sql = `
    SELECT a.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
    FROM kb_articles a
    LEFT JOIN kb_categories c ON a.category_id = c.id
    WHERE a.status = 'published'`
  const params = []
  if (category_id) { sql += ` AND a.category_id = ?`; params.push(category_id) }
  if (q) { sql += ` AND (a.title LIKE ? OR a.content LIKE ? OR a.excerpt LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  sql += ` ORDER BY a.sort_order ASC, a.views DESC LIMIT ?`
  params.push(parseInt(limit))
  res.json(db.prepare(sql).all(...params))
})

// Admin: get by numeric ID
router.get('/articles/admin/:id', auth, (req, res) => {
  const article = db.prepare(`
    SELECT a.*, c.name AS category_name, c.slug AS category_slug
    FROM kb_articles a
    LEFT JOIN kb_categories c ON a.category_id = c.id
    WHERE a.id = ?
  `).get(req.params.id)
  if (!article) return res.status(404).json({ error: 'Not found' })
  res.json(article)
})

router.get('/articles/:slug', (req, res) => {
  const { admin } = req.query
  const token = req.headers.authorization?.split(' ')[1]
  const article = db.prepare(`
    SELECT a.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
    FROM kb_articles a
    LEFT JOIN kb_categories c ON a.category_id = c.id
    WHERE a.slug = ?
  `).get(req.params.slug)
  if (!article) return res.status(404).json({ error: 'Not found' })
  // Increment views unless admin request
  if (!(admin === '1' && token)) {
    db.prepare(`UPDATE kb_articles SET views = views + 1 WHERE id = ?`).run(article.id)
    article.views = (article.views || 0) + 1
  }
  res.json(article)
})

router.post('/articles', auth, (req, res) => {
  const { title, slug, excerpt = '', content = '', status = 'draft', category_id, sort_order = 0, meta_title, meta_desc } = req.body
  if (!title) return res.status(400).json({ error: 'title is required' })
  const finalSlug = slug || slugify(title)
  const result = db.prepare(`
    INSERT INTO kb_articles (title, slug, excerpt, content, status, category_id, sort_order, author_id, meta_title, meta_desc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, finalSlug, excerpt, content, status, category_id || null, sort_order, req.user?.id || null, meta_title || null, meta_desc || null)
  res.status(201).json(db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(result.lastInsertRowid))
})

router.put('/articles/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const { title, slug, excerpt, content, status, category_id, sort_order, meta_title, meta_desc } = req.body
  db.prepare(`
    UPDATE kb_articles SET
      title = ?, slug = ?, excerpt = ?, content = ?, status = ?,
      category_id = ?, sort_order = ?, meta_title = ?, meta_desc = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? existing.title,
    slug ?? existing.slug,
    excerpt ?? existing.excerpt,
    content ?? existing.content,
    status ?? existing.status,
    category_id !== undefined ? (category_id || null) : existing.category_id,
    sort_order ?? existing.sort_order,
    meta_title !== undefined ? (meta_title || null) : existing.meta_title,
    meta_desc !== undefined ? (meta_desc || null) : existing.meta_desc,
    req.params.id
  )
  res.json(db.prepare('SELECT * FROM kb_articles WHERE id = ?').get(req.params.id))
})

router.delete('/articles/:id', auth, (req, res) => {
  const result = db.prepare('DELETE FROM kb_articles WHERE id = ?').run(req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

router.post('/articles/:slug/helpful', (req, res) => {
  const { vote } = req.body
  if (!['yes', 'no'].includes(vote)) return res.status(400).json({ error: 'vote must be yes or no' })
  const article = db.prepare('SELECT id FROM kb_articles WHERE slug = ?').get(req.params.slug)
  if (!article) return res.status(404).json({ error: 'Not found' })
  if (vote === 'yes') {
    db.prepare(`UPDATE kb_articles SET helpful_yes = helpful_yes + 1 WHERE id = ?`).run(article.id)
  } else {
    db.prepare(`UPDATE kb_articles SET helpful_no = helpful_no + 1 WHERE id = ?`).run(article.id)
  }
  const updated = db.prepare('SELECT helpful_yes, helpful_no FROM kb_articles WHERE id = ?').get(article.id)
  res.json(updated)
})

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', auth, (req, res) => {
  const total_articles = db.prepare(`SELECT COUNT(*) AS n FROM kb_articles`).get().n
  const published_articles = db.prepare(`SELECT COUNT(*) AS n FROM kb_articles WHERE status = 'published'`).get().n
  const total_categories = db.prepare(`SELECT COUNT(*) AS n FROM kb_categories`).get().n
  const total_views = db.prepare(`SELECT COALESCE(SUM(views),0) AS n FROM kb_articles`).get().n
  const total_helpful_yes = db.prepare(`SELECT COALESCE(SUM(helpful_yes),0) AS n FROM kb_articles`).get().n
  res.json({ total_articles, published_articles, total_categories, total_views, total_helpful_yes })
})

// ─── Search ───────────────────────────────────────────────────────────────────
router.get('/search', (req, res) => {
  const { q = '' } = req.query
  if (!q.trim()) return res.json([])
  const articles = db.prepare(`
    SELECT a.*, c.name AS category_name, c.slug AS category_slug
    FROM kb_articles a
    LEFT JOIN kb_categories c ON a.category_id = c.id
    WHERE a.status = 'published'
      AND (a.title LIKE ? OR a.content LIKE ? OR a.excerpt LIKE ?)
    ORDER BY a.views DESC
    LIMIT 20
  `).all(`%${q}%`, `%${q}%`, `%${q}%`)
  res.json(articles)
})

export default router
