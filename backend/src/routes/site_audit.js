// Site Audit — Broken Links + SEO issues — Phase 60
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'
import https from 'https'
import http from 'http'

const router = Router()

// Extract URLs from HTML content
function extractUrls(html, baseUrl = '') {
  const urls = []
  const hrefRe = /href=["']([^"'#][^"']*)["']/gi
  const srcRe = /src=["']([^"'#][^"']*)["']/gi
  let m
  while ((m = hrefRe.exec(html)) !== null) urls.push(m[1])
  while ((m = srcRe.exec(html)) !== null) urls.push(m[1])
  return urls.filter(u => u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/'))
}

async function checkUrl(url, baseUrl) {
  return new Promise((resolve) => {
    const fullUrl = url.startsWith('/') ? baseUrl + url : url
    const lib = fullUrl.startsWith('https') ? https : http
    const timeout = setTimeout(() => resolve({ url: fullUrl, status: 'timeout', code: 0 }), 5000)
    try {
      const req = lib.request(fullUrl, { method: 'HEAD', timeout: 5000 }, (res) => {
        clearTimeout(timeout)
        resolve({ url: fullUrl, status: res.statusCode >= 400 ? 'broken' : 'ok', code: res.statusCode })
      })
      req.on('error', () => { clearTimeout(timeout); resolve({ url: fullUrl, status: 'error', code: 0 }) })
      req.on('timeout', () => { clearTimeout(timeout); resolve({ url: fullUrl, status: 'timeout', code: 0 }) })
      req.end()
    } catch {
      clearTimeout(timeout)
      resolve({ url: fullUrl, status: 'error', code: 0 })
    }
  })
}

// GET /api/site-audit/seo — returns SEO issues for all published content
router.get('/seo', auth, (req, res) => {
  const issues = []
  
  // Check posts
  const posts = db.prepare(`SELECT id, title, slug, excerpt, content, meta_title, meta_description, cover_image, status FROM posts WHERE status = 'published'`).all()
  for (const p of posts) {
    const itemIssues = []
    if (!p.meta_title) itemIssues.push({ type: 'missing_meta_title', severity: 'warning' })
    else if (p.meta_title.length > 60) itemIssues.push({ type: 'meta_title_too_long', severity: 'info', value: p.meta_title.length })
    if (!p.meta_description) itemIssues.push({ type: 'missing_meta_description', severity: 'warning' })
    else if (p.meta_description.length > 160) itemIssues.push({ type: 'meta_description_too_long', severity: 'info', value: p.meta_description.length })
    if (!p.excerpt) itemIssues.push({ type: 'missing_excerpt', severity: 'info' })
    if (!p.cover_image) itemIssues.push({ type: 'missing_cover_image', severity: 'info' })
    const wordCount = (p.content || '').replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length
    if (wordCount < 300) itemIssues.push({ type: 'thin_content', severity: 'warning', value: wordCount })
    if (itemIssues.length > 0) {
      issues.push({ entity_type: 'post', id: p.id, title: p.title, slug: p.slug, url: `/blog/${p.slug}`, issues: itemIssues })
    }
  }

  // Check pages
  const pages = db.prepare(`SELECT id, title, slug, content, meta_title, meta_description, status FROM pages WHERE status = 'published'`).all()
  for (const p of pages) {
    const itemIssues = []
    if (!p.meta_title) itemIssues.push({ type: 'missing_meta_title', severity: 'warning' })
    else if (p.meta_title.length > 60) itemIssues.push({ type: 'meta_title_too_long', severity: 'info', value: p.meta_title.length })
    if (!p.meta_description) itemIssues.push({ type: 'missing_meta_description', severity: 'warning' })
    if (itemIssues.length > 0) {
      issues.push({ entity_type: 'page', id: p.id, title: p.title, slug: p.slug, url: `/${p.slug}`, issues: itemIssues })
    }
  }

  // Check products
  const products = db.prepare(`SELECT id, name, slug, excerpt, meta_title, meta_description, cover_image, status FROM products WHERE status = 'published'`).all()
  for (const p of products) {
    const itemIssues = []
    if (!p.meta_title) itemIssues.push({ type: 'missing_meta_title', severity: 'info' })
    if (!p.meta_description) itemIssues.push({ type: 'missing_meta_description', severity: 'info' })
    if (!p.cover_image) itemIssues.push({ type: 'missing_cover_image', severity: 'warning' })
    if (!p.excerpt) itemIssues.push({ type: 'missing_excerpt', severity: 'info' })
    if (itemIssues.length > 0) {
      issues.push({ entity_type: 'product', id: p.id, title: p.name, slug: p.slug, url: `/shop/${p.slug}`, issues: itemIssues })
    }
  }

  // Summary
  const summary = {
    total_issues: issues.reduce((s, i) => s + i.issues.length, 0),
    items_with_issues: issues.length,
    by_severity: {
      error: issues.reduce((s, i) => s + i.issues.filter(x => x.severity === 'error').length, 0),
      warning: issues.reduce((s, i) => s + i.issues.filter(x => x.severity === 'warning').length, 0),
      info: issues.reduce((s, i) => s + i.issues.filter(x => x.severity === 'info').length, 0),
    },
    by_entity: {
      post: issues.filter(i => i.entity_type === 'post').length,
      page: issues.filter(i => i.entity_type === 'page').length,
      product: issues.filter(i => i.entity_type === 'product').length,
    }
  }

  res.json({ summary, issues })
})

// GET /api/site-audit/media — returns media items missing alt text
router.get('/media', auth, (req, res) => {
  const missing_alt = db.prepare(
    `SELECT id, filename, original, url, mime_type, size, created_at FROM media WHERE (alt IS NULL OR alt = '') AND mime_type LIKE 'image/%' ORDER BY created_at DESC`
  ).all()
  const total_images = db.prepare(`SELECT COUNT(*) as c FROM media WHERE mime_type LIKE 'image/%'`).get().c
  const with_alt = db.prepare(`SELECT COUNT(*) as c FROM media WHERE mime_type LIKE 'image/%' AND alt IS NOT NULL AND alt != ''`).get().c
  res.json({
    summary: { total_images, with_alt, missing_alt: missing_alt.length, coverage_pct: total_images ? Math.round(with_alt / total_images * 100) : 100 },
    missing_alt
  })
})

// GET /api/site-audit/duplicates — finds duplicate slugs or titles
router.get('/duplicates', auth, (req, res) => {
  const dupSlugs = []
  
  const postSlugs = db.prepare(`SELECT slug, COUNT(*) as c FROM posts GROUP BY slug HAVING c > 1`).all()
  postSlugs.forEach(r => dupSlugs.push({ entity_type: 'post', slug: r.slug, count: r.c }))
  
  const pageSlugs = db.prepare(`SELECT slug, COUNT(*) as c FROM pages GROUP BY slug HAVING c > 1`).all()
  pageSlugs.forEach(r => dupSlugs.push({ entity_type: 'page', slug: r.slug, count: r.c }))
  
  const productSlugs = db.prepare(`SELECT slug, COUNT(*) as c FROM products GROUP BY slug HAVING c > 1`).all()
  productSlugs.forEach(r => dupSlugs.push({ entity_type: 'product', slug: r.slug, count: r.c }))

  res.json({ duplicate_slugs: dupSlugs, total: dupSlugs.length })
})

// GET /api/site-audit/summary — combined overview
router.get('/summary', auth, (req, res) => {
  const totalContent = {
    posts: db.prepare(`SELECT COUNT(*) as c FROM posts WHERE status='published'`).get().c,
    pages: db.prepare(`SELECT COUNT(*) as c FROM pages WHERE status='published'`).get().c,
    products: db.prepare(`SELECT COUNT(*) as c FROM products WHERE status='published'`).get().c,
  }
  const missingAlt = db.prepare(`SELECT COUNT(*) as c FROM media WHERE (alt IS NULL OR alt='') AND mime_type LIKE 'image/%'`).get().c
  const noMetaTitle = {
    posts: db.prepare(`SELECT COUNT(*) as c FROM posts WHERE status='published' AND (meta_title IS NULL OR meta_title='')`).get().c,
    pages: db.prepare(`SELECT COUNT(*) as c FROM pages WHERE status='published' AND (meta_title IS NULL OR meta_title='')`).get().c,
    products: db.prepare(`SELECT COUNT(*) as c FROM products WHERE status='published' AND (meta_title IS NULL OR meta_title='')`).get().c,
  }
  const noCover = {
    posts: db.prepare(`SELECT COUNT(*) as c FROM posts WHERE status='published' AND (cover_image IS NULL OR cover_image='')`).get().c,
    products: db.prepare(`SELECT COUNT(*) as c FROM products WHERE status='published' AND (cover_image IS NULL OR cover_image='')`).get().c,
  }
  res.json({ total_content: totalContent, missing_alt_text: missingAlt, no_meta_title: noMetaTitle, no_cover_image: noCover })
})

export default router
