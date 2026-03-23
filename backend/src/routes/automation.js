// Pygmy CMS — Order/Event Automation Rules (Phase 46)
// Trigger-action workflow engine
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware as auth } from '../middleware/auth.js'
import { sendMailTo } from '../email.js'

const router = Router()

function safeJSON(v, fb) { try { return JSON.parse(v || 'null') ?? fb } catch { return fb } }

function parseRule(r) {
  if (!r) return null
  return {
    ...r,
    conditions: safeJSON(r.conditions, []),
    actions: safeJSON(r.actions, []),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM automation_rules ORDER BY sort_order, name`).all()
  res.json(rows.map(parseRule))
})

router.post('/', auth, (req, res) => {
  const { name, description, trigger, conditions = [], actions = [], active = true, sort_order = 0 } = req.body
  if (!name || !trigger || !actions.length) {
    return res.status(400).json({ error: 'name, trigger and at least one action required' })
  }
  const r = db.prepare(`
    INSERT INTO automation_rules (name, description, trigger, conditions, actions, active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, description || '', trigger, JSON.stringify(conditions), JSON.stringify(actions), active ? 1 : 0, sort_order)
  res.status(201).json(parseRule(db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(r.lastInsertRowid)))
})

router.put('/:id', auth, (req, res) => {
  const rule = db.prepare('SELECT id FROM automation_rules WHERE id = ?').get(req.params.id)
  if (!rule) return res.status(404).json({ error: 'Rule not found' })
  const { name, description, trigger, conditions, actions, active, sort_order } = req.body
  db.prepare(`
    UPDATE automation_rules
    SET name=COALESCE(?,name), description=COALESCE(?,description), trigger=COALESCE(?,trigger),
        conditions=COALESCE(?,conditions), actions=COALESCE(?,actions),
        active=COALESCE(?,active), sort_order=COALESCE(?,sort_order),
        updated_at=datetime('now')
    WHERE id=?
  `).run(
    name || null, description || null, trigger || null,
    conditions != null ? JSON.stringify(conditions) : null,
    actions != null ? JSON.stringify(actions) : null,
    active != null ? (active ? 1 : 0) : null,
    sort_order != null ? sort_order : null,
    req.params.id
  )
  res.json(parseRule(db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id)))
})

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM automation_rules WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// Run history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/history', auth, (req, res) => {
  const { limit = 50, offset = 0 } = req.query
  const total = db.prepare('SELECT COUNT(*) as n FROM automation_runs WHERE rule_id = ?').get(req.params.id).n
  const rows = db.prepare(`
    SELECT * FROM automation_runs WHERE rule_id = ?
    ORDER BY triggered_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, Number(limit), Number(offset))
  res.json({ runs: rows, total })
})

router.get('/history/recent', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT ar.*, r.name as rule_name
    FROM automation_runs ar JOIN automation_rules r ON r.id = ar.rule_id
    ORDER BY ar.triggered_at DESC LIMIT 100
  `).all()
  res.json(rows)
})

// Stats
router.get('/stats/summary', auth, (req, res) => {
  const total     = db.prepare('SELECT COUNT(*) as n FROM automation_rules').get().n
  const active    = db.prepare('SELECT COUNT(*) as n FROM automation_rules WHERE active = 1').get().n
  const runs_total = db.prepare('SELECT COUNT(*) as n FROM automation_runs').get().n
  const runs_today = db.prepare(`SELECT COUNT(*) as n FROM automation_runs WHERE date(triggered_at)=date('now')`).get().n
  const runs_ok   = db.prepare("SELECT COUNT(*) as n FROM automation_runs WHERE status='success'").get().n
  const runs_fail = db.prepare("SELECT COUNT(*) as n FROM automation_runs WHERE status='error'").get().n
  res.json({ total, active, runs_total, runs_today, runs_ok, runs_fail })
})

// ─────────────────────────────────────────────────────────────────────────────
// Engine: process rules for an event
// Called internally from other routes via import
// ─────────────────────────────────────────────────────────────────────────────
export async function fireAutomation(eventName, context = {}) {
  const rules = db.prepare(`
    SELECT * FROM automation_rules WHERE trigger = ? AND active = 1
  `).all(eventName)

  for (const rule of rules) {
    const conditions = safeJSON(rule.conditions, [])
    const actions = safeJSON(rule.actions, [])

    // Evaluate conditions (AND logic)
    let pass = true
    for (const cond of conditions) {
      const val = getContextValue(context, cond.field)
      if (!evalCondition(val, cond.operator, cond.value)) { pass = false; break }
    }
    if (!pass) continue

    // Execute actions
    let lastResult = 'success'
    let lastError = null
    for (const action of actions) {
      try {
        await executeAction(action, context, rule)
      } catch (e) {
        lastResult = 'error'
        lastError = e.message
        break
      }
    }

    // Log the run
    db.prepare(`
      INSERT INTO automation_runs (rule_id, trigger, context_summary, status, error, triggered_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(rule.id, eventName, JSON.stringify({ id: context.id || context.order_number, type: eventName }), lastResult, lastError)
  }
}

function getContextValue(ctx, field) {
  // Supports dot notation: order.total
  return field.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), ctx)
}

function evalCondition(val, op, target) {
  switch (op) {
    case 'eq':  return String(val) === String(target)
    case 'neq': return String(val) !== String(target)
    case 'gt':  return parseFloat(val) > parseFloat(target)
    case 'gte': return parseFloat(val) >= parseFloat(target)
    case 'lt':  return parseFloat(val) < parseFloat(target)
    case 'lte': return parseFloat(val) <= parseFloat(target)
    case 'contains': return String(val || '').toLowerCase().includes(String(target).toLowerCase())
    case 'starts_with': return String(val || '').startsWith(target)
    case 'is_empty': return !val || val === ''
    default: return true
  }
}

async function executeAction(action, context, rule) {
  const settings = db.prepare('SELECT key, value FROM settings').all().reduce((o, r) => { o[r.key] = r.value; return o }, {})

  switch (action.type) {
    case 'send_email': {
      const to = interpolate(action.to || '', context) || context.customer_email
      const subject = interpolate(action.subject || '(no subject)', context)
      const body = interpolate(action.body || '', context)
      if (!to) throw new Error('No email recipient')
      await sendMailTo(to, subject, body)
      break
    }

    case 'update_order_status': {
      if (!context.id) throw new Error('No order id in context')
      db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(action.status, context.id)
      break
    }

    case 'add_tag': {
      // Add a tag to a post/product
      if (!context.id || !action.entity_type) throw new Error('entity required')
      const table = action.entity_type === 'product' ? 'products' : 'posts'
      const row = db.prepare(`SELECT tags FROM ${table} WHERE id = ?`).get(context.id)
      if (!row) throw new Error('Entity not found')
      const tags = safeJSON(row.tags, [])
      if (!tags.includes(action.tag)) {
        tags.push(action.tag)
        db.prepare(`UPDATE ${table} SET tags = ? WHERE id = ?`).run(JSON.stringify(tags), context.id)
      }
      break
    }

    case 'apply_loyalty_points': {
      if (!context.customer_id) break // skip if no customer
      const pts = parseInt(action.points || 0)
      if (!pts) break
      db.prepare("UPDATE customers SET points_balance = points_balance + ? WHERE id = ?").run(pts, context.customer_id)
      db.prepare(`INSERT INTO loyalty_transactions (customer_id, type, points, balance_after, note, created_at)
        SELECT ?, 'adjust', ?, points_balance, ?, datetime('now') FROM customers WHERE id = ?`)
        .run(context.customer_id, pts, `Automation: ${rule.name}`, context.customer_id)
      break
    }

    case 'notify_admin': {
      const notify_email = settings.notify_email
      if (!notify_email) break
      const subject = interpolate(action.subject || 'Automation triggered: ' + rule.name, context)
      const body = interpolate(action.body || JSON.stringify(context, null, 2), context)
      await sendMailTo(notify_email, subject, body)
      break
    }

    case 'webhook': {
      const url = action.url
      if (!url) throw new Error('webhook url required')
      const payload = JSON.stringify({ rule: rule.name, trigger: rule.trigger, context })
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pygmy-Automation': '1' },
        body: payload,
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) throw new Error(`Webhook returned ${resp.status}`)
      break
    }

    case 'create_coupon': {
      // Generate a single-use coupon for the customer
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = (action.prefix || 'AUTO') + '-'
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
      db.prepare(`INSERT INTO coupons (code, type, value, expires_at, min_order_amount, max_uses, max_uses_per_customer, active)
        VALUES (?, ?, ?, ?, 0, 1, 1, 1)`)
        .run(code, action.discount_type || 'percentage', action.discount_value || 10, action.expires_at || null)
      // Email it to the customer
      if (context.customer_email) {
        const siteUrl = settings.site_url || ''
        await sendMailTo(context.customer_email, action.email_subject || 'Your exclusive discount code!', `
          <p>Hi ${context.customer_name || 'there'},</p>
          <p>${action.email_intro || 'Here is your exclusive discount code:'}</p>
          <h2 style="font-size:2rem;letter-spacing:0.1em">${code}</h2>
          <p>${action.discount_value}% off your next order</p>
          ${action.expires_at ? `<p>Valid until ${action.expires_at}</p>` : ''}
          <a href="${siteUrl}/shop" style="background:#c94040;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Shop Now</a>
        `)
      }
      break
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

function interpolate(template, ctx) {
  return template.replace(/\{\{(\w+(\.\w+)*)\}\}/g, (_, key) => {
    const val = getContextValue(ctx, key)
    return val != null ? val : ''
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// List supported triggers and action types (for admin UI)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/meta', auth, (req, res) => {
  res.json({
    triggers: [
      { value: 'order.created',          label: 'Order Created' },
      { value: 'order.status_changed',   label: 'Order Status Changed' },
      { value: 'order.completed',        label: 'Order Completed' },
      { value: 'customer.registered',    label: 'Customer Registered' },
      { value: 'review.approved',        label: 'Review Approved' },
      { value: 'subscriber.new',         label: 'New Newsletter Subscriber' },
      { value: 'support.ticket_created', label: 'Support Ticket Created' },
      { value: 'form.submitted',         label: 'Form Submitted' },
    ],
    action_types: [
      { value: 'send_email',          label: 'Send Email',         fields: ['to','subject','body'] },
      { value: 'notify_admin',        label: 'Notify Admin',       fields: ['subject','body'] },
      { value: 'update_order_status', label: 'Update Order Status', fields: ['status'] },
      { value: 'apply_loyalty_points', label: 'Add Loyalty Points', fields: ['points'] },
      { value: 'create_coupon',       label: 'Generate & Send Coupon', fields: ['prefix','discount_type','discount_value','expires_at','email_subject','email_intro'] },
      { value: 'webhook',             label: 'Call Webhook URL',   fields: ['url'] },
      { value: 'add_tag',             label: 'Add Tag to Content', fields: ['entity_type','tag'] },
    ],
    condition_fields: [
      { value: 'total',          label: 'Order Total' },
      { value: 'status',         label: 'Order Status' },
      { value: 'customer_email', label: 'Customer Email' },
      { value: 'coupon_code',    label: 'Coupon Code Used' },
      { value: 'shipping_country', label: 'Shipping Country' },
    ],
    condition_operators: [
      { value: 'eq',          label: '=' },
      { value: 'neq',         label: '≠' },
      { value: 'gt',          label: '>' },
      { value: 'gte',         label: '≥' },
      { value: 'lt',          label: '<' },
      { value: 'lte',         label: '≤' },
      { value: 'contains',    label: 'contains' },
      { value: 'starts_with', label: 'starts with' },
      { value: 'is_empty',    label: 'is empty' },
    ],
  })
})

export default router
