// Pygmy CMS — User management routes (admin only)
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { authMiddleware, adminOnly } from '../middleware/auth.js'
import { logActivity } from './activity.js'

const router = Router()
const guard = [authMiddleware, adminOnly]

// GET /api/users — list all users
router.get('/', ...guard, (req, res) => {
  const users = db.prepare(
    'SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY id'
  ).all()
  res.json(users)
})

// POST /api/users — create a new user
router.post('/', ...guard, (req, res) => {
  const { email, name, password, role = 'editor' } = req.body
  if (!email || !name || !password)
    return res.status(400).json({ error: 'email, name and password are required' })
  if (!['admin', 'editor'].includes(role))
    return res.status(400).json({ error: 'role must be admin or editor' })

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ error: 'Email already in use' })

  const hashed = bcrypt.hashSync(password, 10)
  const result = db.prepare(
    'INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)'
  ).run(email, name, hashed, role)

  const newUser = { id: result.lastInsertRowid, email, name, role }
  logActivity(req.user?.id, req.user?.name, 'created user', 'user', newUser.id, `${name} (${email})`)
  res.status(201).json(newUser)
})

// PUT /api/users/:id — update a user (name, email, role, password)
router.put('/:id', ...guard, (req, res) => {
  const id = parseInt(req.params.id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const { email, name, role, password } = req.body
  if (role && !['admin', 'editor'].includes(role))
    return res.status(400).json({ error: 'role must be admin or editor' })

  // If changing email, check uniqueness
  if (email && email !== user.email) {
    const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id)
    if (dup) return res.status(409).json({ error: 'Email already in use' })
  }

  // Can't demote yourself (the requesting admin)
  if (id === req.user.id && role && role !== req.user.role) {
    return res.status(400).json({ error: "You can't change your own role" })
  }

  const updates = {
    email:      email    || user.email,
    name:       name     || user.name,
    role:       role     || user.role,
    password:   password ? bcrypt.hashSync(password, 10) : user.password,
    updated_at: new Date().toISOString(),
  }

  db.prepare(
    'UPDATE users SET email=?, name=?, role=?, password=?, updated_at=? WHERE id=?'
  ).run(updates.email, updates.name, updates.role, updates.password, updates.updated_at, id)

  logActivity(req.user?.id, req.user?.name, 'updated user', 'user', id, updates.name)
  res.json({ id, email: updates.email, name: updates.name, role: updates.role })
})

// DELETE /api/users/:id — remove a user
router.delete('/:id', ...guard, (req, res) => {
  const id = parseInt(req.params.id)
  if (id === req.user.id)
    return res.status(400).json({ error: "You can't delete your own account" })

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  logActivity(req.user?.id, req.user?.name, 'deleted user', 'user', id, user.name)
  res.json({ message: 'User deleted' })
})

export default router
