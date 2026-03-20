// Pygmy CMS — Backend Server
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { rateLimit } from 'express-rate-limit'

import authRoutes from './routes/auth.js'
import pagesRoutes from './routes/pages.js'
import postsRoutes from './routes/posts.js'
import mediaRoutes from './routes/media.js'
import navigationRoutes from './routes/navigation.js'
import settingsRoutes from './routes/settings.js'
import dashboardRoutes from './routes/dashboard.js'
import seoRoutes from './routes/seo.js'
import commentsRoutes from './routes/comments.js'
import searchRoutes from './routes/search.js'
import productsRoutes from './routes/products.js'
import usersRoutes from './routes/users.js'
import contactRoutes from './routes/contact.js'
import analyticsRoutes from './routes/analytics.js'
import activityRoutes from './routes/activity.js'
import redirectsRoutes from './routes/redirects.js'
import newsletterRoutes from './routes/newsletter.js'
import backupRoutes from './routes/backup.js'
import revisionsRoutes from './routes/revisions.js'
import tagsRoutes from './routes/tags.js'
import formsRoutes from './routes/forms.js'
import webhooksRoutes from './routes/webhooks.js'
import notificationsRoutes from './routes/notifications.js'
import eventsRoutes from './routes/events.js'
import mediaFoldersRoutes from './routes/media_folders.js'
import apiKeysRoutes from './routes/api_keys.js'
import locksRoutes from './routes/locks.js'
import ordersRoutes from './routes/orders.js'
import couponsRoutes from './routes/coupons.js'
import db from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3200

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173', // admin dev
    'http://localhost:5174', // frontend dev
    'http://localhost:4173',
    'http://localhost:4174',
  ],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Static files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ─── Rate limiters (public-facing endpoints only) ─────────────────────────────
const jsonError = (msg) => ({ message: msg, error: 'rate_limit_exceeded' })

// Contact form: 5 submissions per hour per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: jsonError('Too many contact submissions. Please wait before trying again.'),
  skip: (req) => !!req.headers.authorization, // allow admins through
})

// Newsletter subscribe: 3 per hour per IP
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false,
  message: jsonError('Too many subscribe attempts. Please wait.'),
  skip: (req) => !!req.headers.authorization,
})

// Comments: 10 per hour per IP
const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: jsonError('Too many comment submissions. Please wait.'),
  skip: (req) => !!req.headers.authorization,
})

// Search: 60 per minute per IP (generous, it's GETs)
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: jsonError('Search rate limit exceeded. Slow down.'),
  skip: (req) => !!req.headers.authorization,
})

// Form submissions: 5 per hour per IP
const formSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: jsonError('Too many form submissions. Please wait.'),
  skip: (req) => !!req.headers.authorization,
})

// Order checkout: 10 per hour per IP (public)
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: jsonError('Too many checkout attempts. Please wait.'),
  skip: (req) => !!req.headers.authorization,
})

// Auth (login): 20 per 15 minutes per IP — brute force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: jsonError('Too many login attempts. Please try again later.'),
})

// ─── Maintenance mode middleware ───────────────────────────────────────────────
// Auth endpoints are always allowed (so admin can still log in and toggle it off).
// Analytics tracking is also allowed (fire-and-forget from frontend).
app.use((req, res, next) => {
  // Passlist: auth, admin-only API routes that need auth token
  const passthrough = [
    '/api/auth/',
    '/api/settings',  // admin reads/writes settings (auth-guarded in route)
    '/api/analytics/view', // fire-and-forget tracking
  ]
  if (passthrough.some(p => req.path.startsWith(p))) return next()

  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='maintenance_mode'").get()
    if (row?.value === '1') {
      // If bearer token is present and valid, pass through (admin users)
      const auth = req.headers.authorization || ''
      if (auth.startsWith('Bearer ')) return next() // let authMiddleware handle it downstream
      return res.status(503).json({
        error: 'maintenance',
        message: (() => {
          const msg = db.prepare("SELECT value FROM settings WHERE key='maintenance_message'").get()
          return msg?.value || 'Site is under maintenance.'
        })()
      })
    }
  } catch {}
  next()
})

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/pages', pagesRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/navigation', navigationRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/comments', commentLimiter, commentsRoutes)
app.use('/api/search', searchLimiter, searchRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/contact', contactLimiter, contactRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/redirects', redirectsRoutes)
app.use('/api/newsletter/subscribe', subscribeLimiter)
app.use('/api/newsletter', newsletterRoutes)
app.use('/api/backup', backupRoutes)
app.use('/api/revisions', revisionsRoutes)
app.use('/api/tags', tagsRoutes)
app.use('/api/forms', formSubmitLimiter, formsRoutes)
app.use('/api/webhooks', webhooksRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/events', eventsRoutes)
app.use('/api/media-folders', mediaFoldersRoutes)
app.use('/api/api-keys', apiKeysRoutes)
app.use('/api/locks', locksRoutes)
app.use('/api/orders', orderLimiter, ordersRoutes)
app.use('/api/coupons', couponsRoutes)

// ─── SEO (public) ─────────────────────────────────────────────────────────────
app.use('/', seoRoutes)

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', name: 'Pygmy CMS', version: '2.0.0' })
})

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

// ─── Redirect middleware (non-API paths, e.g. for server-side redirect support)
// Frontend is a SPA so redirects are handled client-side via /api/redirects/check.
// This handles any direct backend URL hits.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  try {
    const row = db.prepare('SELECT * FROM redirects WHERE from_path = ?').get(req.path)
    if (row) return res.redirect(parseInt(row.type) || 301, row.to_path)
  } catch {}
  next()
})

app.listen(PORT, () => {
  console.log(`🪆 Pygmy CMS backend running → http://localhost:${PORT}`)
  console.log(`   Run 'npm run seed' to create the default admin user.`)
})

// ─── Scheduled publishing ─────────────────────────────────────────────────────
// Every 60 seconds: auto-publish posts, pages, and products whose publish_at has passed
function runScheduler() {
  try {
    const now = new Date().toISOString()
    let total = 0

    const posts = db.prepare(`
      UPDATE posts
      SET status = 'published', updated_at = datetime('now')
      WHERE status = 'scheduled' AND published_at IS NOT NULL AND published_at <= ?
    `).run(now)
    total += posts.changes

    const pages = db.prepare(`
      UPDATE pages
      SET status = 'published', updated_at = datetime('now')
      WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?
    `).run(now)
    total += pages.changes

    const products = db.prepare(`
      UPDATE products
      SET status = 'published', updated_at = datetime('now')
      WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?
    `).run(now)
    total += products.changes

    if (total > 0) {
      console.log(`⏰ Scheduled publisher: auto-published ${total} item(s) (posts:${posts.changes} pages:${pages.changes} products:${products.changes})`)
    }
  } catch (e) {
    console.warn('Scheduler error:', e.message)
  }
}

runScheduler() // run once on boot
setInterval(runScheduler, 60_000) // then every minute
