// Pygmy CMS — Store Credit API (Phase 39)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// ── Admin: list customers with store credit ───────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { q = '', limit = 50, offset = 0 } = req.query
  const search = `%${q}%`
  const rows = db.prepare(`
    SELECT c.id, c.first_name, c.last_name, c.email, c.store_credit_balance,
           COUNT(t.id) as tx_count
    FROM customers c
    LEFT JOIN store_credit_transactions t ON t.customer_id = c.id
    WHERE (c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)
      AND c.store_credit_balance > 0
    GROUP BY c.id
    ORDER BY c.store_credit_balance DESC
    LIMIT ? OFFSET ?
  `).all(search, search, search, Number(limit), Number(offset))
  res.json(rows)
})

// ── Admin: get transactions for a customer ────────────────────────────────────
router.get('/customer/:id', authMiddleware, (req, res) => {
  const txns = db.prepare(`
    SELECT * FROM store_credit_transactions
    WHERE customer_id = ?
    ORDER BY created_at DESC LIMIT 100
  `).all(req.params.id)
  const customer = db.prepare('SELECT id, first_name, last_name, email, store_credit_balance FROM customers WHERE id = ?').get(req.params.id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  res.json({ customer, transactions: txns })
})

// ── Admin: manually adjust balance ───────────────────────────────────────────
router.post('/adjust', authMiddleware, (req, res) => {
  const { customer_id, amount, note } = req.body
  if (!customer_id || amount === undefined) return res.status(400).json({ error: 'customer_id and amount required' })

  const customer = db.prepare('SELECT id, store_credit_balance FROM customers WHERE id = ?').get(customer_id)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const newBalance = Math.max(0, (customer.store_credit_balance || 0) + Number(amount))

  db.prepare('UPDATE customers SET store_credit_balance = ? WHERE id = ?').run(newBalance, customer_id)
  db.prepare(`
    INSERT INTO store_credit_transactions (customer_id, amount, type, note)
    VALUES (?, ?, 'manual', ?)
  `).run(customer_id, Number(amount), note || null)

  res.json({ ok: true, new_balance: newBalance })
})

// ── Customer: get own balance ─────────────────────────────────────────────────
router.get('/me', customerAuthMiddleware, (req, res) => {
  const customer = db.prepare('SELECT store_credit_balance FROM customers WHERE id = ?').get(req.customer.id)
  const txns = db.prepare(`
    SELECT * FROM store_credit_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(req.customer.id)
  res.json({ balance: customer?.store_credit_balance || 0, transactions: txns })
})

// ── Customer: validate redemption ────────────────────────────────────────────
router.post('/validate', customerAuthMiddleware, (req, res) => {
  const { amount } = req.body
  const customer = db.prepare('SELECT store_credit_balance FROM customers WHERE id = ?').get(req.customer.id)
  const balance = customer?.store_credit_balance || 0

  const settings = db.prepare(`SELECT key, value FROM settings WHERE key IN ('store_credit_enabled')`).all()
  const s = Object.fromEntries(settings.map(r => [r.key, r.value]))

  if (s.store_credit_enabled !== '1') return res.status(400).json({ error: 'Store credit is not enabled' })
  if (!balance) return res.status(400).json({ error: 'No store credit available' })

  const use = Math.min(Number(amount) || balance, balance)
  res.json({ valid: true, balance, use_amount: use })
})

// ── Admin: stats ──────────────────────────────────────────────────────────────
router.get('/stats', authMiddleware, (req, res) => {
  const total = db.prepare('SELECT COALESCE(SUM(store_credit_balance),0) as v FROM customers').get()?.v || 0
  const count = db.prepare('SELECT COUNT(*) as c FROM customers WHERE store_credit_balance > 0').get()?.c || 0
  const issued = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM store_credit_transactions WHERE amount > 0`).get()?.v || 0
  const redeemed = db.prepare(`SELECT COALESCE(ABS(SUM(amount)),0) as v FROM store_credit_transactions WHERE amount < 0`).get()?.v || 0
  res.json({ outstanding: total, customers_with_credit: count, total_issued: issued, total_redeemed: redeemed })
})

export default router
