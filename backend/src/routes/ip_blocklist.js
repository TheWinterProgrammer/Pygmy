// IP Blocklist — Phase 60
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()

// Check if an IP matches any active block entry (called from middleware)
export function isIpBlocked(ip) {
  if (!ip) return false
  const rows = db.prepare(`SELECT pattern, type FROM ip_blocklist WHERE active = 1`).all()
  for (const row of rows) {
    if (row.type === 'exact' && row.pattern === ip) return true
    if (row.type === 'cidr') {
      try { if (ipInCidr(ip, row.pattern)) return true } catch {}
    }
    if (row.type === 'wildcard') {
      const re = new RegExp('^' + row.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
      if (re.test(ip)) return true
    }
  }
  return false
}

function ipInCidr(ip, cidr) {
  const [range, bits] = cidr.split('/')
  if (!bits) return ip === range
  const mask = ~(0xffffffff >>> parseInt(bits)) >>> 0
  const ipNum = ipToNum(ip)
  const rangeNum = ipToNum(range)
  return (ipNum & mask) === (rangeNum & mask)
}

function ipToNum(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + parseInt(part), 0) >>> 0
}

// GET /api/ip-blocklist — list all entries
router.get('/', auth, (req, res) => {
  const { q, active } = req.query
  let query = 'SELECT * FROM ip_blocklist WHERE 1=1'
  const params = []
  if (q) { query += ' AND (pattern LIKE ? OR note LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  if (active !== undefined) { query += ' AND active = ?'; params.push(active === '1' ? 1 : 0) }
  query += ' ORDER BY created_at DESC'
  const rows = db.prepare(query).all(...params)
  const stats = db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) as active_count,
    SUM(hits) as total_hits
  FROM ip_blocklist`).get()
  res.json({ rows, stats })
})

// POST /api/ip-blocklist — add entry
router.post('/', auth, (req, res) => {
  const { pattern, type = 'exact', note = '', active = 1 } = req.body
  if (!pattern) return res.status(400).json({ error: 'pattern required' })
  const validTypes = ['exact', 'cidr', 'wildcard']
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'invalid type' })
  try {
    const result = db.prepare(
      `INSERT INTO ip_blocklist (pattern, type, note, active) VALUES (?, ?, ?, ?)`
    ).run(pattern, type, note, active ? 1 : 0)
    logActivity(req.user?.id, req.user?.name, 'created', 'ip_blocklist', result.lastInsertRowid, pattern)
    res.json(db.prepare('SELECT * FROM ip_blocklist WHERE id = ?').get(result.lastInsertRowid))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/ip-blocklist/:id — update entry
router.put('/:id', auth, (req, res) => {
  const entry = db.prepare('SELECT * FROM ip_blocklist WHERE id = ?').get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'Not found' })
  const { pattern = entry.pattern, type = entry.type, note = entry.note, active } = req.body
  const newActive = active !== undefined ? (active ? 1 : 0) : entry.active
  db.prepare(
    `UPDATE ip_blocklist SET pattern=?, type=?, note=?, active=? WHERE id=?`
  ).run(pattern, type, note, newActive, entry.id)
  res.json(db.prepare('SELECT * FROM ip_blocklist WHERE id = ?').get(entry.id))
})

// DELETE /api/ip-blocklist/:id
router.delete('/:id', auth, (req, res) => {
  const entry = db.prepare('SELECT * FROM ip_blocklist WHERE id = ?').get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM ip_blocklist WHERE id = ?').run(entry.id)
  logActivity(req.user?.id, req.user?.name, 'deleted', 'ip_blocklist', entry.id, entry.pattern)
  res.json({ ok: true })
})

// POST /api/ip-blocklist/:id/toggle
router.post('/:id/toggle', auth, (req, res) => {
  const entry = db.prepare('SELECT * FROM ip_blocklist WHERE id = ?').get(req.params.id)
  if (!entry) return res.status(404).json({ error: 'Not found' })
  const newActive = entry.active ? 0 : 1
  db.prepare('UPDATE ip_blocklist SET active = ? WHERE id = ?').run(newActive, entry.id)
  res.json({ id: entry.id, active: newActive })
})

// POST /api/ip-blocklist/check — public endpoint: check if calling IP is blocked
router.post('/check', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress
  res.json({ blocked: isIpBlocked(ip), ip })
})

export default router
