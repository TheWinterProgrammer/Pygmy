<template>
  <div>
    <div class="page-header">
      <h1>🎯 Customer Segments</h1>
      <button class="btn btn-primary" @click="openCreate">+ New Segment</button>
    </div>

    <p class="text-muted" style="margin-bottom:1.5rem">
      Create dynamic customer groups based on behavior. Use segments to enroll customers in email sequences or analyze your audience.
    </p>

    <!-- Segments list -->
    <div class="glass section">
      <div v-if="loading" class="loading-bar"></div>
      <div v-else-if="!segments.length" class="empty-state">
        <p>No segments yet. Define your first customer group!</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Conditions</th>
            <th>Members</th>
            <th>Dynamic</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="seg in segments" :key="seg.id">
            <td>
              <strong>{{ seg.name }}</strong>
              <div class="text-muted small" v-if="seg.description">{{ seg.description }}</div>
            </td>
            <td>
              <div v-if="seg.conditions && seg.conditions.length">
                <span v-for="(c, i) in seg.conditions" :key="i" class="badge badge-ghost" style="margin:0.1rem">
                  {{ conditionLabel(c) }}
                </span>
              </div>
              <span v-else class="text-muted small">All customers</span>
            </td>
            <td>
              <strong>{{ seg.member_count }}</strong>
              <button class="btn btn-sm btn-ghost" style="margin-left:0.5rem" @click="evaluate(seg)" title="Re-evaluate">🔄</button>
            </td>
            <td>
              <span class="badge" :class="seg.dynamic ? 'badge-success' : 'badge-ghost'">{{ seg.dynamic ? 'Dynamic' : 'Static' }}</span>
            </td>
            <td>
              <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
                <button class="btn btn-sm btn-ghost" @click="openDetail(seg)">👁️ View</button>
                <button class="btn btn-sm btn-ghost" @click="openEdit(seg)">✏️ Edit</button>
                <button class="btn btn-sm btn-primary" @click="openEnrollModal(seg)">📧 Enroll</button>
                <button class="btn btn-sm btn-danger" @click="confirmDelete(seg)">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal glass wide-modal">
        <h2>{{ editing ? 'Edit Segment' : 'New Segment' }}</h2>
        <div class="form-group">
          <label>Name *</label>
          <input v-model="form.name" class="input" placeholder="VIP Customers" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input v-model="form.description" class="input" placeholder="Optional description" />
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" v-model="form.dynamic" style="margin-right:0.5rem" />
            Dynamic (auto-recalculate membership on update)
          </label>
        </div>

        <h3 style="margin:1rem 0 0.5rem">Conditions</h3>
        <p class="text-muted small">All conditions must match (AND logic). Leave empty to match all customers.</p>

        <div v-for="(cond, idx) in form.conditions" :key="idx" class="condition-row glass">
          <select v-model="cond.field" class="input input-sm">
            <option value="total_orders">Total Orders</option>
            <option value="total_spent">Total Spent (€)</option>
            <option value="last_order_days">Last Order (days ago)</option>
            <option value="has_subscription">Has Active Subscription</option>
            <option value="points_balance">Points Balance</option>
            <option value="active">Account Status</option>
            <option value="country">Country (address)</option>
          </select>

          <select v-model="cond.operator" class="input input-sm" v-if="operatorOptions(cond.field).length">
            <option v-for="op in operatorOptions(cond.field)" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>

          <input v-model="cond.value" class="input input-sm" v-if="showValueInput(cond.field)"
            :placeholder="valuePlaceholder(cond.field)" style="min-width:100px" />

          <select v-model="cond.value" class="input input-sm" v-else-if="cond.field === 'has_subscription' || cond.field === 'active'">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>

          <button class="btn btn-sm btn-danger" @click="form.conditions.splice(idx, 1)">✕</button>
        </div>

        <button class="btn btn-ghost" @click="addCondition" style="margin:0.5rem 0">+ Add Condition</button>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveSegment" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save Segment' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div class="modal-overlay" v-if="showDetail" @click.self="showDetail = false">
      <div class="modal glass wide-modal">
        <h2>👁️ {{ activeSegment?.name }}</h2>
        <p class="text-muted small">
          {{ activeSegment?.member_count }} matching customers
          <span v-if="activeSegment?.dynamic"> · Dynamic segment</span>
        </p>

        <div v-if="detailMembers.length === 0" class="empty-state small">No matching customers found.</div>
        <table v-else class="data-table">
          <thead><tr><th>Email</th><th>Name</th></tr></thead>
          <tbody>
            <tr v-for="m in detailMembers" :key="m.id">
              <td>{{ m.email }}</td>
              <td>{{ [m.first_name, m.last_name].filter(Boolean).join(' ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="activeSegment?.member_count > 100" class="text-muted small" style="margin-top:0.5rem">
          Showing first 100 of {{ activeSegment.member_count }} customers.
        </p>
        <div class="modal-actions"><button class="btn btn-ghost" @click="showDetail = false">Close</button></div>
      </div>
    </div>

    <!-- Enroll to Sequence Modal -->
    <div class="modal-overlay" v-if="showEnroll" @click.self="showEnroll = false">
      <div class="modal glass">
        <h2>📧 Enroll to Sequence</h2>
        <p class="text-muted small">Enroll all {{ activeSegment?.member_count }} members of <strong>{{ activeSegment?.name }}</strong> into an email sequence.</p>
        <div class="form-group">
          <label>Email Sequence</label>
          <select v-model="enrollSeqId" class="input">
            <option value="">— Select sequence —</option>
            <option v-for="s in sequences_list" :key="s.id" :value="s.id">{{ s.name }} ({{ s.status }})</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showEnroll = false">Cancel</button>
          <button class="btn btn-primary" @click="doEnroll" :disabled="!enrollSeqId || enrolling">
            {{ enrolling ? 'Enrolling…' : 'Enroll All' }}
          </button>
        </div>
        <p v-if="enrollResult" class="text-muted small" style="margin-top:0.5rem">{{ enrollResult }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api.js'

const segments = ref([])
const sequences_list = ref([])
const loading = ref(true)
const saving = ref(false)
const showModal = ref(false)
const showDetail = ref(false)
const showEnroll = ref(false)
const editing = ref(null)
const activeSegment = ref(null)
const detailMembers = ref([])
const enrollSeqId = ref('')
const enrolling = ref(false)
const enrollResult = ref('')

const form = ref({ name: '', description: '', dynamic: true, conditions: [] })

const OPERATORS = {
  total_orders: [{ value: 'gte', label: '≥' }, { value: 'gt', label: '>' }, { value: 'lte', label: '≤' }, { value: 'eq', label: '=' }],
  total_spent: [{ value: 'gte', label: '≥' }, { value: 'gt', label: '>' }, { value: 'lte', label: '≤' }],
  last_order_days: [{ value: 'within', label: 'within (days)' }, { value: 'older_than', label: 'older than (days)' }],
  has_subscription: [],
  points_balance: [{ value: 'gte', label: '≥' }, { value: 'lte', label: '≤' }],
  active: [],
  country: [{ value: 'eq', label: '=' }],
}

function operatorOptions(field) { return OPERATORS[field] || [] }
function showValueInput(field) { return !['has_subscription', 'active'].includes(field) }
function valuePlaceholder(field) {
  if (field === 'last_order_days') return 'days'
  if (field === 'country') return 'DE'
  return '0'
}

function conditionLabel(c) {
  const fieldLabels = { total_orders: 'Orders', total_spent: 'Spent', last_order_days: 'Last order', has_subscription: 'Subscriber', points_balance: 'Points', active: 'Active', country: 'Country' }
  const opLabels = { gte: '≥', gt: '>', lte: '≤', eq: '=', within: 'within', older_than: '>' }
  return `${fieldLabels[c.field] || c.field} ${opLabels[c.operator] || c.operator || ''} ${c.value}`
}

async function load() {
  loading.value = true
  try {
    const [segRes, seqRes] = await Promise.all([
      api.get('/customer-segments'),
      api.get('/email-sequences')
    ])
    segments.value = segRes.data
    sequences_list.value = seqRes.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', description: '', dynamic: true, conditions: [] }
  showModal.value = true
}

function openEdit(seg) {
  editing.value = seg
  form.value = { name: seg.name, description: seg.description || '', dynamic: !!seg.dynamic, conditions: JSON.parse(JSON.stringify(seg.conditions || [])) }
  showModal.value = true
}

function addCondition() {
  form.value.conditions.push({ field: 'total_orders', operator: 'gte', value: '1' })
}

async function saveSegment() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/customer-segments/${editing.value.id}`, form.value)
    } else {
      await api.post('/customer-segments', form.value)
    }
    showModal.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function evaluate(seg) {
  await api.post(`/customer-segments/${seg.id}/evaluate`)
  await load()
}

async function openDetail(seg) {
  activeSegment.value = seg
  const res = await api.get(`/customer-segments/${seg.id}`)
  detailMembers.value = res.data.members_preview || []
  showDetail.value = true
}

async function openEnrollModal(seg) {
  activeSegment.value = seg
  enrollSeqId.value = ''
  enrollResult.value = ''
  showEnroll.value = true
}

async function doEnroll() {
  if (!enrollSeqId.value) return
  enrolling.value = true
  try {
    const res = await api.post(`/customer-segments/${activeSegment.value.id}/enroll`, { sequence_id: enrollSeqId.value })
    enrollResult.value = `✓ Enrolled: ${res.data.enrolled}, Skipped: ${res.data.skipped}`
  } finally {
    enrolling.value = false
  }
}

async function confirmDelete(seg) {
  if (!confirm(`Delete segment "${seg.name}"?`)) return
  await api.delete(`/customer-segments/${seg.id}`)
  await load()
}

onMounted(load)
</script>

<style scoped>
.condition-row { display:flex; gap:0.5rem; align-items:center; padding:0.6rem 0.75rem; margin-bottom:0.5rem; border-radius:0.75rem; flex-wrap:wrap }
.input-sm { padding:0.35rem 0.6rem; font-size:0.85rem }
.badge { padding:0.2rem 0.6rem; border-radius:1rem; font-size:0.72rem; font-weight:600 }
.badge-success { background:rgba(34,197,94,0.2); color:#4ade80 }
.badge-ghost { background:rgba(255,255,255,0.08); color:var(--muted) }
.wide-modal { max-width:720px; max-height:85vh; overflow-y:auto }
.empty-state.small { padding:1rem; text-align:center; color:var(--muted) }
</style>
