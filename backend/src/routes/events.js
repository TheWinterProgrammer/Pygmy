// Pygmy CMS — Events CRUD
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from './activity.js'
import { fireWebhooks } from './webhooks.js'

const router = Router()

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function parseEvent(ev) {
  if (!ev) return null
  return { ...ev, tags: JSON.parse(ev.tags || '[]') }
}

// GET /api/events — public (published) or all (admin)
router.get('/', (req, res) => {
  const { all, featured, tag, upcoming, past, limit = 20, offset = 0 } = req.query
  const isAdmin = all === '1'

  let where = isAdmin ? '' : `WHERE e.status = 'published'`
  const params = []

  if (!isAdmin && featured === '1') {
    where += ` AND e.featured = 1`
  }

  if (!isAdmin && upcoming === '1') {
    where += ` AND e.start_date >= datetime('now')`
  }
  if (!isAdmin && past === '1') {
    where += ` AND e.start_date < datetime('now')`
  }

  const events = db.prepare(`
    SELECT * FROM events e
    ${where}
    ORDER BY e.start_date ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset)).map(parseEvent)

  // Tag filter (in-memory for simplicity, consistent with posts)
  const filtered = tag
    ? events.filter(e => e.tags.includes(tag))
    : events

  const total = isAdmin
    ? db.prepare('SELECT COUNT(*) as c FROM events').get().c
    : db.prepare(`SELECT COUNT(*) as c FROM events WHERE status='published'`).get().c

  res.json({ events: filtered, total })
})

// GET /api/events/upcoming — convenience endpoint for homepage widget
router.get('/upcoming', (req, res) => {
  const limit = parseInt(req.query.limit) || 3
  const events = db.prepare(`
    SELECT * FROM events
    WHERE status = 'published' AND start_date >= datetime('now')
    ORDER BY start_date ASC
    LIMIT ?
  `).all(limit).map(parseEvent)
  res.json(events)
})

// GET /api/events/:slug
router.get('/:slug', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE slug = ?').get(req.params.slug)
  if (!ev || ev.status === 'draft') {
    // Allow admins to preview drafts
    const auth = req.headers.authorization || ''
    if (!auth.startsWith('Bearer ') && ev?.status === 'draft') {
      return res.status(404).json({ error: 'Event not found' })
    }
    if (!ev) return res.status(404).json({ error: 'Event not found' })
  }
  res.json(parseEvent(ev))
})

// POST /api/events
router.post('/', authMiddleware, (req, res) => {
  const {
    title, slug, excerpt = '', description = '', cover_image = null,
    start_date, end_date = null, all_day = 0,
    location = '', venue = '', ticket_url = '',
    tags = [], status = 'draft', featured = 0,
    meta_title = null, meta_desc = null
  } = req.body

  if (!title || !start_date) return res.status(400).json({ error: 'title and start_date are required' })

  const finalSlug = slug || slugify(title)

  try {
    const info = db.prepare(`
      INSERT INTO events
        (title, slug, excerpt, description, cover_image, start_date, end_date, all_day,
         location, venue, ticket_url, tags, status, featured, meta_title, meta_desc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      title, finalSlug, excerpt, description, cover_image,
      start_date, end_date, all_day ? 1 : 0,
      location, venue, ticket_url,
      JSON.stringify(tags), status, featured ? 1 : 0,
      meta_title, meta_desc
    )

    const created = parseEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid))
    logActivity(req, 'created', 'event', created.id, created.title)
    fireWebhooks('event.created', created)
    if (status === 'published') fireWebhooks('event.published', created)
    res.status(201).json(created)
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/events/:id
router.put('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Event not found' })

  const {
    title, slug, excerpt, description, cover_image,
    start_date, end_date, all_day,
    location, venue, ticket_url,
    tags, status, featured,
    meta_title, meta_desc
  } = req.body

  const finalSlug = slug || slugify(title || existing.title)

  try {
    db.prepare(`
      UPDATE events SET
        title=?, slug=?, excerpt=?, description=?, cover_image=?,
        start_date=?, end_date=?, all_day=?,
        location=?, venue=?, ticket_url=?,
        tags=?, status=?, featured=?,
        meta_title=?, meta_desc=?,
        updated_at=datetime('now')
      WHERE id=?
    `).run(
      title ?? existing.title,
      finalSlug,
      excerpt ?? existing.excerpt,
      description ?? existing.description,
      cover_image !== undefined ? cover_image : existing.cover_image,
      start_date ?? existing.start_date,
      end_date !== undefined ? end_date : existing.end_date,
      all_day !== undefined ? (all_day ? 1 : 0) : existing.all_day,
      location ?? existing.location,
      venue ?? existing.venue,
      ticket_url ?? existing.ticket_url,
      JSON.stringify(tags ?? JSON.parse(existing.tags)),
      status ?? existing.status,
      featured !== undefined ? (featured ? 1 : 0) : existing.featured,
      meta_title !== undefined ? meta_title : existing.meta_title,
      meta_desc !== undefined ? meta_desc : existing.meta_desc,
      req.params.id
    )

    const updated = parseEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id))
    logActivity(req, 'updated', 'event', updated.id, updated.title)
    fireWebhooks('event.updated', updated)
    if (existing.status !== 'published' && updated.status === 'published') {
      fireWebhooks('event.published', updated)
    }
    res.json(updated)
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/events/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
  if (!ev) return res.status(404).json({ error: 'Event not found' })
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id)
  logActivity(req, 'deleted', 'event', ev.id, ev.title)
  fireWebhooks('event.deleted', { id: ev.id, title: ev.title })
  res.json({ message: 'Deleted' })
})

export default router
