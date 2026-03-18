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

export default router
