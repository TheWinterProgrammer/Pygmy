<template>
  <div>
    <div class="page-header">
      <h1>↩️ Returns & Refunds</h1>
    </div>

    <!-- Stats strip -->
    <div class="return-stats" v-if="stats">
      <div class="rstat glass">
        <div class="rstat-num">{{ stats.total }}</div>
        <div class="rstat-label">Total</div>
      </div>
      <div class="rstat glass" :class="{ accent: stats.pending > 0 }">
        <div class="rstat-num">{{ stats.pending }}</div>
        <div class="rstat-label">Pending</div>
      </div>
      <div class="rstat glass">
        <div class="rstat-num">{{ stats.approved }}</div>
        <div class="rstat-label">Approved</div>
      </div>
      <div class="rstat glass">
        <div class="rstat-num">{{ stats.refunded }}</div>
        <div class="rstat-label">Refunded</div>
      </div>
      <div class="rstat glass">
        <div class="rstat-num">{{ currencySymbol }}{{ Number(stats.totalRefunded || 0).toFixed(2) }}</div>
        <div class="rstat-label">Total Refunded</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input v-model="q" placeholder="Search by name, email, order…" @input="fetchReturns" />
      <select v-model="statusFilter" @change="fetchReturns">
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="refunded">Refunded</option>
        <option value="closed">Closed</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <table v-if="returns.length">
        <thead>
          <tr>
            <th>#ID</th>
            <th>Order</th>
            <th>Customer</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Refund</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ret in returns" :key="ret.id">
            <td class="mono">#{{ ret.id }}</td>
            <td class="mono">{{ ret.order_number || '—' }}</td>
            <td>
              <div class="cell-name">{{ ret.customer_name || '—' }}</div>
              <div class="cell-sub">{{ ret.customer_email }}</div>
            </td>
            <td class="reason-cell">{{ truncate(ret.reason, 60) }}</td>
            <td><span class="badge" :class="statusClass(ret.status)">{{ ret.status }}</span></td>
            <td>{{ ret.refund_amount > 0 ? `${currencySymbol}${Number(ret.refund_amount).toFixed(2)}` : '—' }}</td>
            <td class="date-cell">{{ fmtDate(ret.created_at) }}</td>
            <td>
              <button class="btn-sm btn-primary" @click="openDetail(ret)">Review</button>
              <button class="btn-sm btn-danger" @click="deleteReturn(ret)" title="Delete">🗑</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">No return requests found.</div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 0" @click="page--; fetchReturns()">‹ Prev</button>
      <span>{{ page + 1 }} / {{ Math.ceil(total / pageSize) }}</span>
      <button :disabled="(page + 1) * pageSize >= total" @click="page++; fetchReturns()">Next ›</button>
    </div>

    <!-- Detail/Review Modal -->
    <div class="modal-overlay" v-if="selected" @click.self="selected = null">
      <div class="modal glass-modal">
        <div class="modal-header">
          <h2>Return Request #{{ selected.id }}</h2>
          <button class="modal-close" @click="selected = null">✕</button>
        </div>

        <div class="modal-body">
          <!-- Info grid -->
          <div class="info-grid">
            <div class="info-row"><span class="info-label">Order</span><span class="mono">{{ selected.order_number || '—' }}</span></div>
            <div class="info-row"><span class="info-label">Customer</span><span>{{ selected.customer_name }} &lt;{{ selected.customer_email }}&gt;</span></div>
            <div class="info-row"><span class="info-label">Submitted</span><span>{{ fmtDate(selected.created_at) }}</span></div>
            <div class="info-row"><span class="info-label">Status</span><span class="badge" :class="statusClass(selected.status)">{{ selected.status }}</span></div>
          </div>

          <div class="section-block">
            <label>Customer's Reason</label>
            <div class="reason-box glass">{{ selected.reason || 'No reason provided' }}</div>
          </div>

          <div class="section-block" v-if="selected.notes">
            <label>Customer Notes</label>
            <div class="reason-box glass">{{ selected.notes }}</div>
          </div>

          <!-- Items to return -->
          <div class="section-block" v-if="selected.items && selected.items.length">
            <label>Items to Return</label>
            <table class="items-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th></tr></thead>
              <tbody>
                <tr v-for="(item, i) in selected.items" :key="i">
                  <td>{{ item.name || item.product_id }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ currencySymbol }}{{ Number(item.unit_price || 0).toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr class="modal-divider" />

          <!-- Admin action form -->
          <div class="admin-form">
            <div class="form-row">
              <label>Status</label>
              <select v-model="form.status">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="refunded">Refunded</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div class="form-row">
              <label>Refund Amount ({{ currencySymbol }})</label>
              <input type="number" v-model.number="form.refund_amount" min="0" step="0.01" placeholder="0.00" />
            </div>

            <div class="form-row">
              <label>Refund Method</label>
              <select v-model="form.refund_method">
                <option value="original">Original Payment Method</option>
                <option value="store_credit">Store Credit</option>
                <option value="manual">Manual Transfer</option>
              </select>
            </div>

            <div class="form-row">
              <label>Admin Notes (sent to customer on approval/rejection)</label>
              <textarea v-model="form.admin_notes" rows="3" placeholder="Notes for the customer…"></textarea>
            </div>

            <div class="modal-actions">
              <button class="btn btn-secondary" @click="selected = null">Cancel</button>
              <button class="btn btn-primary" @click="saveReturn" :disabled="saving">
                {{ saving ? 'Saving…' : 'Save & Notify Customer' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const returns = ref([])
const total   = ref(0)
const stats   = ref(null)
const page    = ref(0)
const pageSize = 20
const q              = ref('')
const statusFilter   = ref('')
const selected       = ref(null)
const saving         = ref(false)
const currencySymbol = ref('€')
const form = ref({})

async function fetchReturns() {
  const { data } = await api.get('/returns', {
    params: { q: q.value, status: statusFilter.value, limit: pageSize, offset: page.value * pageSize }
  })
  returns.value = data.returns
  total.value   = data.total
}

async function fetchStats() {
  const { data } = await api.get('/returns/stats')
  stats.value = data
}

async function fetchCurrency() {
  try {
    const { data } = await api.get('/settings')
    currencySymbol.value = data.shop_currency_symbol || '€'
  } catch {}
}

function openDetail(ret) {
  selected.value = ret
  form.value = {
    status:        ret.status,
    refund_amount: ret.refund_amount || 0,
    refund_method: ret.refund_method || 'original',
    admin_notes:   ret.admin_notes || '',
  }
}

async function saveReturn() {
  saving.value = true
  try {
    await api.put(`/returns/${selected.value.id}`, form.value)
    await fetchReturns()
    await fetchStats()
    selected.value = null
  } finally {
    saving.value = false
  }
}

async function deleteReturn(ret) {
  if (!confirm(`Delete return request #${ret.id}?`)) return
  await api.delete(`/returns/${ret.id}`)
  await fetchReturns()
  await fetchStats()
}

function statusClass(status) {
  return {
    pending:  'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    refunded: 'badge-info',
    closed:   'badge-neutral',
  }[status] || ''
}

function truncate(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
}

onMounted(() => {
  fetchReturns()
  fetchStats()
  fetchCurrency()
})
</script>

<style scoped>
.return-stats { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.rstat { padding: .75rem 1.25rem; border-radius: 1rem; min-width: 100px; text-align: center; }
.rstat.accent { border-color: var(--accent); }
.rstat-num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.rstat-label { font-size: .75rem; color: #888; margin-top: .25rem; }

.filter-bar { display: flex; gap: .75rem; padding: .75rem 1rem; border-radius: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.filter-bar input, .filter-bar select { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; color: #e2e2e8; padding: .4rem .75rem; font-size: .88rem; }
.filter-bar input { flex: 1; min-width: 200px; }

.table-wrap { padding: 0; border-radius: 1rem; overflow: hidden; }
table { width: 100%; border-collapse: collapse; font-size: .88rem; }
th { padding: .6rem 1rem; background: rgba(255,255,255,.04); color: #888; text-align: left; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,.08); }
td { padding: .6rem 1rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.mono { font-family: monospace; font-size: .85rem; }
.cell-name { font-weight: 600; color: #e2e2e8; }
.cell-sub { font-size: .78rem; color: #666; }
.reason-cell { max-width: 200px; color: #b0b0c0; font-size: .82rem; }
.date-cell { font-size: .8rem; color: #888; white-space: nowrap; }

.badge { display: inline-block; padding: .2em .65em; border-radius: 999px; font-size: .75rem; font-weight: 600; }
.badge-warning { background: hsl(43,70%,20%); color: hsl(43,90%,60%); }
.badge-success { background: hsl(140,50%,16%); color: hsl(140,60%,55%); }
.badge-danger  { background: hsl(355,70%,20%); color: hsl(355,70%,65%); }
.badge-info    { background: hsl(210,60%,18%); color: hsl(210,70%,60%); }
.badge-neutral { background: rgba(255,255,255,.06); color: #888; }

.btn-sm { padding: .25rem .6rem; border-radius: .35rem; border: none; cursor: pointer; font-size: .8rem; margin-right: .25rem; }
.btn-sm.btn-primary { background: var(--accent); color: #fff; }
.btn-sm.btn-danger { background: hsl(355,70%,28%); color: hsl(355,70%,75%); }
.empty-state { padding: 2rem; text-align: center; color: #555; }

.pagination { display: flex; gap: 1rem; align-items: center; justify-content: center; margin-top: 1rem; font-size: .85rem; }
.pagination button { padding: .35rem .75rem; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); border-radius: .4rem; color: #ccc; cursor: pointer; }
.pagination button:disabled { opacity: .3; cursor: default; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.glass-modal { background: hsl(228,4%,14%); border: 1px solid rgba(255,255,255,.1); border-radius: 1.25rem; max-width: 640px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.07); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-close { background: none; border: none; color: #888; font-size: 1.2rem; cursor: pointer; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.modal-divider { border: none; border-top: 1px solid rgba(255,255,255,.07); margin: 1.25rem 0; }
.modal-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }

.info-grid { display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1rem; }
.info-row { display: flex; gap: 1rem; align-items: baseline; font-size: .88rem; }
.info-label { min-width: 90px; color: #888; font-weight: 600; }

.section-block { margin-bottom: 1rem; }
.section-block label { display: block; font-size: .78rem; color: #888; margin-bottom: .35rem; text-transform: uppercase; letter-spacing: .04em; }
.reason-box { padding: .75rem 1rem; border-radius: .75rem; font-size: .88rem; color: #ccc; line-height: 1.5; }

.items-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.items-table th { padding: .4rem .6rem; color: #888; text-align: left; border-bottom: 1px solid rgba(255,255,255,.07); }
.items-table td { padding: .4rem .6rem; border-bottom: 1px solid rgba(255,255,255,.04); color: #ccc; }

.admin-form .form-row { margin-bottom: .9rem; }
.admin-form .form-row label { display: block; font-size: .8rem; color: #888; margin-bottom: .3rem; }
.admin-form input, .admin-form select, .admin-form textarea {
  width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  border-radius: .5rem; color: #e2e2e8; padding: .45rem .75rem; font-size: .9rem; box-sizing: border-box;
}
.admin-form textarea { resize: vertical; }

.btn { padding: .45rem 1.1rem; border-radius: .5rem; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:disabled { opacity: .5; }
.btn-secondary { background: rgba(255,255,255,.08); color: #ccc; }
</style>
