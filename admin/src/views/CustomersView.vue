<template>
  <div class="customers-view">
    <div class="view-header">
      <h1>👤 Customers</h1>
      <div class="header-right">
        <span class="stat-label">{{ total }} total</span>
      </div>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <input v-model="q" type="search" placeholder="Search by name or email…" class="input" @input="debouncedFetch" />
    </div>

    <!-- Table -->
    <div class="glass table-card">
      <div v-if="loading" class="loading-state">Loading customers…</div>
      <div v-else-if="customers.length === 0" class="empty-state">No customers found.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Email</th>
            <th>Orders</th>
            <th>Total Spent</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id" @click="openDetail(c)" style="cursor:pointer">
            <td>
              <div class="customer-name">{{ c.first_name }} {{ c.last_name }}</div>
            </td>
            <td>{{ c.email }}</td>
            <td>{{ c.order_count }}</td>
            <td>{{ currency }}{{ Number(c.total_spent).toFixed(2) }}</td>
            <td>
              <span :class="['badge', c.active ? 'badge-green' : 'badge-red']">
                {{ c.active ? 'Active' : 'Disabled' }}
              </span>
            </td>
            <td>{{ formatDate(c.created_at) }}</td>
            <td @click.stop>
              <button class="btn btn-sm btn-ghost" @click="openDetail(c)">View</button>
              <button :class="['btn btn-sm', c.active ? 'btn-ghost' : 'btn-accent']" @click="toggleActive(c)">
                {{ c.active ? 'Disable' : 'Enable' }}
              </button>
              <button class="btn btn-sm btn-ghost btn-danger" @click="confirmDelete(c)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div v-if="detailCustomer" class="modal-overlay" @click.self="detailCustomer = null">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ detailCustomer.first_name }} {{ detailCustomer.last_name }}</h2>
          <button class="modal-close" @click="detailCustomer = null">✕</button>
        </div>
        <div class="modal-body" v-if="detailData">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Email</span><span>{{ detailData.email }}</span></div>
            <div class="detail-item"><span class="detail-label">Phone</span><span>{{ detailData.phone || '—' }}</span></div>
            <div class="detail-item"><span class="detail-label">Joined</span><span>{{ formatDate(detailData.created_at) }}</span></div>
            <div class="detail-item"><span class="detail-label">Status</span>
              <span :class="['badge', detailData.active ? 'badge-green' : 'badge-red']">{{ detailData.active ? 'Active' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Addresses -->
          <h3 style="margin-top:1.5rem;">Saved Addresses</h3>
          <div v-if="detailData.addresses?.length === 0" class="muted">No saved addresses.</div>
          <div v-for="addr in detailData.addresses" :key="addr.id" class="address-card glass-sm">
            <div class="addr-label">{{ addr.label }} <span v-if="addr.is_default" class="badge badge-accent">Default</span></div>
            <div>{{ addr.first_name }} {{ addr.last_name }}</div>
            <div>{{ addr.address1 }}{{ addr.address2 ? ', ' + addr.address2 : '' }}</div>
            <div>{{ addr.city }}{{ addr.state ? ', ' + addr.state : '' }} {{ addr.zip }}</div>
            <div>{{ addr.country }}</div>
          </div>

          <!-- Orders -->
          <h3 style="margin-top:1.5rem;">Orders</h3>
          <div v-if="detailData.orders?.length === 0" class="muted">No orders yet.</div>
          <table v-else class="data-table mini-table">
            <thead><tr><th>Order #</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>
              <tr v-for="o in detailData.orders" :key="o.id">
                <td>{{ o.order_number }}</td>
                <td><span :class="['badge', statusClass(o.status)]">{{ o.status }}</span></td>
                <td>{{ currency }}{{ Number(o.total).toFixed(2) }}</td>
                <td>{{ formatDate(o.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="loading-state">Loading…</div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal glass modal-sm">
        <div class="modal-header">
          <h2>Delete Customer</h2>
          <button class="modal-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete <strong>{{ deleteTarget.email }}</strong>? Their orders will be kept but unlinked.</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const customers = ref([])
const total = ref(0)
const loading = ref(false)
const q = ref('')
const detailCustomer = ref(null)
const detailData = ref(null)
const deleteTarget = ref(null)
const currency = ref('€')

let debounceTimer = null
function debouncedFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchCustomers, 300)
}

async function fetchCustomers() {
  loading.value = true
  try {
    const params = new URLSearchParams({ q: q.value, limit: 100, offset: 0 })
    const res = await fetch(`/api/customers?${params}`, { headers: { Authorization: `Bearer ${auth.token}` } })
    const d = await res.json()
    customers.value = d.customers || []
    total.value = d.total || 0
  } finally {
    loading.value = false
  }
}

async function fetchSettings() {
  const res = await fetch('/api/settings')
  const d = await res.json()
  currency.value = d.shop_currency_symbol || '€'
}

async function openDetail(c) {
  detailCustomer.value = c
  detailData.value = null
  const res = await fetch(`/api/customers/${c.id}`, { headers: { Authorization: `Bearer ${auth.token}` } })
  detailData.value = await res.json()
}

async function toggleActive(c) {
  await fetch(`/api/customers/${c.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: !c.active })
  })
  c.active = !c.active
  if (detailData.value?.id === c.id) detailData.value.active = c.active
}

function confirmDelete(c) {
  deleteTarget.value = c
}

async function doDelete() {
  await fetch(`/api/customers/${deleteTarget.value.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  customers.value = customers.value.filter(c => c.id !== deleteTarget.value.id)
  total.value--
  deleteTarget.value = null
  if (detailCustomer.value?.id === deleteTarget.value?.id) detailCustomer.value = null
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusClass(s) {
  return { pending: 'badge-yellow', processing: 'badge-blue', shipped: 'badge-purple', completed: 'badge-green', cancelled: 'badge-red', refunded: 'badge-red' }[s] || ''
}

onMounted(() => {
  fetchCustomers()
  fetchSettings()
})
</script>

<style scoped>
.customers-view { padding: 2rem; max-width: 1200px; }
.view-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.view-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.stat-label { font-size: 0.85rem; color: var(--muted); }
.search-bar { margin-bottom: 1rem; }
.search-bar .input { width: 100%; max-width: 400px; }
.table-card { border-radius: 1rem; overflow: hidden; }
.loading-state, .empty-state { padding: 2rem; text-align: center; color: var(--muted); }
.customer-name { font-weight: 600; }
.badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.badge-green { background: rgba(34,197,94,0.2); color: #4ade80; }
.badge-red { background: rgba(239,68,68,0.2); color: #f87171; }
.badge-yellow { background: rgba(234,179,8,0.2); color: #facc15; }
.badge-blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
.badge-purple { background: rgba(168,85,247,0.2); color: #c084fc; }
.badge-accent { background: rgba(var(--accent-rgb, 220,38,38), 0.2); color: var(--accent); }
.btn-danger { color: var(--accent); }

/* Detail Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 90%; max-width: 680px; max-height: 85vh; display: flex; flex-direction: column; border-radius: 1.25rem; }
.modal-sm { max-width: 420px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
.modal-header h2 { margin: 0; font-size: 1.15rem; }
.modal-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.1rem; padding: 0.25rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
.detail-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

.address-card { border-radius: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 0.75rem; font-size: 0.875rem; line-height: 1.6; }
.addr-label { font-weight: 600; margin-bottom: 0.25rem; }
.glass-sm { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
.muted { color: var(--muted); font-size: 0.875rem; }

.mini-table { font-size: 0.875rem; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }

h3 { font-size: 0.95rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
</style>
