// Pygmy CMS — Content Translations API (Phase 72)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/translations/:entityType/:entityId — get all translations for an entity
router.get('/:entityType/:entityId', authMiddleware, (req, res) => {
  const { entityType, entityId } = req.params
  const rows = db.prepare(
    'SELECT * FROM content_translations WHERE entity_type = ? AND entity_id = ? ORDER BY language_code, field'
  ).all(entityType, entityId)

  // Group by language code
  const grouped = {}
  for (const row of rows) {
    if (!grouped[row.language_code]) grouped[row.language_code] = {}
    grouped[row.language_code][row.field] = row.value
  }
  res.json(grouped)
})

// GET /api/translations/:entityType/:entityId/:langCode — get one language's translation
router.get('/:entityType/:entityId/:langCode', (req, res) => {
  const { entityType, entityId, langCode } = req.params
  const rows = db.prepare(
    'SELECT field, value FROM content_translations WHERE entity_type = ? AND entity_id = ? AND language_code = ?'
  ).all(entityType, entityId, langCode)
  const result = {}
  for (const row of rows) result[row.field] = row.value
  res.json(result)
})

// PUT /api/translations/:entityType/:entityId/:langCode — upsert translation fields
router.put('/:entityType/:entityId/:langCode', authMiddleware, (req, res) => {
  const { entityType, entityId, langCode } = req.params
  const fields = req.body // { title, content, excerpt, meta_title, meta_description, ... }

  const lang = db.prepare('SELECT code FROM languages WHERE code = ?').get(langCode)
  if (!lang) return res.status(400).json({ error: 'Invalid language code' })

  const upsert = db.prepare(`
    INSERT INTO content_translations (entity_type, entity_id, language_code, field, value, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(entity_type, entity_id, language_code, field)
    DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `)

  const saveAll = db.transaction(() => {
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value === 'string') {
        upsert.run(entityType, entityId, langCode, field, value)
      }
    }
  })
  saveAll()

  res.json({ ok: true })
})

// DELETE /api/translations/:entityType/:entityId/:langCode — remove all translations for a language
router.delete('/:entityType/:entityId/:langCode', authMiddleware, (req, res) => {
  const { entityType, entityId, langCode } = req.params
  db.prepare(
    'DELETE FROM content_translations WHERE entity_type = ? AND entity_id = ? AND language_code = ?'
  ).run(entityType, entityId, langCode)
  res.json({ ok: true })
})

// DELETE /api/translations/:entityType/:entityId — remove all translations for an entity
router.delete('/:entityType/:entityId', authMiddleware, (req, res) => {
  const { entityType, entityId } = req.params
  db.prepare(
    'DELETE FROM content_translations WHERE entity_type = ? AND entity_id = ?'
  ).run(entityType, entityId)
  res.json({ ok: true })
})

// GET /api/translations/coverage/stats — admin overview of translation coverage
router.get('/coverage/stats', authMiddleware, (req, res) => {
  const langs = db.prepare("SELECT code, name, flag FROM languages WHERE active = 1 AND is_default = 0").all()

  const entityTypes = [
    { type: 'post', table: 'posts', statusCol: "status = 'published'" },
    { type: 'page', table: 'pages', statusCol: "status = 'published'" },
    { type: 'product', table: 'products', statusCol: "status = 'published'" }
  ]

  const stats = {}
  for (const lang of langs) {
    stats[lang.code] = { name: lang.name, flag: lang.flag, counts: {} }
    for (const et of entityTypes) {
      const total = db.prepare(`SELECT COUNT(*) as n FROM ${et.table} WHERE ${et.statusCol}`).get()?.n || 0
      const translated = db.prepare(`
        SELECT COUNT(DISTINCT entity_id) as n FROM content_translations
        WHERE entity_type = ? AND language_code = ?
      `).get(et.type, lang.code)?.n || 0
      stats[lang.code].counts[et.type] = { total, translated }
    }
  }

  res.json(stats)
})

// GET /api/translations/missing/:langCode — list entities not yet translated for a language
router.get('/missing/:langCode', authMiddleware, (req, res) => {
  const { langCode } = req.params
  const { type = 'post' } = req.query
  const tableMap = { post: 'posts', page: 'pages', product: 'products' }
  const table = tableMap[type] || 'posts'

  const rows = db.prepare(`
    SELECT id, title, slug FROM ${table}
    WHERE status = 'published'
    AND id NOT IN (
      SELECT entity_id FROM content_translations
      WHERE entity_type = ? AND language_code = ?
    )
    ORDER BY id DESC
    LIMIT 100
  `).all(type, langCode)

  res.json(rows)
})

export default router
