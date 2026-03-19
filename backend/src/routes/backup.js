// Pygmy CMS — Backup & Export routes
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toCSV(rows, columns) {
  if (!rows.length) return columns.join(',') + '\n'
  const escape = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const header = columns.join(',')
  const lines = rows.map(row => columns.map(c => escape(row[c])).join(','))
  return [header, ...lines].join('\n')
}

// ─── Full JSON export ─────────────────────────────────────────────────────────

// GET /api/backup/export — full JSON dump (admin only)
router.get('/export', authMiddleware, (req, res) => {
  const siteName = db.prepare("SELECT value FROM settings WHERE key = 'site_name'").get()?.value || 'Pygmy'
  const slug = siteName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const date = new Date().toISOString().split('T')[0]
  const filename = `pygmy-backup-${slug}-${date}.json`

  const payload = {
    exported_at: new Date().toISOString(),
    version: '9',
    site_name: siteName,
    data: {
      settings:    db.prepare('SELECT key, value FROM settings').all(),
      pages:       db.prepare('SELECT * FROM pages').all(),
      posts:       db.prepare('SELECT * FROM posts').all(),
      categories:  db.prepare('SELECT * FROM categories').all(),
      products:    db.prepare('SELECT * FROM products').all(),
      product_categories: db.prepare('SELECT * FROM product_categories').all(),
      navigation:  db.prepare('SELECT * FROM navigation').all(),
      subscribers: db.prepare('SELECT id, email, name, status, subscribed_at, unsubscribed_at FROM subscribers').all(),
      redirects:   db.prepare('SELECT * FROM redirects').all(),
    }
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.json(payload)
})

// ─── CSV exports ──────────────────────────────────────────────────────────────

// GET /api/backup/export/csv?type=posts|pages|products|subscribers
router.get('/export/csv', authMiddleware, (req, res) => {
  const type = req.query.type || 'posts'
  const date = new Date().toISOString().split('T')[0]

  let rows, columns, filename

  switch (type) {
    case 'posts':
      rows = db.prepare(`
        SELECT p.id, p.title, p.slug, p.excerpt, p.status, p.published_at,
               p.tags, p.meta_title, p.meta_desc, p.created_at, p.updated_at,
               c.name as category
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.created_at DESC
      `).all()
      columns = ['id','title','slug','excerpt','category','status','published_at','tags','meta_title','meta_desc','created_at','updated_at']
      filename = `pygmy-posts-${date}.csv`
      break

    case 'pages':
      rows = db.prepare('SELECT id, title, slug, status, meta_title, meta_desc, sort_order, created_at, updated_at FROM pages ORDER BY sort_order').all()
      columns = ['id','title','slug','status','meta_title','meta_desc','sort_order','created_at','updated_at']
      filename = `pygmy-pages-${date}.csv`
      break

    case 'products':
      rows = db.prepare(`
        SELECT p.id, p.name, p.slug, p.excerpt, p.price, p.sale_price, p.sku,
               p.status, p.featured, p.tags, p.meta_title, p.meta_desc, p.created_at,
               pc.name as category
        FROM products p
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        ORDER BY p.created_at DESC
      `).all()
      columns = ['id','name','slug','excerpt','category','price','sale_price','sku','status','featured','tags','meta_title','meta_desc','created_at']
      filename = `pygmy-products-${date}.csv`
      break

    case 'subscribers':
      rows = db.prepare('SELECT id, email, name, status, subscribed_at, unsubscribed_at FROM subscribers ORDER BY subscribed_at DESC').all()
      columns = ['id','email','name','status','subscribed_at','unsubscribed_at']
      filename = `pygmy-subscribers-${date}.csv`
      break

    default:
      return res.status(400).json({ error: 'Invalid type. Use: posts, pages, products, subscribers' })
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(toCSV(rows, columns))
})

// ─── Backup stats ─────────────────────────────────────────────────────────────

// GET /api/backup/stats — counts for the backup page
router.get('/stats', authMiddleware, (req, res) => {
  res.json({
    pages:       db.prepare('SELECT COUNT(*) as n FROM pages').get().n,
    posts:       db.prepare('SELECT COUNT(*) as n FROM posts').get().n,
    products:    db.prepare('SELECT COUNT(*) as n FROM products').get().n,
    media:       db.prepare('SELECT COUNT(*) as n FROM media').get().n,
    subscribers: db.prepare('SELECT COUNT(*) as n FROM subscribers').get().n,
    redirects:   db.prepare('SELECT COUNT(*) as n FROM redirects').get().n,
  })
})

// ─── JSON Import/Restore ──────────────────────────────────────────────────────

// POST /api/backup/import — restore from a JSON backup (admin only)
// Body: { data: <backup JSON object>, mode: 'merge' | 'replace' }
//   merge  — insert/update records, keep existing data that's not in the file
//   replace — wipe content tables first, then import everything
router.post('/import', authMiddleware, (req, res) => {
  const { data, mode = 'merge' } = req.body
  if (!data) return res.status(400).json({ error: 'No data provided' })

  const report = { imported: {}, skipped: {}, errors: [] }

  const run = db.transaction(() => {
    // ── Settings ──────────────────────────────────────────────────────────────
    if (Array.isArray(data.settings)) {
      let n = 0
      // Skip sensitive keys on import
      const skipKeys = ['smtp_pass']
      for (const { key, value } of data.settings) {
        if (skipKeys.includes(key)) continue
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
        n++
      }
      report.imported.settings = n
    }

    // ── Pages ─────────────────────────────────────────────────────────────────
    if (Array.isArray(data.pages)) {
      if (mode === 'replace') db.prepare('DELETE FROM pages').run()
      let n = 0
      for (const p of data.pages) {
        try {
          db.prepare(`
            INSERT OR REPLACE INTO pages
              (id, title, slug, content, meta_title, meta_desc, status, sort_order, publish_at, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            p.id, p.title, p.slug, p.content || '',
            p.meta_title || null, p.meta_desc || null,
            p.status || 'draft', p.sort_order || 0,
            p.publish_at || null,
            p.created_at || new Date().toISOString(),
            p.updated_at || new Date().toISOString()
          )
          n++
        } catch (e) { report.errors.push(`page "${p.slug}": ${e.message}`) }
      }
      report.imported.pages = n
    }

    // ── Post categories ───────────────────────────────────────────────────────
    if (Array.isArray(data.categories)) {
      if (mode === 'replace') db.prepare('DELETE FROM categories').run()
      let n = 0
      for (const c of data.categories) {
        try {
          db.prepare(`INSERT OR REPLACE INTO categories (id, name, slug, created_at) VALUES (?,?,?,?)`).run(
            c.id, c.name, c.slug, c.created_at || new Date().toISOString()
          )
          n++
        } catch (e) { report.errors.push(`category "${c.slug}": ${e.message}`) }
      }
      report.imported.categories = n
    }

    // ── Posts ─────────────────────────────────────────────────────────────────
    if (Array.isArray(data.posts)) {
      if (mode === 'replace') db.prepare('DELETE FROM posts').run()
      let n = 0
      for (const p of data.posts) {
        try {
          db.prepare(`
            INSERT OR REPLACE INTO posts
              (id, title, slug, excerpt, content, cover_image, category_id,
               tags, status, published_at, meta_title, meta_desc, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            p.id, p.title, p.slug, p.excerpt || '', p.content || '',
            p.cover_image || null, p.category_id || null,
            p.tags || '[]', p.status || 'draft',
            p.published_at || null,
            p.meta_title || null, p.meta_desc || null,
            p.created_at || new Date().toISOString(),
            p.updated_at || new Date().toISOString()
          )
          n++
        } catch (e) { report.errors.push(`post "${p.slug}": ${e.message}`) }
      }
      report.imported.posts = n
    }

    // ── Product categories ────────────────────────────────────────────────────
    if (Array.isArray(data.product_categories)) {
      if (mode === 'replace') db.prepare('DELETE FROM product_categories').run()
      let n = 0
      for (const c of data.product_categories) {
        try {
          db.prepare(`INSERT OR REPLACE INTO product_categories (id, name, slug, created_at) VALUES (?,?,?,?)`).run(
            c.id, c.name, c.slug, c.created_at || new Date().toISOString()
          )
          n++
        } catch (e) { report.errors.push(`product_category "${c.slug}": ${e.message}`) }
      }
      report.imported.product_categories = n
    }

    // ── Products ──────────────────────────────────────────────────────────────
    if (Array.isArray(data.products)) {
      if (mode === 'replace') db.prepare('DELETE FROM products').run()
      let n = 0
      for (const p of data.products) {
        try {
          db.prepare(`
            INSERT OR REPLACE INTO products
              (id, name, slug, excerpt, description, price, sale_price, sku,
               cover_image, gallery, category_id, tags, status, featured,
               meta_title, meta_desc, publish_at, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            p.id, p.name, p.slug, p.excerpt || '', p.description || '',
            p.price || null, p.sale_price || null, p.sku || null,
            p.cover_image || null, p.gallery || '[]',
            p.category_id || null, p.tags || '[]',
            p.status || 'draft', p.featured ? 1 : 0,
            p.meta_title || null, p.meta_desc || null,
            p.publish_at || null,
            p.created_at || new Date().toISOString(),
            p.updated_at || new Date().toISOString()
          )
          n++
        } catch (e) { report.errors.push(`product "${p.slug}": ${e.message}`) }
      }
      report.imported.products = n
    }

    // ── Navigation ────────────────────────────────────────────────────────────
    if (Array.isArray(data.navigation)) {
      if (mode === 'replace') db.prepare('DELETE FROM navigation').run()
      let n = 0
      for (const item of data.navigation) {
        try {
          db.prepare(`
            INSERT OR REPLACE INTO navigation (id, label, url, target, sort_order, parent_id)
            VALUES (?,?,?,?,?,?)
          `).run(item.id, item.label, item.url, item.target || '_self', item.sort_order || 0, item.parent_id || null)
          n++
        } catch (e) { report.errors.push(`nav "${item.label}": ${e.message}`) }
      }
      report.imported.navigation = n
    }

    // ── Subscribers ───────────────────────────────────────────────────────────
    if (Array.isArray(data.subscribers)) {
      let n = 0
      for (const s of data.subscribers) {
        try {
          db.prepare(`
            INSERT OR IGNORE INTO subscribers (email, name, status, subscribed_at, unsubscribed_at)
            VALUES (?,?,?,?,?)
          `).run(s.email, s.name || null, s.status || 'active',
            s.subscribed_at || new Date().toISOString(), s.unsubscribed_at || null)
          n++
        } catch (e) { report.errors.push(`subscriber "${s.email}": ${e.message}`) }
      }
      report.imported.subscribers = n
    }

    // ── Redirects ─────────────────────────────────────────────────────────────
    if (Array.isArray(data.redirects)) {
      if (mode === 'replace') db.prepare('DELETE FROM redirects').run()
      let n = 0
      for (const r of data.redirects) {
        try {
          db.prepare(`
            INSERT OR REPLACE INTO redirects (id, from_path, to_path, type, created_at)
            VALUES (?,?,?,?,?)
          `).run(r.id, r.from_path, r.to_path, r.type || 301, r.created_at || new Date().toISOString())
          n++
        } catch (e) { report.errors.push(`redirect "${r.from_path}": ${e.message}`) }
      }
      report.imported.redirects = n
    }
  })

  try {
    run()
    res.json({ ok: true, mode, report })
  } catch (e) {
    res.status(500).json({ error: 'Import failed', detail: e.message })
  }
})

export default router
