// Pygmy CMS — Content locking routes
// Prevents simultaneous editing of the same record by multiple admin users.
import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import db from '../db.js'

const router = Router()
router.use(authMiddleware)

const LOCK_TTL_MINUTES = 5 // lock expires after 5 minutes of inactivity

function expiresAt() {
  const d = new Date()
  d.setMinutes(d.getMinutes() + LOCK_TTL_MINUTES)
  return d.toISOString()
}

// Clean stale locks (called lazily on each request)
function cleanExpired() {
  try {
    db.prepare(`DELETE FROM content_locks WHERE expires_at < ?`).run(new Date().toISOString())
  } catch {}
}

// ─── GET /api/locks/:type/:id — check if something is locked ─────────────────
router.get('/:type/:id', (req, res) => {
  cleanExpired()
  const { type, id } = req.params
  const lock = db.prepare(`
    SELECT * FROM content_locks
    WHERE entity_type = ? AND entity_id = ? AND expires_at > ?
  `).get(type, id, new Date().toISOString())

  if (!lock) return res.json({ locked: false })

  const isMe = lock.user_id === req.user.id
  res.json({
    locked: !isMe,
    lock: isMe ? null : {
      user_id:   lock.user_id,
      user_name: lock.user_name,
      locked_at: lock.locked_at,
      expires_at: lock.expires_at,
    }
  })
})

// ─── POST /api/locks — acquire or refresh a lock ─────────────────────────────
// Body: { entity_type, entity_id }
// Returns { ok, conflict? } — conflict means someone else holds the lock.
router.post('/', (req, res) => {
  cleanExpired()
  const { entity_type, entity_id } = req.body
  if (!entity_type || !entity_id) {
    return res.status(400).json({ error: 'entity_type and entity_id required' })
  }

  const now = new Date().toISOString()
  const exp = expiresAt()

  // Check if locked by someone else
  const existing = db.prepare(`
    SELECT * FROM content_locks
    WHERE entity_type = ? AND entity_id = ? AND expires_at > ?
  `).get(entity_type, entity_id, now)

  if (existing && existing.user_id !== req.user.id) {
    return res.json({
      ok: false,
      conflict: {
        user_name: existing.user_name,
        locked_at: existing.locked_at,
        expires_at: existing.expires_at,
      }
    })
  }

  // Upsert our lock
  db.prepare(`
    INSERT INTO content_locks (entity_type, entity_id, user_id, user_name, locked_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id)
    DO UPDATE SET user_id = excluded.user_id, user_name = excluded.user_name,
                  locked_at = excluded.locked_at, expires_at = excluded.expires_at
  `).run(entity_type, entity_id, req.user.id, req.user.name || req.user.email, now, exp)

  res.json({ ok: true, expires_at: exp })
})

// ─── DELETE /api/locks/:type/:id — release a lock ────────────────────────────
router.delete('/:type/:id', (req, res) => {
  const { type, id } = req.params
  // Only the lock owner or an admin can release
  const existing = db.prepare(`
    SELECT * FROM content_locks WHERE entity_type = ? AND entity_id = ?
  `).get(type, id)

  if (existing && existing.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Cannot release another user\'s lock' })
  }

  db.prepare(`DELETE FROM content_locks WHERE entity_type = ? AND entity_id = ?`).run(type, id)
  res.json({ ok: true })
})

// ─── GET /api/locks — list all active locks (admin overview) ─────────────────
router.get('/', (req, res) => {
  cleanExpired()
  const locks = db.prepare(`
    SELECT * FROM content_locks WHERE expires_at > ? ORDER BY locked_at DESC
  `).all(new Date().toISOString())
  res.json(locks)
})

export default router
