// Pygmy CMS — Click Heatmap Tracker (Phase 63)
// Tracks visitor click coordinates per page path, renders heatmap grid summaries.
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const r = Router()

// Bootstrap table
db.prepare(`
  CREATE TABLE IF NOT EXISTS heatmap_clicks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    page_path   TEXT NOT NULL,
    x_pct       REAL NOT NULL,   -- click X as % of viewport width (0-100)
    y_pct       REAL NOT NULL,   -- click Y as % of page height (0-100)
    viewport_w  INTEGER,
    viewport_h  INTEGER,
    session_id  TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_heatmap_path ON heatmap_clicks(page_path)`).run()
db.prepare(`CREATE INDEX IF NOT EXISTS idx_heatmap_date ON heatmap_clicks(created_at)`).run()

// Seed settings
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('heatmap_enabled', '1')`).run()
db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('heatmap_sample_rate', '100')`).run() // % of clicks to record

// ─── POST /api/heatmap/click — record a click (public, high volume) ───────────
r.post('/click', (req, res) => {
  const enabled = db.prepare("SELECT value FROM settings WHERE key='heatmap_enabled'").get()?.value
  if (enabled !== '1') return res.json({ ok: false })

  const { page_path, x_pct, y_pct, viewport_w, viewport_h, session_id } = req.body
  if (!page_path || x_pct === undefined || y_pct === undefined) {
    return res.status(400).json({ error: 'page_path, x_pct, y_pct required' })
  }

  // Sample rate check
  const sampleRate = parseInt(db.prepare("SELECT value FROM settings WHERE key='heatmap_sample_rate'").get()?.value || '100')
  if (Math.random() * 100 > sampleRate) return res.json({ ok: true, sampled: false })

  // Clamp values
  const xc = Math.min(100, Math.max(0, parseFloat(x_pct)))
  const yc = Math.min(200, Math.max(0, parseFloat(y_pct))) // allow above fold

  db.prepare(`
    INSERT INTO heatmap_clicks (page_path, x_pct, y_pct, viewport_w, viewport_h, session_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(page_path, xc, yc, viewport_w ? parseInt(viewport_w) : null, viewport_h ? parseInt(viewport_h) : null, session_id || '')

  res.json({ ok: true })
})

// ─── GET /api/heatmap/pages — list pages with click counts ───────────────────
r.get('/pages', auth, (req, res) => {
  const { days = 30, limit = 50 } = req.query
  const since = `datetime('now', '-${parseInt(days)} days')`

  const rows = db.prepare(`
    SELECT page_path, COUNT(*) AS clicks, COUNT(DISTINCT session_id) AS sessions
    FROM heatmap_clicks
    WHERE created_at >= ${since}
    GROUP BY page_path
    ORDER BY clicks DESC
    LIMIT ?
  `).all(parseInt(limit))

  res.json(rows)
})

// ─── GET /api/heatmap/data?path= — grid-bucketed heatmap data for one page ────
// Returns a 20×20 grid of click density values (0-1 normalized).
r.get('/data', auth, (req, res) => {
  const { path, days = 30, resolution = 20 } = req.query
  if (!path) return res.status(400).json({ error: 'path required' })
  const since = `datetime('now', '-${parseInt(days)} days')`
  const res_n = Math.min(50, Math.max(5, parseInt(resolution)))

  const clicks = db.prepare(`
    SELECT x_pct, y_pct FROM heatmap_clicks
    WHERE page_path = ? AND created_at >= ${since}
  `).all(path)

  const total = clicks.length
  if (total === 0) return res.json({ grid: [], total: 0, path, resolution: res_n })

  // Build grid: rows are y buckets (0-100%), cols are x buckets (0-100%)
  const grid = Array.from({ length: res_n }, () => new Array(res_n).fill(0))

  for (const { x_pct, y_pct } of clicks) {
    const col = Math.min(res_n - 1, Math.floor((x_pct / 100) * res_n))
    const row = Math.min(res_n - 1, Math.floor((Math.min(y_pct, 100) / 100) * res_n))
    grid[row][col]++
  }

  // Normalize to 0-1
  const max = Math.max(...grid.flat(), 1)
  const normalized = grid.map(row => row.map(v => Math.round((v / max) * 100) / 100))

  // Top clicked areas for text summary
  const hotspots = []
  for (let r = 0; r < res_n; r++) {
    for (let c = 0; c < res_n; c++) {
      if (grid[r][c] > 0) hotspots.push({ x: c, y: r, count: grid[r][c], density: normalized[r][c] })
    }
  }
  hotspots.sort((a, b) => b.count - a.count)

  res.json({ grid: normalized, total, path, resolution: res_n, hotspots: hotspots.slice(0, 10) })
})

// ─── GET /api/heatmap/stats — overall summary ────────────────────────────────
r.get('/stats', auth, (req, res) => {
  const { days = 30 } = req.query
  const since = `datetime('now', '-${parseInt(days)} days')`

  const total = db.prepare(`SELECT COUNT(*) AS n FROM heatmap_clicks WHERE created_at >= ${since}`).get().n
  const sessions = db.prepare(`SELECT COUNT(DISTINCT session_id) AS n FROM heatmap_clicks WHERE created_at >= ${since}`).get().n
  const pages = db.prepare(`SELECT COUNT(DISTINCT page_path) AS n FROM heatmap_clicks WHERE created_at >= ${since}`).get().n
  const daily = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS n
    FROM heatmap_clicks WHERE created_at >= ${since}
    GROUP BY day ORDER BY day ASC
  `).all()

  res.json({ total, sessions, pages, daily })
})

// ─── DELETE /api/heatmap/purge — purge old data ──────────────────────────────
r.delete('/purge', auth, (req, res) => {
  const { days = 90 } = req.query
  const info = db.prepare(`DELETE FROM heatmap_clicks WHERE created_at < datetime('now', '-${parseInt(days)} days')`).run()
  res.json({ ok: true, deleted: info.changes })
})

export default r
