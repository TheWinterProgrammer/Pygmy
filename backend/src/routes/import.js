// Pygmy CMS — Import Wizard API
// Supports: WordPress XML (WXR), Markdown files (ZIP or single .md)
import { Router } from 'express'
import multer from 'multer'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import AdmZip from 'adm-zip'

const router = Router()
const upload = multer({ dest: '/tmp/pygmy-import/' })

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 200)
}

function uniqueSlug(base, table, existingSet) {
  let slug = base || slugify(String(Date.now()))
  let i = 1
  while (existingSet.has(slug)) {
    slug = `${base}-${i++}`
  }
  existingSet.add(slug)
  return slug
}

// ── POST /api/import/wordpress ─ WordPress XML (WXR) ────────────────────────
router.post('/wordpress', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  try {
    const xml = fs.readFileSync(req.file.path, 'utf8')
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const parsed = parser.parse(xml)

    const channel = parsed?.rss?.channel
    if (!channel) return res.status(400).json({ error: 'Invalid WordPress export file (no channel found)' })

    const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []

    let stats = { posts: 0, pages: 0, categories: 0, skipped: 0, errors: [] }

    // Collect existing slugs
    const existingPostSlugs = new Set(db.prepare('SELECT slug FROM posts').all().map(r => r.slug))
    const existingPageSlugs = new Set(db.prepare('SELECT slug FROM pages').all().map(r => r.slug))

    // Import categories first
    const catSet = new Map()
    if (channel['wp:category']) {
      const cats = Array.isArray(channel['wp:category']) ? channel['wp:category'] : [channel['wp:category']]
      for (const cat of cats) {
        const name = cat['wp:cat_name'] || ''
        if (!name) continue
        const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name)
        if (existing) {
          catSet.set(name, existing.id)
        } else {
          const r = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run(name, slugify(name))
          catSet.set(name, r.lastInsertRowid)
          stats.categories++
        }
      }
    }

    // Import items (posts and pages)
    for (const item of items) {
      try {
        const postType = item['wp:post_type']
        if (!['post', 'page'].includes(postType)) { stats.skipped++; continue }

        const title   = item.title || ''
        const slug    = item['wp:post_name'] || slugify(title)
        const content = item['content:encoded'] || ''
        const excerpt = item['excerpt:encoded'] || ''
        const status  = item['wp:status'] === 'publish' ? 'published' : 'draft'
        const pubDate = item.pubDate || item['wp:post_date'] || null

        if (postType === 'post') {
          if (existingPostSlugs.has(slug)) { stats.skipped++; continue }
          const finalSlug = uniqueSlug(slug, 'posts', existingPostSlugs)

          // Get categories
          let catId = null
          const categories = item.category
          if (categories) {
            const catArr = Array.isArray(categories) ? categories : [categories]
            const firstCat = catArr.find(c => c['@_domain'] === 'category')
            if (firstCat) {
              const catName = firstCat['#text'] || firstCat
              catId = catSet.get(String(catName)) || null
            }
          }

          db.prepare(`
            INSERT INTO posts (title, slug, content, excerpt, status, category_id, published_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(title, finalSlug, content, excerpt, status, catId, pubDate, pubDate || new Date().toISOString())
          stats.posts++

        } else if (postType === 'page') {
          if (existingPageSlugs.has(slug)) { stats.skipped++; continue }
          const finalSlug = uniqueSlug(slug, 'pages', existingPageSlugs)

          db.prepare(`
            INSERT INTO pages (title, slug, content, status, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(title, finalSlug, content, status, pubDate || new Date().toISOString())
          stats.pages++
        }
      } catch (err) {
        stats.errors.push(String(err.message))
      }
    }

    fs.unlinkSync(req.file.path)
    res.json({ ok: true, stats })
  } catch (err) {
    try { fs.unlinkSync(req.file.path) } catch {}
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/import/markdown ─ Markdown files (single .md or .zip) ──────────
router.post('/markdown', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const { type = 'post' } = req.body // 'post' or 'page'
  const table = type === 'page' ? 'pages' : 'posts'
  const existingSlugs = new Set(db.prepare(`SELECT slug FROM ${table}`).all().map(r => r.slug))

  let stats = { imported: 0, skipped: 0, errors: [] }

  function importMarkdown(filename, content) {
    // Parse frontmatter
    let title = path.basename(filename, '.md').replace(/[-_]/g, ' ')
    let slug = slugify(path.basename(filename, '.md'))
    let body = content
    let status = 'published'
    let excerpt = ''
    let tags = ''

    // YAML frontmatter
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
    if (fmMatch) {
      const fm = fmMatch[1]
      body = content.slice(fmMatch[0].length)

      const titleM = fm.match(/^title:\s*['"]?(.+?)['"]?\s*$/m)
      if (titleM) title = titleM[1]
      const slugM = fm.match(/^slug:\s*['"]?(.+?)['"]?\s*$/m)
      if (slugM) slug = slugify(slugM[1])
      const statusM = fm.match(/^(status|draft):\s*(.+?)\s*$/m)
      if (statusM) status = statusM[2] === 'true' || statusM[2] === 'draft' ? 'draft' : 'published'
      const excerptM = fm.match(/^excerpt:\s*['"]?(.+?)['"]?\s*$/m)
      if (excerptM) excerpt = excerptM[1]
      const tagsM = fm.match(/^tags:\s*\[(.+?)\]/m)
      if (tagsM) tags = tagsM[1].replace(/['"]/g, '').trim()
    }

    const finalSlug = uniqueSlug(slug, table, existingSlugs)
    if (slug !== finalSlug) { stats.skipped++; return } // already exists

    try {
      if (type === 'page') {
        db.prepare(`
          INSERT INTO pages (title, slug, content, status, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(title, finalSlug, body.trim(), status)
      } else {
        db.prepare(`
          INSERT INTO posts (title, slug, content, excerpt, tags, status, published_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(title, finalSlug, body.trim(), excerpt, tags, status)
      }
      stats.imported++
    } catch (err) {
      stats.errors.push(`${filename}: ${err.message}`)
    }
  }

  try {
    const filePath = req.file.path
    const originalName = req.file.originalname.toLowerCase()

    if (originalName.endsWith('.md')) {
      const content = fs.readFileSync(filePath, 'utf8')
      importMarkdown(req.file.originalname, content)
    } else if (originalName.endsWith('.zip')) {
      const zip = new AdmZip(filePath)
      const entries = zip.getEntries()
      for (const entry of entries) {
        if (!entry.entryName.endsWith('.md') || entry.isDirectory) continue
        const content = entry.getData().toString('utf8')
        importMarkdown(path.basename(entry.entryName), content)
      }
    } else {
      return res.status(400).json({ error: 'File must be .md or .zip' })
    }

    try { fs.unlinkSync(req.file.path) } catch {}
    res.json({ ok: true, type, stats })
  } catch (err) {
    try { fs.unlinkSync(req.file.path) } catch {}
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/import/status ─ Quick status ────────────────────────────────────
router.get('/status', authMiddleware, (req, res) => {
  const posts = db.prepare('SELECT COUNT(*) as n FROM posts').get().n
  const pages = db.prepare('SELECT COUNT(*) as n FROM pages').get().n
  const products = db.prepare('SELECT COUNT(*) as n FROM products').get().n
  res.json({ posts, pages, products })
})

export default router
