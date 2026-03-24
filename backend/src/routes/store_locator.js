// Pygmy CMS — Store Locator (Phase 62)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()

// ── Ensure table ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS store_locations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    slug         TEXT    NOT NULL UNIQUE,
    address      TEXT,
    city         TEXT,
    state        TEXT,
    zip          TEXT,
    country      TEXT    DEFAULT 'DE',
    phone        TEXT,
    email        TEXT,
    website      TEXT,
    latitude     REAL,
    longitude    REAL,
    map_embed    TEXT,
    hours        TEXT    DEFAULT '{}',
    description  TEXT,
    cover_image  TEXT,
    type         TEXT    DEFAULT 'store',
    featured     INTEGER DEFAULT 0,
    active       INTEGER DEFAULT 1,
    sort_order   INTEGER DEFAULT 0,
    created_at   TEXT    DEFAULT (datetime('now')),
    updated_at   TEXT    DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_store_loc_active ON store_locations(active);
`)

function parseLocation(loc) {
  try { loc.hours = JSON.parse(loc.hours || '{}') } catch { loc.hours = {} }
  return loc
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── GET /api/store-locator — public list ──────────────────────────────────────
router.get('/', (req, res) => {
  const { q, type, active = '1', limit = 100, offset = 0 } = req.query
  const params = []
  let where = 'WHERE 1=1'
  if (active !== 'all') { where += ' AND active = ?'; params.push(active === '1' ? 1 : 0) }
  if (q) { where += ' AND (name LIKE ? OR city LIKE ? OR address LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (type) { where += ' AND type = ?'; params.push(type) }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM store_locations ${where}`).get(...params).n
  const rows = db.prepare(`SELECT * FROM store_locations ${where} ORDER BY featured DESC, sort_order ASC, name ASC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), parseInt(offset))
  res.json({ locations: rows.map(parseLocation), total })
})

// ── GET /api/store-locator/stats — admin stats ────────────────────────────────
router.get('/stats', auth, (req, res) => {
  const total  = db.prepare('SELECT COUNT(*) AS n FROM store_locations').get().n
  const active = db.prepare('SELECT COUNT(*) AS n FROM store_locations WHERE active = 1').get().n
  const byType = db.prepare(`SELECT type, COUNT(*) AS n FROM store_locations GROUP BY type`).all()
  res.json({ total, active, byType })
})

// ── GET /api/store-locator/:id — single (public) ─────────────────────────────
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM store_locations WHERE id = ?').get(req.params.id)
    || db.prepare('SELECT * FROM store_locations WHERE slug = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Location not found' })
  res.json(parseLocation(row))
})

// ── POST /api/store-locator — create (admin) ──────────────────────────────────
router.post('/', auth, (req, res) => {
  const {
    name, address = '', city = '', state = '', zip = '', country = 'DE',
    phone = '', email = '', website = '', latitude, longitude, map_embed = '',
    hours = {}, description = '', cover_image = '', type = 'store',
    featured = 0, active = 1, sort_order = 0
  } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  let slug = slugify(name)
  // Ensure unique slug
  let suffix = 0
  while (db.prepare('SELECT id FROM store_locations WHERE slug = ?').get(slug + (suffix ? `-${suffix}` : ''))) suffix++
  if (suffix) slug += `-${suffix}`

  const info = db.prepare(`
    INSERT INTO store_locations (name, slug, address, city, state, zip, country, phone, email, website,
      latitude, longitude, map_embed, hours, description, cover_image, type, featured, active, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    name, slug, address, city, state, zip, country, phone, email, website,
    latitude || null, longitude || null, map_embed,
    typeof hours === 'string' ? hours : JSON.stringify(hours),
    description, cover_image, type, featured ? 1 : 0, active ? 1 : 0, sort_order
  )
  res.status(201).json(parseLocation(db.prepare('SELECT * FROM store_locations WHERE id = ?').get(info.lastInsertRowid)))
})

// ── PUT /api/store-locator/:id — update (admin) ───────────────────────────────
router.put('/:id', auth, (req, res) => {
  const loc = db.prepare('SELECT * FROM store_locations WHERE id = ?').get(req.params.id)
  if (!loc) return res.status(404).json({ error: 'Not found' })

  const {
    name, address, city, state, zip, country, phone, email, website,
    latitude, longitude, map_embed, hours, description, cover_image, type,
    featured, active, sort_order
  } = req.body

  db.prepare(`
    UPDATE store_locations SET
      name = ?, address = ?, city = ?, state = ?, zip = ?, country = ?,
      phone = ?, email = ?, website = ?,
      latitude = ?, longitude = ?,
      map_embed = ?, hours = ?, description = ?, cover_image = ?,
      type = ?, featured = ?, active = ?, sort_order = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? loc.name,
    address ?? loc.address, city ?? loc.city, state ?? loc.state, zip ?? loc.zip, country ?? loc.country,
    phone ?? loc.phone, email ?? loc.email, website ?? loc.website,
    latitude !== undefined ? latitude : loc.latitude,
    longitude !== undefined ? longitude : loc.longitude,
    map_embed ?? loc.map_embed,
    hours !== undefined ? (typeof hours === 'string' ? hours : JSON.stringify(hours)) : loc.hours,
    description ?? loc.description, cover_image ?? loc.cover_image,
    type ?? loc.type, featured !== undefined ? (featured ? 1 : 0) : loc.featured,
    active !== undefined ? (active ? 1 : 0) : loc.active,
    sort_order ?? loc.sort_order,
    req.params.id
  )
  res.json(parseLocation(db.prepare('SELECT * FROM store_locations WHERE id = ?').get(req.params.id)))
})

// ── DELETE /api/store-locator/:id — delete (admin) ────────────────────────────
router.delete('/:id', auth, (req, res) => {
  const loc = db.prepare('SELECT id FROM store_locations WHERE id = ?').get(req.params.id)
  if (!loc) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM store_locations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
