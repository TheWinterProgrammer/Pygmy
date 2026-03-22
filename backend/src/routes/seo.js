// Pygmy CMS — SEO routes (sitemap.xml + RSS feed)
import { Router } from 'express'
import db from '../db.js'

const router = Router()

function getSiteSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function escapeXml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// GET /sitemap.xml
router.get('/sitemap.xml', (req, res) => {
  const settings = getSiteSettings()
  const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`

  const pages = db.prepare("SELECT slug, updated_at FROM pages WHERE status = 'published' ORDER BY sort_order ASC").all()
  const posts = db.prepare("SELECT slug, published_at, updated_at FROM posts WHERE status = 'published' ORDER BY published_at DESC").all()
  const products = db.prepare("SELECT slug, updated_at FROM products WHERE status = 'published' ORDER BY created_at DESC").all()
  const events = db.prepare("SELECT slug, start_date, updated_at FROM events WHERE status = 'published' ORDER BY start_date ASC").all()

  const urls = []

  // Homepage
  urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`)

  // Blog listing
  if (posts.length > 0) {
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`)
  }

  // Pages
  for (const page of pages) {
    const lastmod = page.updated_at ? page.updated_at.split('T')[0] : ''
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/${escapeXml(page.slug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`)
  }

  // Posts
  for (const post of posts) {
    const lastmod = (post.updated_at || post.published_at || '').split('T')[0]
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/blog/${escapeXml(post.slug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`)
  }

  // Shop listing
  if (products.length > 0) {
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/shop</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
  }

  // Products
  for (const product of products) {
    const lastmod = (product.updated_at || '').split('T')[0]
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/shop/${escapeXml(product.slug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.65</priority>
  </url>`)
  }

  // Events listing
  if (events.length > 0) {
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/events</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
  }

  // Individual events
  for (const ev of events) {
    const lastmod = (ev.updated_at || ev.start_date || '').split('T')[0]
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/events/${escapeXml(ev.slug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.65</priority>
  </url>`)
  }

  // Bundles
  const bundles = db.prepare("SELECT slug, updated_at FROM product_bundles WHERE status = 'published' ORDER BY created_at DESC").all()
  if (bundles.length > 0) {
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/shop/bundles</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`)
    for (const b of bundles) {
      const lastmod = (b.updated_at || '').split('T')[0]
      urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/shop/bundles/${escapeXml(b.slug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`)
    }
  }

// Custom forms (active only)
  const forms = db.prepare("SELECT slug, updated_at FROM custom_forms WHERE status = 'active' ORDER BY created_at DESC").all()
  for (const form of forms) {
    const lastmod = (form.updated_at || '').split('T')[0]
    urls.push(`
  <url>
    <loc>${escapeXml(siteUrl)}/forms/${escapeXml(form.slug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>`

  res.set('Content-Type', 'application/xml; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=3600')
  res.send(xml)
})

// GET /feed.xml  (RSS 2.0)
router.get('/feed.xml', (req, res) => {
  const settings = getSiteSettings()
  const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`
  const siteName = settings.site_name || 'Pygmy CMS'
  const siteTagline = settings.site_tagline || ''

  const posts = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'published'
    ORDER BY p.published_at DESC
    LIMIT 20
  `).all()

  const items = posts.map(post => {
    const pubDate = post.published_at ? new Date(post.published_at).toUTCString() : ''
    const excerpt = escapeXml(post.excerpt || '')
    const link = `${escapeXml(siteUrl)}/blog/${escapeXml(post.slug)}`
    return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
      ${post.category_name ? `<category>${escapeXml(post.category_name)}</category>` : ''}
      ${excerpt ? `<description>${excerpt}</description>` : ''}
    </item>`
  })

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(siteTagline)}</description>
    <language>en-us</language>
    <atom:link href="${escapeXml(siteUrl)}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items.join('')}
  </channel>
</rss>`

  res.set('Content-Type', 'application/rss+xml; charset=utf-8')
  res.set('Cache-Control', 'public, max-age=3600')
  res.send(rss)
})

// GET /robots.txt — served from the robots_txt setting
router.get('/robots.txt', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'robots_txt'").get()
    const content = row?.value || 'User-agent: *\nAllow: /'
    res.set('Content-Type', 'text/plain; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(content)
  } catch {
    res.set('Content-Type', 'text/plain')
    res.send('User-agent: *\nAllow: /')
  }
})

export default router
