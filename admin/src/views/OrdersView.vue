<template>
  <div>
    <div class="page-header">
      <h1>📦 Orders</h1>
      <div class="header-actions">
        <span class="text-muted" v-if="stats" style="margin-right:.75rem;">
          {{ stats.total }} orders · Revenue {{ fmtCurrency(stats.revenue) }}
        </span>
        <button class="btn btn-ghost" @click="exportCsv" title="Export orders as CSV">
          ⬇️ Export CSV
        </button>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="orders-stats" v-if="stats">
      <div class="ostat glass" v-for="s in statCards" :key="s.label">
        <div class="ostat-num">{{ s.value }}</div>
        <div class="ostat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="glass filter-bar" style="margin-bottom:1.25rem;display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;padding:.75rem 1rem;">
      <input class="input" style="flex:1;min-width:180px;" placeholder="Search order#, name, email…" v-model="q" @input="debouncedLoad" />
      <select class="input" style="width:160px;" v-model="filterStatus" @change="load">
        <option value="">All statuses</option>
        <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <div class="loading-bar" v-if="loading"></div>
      <table class="data-table" v-if="orders.length">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
            <th style="width:80px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id" @click="openOrder(order)" style="cursor:pointer;">
            <td><strong>{{ order.order_number }}</strong></td>
            <td>
              <div>{{ order.customer_name }}</div>
              <div class="text-muted" style="font-size:.8rem;">{{ order.customer_email }}</div>
            </td>
            <td>{{ order.items.length }} item{{ order.items.length !== 1 ? 's' : '' }}</td>
            <td><strong>{{ fmtCurrency(order.total) }}</strong></td>
            <td><span :class="['badge', statusBadge(order.status)]">{{ order.status }}</span></td>
            <td class="text-muted" style="font-size:.82rem;">{{ fmtDate(order.created_at) }}</td>
            <td @click.stop>
              <button class="btn btn-ghost btn-sm" @click="openOrder(order)">View</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" v-else-if="!loading">
        <div class="empty-icon">📦</div>
        <p>No orders yet.</p>
        <p class="text-muted">Orders will appear here once customers check out.</p>
      </div>
    </div>

    <!-- Order detail modal -->
    <div class="modal-overlay" v-if="selected" @click.self="selected = null">
      <div class="modal glass" style="max-width:680px;width:95%;">
        <div class="modal-header">
          <h2>Order {{ selected.order_number }}</h2>
          <button class="btn-close" @click="selected = null">✕</button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
          <!-- Status update -->
          <div class="field-row" style="display:flex;gap:.75rem;align-items:center;margin-bottom:1rem;">
            <label class="label" style="white-space:nowrap;">Status:</label>
            <select class="input" v-model="editStatus" style="flex:1;">
              <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
            <button class="btn btn-primary btn-sm" @click="saveStatus" :disabled="saving">
              {{ saving ? 'Saving…' : 'Update' }}
            </button>
          </div>

          <!-- Customer info -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <h3 style="margin:0 0 .5rem;font-size:.95rem;color:var(--accent);">👤 Customer</h3>
            <div class="info-grid">
              <div><span class="label">Name</span><span>{{ selected.customer_name }}</span></div>
              <div><span class="label">Email</span><span>{{ selected.customer_email }}</span></div>
              <div v-if="selected.customer_phone"><span class="label">Phone</span><span>{{ selected.customer_phone }}</span></div>
            </div>
            <div v-if="selected.shipping_address" style="margin-top:.5rem;">
              <span class="label">Shipping address</span>
              <pre style="white-space:pre-wrap;margin:.25rem 0 0;font-size:.85rem;font-family:inherit;">{{ selected.shipping_address }}</pre>
            </div>
          </div>

          <!-- Items -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <h3 style="margin:0 0 .75rem;font-size:.95rem;color:var(--accent);">🛒 Items</h3>
            <table class="data-table" style="font-size:.88rem;">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
              <tbody>
                <tr v-for="item in selected.items" :key="item.product_id">
                  <td>
                    <div style="display:flex;align-items:center;gap:.5rem;">
                      <img v-if="item.cover_image" :src="item.cover_image" style="width:32px;height:32px;object-fit:cover;border-radius:.25rem;" />
                      <span>{{ item.name }}</span>
                    </div>
                  </td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ fmtCurrency(item.unit_price) }}</td>
                  <td><strong>{{ fmtCurrency(item.line_total) }}</strong></td>
                </tr>
              </tbody>
            </table>
            <div class="order-subtotal-row" style="display:flex;justify-content:space-between;font-size:.88rem;padding:.3rem 0;color:var(--text-muted);">
              <span>Subtotal</span>
              <span>{{ fmtCurrency(selected.subtotal) }}</span>
            </div>
            <div v-if="selected.coupon_code" class="order-subtotal-row"
                 style="display:flex;justify-content:space-between;font-size:.88rem;padding:.3rem 0;color:hsl(140,60%,60%);">
              <span>🎟️ Coupon ({{ selected.coupon_code }})</span>
              <span>−{{ fmtCurrency(selected.discount_amount) }}</span>
            </div>
            <div class="order-total-row">
              <span>Total</span>
              <strong style="color:var(--accent);">{{ fmtCurrency(selected.total) }}</strong>
            </div>
          </div>

          <!-- Notes -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <h3 style="margin:0 0 .5rem;font-size:.95rem;color:var(--accent);">📝 Notes</h3>
            <textarea class="input" rows="3" v-model="editNotes" placeholder="Internal notes…" style="width:100%;box-sizing:border-box;"></textarea>
            <button class="btn btn-ghost btn-sm" style="margin-top:.5rem;" @click="saveNotes" :disabled="saving">Save notes</button>
          </div>

          <!-- Meta -->
          <div class="text-muted" style="font-size:.8rem;">
            Placed: {{ fmtDateLong(selected.created_at) }} · Last updated: {{ fmtDate(selected.updated_at) }}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="selected = null">Close</button>
          <button class="btn btn-danger" @click="confirmDelete(selected)">Delete order</button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass" style="max-width:420px;text-align:center;">
        <div class="modal-body" style="padding:2rem;">
          <div style="font-size:2.5rem;margin-bottom:.75rem;">🗑️</div>
          <h3>Delete order {{ deleteTarget.order_number }}?</h3>
          <p class="text-muted">This cannot be undone.</p>
          <div style="display:flex;gap:.75rem;justify-content:center;margin-top:1.25rem;">
            <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete" :disabled="deleting">
              {{ deleting ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()

const orders     = ref([])
const stats      = ref(null)
const loading    = ref(false)
const saving     = ref(false)
const deleting   = ref(false)
const q          = ref('')
const filterStatus = ref('')
const selected   = ref(null)
const editStatus = ref('')
const editNotes  = ref('')
const deleteTarget = ref(null)

const STATUSES = [
  { value: 'pending',    label: '⏳ Pending' },
  { value: 'processing', label: '⚙️ Processing' },
  { value: 'shipped',    label: '🚚 Shipped' },
  { value: 'completed',  label: '✅ Completed' },
  { value: 'cancelled',  label: '❌ Cancelled' },
  { value: 'refunded',   label: '💸 Refunded' },
]

const statCards = computed(() => [
  { label: 'Total Orders',   value: stats.value?.total ?? 0 },
  { label: 'Pending',        value: stats.value?.pending ?? 0 },
  { label: 'Processing',     value: stats.value?.processing ?? 0 },
  { label: 'Completed',      value: stats.value?.completed ?? 0 },
])

function statusBadge(s) {
  const map = { pending: 'badge-draft', processing: 'badge-scheduled', shipped: 'badge-scheduled', completed: 'badge-published', cancelled: 'badge-draft', refunded: 'badge-draft' }
  return map[s] || 'badge-draft'
}

function fmtCurrency(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateLong(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, ...(opts.headers || {}) }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit: 100 })
    if (q.value) params.set('q', q.value)
    if (filterStatus.value) params.set('status', filterStatus.value)
    const data = await apiFetch(`/orders?${params}`)
    orders.value = data.orders
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await apiFetch('/orders/stats/summary')
  } catch {}
}

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 300)
}

function openOrder(order) {
  selected.value = order
  editStatus.value = order.status
  editNotes.value  = order.notes || ''
}

async function saveStatus() {
  if (!selected.value) return
  saving.value = true
  try {
    const updated = await apiFetch(`/orders/${selected.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: editStatus.value })
    })
    Object.assign(selected.value, updated)
    const idx = orders.value.findIndex(o => o.id === updated.id)
    if (idx !== -1) orders.value[idx] = { ...updated }
    await loadStats()
  } catch (e) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

async function saveNotes() {
  if (!selected.value) return
  saving.value = true
  try {
    const updated = await apiFetch(`/orders/${selected.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ notes: editNotes.value })
    })
    Object.assign(selected.value, updated)
  } catch (e) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

function confirmDelete(order) {
  deleteTarget.value = order
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await apiFetch(`/orders/${deleteTarget.value.id}`, { method: 'DELETE' })
    orders.value = orders.value.filter(o => o.id !== deleteTarget.value.id)
    if (selected.value?.id === deleteTarget.value.id) selected.value = null
    deleteTarget.value = null
    await loadStats()
  } catch (e) {
    alert(e.message)
  } finally {
    deleting.value = false
  }
}

function exportCsv() {
  const params = new URLSearchParams()
  if (filterStatus.value) params.set('status', filterStatus.value)
  const token = auth.token
  const url = `/api/orders/export/csv?${params}`
  // Use fetch to inject auth header, then blob-download
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    })
}

onMounted(() => {
  load()
  loadStats()
})
</script>

<style scoped>
.orders-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: .75rem;
  margin-bottom: 1.25rem;
}
.ostat {
  padding: .875rem 1rem;
  border-radius: .75rem;
  text-align: center;
}
.ostat-num {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}
.ostat-label {
  font-size: .78rem;
  color: var(--text-muted);
  margin-top: .2rem;
}
.filter-bar { border-radius: .75rem; }
.section-card { padding: .875rem 1rem; border-radius: .75rem; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .35rem; font-size: .88rem; }
.info-grid > div { display: flex; flex-direction: column; }
.info-grid .label { font-size: .75rem; color: var(--text-muted); }
.order-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: .75rem;
  padding-top: .5rem;
  border-top: 1px solid rgba(255,255,255,.08);
  font-size: 1rem;
}
.loading-bar {
  height: 2px;
  background: var(--accent);
  animation: pulse 1s infinite;
  border-radius: 2px;
}
@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
</style>
