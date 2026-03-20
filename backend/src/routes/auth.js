// Pygmy CMS — Auth routes (with optional TOTP 2FA)
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import db from '../db.js'
import { signToken, authMiddleware } from '../middleware/auth.js'

const router = Router()

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password, otp } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = bcrypt.compareSync(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  // 2FA check
  if (user.totp_enabled) {
    if (!otp) {
      // Password correct but 2FA required — tell client to prompt for OTP
      return res.status(206).json({ requires_2fa: true })
    }
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: otp,
      window: 1
    })
    if (!verified) return res.status(401).json({ error: 'Invalid 2FA code' })
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role })
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  })
})

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, name, role, totp_enabled, created_at FROM users WHERE id = ?'
  ).get(req.user.id)
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

// GET /api/auth/2fa/setup — generate a new TOTP secret + QR code
router.get('/2fa/setup', authMiddleware, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const secret = speakeasy.generateSecret({ name: `Pygmy CMS (${user.email})`, length: 20 })

  // Persist secret (not yet enabled — needs verification first)
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret.base32, user.id)

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url)
  res.json({ secret: secret.base32, qr: qrDataUrl })
})

// POST /api/auth/2fa/enable — verify token and activate 2FA
router.post('/2fa/enable', authMiddleware, (req, res) => {
  const { token } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user || !user.totp_secret)
    return res.status(400).json({ error: '2FA setup not started' })

  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token,
    window: 1
  })
  if (!verified) return res.status(400).json({ error: 'Invalid code — please try again' })

  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id)
  res.json({ message: '2FA enabled' })
})

// POST /api/auth/2fa/disable — disable 2FA (requires current OTP or password)
router.post('/2fa/disable', authMiddleware, (req, res) => {
  const { token, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  if (!user.totp_enabled) return res.status(400).json({ error: '2FA not enabled' })

  // Allow disable via OTP or current password
  if (token) {
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token,
      window: 1
    })
    if (!verified) return res.status(400).json({ error: 'Invalid 2FA code' })
  } else if (password) {
    if (!bcrypt.compareSync(password, user.password))
      return res.status(400).json({ error: 'Invalid password' })
  } else {
    return res.status(400).json({ error: 'Provide current OTP or password' })
  }

  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(user.id)
  res.json({ message: '2FA disabled' })
})

export default router
