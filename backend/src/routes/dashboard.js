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

  const pendingComments = db.prepare("SELECT COUNT(*) as count FROM comments WHERE status='pending'").get().count
  const totalComments = db.prepare('SELECT COUNT(*) as count FROM comments').get().count

  const products = db.prepare('SELECT COUNT(*) as count FROM products').get().count
  const publishedProducts = db.prepare("SELECT COUNT(*) as count FROM products WHERE status='published'").get().count

  const totalContacts = db.prepare('SELECT COUNT(*) as count FROM form_submissions').get().count
  const unreadContacts = db.prepare("SELECT COUNT(*) as count FROM form_submissions WHERE status='unread'").get().count

  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count
  const scheduledPosts = db.prepare("SELECT COUNT(*) as count FROM posts WHERE status='scheduled'").get().count

  // Analytics summary
  const viewsToday = db.prepare("SELECT COALESCE(SUM(count),0) as v FROM page_views WHERE view_date = date('now')").get().v
  const viewsWeek  = db.prepare("SELECT COALESCE(SUM(count),0) as v FROM page_views WHERE view_date >= date('now','-7 days')").get().v
  const viewsTotal = db.prepare("SELECT COALESCE(SUM(count),0) as v FROM page_views").get().v

  // Redirects
  const totalRedirects = db.prepare('SELECT COUNT(*) as count FROM redirects').get().count

  // Recent activity
  const recentActivity = db.prepare(`
    SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10
  `).all()

  res.json({
    pages: { total: pages, published: publishedPages },
    posts: { total: posts, published: publishedPosts, scheduled: scheduledPosts },
    media: { total: media },
    navigation: { total: navItems },
    comments: { total: totalComments, pending: pendingComments },
    products: { total: products, published: publishedProducts },
    contacts: { total: totalContacts, unread: unreadContacts },
    users: { total: totalUsers },
    analytics: { today: viewsToday, week: viewsWeek, total: viewsTotal },
    redirects: { total: totalRedirects },
    recentPosts,
    recentActivity
  })
})

export default router
