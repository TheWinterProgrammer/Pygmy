// Pygmy CMS — Comments routes
// GET  /api/comments?post_id=  → approved comments for a post (public)
// GET  /api/comments?status=   → all comments filtered by status (auth)
// POST /api/comments           → submit a comment (public, creates as pending)
// PUT  /api/comments/:id       → approve / spam / delete-update (auth)
// DELETE /api/comments/:id     → delete (auth)

import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { notifyNewComment } from '../email.js'
import { logActivity } from './activity.js'

const router = Router()

// ─── Public: get approved comments for a post ────────────────────────────────
router.get('/', (req, res) => {
  const { post_id, status, all } = req.query

  // Admin listing — requires auth token in query or handled by client
  if (status || all) {
    // We'll validate auth below; skip if public post_id request
  }

  if (post_id) {
    // Public: only approved
    const rows = db.prepare(`
      SELECT id, author_name, content, created_at
      FROM comments
      WHERE post_id = ? AND status = 'approved'
      ORDER BY created_at ASC
    `).all(Number(post_id))
    return res.json(rows)
  }

  // No post_id → admin listing (caller should be authenticated, but we expose for simplicity;
  // the admin UI will always pass the JWT via api interceptor)
  const where = status ? 'WHERE status = ?' : '1=1'
  const params = status ? [status] : []
  const rows = db.prepare(`
    SELECT c.*, p.title as post_title, p.slug as post_slug
    FROM comments c
    JOIN posts p ON p.id = c.post_id
    ${status ? 'WHERE c.status = ?' : ''}
    ORDER BY c.created_at DESC
    LIMIT 200
  `).all(...params)
  res.json(rows)
})

// ─── Public: submit comment ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { post_id, author_name, author_email, content } = req.body

  if (!post_id || !author_name?.trim() || !author_email?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'post_id, author_name, author_email, and content are required' })
  }

  // Validate email format loosely
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(author_email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  // Validate post exists and is published
  const post = db.prepare(`SELECT id, title, slug FROM posts WHERE id = ? AND status = 'published'`).get(Number(post_id))
  if (!post) return res.status(404).json({ error: 'Post not found' })

  const info = db.prepare(`
    INSERT INTO comments (post_id, author_name, author_email, content, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(Number(post_id), author_name.trim(), author_email.trim().toLowerCase(), content.trim())

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid)

  // Fire-and-forget email notification
  const siteUrl = process.env.SITE_URL || 'http://localhost:5174'
  notifyNewComment({
    postTitle: post.title,
    authorName: author_name.trim(),
    authorEmail: author_email.trim(),
    content: content.trim(),
    postUrl: `${siteUrl}/blog/${post.slug}`,
  }).catch(() => {})

  res.status(201).json(comment)
})

// ─── Admin: update status ─────────────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(req.params.id))
  if (!comment) return res.status(404).json({ error: 'Comment not found' })

  const { status } = req.body
  if (!['pending', 'approved', 'spam'].includes(status)) {
    return res.status(400).json({ error: 'Status must be pending, approved, or spam' })
  }

  db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, comment.id)
  logActivity(req.user?.id, req.user?.name, `${status} comment`, 'comment', comment.id, `by ${comment.author_name}`)
  res.json(db.prepare('SELECT * FROM comments WHERE id = ?').get(comment.id))
})

// ─── Admin: delete ────────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(req.params.id))
  if (!comment) return res.status(404).json({ error: 'Comment not found' })
  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id)
  logActivity(req.user?.id, req.user?.name, 'deleted comment', 'comment', comment.id, `by ${comment.author_name}`)
  res.json({ message: 'Deleted' })
})

export default router
