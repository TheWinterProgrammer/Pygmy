// Pygmy CMS — Settings routes
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendTestEmail } from '../email.js'

const router = Router()

// GET /api/settings — public (needed for frontend to render site name, hero, etc.)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const result = {}
  rows.forEach(r => result[r.key] = r.value)
  res.json(result)
})

// PUT /api/settings — batch update (auth)
router.put('/', authMiddleware, (req, res) => {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `)
  const tx = db.transaction((pairs) => {
    for (const [key, value] of pairs) {
      upsert.run(key, String(value))
    }
  })
  tx(Object.entries(req.body))
  res.json({ message: 'Settings saved' })
})

// PUT /api/settings/:key (auth)
router.put('/:key', authMiddleware, (req, res) => {
  const { value } = req.body
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(req.params.key, String(value))
  res.json({ key: req.params.key, value })
})

// POST /api/settings/test-email — send a test email to configured notify_email (auth)
router.post('/test-email', authMiddleware, async (req, res) => {
  try {
    await sendTestEmail()
    res.json({ message: 'Test email sent! Check your inbox.' })
  } catch (err) {
    res.status(500).json({ error: `Failed to send: ${err.message}` })
  }
})

export default router
