// Pygmy CMS — Churn Risk & RFM Analysis (Phase 73)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── RFM Scoring ─────────────────────────────────────────────────────────────
//
// Recency  (R): days since last order  — lower is better (1=recent, 5=dormant)
// Frequency(F): total # of orders      — higher is better (5=frequent, 1=rare)
// Monetary (M): total spend            — higher is better (5=high, 1=low)
//
// Scores 1–5 per dimension, calculated by quintile.
// Churn risk = weighted composite.

function calcRFM(customers) {
  if (!customers.length) return []

  const recencies  = customers.map(c => c.days_since_last_order)
  const frequencies = customers.map(c => c.total_orders)
  const monetaries = customers.map(c => c.total_spent)

  // Quintile helper — returns score 1-5
  function quintile(val, sorted, ascending) {
    const pct = sorted.indexOf(val) / (sorted.length - 1 || 1)
    const score = Math.ceil(pct * 5) || 1
    return ascending ? score : 6 - score  // ascending = higher val → higher score
  }

  const sortedRec = [...recencies].sort((a, b) => a - b)  // lower recency = better
  const sortedFreq = [...frequencies].sort((a, b) => a - b)
  const sortedMon  = [...monetaries].sort((a, b) => a - b)

  return customers.map(c => {
    const r = quintile(c.days_since_last_order, sortedRec, true)  // lower days → higher idx in sorted → invert
    // Invert R: most recent customer has score 5
    const rScore = 6 - r
    const fScore = quintile(c.total_orders, sortedFreq, true)
    const mScore = quintile(c.total_spent, sortedMon, true)

    const rfmScore = Math.round((rScore * 0.4 + fScore * 0.35 + mScore * 0.25) * 10) / 10

    // Churn risk = inverse of rfmScore relative to 5
    // 0–2 = high risk, 2–3.5 = medium, 3.5–5 = low
    const churnRisk = rfmScore <= 2 ? 'high' : rfmScore <= 3.5 ? 'medium' : 'low'
    const churnScore = Math.round((1 - (rfmScore - 1) / 4) * 100) // 0–100, 100=highest risk

    // Segment label based on RFM
    let segment
    if (rScore >= 4 && fScore >= 4) segment = 'champions'
    else if (rScore >= 4 && fScore >= 2) segment = 'loyal'
    else if (rScore >= 3 && fScore <= 2) segment = 'promising'
    else if (rScore <= 2 && fScore >= 4) segment = 'at_risk'
    else if (rScore <= 2 && fScore >= 2) segment = 'needs_attention'
    else if (rScore === 1 && fScore === 1) segment = 'lost'
    else segment = 'hibernating'

    return {
      ...c,
      r_score: rScore,
      f_score: fScore,
      m_score: mScore,
      rfm_score: rfmScore,
      churn_risk: churnRisk,
      churn_score: churnScore,
      segment,
    }
  })
}

// ─── GET /api/churn/analysis — full RFM analysis ──────────────────────────────
router.get('/analysis', authMiddleware, (req, res) => {
  const { segment, risk, limit = 50, offset = 0, q = '' } = req.query

  const customers = db.prepare(`
    SELECT
      c.id, c.first_name, c.last_name, c.email, c.active, c.created_at,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.total), 0) as total_spent,
      MAX(o.created_at) as last_order_at,
      CAST(julianday('now') - julianday(COALESCE(MAX(o.created_at), c.created_at)) AS INTEGER) as days_since_last_order,
      CAST(julianday('now') - julianday(c.created_at) AS INTEGER) as days_as_customer
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
    WHERE c.active = 1
      AND (? = '' OR c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)
    GROUP BY c.id
    HAVING total_orders >= 0
    ORDER BY last_order_at ASC
  `).all(q, `%${q}%`, `%${q}%`, `%${q}%`)

  let enriched = calcRFM(customers)

  // Filter by segment / risk
  if (segment) enriched = enriched.filter(c => c.segment === segment)
  if (risk) enriched = enriched.filter(c => c.churn_risk === risk)

  // Sort by churn_score descending (most at-risk first)
  enriched.sort((a, b) => b.churn_score - a.churn_score)

  const total = enriched.length
  const page = enriched.slice(Number(offset), Number(offset) + Number(limit))

  res.json({ customers: page, total, returned: page.length })
})

// ─── GET /api/churn/summary — aggregate stats ─────────────────────────────────
router.get('/summary', authMiddleware, (req, res) => {
  const customers = db.prepare(`
    SELECT
      c.id, c.email,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.total), 0) as total_spent,
      CAST(julianday('now') - julianday(COALESCE(MAX(o.created_at), c.created_at)) AS INTEGER) as days_since_last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
    WHERE c.active = 1
    GROUP BY c.id
  `).all()

  const enriched = calcRFM(customers)

  const segmentCounts = {}
  const riskCounts = { high: 0, medium: 0, low: 0 }

  for (const c of enriched) {
    segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1
    riskCounts[c.churn_risk]++
  }

  const avgRfm = enriched.length
    ? Math.round((enriched.reduce((s, c) => s + c.rfm_score, 0) / enriched.length) * 10) / 10
    : 0

  res.json({
    total: enriched.length,
    risk_counts: riskCounts,
    segment_counts: segmentCounts,
    avg_rfm_score: avgRfm,
    high_risk_pct: enriched.length ? Math.round(riskCounts.high / enriched.length * 100) : 0,
  })
})

// ─── GET /api/churn/dormant — customers who haven't ordered in N days ─────────
router.get('/dormant', authMiddleware, (req, res) => {
  const days = Number(req.query.days) || 90

  const dormant = db.prepare(`
    SELECT
      c.id, c.first_name, c.last_name, c.email,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.total), 0) as total_spent,
      MAX(o.created_at) as last_order_at,
      CAST(julianday('now') - julianday(COALESCE(MAX(o.created_at), c.created_at)) AS INTEGER) as days_dormant
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
    WHERE c.active = 1
    GROUP BY c.id
    HAVING days_dormant >= ?
    ORDER BY days_dormant DESC
    LIMIT 200
  `).all(days)

  res.json({ customers: dormant, total: dormant.length, threshold_days: days })
})

// ─── GET /api/churn/segments-overview — segment breakdown with revenue ────────
router.get('/segments-overview', authMiddleware, (req, res) => {
  const customers = db.prepare(`
    SELECT
      c.id, c.email,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.total), 0) as total_spent,
      CAST(julianday('now') - julianday(COALESCE(MAX(o.created_at), c.created_at)) AS INTEGER) as days_since_last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
    WHERE c.active = 1
    GROUP BY c.id
  `).all()

  const enriched = calcRFM(customers)

  const SEGMENT_META = {
    champions:       { label: '🏆 Champions',       desc: 'High frequency, recent buyers', color: '#4ade80' },
    loyal:           { label: '💛 Loyal',            desc: 'Regular buyers, still active', color: '#facc15' },
    promising:       { label: '🌱 Promising',        desc: 'Recent but few orders', color: '#60a5fa' },
    at_risk:         { label: '⚠️ At Risk',          desc: 'Used to buy, now silent', color: '#fb923c' },
    needs_attention: { label: '🔔 Needs Attention',  desc: 'Below average recency & frequency', color: '#f472b6' },
    hibernating:     { label: '😴 Hibernating',      desc: 'Low engagement, infrequent', color: '#94a3b8' },
    lost:            { label: '💔 Lost',             desc: 'No recent orders, single purchase', color: '#ef4444' },
  }

  const overview = {}
  for (const c of enriched) {
    if (!overview[c.segment]) {
      overview[c.segment] = {
        ...SEGMENT_META[c.segment],
        segment: c.segment,
        count: 0,
        total_revenue: 0,
        avg_rfm: 0,
        rfm_sum: 0,
      }
    }
    overview[c.segment].count++
    overview[c.segment].total_revenue += c.total_spent
    overview[c.segment].rfm_sum += c.rfm_score
  }

  const result = Object.values(overview).map(s => ({
    ...s,
    total_revenue: Math.round(s.total_revenue * 100) / 100,
    avg_rfm: s.count ? Math.round(s.rfm_sum / s.count * 10) / 10 : 0,
    rfm_sum: undefined,
  })).sort((a, b) => b.count - a.count)

  res.json(result)
})

export default router
