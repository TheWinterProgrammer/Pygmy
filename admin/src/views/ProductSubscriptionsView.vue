<template>
  <div>
    <div class="page-header">
      <h1>🔁 Product Subscriptions</h1>
      <p class="subtitle">Subscribe-and-save plans — recurring orders on autopilot</p>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.active }}</div>
        <div class="stat-lbl">Active Subscribers</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.paused }}</div>
        <div class="stat-lbl">Paused</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num accent-text">{{ stats.due_soon }}</div>
        <div class="stat-lbl">Due in 7 Days</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.cancelled }}</div>
        <div class="stat-lbl">Cancelled</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ currency }}{{ fmtNum(stats.total_revenue) }}</div>
        <div class="stat-lbl">Total Revenue</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar glass" style="margin-bottom:1.5rem;padding:.25rem;display:flex;gap:.25rem;">
      <button :class="['tab-btn', tab === 'subscribers' && 'active']" @click="tab='subscribers'">👤 Active Subscribers</button>
      <button :class="['tab-btn', tab === 'plans' && 'active']" @click="tab='plans';loadPlans()">📋 Subscription Plans</button>
    </div>

    <!-- Subscribers Tab -->
    <template v-if="tab === 'subscribers'">
      <div class="toolbar glass" style="margin-bottom:1rem;padding:.75rem 1rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
        <input v-model="q" @input="debSearch" class="input input-sm" placeholder="Search by name or email…" style="flex:1;min-width:180px" />
        <select v-model="filterStatus" @change="loadOrders" class="input input-sm" style="min-width:150px">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div class="glass table-card">
        <div v-if="loading" class="loading-state"><div class="loading-bar"></div></div>
        <div v-else-if="!orders.length" class="empty-state">No subscriptions found.</div>
        <table v-else class="admin-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product</th>
              <th>Plan</th>
              <th>Price</th>
              <th>Next Order</th>
              <th>Orders</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in orders" :key="s.id">
              <td>
                <div class="cust-name">{{ s.first_name }} {{ s.last_name }}</div>
                <div class="cust-email text-muted">{{ s.email }}</div>
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:.5rem">
                  <img v-if="s.cover_image" :src="`http://localhost:3200${s.cover_image}`" style="width:32px;height:32px;object-fit:cover;border-radius:.4rem" />
                  <span>{{ s.product_name }}</span>
                </div>
              </td>
              <td>{{ s.interval_label }}<span v-if="s.discount_pct > 0" class="pill pill-green" style="margin-left:.5rem">-{{ s.discount_pct }}%</span></td>
              <td>{{ currency }}{{ s.unit_price }}</td>
              <td>
                <span :class="isOverdue(s.next_order_date) ? 'text-danger' : ''">{{ fmtDate(s.next_order_date) }}</span>
              </td>
              <td>{{ s.total_orders || 0 }}</td>
              <td><span :class="['pill', `pill-${statusColor(s.status)}`]">{{ s.status }}</span></td>
              <td>
                <div style="display:flex;gap:.3rem">
                  <button class="btn-icon" title="Edit" @click="openEdit(s)">✏️</button>
                  <button v-if="s.status === 'active'" class="btn-icon" title="Pause" @click="updateStatus(s, 'paused')">⏸</button>
                  <button v-if="s.status === 'paused'" class="btn-icon" title="Resume" @click="updateStatus(s, 'active')">▶</button>
                  <button v-if="s.status !== 'cancelled'" class="btn-icon danger" title="Cancel" @click="updateStatus(s, 'cancelled')">✕</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="total > limit" class="pagination">
          <button :disabled="offset === 0" @click="prev" class="btn btn-sm">← Prev</button>
          <span class="text-muted" style="font-size:.85rem">{{ offset+1 }}–{{ Math.min(offset+limit, total) }} of {{ total }}</span>
          <button :disabled="offset+limit >= total" @click="next" class="btn btn-sm">Next →</button>
        </div>
      </div>
    </template>

    <!-- Plans Tab -->
    <template v-if="tab === 'plans'">
      <div class="glass section" style="padding:1.25rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h3 style="margin:0">Subscription Plans by Product</h3>
          <button class="btn btn-primary" @click="openAddPlan">+ Add Plan</button>
        </div>

        <div v-if="loadingPlans" class="loading-bar"></div>
        <div v-else-if="!plans.length" class="empty-state">No subscription plans yet. Add one to enable subscribe-and-save on your products.</div>

        <div v-else class="plans-grid">
          <div v-for="p in plans" :key="p.id" class="plan-card glass">
            <div class="plan-img" v-if="p.cover_image">
              <img :src="`http://localhost:3200${p.cover_image}`" alt="" />
            </div>
            <div class="plan-info">
              <div class="plan-product">{{ p.product_name }}</div>
              <div class="plan-label">{{ p.interval_label }}</div>
              <div class="plan-meta text-muted">
                Every {{ p.interval_days }} days
                <span v-if="p.discount_pct > 0"> · <strong>{{ p.discount_pct }}% off</strong></span>
              </div>
              <div class="plan-subs text-muted" style="font-size:.8rem">{{ p.active_subscribers }} active subscribers</div>
            </div>
            <div class="plan-actions">
              <span :class="['pill', p.active ? 'pill-green' : 'pill-gray']" style="font-size:.75rem">{{ p.active ? 'Active' : 'Inactive' }}</span>
              <button class="btn-icon" @click="openEditPlan(p)">✏️</button>
              <button class="btn-icon danger" @click="deletePlan(p)" :disabled="p.active_subscribers > 0" :title="p.active_subscribers > 0 ? 'Has active subscribers' : 'Delete'">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit Subscription Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal=false">
      <div class="modal glass" style="max-width:480px">
        <h2>Edit Subscription</h2>
        <div class="field">
          <label>Status</label>
          <select v-model="editForm.status" class="input">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="field">
          <label>Next Order Date</label>
          <input v-model="editForm.next_order_date" type="datetime-local" class="input" />
        </div>
        <div class="field">
          <label>Notes</label>
          <textarea v-model="editForm.notes" class="input" rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showEditModal=false">Cancel</button>
          <button class="btn btn-primary" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Plan Modal -->
    <div v-if="showPlanModal" class="modal-overlay" @click.self="showPlanModal=false">
      <div class="modal glass" style="max-width:500px">
        <h2>{{ editingPlan?.id ? 'Edit Plan' : 'New Subscription Plan' }}</h2>
        <div class="field">
          <label>Product *</label>
          <input v-model="planForm.product_search" @input="searchProducts" class="input" placeholder="Search product by name…" />
          <div v-if="productResults.length" class="dropdown-results">
            <div v-for="p in productResults" :key="p.id" class="dropdown-item" @click="selectProduct(p)">
              {{ p.name }} — {{ currency }}{{ p.price }}
            </div>
          </div>
          <div v-if="planForm.product_name" class="selected-tag">✓ {{ planForm.product_name }}</div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Interval (days) *</label>
            <input v-model.number="planForm.interval_days" type="number" min="1" class="input" />
          </div>
          <div class="field">
            <label>Label *</label>
            <input v-model="planForm.interval_label" class="input" placeholder="Monthly" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Discount %</label>
            <input v-model.number="planForm.discount_pct" type="number" min="0" max="100" class="input" />
          </div>
          <div class="field">
            <label>Status</label>
            <select v-model="planForm.active" class="input">
              <option :value="1">Active</option>
              <option :value="0">Inactive</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showPlanModal=false">Cancel</button>
          <button class="btn btn-primary" @click="savePlan">{{ editingPlan?.id ? 'Update' : 'Create' }} Plan</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = 'http://localhost:3200/api'

const tab = ref('subscribers')
const loading = ref(false)
const loadingPlans = ref(false)
const q = ref('')
const filterStatus = ref('')
const offset = ref(0)
const limit = 50
const total = ref(0)
const orders = ref([])
const plans = ref([])
const stats = ref(null)
const currency = ref('€')

const showEditModal = ref(false)
const showPlanModal = ref(false)
const editingOrder = ref(null)
const editingPlan = ref(null)
const editForm = reactive({ status: '', next_order_date: '', notes: '' })
const planForm = reactive({ product_id: null, product_name: '', product_search: '', interval_days: 30, interval_label: 'Monthly', discount_pct: 10, active: 1 })
const productResults = ref([])

function apiFetch(path, opts = {}) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, ...(opts.headers || {}) },
  }).then(r => r.json())
}

async function load() {
  loading.value = true
  try {
    const [s, settings] = await Promise.all([
      apiFetch('/product-subscriptions/stats'),
      apiFetch('/settings'),
    ])
    stats.value = s
    currency.value = settings.shop_currency_symbol || '€'
    await loadOrders()
  } catch (e) { console.error(e) } finally { loading.value = false }
}

async function loadOrders() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit, offset: offset.value })
    if (q.value) params.set('q', q.value)
    if (filterStatus.value) params.set('status', filterStatus.value)
    const data = await apiFetch(`/product-subscriptions/orders?${params}`)
    orders.value = data.orders || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

async function loadPlans() {
  loadingPlans.value = true
  try {
    plans.value = await apiFetch('/product-subscriptions/plans')
  } finally { loadingPlans.value = false }
}

function debSearch() {
  clearTimeout(debTimer)
  debTimer = setTimeout(() => { offset.value = 0; loadOrders() }, 300)
}
let debTimer = null

function prev() { offset.value -= limit; loadOrders() }
function next() { offset.value += limit; loadOrders() }

function openEdit(s) {
  editingOrder.value = s
  editForm.status = s.status
  editForm.next_order_date = s.next_order_date ? s.next_order_date.slice(0, 16) : ''
  editForm.notes = s.notes || ''
  showEditModal.value = true
}

async function saveEdit() {
  await apiFetch(`/product-subscriptions/orders/${editingOrder.value.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: editForm.status, next_order_date: editForm.next_order_date, notes: editForm.notes }),
  })
  showEditModal.value = false
  loadOrders()
}

async function updateStatus(s, status) {
  if (status === 'cancelled' && !confirm(`Cancel this subscription for ${s.first_name} ${s.last_name}?`)) return
  await apiFetch(`/product-subscriptions/orders/${s.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  loadOrders()
  load()
}

function openAddPlan() {
  editingPlan.value = {}
  Object.assign(planForm, { product_id: null, product_name: '', product_search: '', interval_days: 30, interval_label: 'Monthly', discount_pct: 10, active: 1 })
  productResults.value = []
  showPlanModal.value = true
}

function openEditPlan(p) {
  editingPlan.value = p
  Object.assign(planForm, { product_id: p.product_id, product_name: p.product_name, product_search: '', interval_days: p.interval_days, interval_label: p.interval_label, discount_pct: p.discount_pct, active: p.active })
  productResults.value = []
  showPlanModal.value = true
}

async function searchProducts() {
  if (!planForm.product_search || planForm.product_search.length < 2) { productResults.value = []; return }
  const data = await apiFetch(`/products?all=1&q=${encodeURIComponent(planForm.product_search)}&limit=8`)
  productResults.value = (data.products || []).slice(0, 8)
}

function selectProduct(p) {
  planForm.product_id = p.id
  planForm.product_name = p.name
  planForm.product_search = ''
  productResults.value = []
}

async function savePlan() {
  if (!planForm.product_id && !editingPlan.value?.id) return alert('Please select a product first')
  const body = {
    product_id: planForm.product_id,
    interval_days: planForm.interval_days,
    interval_label: planForm.interval_label,
    discount_pct: planForm.discount_pct,
    active: planForm.active,
  }
  if (editingPlan.value?.id) {
    await apiFetch(`/product-subscriptions/plans/${editingPlan.value.id}`, { method: 'PUT', body: JSON.stringify(body) })
  } else {
    await apiFetch('/product-subscriptions/plans', { method: 'POST', body: JSON.stringify(body) })
  }
  showPlanModal.value = false
  loadPlans()
}

async function deletePlan(p) {
  if (!confirm(`Delete plan "${p.interval_label}" for "${p.product_name}"?`)) return
  await apiFetch(`/product-subscriptions/plans/${p.id}`, { method: 'DELETE' })
  loadPlans()
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtNum(n) { return parseFloat(n || 0).toFixed(2) }
function isOverdue(d) { return d && new Date(d) < new Date() }
function statusColor(s) {
  if (s === 'active') return 'green'
  if (s === 'paused') return 'yellow'
  if (s === 'cancelled') return 'red'
  return 'gray'
}

onMounted(load)
</script>

<style scoped>
.page-header { margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.75rem; margin: 0 0 .25rem; }
.subtitle { color: var(--muted, #888); margin: 0; font-size: .9rem; }

.stats-strip { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { padding: .75rem 1.25rem; border-radius: 1rem; min-width: 120px; }
.stat-card.glass { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
.stat-num { font-size: 1.5rem; font-weight: 700; }
.stat-lbl { font-size: .78rem; color: var(--muted, #888); }
.accent-text { color: hsl(355,70%,58%); }
.text-danger { color: hsl(355,70%,58%); }

.tab-bar { background: rgba(255,255,255,.04); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); }
.tab-btn { padding: .5rem 1.1rem; background: transparent; border: none; color: #aaa; border-radius: .75rem; cursor: pointer; font-size: .9rem; transition: all .2s; }
.tab-btn.active { background: hsl(355,70%,58%); color: #fff; }

.toolbar { background: rgba(255,255,255,.05); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); }
.input { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; padding: .45rem .75rem; color: inherit; font-size: .9rem; width: 100%; }
.input-sm { padding: .35rem .65rem; font-size: .85rem; width: auto; }

.table-card { background: rgba(255,255,255,.04); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); overflow: hidden; }
.loading-state { padding: 2rem; }
.loading-bar { height: 3px; background: linear-gradient(90deg, transparent, hsl(355,70%,58%), transparent); animation: shimmer 1.5s infinite; border-radius: 2px; }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.empty-state { text-align: center; padding: 2.5rem; color: #888; }

.admin-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
.admin-table th { padding: .65rem 1rem; text-align: left; color: #888; font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid rgba(255,255,255,.07); }
.admin-table td { padding: .65rem 1rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.admin-table tr:last-child td { border-bottom: none; }

.cust-name { font-weight: 500; }
.cust-email { font-size: .8rem; }
.text-muted { color: #888; }

.pill { padding: .2rem .6rem; border-radius: 2rem; font-size: .75rem; font-weight: 600; }
.pill-green { background: rgba(34,197,94,.15); color: #22c55e; border: 1px solid rgba(34,197,94,.25); }
.pill-yellow { background: rgba(234,179,8,.15); color: #eab308; border: 1px solid rgba(234,179,8,.25); }
.pill-red { background: rgba(239,68,68,.15); color: #ef4444; border: 1px solid rgba(239,68,68,.25); }
.pill-gray { background: rgba(156,163,175,.15); color: #9ca3af; border: 1px solid rgba(156,163,175,.25); }

.btn-icon { background: transparent; border: none; cursor: pointer; padding: .3rem; border-radius: .4rem; font-size: .9rem; opacity: .7; transition: opacity .2s; }
.btn-icon:hover { opacity: 1; background: rgba(255,255,255,.08); }
.btn-icon.danger:hover { background: rgba(239,68,68,.1); color: #ef4444; opacity: 1; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: .75rem; }
.btn { padding: .45rem 1rem; border-radius: .6rem; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); cursor: pointer; color: inherit; font-size: .85rem; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-sm { padding: .3rem .75rem; font-size: .8rem; }
.btn-primary { background: hsl(355,70%,58%); border-color: transparent; color: #fff; }
.btn-secondary { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); }

.section { background: rgba(255,255,255,.04); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); }

.plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap: 1rem; }
.plan-card { background: rgba(255,255,255,.05); border-radius: 1rem; border: 1px solid rgba(255,255,255,.1); padding: 1rem; display: flex; gap: .75rem; align-items: flex-start; }
.plan-img img { width: 48px; height: 48px; border-radius: .5rem; object-fit: cover; }
.plan-info { flex: 1; min-width: 0; }
.plan-product { font-weight: 600; font-size: .9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.plan-label { font-size: .85rem; color: hsl(355,70%,58%); font-weight: 600; }
.plan-meta { font-size: .8rem; margin-top: .2rem; }
.plan-subs { margin-top: .4rem; }
.plan-actions { display: flex; flex-direction: column; align-items: flex-end; gap: .4rem; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: hsl(228,4%,15%); border-radius: 1.25rem; border: 1px solid rgba(255,255,255,.12); padding: 1.75rem; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
.modal h2 { margin: 0 0 1.25rem; font-size: 1.2rem; }
.field { margin-bottom: 1rem; }
.field label { display: block; font-size: .82rem; color: #aaa; margin-bottom: .35rem; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1.25rem; }

.dropdown-results { background: hsl(228,4%,18%); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; margin-top: .25rem; max-height: 200px; overflow-y: auto; }
.dropdown-item { padding: .5rem .75rem; cursor: pointer; font-size: .88rem; border-bottom: 1px solid rgba(255,255,255,.05); }
.dropdown-item:hover { background: rgba(255,255,255,.06); }
.dropdown-item:last-child { border-bottom: none; }
.selected-tag { margin-top: .35rem; font-size: .83rem; color: #22c55e; }
</style>
