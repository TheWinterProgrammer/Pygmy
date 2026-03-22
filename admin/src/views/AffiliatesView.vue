<template>
  <div class="affiliates-view">
    <div class="page-header">
      <div>
        <h1>🤝 Affiliates</h1>
        <p class="page-sub">Manage referral partners and track commissions</p>
      </div>
      <button class="btn-primary" @click="openCreate">+ New Affiliate</button>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.active_affiliates }}</div>
        <div class="stat-lbl">Active Affiliates</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.total_referrals }}</div>
        <div class="stat-lbl">Total Referrals</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ currency }}{{ fmtNum(stats.total_commissions) }}</div>
        <div class="stat-lbl">Commissions Earned</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ currency }}{{ fmtNum(stats.total_paid) }}</div>
        <div class="stat-lbl">Total Paid Out</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="toolbar glass">
      <input v-model="search" type="text" placeholder="Search by name, email, or code…" class="search-input" @input="loadAffiliates" />
      <select v-model="filterStatus" @change="loadAffiliates" class="select-sm">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    <!-- Table -->
    <div class="table-wrap glass">
      <table v-if="affiliates.length">
        <thead>
          <tr>
            <th>Affiliate</th>
            <th>Code</th>
            <th>Commission</th>
            <th>Referrals</th>
            <th>Revenue</th>
            <th>Earned</th>
            <th>Paid</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in affiliates" :key="a.id" @click="openDetail(a)" style="cursor:pointer">
            <td>
              <div class="aff-name">{{ a.name }}</div>
              <div class="aff-email">{{ a.email }}</div>
            </td>
            <td><code class="code-badge">{{ a.code }}</code></td>
            <td>{{ a.commission_rate }}%</td>
            <td>{{ a.referral_count }}</td>
            <td>{{ currency }}{{ fmtNum(a.total_revenue) }}</td>
            <td>{{ currency }}{{ fmtNum(a.earned_commission) }}</td>
            <td>{{ currency }}{{ fmtNum(a.total_paid) }}</td>
            <td><span :class="['pill', `pill-${a.status}`]">{{ a.status }}</span></td>
            <td @click.stop>
              <button class="btn-icon" @click="openEdit(a)" title="Edit">✏️</button>
              <button class="btn-icon" @click="confirmDelete(a)" title="Delete">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="loading" class="empty-state">Loading…</div>
      <div v-else class="empty-state">No affiliates found. Add one to get started!</div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal glass">
        <h2>{{ editingId ? 'Edit Affiliate' : 'New Affiliate' }}</h2>
        <form @submit.prevent="saveAffiliate">
          <div class="field-row">
            <div class="field">
              <label>Name *</label>
              <input v-model="form.name" required placeholder="Jane Doe" />
            </div>
            <div class="field">
              <label>Email *</label>
              <input v-model="form.email" type="email" required placeholder="jane@example.com" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Referral Code</label>
              <input v-model="form.code" placeholder="Auto-generated" style="text-transform:uppercase" />
              <small>Leave blank to auto-generate from name</small>
            </div>
            <div class="field">
              <label>Commission Rate (%)</label>
              <input v-model.number="form.commission_rate" type="number" min="0" max="100" step="0.5" />
            </div>
          </div>
          <div class="field" v-if="editingId">
            <label>Status</label>
            <select v-model="form.status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div class="field">
            <label>Notes</label>
            <textarea v-model="form.notes" rows="2" placeholder="Internal notes…"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Create Affiliate') }}
            </button>
          </div>
          <p v-if="modalError" class="error-msg">{{ modalError }}</p>
        </form>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal modal-lg glass">
        <div class="detail-header">
          <div>
            <h2>{{ detail.name }}</h2>
            <p>{{ detail.email }} · Code: <code>{{ detail.code }}</code> · {{ detail.commission_rate }}% commission</p>
          </div>
          <div class="detail-actions">
            <button class="btn-sm btn-primary" @click="openPayoutModal">💸 Record Payout</button>
            <button class="btn-icon" @click="showDetail = false">✕</button>
          </div>
        </div>

        <!-- Summary pills -->
        <div class="summary-pills">
          <div class="pill-stat"><span>{{ detail.referral_count }}</span> Referrals</div>
          <div class="pill-stat"><span>{{ currency }}{{ fmtNum(detail.total_revenue) }}</span> Revenue</div>
          <div class="pill-stat"><span>{{ currency }}{{ fmtNum(detail.earned_commission) }}</span> Earned</div>
          <div class="pill-stat"><span>{{ currency }}{{ fmtNum(detail.total_paid) }}</span> Paid</div>
          <div class="pill-stat accent"><span>{{ currency }}{{ fmtNum((detail.earned_commission || 0) - (detail.total_paid || 0)) }}</span> Owed</div>
        </div>

        <div class="detail-tabs">
          <button :class="['tab', {active: detailTab === 'referrals'}]" @click="detailTab='referrals'">Referrals</button>
          <button :class="['tab', {active: detailTab === 'payouts'}]" @click="detailTab='payouts'">Payouts</button>
        </div>

        <!-- Referrals tab -->
        <div v-if="detailTab === 'referrals'">
          <table v-if="detail.referrals?.length" class="inner-table">
            <thead>
              <tr><th>Order</th><th>Amount</th><th>Commission</th><th>Status</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="r in detail.referrals" :key="r.id">
                <td>{{ r.order_number || `#${r.order_id}` }}</td>
                <td>{{ currency }}{{ fmtNum(r.order_amount) }}</td>
                <td>{{ currency }}{{ fmtNum(r.commission_amount) }}</td>
                <td><span :class="['pill', `pill-ref-${r.status}`]">{{ r.status }}</span></td>
                <td>{{ fmtDate(r.created_at) }}</td>
                <td>
                  <select v-if="r.status === 'pending'" v-model="r.status" @change="updateReferralStatus(r)" class="select-xs">
                    <option value="pending">Pending</option>
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state">No referrals yet</div>
        </div>

        <!-- Payouts tab -->
        <div v-if="detailTab === 'payouts'">
          <table v-if="detail.payouts?.length" class="inner-table">
            <thead><tr><th>Amount</th><th>Method</th><th>Notes</th><th>Date</th></tr></thead>
            <tbody>
              <tr v-for="p in detail.payouts" :key="p.id">
                <td>{{ currency }}{{ fmtNum(p.amount) }}</td>
                <td>{{ p.method }}</td>
                <td>{{ p.notes }}</td>
                <td>{{ fmtDate(p.created_at) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state">No payouts recorded</div>
        </div>

        <!-- Referral link section -->
        <div class="ref-link-section">
          <label>Referral Link</label>
          <div class="ref-link-row">
            <input readonly :value="siteUrl + '?ref=' + detail.code" class="ref-link-input" />
            <button class="btn-sm btn-ghost" @click="copyLink">{{ copied ? '✓ Copied' : 'Copy' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Payout Modal -->
    <div v-if="showPayout" class="modal-overlay" @click.self="showPayout = false">
      <div class="modal modal-sm glass">
        <h2>💸 Record Payout</h2>
        <form @submit.prevent="savePayout">
          <div class="field">
            <label>Amount ({{ currency }})</label>
            <input v-model.number="payoutForm.amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div class="field">
            <label>Payment Method</label>
            <select v-model="payoutForm.method">
              <option value="manual">Manual</option>
              <option value="paypal">PayPal</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>
          <div class="field">
            <label>Notes</label>
            <input v-model="payoutForm.notes" placeholder="Transaction ID, notes…" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="showPayout = false">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="payoutSaving">
              {{ payoutSaving ? 'Saving…' : 'Record Payout' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal modal-sm glass">
        <h2>Delete Affiliate?</h2>
        <p>This will remove <strong>{{ deleteTarget.name }}</strong> and all their referral records.</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'

const affiliates = ref([])
const stats = ref(null)
const loading = ref(false)
const search = ref('')
const filterStatus = ref('')
const currency = ref('€')
const siteUrl = ref(window.location.origin.replace(':5173', ':5174'))

const showModal = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = ref({ name: '', email: '', code: '', commission_rate: 10, notes: '', status: 'active' })

const showDetail = ref(false)
const detail = ref({})
const detailTab = ref('referrals')
const copied = ref(false)

const showPayout = ref(false)
const payoutForm = ref({ amount: '', method: 'manual', notes: '' })
const payoutSaving = ref(false)

const deleteTarget = ref(null)

const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' }

async function loadAffiliates() {
  loading.value = true
  const params = new URLSearchParams()
  if (search.value) params.set('q', search.value)
  if (filterStatus.value) params.set('status', filterStatus.value)
  const res = await fetch(`${API}/api/affiliates?${params}`, { headers })
  affiliates.value = await res.json()
  loading.value = false
}

async function loadStats() {
  const res = await fetch(`${API}/api/affiliates/admin/stats`, { headers })
  stats.value = await res.json()
}

async function loadSettings() {
  const res = await fetch(`${API}/api/settings`)
  const s = await res.json()
  currency.value = s.shop_currency_symbol || '€'
  siteUrl.value = s.site_url || window.location.origin.replace(':5173', ':5174')
}

function openCreate() {
  editingId.value = null
  form.value = { name: '', email: '', code: '', commission_rate: 10, notes: '', status: 'active' }
  modalError.value = ''
  showModal.value = true
}

function openEdit(a) {
  editingId.value = a.id
  form.value = { name: a.name, email: a.email, code: a.code, commission_rate: a.commission_rate, notes: a.notes, status: a.status }
  modalError.value = ''
  showModal.value = true
}

async function saveAffiliate() {
  saving.value = true
  modalError.value = ''
  const url = editingId.value ? `${API}/api/affiliates/${editingId.value}` : `${API}/api/affiliates`
  const method = editingId.value ? 'PUT' : 'POST'
  const res = await fetch(url, { method, headers, body: JSON.stringify(form.value) })
  const data = await res.json()
  if (!res.ok) { modalError.value = data.error || 'Save failed'; saving.value = false; return }
  saving.value = false
  showModal.value = false
  loadAffiliates()
  loadStats()
}

function closeModal() { showModal.value = false }

async function openDetail(a) {
  detailTab.value = 'referrals'
  const res = await fetch(`${API}/api/affiliates/${a.id}`, { headers })
  detail.value = await res.json()
  showDetail.value = true
}

async function updateReferralStatus(r) {
  await fetch(`${API}/api/affiliates/admin/referrals/${r.id}`, {
    method: 'PUT', headers, body: JSON.stringify({ status: r.status })
  })
  loadStats()
}

function openPayoutModal() {
  payoutForm.value = { amount: '', method: 'manual', notes: '' }
  showPayout.value = true
}

async function savePayout() {
  payoutSaving.value = true
  const res = await fetch(`${API}/api/affiliates/admin/payouts`, {
    method: 'POST', headers,
    body: JSON.stringify({ affiliate_id: detail.value.id, ...payoutForm.value })
  })
  payoutSaving.value = false
  if (res.ok) {
    showPayout.value = false
    openDetail(detail.value)
    loadStats()
  }
}

async function copyLink() {
  await navigator.clipboard.writeText(siteUrl.value + '?ref=' + detail.value.code)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

function confirmDelete(a) { deleteTarget.value = a }

async function doDelete() {
  await fetch(`${API}/api/affiliates/${deleteTarget.value.id}`, { method: 'DELETE', headers })
  deleteTarget.value = null
  loadAffiliates()
  loadStats()
}

function fmtNum(n) { return (parseFloat(n) || 0).toFixed(2) }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : '' }

onMounted(() => {
  loadAffiliates()
  loadStats()
  loadSettings()
})
</script>

<style scoped>
.affiliates-view { padding: 2rem; max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-sub { color: var(--muted); font-size: 0.875rem; margin-top: 0.25rem; }
h1 { font-size: 1.75rem; font-weight: 700; }

.stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { padding: 1rem 1.25rem; border-radius: 1rem; text-align: center; }
.stat-num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.stat-lbl { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }

.toolbar { display: flex; gap: 0.75rem; align-items: center; padding: 0.75rem 1rem; border-radius: 0.75rem; margin-bottom: 1rem; }
.search-input { flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.45rem 0.75rem; color: var(--text); }
.search-input::placeholder { color: var(--muted); }
.select-sm { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.45rem 0.6rem; color: var(--text); font-size: 0.875rem; }

.table-wrap { border-radius: 1rem; padding: 0; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
th { background: rgba(255,255,255,0.04); padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.875rem; }
tr:hover td { background: rgba(255,255,255,0.03); }
tr:last-child td { border-bottom: none; }

.aff-name { font-weight: 600; }
.aff-email { font-size: 0.75rem; color: var(--muted); }
.code-badge { background: rgba(255,255,255,0.08); padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-family: monospace; font-size: 0.8rem; letter-spacing: 0.05em; }

.pill { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
.pill-active { background: rgba(34,197,94,0.15); color: #4ade80; }
.pill-inactive { background: rgba(255,255,255,0.08); color: var(--muted); }
.pill-suspended { background: rgba(220,38,38,0.15); color: #f87171; }
.pill-ref-pending { background: rgba(251,146,60,0.15); color: #fb923c; }
.pill-ref-approved { background: rgba(34,197,94,0.15); color: #4ade80; }
.pill-ref-rejected { background: rgba(220,38,38,0.15); color: #f87171; }

.btn-primary { background: var(--accent); color: #fff; border: none; border-radius: 0.5rem; padding: 0.5rem 1.25rem; cursor: pointer; font-weight: 600; font-size: 0.875rem; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: var(--text); border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; }
.btn-danger { background: rgba(220,38,38,0.8); color: #fff; border: none; border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; font-weight: 600; }
.btn-icon { background: none; border: none; cursor: pointer; padding: 0.3rem; font-size: 1rem; opacity: 0.7; }
.btn-icon:hover { opacity: 1; }
.btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 0.4rem; }

.empty-state { text-align: center; padding: 3rem; color: var(--muted); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal { background: var(--surface); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; padding: 1.75rem; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
.modal-sm { max-width: 400px; }
.modal-lg { max-width: 760px; }
.modal h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1.25rem; }
.field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-size: 0.8rem; color: var(--muted); font-weight: 500; }
.field input, .field select, .field textarea { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 0.75rem; color: var(--text); font-size: 0.875rem; }
.field small { font-size: 0.72rem; color: var(--muted); }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; }
.error-msg { color: #f87171; font-size: 0.8rem; margin-top: 0.5rem; }

.detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.detail-header h2 { margin-bottom: 0.25rem; }
.detail-header p { font-size: 0.8rem; color: var(--muted); }
.detail-actions { display: flex; gap: 0.5rem; align-items: center; }

.summary-pills { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.pill-stat { background: rgba(255,255,255,0.06); border-radius: 0.5rem; padding: 0.5rem 0.85rem; font-size: 0.8rem; color: var(--muted); }
.pill-stat span { font-weight: 700; color: var(--text); margin-right: 0.3rem; }
.pill-stat.accent span { color: var(--accent); }

.detail-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 1rem; }
.tab { background: none; border: none; color: var(--muted); padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid transparent; font-size: 0.875rem; }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.inner-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.inner-table th { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; padding: 0.5rem 0.75rem; text-align: left; }
.inner-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
.select-xs { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.3rem; padding: 0.2rem 0.4rem; font-size: 0.75rem; color: var(--text); }

.ref-link-section { margin-top: 1.5rem; }
.ref-link-section label { font-size: 0.8rem; color: var(--muted); display: block; margin-bottom: 0.4rem; }
.ref-link-row { display: flex; gap: 0.5rem; }
.ref-link-input { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.4rem; padding: 0.4rem 0.75rem; color: var(--text); font-size: 0.8rem; font-family: monospace; }

@media (max-width: 768px) {
  .stats-strip { grid-template-columns: repeat(2, 1fr); }
  .field-row { grid-template-columns: 1fr; }
}
</style>
