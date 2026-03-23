// Pygmy CMS — Comments routes
// GET  /api/comments?post_id=  → approved comments (threaded) for a post (public)
// GET  /api/comments?status=   → all comments filtered by status (auth)
// POST /api/comments           → submit a comment / reply (public, creates as pending)
// PUT  /api/comments/:id       → approve / spam / delete-update (auth)
// DELETE /api/comments/:id     → delete (auth)

import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { notifyNewComment } from '../email.js'
import { logActivity } from './activity.js'

const router = Router()

// ─── Public: get approved comments for a post (threaded) ──────────────────────
router.get('/', (req, res) => {
  const { post_id, status, all } = req.query

  if (post_id) {
    // Public: only approved, include parent_id for threading
    const rows = db.prepare(`
      SELECT id, parent_id, author_name, content, created_at, liked_count
      FROM comments
      WHERE post_id = ? AND status = 'approved'
      ORDER BY created_at ASC
    `).all(Number(post_id))

    // Build tree structure: top-level comments + their replies
    const topLevel = rows.filter(c => !c.parent_id)
    const replies = rows.filter(c => c.parent_id)
    const replyMap = {}
    for (const r of replies) {
      if (!replyMap[r.parent_id]) replyMap[r.parent_id] = []
      replyMap[r.parent_id].push(r)
    }
    const threaded = topLevel.map(c => ({ ...c, replies: replyMap[c.id] || [] }))
    return res.json(threaded)
  }

  // Admin listing
  const where = status ? 'WHERE c.status = ?' : ''
  const params = status ? [status] : []
  const rows = db.prepare(`
    SELECT c.*, p.title as post_title, p.slug as post_slug
    FROM comments c
    JOIN posts p ON p.id = c.post_id
    ${where}
    ORDER BY c.created_at DESC
    LIMIT 200
  `).all(...params)
  res.json(rows)
})

// ─── Public: submit comment or reply ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const { post_id, parent_id, author_name, author_email, content } = req.body

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

  // Validate parent comment if replying
  if (parent_id) {
    const parent = db.prepare(`SELECT id FROM comments WHERE id = ? AND post_id = ? AND status = 'approved'`).get(Number(parent_id), Number(post_id))
    if (!parent) return res.status(400).json({ error: 'Parent comment not found or not approved' })
  }

  const info = db.prepare(`
    INSERT INTO comments (post_id, parent_id, author_name, author_email, content, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(Number(post_id), parent_id ? Number(parent_id) : null, author_name.trim(), author_email.trim().toLowerCase(), content.trim())

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid)

  // Fire-and-forget email notification
  const siteUrl = process.env.SITE_URL || 'http://localhost:5174'
  notifyNewComment({
    postTitle: post.title,
    authorName: author_name.trim(),
    authorEmail: author_email.trim(),
    content: content.trim(),
    postUrl: `${siteUrl}/blog/${post.slug}`,
    isReply: !!parent_id,
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
