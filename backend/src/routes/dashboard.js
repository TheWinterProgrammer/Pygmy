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

  // Newsletter
  const totalSubscribers = db.prepare('SELECT COUNT(*) as count FROM subscribers').get().count
  const activeSubscribers = db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE status='active'").get().count

  // Custom forms
  const totalForms = db.prepare('SELECT COUNT(*) as count FROM custom_forms').get().count
  const activeForms = db.prepare("SELECT COUNT(*) as count FROM custom_forms WHERE status='active'").get().count
  const unreadFormSubs = db.prepare("SELECT COUNT(*) as count FROM custom_form_submissions WHERE status='unread'").get().count

  // Webhooks
  const totalWebhooks = db.prepare('SELECT COUNT(*) as count FROM webhooks').get().count
  const activeWebhooks = db.prepare('SELECT COUNT(*) as count FROM webhooks WHERE active = 1').get().count

  // Events
  const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get().count
  const publishedEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status='published'").get().count
  const upcomingEvents = db.prepare(`SELECT COUNT(*) as count FROM events WHERE status='published' AND start_date >= datetime('now')`).get().count

  // Media folders
  const totalFolders = db.prepare('SELECT COUNT(*) as count FROM media_folders').get().count

  // Orders
  const totalOrders   = db.prepare('SELECT COUNT(*) as count FROM orders').get().count
  const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").get().count
  const orderRevenue  = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM orders WHERE status IN ('completed','processing','shipped')").get().r

  // Coupons
  const totalCoupons  = db.prepare('SELECT COUNT(*) as count FROM coupons').get().count
  const activeCoupons = db.prepare('SELECT COUNT(*) as count FROM coupons WHERE active = 1').get().count

  // Customers
  const totalCustomers  = db.prepare('SELECT COUNT(*) as count FROM customers').get().count
  const activeCustomers = db.prepare('SELECT COUNT(*) as count FROM customers WHERE active = 1').get().count

  // Abandoned carts
  const abandonedCarts = db.prepare(`
    SELECT COUNT(*) as count FROM abandoned_carts
    WHERE recovered = 0 AND updated_at <= datetime('now', '-1 hours')
  `).get().count
  const abandonedRevenue = db.prepare(`
    SELECT COALESCE(SUM(subtotal),0) as r FROM abandoned_carts
    WHERE recovered = 0 AND updated_at <= datetime('now', '-1 hours')
  `).get().r

  // Low stock products (track_stock=1 AND stock_quantity <= low_stock_threshold AND stock_quantity > 0)
  const lowStockProducts = db.prepare(`
    SELECT id, name, slug, stock_quantity, low_stock_threshold
    FROM products
    WHERE track_stock = 1 AND stock_quantity <= low_stock_threshold AND stock_quantity > 0 AND status = 'published'
    ORDER BY stock_quantity ASC
    LIMIT 5
  `).all()

  // Out-of-stock products (track_stock=1 AND stock_quantity = 0 AND allow_backorder = 0)
  const outOfStockCount = db.prepare(`
    SELECT COUNT(*) as count FROM products
    WHERE track_stock = 1 AND stock_quantity <= 0 AND allow_backorder = 0 AND status = 'published'
  `).get().count

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
    newsletter: { total: totalSubscribers, active: activeSubscribers },
    forms: { total: totalForms, active: activeForms, unread: unreadFormSubs },
    webhooks: { total: totalWebhooks, active: activeWebhooks },
    events: { total: totalEvents, published: publishedEvents, upcoming: upcomingEvents },
    media_folders: { total: totalFolders },
    orders: { total: totalOrders, pending: pendingOrders, revenue: orderRevenue },
    coupons: { total: totalCoupons, active: activeCoupons },
    customers: { total: totalCustomers, active: activeCustomers },
    abandoned_carts: { count: abandonedCarts, revenue: abandonedRevenue },
    inventory: { low_stock: lowStockProducts, out_of_stock: outOfStockCount },
    recentPosts,
    recentActivity
  })
})

export default router
