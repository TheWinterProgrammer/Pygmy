// Pygmy CMS — Admin Notification Center
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/notifications/count — badge totals only (fast)
router.get('/count', authMiddleware, (req, res) => {
  const comments = db.prepare(
    `SELECT COUNT(*) as n FROM comments WHERE status = 'pending'`
  ).get().n

  const contact = db.prepare(
    `SELECT COUNT(*) as n FROM form_submissions WHERE status = 'unread'`
  ).get().n

  // custom form submissions unread
  const forms = db.prepare(
    `SELECT COUNT(*) as n FROM custom_form_submissions WHERE status = 'unread'`
  ).get().n

  const total = comments + contact + forms
  res.json({ total, comments, contact, forms })
})

// GET /api/notifications — recent items for the dropdown (last 15)
router.get('/', authMiddleware, (req, res) => {
  const commentItems = db.prepare(`
    SELECT
      c.id,
      'comment' AS type,
      c.author_name AS title,
      c.content AS body,
      c.post_id AS ref_id,
      p.title AS ref_label,
      c.created_at
    FROM comments c
    LEFT JOIN posts p ON p.id = c.post_id
    WHERE c.status = 'pending'
    ORDER BY c.created_at DESC
    LIMIT 5
  `).all()

  const contactItems = db.prepare(`
    SELECT
      id,
      'contact' AS type,
      name AS title,
      subject AS body,
      NULL AS ref_id,
      NULL AS ref_label,
      created_at
    FROM form_submissions
    WHERE status = 'unread'
    ORDER BY created_at DESC
    LIMIT 5
  `).all()

  const formItems = db.prepare(`
    SELECT
      s.id,
      'form' AS type,
      f.name AS title,
      s.created_at AS body,
      f.id AS ref_id,
      f.name AS ref_label,
      s.created_at
    FROM custom_form_submissions s
    JOIN custom_forms f ON f.id = s.form_id
    WHERE s.status = 'unread'
    ORDER BY s.created_at DESC
    LIMIT 5
  `).all()

  // Merge and sort by date, newest first, cap at 15
  const all = [...commentItems, ...contactItems, ...formItems]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 15)

  res.json(all)
})

export default router
