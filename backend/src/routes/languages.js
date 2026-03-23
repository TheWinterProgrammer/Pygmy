// Pygmy CMS — Multi-language Manager API (Phase 36)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ─── Languages CRUD ────────────────────────────────────────────────────────────

// GET /api/languages — list all languages (public for frontend language switcher)
router.get('/', (req, res) => {
  const langs = db.prepare(
    'SELECT * FROM languages ORDER BY is_default DESC, sort_order ASC, name ASC'
  ).all()
  res.json(langs)
})

// GET /api/languages/active — only active (public)
router.get('/active', (req, res) => {
  const langs = db.prepare(
    "SELECT * FROM languages WHERE active = 1 ORDER BY is_default DESC, sort_order ASC"
  ).all()
  res.json(langs)
})

// POST /api/languages — create (admin)
router.post('/', authMiddleware, (req, res) => {
  const { code, name, native_name = '', flag = '', active = 1, sort_order = 0 } = req.body
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' })

  const exists = db.prepare('SELECT id FROM languages WHERE code = ?').get(code)
  if (exists) return res.status(400).json({ error: 'Language code already exists' })

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO languages (code, name, native_name, flag, active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(code, name, native_name, flag, active ? 1 : 0, sort_order)

  res.json(db.prepare('SELECT * FROM languages WHERE id = ?').get(lastInsertRowid))
})

// PUT /api/languages/:id — update (admin)
router.put('/:id', authMiddleware, (req, res) => {
  const { name, native_name, flag, active, sort_order, is_default } = req.body
  const lang = db.prepare('SELECT * FROM languages WHERE id = ?').get(req.params.id)
  if (!lang) return res.status(404).json({ error: 'Not found' })

  // If setting as default, unset others
  if (is_default) {
    db.prepare('UPDATE languages SET is_default = 0').run()
  }

  db.prepare(`
    UPDATE languages SET
      name = COALESCE(?, name),
      native_name = COALESCE(?, native_name),
      flag = COALESCE(?, flag),
      active = COALESCE(?, active),
      sort_order = COALESCE(?, sort_order),
      is_default = COALESCE(?, is_default)
    WHERE id = ?
  `).run(name, native_name, flag, active != null ? (active ? 1 : 0) : null, sort_order, is_default != null ? (is_default ? 1 : 0) : null, req.params.id)

  res.json(db.prepare('SELECT * FROM languages WHERE id = ?').get(req.params.id))
})

// DELETE /api/languages/:id — delete (admin)
router.delete('/:id', authMiddleware, (req, res) => {
  const lang = db.prepare('SELECT * FROM languages WHERE id = ?').get(req.params.id)
  if (!lang) return res.status(404).json({ error: 'Not found' })
  if (lang.is_default) return res.status(400).json({ error: 'Cannot delete the default language' })

  db.prepare('DELETE FROM languages WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─── Content Translations ─────────────────────────────────────────────────────

// GET /api/languages/translations?entity_type=&entity_id=&lang= — get translations
router.get('/translations', (req, res) => {
  const { entity_type, entity_id, lang } = req.query
  if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' })

  let query = 'WHERE entity_type = ? AND entity_id = ?'
  const params = [entity_type, entity_id]

  if (lang) {
    query += ' AND language_code = ?'
    params.push(lang)
  }

  const rows = db.prepare(`SELECT * FROM content_translations ${query} ORDER BY language_code, field`).all(...params)

  // Group by language_code: { de: { title: '...', excerpt: '...' }, fr: {...} }
  const grouped = {}
  for (const row of rows) {
    if (!grouped[row.language_code]) grouped[row.language_code] = {}
    grouped[row.language_code][row.field] = row.value
  }

  res.json(grouped)
})

// PUT /api/languages/translations — save/update translations for an entity
router.put('/translations', authMiddleware, (req, res) => {
  const { entity_type, entity_id, language_code, fields } = req.body
  // fields: { title: '...', excerpt: '...', content: '...', meta_title: '...', meta_description: '...' }

  if (!entity_type || !entity_id || !language_code || !fields) {
    return res.status(400).json({ error: 'entity_type, entity_id, language_code, and fields required' })
  }

  const lang = db.prepare('SELECT code FROM languages WHERE code = ?').get(language_code)
  if (!lang) return res.status(400).json({ error: `Unknown language: ${language_code}` })

  const upsert = db.prepare(`
    INSERT INTO content_translations (entity_type, entity_id, language_code, field, value, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(entity_type, entity_id, language_code, field)
    DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `)

  const saveAll = db.transaction((fieldsObj) => {
    for (const [field, value] of Object.entries(fieldsObj)) {
      upsert.run(entity_type, entity_id, language_code, field, value)
    }
  })

  saveAll(fields)

  // Return updated translations for this entity+lang
  const rows = db.prepare(
    'SELECT field, value FROM content_translations WHERE entity_type=? AND entity_id=? AND language_code=?'
  ).all(entity_type, entity_id, language_code)

  const result = {}
  rows.forEach(r => (result[r.field] = r.value))
  res.json(result)
})

// DELETE /api/languages/translations — remove all translations for an entity + lang
router.delete('/translations', authMiddleware, (req, res) => {
  const { entity_type, entity_id, language_code } = req.body
  if (!entity_type || !entity_id || !language_code) {
    return res.status(400).json({ error: 'entity_type, entity_id, language_code required' })
  }

  db.prepare(
    'DELETE FROM content_translations WHERE entity_type=? AND entity_id=? AND language_code=?'
  ).run(entity_type, entity_id, language_code)

  res.json({ ok: true })
})

// GET /api/languages/progress?entity_type= — translation progress stats per language
router.get('/progress', authMiddleware, (req, res) => {
  const { entity_type = 'post' } = req.query

  // Count distinct entities and translated entities per language
  const langs = db.prepare('SELECT * FROM languages WHERE active = 1').all()

  // Total entities of this type (published + draft)
  let totalCount = 0
  if (entity_type === 'post') {
    totalCount = db.prepare("SELECT COUNT(*) as c FROM posts WHERE status != 'deleted'").get().c
  } else if (entity_type === 'page') {
    totalCount = db.prepare("SELECT COUNT(*) as c FROM pages").get().c
  } else if (entity_type === 'product') {
    totalCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE status != 'deleted'").get().c
  }

  const progress = langs.map(lang => {
    const translated = db.prepare(`
      SELECT COUNT(DISTINCT entity_id) as c
      FROM content_translations
      WHERE entity_type = ? AND language_code = ?
    `).get(entity_type, lang.code).c

    return {
      ...lang,
      entity_type,
      total: totalCount,
      translated,
      percent: totalCount ? Math.round((translated / totalCount) * 100) : 0,
    }
  })

  res.json(progress)
})

export default router
