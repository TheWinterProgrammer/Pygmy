// Pygmy CMS — Page Blocks API (Phase 24)
// Provides CRUD for the content-block builder attached to pages.
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// ── Supported block types & their default settings ──────────────────────────
export const BLOCK_TYPES = {
  hero:         { title: '', subtitle: '', bg_image: '', bg_color: '', cta_label: '', cta_url: '', overlay_opacity: 0.5, text_align: 'center', min_height: '60vh' },
  features:     { title: '', subtitle: '', columns: 3, items: [] },          // items: [{icon,title,text}]
  text:         { content: '', max_width: '760px', text_align: 'left' },
  image_text:   { title: '', text: '', image: '', image_side: 'right', cta_label: '', cta_url: '' },
  gallery:      { title: '', images: [], columns: 3 },                        // images: [{url,alt}]
  testimonials: { title: '', items: [] },                                     // items: [{quote,author,role,avatar}]
  cta:          { title: '', subtitle: '', btn_label: '', btn_url: '', bg_color: '', centered: true },
  faq:          { title: '', items: [] },                                     // items: [{question,answer}]
  team:         { title: '', subtitle: '', items: [] },                      // items: [{name,role,bio,photo}]
  pricing:      { title: '', subtitle: '', items: [] },                      // items: [{name,price,period,features[],highlight,cta_label,cta_url}]
  newsletter:   { title: '', subtitle: '', placeholder: 'Your email address', btn_label: 'Subscribe' },
  divider:      { style: 'line', spacing: 'md' },
  spacer:       { height: '60px' },
  embed:        { title: '', html: '' },
}

function parseBlock(row) {
  return {
    ...row,
    settings: typeof row.settings === 'string' ? JSON.parse(row.settings || '{}') : row.settings,
  }
}

// ── GET /api/page-blocks?page_id= — list blocks for a page ──────────────────
router.get('/', (req, res) => {
  const { page_id } = req.query
  if (!page_id) return res.status(400).json({ error: 'page_id is required' })

  const blocks = db.prepare(
    'SELECT * FROM page_blocks WHERE page_id = ? ORDER BY sort_order ASC'
  ).all(parseInt(page_id))

  res.json(blocks.map(parseBlock))
})

// ── POST /api/page-blocks — create a block ───────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { page_id, type = 'text', sort_order = 0, settings = {} } = req.body
  if (!page_id) return res.status(400).json({ error: 'page_id is required' })
  if (!BLOCK_TYPES[type]) return res.status(400).json({ error: `Unknown block type: ${type}` })

  // Merge with default settings so every key is present
  const merged = { ...BLOCK_TYPES[type], ...settings }

  const result = db.prepare(`
    INSERT INTO page_blocks (page_id, type, sort_order, settings)
    VALUES (?, ?, ?, ?)
  `).run(parseInt(page_id), type, parseInt(sort_order) || 0, JSON.stringify(merged))

  const created = db.prepare('SELECT * FROM page_blocks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(parseBlock(created))
})

// ── PUT /api/page-blocks/:id — update block settings ────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM page_blocks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Block not found' })

  const { type = existing.type, sort_order = existing.sort_order, settings } = req.body
  const existingSettings = JSON.parse(existing.settings || '{}')
  const updatedSettings = settings != null
    ? { ...existingSettings, ...settings }
    : existingSettings

  db.prepare(`
    UPDATE page_blocks SET type = ?, sort_order = ?, settings = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(type, parseInt(sort_order) || 0, JSON.stringify(updatedSettings), existing.id)

  const updated = db.prepare('SELECT * FROM page_blocks WHERE id = ?').get(existing.id)
  res.json(parseBlock(updated))
})

// ── POST /api/page-blocks/reorder — reorder blocks for a page ───────────────
// Body: { page_id, order: [id, id, id, ...] }
router.post('/reorder', authMiddleware, (req, res) => {
  const { page_id, order } = req.body
  if (!page_id || !Array.isArray(order)) {
    return res.status(400).json({ error: 'page_id and order[] are required' })
  }

  const update = db.prepare('UPDATE page_blocks SET sort_order = ? WHERE id = ? AND page_id = ?')
  const reorderAll = db.transaction((ids) => {
    ids.forEach((id, idx) => update.run(idx, id, parseInt(page_id)))
  })
  reorderAll(order)

  res.json({ ok: true })
})

// ── DELETE /api/page-blocks/:id — delete a block ────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM page_blocks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Block not found' })

  db.prepare('DELETE FROM page_blocks WHERE id = ?').run(existing.id)
  res.json({ ok: true })
})

// ── DELETE /api/page-blocks?page_id= — delete all blocks for a page ─────────
router.delete('/', authMiddleware, (req, res) => {
  const { page_id } = req.query
  if (!page_id) return res.status(400).json({ error: 'page_id is required' })
  db.prepare('DELETE FROM page_blocks WHERE page_id = ?').run(parseInt(page_id))
  res.json({ ok: true })
})

// ── GET /api/page-blocks/types — list available block types ─────────────────
router.get('/types', (req, res) => {
  res.json(Object.keys(BLOCK_TYPES))
})

export default router
