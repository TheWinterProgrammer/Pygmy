// Pygmy CMS — Customer CSV Import API
import { Router } from 'express'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (!lines.length) return []

  function parseLine(line) {
    const fields = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        let val = ''
        i++
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2 }
          else if (line[i] === '"') { i++; break }
          else { val += line[i++] }
        }
        fields.push(val)
        if (line[i] === ',') i++
      } else {
        const end = line.indexOf(',', i)
        if (end === -1) { fields.push(line.slice(i)); break }
        fields.push(line.slice(i, end))
        i = end + 1
      }
    }
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const results = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, idx) => { row[h] = values[idx]?.trim() || '' })
    results.push(row)
  }
  return results
}

// POST /api/customer-import — import customers from CSV
router.post('/', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const mode = req.query.mode || 'merge' // merge | skip
  const text = req.file.buffer.toString('utf-8')
  const rows = parseCSV(text)

  if (!rows.length) return res.status(400).json({ error: 'CSV is empty or unreadable' })

  const normalize = (row) => ({
    email:      row.email || row.email_address || '',
    first_name: row.first_name || row.firstname || row.first || '',
    last_name:  row.last_name  || row.lastname  || row.last  || '',
    phone:      row.phone      || row.phone_number || '',
    active:     row.active !== undefined ? (row.active === '0' ? 0 : 1) : 1,
    notes:      row.notes || row.note || '',
  })

  let created = 0, updated = 0, skipped = 0
  const errors = []

  const findByEmail  = db.prepare(`SELECT id FROM customers WHERE email = ?`)
  const insertCustomer = db.prepare(`
    INSERT INTO customers (email, first_name, last_name, phone, active, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `)
  const updateCustomer = db.prepare(`
    UPDATE customers SET first_name = ?, last_name = ?, phone = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `)

  const defaultHash = bcrypt.hashSync('ChangeMe123!', 10)

  for (let i = 0; i < rows.length; i++) {
    const c = normalize(rows[i])

    if (!c.email || !c.email.includes('@')) {
      errors.push({ row: i + 2, email: c.email || '(empty)', error: 'Invalid or missing email' })
      skipped++
      continue
    }

    try {
      const existing = findByEmail.get(c.email)
      if (existing) {
        if (mode === 'merge') {
          updateCustomer.run(c.first_name, c.last_name, c.phone, c.active, existing.id)
          updated++
        } else {
          skipped++
        }
      } else {
        insertCustomer.run(c.email, c.first_name, c.last_name, c.phone, c.active, defaultHash)
        created++
      }
    } catch (err) {
      errors.push({ row: i + 2, email: c.email, error: err.message })
      skipped++
    }
  }

  res.json({ ok: true, total: rows.length, created, updated, skipped, errors: errors.slice(0, 50) })
})

// GET /api/customer-import/template — download CSV template
router.get('/template', auth, (req, res) => {
  const header = 'email,first_name,last_name,phone,active,notes'
  const sample = 'john@example.com,John,Doe,+1234567890,1,'
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="customers-import-template.csv"')
  res.send([header, sample].join('\n'))
})

export default router
