<template>
  <div class="vendors-view">
    <div class="view-header">
      <div>
        <h1>🏪 Vendors</h1>
        <p class="subtitle">Multi-vendor marketplace management</p>
      </div>
      <div class="header-actions">
        <div :class="['toggle-pill', { active: marketplaceEnabled }]" @click="toggleMarketplace">
          {{ marketplaceEnabled ? '🟢 Marketplace ON' : '⚫ Marketplace OFF' }}
        </div>
      </div>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Vendors</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card" :class="{ warn: stats.pending > 0 }">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">Pending Approval</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmt(stats.gmv) }}</div>
        <div class="stat-label">Total GMV</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmt(stats.commissions) }}</div>
        <div class="stat-label">Commissions Earned</div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <input v-model="search" placeholder="Search vendors..." class="search-input" @input="load" />
      <select v-model="filterStatus" @change="load" class="filter-select">
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass-card table-card">
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Status</th>
            <th>Commission</th>
            <th>Total Sales</th>
            <th>Products</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in vendors" :key="v.id">
            <td>
              <div class="vendor-cell">
                <img v-if="v.logo" :src="v.logo" class="vendor-logo" />
                <div v-else class="vendor-logo-placeholder">{{ v.name[0] }}</div>
                <div>
                  <div class="vendor-name">{{ v.name }}</div>
                  <div class="vendor-email">{{ v.email }}</div>
                </div>
              </div>
            </td>
            <td><span :class="['status-pill', v.status]">{{ v.status }}</span></td>
            <td>{{ v.commission_rate }}%</td>
            <td>{{ fmt(v.total_sales) }}</td>
            <td>{{ v.product_count }}</td>
            <td>{{ fmtDate(v.created_at) }}</td>
            <td>
              <div class="action-btns">
                <button v-if="v.status === 'pending'" @click="approve(v)" class="btn-sm btn-green">✅ Approve</button>
                <button @click="openEdit(v)" class="btn-sm">✏️</button>
                <button @click="openPayouts(v)" class="btn-sm">💰</button>
                <button @click="openProducts(v)" class="btn-sm">📦</button>
                <button @click="confirmDelete(v)" class="btn-sm btn-danger">🗑️</button>
              </div>
            </td>
          </tr>
          <tr v-if="!vendors.length">
            <td colspan="7" class="empty">No vendors found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Modal -->
    <div v-if="editModal" class="modal-overlay" @click.self="editModal = false">
      <div class="modal glass-card">
        <h2>✏️ Edit Vendor</h2>
        <div class="form-group">
          <label>Name</label>
          <input v-model="editForm.name" class="form-input" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input v-model="editForm.email" class="form-input" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select v-model="editForm.status" class="form-input">
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div class="form-group">
          <label>Commission Rate: {{ editForm.commission_rate }}%</label>
          <input type="range" min="0" max="50" v-model.number="editForm.commission_rate" class="range-input" />
        </div>
        <div class="modal-actions">
          <button @click="saveEdit" class="btn-primary">Save Changes</button>
          <button @click="editModal = false" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Payouts Modal -->
    <div v-if="payoutsModal" class="modal-overlay" @click.self="payoutsModal = false">
      <div class="modal glass-card">
        <h2>💰 Payouts — {{ selectedVendor?.name }}</h2>
        <div class="payout-summary">
          <div class="payout-stat">
            <div class="ps-label">Net Earnings</div>
            <div class="ps-value">{{ fmt((selectedVendor?.total_sales || 0) - (selectedVendor?.total_commission || 0)) }}</div>
          </div>
          <div class="payout-stat">
            <div class="ps-label">Total Paid Out</div>
            <div class="ps-value">{{ fmt(totalPaidOut) }}</div>
          </div>
          <div class="payout-stat accent">
            <div class="ps-label">Pending Payout</div>
            <div class="ps-value">{{ fmt(pendingPayout) }}</div>
          </div>
        </div>
        <div class="form-group" style="margin-top:1rem">
          <label>Mark Payout — Amount (€)</label>
          <input type="number" v-model.number="payoutForm.amount" class="form-input" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label>Note</label>
          <input v-model="payoutForm.note" class="form-input" placeholder="PayPal ref, bank transfer ID..." />
        </div>
        <button @click="markPayout" class="btn-primary" :disabled="!payoutForm.amount">Mark as Paid</button>
        <h3 style="margin-top:1.5rem">Payout History</h3>
        <table style="margin-top:.5rem">
          <thead><tr><th>Amount</th><th>Status</th><th>Note</th><th>Date</th></tr></thead>
          <tbody>
            <tr v-for="p in payouts" :key="p.id">
              <td>{{ fmt(p.amount) }}</td>
              <td><span :class="['status-pill', p.status]">{{ p.status }}</span></td>
              <td>{{ p.note || '—' }}</td>
              <td>{{ fmtDate(p.created_at) }}</td>
            </tr>
            <tr v-if="!payouts.length"><td colspan="4" class="empty">No payouts yet.</td></tr>
          </tbody>
        </table>
        <button @click="payoutsModal = false" class="btn-secondary" style="margin-top:1rem">Close</button>
      </div>
    </div>

    <!-- Products Modal -->
    <div v-if="productsModal" class="modal-overlay" @click.self="productsModal = false">
      <div class="modal glass-card">
        <h2>📦 Products — {{ selectedVendor?.name }}</h2>
        <table>
          <thead><tr><th>Product</th><th>Price</th><th>Status</th><th>Stock</th></tr></thead>
          <tbody>
            <tr v-for="p in vendorProducts" :key="p.id">
              <td>
                <div style="display:flex;gap:.5rem;align-items:center">
                  <img v-if="p.cover_image" :src="p.cover_image" style="width:32px;height:32px;object-fit:cover;border-radius:.25rem" />
                  {{ p.name }}
                </div>
              </td>
              <td>€{{ p.price }}</td>
              <td><span :class="['status-pill', p.status]">{{ p.status }}</span></td>
              <td>{{ p.stock_quantity ?? '—' }}</td>
            </tr>
            <tr v-if="!vendorProducts.length"><td colspan="4" class="empty">No products.</td></tr>
          </tbody>
        </table>
        <button @click="productsModal = false" class="btn-secondary" style="margin-top:1rem">Close</button>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteModal" class="modal-overlay" @click.self="deleteModal = false">
      <div class="modal glass-card" style="max-width:400px">
        <h2>🗑️ Delete Vendor?</h2>
        <p>Delete <strong>{{ selectedVendor?.name }}</strong>? Their products will be unlinked.</p>
        <div class="modal-actions">
          <button @click="doDelete" class="btn-danger">Delete</button>
          <button @click="deleteModal = false" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const vendors = ref([])
const stats = ref(null)
const search = ref('')
const filterStatus = ref('')
const editModal = ref(false)
const payoutsModal = ref(false)
const productsModal = ref(false)
const deleteModal = ref(false)
const selectedVendor = ref(null)
const editForm = ref({})
const payoutForm = ref({ amount: null, note: '' })
const payouts = ref([])
const vendorProducts = ref([])
const marketplaceEnabled = ref(false)

const totalPaidOut = computed(() => payouts.value.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0))
const pendingPayout = computed(() => Math.max(0, (selectedVendor.value?.total_sales || 0) - (selectedVendor.value?.total_commission || 0) - totalPaidOut.value))

function fmt(v) { return '€' + (v || 0).toFixed(2) }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : '' }

async function load() {
  const params = {}
  if (search.value) params.q = search.value
  if (filterStatus.value) params.status = filterStatus.value
  const { data } = await api.get('/vendors', { params })
  vendors.value = data.vendors || []
}

async function loadStats() {
  const { data } = await api.get('/vendors/stats')
  stats.value = data
}

async function loadSettings() {
  const { data } = await api.get('/settings')
  marketplaceEnabled.value = data.marketplace_enabled === '1'
}

async function toggleMarketplace() {
  const newVal = marketplaceEnabled.value ? '0' : '1'
  await api.put('/settings', { marketplace_enabled: newVal })
  marketplaceEnabled.value = newVal === '1'
}

function openEdit(v) {
  selectedVendor.value = v
  editForm.value = { name: v.name, email: v.email, status: v.status, commission_rate: v.commission_rate }
  editModal.value = true
}

async function saveEdit() {
  await api.put(`/vendors/${selectedVendor.value.id}`, editForm.value)
  editModal.value = false
  load(); loadStats()
}

async function approve(v) {
  await api.put(`/vendors/${v.id}`, { status: 'active' })
  load(); loadStats()
}

async function openPayouts(v) {
  selectedVendor.value = v
  payoutForm.value = { amount: null, note: '' }
  const { data } = await api.get(`/vendors/${v.id}/payouts`)
  payouts.value = data
  payoutsModal.value = true
}

async function markPayout() {
  if (!payoutForm.value.amount) return
  await api.post(`/vendors/${selectedVendor.value.id}/payouts`, payoutForm.value)
  const { data } = await api.get(`/vendors/${selectedVendor.value.id}/payouts`)
  payouts.value = data
  payoutForm.value = { amount: null, note: '' }
  load(); loadStats()
}

async function openProducts(v) {
  selectedVendor.value = v
  const { data } = await api.get(`/vendors/${v.id}/products`)
  vendorProducts.value = data
  productsModal.value = true
}

function confirmDelete(v) {
  selectedVendor.value = v
  deleteModal.value = true
}

async function doDelete() {
  await api.delete(`/vendors/${selectedVendor.value.id}`)
  deleteModal.value = false
  load(); loadStats()
}

onMounted(() => { load(); loadStats(); loadSettings() })
</script>

<style scoped>
.vendors-view { padding: 2rem; max-width: 1400px; margin: 0 auto; }
.view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.view-header h1 { font-size: 1.8rem; font-weight: 700; color: #fff; margin: 0; }
.subtitle { color: rgba(255,255,255,.5); margin: .25rem 0 0; }
.toggle-pill { padding: .5rem 1rem; border-radius: 2rem; cursor: pointer; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); font-size: .85rem; transition: all .2s; }
.toggle-pill.active { background: rgba(var(--accent-rgb),.2); border-color: var(--accent); color: var(--accent); }
.stats-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 1rem; padding: 1.25rem; text-align: center; }
.stat-card.accent { border-color: var(--accent); }
.stat-card.warn .stat-value { color: #f59e0b; }
.stat-value { font-size: 1.6rem; font-weight: 700; color: #fff; }
.stat-label { font-size: .75rem; color: rgba(255,255,255,.5); margin-top: .25rem; }
.filter-bar { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
.search-input, .filter-select { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .6rem 1rem; color: #fff; font-family: Poppins, sans-serif; }
.search-input { flex: 1; }
.glass-card { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1rem; overflow: hidden; }
.table-card { margin-bottom: 2rem; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: .75rem 1rem; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.4); border-bottom: 1px solid rgba(255,255,255,.06); }
td { padding: .75rem 1rem; border-bottom: 1px solid rgba(255,255,255,.04); color: rgba(255,255,255,.85); font-size: .9rem; }
.vendor-cell { display: flex; gap: .75rem; align-items: center; }
.vendor-logo { width: 36px; height: 36px; border-radius: .5rem; object-fit: cover; }
.vendor-logo-placeholder { width: 36px; height: 36px; border-radius: .5rem; background: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; }
.vendor-name { font-weight: 600; }
.vendor-email { font-size: .8rem; color: rgba(255,255,255,.4); }
.status-pill { display: inline-block; padding: .2rem .6rem; border-radius: 2rem; font-size: .75rem; font-weight: 600; }
.status-pill.active, .status-pill.paid { background: rgba(34,197,94,.15); color: #4ade80; }
.status-pill.pending { background: rgba(245,158,11,.15); color: #fbbf24; }
.status-pill.suspended, .status-pill.cancelled { background: rgba(239,68,68,.15); color: #f87171; }
.status-pill.published { background: rgba(34,197,94,.15); color: #4ade80; }
.status-pill.draft { background: rgba(148,163,184,.15); color: #94a3b8; }
.action-btns { display: flex; gap: .4rem; flex-wrap: wrap; }
.btn-sm { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1); color: #fff; border-radius: .4rem; padding: .25rem .5rem; font-size: .78rem; cursor: pointer; transition: background .15s; }
.btn-sm:hover { background: rgba(255,255,255,.15); }
.btn-sm.btn-green { background: rgba(34,197,94,.15); border-color: #4ade80; color: #4ade80; }
.btn-sm.btn-danger { background: rgba(239,68,68,.1); border-color: #f87171; color: #f87171; }
.empty { text-align: center; color: rgba(255,255,255,.3); padding: 2rem; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal { background: hsl(228,4%,15%); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; padding: 2rem; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
.modal h2 { margin: 0 0 1.5rem; font-size: 1.3rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: .85rem; color: rgba(255,255,255,.6); margin-bottom: .4rem; }
.form-input { width: 100%; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .6rem .9rem; color: #fff; font-family: Poppins, sans-serif; box-sizing: border-box; }
.range-input { width: 100%; accent-color: var(--accent); }
.modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
.btn-primary { background: var(--accent); color: #fff; border: none; border-radius: .5rem; padding: .65rem 1.5rem; font-weight: 600; cursor: pointer; font-family: Poppins, sans-serif; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-secondary { background: rgba(255,255,255,.08); color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: .5rem; padding: .65rem 1.5rem; cursor: pointer; font-family: Poppins, sans-serif; }
.btn-danger { background: rgba(239,68,68,.2); color: #f87171; border: 1px solid #f87171; border-radius: .5rem; padding: .65rem 1.5rem; cursor: pointer; font-family: Poppins, sans-serif; }
.payout-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: .5rem; }
.payout-stat { background: rgba(255,255,255,.05); border-radius: .75rem; padding: 1rem; text-align: center; }
.payout-stat.accent { border: 1px solid var(--accent); }
.ps-label { font-size: .75rem; color: rgba(255,255,255,.5); }
.ps-value { font-size: 1.2rem; font-weight: 700; color: #fff; margin-top: .25rem; }
@media (max-width: 768px) {
  .stats-strip { grid-template-columns: repeat(2, 1fr); }
  .payout-summary { grid-template-columns: 1fr; }
}
</style>
