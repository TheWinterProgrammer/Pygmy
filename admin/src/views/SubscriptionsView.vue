<template>
  <div class="subscriptions-view">
    <div class="view-header">
      <h1>💳 Subscription Plans</h1>
      <button class="btn btn-accent" @click="openPlanModal()">+ New Plan</button>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-pill glass">
        <span class="pill-num">{{ stats.active }}</span>
        <span class="pill-label">Active Members</span>
      </div>
      <div class="stat-pill glass">
        <span class="pill-num">{{ stats.trialing }}</span>
        <span class="pill-label">Trialing</span>
      </div>
      <div class="stat-pill glass">
        <span class="pill-num">{{ stats.cancelled }}</span>
        <span class="pill-label">Cancelled</span>
      </div>
      <div class="stat-pill glass accent-pill">
        <span class="pill-num">€{{ stats.mrr.toFixed(2) }}</span>
        <span class="pill-label">MRR</span>
      </div>
    </div>

    <!-- Plans grid -->
    <h2 style="margin-bottom: 1rem">Plans</h2>
    <div v-if="loadingPlans" class="loading">Loading plans…</div>
    <div v-else-if="plans.length === 0" class="empty-state glass">No subscription plans yet. Create one to get started.</div>
    <div v-else class="plans-grid">
      <div v-for="plan in plans" :key="plan.id" class="plan-card glass" :class="{ inactive: !plan.active }">
        <div class="plan-header">
          <div>
            <h3>{{ plan.name }}</h3>
            <p class="plan-desc">{{ plan.description }}</p>
          </div>
          <div class="plan-actions">
            <button class="btn btn-sm" @click="openPlanModal(plan)">✏️</button>
            <button class="btn btn-sm btn-danger" @click="deletePlan(plan)">🗑️</button>
          </div>
        </div>
        <div class="plan-price">
          <span class="price-big">€{{ plan.price.toFixed(2) }}</span>
          <span class="price-interval"> / {{ plan.interval }}</span>
        </div>
        <div class="plan-features" v-if="plan.features?.length">
          <div v-for="(f, i) in plan.features" :key="i" class="feature-item">✓ {{ f }}</div>
        </div>
        <div class="plan-footer">
          <span class="badge" :class="plan.active ? 'badge-published' : 'badge-draft'">
            {{ plan.active ? 'Active' : 'Inactive' }}
          </span>
          <span v-if="plan.trial_days" class="badge badge-info">{{ plan.trial_days }}d trial</span>
          <span class="plan-sub-count">{{ memberCountByPlan[plan.id] ?? 0 }} member(s)</span>
        </div>
      </div>
    </div>

    <!-- Members table -->
    <div style="margin-top: 2.5rem">
      <div class="section-header">
        <h2>Members</h2>
        <div class="header-controls">
          <input v-model="memberSearch" placeholder="Search by email/name…" class="glass-input" @input="loadMembers" />
          <select v-model="memberStatus" class="glass-select" @change="loadMembers">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
          <button class="btn btn-accent" @click="openGrantModal">+ Grant Access</button>
        </div>
      </div>

      <div class="glass table-wrap">
        <table v-if="members.length">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Period</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id">
              <td>
                <div class="member-info">
                  <strong>{{ m.first_name }} {{ m.last_name }}</strong>
                  <span class="text-muted">{{ m.email }}</span>
                </div>
              </td>
              <td>
                <span>{{ m.plan_name }}</span>
                <span class="text-muted"> (€{{ m.plan_price }}/{{ m.plan_interval }})</span>
              </td>
              <td>
                <span class="badge" :class="statusClass(m.status)">{{ m.status }}</span>
                <span v-if="m.cancel_at_end" class="badge badge-warning" title="Cancels at period end">ends</span>
              </td>
              <td>
                <div v-if="m.current_period_end" class="period-dates">
                  <span>→ {{ fmtDate(m.current_period_end) }}</span>
                </div>
                <span v-else class="text-muted">–</span>
              </td>
              <td>
                <div class="action-row">
                  <select class="glass-select select-sm" :value="m.status" @change="updateStatus(m, $event.target.value)">
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                    <option value="past_due">Past Due</option>
                  </select>
                  <button class="btn btn-sm btn-danger" @click="deleteMember(m)">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">No members found.</div>
      </div>
    </div>

    <!-- Plan modal -->
    <div v-if="showPlanModal" class="modal-backdrop" @click.self="closePlanModal">
      <div class="modal glass">
        <h2>{{ editPlan?.id ? 'Edit Plan' : 'New Plan' }}</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Name *</label>
            <input v-model="planForm.name" class="glass-input" placeholder="Pro Monthly" />
          </div>
          <div class="form-group">
            <label>Price (€)</label>
            <input v-model.number="planForm.price" type="number" step="0.01" class="glass-input" />
          </div>
          <div class="form-group">
            <label>Billing Interval</label>
            <select v-model="planForm.interval" class="glass-select">
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <div class="form-group">
            <label>Trial Days</label>
            <input v-model.number="planForm.trial_days" type="number" class="glass-input" placeholder="0" />
          </div>
          <div class="form-group full">
            <label>Description</label>
            <textarea v-model="planForm.description" class="glass-input" rows="2" />
          </div>
          <div class="form-group full">
            <label>Features (one per line)</label>
            <textarea v-model="planFeaturesText" class="glass-input" rows="4"
              placeholder="Unlimited access&#10;Priority support&#10;Monthly newsletter" />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="planForm.active" />
              Active (visible on pricing page)
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closePlanModal">Cancel</button>
          <button class="btn btn-accent" @click="savePlan" :disabled="savingPlan">
            {{ savingPlan ? 'Saving…' : 'Save Plan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Grant modal -->
    <div v-if="showGrantModal" class="modal-backdrop" @click.self="showGrantModal = false">
      <div class="modal glass">
        <h2>Grant Subscription</h2>
        <div class="form-grid">
          <div class="form-group full">
            <label>Customer Email *</label>
            <input v-model="grantForm.email" class="glass-input" placeholder="customer@example.com" @blur="lookupCustomer" />
            <span v-if="grantCustomer" class="hint success">✓ {{ grantCustomer.first_name }} {{ grantCustomer.last_name }}</span>
            <span v-if="grantCustomerErr" class="hint error">{{ grantCustomerErr }}</span>
          </div>
          <div class="form-group full">
            <label>Plan *</label>
            <select v-model="grantForm.plan_id" class="glass-select">
              <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }} (€{{ p.price }}/{{ p.interval }})</option>
            </select>
          </div>
          <div class="form-group">
            <label>Trial Days</label>
            <input v-model.number="grantForm.trial_days" type="number" class="glass-input" placeholder="0" />
          </div>
          <div class="form-group full">
            <label>Notes</label>
            <input v-model="grantForm.notes" class="glass-input" placeholder="Admin note…" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showGrantModal = false">Cancel</button>
          <button class="btn btn-accent" @click="grantSubscription" :disabled="grantingSub">
            {{ grantingSub ? 'Saving…' : 'Grant Access' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = 'http://localhost:3200/api'

const plans = ref([])
const members = ref([])
const stats = ref(null)
const loadingPlans = ref(true)
const memberSearch = ref('')
const memberStatus = ref('')

// Plan modal
const showPlanModal = ref(false)
const editPlan = ref(null)
const savingPlan = ref(false)
const planForm = reactive({
  name: '', description: '', price: 9.99, interval: 'month',
  trial_days: 0, active: true, sort_order: 0
})
const planFeaturesText = ref('')

// Grant modal
const showGrantModal = ref(false)
const grantingSub = ref(false)
const grantForm = reactive({ email: '', plan_id: '', trial_days: 0, notes: '' })
const grantCustomer = ref(null)
const grantCustomerErr = ref('')

const memberCountByPlan = computed(() => {
  const counts = {}
  members.value.forEach(m => {
    if (m.status === 'active' || m.status === 'trialing') {
      counts[m.plan_id] = (counts[m.plan_id] || 0) + 1
    }
  })
  return counts
})

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, ...(opts.headers || {}) }
  })
  return res.json()
}

async function loadAll() {
  loadingPlans.value = true
  const [plansData, statsData] = await Promise.all([
    apiFetch('/subscriptions/plans'),
    apiFetch('/subscriptions/stats')
  ])
  plans.value = plansData
  stats.value = statsData
  loadingPlans.value = false
  await loadMembers()
}

async function loadMembers() {
  const params = new URLSearchParams({ q: memberSearch.value, limit: 100 })
  if (memberStatus.value) params.set('status', memberStatus.value)
  const data = await apiFetch(`/subscriptions/members?${params}`)
  members.value = data.members || []
}

function openPlanModal(plan = null) {
  editPlan.value = plan
  if (plan) {
    Object.assign(planForm, {
      name: plan.name, description: plan.description,
      price: plan.price, interval: plan.interval,
      trial_days: plan.trial_days, active: !!plan.active,
      sort_order: plan.sort_order
    })
    planFeaturesText.value = (plan.features || []).join('\n')
  } else {
    Object.assign(planForm, { name: '', description: '', price: 9.99, interval: 'month', trial_days: 0, active: true, sort_order: 0 })
    planFeaturesText.value = ''
  }
  showPlanModal.value = true
}

function closePlanModal() { showPlanModal.value = false; editPlan.value = null }

async function savePlan() {
  if (!planForm.name) return alert('Name is required')
  savingPlan.value = true
  const features = planFeaturesText.value.split('\n').map(l => l.trim()).filter(Boolean)
  const body = { ...planForm, features }
  const result = editPlan.value?.id
    ? await apiFetch(`/subscriptions/plans/${editPlan.value.id}`, { method: 'PUT', body: JSON.stringify(body) })
    : await apiFetch('/subscriptions/plans', { method: 'POST', body: JSON.stringify(body) })
  savingPlan.value = false
  if (result.error) { alert(result.error); return }
  closePlanModal()
  await loadAll()
}

async function deletePlan(plan) {
  if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return
  const r = await apiFetch(`/subscriptions/plans/${plan.id}`, { method: 'DELETE' })
  if (r.error) { alert(r.error); return }
  await loadAll()
}

function openGrantModal() {
  Object.assign(grantForm, { email: '', plan_id: plans.value[0]?.id || '', trial_days: 0, notes: '' })
  grantCustomer.value = null
  grantCustomerErr.value = ''
  showGrantModal.value = true
}

async function lookupCustomer() {
  grantCustomer.value = null
  grantCustomerErr.value = ''
  if (!grantForm.email) return
  const data = await apiFetch(`/customers?q=${encodeURIComponent(grantForm.email)}&limit=1`)
  const cust = data.customers?.[0]
  if (cust && cust.email === grantForm.email) {
    grantCustomer.value = cust
    grantForm.customer_id = cust.id
  } else {
    grantCustomerErr.value = 'Customer not found. They must register first.'
  }
}

async function grantSubscription() {
  if (!grantCustomer.value) { alert('Customer not found'); return }
  if (!grantForm.plan_id) { alert('Select a plan'); return }
  grantingSub.value = true
  const r = await apiFetch('/subscriptions/members', {
    method: 'POST',
    body: JSON.stringify({ customer_id: grantCustomer.value.id, plan_id: grantForm.plan_id, trial_days: grantForm.trial_days, notes: grantForm.notes })
  })
  grantingSub.value = false
  if (r.error) { alert(r.error); return }
  showGrantModal.value = false
  await loadAll()
}

async function updateStatus(member, newStatus) {
  await apiFetch(`/subscriptions/members/${member.id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) })
  await loadAll()
}

async function deleteMember(m) {
  if (!confirm(`Remove subscription for ${m.email}?`)) return
  await apiFetch(`/subscriptions/members/${m.id}`, { method: 'DELETE' })
  await loadAll()
}

function statusClass(status) {
  const map = { active: 'badge-published', trialing: 'badge-info', cancelled: 'badge-draft', expired: 'badge-draft', past_due: 'badge-warning' }
  return map[status] || 'badge-draft'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
}

onMounted(loadAll)
</script>

<style scoped>
.view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.stats-strip { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
.stat-pill { padding: .6rem 1.2rem; border-radius: 2rem; display: flex; flex-direction: column; align-items: center; min-width: 8rem; }
.pill-num { font-size: 1.5rem; font-weight: 700; color: var(--text); }
.pill-label { font-size: .75rem; color: var(--muted); }
.accent-pill .pill-num { color: var(--accent); }
.plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
.plan-card { padding: 1.5rem; border-radius: 1rem; }
.plan-card.inactive { opacity: .55; }
.plan-header { display: flex; justify-content: space-between; gap: .5rem; margin-bottom: 1rem; }
.plan-header h3 { margin: 0 0 .25rem; font-size: 1.1rem; }
.plan-desc { color: var(--muted); font-size: .85rem; margin: 0; }
.plan-actions { display: flex; gap: .4rem; flex-shrink: 0; }
.price-big { font-size: 1.8rem; font-weight: 700; color: var(--accent); }
.price-interval { color: var(--muted); }
.plan-features { margin-top: .8rem; }
.feature-item { font-size: .82rem; color: var(--muted); margin: .25rem 0; }
.plan-footer { margin-top: 1rem; display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.plan-sub-count { margin-left: auto; font-size: .8rem; color: var(--muted); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: .75rem; }
.header-controls { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }
.table-wrap { border-radius: 1rem; overflow: hidden; padding: 0; }
table { width: 100%; border-collapse: collapse; }
thead th { background: rgba(255,255,255,.05); padding: .75rem 1rem; text-align: left; font-size: .8rem; text-transform: uppercase; color: var(--muted); }
tbody tr { border-bottom: 1px solid rgba(255,255,255,.05); }
tbody tr:hover { background: rgba(255,255,255,.03); }
tbody td { padding: .75rem 1rem; }
.member-info { display: flex; flex-direction: column; gap: .15rem; }
.member-info strong { font-size: .9rem; }
.period-dates { font-size: .8rem; color: var(--muted); }
.action-row { display: flex; gap: .5rem; align-items: center; }
.select-sm { padding: .3rem .6rem; font-size: .82rem; border-radius: .4rem; }
.badge-info { background: rgba(59,130,246,.25); color: #93c5fd; }
.badge-warning { background: rgba(251,191,36,.25); color: #fde68a; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal { width: 100%; max-width: 560px; border-radius: 1.25rem; padding: 2rem; }
.modal h2 { margin: 0 0 1.5rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: .4rem; }
.form-group.full { grid-column: 1 / -1; }
.modal-footer { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.5rem; }
.checkbox-label { display: flex; align-items: center; gap: .5rem; cursor: pointer; font-size: .9rem; }
.hint { font-size: .8rem; margin-top: .2rem; }
.hint.success { color: #4ade80; }
.hint.error { color: var(--accent); }
.empty-state { padding: 2rem; text-align: center; color: var(--muted); border-radius: 1rem; }
.loading { padding: 1rem; color: var(--muted); }
</style>
