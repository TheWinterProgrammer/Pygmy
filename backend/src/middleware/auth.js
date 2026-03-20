// Pygmy CMS — JWT auth middleware
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import db from '../db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'pygmy-dev-secret-change-in-production'

function hashApiKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function authMiddleware(req, res, next) {
  // ── 1. Try JWT Bearer token ────────────────────────────────────────────────
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7)
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      req.user = payload
      req.authMethod = 'jwt'
      return next()
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
  }

  // ── 2. Try X-Api-Key header ────────────────────────────────────────────────
  const rawKey = req.headers['x-api-key']
  if (rawKey) {
    const keyHash = hashApiKey(rawKey)
    const row = db.prepare(`
      SELECT ak.*, u.email, u.name as user_name, u.role
      FROM api_keys ak
      LEFT JOIN users u ON u.id = ak.created_by
      WHERE ak.key_hash = ? AND ak.active = 1
    `).get(keyHash)

    if (!row) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    // Scope check: write scope needed for mutating methods
    const scopes = JSON.parse(row.scopes || '["read"]')
    const method = req.method.toUpperCase()
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    if (isMutation && !scopes.includes('write')) {
      return res.status(403).json({ error: 'API key does not have write scope' })
    }

    // Update last_used_at asynchronously (best-effort)
    try {
      db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
        .run(new Date().toISOString(), row.id)
    } catch {}

    req.user = {
      id: row.created_by,
      email: row.email || '',
      name: row.user_name || 'API Key',
      role: row.role || 'admin',
    }
    req.authMethod = 'api_key'
    req.apiKeyId = row.id
    return next()
  }

  // ── 3. No credentials found ────────────────────────────────────────────────
  return res.status(401).json({ error: 'No token provided' })
}

/** Only allow users with role === 'admin'. Must be used AFTER authMiddleware. */
export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
