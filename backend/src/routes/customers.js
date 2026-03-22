// Pygmy CMS — Customer Accounts API
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { authMiddleware, adminOnly } from '../middleware/auth.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'pygmy-dev-secret-change-in-production'
const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || 'pygmy-customer-secret-change-in-production'

function signCustomerToken(customer) {
  return jwt.sign(
    { id: customer.id, email: customer.email, role: 'customer' },
    CUSTOMER_JWT_SECRET,
    { expiresIn: '30d' }
  )
}

function customerAuthMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  try {
    const payload = jwt.verify(header.slice(7), CUSTOMER_JWT_SECRET)
    if (payload.role !== 'customer') throw new Error('Not a customer token')
    req.customer = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── Public: Register ──────────────────────────────────────────────────────────
// POST /api/customers/register
router.post('/register', async (req, res) => {
  const { email, password, first_name = '', last_name = '', phone = '' } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email.toLowerCase())
  if (existing) return res.status(409).json({ error: 'Email already registered' })

  const hash = await bcrypt.hash(password, 10)
  const result = db.prepare(`
    INSERT INTO customers (email, password, first_name, last_name, phone)
    VALUES (?, ?, ?, ?, ?)
  `).run(email.toLowerCase(), hash, first_name, last_name, phone)

  const customer = db.prepare('SELECT id, email, first_name, last_name, phone, created_at FROM customers WHERE id = ?').get(result.lastInsertRowid)
  const token = signCustomerToken(customer)
  res.status(201).json({ token, customer })
})

// ─── Public: Login ─────────────────────────────────────────────────────────────
// POST /api/customers/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email.toLowerCase())
  if (!customer || !customer.active) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, customer.password)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const token = signCustomerToken(customer)
  const { password: _, ...safe } = customer
  res.json({ token, customer: safe })
})

// ─── Customer: Get own profile ─────────────────────────────────────────────────
// GET /api/customers/me
router.get('/me', customerAuthMiddleware, (req, res) => {
  const customer = db.prepare('SELECT id, email, first_name, last_name, phone, created_at, updated_at FROM customers WHERE id = ?').get(req.customer.id)
  if (!customer) return res.status(404).json({ error: 'Account not found' })
  res.json(customer)
})

// ─── Customer: Update own profile ─────────────────────────────────────────────
// PUT /api/customers/me
router.put('/me', customerAuthMiddleware, async (req, res) => {
  const { first_name, last_name, phone, password, new_password } = req.body
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customer.id)
  if (!customer) return res.status(404).json({ error: 'Account not found' })

  let passwordHash = customer.password
  if (new_password) {
    if (!password) return res.status(400).json({ error: 'Current password required to change password' })
    const valid = await bcrypt.compare(password, customer.password)
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' })
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
    passwordHash = await bcrypt.hash(new_password, 10)
  }

  db.prepare(`
    UPDATE customers SET
      first_name = ?, last_name = ?, phone = ?, password = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(first_name ?? customer.first_name, last_name ?? customer.last_name, phone ?? customer.phone, passwordHash, customer.id)

  const updated = db.prepare('SELECT id, email, first_name, last_name, phone, created_at, updated_at FROM customers WHERE id = ?').get(customer.id)
  res.json(updated)
})

// ─── Customer: Get own orders ──────────────────────────────────────────────────
// GET /api/customers/me/orders
router.get('/me/orders', customerAuthMiddleware, (req, res) => {
  const orders = db.prepare(`
    SELECT id, order_number, status, total, items, created_at, subtotal,
           shipping_address, shipping_country, shipping_rate_name, shipping_cost,
           coupon_code, discount_amount,
           tracking_number, tracking_carrier, tracking_url, shipped_at
    FROM orders
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).all(req.customer.id)

  const parsed = orders.map(o => ({
    ...o,
    items: JSON.parse(o.items || '[]')
  }))
  res.json(parsed)
})

// ─── Customer: Get single order ────────────────────────────────────────────────
// GET /api/customers/me/orders/:orderNumber
router.get('/me/orders/:orderNumber', customerAuthMiddleware, (req, res) => {
  const order = db.prepare(`
    SELECT * FROM orders WHERE order_number = ? AND customer_id = ?
  `).get(req.params.orderNumber, req.customer.id)

  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json({ ...order, items: JSON.parse(order.items || '[]') })
})

// ─── Customer: List addresses ──────────────────────────────────────────────────
// GET /api/customers/me/addresses
router.get('/me/addresses', customerAuthMiddleware, (req, res) => {
  const addresses = db.prepare('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id ASC').all(req.customer.id)
  res.json(addresses)
})

// ─── Customer: Add address ─────────────────────────────────────────────────────
// POST /api/customers/me/addresses
router.post('/me/addresses', customerAuthMiddleware, (req, res) => {
  const { label, first_name, last_name, address1, address2, city, state, zip, country, phone, is_default } = req.body
  if (!address1 || !city || !country) return res.status(400).json({ error: 'address1, city, and country are required' })

  if (is_default) {
    db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(req.customer.id)
  }

  const result = db.prepare(`
    INSERT INTO customer_addresses (customer_id, label, first_name, last_name, address1, address2, city, state, zip, country, phone, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.customer.id, label || 'Home', first_name || '', last_name || '', address1, address2 || '', city, state || '', zip || '', country, phone || '', is_default ? 1 : 0)

  res.status(201).json(db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(result.lastInsertRowid))
})

// ─── Customer: Update address ──────────────────────────────────────────────────
// PUT /api/customers/me/addresses/:id
router.put('/me/addresses/:id', customerAuthMiddleware, (req, res) => {
  const addr = db.prepare('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?').get(req.params.id, req.customer.id)
  if (!addr) return res.status(404).json({ error: 'Address not found' })

  const { label, first_name, last_name, address1, address2, city, state, zip, country, phone, is_default } = req.body

  if (is_default) {
    db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(req.customer.id)
  }

  db.prepare(`
    UPDATE customer_addresses SET
      label = ?, first_name = ?, last_name = ?, address1 = ?, address2 = ?,
      city = ?, state = ?, zip = ?, country = ?, phone = ?, is_default = ?
    WHERE id = ?
  `).run(
    label ?? addr.label, first_name ?? addr.first_name, last_name ?? addr.last_name,
    address1 ?? addr.address1, address2 ?? addr.address2, city ?? addr.city,
    state ?? addr.state, zip ?? addr.zip, country ?? addr.country, phone ?? addr.phone,
    is_default ? 1 : 0,
    addr.id
  )

  res.json(db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(addr.id))
})

// ─── Customer: Delete address ──────────────────────────────────────────────────
// DELETE /api/customers/me/addresses/:id
router.delete('/me/addresses/:id', customerAuthMiddleware, (req, res) => {
  const addr = db.prepare('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?').get(req.params.id, req.customer.id)
  if (!addr) return res.status(404).json({ error: 'Address not found' })
  db.prepare('DELETE FROM customer_addresses WHERE id = ?').run(addr.id)
  res.json({ ok: true })
})

// ─── Admin: List all customers ─────────────────────────────────────────────────
// GET /api/customers  (admin only)
router.get('/', authMiddleware, adminOnly, (req, res) => {
  const { q = '', limit = 50, offset = 0 } = req.query
  let sql = `
    SELECT c.id, c.email, c.first_name, c.last_name, c.phone, c.active, c.created_at,
           COUNT(DISTINCT o.id) as order_count,
           COALESCE(SUM(o.total), 0) as total_spent
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE 1=1
  `
  const params = []
  if (q) {
    sql += ` AND (c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)`
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  sql += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
  params.push(Number(limit), Number(offset))

  const customers = db.prepare(sql).all(...params)
  const total = db.prepare(`SELECT COUNT(*) as n FROM customers WHERE 1=1 ${q ? 'AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)' : ''}`).get(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [])).n

  res.json({ customers, total })
})

// ─── Admin: Get customer detail ────────────────────────────────────────────────
// GET /api/customers/:id  (admin only)
router.get('/:id', authMiddleware, adminOnly, (req, res) => {
  const customer = db.prepare('SELECT id, email, first_name, last_name, phone, active, created_at, updated_at FROM customers WHERE id = ?').get(req.params.id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const addresses = db.prepare('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC').all(customer.id)
  const orders = db.prepare(`
    SELECT id, order_number, status, total, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC
  `).all(customer.id)

  res.json({ ...customer, addresses, orders })
})

// ─── Admin: Toggle customer active status ──────────────────────────────────────
// PUT /api/customers/:id  (admin only)
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const { active } = req.body
  db.prepare(`UPDATE customers SET active = ?, updated_at = datetime('now') WHERE id = ?`).run(active ? 1 : 0, customer.id)
  res.json({ ok: true })
})

// ─── Admin: Delete customer ────────────────────────────────────────────────────
// DELETE /api/customers/:id  (admin only)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  // Detach orders (keep them, just unlink)
  db.prepare('UPDATE orders SET customer_id = NULL WHERE customer_id = ?').run(customer.id)
  db.prepare('DELETE FROM customers WHERE id = ?').run(customer.id)
  res.json({ ok: true })
})

export { customerAuthMiddleware }
export default router
