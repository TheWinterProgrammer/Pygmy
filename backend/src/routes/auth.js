// Pygmy CMS — Auth routes
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { signToken, authMiddleware } from '../middleware/auth.js'

const router = Router()

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user)
    return res.status(401).json({ error: 'Invalid credentials' })

  const valid = bcrypt.compareSync(password, user.password)
  if (!valid)
    return res.status(401).json({ error: 'Invalid credentials' })

  const token = signToken({ id: user.id, email: user.email, role: user.role })
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  })
})

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(user)
})

// PUT /api/auth/me — update profile
router.put('/me', authMiddleware, (req, res) => {
  const { name, email, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const updates = {
    name: name || user.name,
    email: email || user.email,
    password: password ? bcrypt.hashSync(password, 10) : user.password,
    updated_at: new Date().toISOString()
  }

  db.prepare('UPDATE users SET name=?, email=?, password=?, updated_at=? WHERE id=?')
    .run(updates.name, updates.email, updates.password, updates.updated_at, user.id)

  res.json({ message: 'Profile updated' })
})

export default router
