<template>
  <div class="quote-requests-view">
    <div class="view-header">
      <div>
        <h1>📋 Quote Requests</h1>
        <p class="subtitle">Manage B2B quote requests from customers</p>
      </div>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card accent" v-if="stats.pending > 0">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card" v-else>
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.quoted }}</div>
        <div class="stat-label">Quoted</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.accepted }}</div>
        <div class="stat-label">Accepted</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">€{{ (stats.total_value || 0).toFixed(2) }}</div>
        <div class="stat-label">Total Value</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <input v-model="search" @input="fetchQuotes" placeholder="Search by name, email, company..." class="search-input" />
      <select v-model="statusFilter" @change="fetchQuotes" class="status-select">
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="reviewing">Reviewing</option>
        <option value="quoted">Quoted</option>
        <option value="accepted">Accepted</option>
        <option value="rejected">Rejected</option>
        <option value="expired">Expired</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass-card">
      <div v-if="loading" class="loading-state">Loading...</div>
      <div v-else-if="!quotes.length" class="empty-state">
        <p>📋 No quote requests found.</p>
        <p class="hint">Quote requests appear when customers submit them from the public site.</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Customer</th>
            <th>Company</th>
            <th>Items</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in quotes" :key="q.id" @click="openQuote(q)" class="clickable-row">
            <td><code class="ref-code">{{ q.reference }}</code></td>
            <td>
              <div class="customer-info">
                <strong>{{ q.customer_name }}</strong>
                <small>{{ q.customer_email }}</small>
              </div>
            </td>
            <td>{{ q.company_name || '—' }}</td>
            <td>
              <span class="items-badge">{{ q.items.length }} item{{ q.items.length !== 1 ? 's' : '' }}</span>
            </td>
            <td><span class="status-pill" :class="q.status">{{ q.status }}</span></td>
            <td>{{ formatDate(q.created_at) }}</td>
            <td @click.stop>
              <button class="btn-icon" @click="openQuote(q)" title="View / Edit">✏️</button>
              <button class="btn-icon danger" @click="deleteQuote(q)" title="Delete">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div class="modal-overlay" v-if="selected" @click.self="selected = null">
      <div class="modal glass-card large">
        <div class="modal-header">
          <div>
            <h2>Quote {{ selected.reference }}</h2>
            <span class="status-pill" :class="selected.status">{{ selected.status }}</span>
          </div>
          <button class="btn-close" @click="selected = null">✕</button>
        </div>

        <div class="modal-body two-col">
          <!-- Left: Customer & Items -->
          <div>
            <section class="info-section">
              <h3>Customer</h3>
              <div class="info-grid">
                <label>Name</label><span>{{ selected.customer_name }}</span>
                <label>Email</label><a :href="'mailto:' + selected.customer_email">{{ selected.customer_email }}</a>
                <label>Phone</label><span>{{ selected.customer_phone || '—' }}</span>
                <label>Company</label><span>{{ selected.company_name || '—' }}</span>
                <label>Submitted</label><span>{{ formatDate(selected.created_at) }}</span>
              </div>
            </section>

            <section class="info-section">
              <h3>Requested Items</h3>
              <table class="items-table">
                <thead>
                  <tr><th>Product</th><th>Qty</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(item, i) in selected.items" :key="i">
                    <td>{{ item.product_name || item.product_id || 'Unknown' }}</td>
                    <td>{{ item.qty || 1 }}</td>
                    <td>{{ item.notes || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="info-section" v-if="selected.notes">
              <h3>Customer Notes</h3>
              <p class="notes-text">{{ selected.notes }}</p>
            </section>
          </div>

          <!-- Right: Admin Response -->
          <div>
            <section class="info-section">
              <h3>Admin Response</h3>
              <div class="form-group">
                <label>Status</label>
                <select v-model="editData.status" class="form-input">
                  <option value="pending">Pending</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="quoted">Quoted</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div class="form-group">
                <label>Quoted Amount (€)</label>
                <input v-model="editData.quoted_amount" type="number" step="0.01" min="0" class="form-input" placeholder="0.00" />
              </div>
              <div class="form-group">
                <label>Valid Until</label>
                <input v-model="editData.valid_until" type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label>Admin Notes (sent to customer when status changes to "quoted" or "rejected")</label>
                <textarea v-model="editData.admin_notes" class="form-input" rows="4" placeholder="Add notes or terms..."></textarea>
              </div>
              <div class="btn-row">
                <button class="btn btn-primary" @click="saveQuote" :disabled="saving">
                  {{ saving ? 'Saving...' : '💾 Save & Notify Customer' }}
                </button>
              </div>
              <p class="save-hint">Customer will receive an email when status changes to "quoted" or "rejected".</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../api.js'

const quotes = ref([])
const stats = ref(null)
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const selected = ref(null)
const saving = ref(false)
const editData = reactive({ status: '', quoted_amount: '', valid_until: '', admin_notes: '' })

async function fetchQuotes () {
  loading.value = true
  try {
    const params = new URLSearchParams({ q: search.value, status: statusFilter.value })
    const data = await api.get(`/api/quote-requests?${params}`)
    quotes.value = data.quotes || []
  } finally {
    loading.value = false
  }
}

async function fetchStats () {
  try { stats.value = await api.get('/api/quote-requests/stats/summary') } catch {}
}

function openQuote (q) {
  selected.value = q
  editData.status       = q.status
  editData.quoted_amount = q.quoted_amount || ''
  editData.valid_until  = q.valid_until || ''
  editData.admin_notes  = q.admin_notes || ''
}

async function saveQuote () {
  saving.value = true
  try {
    await api.put(`/api/quote-requests/${selected.value.id}`, { ...editData })
    // Update local
    const idx = quotes.value.findIndex(q => q.id === selected.value.id)
    if (idx !== -1) {
      quotes.value[idx] = { ...quotes.value[idx], ...editData }
      selected.value = { ...selected.value, ...editData }
    }
    await fetchStats()
  } finally {
    saving.value = false
  }
}

async function deleteQuote (q) {
  if (!confirm(`Delete quote ${q.reference}?`)) return
  await api.delete(`/api/quote-requests/${q.id}`)
  quotes.value = quotes.value.filter(x => x.id !== q.id)
  if (selected.value?.id === q.id) selected.value = null
  fetchStats()
}

function formatDate (d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => { fetchQuotes(); fetchStats() })
</script>

<style scoped>
.quote-requests-view { padding: 1.5rem; }
.view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.subtitle { color: var(--text-muted, #888); margin-top: .25rem; }

.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: var(--surface, hsl(228,4%,15%)); border-radius: 1rem; padding: 1rem 1.5rem; min-width: 100px; }
.stat-card.accent { border: 1px solid var(--accent, hsl(355,70%,58%)); }
.stat-value { font-size: 1.6rem; font-weight: 700; }
.stat-label { font-size: .8rem; color: var(--text-muted, #888); }

.filter-bar { display: flex; gap: .75rem; margin-bottom: 1rem; }
.search-input { flex: 1; background: var(--surface); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; padding: .6rem 1rem; color: inherit; }
.status-select { background: var(--surface); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; padding: .6rem 1rem; color: inherit; }

.glass-card { background: var(--surface); border-radius: 1rem; padding: 1rem; border: 1px solid rgba(255,255,255,.08); }
.loading-state, .empty-state { text-align: center; padding: 3rem; color: #888; }
.hint { font-size: .85rem; margin-top: .5rem; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th { text-align: left; padding: .75rem 1rem; color: #888; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid rgba(255,255,255,.08); }
.data-table td { padding: .75rem 1rem; border-bottom: 1px solid rgba(255,255,255,.05); }
.clickable-row { cursor: pointer; }
.clickable-row:hover { background: rgba(255,255,255,.03); }

.customer-info { display: flex; flex-direction: column; }
.customer-info small { color: #888; font-size: .8rem; }
.ref-code { background: rgba(255,255,255,.07); padding: .2rem .5rem; border-radius: .4rem; font-size: .85rem; letter-spacing: .05em; }
.items-badge { background: rgba(255,255,255,.1); padding: .2rem .6rem; border-radius: 1rem; font-size: .8rem; }

.status-pill { padding: .25rem .75rem; border-radius: 2rem; font-size: .8rem; font-weight: 600; text-transform: capitalize; }
.status-pill.pending  { background: rgba(234,179,8,.15); color: #eab308; }
.status-pill.reviewing{ background: rgba(59,130,246,.15); color: #60a5fa; }
.status-pill.quoted   { background: rgba(168,85,247,.15); color: #c084fc; }
.status-pill.accepted { background: rgba(34,197,94,.15); color: #4ade80; }
.status-pill.rejected { background: rgba(239,68,68,.15); color: #f87171; }
.status-pill.expired  { background: rgba(107,114,128,.15); color: #9ca3af; }

.btn-icon { background: none; border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .35rem .6rem; cursor: pointer; color: inherit; margin-left: .25rem; }
.btn-icon:hover { background: rgba(255,255,255,.07); }
.btn-icon.danger:hover { background: rgba(239,68,68,.15); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; overflow-y: auto; }
.modal { width: 100%; max-width: 900px; }
.modal.large { max-width: 960px; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
.modal-header h2 { margin: 0 0 .5rem; }
.btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #888; padding: .25rem .5rem; }
.modal-body.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
@media (max-width: 720px) { .modal-body.two-col { grid-template-columns: 1fr; } }

.info-section { margin-bottom: 1.5rem; }
.info-section h3 { font-size: .9rem; text-transform: uppercase; letter-spacing: .05em; color: #888; margin-bottom: .75rem; }
.info-grid { display: grid; grid-template-columns: 110px 1fr; gap: .4rem .75rem; align-items: baseline; }
.info-grid label { color: #888; font-size: .85rem; }
.info-grid a { color: var(--accent); }

.items-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.items-table th { color: #888; text-align: left; padding: .4rem .6rem; border-bottom: 1px solid rgba(255,255,255,.08); font-size: .8rem; }
.items-table td { padding: .5rem .6rem; border-bottom: 1px solid rgba(255,255,255,.05); }

.notes-text { color: #aaa; font-size: .9rem; line-height: 1.6; white-space: pre-wrap; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: .85rem; color: #888; margin-bottom: .35rem; }
.form-input { width: 100%; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; padding: .6rem 1rem; color: inherit; box-sizing: border-box; }
textarea.form-input { resize: vertical; font-family: inherit; }

.btn-row { display: flex; gap: .75rem; margin-top: .5rem; }
.btn { padding: .6rem 1.4rem; border-radius: .75rem; border: none; cursor: pointer; font-weight: 600; }
.btn-primary { background: var(--accent, hsl(355,70%,58%)); color: #fff; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.save-hint { font-size: .78rem; color: #888; margin-top: .5rem; }
</style>
