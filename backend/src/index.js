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

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', name: 'Pygmy CMS', version: '2.0.0' })
})

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

app.listen(PORT, () => {
  console.log(`🪆 Pygmy CMS backend running → http://localhost:${PORT}`)
  console.log(`   Run 'npm run seed' to create the default admin user.`)
})
