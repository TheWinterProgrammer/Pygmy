// Pygmy CMS — API Keys routes
import { Router } from 'express'
import crypto from 'crypto'
import { authMiddleware, adminOnly } from '../middleware/auth.js'
import db from '../db.js'

const router = Router()
router.use(authMiddleware, adminOnly)

function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function generateKey() {
  const raw = 'pgk_' + crypto.randomBytes(32).toString('hex')
  const prefix = raw.slice(0, 12) // e.g. "pgk_a1b2c3d4"
  const hash = hashKey(raw)
  return { raw, prefix, hash }
}

// ─── List all API keys ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, key_prefix, scopes, created_by, created_by_name,
           last_used_at, active, created_at
    FROM api_keys
    ORDER BY created_at DESC
  `).all()
  res.json(rows.map(r => ({ ...r, scopes: JSON.parse(r.scopes || '["read"]') })))
})

// ─── Create an API key ────────────────────────────────────────────────────────
// Returns full raw key ONE TIME — store it; it won't be shown again
router.post('/', (req, res) => {
  const { name, scopes = ['read'] } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

  const allowed = ['read', 'write']
  const cleanScopes = (Array.isArray(scopes) ? scopes : [scopes]).filter(s => allowed.includes(s))
  if (!cleanScopes.length) return res.status(400).json({ error: 'At least one valid scope required (read, write)' })

  const { raw, prefix, hash } = generateKey()

  const result = db.prepare(`
    INSERT INTO api_keys (name, key_hash, key_prefix, scopes, created_by, created_by_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    hash,
    prefix,
    JSON.stringify(cleanScopes),
    req.user.id || null,
    req.user.name || 'Admin'
  )

  res.status(201).json({
    id: result.lastInsertRowid,
    name: name.trim(),
    key: raw, // shown ONCE — client must store it
    key_prefix: prefix,
    scopes: cleanScopes,
    active: 1,
    created_at: new Date().toISOString(),
  })
})

// ─── Update an API key (name, scopes, active) ─────────────────────────────────
router.put('/:id', (req, res) => {
  const { name, scopes, active } = req.body
  const existing = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'API key not found' })

  const allowed = ['read', 'write']
  let cleanScopes = existing.scopes
  if (scopes !== undefined) {
    cleanScopes = JSON.stringify(
      (Array.isArray(scopes) ? scopes : [scopes]).filter(s => allowed.includes(s))
    )
  }

  db.prepare(`
    UPDATE api_keys
    SET name = ?, scopes = ?, active = ?
    WHERE id = ?
  `).run(
    name?.trim() || existing.name,
    cleanScopes,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  )

  res.json({ ok: true })
})

// ─── Rotate an API key (new raw key, same metadata) ──────────────────────────
router.post('/:id/rotate', (req, res) => {
  const existing = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'API key not found' })

  const { raw, prefix, hash } = generateKey()

  db.prepare(`
    UPDATE api_keys SET key_hash = ?, key_prefix = ?, last_used_at = NULL WHERE id = ?
  `).run(hash, prefix, req.params.id)

  res.json({
    id: existing.id,
    key: raw, // shown ONCE
    key_prefix: prefix,
  })
})

// ─── Delete an API key ────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'API key not found' })
  res.json({ ok: true })
})

export default router
