<template>
  <div class="disputes-view">
    <div class="page-header">
      <div>
        <h1>⚖️ Order Disputes</h1>
        <p class="subtitle">Manage customer dispute requests and resolutions</p>
      </div>
      <div class="header-actions">
        <select v-model="filterStatus" @change="load" class="form-input" style="width:150px">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
          <option value="closed">Closed</option>
        </select>
        <input v-model="q" @input="debounceLoad" placeholder="Search…" class="form-input" style="width:200px" />
      </div>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card accent" v-if="stats.open > 0">
        <div class="stat-value red">{{ stats.open || 0 }}</div>
        <div class="stat-label">Open</div>
      </div>
      <div class="stat-card" v-else>
        <div class="stat-value">0</div>
        <div class="stat-label">Open</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.under_review || 0 }}</div>
        <div class="stat-label">Under Review</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.resolved || 0 }}</div>
        <div class="stat-label">Resolved</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.rejected || 0 }}</div>
        <div class="stat-label">Rejected</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmt_currency(stats.total_refunded || 0) }}</div>
        <div class="stat-label">Total Refunded</div>
      </div>
    </div>

    <!-- Disputes Table -->
    <div class="glass section">
      <div v-if="disputes.length === 0 && !loading" class="empty-state">
        <div class="empty-icon">⚖️</div>
        <p>No disputes found.</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Order</th>
            <th>Customer</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in disputes" :key="d.id">
            <td><code class="mono">{{ d.reference }}</code></td>
            <td><code class="mono">{{ d.order_number }}</code></td>
            <td>
              <div class="customer-info">
                <strong>{{ d.customer_name || '—' }}</strong>
                <span class="email">{{ d.customer_email }}</span>
              </div>
            </td>
            <td>
              <span class="reason-badge">{{ reasonLabel(d.reason) }}</span>
            </td>
            <td><span :class="['status-pill', `status-${d.status}`]">{{ statusLabel(d.status) }}</span></td>
            <td class="date-col">{{ fmt(d.created_at) }}</td>
            <td>
              <div class="row-actions">
                <button class="btn-sm btn-primary" @click="openDetail(d)">📋 Manage</button>
                <button class="btn-sm btn-danger" @click="del(d)">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination" v-if="total > limit">
        <button @click="page--; load()" :disabled="page <= 1" class="btn-ghost">← Prev</button>
        <span>Page {{ page }} of {{ Math.ceil(total / limit) }}</span>
        <button @click="page++; load()" :disabled="page >= Math.ceil(total / limit)" class="btn-ghost">Next →</button>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="detail" class="modal-overlay" @click.self="detail = null">
      <div class="modal glass" style="max-width:620px">
        <div class="modal-header">
          <div>
            <h2>Dispute {{ detail.reference }}</h2>
            <span :class="['status-pill', `status-${detail.status}`]">{{ statusLabel(detail.status) }}</span>
          </div>
          <button class="close-btn" @click="detail = null">✕</button>
        </div>
        <div class="modal-body">
          <!-- Customer & Order Info -->
          <div class="info-grid">
            <div class="info-item"><span class="info-label">Order</span><code class="mono">{{ detail.order_number }}</code></div>
            <div class="info-item"><span class="info-label">Customer</span><span>{{ detail.customer_name || '—' }}</span></div>
            <div class="info-item"><span class="info-label">Email</span><span>{{ detail.customer_email }}</span></div>
            <div class="info-item"><span class="info-label">Reason</span><span>{{ reasonLabel(detail.reason) }}</span></div>
            <div class="info-item"><span class="info-label">Submitted</span><span>{{ fmt(detail.created_at) }}</span></div>
            <div class="info-item" v-if="detail.resolved_at"><span class="info-label">Resolved</span><span>{{ fmt(detail.resolved_at) }}</span></div>
          </div>

          <!-- Description -->
          <div class="field">
            <label class="label">Customer Description</label>
            <div class="desc-box">{{ detail.description }}</div>
          </div>

          <!-- Evidence -->
          <div class="field" v-if="detail.evidence_urls && detail.evidence_urls.length">
            <label class="label">Evidence URLs</label>
            <ul class="evidence-list">
              <li v-for="url in detail.evidence_urls" :key="url">
                <a :href="url" target="_blank" rel="noopener">{{ url }}</a>
              </li>
            </ul>
          </div>

          <!-- Admin Actions -->
          <div class="field">
            <label class="label">Update Status</label>
            <select v-model="detail.status" class="form-input">
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div class="field">
            <label class="label">Resolution (shown to customer)</label>
            <textarea v-model="detail.resolution" class="form-input" rows="3" placeholder="Explain how this dispute was resolved…"></textarea>
          </div>

          <div class="field">
            <label class="label">Refund Amount (€)</label>
            <input v-model.number="detail.refund_amount" type="number" step="0.01" min="0" class="form-input" placeholder="0.00" />
          </div>

          <div class="field">
            <label class="label">Internal Admin Notes</label>
            <textarea v-model="detail.admin_notes" class="form-input" rows="3" placeholder="Internal notes (not visible to customer)…"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="detail = null">Cancel</button>
          <button class="btn btn-primary" @click="saveDetail" :disabled="saving">
            {{ saving ? 'Saving…' : '💾 Update Dispute' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../api.js'

const { get, put, del: apiDel } = useApi()

const disputes = ref([])
const total = ref(0)
const stats = ref(null)
const loading = ref(false)
const saving = ref(false)
const detail = ref(null)
const filterStatus = ref('')
const q = ref('')
const page = ref(1)
const limit = 25
let debounce = null

function debounceLoad () {
  clearTimeout(debounce)
  debounce = setTimeout(() => { page.value = 1; load() }, 350)
}

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit, offset: (page.value - 1) * limit })
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (q.value) params.set('q', q.value)
    const data = await get(`/api/disputes?${params}`)
    disputes.value = data.disputes || []
    total.value = data.total || 0
    stats.value = data.stats
  } finally { loading.value = false }
}

function openDetail (d) {
  detail.value = { ...d }
}

async function saveDetail () {
  saving.value = true
  try {
    await put(`/api/disputes/${detail.value.id}`, {
      status: detail.value.status,
      resolution: detail.value.resolution,
      refund_amount: detail.value.refund_amount,
      admin_notes: detail.value.admin_notes,
    })
    detail.value = null
    await load()
  } finally { saving.value = false }
}

async function del (d) {
  if (!confirm(`Delete dispute ${d.reference}?`)) return
  await apiDel(`/api/disputes/${d.id}`)
  await load()
}

function reasonLabel (r) {
  const map = {
    not_received: '📦 Not Received',
    wrong_item: '❌ Wrong Item',
    damaged: '💔 Damaged',
    not_as_described: '📋 Not as Described',
    unauthorized: '🔒 Unauthorized Charge',
    other: '❓ Other',
  }
  return map[r] || r
}

function statusLabel (s) {
  const map = { open: '🟡 Open', under_review: '🔵 Under Review', resolved: '✅ Resolved', rejected: '❌ Rejected', closed: '⬛ Closed' }
  return map[s] || s
}

function fmt (d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmt_currency (v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)
}

onMounted(load)
</script>

<style scoped>
.disputes-view { max-width: 1100px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.6rem; font-weight: 700; }
.subtitle { color: rgba(255,255,255,.5); font-size: .9rem; margin-top: .2rem; }
.header-actions { display: flex; gap: .75rem; align-items: center; }
.stats-strip { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { background: rgba(255,255,255,.05); border-radius: 1rem; padding: .8rem 1.2rem; min-width: 90px; text-align: center; }
.stat-card.accent { background: rgba(244,67,54,.1); border: 1px solid rgba(244,67,54,.3); }
.stat-value { font-size: 1.5rem; font-weight: 700; }
.stat-value.red { color: #f44336; }
.stat-label { font-size: .75rem; color: rgba(255,255,255,.5); margin-top: .2rem; }
.glass { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; }
.section { padding: 1.5rem; margin-bottom: 1.5rem; overflow-x: auto; }
.empty-state { text-align: center; padding: 3rem 1rem; color: rgba(255,255,255,.4); }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.table { width: 100%; border-collapse: collapse; font-size: .875rem; }
.table th { text-align: left; padding: .75rem; color: rgba(255,255,255,.5); font-weight: 600; border-bottom: 1px solid rgba(255,255,255,.1); white-space: nowrap; }
.table td { padding: .75rem; border-bottom: 1px solid rgba(255,255,255,.06); vertical-align: middle; }
.mono { font-family: monospace; font-size: .85rem; background: rgba(255,255,255,.08); padding: .15rem .4rem; border-radius: .3rem; }
.customer-info { display: flex; flex-direction: column; gap: .15rem; }
.email { font-size: .75rem; color: rgba(255,255,255,.5); }
.reason-badge { background: rgba(255,255,255,.08); border-radius: .4rem; padding: .2rem .5rem; font-size: .75rem; }
.date-col { color: rgba(255,255,255,.5); font-size: .8rem; white-space: nowrap; }
.row-actions { display: flex; gap: .4rem; }
.status-pill { border-radius: .4rem; padding: .2rem .6rem; font-size: .75rem; font-weight: 600; white-space: nowrap; }
.status-open { background: rgba(255,200,0,.2); color: #ffc107; }
.status-under_review { background: rgba(66,133,244,.2); color: #4285f4; }
.status-resolved { background: rgba(76,175,80,.2); color: #4caf50; }
.status-rejected { background: rgba(244,67,54,.2); color: #f44336; }
.status-closed { background: rgba(158,158,158,.2); color: #9e9e9e; }
.btn-sm { padding: .3rem .8rem; border-radius: .5rem; border: none; cursor: pointer; font-size: .8rem; font-weight: 600; }
.btn-primary { background: var(--accent, hsl(355,70%,58%)); color: #fff; }
.btn-danger { background: rgba(244,67,54,.2); color: #f44336; }
.btn-ghost { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); border: none; border-radius: .5rem; padding: .4rem .9rem; cursor: pointer; font-size: .875rem; font-weight: 600; }
.loading-bar { height: 3px; background: var(--accent); border-radius: 2px; animation: loading 1s infinite; margin-bottom: 1rem; }
@keyframes loading { 0%,100%{opacity:.3} 50%{opacity:1} }
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1rem; }
.modal { width: 100%; border-radius: 1.5rem; overflow: hidden; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.1); }
.modal-header h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: .3rem; }
.close-btn { background: none; border: none; color: rgba(255,255,255,.5); font-size: 1.2rem; cursor: pointer; padding: .2rem; }
.modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.1); }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.info-item { display: flex; flex-direction: column; gap: .2rem; }
.info-label { font-size: .75rem; color: rgba(255,255,255,.4); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.desc-box { background: rgba(255,255,255,.05); border-radius: .75rem; padding: .8rem 1rem; font-size: .875rem; line-height: 1.6; color: rgba(255,255,255,.8); white-space: pre-wrap; }
.evidence-list { padding-left: 1.2rem; }
.evidence-list a { color: #4285f4; font-size: .85rem; }
.field { display: flex; flex-direction: column; gap: .4rem; }
.label { font-size: .85rem; font-weight: 600; color: rgba(255,255,255,.7); }
.form-input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; padding: .6rem .9rem; color: #fff; font-size: .9rem; width: 100%; }
textarea.form-input { resize: vertical; }
.btn { padding: .6rem 1.4rem; border-radius: .8rem; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; }
</style>
