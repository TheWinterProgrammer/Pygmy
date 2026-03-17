// Pygmy CMS — Dashboard stats
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/dashboard/stats (auth)
router.get('/stats', authMiddleware, (req, res) => {
  const pages = db.prepare('SELECT COUNT(*) as count FROM pages').get().count
  const publishedPages = db.prepare("SELECT COUNT(*) as count FROM pages WHERE status='published'").get().count
  const posts = db.prepare('SELECT COUNT(*) as count FROM posts').get().count
  const publishedPosts = db.prepare("SELECT COUNT(*) as count FROM posts WHERE status='published'").get().count
  const media = db.prepare('SELECT COUNT(*) as count FROM media').get().count
  const navItems = db.prepare('SELECT COUNT(*) as count FROM navigation').get().count

  const recentPosts = db.prepare(`
    SELECT id, title, slug, status, created_at FROM posts ORDER BY created_at DESC LIMIT 5
  `).all()

  res.json({
    pages: { total: pages, published: publishedPages },
    posts: { total: posts, published: publishedPosts },
    media: { total: media },
    navigation: { total: navItems },
    recentPosts
  })
})

export default router
