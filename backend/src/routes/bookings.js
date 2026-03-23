// Pygmy CMS — Appointment / Booking System (Phase 46)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseService(s) {
  if (!s) return null
  return { ...s, gallery: safeJSON(s.gallery, []) }
}

function safeJSON(v, fallback) {
  try { return JSON.parse(v || 'null') ?? fallback } catch { return fallback }
}

/**
 * Generate all possible time slots for a given date + service
 * based on weekly_availability rows.
 */
function getSlotsForDate(serviceId, dateStr) {
  const d = new Date(dateStr)
  const dow = d.getDay() // 0=Sun … 6=Sat

  const avail = db.prepare(`
    SELECT * FROM booking_availability
    WHERE service_id = ? AND day_of_week = ? AND available = 1
  `).all(serviceId, dow)

  if (!avail.length) return []

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId)
  if (!service) return []

  const slotDuration = service.duration_min + (service.buffer_min || 0)
  const slots = []

  for (const row of avail) {
    const [sh, sm] = row.start_time.split(':').map(Number)
    const [eh, em] = row.end_time.split(':').map(Number)
    let cur = sh * 60 + sm
    const end = eh * 60 + em

    while (cur + service.duration_min <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, '0')
      const mm = String(cur % 60).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
      cur += slotDuration
    }
  }

  // Remove already-booked slots
  const booked = db.prepare(`
    SELECT time_slot FROM bookings
    WHERE service_id = ? AND booking_date = ? AND status NOT IN ('cancelled')
  `).all(serviceId, dateStr).map(b => b.time_slot)

  return slots.filter(s => !booked.includes(s))
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: List active services
// ─────────────────────────────────────────────────────────────────────────────
router.get('/services/public', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, slug, description, duration_min, price, cover_image, gallery, category
    FROM services WHERE active = 1 ORDER BY sort_order, name
  `).all()
  res.json(rows.map(parseService))
})

// PUBLIC: Get availability for a service on a specific date
router.get('/availability', (req, res) => {
  const { service_id, date } = req.query
  if (!service_id || !date) return res.status(400).json({ error: 'service_id and date required' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format, use YYYY-MM-DD' })

  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(service_id)
  if (!service) return res.status(404).json({ error: 'Service not found' })

  const slots = getSlotsForDate(Number(service_id), date)
  res.json({ service_id: Number(service_id), date, slots })
})

// PUBLIC: Get available dates in a month (for calendar highlighting)
router.get('/available-dates', (req, res) => {
  const { service_id, year, month } = req.query
  if (!service_id || !year || !month) return res.status(400).json({ error: 'service_id, year and month required' })

  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(service_id)
  if (!service) return res.status(404).json({ error: 'Service not found' })

  // Get the days of week that have availability
  const availDows = db.prepare(`
    SELECT DISTINCT day_of_week FROM booking_availability
    WHERE service_id = ? AND available = 1
  `).all(service_id).map(r => r.day_of_week)

  const y = parseInt(year)
  const m = parseInt(month) - 1 // 0-indexed for Date
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const today = new Date(); today.setHours(0,0,0,0)
  const availableDates = []

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, m, d)
    if (dt < today) continue
    if (availDows.includes(dt.getDay())) {
      // Quick check — does it have any unbooked slots?
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const slots = getSlotsForDate(Number(service_id), dateStr)
      if (slots.length > 0) availableDates.push(dateStr)
    }
  }

  res.json({ service_id: Number(service_id), year: y, month: parseInt(month), available_dates: availableDates })
})

// PUBLIC: Create booking
router.post('/', (req, res) => {
  const { service_id, booking_date, time_slot, customer_name, customer_email, customer_phone, notes } = req.body
  if (!service_id || !booking_date || !time_slot || !customer_name || !customer_email) {
    return res.status(400).json({ error: 'service_id, booking_date, time_slot, customer_name, customer_email required' })
  }

  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(service_id)
  if (!service) return res.status(404).json({ error: 'Service not found' })

  const slots = getSlotsForDate(service_id, booking_date)
  if (!slots.includes(time_slot)) {
    return res.status(409).json({ error: 'This time slot is not available. Please choose another.' })
  }

  // Generate reference
  const ref = 'BKG-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()

  const result = db.prepare(`
    INSERT INTO bookings
      (service_id, booking_date, time_slot, duration_min, customer_name, customer_email, customer_phone, notes, reference, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(service_id, booking_date, time_slot, service.duration_min, customer_name, customer_email, customer_phone || '', notes || '', ref)

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid)

  // Send confirmation email
  const settings = db.prepare('SELECT key, value FROM settings').all().reduce((o, r) => { o[r.key] = r.value; return o }, {})
  const smtpOk = settings.smtp_host && settings.smtp_user
  if (smtpOk && customer_email) {
    const siteUrl = settings.site_url || 'http://localhost:5174'
    sendMailTo(customer_email, `Booking Confirmed — ${service.name}`, `
      <h2>Your booking is confirmed!</h2>
      <p>Hi ${customer_name},</p>
      <p>We've received your booking for <strong>${service.name}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #444"><strong>Date</strong></td><td style="padding:8px;border:1px solid #444">${booking_date}</td></tr>
        <tr><td style="padding:8px;border:1px solid #444"><strong>Time</strong></td><td style="padding:8px;border:1px solid #444">${time_slot}</td></tr>
        <tr><td style="padding:8px;border:1px solid #444"><strong>Duration</strong></td><td style="padding:8px;border:1px solid #444">${service.duration_min} minutes</td></tr>
        <tr><td style="padding:8px;border:1px solid #444"><strong>Reference</strong></td><td style="padding:8px;border:1px solid #444">${ref}</td></tr>
      </table>
      <p>To manage your booking, visit: <a href="${siteUrl}/booking/${ref}">${siteUrl}/booking/${ref}</a></p>
    `).catch(() => {})
  }

  res.status(201).json({ booking, reference: ref })
})

// PUBLIC: Get booking by reference
router.get('/confirm/:ref', (req, res) => {
  const booking = db.prepare(`
    SELECT b.*, s.name as service_name, s.duration_min as service_duration, s.price as service_price
    FROM bookings b JOIN services s ON s.id = b.service_id
    WHERE b.reference = ?
  `).get(req.params.ref)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  res.json(booking)
})

// PUBLIC: Cancel booking by reference
router.post('/cancel/:ref', (req, res) => {
  const { email } = req.body
  const booking = db.prepare('SELECT * FROM bookings WHERE reference = ?').get(req.params.ref)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (booking.customer_email.toLowerCase() !== (email || '').toLowerCase()) {
    return res.status(403).json({ error: 'Email address does not match this booking.' })
  }
  if (booking.status === 'cancelled') return res.status(400).json({ error: 'Booking already cancelled.' })

  db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(booking.id)
  res.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Services CRUD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/services', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM bookings b WHERE b.service_id = s.id AND b.status NOT IN ('cancelled')) as booking_count,
      (SELECT COUNT(*) FROM bookings b WHERE b.service_id = s.id AND b.status = 'pending') as pending_count
    FROM services s ORDER BY s.sort_order, s.name
  `).all()
  res.json(rows.map(parseService))
})

router.post('/services', auth, (req, res) => {
  const { name, slug, description, duration_min, price, buffer_min, max_per_slot, cover_image, gallery, category, sort_order, active } = req.body
  if (!name || !duration_min) return res.status(400).json({ error: 'name and duration_min required' })
  const s = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const r = db.prepare(`
    INSERT INTO services (name, slug, description, duration_min, price, buffer_min, max_per_slot, cover_image, gallery, category, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, s, description || '', duration_min, price || 0, buffer_min || 0, max_per_slot || 1, cover_image || '', JSON.stringify(gallery || []), category || '', sort_order || 0, active !== false ? 1 : 0)
  res.status(201).json(db.prepare('SELECT * FROM services WHERE id = ?').get(r.lastInsertRowid))
})

router.put('/services/:id', auth, (req, res) => {
  const { name, slug, description, duration_min, price, buffer_min, max_per_slot, cover_image, gallery, category, sort_order, active } = req.body
  const svc = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id)
  if (!svc) return res.status(404).json({ error: 'Service not found' })
  db.prepare(`
    UPDATE services SET name=?, slug=?, description=?, duration_min=?, price=?, buffer_min=?, max_per_slot=?,
    cover_image=?, gallery=?, category=?, sort_order=?, active=?, updated_at=datetime('now') WHERE id=?
  `).run(name, slug, description || '', duration_min, price || 0, buffer_min || 0, max_per_slot || 1, cover_image || '', JSON.stringify(gallery || []), category || '', sort_order || 0, active !== false ? 1 : 0, req.params.id)
  res.json(parseService(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)))
})

router.delete('/services/:id', auth, (req, res) => {
  const svc = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id)
  if (!svc) return res.status(404).json({ error: 'Service not found' })
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Availability CRUD (weekly schedule per service)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/services/:id/availability', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM booking_availability WHERE service_id = ? ORDER BY day_of_week, start_time').all(req.params.id)
  res.json(rows)
})

router.put('/services/:id/availability', auth, (req, res) => {
  // Replace the entire weekly schedule for a service
  const { schedule } = req.body // array of { day_of_week, start_time, end_time, available }
  if (!Array.isArray(schedule)) return res.status(400).json({ error: 'schedule must be an array' })

  const svcId = parseInt(req.params.id)
  db.prepare('DELETE FROM booking_availability WHERE service_id = ?').run(svcId)

  const ins = db.prepare(`INSERT INTO booking_availability (service_id, day_of_week, start_time, end_time, available) VALUES (?, ?, ?, ?, ?)`)
  for (const row of schedule) {
    ins.run(svcId, row.day_of_week, row.start_time, row.end_time, row.available ? 1 : 0)
  }
  res.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Blocked dates (holidays, closures)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/blocked-dates', auth, (req, res) => {
  const { service_id } = req.query
  const sql = service_id
    ? 'SELECT * FROM booking_blocked_dates WHERE service_id = ? ORDER BY blocked_date'
    : 'SELECT * FROM booking_blocked_dates ORDER BY blocked_date'
  res.json(service_id ? db.prepare(sql).all(service_id) : db.prepare(sql).all())
})

router.post('/blocked-dates', auth, (req, res) => {
  const { service_id, blocked_date, reason } = req.body
  if (!blocked_date) return res.status(400).json({ error: 'blocked_date required' })
  const r = db.prepare(`INSERT OR IGNORE INTO booking_blocked_dates (service_id, blocked_date, reason) VALUES (?, ?, ?)`)
    .run(service_id || null, blocked_date, reason || '')
  res.status(201).json({ id: r.lastInsertRowid, service_id: service_id || null, blocked_date, reason: reason || '' })
})

router.delete('/blocked-dates/:id', auth, (req, res) => {
  db.prepare('DELETE FROM booking_blocked_dates WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Bookings list + management
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { service_id, status, date_from, date_to, q, limit = 50, offset = 0 } = req.query
  let where = 'WHERE 1=1'
  const params = []
  if (service_id) { where += ' AND b.service_id = ?'; params.push(service_id) }
  if (status) { where += ' AND b.status = ?'; params.push(status) }
  if (date_from) { where += ' AND b.booking_date >= ?'; params.push(date_from) }
  if (date_to) { where += ' AND b.booking_date <= ?'; params.push(date_to) }
  if (q) { where += ' AND (b.customer_name LIKE ? OR b.customer_email LIKE ? OR b.reference LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }

  const total = db.prepare(`SELECT COUNT(*) as n FROM bookings b ${where}`).get(...params).n
  const rows = db.prepare(`
    SELECT b.*, s.name as service_name, s.price as service_price
    FROM bookings b JOIN services s ON s.id = b.service_id
    ${where} ORDER BY b.booking_date DESC, b.time_slot DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset))

  res.json({ bookings: rows, total })
})

router.get('/stats', auth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const stats = {
    total:      db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status != 'cancelled'").get().n,
    pending:    db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status = 'pending'").get().n,
    confirmed:  db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status = 'confirmed'").get().n,
    today:      db.prepare("SELECT COUNT(*) as n FROM bookings WHERE booking_date = ? AND status != 'cancelled'").get(today).n,
    this_week:  db.prepare(`SELECT COUNT(*) as n FROM bookings WHERE booking_date BETWEEN ? AND date(?, '+6 days') AND status != 'cancelled'`).get(today, today).n,
    revenue:    db.prepare(`SELECT COALESCE(SUM(s.price),0) as rev FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.status='completed'`).get().rev,
    services:   db.prepare("SELECT COUNT(*) as n FROM services WHERE active = 1").get().n,
  }
  res.json(stats)
})

router.put('/:id', auth, (req, res) => {
  const { status, notes, admin_notes } = req.body
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  db.prepare(`UPDATE bookings SET status=COALESCE(?,status), notes=COALESCE(?,notes), admin_notes=COALESCE(?,admin_notes), updated_at=datetime('now') WHERE id=?`)
    .run(status || null, notes || null, admin_notes || null, req.params.id)

  // Notify customer on status change
  if (status && status !== booking.status) {
    const settings = db.prepare('SELECT key, value FROM settings').all().reduce((o, r) => { o[r.key] = r.value; return o }, {})
    if (settings.smtp_host && settings.smtp_user) {
      const service = db.prepare('SELECT name FROM services WHERE id = ?').get(booking.service_id)
      const label = { confirmed: 'Confirmed ✅', cancelled: 'Cancelled ❌', completed: 'Completed 🎉' }[status] || status
      sendMailTo(booking.customer_email, `Booking ${label} — ${service?.name || ''}`, `
        <p>Hi ${booking.customer_name},</p>
        <p>Your booking for <strong>${service?.name}</strong> on ${booking.booking_date} at ${booking.time_slot} has been <strong>${status}</strong>.</p>
        <p>Reference: ${booking.reference}</p>
      `).catch(() => {})
    }
  }

  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id))
})

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
