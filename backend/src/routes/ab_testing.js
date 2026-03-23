// Pygmy CMS — A/B Testing API (Phase 34)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTest(row) {
  if (!row) return null
  return row
}

function getTestWithStats(id) {
  const test = db.prepare('SELECT * FROM ab_tests WHERE id = ?').get(id)
  if (!test) return null
  const variants = db.prepare('SELECT * FROM ab_variants WHERE test_id = ? ORDER BY label').all(id)
  const variantsWithStats = variants.map(v => {
    const impressions = db.prepare('SELECT COUNT(*) as cnt FROM ab_impressions WHERE variant_id = ?').get(v.id).cnt
    const conversions = db.prepare('SELECT COUNT(*) as cnt FROM ab_impressions WHERE variant_id = ? AND converted = 1').get(v.id).cnt
    return {
      ...v,
      changes: (() => { try { return JSON.parse(v.changes || '{}') } catch { return {} } })(),
      impressions,
      conversions,
      conversion_rate: impressions > 0 ? ((conversions / impressions) * 100).toFixed(2) : '0.00',
    }
  })
  return { ...test, variants: variantsWithStats }
}

// ─── Admin: List Tests ─────────────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { status } = req.query
  let query = 'SELECT t.*, u.name as creator_name FROM ab_tests t LEFT JOIN users u ON u.id = t.created_by'
  const params = []
  if (status) { query += ' WHERE t.status = ?'; params.push(status) }
  query += ' ORDER BY t.created_at DESC'
  const tests = db.prepare(query).all(...params)
  // Append quick stats
  const result = tests.map(t => {
    const impressions = db.prepare('SELECT COUNT(*) as cnt FROM ab_impressions WHERE test_id = ?').get(t.id).cnt
    const conversions = db.prepare('SELECT COUNT(*) as cnt FROM ab_impressions WHERE test_id = ? AND converted = 1').get(t.id).cnt
    return { ...t, impressions, conversions }
  })
  res.json({ tests: result })
})

// ─── Admin: Get single test with variants + stats ─────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const test = getTestWithStats(req.params.id)
  if (!test) return res.status(404).json({ error: 'Not found' })
  res.json({ test })
})

// ─── Admin: Create Test ────────────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { name, description = '', entity_type = 'page', entity_id, split = 50, goal = 'click', goal_selector = '', variants = [] } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })

  const result = db.prepare(`
    INSERT INTO ab_tests (name, description, entity_type, entity_id, split, goal, goal_selector, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
  `).run(name, description, entity_type, entity_id || null, split, goal, goal_selector, req.user.id)

  const testId = result.lastInsertRowid

  // Create default A/B variants if not provided
  const variantList = variants.length ? variants : [
    { label: 'A', name: 'Control', changes: {} },
    { label: 'B', name: 'Variant B', changes: {} },
  ]
  for (const v of variantList) {
    db.prepare(`
      INSERT INTO ab_variants (test_id, label, name, changes, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(testId, v.label || 'A', v.name || '', JSON.stringify(v.changes || {}))
  }

  res.json({ test: getTestWithStats(testId) })
})

// ─── Admin: Update Test ────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const test = db.prepare('SELECT * FROM ab_tests WHERE id = ?').get(req.params.id)
  if (!test) return res.status(404).json({ error: 'Not found' })

  const { name, description, entity_type, entity_id, split, goal, goal_selector, status, winner } = req.body
  const fields = []
  const params = []

  if (name !== undefined)           { fields.push('name = ?');           params.push(name) }
  if (description !== undefined)    { fields.push('description = ?');    params.push(description) }
  if (entity_type !== undefined)    { fields.push('entity_type = ?');    params.push(entity_type) }
  if (entity_id !== undefined)      { fields.push('entity_id = ?');      params.push(entity_id) }
  if (split !== undefined)          { fields.push('split = ?');          params.push(split) }
  if (goal !== undefined)           { fields.push('goal = ?');           params.push(goal) }
  if (goal_selector !== undefined)  { fields.push('goal_selector = ?');  params.push(goal_selector) }
  if (winner !== undefined)         { fields.push('winner = ?');         params.push(winner) }

  if (status !== undefined) {
    fields.push('status = ?')
    params.push(status)
    if (status === 'running' && test.status !== 'running') {
      fields.push('started_at = datetime(\'now\')')
    }
    if (['completed', 'paused'].includes(status) && test.status === 'running') {
      fields.push('ended_at = datetime(\'now\')')
    }
  }

  if (fields.length) {
    fields.push('updated_at = datetime(\'now\')')
    db.prepare(`UPDATE ab_tests SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id)
  }

  res.json({ test: getTestWithStats(req.params.id) })
})

// ─── Admin: Delete Test ────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const test = db.prepare('SELECT * FROM ab_tests WHERE id = ?').get(req.params.id)
  if (!test) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM ab_tests WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Admin: Update variant ─────────────────────────────────────────────────────
router.put('/:id/variants/:vid', authMiddleware, (req, res) => {
  const variant = db.prepare('SELECT * FROM ab_variants WHERE id = ? AND test_id = ?').get(req.params.vid, req.params.id)
  if (!variant) return res.status(404).json({ error: 'Not found' })
  const { name, changes } = req.body
  db.prepare('UPDATE ab_variants SET name = COALESCE(?, name), changes = COALESCE(?, changes) WHERE id = ?')
    .run(name !== undefined ? name : null, changes !== undefined ? JSON.stringify(changes) : null, req.params.vid)
  res.json({ ok: true })
})

// ─── Public: Get variant assignment for a session ──────────────────────────────
// POST /api/ab-tests/:id/assign  { session_id }  → { variant, variant_id }
router.post('/:id/assign', (req, res) => {
  const { session_id } = req.body
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  const test = db.prepare('SELECT * FROM ab_tests WHERE id = ? AND status = \'running\'').get(req.params.id)
  if (!test) return res.status(404).json({ error: 'Test not running' })

  const variants = db.prepare('SELECT * FROM ab_variants WHERE test_id = ? ORDER BY label').all(req.params.id)
  if (!variants.length) return res.status(404).json({ error: 'No variants' })

  // Check existing assignment
  const existing = db.prepare('SELECT vi.*, v.label, v.name, v.changes FROM ab_impressions vi JOIN ab_variants v ON v.id = vi.variant_id WHERE vi.test_id = ? AND vi.session_id = ? LIMIT 1').get(req.params.id, session_id)
  if (existing) {
    return res.json({
      variant_id: existing.variant_id,
      label: existing.label,
      name: existing.name,
      changes: (() => { try { return JSON.parse(existing.changes || '{}') } catch { return {} } })(),
      existing: true,
    })
  }

  // Assign: if 2 variants, use split %. Otherwise random.
  let chosen
  if (variants.length === 2) {
    // split = % to assign to variant B
    const rand = Math.random() * 100
    chosen = rand < test.split ? variants[1] : variants[0]
  } else {
    chosen = variants[Math.floor(Math.random() * variants.length)]
  }

  db.prepare(`
    INSERT INTO ab_impressions (test_id, variant_id, session_id, converted, created_at)
    VALUES (?, ?, ?, 0, datetime('now'))
  `).run(test.id, chosen.id, session_id)

  res.json({
    variant_id: chosen.id,
    label: chosen.label,
    name: chosen.name,
    changes: (() => { try { return JSON.parse(chosen.changes || '{}') } catch { return {} } })(),
    existing: false,
  })
})

// ─── Public: Record conversion ─────────────────────────────────────────────────
// POST /api/ab-tests/:id/convert  { session_id }
router.post('/:id/convert', (req, res) => {
  const { session_id } = req.body
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  const impression = db.prepare('SELECT * FROM ab_impressions WHERE test_id = ? AND session_id = ? LIMIT 1').get(req.params.id, session_id)
  if (!impression) return res.status(404).json({ error: 'No impression found' })

  if (!impression.converted) {
    db.prepare('UPDATE ab_impressions SET converted = 1 WHERE id = ?').run(impression.id)
  }
  res.json({ ok: true })
})

// ─── Admin: Get running tests for a given entity ──────────────────────────────
// GET /api/ab-tests/active?entity_type=page&entity_id=5
router.get('/active', (req, res) => {
  const { entity_type, entity_id } = req.query
  let query = 'SELECT * FROM ab_tests WHERE status = \'running\''
  const params = []
  if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type) }
  if (entity_id)   { query += ' AND entity_id = ?';   params.push(entity_id) }
  const tests = db.prepare(query).all(...params)
  res.json({ tests })
})

export default router
