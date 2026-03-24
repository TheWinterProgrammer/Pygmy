// Pygmy CMS — Custom 404 Page API (Phase 65)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// Seed defaults
const defaults = {
  custom_404_enabled: '1',
  custom_404_title: 'Page Not Found',
  custom_404_subtitle: "Sorry, the page you're looking for doesn't exist.",
  custom_404_cta_label: 'Go Back Home',
  custom_404_cta_url: '/',
  custom_404_secondary_cta_label: 'Browse Shop',
  custom_404_secondary_cta_url: '/shop',
  custom_404_show_search: '1',
  custom_404_show_popular: '1',
  custom_404_bg_image: '',
  custom_404_emoji: '🔍',
}
for (const [key, value] of Object.entries(defaults)) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

// GET /api/custom-404 — get 404 page config (public)
router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'custom_404_%'`).all()
  const s = {}
  rows.forEach(r => (s[r.key] = r.value))

  // Get popular pages/posts for "you might like" section
  let popular = []
  if (s.custom_404_show_popular === '1') {
    const posts = db.prepare(`
      SELECT title, slug, cover_image, 'post' as type
      FROM posts WHERE status = 'published'
      ORDER BY RANDOM() LIMIT 3
    `).all()
    const pages = db.prepare(`
      SELECT title, slug, null as cover_image, 'page' as type
      FROM pages WHERE status = 'published'
      LIMIT 2
    `).all()
    popular = [...posts, ...pages].slice(0, 4)
  }

  res.json({ ...s, popular })
})

// PUT /api/custom-404 — update 404 page config (admin)
router.put('/', authMiddleware, (req, res) => {
  const allowed = Object.keys(defaults)
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k))

  const upsert = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
  const doAll = db.transaction((pairs) => {
    pairs.forEach(([key, value]) => upsert.run(key, String(value)))
  })
  doAll(updates)

  res.json({ ok: true, updated: updates.length })
})

export default router
