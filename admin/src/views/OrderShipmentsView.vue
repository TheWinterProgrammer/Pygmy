<template>
  <div>
    <div class="page-header">
      <div>
        <h1>📦 Multi-Shipment Tracker</h1>
        <p class="subtitle">View and manage multiple shipments per order — useful for split fulfillment and partial shipping</p>
      </div>
    </div>

    <!-- Search + filter bar -->
    <div class="filter-bar glass">
      <input class="input input-sm" v-model="q" @input="debouncedLoad" placeholder="Search by order number or tracking…" />
      <select class="input input-sm" v-model="filterStatus" @change="load">
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <button class="btn btn-primary btn-sm" @click="openCreate">+ New Shipment</button>
    </div>

    <div v-if="loading" class="glass section"><div class="loading-bar"></div></div>
    <div v-else-if="!shipments.length" class="glass section empty-state">
      <div class="empty-icon">📦</div>
      <h3>No shipments yet</h3>
      <p>Create shipments to track packages separately from orders.</p>
    </div>

    <div v-else class="shipments-list">
      <div v-for="s in shipments" :key="s.id" class="glass shipment-card">
        <div class="ship-header">
          <div class="ship-info">
            <div class="order-ref">Order <strong>{{ s.order_number || '#' + s.order_id }}</strong></div>
            <div class="ship-id">Shipment #{{ s.id }}</div>
          </div>
          <span class="status-pill" :class="s.status">{{ statusLabel(s.status) }}</span>
        </div>

        <div class="ship-details">
          <div class="detail-row" v-if="s.carrier || s.tracking_number">
            <span class="detail-label">📫 Carrier:</span>
            <span>{{ s.carrier || '—' }} {{ s.tracking_number ? `— ${s.tracking_number}` : '' }}</span>
          </div>
          <div class="detail-row" v-if="s.tracking_url">
            <span class="detail-label">🔗 Tracking:</span>
            <a :href="s.tracking_url" target="_blank" rel="noopener" class="track-link">{{ s.tracking_url }}</a>
          </div>
          <div class="detail-row" v-if="s.shipped_at">
            <span class="detail-label">🚀 Shipped:</span>
            <span>{{ fmtDate(s.shipped_at) }}</span>
          </div>
          <div class="detail-row" v-if="s.delivered_at">
            <span class="detail-label">✅ Delivered:</span>
            <span>{{ fmtDate(s.delivered_at) }}</span>
          </div>
          <div class="detail-row" v-if="s.notes">
            <span class="detail-label">📝 Notes:</span>
            <span class="text-muted">{{ s.notes }}</span>
          </div>
          <div class="detail-row" v-if="s.items.length">
            <span class="detail-label">📋 Items:</span>
            <span>{{ s.items.map(i => i.name || 'Item').join(', ') }}</span>
          </div>
        </div>

        <div class="ship-footer">
          <span class="text-muted created">Created {{ fmtDate(s.created_at) }}</span>
          <div class="ship-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(s)">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" v-if="s.status === 'pending'" @click="markShipped(s)">🚀 Mark Shipped</button>
            <button class="btn btn-ghost btn-sm" v-if="s.status === 'shipped'" @click="markDelivered(s)">✅ Mark Delivered</button>
            <button class="btn btn-ghost btn-sm btn-danger" @click="deleteShipment(s)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="modal" @click.self="modal = null">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ modal.id ? '✏️ Edit Shipment' : '📦 New Shipment' }}</h2>
          <button class="btn-close" @click="modal = null">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group" v-if="!modal.id">
            <label>Order Number <span class="required">*</span></label>
            <input v-model="modal.order_number" class="input" placeholder="e.g. ORD-240101-0001" @blur="lookupOrder" />
            <span v-if="modal.orderName" class="form-hint success">✅ {{ modal.orderName }}</span>
            <span v-if="modal.orderError" class="form-hint error">{{ modal.orderError }}</span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Carrier</label>
              <input v-model="modal.carrier" class="input" placeholder="e.g. DHL, UPS, FedEx" list="carriers" />
              <datalist id="carriers">
                <option v-for="c in commonCarriers" :key="c" :value="c" />
              </datalist>
            </div>
            <div class="form-group">
              <label>Tracking Number</label>
              <input v-model="modal.tracking_number" class="input" placeholder="e.g. 1Z999AA10123456784" />
            </div>
          </div>
          <div class="form-group">
            <label>Tracking URL</label>
            <input v-model="modal.tracking_url" class="input" placeholder="https://…" />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select v-model="modal.status" class="input">
              <option value="pending">Pending</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="form-row" v-if="modal.status === 'shipped' || modal.status === 'delivered'">
            <div class="form-group">
              <label>Shipped At</label>
              <input v-model="modal.shipped_at" class="input" type="datetime-local" />
            </div>
            <div class="form-group" v-if="modal.status === 'delivered'">
              <label>Delivered At</label>
              <input v-model="modal.delivered_at" class="input" type="datetime-local" />
            </div>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea v-model="modal.notes" class="input" rows="2" placeholder="Internal notes about this shipment…"></textarea>
          </div>
          <div v-if="modalError" class="error-msg">{{ modalError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="modal = null">Cancel</button>
          <button class="btn btn-primary" @click="saveModal" :disabled="saving">
            {{ saving ? 'Saving…' : (modal.id ? 'Update Shipment' : 'Create Shipment') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const shipments = ref([])
const loading = ref(false)
const q = ref('')
const filterStatus = ref('')
const modal = ref(null)
const saving = ref(false)
const modalError = ref('')

const commonCarriers = ['DHL', 'UPS', 'FedEx', 'USPS', 'Royal Mail', 'DPD', 'Hermes', 'Amazon Logistics', 'PostNL', 'GLS', 'TNT', 'DB Schenker']

let debounceTimer
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 350)
}

async function load() {
  loading.value = true
  try {
    // Load recent shipments across all orders by querying directly
    // We'll use a custom approach — list recent shipments from the backend
    const { data } = await api.get('/order-shipments/recent', {
      params: { q: q.value, status: filterStatus.value, limit: 50 }
    }).catch(() => ({ data: [] }))
    shipments.value = Array.isArray(data) ? data : []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  modal.value = {
    order_number: '', carrier: '', tracking_number: '', tracking_url: '',
    status: 'pending', notes: '', shipped_at: '', delivered_at: '',
    orderId: null, orderName: '', orderError: ''
  }
  modalError.value = ''
}

function openEdit(s) {
  modal.value = {
    id: s.id,
    order_id: s.order_id,
    order_number: s.order_number || '',
    carrier: s.carrier || '',
    tracking_number: s.tracking_number || '',
    tracking_url: s.tracking_url || '',
    status: s.status || 'pending',
    notes: s.notes || '',
    shipped_at: s.shipped_at ? s.shipped_at.slice(0, 16) : '',
    delivered_at: s.delivered_at ? s.delivered_at.slice(0, 16) : '',
  }
  modalError.value = ''
}

async function lookupOrder() {
  if (!modal.value?.order_number) return
  modal.value.orderError = ''
  modal.value.orderName = ''
  modal.value.orderId = null
  try {
    const { data } = await api.get('/orders', { params: { q: modal.value.order_number, limit: 1 } })
    const orders = data.orders || data
    const found = Array.isArray(orders) ? orders.find(o => o.order_number === modal.value.order_number) : null
    if (found) {
      modal.value.orderId = found.id
      modal.value.orderName = `${found.customer_name || found.customer_email} — ${found.order_number}`
    } else {
      modal.value.orderError = 'Order not found'
    }
  } catch {
    modal.value.orderError = 'Could not look up order'
  }
}

async function saveModal() {
  if (!modal.value) return
  if (!modal.value.id && !modal.value.orderId) {
    modalError.value = 'Please enter a valid order number'
    return
  }
  saving.value = true
  modalError.value = ''
  try {
    const payload = {
      order_id: modal.value.id ? modal.value.order_id : modal.value.orderId,
      carrier: modal.value.carrier,
      tracking_number: modal.value.tracking_number,
      tracking_url: modal.value.tracking_url,
      status: modal.value.status,
      notes: modal.value.notes,
      shipped_at: modal.value.shipped_at || null,
      delivered_at: modal.value.delivered_at || null,
    }
    if (modal.value.id) {
      await api.put(`/order-shipments/${modal.value.id}`, payload)
    } else {
      await api.post('/order-shipments', payload)
    }
    modal.value = null
    load()
  } catch (e) {
    modalError.value = e.response?.data?.error || 'Save failed'
  } finally {
    saving.value = false
  }
}

async function markShipped(s) {
  try {
    await api.put(`/order-shipments/${s.id}`, { status: 'shipped' })
    load()
  } catch {}
}

async function markDelivered(s) {
  try {
    await api.put(`/order-shipments/${s.id}`, { status: 'delivered' })
    load()
  } catch {}
}

async function deleteShipment(s) {
  if (!confirm(`Delete shipment #${s.id}?`)) return
  try {
    await api.delete(`/order-shipments/${s.id}`)
    load()
  } catch {}
}

function statusLabel(s) {
  const m = { pending: '🟡 Pending', shipped: '🚀 Shipped', delivered: '✅ Delivered', cancelled: '❌ Cancelled' }
  return m[s] || s
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

onMounted(load)
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; }
.subtitle { color:#888; font-size:.9rem; margin:.25rem 0 0; }
.filter-bar { display:flex; gap:.75rem; align-items:center; padding:.75rem 1rem; border-radius:1rem; margin-bottom:1.25rem; flex-wrap:wrap; }
.input { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:.75rem; padding:.6rem .875rem; color:#fff; font-size:.9rem; width:100%; box-sizing:border-box; }
.input-sm { padding:.4rem .75rem; font-size:.85rem; flex:1; min-width:160px; }
.glass { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); }
.section { border-radius:1.25rem; padding:2rem; text-align:center; color:#888; }
.empty-state .empty-icon { font-size:2.5rem; margin-bottom:.5rem; }

.shipments-list { display:flex; flex-direction:column; gap:1rem; }
.shipment-card { border-radius:1.25rem; padding:1.25rem; }
.ship-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:.75rem; }
.order-ref { font-size:.95rem; }
.ship-id { font-size:.8rem; color:#888; margin-top:.1rem; }
.status-pill { padding:.25rem .75rem; border-radius:2rem; font-size:.82rem; font-weight:600; }
.status-pill.pending { background:rgba(251,191,36,.12); color:#fbbf24; }
.status-pill.shipped { background:rgba(96,165,250,.12); color:#60a5fa; }
.status-pill.delivered { background:rgba(74,222,128,.12); color:#4ade80; }
.status-pill.cancelled { background:rgba(248,113,113,.12); color:#f87171; }

.ship-details { display:flex; flex-direction:column; gap:.4rem; margin-bottom:.875rem; }
.detail-row { display:flex; gap:.6rem; font-size:.88rem; align-items:flex-start; }
.detail-label { color:#888; min-width:90px; flex-shrink:0; }
.track-link { color:var(--accent); text-decoration:none; word-break:break-all; }
.track-link:hover { text-decoration:underline; }
.text-muted { color:#aaa; }

.ship-footer { display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,.07); padding-top:.75rem; }
.created { font-size:.8rem; }
.ship-actions { display:flex; gap:.35rem; }

.btn { padding:.45rem 1rem; border-radius:.75rem; border:none; cursor:pointer; font-size:.88rem; font-weight:500; transition:all .2s; }
.btn-primary { background:var(--accent); color:#fff; }
.btn-primary:hover:not(:disabled) { opacity:.85; }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-ghost { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); color:#ddd; }
.btn-ghost:hover { background:rgba(255,255,255,.12); }
.btn-ghost.btn-danger { color:#f87171; border-color:rgba(248,113,113,.3); }
.btn-sm { padding:.3rem .65rem; font-size:.82rem; }

.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:200; backdrop-filter:blur(4px); }
.modal { background:hsl(228,4%,14%); border:1px solid rgba(255,255,255,.12); border-radius:1.5rem; width:100%; max-width:540px; max-height:90vh; overflow:auto; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid rgba(255,255,255,.08); }
.modal-header h2 { margin:0; font-size:1.1rem; }
.btn-close { background:none; border:none; color:#888; font-size:1.1rem; cursor:pointer; }
.modal-body { padding:1.5rem; display:flex; flex-direction:column; gap:.75rem; }
.modal-footer { display:flex; gap:.5rem; justify-content:flex-end; padding:1rem 1.5rem; border-top:1px solid rgba(255,255,255,.08); }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
@media(max-width:520px) { .form-row { grid-template-columns:1fr; } }
.form-group { display:flex; flex-direction:column; gap:.3rem; }
.form-group label { font-size:.82rem; font-weight:500; }
.required { color:var(--accent); }
.form-hint { font-size:.8rem; margin-top:.2rem; }
.form-hint.success { color:#4ade80; }
.form-hint.error { color:#f87171; }
.error-msg { background:rgba(248,113,113,.1); border:1px solid rgba(248,113,113,.3); border-radius:.75rem; padding:.65rem .875rem; color:#f87171; font-size:.88rem; }
</style>
