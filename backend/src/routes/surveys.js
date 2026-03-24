// Pygmy CMS — Survey Builder (Phase 59)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ── Admin: CRUD surveys ───────────────────────────────────────────────────────

// GET /api/surveys — list all surveys (admin)
router.get('/', authMiddleware, (req, res) => {
  const surveys = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM survey_questions WHERE survey_id = s.id) AS question_count,
      (SELECT COUNT(DISTINCT respondent_id) FROM survey_responses WHERE survey_id = s.id) AS response_count
    FROM surveys s
    ORDER BY s.created_at DESC
  `).all()
  res.json(surveys)
})

// GET /api/surveys/stats
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) AS c FROM surveys`).get().c
  const active = db.prepare(`SELECT COUNT(*) AS c FROM surveys WHERE status = 'active'`).get().c
  const responses = db.prepare(`SELECT COUNT(DISTINCT respondent_id) AS c FROM survey_responses`).get().c
  const questions = db.prepare(`SELECT COUNT(*) AS c FROM survey_questions`).get().c
  res.json({ total, active, responses, questions })
})

// GET /api/surveys/:id — single survey + questions (admin)
router.get('/:id', authMiddleware, (req, res) => {
  const survey = db.prepare(`SELECT * FROM surveys WHERE id = ?`).get(Number(req.params.id))
  if (!survey) return res.status(404).json({ error: 'Not found' })
  const questions = db.prepare(`SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY sort_order, id`).all(survey.id)
  for (const q of questions) {
    try { q.options = JSON.parse(q.options || '[]') } catch { q.options = [] }
  }
  res.json({ ...survey, questions })
})

function makeSlug (title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

// POST /api/surveys — create
router.post('/', authMiddleware, (req, res) => {
  const { title, description = '', status = 'draft', show_progress = 1, allow_multiple = 0, success_message = 'Thank you for your response!' } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })
  let slug = makeSlug(title)
  // Ensure unique slug
  let counter = 0
  while (db.prepare(`SELECT id FROM surveys WHERE slug = ?`).get(slug)) {
    counter++
    slug = `${makeSlug(title)}-${counter}`
  }
  const result = db.prepare(`
    INSERT INTO surveys (title, slug, description, status, show_progress, allow_multiple, success_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, slug, description, status, show_progress ? 1 : 0, allow_multiple ? 1 : 0, success_message)
  res.json(db.prepare(`SELECT * FROM surveys WHERE id = ?`).get(result.lastInsertRowid))
})

// PUT /api/surveys/:id
router.put('/:id', authMiddleware, (req, res) => {
  const { title, description, status, show_progress, allow_multiple, success_message } = req.body
  const s = db.prepare(`SELECT id FROM surveys WHERE id = ?`).get(Number(req.params.id))
  if (!s) return res.status(404).json({ error: 'Not found' })
  db.prepare(`
    UPDATE surveys SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      show_progress = COALESCE(?, show_progress),
      allow_multiple = COALESCE(?, allow_multiple),
      success_message = COALESCE(?, success_message),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, status, show_progress != null ? (show_progress ? 1 : 0) : null, allow_multiple != null ? (allow_multiple ? 1 : 0) : null, success_message, Number(req.params.id))
  res.json(db.prepare(`SELECT * FROM surveys WHERE id = ?`).get(Number(req.params.id)))
})

// DELETE /api/surveys/:id
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM surveys WHERE id = ?`).run(Number(req.params.id))
  res.json({ ok: true })
})

// ── Questions ────────────────────────────────────────────────────────────────

// GET /api/surveys/:id/questions
router.get('/:id/questions', authMiddleware, (req, res) => {
  const questions = db.prepare(`SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY sort_order, id`).all(Number(req.params.id))
  for (const q of questions) {
    try { q.options = JSON.parse(q.options || '[]') } catch { q.options = [] }
  }
  res.json(questions)
})

// POST /api/surveys/:id/questions
router.post('/:id/questions', authMiddleware, (req, res) => {
  const surveyId = Number(req.params.id)
  const { text, type = 'text', options = [], required = 1, sort_order = 0, placeholder = '' } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })
  const result = db.prepare(`
    INSERT INTO survey_questions (survey_id, text, type, options, required, sort_order, placeholder)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(surveyId, text, type, JSON.stringify(options), required ? 1 : 0, sort_order, placeholder)
  const q = db.prepare(`SELECT * FROM survey_questions WHERE id = ?`).get(result.lastInsertRowid)
  try { q.options = JSON.parse(q.options) } catch { q.options = [] }
  res.json(q)
})

// PUT /api/surveys/:id/questions/:qid
router.put('/:id/questions/:qid', authMiddleware, (req, res) => {
  const { text, type, options, required, sort_order, placeholder } = req.body
  db.prepare(`
    UPDATE survey_questions SET
      text = COALESCE(?, text),
      type = COALESCE(?, type),
      options = COALESCE(?, options),
      required = COALESCE(?, required),
      sort_order = COALESCE(?, sort_order),
      placeholder = COALESCE(?, placeholder)
    WHERE id = ? AND survey_id = ?
  `).run(text, type, options ? JSON.stringify(options) : null, required != null ? (required ? 1 : 0) : null, sort_order, placeholder, Number(req.params.qid), Number(req.params.id))
  const q = db.prepare(`SELECT * FROM survey_questions WHERE id = ?`).get(Number(req.params.qid))
  if (q) { try { q.options = JSON.parse(q.options) } catch { q.options = [] } }
  res.json(q || { error: 'Not found' })
})

// DELETE /api/surveys/:id/questions/:qid
router.delete('/:id/questions/:qid', authMiddleware, (req, res) => {
  db.prepare(`DELETE FROM survey_questions WHERE id = ? AND survey_id = ?`).run(Number(req.params.qid), Number(req.params.id))
  res.json({ ok: true })
})

// POST /api/surveys/:id/questions/reorder
router.post('/:id/questions/reorder', authMiddleware, (req, res) => {
  const { order } = req.body // array of ids
  const update = db.prepare(`UPDATE survey_questions SET sort_order = ? WHERE id = ?`)
  const tx = db.transaction(() => order.forEach((id, i) => update.run(i, id)))
  tx()
  res.json({ ok: true })
})

// ── Public: submit survey ────────────────────────────────────────────────────

// GET /api/surveys/public/:slug — get active survey for embedding
router.get('/public/:slug', (req, res) => {
  const survey = db.prepare(`SELECT * FROM surveys WHERE slug = ? AND status = 'active'`).get(req.params.slug)
  if (!survey) return res.status(404).json({ error: 'Survey not found or inactive' })
  const questions = db.prepare(`SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY sort_order, id`).all(survey.id)
  for (const q of questions) {
    try { q.options = JSON.parse(q.options || '[]') } catch { q.options = [] }
  }
  res.json({ ...survey, questions })
})

// GET /api/surveys/public-list — list active surveys
router.get('/public-list', (req, res) => {
  const surveys = db.prepare(`SELECT id, title, description, slug FROM surveys WHERE status = 'active' ORDER BY created_at DESC`).all()
  res.json(surveys)
})

// POST /api/surveys/:id/respond — submit answers
router.post('/:id/respond', (req, res) => {
  const surveyId = Number(req.params.id)
  const survey = db.prepare(`SELECT * FROM surveys WHERE id = ?`).get(surveyId)
  if (!survey) return res.status(404).json({ error: 'Not found' })
  if (survey.status !== 'active') return res.status(403).json({ error: 'Survey is not active' })

  const { answers, respondent_id, respondent_email = null } = req.body
  if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: 'answers array required' })
  if (!respondent_id) return res.status(400).json({ error: 'respondent_id required' })

  // Check allow_multiple
  if (!survey.allow_multiple) {
    const existing = db.prepare(`SELECT id FROM survey_responses WHERE survey_id = ? AND respondent_id = ?`).get(surveyId, respondent_id)
    if (existing) return res.status(409).json({ error: 'Already responded', already_responded: true })
  }

  const insertResp = db.prepare(`
    INSERT INTO survey_responses (survey_id, respondent_id, respondent_email, submitted_at)
    VALUES (?, ?, ?, datetime('now'))
  `)
  const insertAnswer = db.prepare(`
    INSERT INTO survey_answers (response_id, question_id, answer_text, answer_value)
    VALUES (?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    const resp = insertResp.run(surveyId, respondent_id, respondent_email)
    for (const a of answers) {
      const val = Array.isArray(a.value) ? a.value.join(', ') : (a.value || '')
      insertAnswer.run(resp.lastInsertRowid, a.question_id, val, val)
    }
    return resp.lastInsertRowid
  })

  const responseId = tx()
  res.json({ ok: true, response_id: responseId, success_message: survey.success_message })
})

// ── Analytics ────────────────────────────────────────────────────────────────

// GET /api/surveys/:id/analytics — per-question response stats
router.get('/:id/analytics', authMiddleware, (req, res) => {
  const surveyId = Number(req.params.id)
  const questions = db.prepare(`SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY sort_order, id`).all(surveyId)
  const totalResponses = db.prepare(`SELECT COUNT(DISTINCT respondent_id) AS c FROM survey_responses WHERE survey_id = ?`).get(surveyId).c

  const analytics = []
  for (const q of questions) {
    let opts = []
    try { opts = JSON.parse(q.options || '[]') } catch {}

    if (['radio', 'checkbox', 'select', 'rating', 'scale'].includes(q.type)) {
      // Aggregate by answer value
      const counts = db.prepare(`
        SELECT answer_text, COUNT(*) AS count
        FROM survey_answers sa
        JOIN survey_responses sr ON sr.id = sa.response_id
        WHERE sr.survey_id = ? AND sa.question_id = ? AND answer_text != ''
        GROUP BY answer_text
        ORDER BY count DESC
      `).all(surveyId, q.id)
      analytics.push({ ...q, options: opts, type_data: counts, total_answers: counts.reduce((s, r) => s + r.count, 0) })
    } else if (q.type === 'nps') {
      // NPS style 0–10
      const scores = db.prepare(`
        SELECT CAST(answer_text AS INTEGER) AS score, COUNT(*) AS count
        FROM survey_answers sa JOIN survey_responses sr ON sr.id = sa.response_id
        WHERE sr.survey_id = ? AND sa.question_id = ? AND answer_text != ''
        GROUP BY score ORDER BY score
      `).all(surveyId, q.id)
      const promoters = scores.filter(s => s.score >= 9).reduce((a, s) => a + s.count, 0)
      const detractors = scores.filter(s => s.score <= 6).reduce((a, s) => a + s.count, 0)
      const total = scores.reduce((a, s) => a + s.count, 0)
      const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null
      analytics.push({ ...q, options: opts, type_data: scores, nps_score: nps, total_answers: total })
    } else {
      // text, email, textarea — list recent answers
      const answers = db.prepare(`
        SELECT sa.answer_text, sr.submitted_at
        FROM survey_answers sa JOIN survey_responses sr ON sr.id = sa.response_id
        WHERE sr.survey_id = ? AND sa.question_id = ? AND answer_text != ''
        ORDER BY sr.submitted_at DESC LIMIT 50
      `).all(surveyId, q.id)
      analytics.push({ ...q, options: opts, type_data: answers, total_answers: answers.length })
    }
  }

  res.json({ total_responses: totalResponses, questions: analytics })
})

// GET /api/surveys/:id/responses — paginated raw responses
router.get('/:id/responses', authMiddleware, (req, res) => {
  const surveyId = Number(req.params.id)
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0

  const responses = db.prepare(`
    SELECT sr.id, sr.respondent_id, sr.respondent_email, sr.submitted_at
    FROM survey_responses sr
    WHERE sr.survey_id = ?
    ORDER BY sr.submitted_at DESC
    LIMIT ? OFFSET ?
  `).all(surveyId, limit, offset)

  for (const resp of responses) {
    resp.answers = db.prepare(`
      SELECT sa.question_id, sq.text AS question_text, sa.answer_text
      FROM survey_answers sa
      JOIN survey_questions sq ON sq.id = sa.question_id
      WHERE sa.response_id = ?
    `).all(resp.id)
  }

  const total = db.prepare(`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id = ?`).get(surveyId).c
  res.json({ responses, total, limit, offset })
})

export default router
