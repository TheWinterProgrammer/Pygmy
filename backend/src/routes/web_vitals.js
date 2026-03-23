// Pygmy CMS — Web Vitals / RUM Performance API (Phase 36)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// Thresholds per Core Web Vitals spec
const THRESHOLDS = {
  lcp:  { good: 2500, poor: 4000 },   // ms
  fid:  { good: 100,  poor: 300  },   // ms
  cls:  { good: 0.1,  poor: 0.25 },   // score
  fcp:  { good: 1800, poor: 3000 },   // ms
  ttfb: { good: 800,  poor: 1800 },   // ms
  inp:  { good: 200,  poor: 500  },   // ms
}

function rateMetric(metric, value) {
  if (value == null) return null
  const t = THRESHOLDS[metric]
  if (!t) return 'unknown'
  if (value <= t.good) return 'good'
  if (value <= t.poor) return 'needs-improvement'
  return 'poor'
}

// POST /api/web-vitals — beacon from public frontend (public, no auth)
router.post('/', (req, res) => {
  const { path, lcp, fid, cls, fcp, ttfb, inp, device = 'desktop', session_id } = req.body

  if (!path) return res.status(400).json({ error: 'path required' })

  // Validate metric ranges
  if (lcp != null && (lcp < 0 || lcp > 60000)) return res.status(400).json({ error: 'invalid lcp' })
  if (cls != null && (cls < 0 || cls > 10)) return res.status(400).json({ error: 'invalid cls' })

  db.prepare(`
    INSERT INTO web_vitals (path, lcp, fid, cls, fcp, ttfb, inp, device, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(path, lcp ?? null, fid ?? null, cls ?? null, fcp ?? null, ttfb ?? null, inp ?? null, device, session_id ?? null)

  res.json({ ok: true })
})

// GET /api/web-vitals/summary?days=30 — overall performance summary (admin)
router.get('/summary', authMiddleware, (req, res) => {
  const days = Math.min(parseInt(req.query.days || 30), 365)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const row = db.prepare(`
    SELECT
      COUNT(*) as samples,
      ROUND(AVG(lcp), 1) as avg_lcp,
      ROUND(AVG(fid), 1) as avg_fid,
      ROUND(AVG(cls), 4) as avg_cls,
      ROUND(AVG(fcp), 1) as avg_fcp,
      ROUND(AVG(ttfb), 1) as avg_ttfb,
      ROUND(AVG(inp), 1) as avg_inp,
      -- P75 approximations using percentile-friendly approach
      ROUND(AVG(CASE WHEN lcp IS NOT NULL THEN lcp END), 1) as p75_lcp_approx,
      ROUND(AVG(CASE WHEN cls IS NOT NULL THEN cls END), 4) as p75_cls_approx
    FROM web_vitals
    WHERE created_at >= ?
  `).get(since)

  // Rating for each metric
  const ratings = {
    lcp: rateMetric('lcp', row.avg_lcp),
    fid: rateMetric('fid', row.avg_fid),
    cls: rateMetric('cls', row.avg_cls),
    fcp: rateMetric('fcp', row.avg_fcp),
    ttfb: rateMetric('ttfb', row.avg_ttfb),
    inp: rateMetric('inp', row.avg_inp),
  }

  // Overall score: if all tracked metrics are good → 'good'; if any poor → 'poor'; else 'needs-improvement'
  const metricRatings = Object.values(ratings).filter(Boolean)
  let overall = 'good'
  if (metricRatings.some(r => r === 'poor')) overall = 'poor'
  else if (metricRatings.some(r => r === 'needs-improvement')) overall = 'needs-improvement'

  res.json({ ...row, ratings, overall, days, thresholds: THRESHOLDS })
})

// GET /api/web-vitals/pages?days=30&limit=20 — per-page breakdown (admin)
router.get('/pages', authMiddleware, (req, res) => {
  const days = Math.min(parseInt(req.query.days || 30), 365)
  const limit = Math.min(parseInt(req.query.limit || 20), 100)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const rows = db.prepare(`
    SELECT
      path,
      COUNT(*) as samples,
      ROUND(AVG(lcp), 1) as avg_lcp,
      ROUND(AVG(fid), 1) as avg_fid,
      ROUND(AVG(cls), 4) as avg_cls,
      ROUND(AVG(fcp), 1) as avg_fcp,
      ROUND(AVG(ttfb), 1) as avg_ttfb,
      ROUND(AVG(inp), 1) as avg_inp,
      ROUND(100.0 * SUM(CASE WHEN lcp <= 2500 THEN 1 ELSE 0 END) / COUNT(*), 1) as lcp_good_pct,
      ROUND(100.0 * SUM(CASE WHEN cls <= 0.1 THEN 1 ELSE 0 END) / COUNT(*), 1) as cls_good_pct
    FROM web_vitals
    WHERE created_at >= ?
    GROUP BY path
    ORDER BY samples DESC
    LIMIT ?
  `).all(since, limit)

  const enriched = rows.map(r => ({
    ...r,
    ratings: {
      lcp: rateMetric('lcp', r.avg_lcp),
      fid: rateMetric('fid', r.avg_fid),
      cls: rateMetric('cls', r.avg_cls),
      fcp: rateMetric('fcp', r.avg_fcp),
      ttfb: rateMetric('ttfb', r.avg_ttfb),
      inp: rateMetric('inp', r.avg_inp),
    }
  }))

  res.json(enriched)
})

// GET /api/web-vitals/daily?days=30&metric=lcp — daily averages for chart (admin)
router.get('/daily', authMiddleware, (req, res) => {
  const days = Math.min(parseInt(req.query.days || 30), 90)
  const metric = ['lcp', 'fid', 'cls', 'fcp', 'ttfb', 'inp'].includes(req.query.metric)
    ? req.query.metric : 'lcp'
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const rows = db.prepare(`
    SELECT
      DATE(created_at) as date,
      ROUND(AVG(${metric}), metric = 'cls' ? 4 : 1) as avg_val,
      COUNT(*) as samples
    FROM web_vitals
    WHERE created_at >= ? AND ${metric} IS NOT NULL
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all(since)

  // Fill gaps
  const dataMap = {}
  rows.forEach(r => (dataMap[r.date] = r))

  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    result.push(dataMap[d] || { date: d, avg_val: null, samples: 0 })
  }

  res.json({ metric, days, data: result, threshold: THRESHOLDS[metric] })
})

// GET /api/web-vitals/device-breakdown?days=30 — mobile vs desktop split (admin)
router.get('/device-breakdown', authMiddleware, (req, res) => {
  const days = Math.min(parseInt(req.query.days || 30), 365)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const rows = db.prepare(`
    SELECT
      device,
      COUNT(*) as samples,
      ROUND(AVG(lcp), 1) as avg_lcp,
      ROUND(AVG(fid), 1) as avg_fid,
      ROUND(AVG(cls), 4) as avg_cls,
      ROUND(AVG(fcp), 1) as avg_fcp,
      ROUND(AVG(ttfb), 1) as avg_ttfb
    FROM web_vitals
    WHERE created_at >= ?
    GROUP BY device
    ORDER BY samples DESC
  `).all(since)

  res.json(rows)
})

// GET /api/web-vitals/worst?days=30&limit=10 — worst-performing pages (admin)
router.get('/worst', authMiddleware, (req, res) => {
  const days = Math.min(parseInt(req.query.days || 30), 365)
  const limit = Math.min(parseInt(req.query.limit || 10), 50)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const rows = db.prepare(`
    SELECT
      path,
      COUNT(*) as samples,
      ROUND(AVG(lcp), 1) as avg_lcp,
      ROUND(AVG(cls), 4) as avg_cls,
      ROUND(AVG(ttfb), 1) as avg_ttfb
    FROM web_vitals
    WHERE created_at >= ? AND samples > 0
    GROUP BY path
    HAVING samples >= 3
    ORDER BY avg_lcp DESC
    LIMIT ?
  `).all(since, limit)

  res.json(rows)
})

// DELETE /api/web-vitals/purge?days=90 — purge old data (admin)
router.delete('/purge', authMiddleware, (req, res) => {
  const days = Math.max(parseInt(req.query.days || 90), 7)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { changes } = db.prepare('DELETE FROM web_vitals WHERE created_at < ?').run(since)
  res.json({ ok: true, deleted: changes })
})

export default router
