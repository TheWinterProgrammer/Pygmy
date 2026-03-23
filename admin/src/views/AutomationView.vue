<template>
  <div class="automation-view">
    <div class="page-header">
      <h1>⚡ Automation Rules</h1>
      <div class="header-actions">
        <button class="btn btn-primary" @click="openCreate">➕ New Rule</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Rules</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.runs_total }}</div>
        <div class="stat-label">Total Runs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.runs_today }}</div>
        <div class="stat-label">Runs Today</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.runs_ok }}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.runs_fail }}</div>
        <div class="stat-label">Errors</div>
      </div>
    </div>

    <!-- Rules Table -->
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Trigger</th>
              <th>Conditions</th>
              <th>Actions</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in rules" :key="rule.id">
              <td>
                <div class="rule-name">{{ rule.name }}</div>
                <small class="muted" v-if="rule.description">{{ rule.description }}</small>
              </td>
              <td>
                <span class="trigger-pill">{{ triggerLabel(rule.trigger) }}</span>
              </td>
              <td>
                <span class="count-badge">{{ rule.conditions.length }} condition{{ rule.conditions.length !== 1 ? 's' : '' }}</span>
              </td>
              <td>
                <div class="action-chips">
                  <span class="action-chip" v-for="(a, i) in rule.actions" :key="i">
                    {{ actionLabel(a.type) }}
                  </span>
                </div>
              </td>
              <td>
                <span :class="['status-pill', rule.active ? 'active' : 'inactive']">
                  {{ rule.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="actions">
                <button class="btn btn-sm" @click="openEdit(rule)" title="Edit">✏️</button>
                <button class="btn btn-sm" @click="viewHistory(rule)" title="History">🕓</button>
                <button class="btn btn-sm" :title="rule.active ? 'Deactivate' : 'Activate'"
                  @click="toggleActive(rule)">{{ rule.active ? '⏸' : '▶' }}</button>
                <button class="btn btn-sm btn-danger" @click="deleteRule(rule.id)" title="Delete">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!rules.length" class="empty">
          <div class="empty-icon">⚡</div>
          <div>No automation rules yet. Create one to automatically send emails, update orders, or reward customers.</div>
        </div>
      </div>
    </div>

    <!-- Recent Runs -->
    <div class="card" v-if="recentRuns.length">
      <h3>Recent Runs</h3>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Time</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in recentRuns" :key="run.id">
              <td>{{ run.rule_name }}</td>
              <td><span class="trigger-pill">{{ run.trigger }}</span></td>
              <td><span :class="['status-pill', run.status === 'success' ? 'active' : 'error']">{{ run.status }}</span></td>
              <td><small class="muted">{{ formatDate(run.triggered_at) }}</small></td>
              <td><small class="muted error-text">{{ run.error || '' }}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Create/Edit Modal ── -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal large">
        <div class="modal-header">
          <h3>{{ editingRule ? 'Edit Rule' : 'New Automation Rule' }}</h3>
          <button class="btn-close" @click="showModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Rule Name *</label>
              <input v-model="form.name" class="input" placeholder="e.g. Thank you email after first order" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <input v-model="form.description" class="input" placeholder="Optional description" />
            </div>
            <div class="form-group">
              <label>Trigger Event *</label>
              <select v-model="form.trigger" class="input select">
                <option value="">— Select trigger —</option>
                <option v-for="t in meta.triggers" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input v-model.number="form.sort_order" type="number" class="input" min="0" />
            </div>
          </div>

          <!-- Conditions -->
          <div class="section-header">
            <h4>Conditions <small class="muted">(all must match — leave empty to always run)</small></h4>
            <button class="btn btn-sm" @click="addCondition">➕ Add Condition</button>
          </div>
          <div class="conditions-list">
            <div class="condition-row" v-for="(cond, i) in form.conditions" :key="i">
              <select v-model="cond.field" class="input select small">
                <option value="">Field…</option>
                <option v-for="f in meta.condition_fields" :key="f.value" :value="f.value">{{ f.label }}</option>
              </select>
              <select v-model="cond.operator" class="input select small">
                <option v-for="op in meta.condition_operators" :key="op.value" :value="op.value">{{ op.label }}</option>
              </select>
              <input v-model="cond.value" class="input small" placeholder="Value" />
              <button class="btn btn-sm btn-danger" @click="form.conditions.splice(i, 1)">✕</button>
            </div>
            <div v-if="!form.conditions.length" class="hint">No conditions — rule fires for every matching event.</div>
          </div>

          <!-- Actions -->
          <div class="section-header">
            <h4>Actions *</h4>
            <button class="btn btn-sm" @click="addAction">➕ Add Action</button>
          </div>
          <div class="actions-list">
            <div class="action-block" v-for="(action, i) in form.actions" :key="i">
              <div class="action-block-header">
                <select v-model="action.type" class="input select" @change="resetActionFields(action)">
                  <option value="">— Select action —</option>
                  <option v-for="at in meta.action_types" :key="at.value" :value="at.value">{{ at.label }}</option>
                </select>
                <button class="btn btn-sm btn-danger" @click="form.actions.splice(i, 1)">✕</button>
              </div>

              <!-- Action-specific fields -->
              <div class="action-fields" v-if="action.type">
                <!-- send_email / notify_admin -->
                <template v-if="action.type === 'send_email'">
                  <div class="form-group">
                    <label>To (leave blank to use customer email)</label>
                    <input v-model="action.to" class="input" placeholder="{{customer_email}}" />
                  </div>
                  <div class="form-group">
                    <label>Subject</label>
                    <input v-model="action.subject" class="input" placeholder="Your order {{order_number}} is confirmed!" />
                  </div>
                  <div class="form-group">
                    <label>Body (HTML supported, use {{variable}})</label>
                    <textarea v-model="action.body" class="input" rows="5" placeholder="<p>Hi {{customer_name}},</p>..."></textarea>
                  </div>
                </template>
                <template v-else-if="action.type === 'notify_admin'">
                  <div class="form-group">
                    <label>Subject</label>
                    <input v-model="action.subject" class="input" placeholder="Admin alert" />
                  </div>
                  <div class="form-group">
                    <label>Body</label>
                    <textarea v-model="action.body" class="input" rows="3" placeholder="Order {{order_number}} placed by {{customer_email}}"></textarea>
                  </div>
                </template>
                <template v-else-if="action.type === 'update_order_status'">
                  <div class="form-group">
                    <label>New Status</label>
                    <select v-model="action.status" class="input select">
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </template>
                <template v-else-if="action.type === 'apply_loyalty_points'">
                  <div class="form-group">
                    <label>Points to Add</label>
                    <input v-model.number="action.points" type="number" class="input" min="1" placeholder="100" />
                  </div>
                </template>
                <template v-else-if="action.type === 'create_coupon'">
                  <div class="form-grid cols-3">
                    <div class="form-group">
                      <label>Code Prefix</label>
                      <input v-model="action.prefix" class="input" placeholder="THANK" />
                    </div>
                    <div class="form-group">
                      <label>Discount Type</label>
                      <select v-model="action.discount_type" class="input select">
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed (€)</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Discount Value</label>
                      <input v-model.number="action.discount_value" type="number" class="input" min="1" />
                    </div>
                  </div>
                  <div class="form-grid cols-2">
                    <div class="form-group">
                      <label>Email Subject</label>
                      <input v-model="action.email_subject" class="input" placeholder="Your discount code!" />
                    </div>
                    <div class="form-group">
                      <label>Expiry Date</label>
                      <input v-model="action.expires_at" type="date" class="input" />
                    </div>
                  </div>
                </template>
                <template v-else-if="action.type === 'webhook'">
                  <div class="form-group">
                    <label>Webhook URL</label>
                    <input v-model="action.url" class="input" placeholder="https://example.com/webhook" />
                  </div>
                </template>
                <template v-else-if="action.type === 'add_tag'">
                  <div class="form-grid cols-2">
                    <div class="form-group">
                      <label>Entity Type</label>
                      <select v-model="action.entity_type" class="input select">
                        <option value="post">Post</option>
                        <option value="product">Product</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Tag to Add</label>
                      <input v-model="action.tag" class="input" placeholder="vip-customer" />
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <div v-if="!form.actions.length" class="hint">Add at least one action to save.</div>
          </div>

          <div class="form-group mt">
            <label class="toggle-row">
              <input type="checkbox" v-model="form.active" />
              <span>Active (rule will run on matching events)</span>
            </label>
          </div>

          <div v-if="error" class="alert alert-error">{{ error }}</div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveRule" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save Rule' }}
          </button>
        </div>
      </div>
    </div>

    <!-- History Modal -->
    <div v-if="showHistory" class="modal-overlay" @click.self="showHistory = false">
      <div class="modal">
        <div class="modal-header">
          <h3>🕓 Run History — {{ historyRule?.name }}</h3>
          <button class="btn-close" @click="showHistory = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Status</th><th>Trigger</th><th>Time</th><th>Error</th></tr>
              </thead>
              <tbody>
                <tr v-for="run in historyRuns" :key="run.id">
                  <td><span :class="['status-pill', run.status === 'success' ? 'active' : 'error']">{{ run.status }}</span></td>
                  <td>{{ run.trigger }}</td>
                  <td><small class="muted">{{ formatDate(run.triggered_at) }}</small></td>
                  <td><small class="muted error-text">{{ run.error || '' }}</small></td>
                </tr>
              </tbody>
            </table>
            <div v-if="!historyRuns.length" class="empty">No runs yet.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showHistory = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = '/api/automation'

const rules = ref([])
const stats = ref(null)
const recentRuns = ref([])
const meta = ref({ triggers: [], action_types: [], condition_fields: [], condition_operators: [] })

const showModal = ref(false)
const editingRule = ref(null)
const saving = ref(false)
const error = ref('')

const showHistory = ref(false)
const historyRule = ref(null)
const historyRuns = ref([])

const defaultForm = () => ({
  name: '',
  description: '',
  trigger: '',
  conditions: [],
  actions: [],
  active: true,
  sort_order: 0,
})
const form = ref(defaultForm())

const headers = () => ({ Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' })

async function load() {
  const [rulesRes, statsRes, metaRes, runsRes] = await Promise.all([
    fetch(API, { headers: headers() }),
    fetch(`${API}/stats/summary`, { headers: headers() }),
    fetch(`${API}/meta`, { headers: headers() }),
    fetch(`${API}/history/recent`, { headers: headers() }),
  ])
  rules.value = await rulesRes.json()
  stats.value = await statsRes.json()
  meta.value = await metaRes.json()
  recentRuns.value = (await runsRes.json()).slice(0, 20)
}

function triggerLabel(trigger) {
  const found = meta.value.triggers.find(t => t.value === trigger)
  return found ? found.label : trigger
}

function actionLabel(type) {
  const found = meta.value.action_types.find(a => a.value === type)
  return found ? found.label : type
}

function openCreate() {
  editingRule.value = null
  form.value = defaultForm()
  error.value = ''
  showModal.value = true
}

function openEdit(rule) {
  editingRule.value = rule
  form.value = {
    name: rule.name,
    description: rule.description || '',
    trigger: rule.trigger,
    conditions: JSON.parse(JSON.stringify(rule.conditions)),
    actions: JSON.parse(JSON.stringify(rule.actions)),
    active: !!rule.active,
    sort_order: rule.sort_order || 0,
  }
  error.value = ''
  showModal.value = true
}

function addCondition() {
  form.value.conditions.push({ field: '', operator: 'eq', value: '' })
}

function addAction() {
  form.value.actions.push({ type: '' })
}

function resetActionFields(action) {
  const keep = { type: action.type }
  Object.keys(action).forEach(k => { if (k !== 'type') delete action[k] })
  Object.assign(action, keep)
}

async function saveRule() {
  if (!form.value.name || !form.value.trigger) {
    error.value = 'Name and trigger are required.'; return
  }
  if (!form.value.actions.length) {
    error.value = 'At least one action is required.'; return
  }
  saving.value = true; error.value = ''
  try {
    const url = editingRule.value ? `${API}/${editingRule.value.id}` : API
    const method = editingRule.value ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form.value) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Save failed')
    showModal.value = false
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

async function toggleActive(rule) {
  await fetch(`${API}/${rule.id}`, {
    method: 'PUT', headers: headers(),
    body: JSON.stringify({ active: !rule.active }),
  })
  await load()
}

async function deleteRule(id) {
  if (!confirm('Delete this automation rule?')) return
  await fetch(`${API}/${id}`, { method: 'DELETE', headers: headers() })
  await load()
}

async function viewHistory(rule) {
  historyRule.value = rule
  const res = await fetch(`${API}/${rule.id}/history?limit=50`, { headers: headers() })
  const data = await res.json()
  historyRuns.value = data.runs || []
  showHistory.value = true
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString()
}

onMounted(load)
</script>

<style scoped>
.automation-view { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }

.stats-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; }
.stat-card { background: var(--surface); border-radius: var(--radius); padding: 1.25rem; text-align: center; }
.stat-value { font-size: 1.8rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }

.card { background: var(--surface); border-radius: var(--radius); padding: 1.5rem; }
.card h3 { margin: 0 0 1rem; font-size: 1rem; font-weight: 600; }

.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.table th { text-align: left; padding: 0.6rem 0.8rem; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
.table td { padding: 0.75rem 0.8rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
.table tbody tr:last-child td { border-bottom: none; }
.table tbody tr:hover { background: rgba(255,255,255,0.02); }

.rule-name { font-weight: 600; }
.muted { color: var(--text-muted); font-size: 0.8rem; }
.error-text { color: hsl(355,70%,58%); }

.trigger-pill { background: hsl(228,4%,20%); color: var(--text); font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; }
.count-badge { background: hsl(228,4%,22%); color: var(--text-muted); font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; }

.action-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.action-chip { background: hsl(355,70%,18%); color: var(--accent); font-size: 0.72rem; padding: 2px 7px; border-radius: 999px; }

.status-pill { font-size: 0.75rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.status-pill.active { background: hsl(140,50%,18%); color: hsl(140,60%,55%); }
.status-pill.inactive { background: hsl(228,4%,20%); color: var(--text-muted); }
.status-pill.error { background: hsl(355,70%,18%); color: hsl(355,70%,65%); }

.actions { display: flex; gap: 0.4rem; }
.empty { text-align: center; padding: 2.5rem; color: var(--text-muted); }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal { background: var(--surface); border-radius: var(--radius); width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; }
.modal.large { max-width: 900px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 1; }
.modal-header h3 { font-size: 1.1rem; font-weight: 700; margin: 0; }
.btn-close { background: none; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer; padding: 0.25rem; }
.modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; flex: 1; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 0.75rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.form-grid.cols-2 { grid-template-columns: 1fr 1fr; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); }

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.section-header h4 { font-size: 0.9rem; font-weight: 700; margin: 0; }

.conditions-list, .actions-list { display: flex; flex-direction: column; gap: 0.5rem; }
.condition-row { display: flex; gap: 0.5rem; align-items: center; }
.hint { font-size: 0.82rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0; }

.action-block { background: var(--bg); border-radius: var(--radius-sm); padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.action-block-header { display: flex; gap: 0.5rem; align-items: center; }
.action-fields { display: flex; flex-direction: column; gap: 0.75rem; }

.input { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; font-size: 0.9rem; width: 100%; box-sizing: border-box; }
.input.select { cursor: pointer; }
.input.small { width: auto; flex: 1; min-width: 80px; }
select option { background: var(--surface); }
textarea.input { resize: vertical; font-family: inherit; }

.toggle-row { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; }
.mt { margin-top: 0.5rem; }

.alert-error { background: hsl(355,70%,15%); border: 1px solid hsl(355,70%,30%); color: hsl(355,70%,65%); border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.88rem; }

.btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.1rem; border-radius: var(--radius-sm); font-size: 0.9rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { filter: brightness(1.1); }
.btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
.btn-outline:hover { background: var(--glass-bg); }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.82rem; }
.btn-danger { background: hsl(355,70%,20%); color: hsl(355,70%,65%); }
.btn-danger:hover { background: hsl(355,70%,25%); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.header-actions { display: flex; gap: 0.75rem; }
</style>
