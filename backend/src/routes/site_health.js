// Pygmy CMS — Site Health Dashboard API (Phase 33)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import fs from 'fs'
import path from 'path'

const router = Router()

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getDirSize(dirPath) {
  try {
    let total = 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSize(fullPath)
      } else {
        try { total += fs.statSync(fullPath).size } catch {}
      }
    }
    return total
  } catch { return 0 }
}

function countUploadsFiles(dirPath) {
  try {
    let count = 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) count += countUploadsFiles(path.join(dirPath, entry.name))
      else count++
    }
    return count
  } catch { return 0 }
}

// GET /api/site-health — full system report
router.get('/', authMiddleware, (req, res) => {
  const checks = []

  // ── Database integrity ────────────────────────────────────────────────────
  try {
    const integ = db.prepare('PRAGMA integrity_check').get()
    checks.push({
      id: 'db_integrity',
      label: 'Database Integrity',
      status: integ?.integrity_check === 'ok' ? 'ok' : 'error',
      message: integ?.integrity_check === 'ok' ? 'SQLite integrity check passed' : `Issue: ${integ?.integrity_check}`,
      icon: '🗄️',
    })
  } catch (e) {
    checks.push({ id: 'db_integrity', label: 'Database Integrity', status: 'error', message: e.message, icon: '🗄️' })
  }

  // ── DB file size ──────────────────────────────────────────────────────────
  try {
    const dbPath = path.join(process.cwd(), '..', 'pygmy.db')
    const exists = fs.existsSync(dbPath)
    const size = exists ? fs.statSync(dbPath).size : 0
    const sizeFmt = formatBytes(size)
    const status = size > 500 * 1024 * 1024 ? 'warn' : 'ok'
    checks.push({
      id: 'db_size',
      label: 'Database Size',
      status,
      message: exists ? `${sizeFmt}${status === 'warn' ? ' — consider archiving old data' : ''}` : 'Database file not found at expected path',
      icon: '💾',
    })
  } catch (e) {
    checks.push({ id: 'db_size', label: 'Database Size', status: 'warn', message: e.message, icon: '💾' })
  }

  // ── Uploads directory ─────────────────────────────────────────────────────
  const uploadsExists = fs.existsSync(UPLOADS_DIR)
  const uploadsSize = uploadsExists ? getDirSize(UPLOADS_DIR) : 0
  const uploadsCount = uploadsExists ? countUploadsFiles(UPLOADS_DIR) : 0
  checks.push({
    id: 'uploads_dir',
    label: 'Uploads Directory',
    status: uploadsExists ? 'ok' : 'warn',
    message: uploadsExists
      ? `${uploadsCount} files — ${formatBytes(uploadsSize)}`
      : 'Uploads directory not found — media uploads may fail',
    icon: '📁',
  })

  // ── Orphaned media records ────────────────────────────────────────────────
  try {
    const mediaRows = db.prepare('SELECT filename FROM media WHERE filename IS NOT NULL').all()
    let orphaned = 0
    for (const row of mediaRows) {
      const fp = path.join(UPLOADS_DIR, row.filename)
      if (!fs.existsSync(fp)) orphaned++
    }
    checks.push({
      id: 'orphaned_media',
      label: 'Orphaned Media Records',
      status: orphaned === 0 ? 'ok' : 'warn',
      message: orphaned === 0
        ? `All ${mediaRows.length} media records have matching files`
        : `${orphaned} media record(s) point to missing files`,
      icon: '🖼️',
    })
  } catch (e) {
    checks.push({ id: 'orphaned_media', label: 'Orphaned Media', status: 'warn', message: e.message, icon: '🖼️' })
  }

  // ── Admin user exists ─────────────────────────────────────────────────────
  const adminCount = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get()?.c ?? 0
  checks.push({
    id: 'admin_user',
    label: 'Admin User',
    status: adminCount > 0 ? 'ok' : 'error',
    message: adminCount > 0 ? `${adminCount} admin user(s) configured` : 'No admin users found!',
    icon: '👤',
  })

  // ── Default password warning ──────────────────────────────────────────────
  const defaultAdmin = db.prepare(`SELECT id FROM users WHERE email = 'admin@pygmy.local'`).get()
  checks.push({
    id: 'default_credentials',
    label: 'Default Credentials',
    status: defaultAdmin ? 'warn' : 'ok',
    message: defaultAdmin
      ? 'Default admin@pygmy.local account still exists — change email and password in Settings'
      : 'Default credentials have been changed',
    icon: '🔑',
  })

  // ── SMTP configured ───────────────────────────────────────────────────────
  const smtpHost = db.prepare(`SELECT value FROM settings WHERE key = 'smtp_host'`).get()?.value || ''
  const smtpUser = db.prepare(`SELECT value FROM settings WHERE key = 'smtp_user'`).get()?.value || ''
  checks.push({
    id: 'smtp',
    label: 'Email / SMTP',
    status: smtpHost && smtpUser ? 'ok' : 'warn',
    message: smtpHost && smtpUser
      ? `SMTP configured: ${smtpHost}`
      : 'SMTP not configured — transactional emails will not be sent',
    icon: '📧',
  })

  // ── Pending content ───────────────────────────────────────────────────────
  const pendingComments = db.prepare(`SELECT COUNT(*) AS c FROM comments WHERE status = 'pending'`).get()?.c ?? 0
  const pendingReviews  = db.prepare(`SELECT COUNT(*) AS c FROM product_reviews WHERE status = 'pending'`).get()?.c ?? 0
  checks.push({
    id: 'pending_moderation',
    label: 'Pending Moderation',
    status: (pendingComments + pendingReviews) > 0 ? 'warn' : 'ok',
    message: (pendingComments + pendingReviews) === 0
      ? 'No content awaiting moderation'
      : `${pendingComments} comment(s) + ${pendingReviews} review(s) need moderation`,
    icon: '💬',
  })

  // ── Scheduled content ─────────────────────────────────────────────────────
  const scheduledPosts = db.prepare(`SELECT COUNT(*) AS c FROM posts  WHERE status = 'scheduled'`).get()?.c ?? 0
  const scheduledPages = db.prepare(`SELECT COUNT(*) AS c FROM pages  WHERE status = 'scheduled'`).get()?.c ?? 0
  checks.push({
    id: 'scheduled_content',
    label: 'Scheduled Content',
    status: 'info',
    message: (scheduledPosts + scheduledPages) === 0
      ? 'No content scheduled'
      : `${scheduledPosts} post(s) + ${scheduledPages} page(s) scheduled for future publish`,
    icon: '⏰',
  })

  // ── Overdue returns ───────────────────────────────────────────────────────
  try {
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='order_returns'`).get()
    if (tableExists) {
      const overdue = db.prepare(`
        SELECT COUNT(*) AS c FROM order_returns
        WHERE status = 'pending'
        AND created_at < datetime('now', '-3 days')
      `).get()?.c ?? 0
      if (overdue > 0) {
        checks.push({ id: 'overdue_returns', label: 'Overdue Returns', status: 'warn', message: `${overdue} return request(s) pending >3 days`, icon: '↩️' })
      }
    }
  } catch {}

  // ── Open urgent support tickets ───────────────────────────────────────────
  try {
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='support_tickets'`).get()
    if (tableExists) {
      const urgent = db.prepare(`
        SELECT COUNT(*) AS c FROM support_tickets WHERE priority = 'urgent' AND status IN ('open','in_progress')
      `).get()?.c ?? 0
      checks.push({
        id: 'urgent_tickets',
        label: 'Urgent Support Tickets',
        status: urgent > 0 ? 'error' : 'ok',
        message: urgent > 0 ? `${urgent} urgent ticket(s) need immediate attention` : 'No open urgent tickets',
        icon: '🎫',
      })
    }
  } catch {}

  // ── JWT secret strength ───────────────────────────────────────────────────
  const jwtSecret = process.env.JWT_SECRET || 'pygmy-secret-key'
  const isDefaultSecret = jwtSecret === 'pygmy-secret-key'
  checks.push({
    id: 'jwt_secret',
    label: 'JWT Secret',
    status: isDefaultSecret ? 'warn' : 'ok',
    message: isDefaultSecret
      ? 'Using default JWT secret — set JWT_SECRET env variable for production'
      : 'Custom JWT_SECRET is configured',
    icon: '🔐',
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  const errorCount = checks.filter(c => c.status === 'error').length
  const warnCount  = checks.filter(c => c.status === 'warn').length
  const okCount    = checks.filter(c => c.status === 'ok' || c.status === 'info').length
  const overall    = errorCount > 0 ? 'error' : warnCount > 0 ? 'warn' : 'ok'

  // Content stats summary
  const stats = {
    posts:       db.prepare(`SELECT COUNT(*) AS c FROM posts`).get()?.c ?? 0,
    pages:       db.prepare(`SELECT COUNT(*) AS c FROM pages`).get()?.c ?? 0,
    products:    db.prepare(`SELECT COUNT(*) AS c FROM products`).get()?.c ?? 0,
    media:       db.prepare(`SELECT COUNT(*) AS c FROM media`).get()?.c ?? 0,
    users:       db.prepare(`SELECT COUNT(*) AS c FROM users`).get()?.c ?? 0,
    orders:      db.prepare(`SELECT COUNT(*) AS c FROM orders`).get()?.c ?? 0,
    customers:   db.prepare(`SELECT COUNT(*) AS c FROM customers`).get()?.c ?? 0,
    subscribers: db.prepare(`SELECT COUNT(*) AS c FROM subscribers WHERE status = 'active'`).get()?.c ?? 0,
  }

  res.json({
    overall,
    checks,
    summary: { errors: errorCount, warnings: warnCount, passing: okCount },
    stats,
    checked_at: new Date().toISOString(),
  })
})

export default router
