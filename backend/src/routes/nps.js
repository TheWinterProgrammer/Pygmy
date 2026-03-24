// Pygmy CMS — NPS Surveys API (Phase 57)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

function getSettings() {
  return db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'nps_%'`).all()
    .reduce((a, r) => { a[r.key] = r.value; return a }, {})
}

// ── POST /api/nps — submit a score (public) ────────────────────────────────────
router.post('/', (req, res) => {
  const settings = getSettings()
  if (settings.nps_enabled !== '1') {
    return res.status(400).json({ error: 'NPS surveys are not enabled' })
  }

  const { score, feedback = '', category = '', order_number = '', customer_email = '' } = req.body

  if (score === undefined || score === null) return res.status(400).json({ error: 'score is required' })
  const s = parseInt(score)
  if (isNaN(s) || s < 0 || s > 10) return res.status(400).json({ error: 'score must be 0–10' })

  // Prevent duplicate submission for same order
  if (order_number) {
    const existing = db.prepare(`SELECT id FROM nps_surveys WHERE order_number = ?`).get(order_number)
    if (existing) return res.status(409).json({ error: 'Survey already submitted for this order' })
  }

  db.prepare(`
    INSERT INTO nps_surveys (order_number, customer_email, score, feedback, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(order_number, customer_email, s, feedback, category)

  res.status(201).json({ ok: true, message: 'Thank you for your feedback!' })
})

// ── GET /api/nps/config — public config ───────────────────────────────────────
router.get('/config', (req, res) => {
  const settings = getSettings()
  res.json({
    enabled: settings.nps_enabled === '1',
    question: settings.nps_question || 'How likely are you to recommend us?',
    follow_up: settings.nps_follow_up || "What's the main reason for your score?",
  })
})

// ── GET /api/nps — admin: list all responses ──────────────────────────────────
router.get('/', auth, (req, res) => {
  const { q = '', days = 30, segment, limit = 50, offset = 0 } = req.query

  let where = [`responded_at >= datetime('now', '-${parseInt(days)} days')`]
  const params = []

  if (q) {
    where.push('(customer_email LIKE ? OR feedback LIKE ? OR order_number LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  if (segment === 'promoter')  { where.push('score >= 9');          }
  if (segment === 'passive')   { where.push('score BETWEEN 7 AND 8') }
  if (segment === 'detractor') { where.push('score <= 6');           }

  const whereStr = 'WHERE ' + where.join(' AND ')
  const rows = db.prepare(`
    SELECT * FROM nps_surveys ${whereStr}
    ORDER BY responded_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  const total = db.prepare(`SELECT COUNT(*) as c FROM nps_surveys ${whereStr}`).get(...params)?.c || 0

  res.json({ responses: rows, total })
})

// ── GET /api/nps/summary — admin: aggregated stats ────────────────────────────
router.get('/summary', auth, (req, res) => {
  const { days = 30 } = req.query
  const d = parseInt(days)

  const rows = db.prepare(`
    SELECT score, COUNT(*) as count
    FROM nps_surveys
    WHERE responded_at >= datetime('now', '-${d} days')
    GROUP BY score ORDER BY score ASC
  `).all()

  const total = rows.reduce((s, r) => s + r.count, 0)
  const promoters  = rows.filter(r => r.score >= 9).reduce((s, r) => s + r.count, 0)
  const passives   = rows.filter(r => r.score >= 7 && r.score <= 8).reduce((s, r) => s + r.count, 0)
  const detractors = rows.filter(r => r.score <= 6).reduce((s, r) => s + r.count, 0)

  const npsScore = total > 0
    ? Math.round(((promoters - detractors) / total) * 100)
    : null

  const avgScore = total > 0
    ? Math.round(rows.reduce((s, r) => s + r.score * r.count, 0) / total * 10) / 10
    : null

  // Daily NPS trend
  const daily = db.prepare(`
    SELECT date(responded_at) as day,
           COUNT(*) as count,
           ROUND(AVG(score), 1) as avg_score,
           COUNT(CASE WHEN score >= 9 THEN 1 END) as promoters,
           COUNT(CASE WHEN score <= 6 THEN 1 END) as detractors
    FROM nps_surveys
    WHERE responded_at >= datetime('now', '-${d} days')
    GROUP BY day ORDER BY day ASC
  `).all()

  // Distribution 0–10
  const distribution = Array.from({ length: 11 }, (_, i) => ({
    score: i,
    count: rows.find(r => r.score === i)?.count || 0,
  }))

  // Recent feedback from detractors (for action)
  const recentFeedback = db.prepare(`
    SELECT score, feedback, customer_email, order_number, responded_at
    FROM nps_surveys
    WHERE responded_at >= datetime('now', '-${d} days')
      AND feedback != '' AND feedback IS NOT NULL
    ORDER BY responded_at DESC
    LIMIT 20
  `).all()

  res.json({
    nps_score: npsScore,
    avg_score: avgScore,
    total, promoters, passives, detractors,
    promoter_pct: total ? Math.round(promoters / total * 100) : 0,
    passive_pct:  total ? Math.round(passives  / total * 100) : 0,
    detractor_pct:total ? Math.round(detractors/ total * 100) : 0,
    distribution, daily, recentFeedback,
  })
})

// ── DELETE /api/nps/:id — admin: delete response ─────────────────────────────
router.delete('/:id', auth, (req, res) => {
  db.prepare(`DELETE FROM nps_surveys WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

export default router
