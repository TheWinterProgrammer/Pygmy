// Pygmy CMS — Backend Server
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

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

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/pages', pagesRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/navigation', navigationRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/products', productsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/redirects', redirectsRoutes)

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
// Every 60 seconds: auto-publish posts whose published_at has passed
function runScheduler() {
  try {
    const now = new Date().toISOString()
    const result = db.prepare(`
      UPDATE posts
      SET status = 'published', updated_at = datetime('now')
      WHERE status = 'scheduled'
        AND published_at IS NOT NULL
        AND published_at <= ?
    `).run(now)
    if (result.changes > 0) {
      console.log(`⏰ Scheduled publisher: auto-published ${result.changes} post(s)`)
    }
  } catch (e) {
    console.warn('Scheduler error:', e.message)
  }
}

runScheduler() // run once on boot
setInterval(runScheduler, 60_000) // then every minute
