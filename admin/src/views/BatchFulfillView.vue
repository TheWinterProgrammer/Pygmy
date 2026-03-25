<template>
  <div class="batch-fulfill-view">
    <div class="page-header">
      <div>
        <h1>📦 Batch Fulfillment</h1>
        <p class="subtitle">Mark multiple orders as shipped with tracking in one action</p>
      </div>
      <div class="header-actions">
        <span class="selected-count" v-if="selected.size > 0">{{ selected.size }} selected</span>
        <button class="btn btn-ghost" @click="load" :disabled="loading">🔄 Refresh</button>
        <button class="btn btn-primary" :disabled="selected.size === 0 || fulfilling" @click="openFulfillModal">
          🚀 Fulfill Selected ({{ selected.size }})
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="total > 0">
      <div class="stat-card accent">
        <div class="stat-value">{{ total }}</div>
        <div class="stat-label">Pending Orders</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ selected.size }}</div>
        <div class="stat-label">Selected</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <input v-model="q" @input="debounceLoad" placeholder="Search orders…" class="form-input" style="width:240px" />
      <label class="checkbox-label">
        <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
        Select All
      </label>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Orders Table -->
    <div class="glass orders-table" v-if="orders.length > 0">
      <div v-for="order in orders" :key="order.id" :class="['order-row', selected.has(order.id) && 'selected']">
        <label class="row-checkbox">
          <input type="checkbox" :checked="selected.has(order.id)" @change="toggleSelect(order.id)" />
        </label>
        <div class="order-info">
          <div class="order-num">{{ order.order_number }}</div>
          <div class="order-meta">{{ order.customer_name || '—' }} · {{ order.customer_email }}</div>
        </div>
        <div class="order-status">
          <span :class="['status-badge', `status-${order.status}`]">{{ order.status }}</span>
        </div>
        <div class="order-date">{{ formatDate(order.created_at) }}</div>
        <div class="order-items">{{ getItemCount(order) }} item(s)</div>
        <div class="order-tracking" v-if="order.tracking_number">
          <span class="tracking-pill">📦 {{ order.tracking_carrier || '' }} {{ order.tracking_number }}</span>
        </div>
        <div class="order-actions">
          <button class="btn-icon" title="Enter tracking" @click="openSingleFulfill(order)">✏️</button>
        </div>
      </div>
    </div>

    <div class="empty-state glass" v-else-if="!loading">
      <div class="empty-icon">✅</div>
      <h3>All caught up!</h3>
      <p>No pending orders need fulfillment.</p>
    </div>

    <!-- Results Banner -->
    <div v-if="lastResult" :class="['result-banner', lastResult.errors > 0 ? 'warn' : 'success']">
      ✅ Fulfilled {{ lastResult.fulfilled }} order(s)
      <span v-if="lastResult.errors > 0"> · ⚠️ {{ lastResult.errors }} error(s)</span>
      <button class="dismiss-btn" @click="lastResult = null">✕</button>
    </div>

    <!-- Bulk Fulfill Modal -->
    <div v-if="showBulkModal" class="modal-overlay" @click.self="showBulkModal = false">
      <div class="modal-box glass">
        <div class="modal-header">
          <h2>🚀 Fulfill {{ selected.size }} Orders</h2>
          <button class="close-btn" @click="showBulkModal = false">✕</button>
        </div>

        <div class="modal-body">
          <p class="modal-note">
            You can provide tracking info that applies to <strong>all</strong> selected orders, or leave blank to simply mark them as shipped.
          </p>

          <div class="form-grid">
            <div class="form-group">
              <label class="label">Status</label>
              <select v-model="bulkForm.status" class="form-input">
                <option value="shipped">Shipped</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Carrier (optional)</label>
              <input v-model="bulkForm.tracking_carrier" type="text" class="form-input" placeholder="DHL, UPS, FedEx…" />
            </div>
            <div class="form-group">
              <label class="label">Tracking Number (optional)</label>
              <input v-model="bulkForm.tracking_number" type="text" class="form-input" placeholder="Leave blank to skip" />
            </div>
            <div class="form-group">
              <label class="label">Tracking URL (optional)</label>
              <input v-model="bulkForm.tracking_url" type="url" class="form-input" placeholder="https://…" />
            </div>
          </div>

          <div class="form-group full">
            <label class="label">Fulfillment Notes (optional)</label>
            <input v-model="bulkForm.notes" type="text" class="form-input" placeholder="Internal note" />
          </div>

          <div class="order-preview">
            <h4>Orders to fulfill:</h4>
            <div class="preview-tags">
              <span v-for="id in [...selected]" :key="id" class="preview-tag">
                {{ getOrderNum(id) }}
              </span>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showBulkModal = false">Cancel</button>
          <button class="btn btn-primary" :disabled="fulfilling" @click="bulkFulfill">
            {{ fulfilling ? '⏳ Processing…' : `🚀 Fulfill ${selected.size} Orders` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Single Order Tracking Modal -->
    <div v-if="showSingleModal && singleOrder" class="modal-overlay" @click.self="showSingleModal = false">
      <div class="modal-box glass">
        <div class="modal-header">
          <h2>✏️ {{ singleOrder.order_number }}</h2>
          <button class="close-btn" @click="showSingleModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="label">Status</label>
            <select v-model="singleForm.status" class="form-input">
              <option value="shipped">Shipped</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label">Carrier</label>
            <input v-model="singleForm.tracking_carrier" type="text" class="form-input" placeholder="DHL, UPS…" />
          </div>
          <div class="form-group">
            <label class="label">Tracking Number</label>
            <input v-model="singleForm.tracking_number" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label class="label">Tracking URL</label>
            <input v-model="singleForm.tracking_url" type="url" class="form-input" />
          </div>
          <div class="form-group">
            <label class="label">Notes</label>
            <input v-model="singleForm.notes" type="text" class="form-input" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showSingleModal = false">Cancel</button>
          <button class="btn btn-primary" :disabled="fulfilling" @click="singleFulfill">
            {{ fulfilling ? 'Saving…' : '💾 Save & Mark Shipped' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../api.js'

const orders = ref([])
const total = ref(0)
const loading = ref(false)
const q = ref('')
const selected = ref(new Set())
const selectAll = ref(false)
const fulfilling = ref(false)
const lastResult = ref(null)

const showBulkModal = ref(false)
const bulkForm = reactive({ status: 'shipped', tracking_carrier: '', tracking_number: '', tracking_url: '', notes: '' })

const showSingleModal = ref(false)
const singleOrder = ref(null)
const singleForm = reactive({ status: 'shipped', tracking_carrier: '', tracking_number: '', tracking_url: '', notes: '' })

let debounceTimer = null
function debounceLoad () { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 300) }

onMounted(load)

async function load () {
  loading.value = true
  try {
    const { data } = await api.get('/orders/fulfillment-queue', { params: { limit: 100 } })
    orders.value = data.orders || []
    total.value = data.total || 0
    // filter client-side by search
    if (q.value) {
      const qLow = q.value.toLowerCase()
      orders.value = orders.value.filter(o =>
        o.order_number?.toLowerCase().includes(qLow) ||
        o.customer_name?.toLowerCase().includes(qLow) ||
        o.customer_email?.toLowerCase().includes(qLow)
      )
    }
  } catch {}
  loading.value = false
}

function toggleSelect (id) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  selected.value = new Set(selected.value)
}

function toggleSelectAll () {
  if (selectAll.value) {
    selected.value = new Set(orders.value.map(o => o.id))
  } else {
    selected.value = new Set()
  }
}

function getItemCount (order) {
  try { return JSON.parse(order.items || '[]').length } catch { return 0 }
}

function getOrderNum (id) {
  return orders.value.find(o => o.id === id)?.order_number || `#${id}`
}

function formatDate (d) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function openFulfillModal () { showBulkModal.value = true }

async function bulkFulfill () {
  fulfilling.value = true
  try {
    const orderList = [...selected.value].map(id => ({
      id,
      status: bulkForm.status,
      tracking_carrier: bulkForm.tracking_carrier || undefined,
      tracking_number: bulkForm.tracking_number || undefined,
      tracking_url: bulkForm.tracking_url || undefined,
      notes: bulkForm.notes || undefined
    }))
    const { data } = await api.post('/orders/bulk-fulfill', { orders: orderList, status: bulkForm.status })
    lastResult.value = data
    showBulkModal.value = false
    selected.value = new Set()
    Object.assign(bulkForm, { status: 'shipped', tracking_carrier: '', tracking_number: '', tracking_url: '', notes: '' })
    await load()
  } catch (e) {
    alert(e.response?.data?.error || 'Batch fulfill failed')
  } finally {
    fulfilling.value = false
  }
}

function openSingleFulfill (order) {
  singleOrder.value = order
  Object.assign(singleForm, {
    status: 'shipped',
    tracking_carrier: order.tracking_carrier || '',
    tracking_number: order.tracking_number || '',
    tracking_url: order.tracking_url || '',
    notes: ''
  })
  showSingleModal.value = true
}

async function singleFulfill () {
  fulfilling.value = true
  try {
    await api.post('/orders/bulk-fulfill', {
      orders: [{ id: singleOrder.value.id, ...singleForm }],
      status: singleForm.status
    })
    showSingleModal.value = false
    await load()
  } catch (e) {
    alert(e.response?.data?.error || 'Failed to save')
  } finally {
    fulfilling.value = false
  }
}
</script>

<style scoped>
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.header-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.selected-count { font-size: 0.85rem; color: var(--accent); font-weight: 600; }
.subtitle { margin: 0; color: rgba(255,255,255,0.5); font-size: 0.9rem; }

.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 0.75rem; padding: 1rem 1.5rem; min-width: 120px; }
.stat-card.accent { border-color: var(--accent); }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-top: 0.2rem; }

.filter-bar { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; }

.loading-bar { height: 3px; background: var(--accent); border-radius: 2px; margin-bottom: 1rem; }

.orders-table { border-radius: 1rem; overflow: hidden; }
.order-row {
  display: grid;
  grid-template-columns: 40px 1fr 100px 100px 70px 1fr 60px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  transition: background 0.15s;
}
.order-row:last-child { border-bottom: none; }
.order-row:hover { background: rgba(255,255,255,0.03); }
.order-row.selected { background: rgba(var(--accent-rgb,220,38,38),0.08); }
@media (max-width: 768px) {
  .order-row { grid-template-columns: 40px 1fr 90px; gap: 0.5rem; }
  .order-status, .order-date, .order-items, .order-tracking { display: none; }
}

.row-checkbox input { cursor: pointer; }
.order-num { font-size: 0.9rem; font-weight: 600; }
.order-meta { font-size: 0.78rem; color: rgba(255,255,255,0.45); }
.status-badge { padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; }
.status-pending { background: rgba(234,179,8,0.15); color: #fde047; }
.status-processing { background: rgba(59,130,246,0.15); color: #93c5fd; }
.status-shipped { background: rgba(34,197,94,0.15); color: #86efac; }
.order-date { font-size: 0.8rem; color: rgba(255,255,255,0.45); }
.order-items { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
.tracking-pill { font-size: 0.75rem; background: rgba(255,255,255,0.07); padding: 0.15rem 0.5rem; border-radius: 0.4rem; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.6; }
.btn-icon:hover { opacity: 1; }

.result-banner {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 500;
}
.result-banner.success { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #86efac; }
.result-banner.warn { background: rgba(234,179,8,0.15); border: 1px solid rgba(234,179,8,0.3); color: #fde047; }
.dismiss-btn { background: none; border: none; cursor: pointer; color: inherit; opacity: 0.7; font-size: 1rem; }

.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.empty-state h3 { margin-bottom: 0.4rem; }
.empty-state p { color: rgba(255,255,255,0.5); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal-box { padding: 2rem; border-radius: 1.5rem; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.modal-header h2 { margin: 0; font-size: 1.3rem; }
.close-btn { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 1.2rem; cursor: pointer; }
.modal-body { margin-bottom: 1.5rem; }
.modal-note { color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-bottom: 1.25rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem; }
@media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; } }
.form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; }
.form-group.full { grid-column: 1 / -1; }
.label { font-size: 0.85rem; color: rgba(255,255,255,0.6); }
.form-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 0.55rem 0.8rem; border-radius: 0.6rem; font-size: 0.9rem; }
.form-input:focus { outline: none; border-color: var(--accent); }
select.form-input option { background: #1e1e2e; }

.order-preview { margin-top: 1rem; }
.order-preview h4 { font-size: 0.9rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; }
.preview-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.preview-tag { background: rgba(255,255,255,0.08); padding: 0.2rem 0.6rem; border-radius: 0.4rem; font-size: 0.8rem; font-family: monospace; }

.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); }
.btn { padding: 0.65rem 1.4rem; border-radius: 0.75rem; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: all 0.2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-ghost { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
