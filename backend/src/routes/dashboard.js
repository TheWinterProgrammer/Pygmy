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

  // 7-day revenue sparkline (array of 7 daily totals, oldest first)
  const revSparkRows = db.prepare(`
    SELECT
      date(created_at) as day,
      COALESCE(SUM(total), 0) as daily_revenue
    FROM orders
    WHERE created_at >= date('now', '-6 days')
      AND status IN ('completed','processing','shipped')
    GROUP BY day
    ORDER BY day ASC
  `).all()

  // Fill in zero-revenue days so we always have 7 data points
  const revSparkline = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const found = revSparkRows.find(r => r.day === key)
    revSparkline.push(found ? Math.round(found.daily_revenue * 100) / 100 : 0)
  }

  // 7-day orders sparkline
  const ordSparkRows = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as cnt
    FROM orders
    WHERE created_at >= date('now', '-6 days')
    GROUP BY day ORDER BY day ASC
  `).all()
  const ordSparkline = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const found = ordSparkRows.find(r => r.day === key)
    ordSparkline.push(found ? found.cnt : 0)
  }

  // 7-day views sparkline
  const viewSparkRows = db.prepare(`
    SELECT date(viewed_at) as day, SUM(view_count) as cnt
    FROM page_views
    WHERE viewed_at >= date('now', '-6 days')
    GROUP BY day ORDER BY day ASC
  `).all()
  const viewSparkline = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const found = viewSparkRows.find(r => r.day === key)
    viewSparkline.push(found ? (found.cnt || 0) : 0)
  }

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

  // Tax rates
  const activeTaxRates = db.prepare("SELECT COUNT(*) as count FROM tax_rates WHERE active = 1").get().count

  // Loyalty
  const loyaltyEnabledSetting = db.prepare("SELECT value FROM settings WHERE key = 'loyalty_enabled'").get()?.value
  const loyaltyEnabled = loyaltyEnabledSetting === '1'
  let totalLoyaltyPoints = 0
  if (loyaltyEnabled) {
    totalLoyaltyPoints = db.prepare("SELECT COALESCE(SUM(points_balance),0) as total FROM customers").get().total
  }

  // Gift cards
  const activeGiftCards = db.prepare("SELECT COUNT(*) as count FROM gift_cards WHERE status = 'active'").get().count
  const giftCardBalance = db.prepare("SELECT COALESCE(SUM(balance),0) as v FROM gift_cards WHERE status = 'active'").get().v

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

  // Support tickets
  const openTickets = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE status IN ('open','in_progress')").get()?.c || 0
  const unreadTickets = db.prepare("SELECT COUNT(*) AS c FROM support_tickets WHERE is_read = 0").get()?.c || 0

  // A/B Tests
  const runningTests = db.prepare("SELECT COUNT(*) AS c FROM ab_tests WHERE status = 'running'").get()?.c || 0
  const totalTests = db.prepare("SELECT COUNT(*) AS c FROM ab_tests").get()?.c || 0

  // Search analytics (last 7 days)
  const totalSearches7d = (() => {
    try { return db.prepare("SELECT COUNT(*) AS c FROM search_queries WHERE created_at >= datetime('now', '-7 days')").get()?.c || 0 } catch { return 0 }
  })()

  // Subscription/Membership stats
  let activeSubs = 0, trialingSubs = 0, subMrr = 0
  try {
    activeSubs = db.prepare(`SELECT COUNT(*) as c FROM member_subscriptions WHERE status='active'`).get()?.c ?? 0
    trialingSubs = db.prepare(`SELECT COUNT(*) as c FROM member_subscriptions WHERE status='trialing'`).get()?.c ?? 0
    subMrr = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN sp.interval='month' THEN sp.price WHEN sp.interval='year' THEN sp.price/12 ELSE 0 END),0) as mrr
      FROM member_subscriptions s JOIN subscription_plans sp ON s.plan_id=sp.id WHERE s.status='active'
    `).get()?.mrr ?? 0
  } catch {}

  // Affiliate stats
  let totalAffiliates = 0, pendingCommissions = 0
  try {
    totalAffiliates = db.prepare(`SELECT COUNT(*) as c FROM affiliates WHERE status='active'`).get()?.c ?? 0
    pendingCommissions = db.prepare(
      `SELECT COALESCE(SUM(commission_amount),0) as t FROM affiliate_referrals WHERE status='pending'`
    ).get()?.t ?? 0
  } catch {}

  // Bundle stats
  let totalBundles = 0, publishedBundles = 0
  try {
    totalBundles = db.prepare(`SELECT COUNT(*) as c FROM product_bundles`).get()?.c ?? 0
    publishedBundles = db.prepare(`SELECT COUNT(*) as c FROM product_bundles WHERE status='published'`).get()?.c ?? 0
  } catch {}

  // Product Q&A stats
  let qaTotal = 0, qaPending = 0
  try {
    qaTotal   = db.prepare(`SELECT COUNT(*) as c FROM product_qa`).get()?.c ?? 0
    qaPending = db.prepare(`SELECT COUNT(*) as c FROM product_qa WHERE status='pending'`).get()?.c ?? 0
  } catch {}

  // Push Notification stats
  let pushSubscribers = 0, pushCampaigns = 0
  try {
    pushSubscribers = db.prepare(`SELECT COUNT(*) as c FROM push_subscriptions WHERE active = 1`).get()?.c ?? 0
    pushCampaigns   = db.prepare(`SELECT COUNT(*) as c FROM push_campaigns WHERE status = 'sent'`).get()?.c ?? 0
  } catch {}

  // Bookings stats
  let bookingsTotal = 0, bookingsPending = 0, bookingsToday = 0, bookingsEnabled = false
  try {
    const bookingsEnabledSetting = db.prepare("SELECT value FROM settings WHERE key = 'bookings_enabled'").get()?.value
    bookingsEnabled = bookingsEnabledSetting === '1'
    bookingsTotal   = db.prepare(`SELECT COUNT(*) as c FROM bookings`).get()?.c ?? 0
    bookingsPending = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'`).get()?.c ?? 0
    bookingsToday   = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE booking_date = date('now')`).get()?.c ?? 0
  } catch {}

  // Automation stats
  let automationTotal = 0, automationActive = 0, automationRunsToday = 0
  try {
    automationTotal    = db.prepare(`SELECT COUNT(*) as c FROM automation_rules`).get()?.c ?? 0
    automationActive   = db.prepare(`SELECT COUNT(*) as c FROM automation_rules WHERE active = 1`).get()?.c ?? 0
    automationRunsToday = db.prepare(`SELECT COUNT(*) as c FROM automation_runs WHERE triggered_at >= date('now')`).get()?.c ?? 0
  } catch {}

  // Coupon Campaigns stats
  let couponCampaignsTotal = 0, couponCampaignsActive = 0
  try {
    couponCampaignsTotal  = db.prepare(`SELECT COUNT(*) as c FROM coupon_campaigns`).get()?.c ?? 0
    couponCampaignsActive = db.prepare(`SELECT COUNT(*) as c FROM coupon_campaigns WHERE active = 1`).get()?.c ?? 0
  } catch {}

  // Recent bookings (for dashboard widget)
  let recentBookings = []
  try {
    recentBookings = db.prepare(`
      SELECT b.id, b.reference, b.customer_name, b.booking_date, b.time_slot, b.status,
             s.name as service_name
      FROM bookings b JOIN services s ON b.service_id = s.id
      ORDER BY b.created_at DESC LIMIT 5
    `).all()
  } catch {}

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
    sparklines: { revenue: revSparkline, orders: ordSparkline, views: viewSparkline },
    coupons: { total: totalCoupons, active: activeCoupons },
    customers: { total: totalCustomers, active: activeCustomers },
    abandoned_carts: { count: abandonedCarts, revenue: abandonedRevenue },
    inventory: { low_stock: lowStockProducts, out_of_stock: outOfStockCount },
    tax_rates: { active: activeTaxRates },
    loyalty: { enabled: loyaltyEnabled, total_points: totalLoyaltyPoints },
    gift_cards: { active: activeGiftCards, balance: giftCardBalance },
    subscriptions: { active: activeSubs, trialing: trialingSubs, mrr: Math.round(subMrr * 100) / 100 },
    affiliates: { total: totalAffiliates, pending_commissions: Math.round(pendingCommissions * 100) / 100 },
    bundles: { total: totalBundles, published: publishedBundles },
    product_qa: { total: qaTotal, pending: qaPending },
    push: { subscribers: pushSubscribers, sent_campaigns: pushCampaigns },
    support: { open: openTickets, unread: unreadTickets },
    ab_tests: { total: totalTests, running: runningTests },
    search: { searches_7d: totalSearches7d },
    bookings: { total: bookingsTotal, pending: bookingsPending, today: bookingsToday, enabled: bookingsEnabled },
    automation: { total: automationTotal, active: automationActive, runs_today: automationRunsToday },
    coupon_campaigns: { total: couponCampaignsTotal, active: couponCampaignsActive },
    recentPosts,
    recentActivity,
    recentBookings
  })
})

export default router
