<template>
  <div class="auto-discounts-view">
    <div class="page-header">
      <h1>⚡ Auto Discounts</h1>
      <p class="subtitle">BOGO, Buy X Get Y, and other cart-level automatic promotions</p>
      <button class="btn-accent" @click="openCreate">+ New Rule</button>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Rules</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.uses }}</div>
        <div class="stat-label">Total Uses</div>
      </div>
      <div class="stat-card" v-for="t in stats.by_type" :key="t.type">
        <div class="stat-value">{{ t.count }}</div>
        <div class="stat-label">{{ typeLabel(t.type) }}</div>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Details</th>
            <th>Schedule</th>
            <th>Uses</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="empty-row">Loading…</td></tr>
          <tr v-else-if="!rules.length"><td colspan="7" class="empty-row">No auto discount rules yet. Create one!</td></tr>
          <tr v-for="rule in rules" :key="rule.id">
            <td>
              <strong>{{ rule.name }}</strong>
              <div class="desc muted" v-if="rule.description">{{ rule.description }}</div>
            </td>
            <td><span class="type-badge" :class="rule.type">{{ typeLabel(rule.type) }}</span></td>
            <td>
              <div class="rule-details">
                <span v-if="rule.type === 'bogo'">Buy 1 {{ rule.buy_product?.name || 'item' }} → Get 1 {{ rule.get_product?.name || 'item' }} free</span>
                <span v-else-if="rule.type === 'buy_x_get_y'">
                  Buy {{ rule.buy_quantity }} {{ rule.buy_product?.name || 'items' }} → Get {{ rule.get_quantity }} {{ rule.get_product?.name || 'items' }} {{ rule.get_discount }}% off
                </span>
                <span v-else-if="rule.type === 'spend_x_get_y'">
                  Spend €{{ rule.min_spend }} → {{ rule.get_product?.name ? `Get ${rule.get_product.name} ${rule.get_discount}% off` : `${rule.get_discount}% off order` }}
                </span>
                <span v-else-if="rule.type === 'nth_free'">
                  Every {{ rule.nth_item }}{{ nth(rule.nth_item) }} item {{ rule.get_discount }}% off
                </span>
              </div>
            </td>
            <td>
              <div v-if="rule.starts_at || rule.ends_at" class="schedule-info">
                <div v-if="rule.starts_at" class="small">From: {{ rule.starts_at?.substring(0,10) }}</div>
                <div v-if="rule.ends_at" class="small">To: {{ rule.ends_at?.substring(0,10) }}</div>
              </div>
              <span v-else class="muted">Always</span>
            </td>
            <td>
              {{ rule.uses_count }}<span v-if="rule.max_uses_total" class="muted"> / {{ rule.max_uses_total }}</span>
            </td>
            <td>
              <button class="status-toggle" :class="rule.active ? 'active' : 'inactive'" @click="toggleActive(rule)">
                {{ rule.active ? '🟢 Active' : '⚫ Inactive' }}
              </button>
            </td>
            <td>
              <button class="btn-sm" @click="openEdit(rule)">✏️</button>
              <button class="btn-sm danger" @click="deleteRule(rule)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-panel">
        <div class="modal-header">
          <h2>{{ editing?.id ? 'Edit Rule' : 'New Auto Discount Rule' }}</h2>
          <button class="close-btn" @click="showModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Name <span class="req">*</span></label>
            <input v-model="form.name" placeholder="e.g. BOGO T-Shirts" />
          </div>
          <div class="form-group">
            <label>Type</label>
            <select v-model="form.type">
              <option value="bogo">BOGO — Buy 1 Get 1 Free</option>
              <option value="buy_x_get_y">Buy X Get Y</option>
              <option value="spend_x_get_y">Spend X Get Y</option>
              <option value="nth_free">Every Nth Item</option>
            </select>
          </div>
          <div class="form-group">
            <label>Description</label>
            <input v-model="form.description" placeholder="Optional description shown in cart" />
          </div>

          <!-- BOGO / Buy X Get Y -->
          <template v-if="form.type === 'bogo' || form.type === 'buy_x_get_y'">
            <div class="form-row">
              <div class="form-group">
                <label>Buy Product (leave blank for any)</label>
                <input v-model="form.buy_product_id" type="number" placeholder="Product ID" />
              </div>
              <div class="form-group" v-if="form.type === 'buy_x_get_y'">
                <label>Buy Quantity</label>
                <input v-model.number="form.buy_quantity" type="number" min="1" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Get Product (leave blank for same)</label>
                <input v-model="form.get_product_id" type="number" placeholder="Product ID" />
              </div>
              <div class="form-group">
                <label>Get Quantity</label>
                <input v-model.number="form.get_quantity" type="number" min="1" />
              </div>
              <div class="form-group">
                <label>Discount on "Get" Items (%)</label>
                <input v-model.number="form.get_discount" type="number" min="1" max="100" />
              </div>
            </div>
          </template>

          <!-- Spend X Get Y -->
          <template v-if="form.type === 'spend_x_get_y'">
            <div class="form-row">
              <div class="form-group">
                <label>Minimum Spend (€)</label>
                <input v-model.number="form.min_spend" type="number" min="0" step="0.01" />
              </div>
              <div class="form-group">
                <label>Get Product (leave blank for order discount)</label>
                <input v-model="form.get_product_id" type="number" placeholder="Product ID" />
              </div>
              <div class="form-group">
                <label>Discount %</label>
                <input v-model.number="form.get_discount" type="number" min="1" max="100" />
              </div>
            </div>
          </template>

          <!-- Nth Free -->
          <template v-if="form.type === 'nth_free'">
            <div class="form-row">
              <div class="form-group">
                <label>Every Nth Item</label>
                <input v-model.number="form.nth_item" type="number" min="2" />
              </div>
              <div class="form-group">
                <label>Discount on Free Item (%)</label>
                <input v-model.number="form.get_discount" type="number" min="1" max="100" />
              </div>
            </div>
          </template>

          <div class="form-row">
            <div class="form-group">
              <label>Max Total Uses (0 = unlimited)</label>
              <input v-model.number="form.max_uses_total" type="number" min="0" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Starts At</label>
              <input v-model="form.starts_at" type="datetime-local" />
            </div>
            <div class="form-group">
              <label>Ends At</label>
              <input v-model="form.ends_at" type="datetime-local" />
            </div>
          </div>

          <div class="form-group toggle-group">
            <label>Active</label>
            <input type="checkbox" v-model="form.active" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showModal = false">Cancel</button>
          <button class="btn-accent" @click="saveRule">{{ editing?.id ? 'Save Changes' : 'Create Rule' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const rules = ref([])
const stats = ref(null)
const loading = ref(false)
const showModal = ref(false)
const editing = ref(null)

const defaultForm = () => ({
  name: '', type: 'bogo', description: '',
  buy_product_id: '', buy_quantity: 1,
  get_product_id: '', get_quantity: 1,
  get_discount: 100, min_spend: 0, nth_item: 3,
  max_uses_total: 0, starts_at: '', ends_at: '', active: true
})

const form = ref(defaultForm())
const API = '/api'

function typeLabel (type) {
  return { bogo: 'BOGO', buy_x_get_y: 'Buy X Get Y', spend_x_get_y: 'Spend X Get Y', nth_free: 'Nth Free' }[type] || type
}

function nth (n) {
  if (n % 10 === 1 && n !== 11) return 'st'
  if (n % 10 === 2 && n !== 12) return 'nd'
  if (n % 10 === 3 && n !== 13) return 'rd'
  return 'th'
}

async function loadRules () {
  loading.value = true
  const res = await fetch(`${API}/auto-discounts`, { headers: { Authorization: `Bearer ${auth.token}` } })
  rules.value = await res.json()
  loading.value = false
}

async function loadStats () {
  const res = await fetch(`${API}/auto-discounts/stats`, { headers: { Authorization: `Bearer ${auth.token}` } })
  stats.value = await res.json()
}

function openCreate () { editing.value = {}; form.value = defaultForm(); showModal.value = true }
function openEdit (rule) {
  editing.value = rule
  form.value = {
    name: rule.name, type: rule.type, description: rule.description || '',
    buy_product_id: rule.buy_product_id || '', buy_quantity: rule.buy_quantity,
    get_product_id: rule.get_product_id || '', get_quantity: rule.get_quantity,
    get_discount: rule.get_discount, min_spend: rule.min_spend, nth_item: rule.nth_item,
    max_uses_total: rule.max_uses_total,
    starts_at: rule.starts_at || '', ends_at: rule.ends_at || '',
    active: !!rule.active
  }
  showModal.value = true
}

async function saveRule () {
  if (!form.value.name) return alert('Name is required')
  const payload = { ...form.value, active: form.value.active ? 1 : 0 }
  if (!payload.buy_product_id) delete payload.buy_product_id
  if (!payload.get_product_id) delete payload.get_product_id
  const url = editing.value?.id ? `${API}/auto-discounts/${editing.value.id}` : `${API}/auto-discounts`
  const method = editing.value?.id ? 'PUT' : 'POST'
  await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify(payload) })
  showModal.value = false
  loadRules(); loadStats()
}

async function toggleActive (rule) {
  await fetch(`${API}/auto-discounts/${rule.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ active: rule.active ? 0 : 1 }),
  })
  loadRules()
}

async function deleteRule (rule) {
  if (!confirm(`Delete "${rule.name}"?`)) return
  await fetch(`${API}/auto-discounts/${rule.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } })
  loadRules(); loadStats()
}

onMounted(() => { loadRules(); loadStats() })
</script>

<style scoped>
.auto-discounts-view { padding: 2rem; }
.page-header { display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.page-header h1 { margin: 0; font-size: 1.5rem; }
.subtitle { margin: 0; color: rgba(255,255,255,0.5); font-size: 0.85rem; flex: 1; }
.btn-accent { background: var(--accent,#e03c3c); color: #fff; border: none; border-radius: 0.5rem; padding: 0.5rem 1.25rem; cursor: pointer; font-weight: 600; white-space: nowrap; }

.stats-strip { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1rem 1.5rem; min-width: 100px; }
.stat-card.green { border-color: rgba(80,200,120,0.3); }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem; }

.table-wrap { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; overflow: auto; }
table { width: 100%; border-collapse: collapse; }
th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.08); }
td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; vertical-align: top; }
.empty-row { text-align: center; color: rgba(255,255,255,0.4); padding: 2rem !important; }
.desc { font-size: 0.75rem; margin-top: 0.2rem; }
.muted { color: rgba(255,255,255,0.4); }
.small { font-size: 0.75rem; }

.type-badge { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 0.5rem; background: rgba(255,255,255,0.1); white-space: nowrap; }
.type-badge.bogo { background: rgba(255,180,0,0.2); color: #ffb400; }
.type-badge.buy_x_get_y { background: rgba(100,180,255,0.15); color: #64b4ff; }
.type-badge.spend_x_get_y { background: rgba(80,200,120,0.15); color: #50c878; }
.type-badge.nth_free { background: rgba(200,100,255,0.15); color: #c864ff; }

.status-toggle { font-size: 0.78rem; border: none; background: rgba(255,255,255,0.08); border-radius: 0.5rem; padding: 0.25rem 0.75rem; cursor: pointer; color: rgba(255,255,255,0.7); transition: background 0.15s; }
.status-toggle.active { background: rgba(80,200,120,0.15); color: #50c878; }
.status-toggle.inactive { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }
.btn-sm { background: rgba(255,255,255,0.08); border: none; border-radius: 0.4rem; padding: 0.25rem 0.5rem; cursor: pointer; color: #fff; margin-right: 0.25rem; }
.btn-sm.danger:hover { background: rgba(220,60,60,0.3); }
.rule-details { font-size: 0.8rem; color: rgba(255,255,255,0.8); }
.schedule-info { font-size: 0.75rem; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-panel { background: hsl(228,4%,12%); border: 1px solid rgba(255,255,255,0.12); border-radius: 1.5rem; width: 90%; max-width: 640px; max-height: 90vh; display: flex; flex-direction: column; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.close-btn { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1.2rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; gap: 0.75rem; }
.btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 1.25rem; color: #fff; cursor: pointer; }

.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group label { font-size: 0.78rem; font-weight: 600; color: rgba(255,255,255,0.6); }
.form-group input, .form-group select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 0.75rem; color: #fff; font-family: inherit; width: 100%; box-sizing: border-box; }
.form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; }
.toggle-group { flex-direction: row; align-items: center; gap: 0.75rem; }
.req { color: var(--accent,#e03c3c); }
</style>
