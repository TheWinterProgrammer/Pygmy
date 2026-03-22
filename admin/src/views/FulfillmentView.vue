<template>
  <div>
    <div class="page-header">
      <h1>📦 Fulfillment Queue</h1>
      <div style="display:flex;gap:.5rem;">
        <span class="badge-count glass" v-if="pendingCount > 0">{{ pendingCount }} to ship</span>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="stats-row">
      <div class="stat-card glass">
        <div class="stat-num">{{ counts.pending }}</div>
        <div class="stat-lbl">Pending</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ counts.processing }}</div>
        <div class="stat-lbl">Processing</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ counts.to_ship }}</div>
        <div class="stat-lbl">Ready to Ship</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ counts.shipped_today }}</div>
        <div class="stat-lbl">Shipped Today</div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar glass" style="padding:.75rem 1rem;margin-bottom:1rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
      <select class="input input-sm" v-model="filterStatus" @change="load" style="min-width:160px;">
        <option value="pending,processing">Pending + Processing</option>
        <option value="pending">Pending only</option>
        <option value="processing">Processing only</option>
        <option value="shipped">Shipped</option>
      </select>
      <input class="input input-sm" type="search" v-model="q" @input="debouncedLoad" placeholder="Search orders…" style="flex:1;min-width:180px;" />
      <label class="toggle-label" style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;cursor:pointer;">
        <input type="checkbox" v-model="needsTracking" @change="load" />
        <span>Needs tracking only</span>
      </label>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="glass section"><div class="loading-bar"></div></div>

    <!-- Empty -->
    <div v-else-if="orders.length === 0" class="glass section" style="text-align:center;padding:2.5rem;">
      <div style="font-size:2rem;margin-bottom:.5rem;">🎉</div>
      <div style="color:var(--text-muted);">No orders need fulfillment right now!</div>
    </div>

    <!-- Order rows -->
    <div v-else class="fulfillment-list">
      <div
        v-for="order in orders"
        :key="order.id"
        class="order-row glass"
        :class="{ 'row-selected': expanded === order.id }"
      >
        <!-- Summary row -->
        <div class="row-summary" @click="toggle(order)">
          <div class="row-left">
            <div class="order-num">{{ order.order_number }}</div>
            <div class="customer-name text-muted">{{ order.customer_name }}</div>
          </div>
          <div class="row-center">
            <span class="item-count text-muted">{{ order.item_count }} item{{ order.item_count !== 1 ? 's' : '' }}</span>
            <span v-if="order.shipping_country" class="country-pill">{{ order.shipping_country }}</span>
            <span v-if="order.tracking_number" class="track-pill">📦 {{ order.tracking_number }}</span>
          </div>
          <div class="row-right">
            <span :class="['status-badge', 'status-' + order.status]">{{ order.status }}</span>
            <span class="order-date text-muted">{{ fmtDate(order.created_at) }}</span>
            <span class="expand-icon">{{ expanded === order.id ? '▲' : '▼' }}</span>
          </div>
        </div>

        <!-- Expanded fulfillment form -->
        <div v-if="expanded === order.id" class="row-detail">
          <!-- Items summary -->
          <div class="items-mini">
            <div v-for="item in order.items" :key="item.product_id" class="item-mini-row">
              <img v-if="item.cover_image" :src="item.cover_image" class="item-thumb" />
              <span class="item-thumb-placeholder" v-else>📦</span>
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.variant_label" class="variant-chip text-muted">{{ item.variant_label }}</span>
              <span class="item-qty text-muted">× {{ item.quantity }}</span>
            </div>
          </div>

          <!-- Shipping address -->
          <div v-if="order.shipping_address" class="ship-addr text-muted">
            📍 {{ order.shipping_address.replace(/\n/g, ', ') }}
          </div>

          <!-- Fulfillment form -->
          <div class="fulfill-form">
            <div class="ff-row">
              <div class="ff-field">
                <label>Status</label>
                <select class="input input-sm" v-model="drafts[order.id].status">
                  <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <div class="ff-field">
                <label>Carrier</label>
                <input class="input input-sm" type="text" v-model="drafts[order.id].tracking_carrier"
                  placeholder="DHL, FedEx, UPS…" list="carrier-list" />
                <datalist id="carrier-list">
                  <option value="DHL" />
                  <option value="FedEx" />
                  <option value="UPS" />
                  <option value="USPS" />
                  <option value="Royal Mail" />
                  <option value="Hermes" />
                  <option value="DPD" />
                  <option value="GLS" />
                </datalist>
              </div>
              <div class="ff-field">
                <label>Tracking #</label>
                <input class="input input-sm" type="text" v-model="drafts[order.id].tracking_number"
                  placeholder="Tracking number…" />
              </div>
            </div>
            <div class="ff-row">
              <div class="ff-field" style="flex:2;">
                <label>Tracking URL</label>
                <input class="input input-sm" type="url" v-model="drafts[order.id].tracking_url"
                  placeholder="https://track.carrier.com/…" />
              </div>
              <div class="ff-field" style="flex:2;">
                <label>Fulfillment Notes <span class="text-muted" style="font-weight:400;">(sent to customer)</span></label>
                <input class="input input-sm" type="text" v-model="drafts[order.id].fulfillment_notes"
                  placeholder="Left at door, requires signature…" />
              </div>
            </div>
            <div class="ff-actions">
              <button class="btn btn-primary btn-sm" @click="saveFulfillment(order)" :disabled="saving[order.id]">
                {{ saving[order.id] ? 'Saving…' : '✓ Save & Mark Shipped' }}
              </button>
              <button class="btn btn-ghost btn-sm" @click="saveStatusOnly(order)" :disabled="saving[order.id]">
                Save status only
              </button>
              <button class="btn btn-ghost btn-sm" @click="printPackingSlip(order)">
                📋 Packing Slip
              </button>
              <span v-if="saveSuccess[order.id]" class="save-ok">✓ Saved!</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="orders.length > 0" style="text-align:center;margin-top:1.5rem;">
      <RouterLink to="/orders" class="btn btn-ghost">View all orders →</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const orders     = ref([])
const loading    = ref(false)
const q          = ref('')
const filterStatus = ref('pending,processing')
const needsTracking = ref(false)
const expanded   = ref(null)
const saving     = reactive({})
const saveSuccess= reactive({})
const drafts     = reactive({})
const counts     = ref({ pending: 0, processing: 0, to_ship: 0, shipped_today: 0 })

const STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled']

const pendingCount = computed(() => counts.value.pending + counts.value.processing)

async function apiFetch(path, opts = {}) {
  const res = await fetch(`http://localhost:3200/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, ...(opts.headers || {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function load() {
  loading.value = true
  try {
    const statuses = filterStatus.value.split(',')
    const allOrders = []
    for (const status of statuses) {
      const params = new URLSearchParams({ status, limit: 100 })
      if (q.value) params.set('q', q.value)
      const data = await apiFetch(`/orders?${params}`)
      allOrders.push(...(data.orders || []))
    }
    // Sort by created_at asc (oldest first — ship in order)
    allOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    let filtered = allOrders
    if (needsTracking.value) {
      filtered = filtered.filter(o => !o.tracking_number)
    }

    orders.value = filtered.map(o => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []),
      item_count: (() => {
        const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || [])
        return items.reduce((s, i) => s + (i.quantity || 1), 0)
      })()
    }))

    // Init drafts for any new orders
    for (const o of orders.value) {
      if (!drafts[o.id]) {
        drafts[o.id] = {
          status:           o.status,
          tracking_number:  o.tracking_number || '',
          tracking_carrier: o.tracking_carrier || '',
          tracking_url:     o.tracking_url || '',
          fulfillment_notes: o.fulfillment_notes || '',
        }
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadCounts() {
  try {
    const stats = await apiFetch('/orders/stats/summary')
    // Count shipped today
    const today = new Date().toISOString().split('T')[0]
    const shippedData = await apiFetch(`/orders?status=shipped&limit=100`)
    const shippedToday = (shippedData.orders || []).filter(o =>
      o.shipped_at && o.shipped_at.startsWith(today)
    ).length

    counts.value = {
      pending:       stats.pending || 0,
      processing:    stats.processing || 0,
      to_ship:       (stats.pending || 0) + (stats.processing || 0),
      shipped_today: shippedToday,
    }
  } catch {}
}

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 300)
}

function toggle(order) {
  expanded.value = expanded.value === order.id ? null : order.id
}

async function saveFulfillment(order) {
  saving[order.id] = true
  try {
    const d = drafts[order.id]
    // Auto-set status to 'shipped' if we have a tracking number and current status is pending/processing
    const newStatus = (d.status === 'pending' || d.status === 'processing') && d.tracking_number
      ? 'shipped'
      : d.status

    const updated = await apiFetch(`/orders/${order.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status:            newStatus,
        tracking_number:   d.tracking_number,
        tracking_carrier:  d.tracking_carrier,
        tracking_url:      d.tracking_url,
        fulfillment_notes: d.fulfillment_notes,
      })
    })
    // Update draft status
    drafts[order.id].status = updated.status
    // Update order in list
    const idx = orders.value.findIndex(o => o.id === order.id)
    if (idx !== -1) {
      orders.value[idx] = {
        ...orders.value[idx],
        ...updated,
        items: typeof updated.items === 'string' ? JSON.parse(updated.items || '[]') : (updated.items || []),
      }
    }
    saveSuccess[order.id] = true
    setTimeout(() => { saveSuccess[order.id] = false }, 3000)
    await loadCounts()
    // Collapse if shipped
    if (updated.status === 'shipped') {
      expanded.value = null
      if (filterStatus.value !== 'shipped') {
        orders.value = orders.value.filter(o => o.id !== order.id)
      }
    }
  } catch (e) {
    alert(e.message)
  } finally {
    saving[order.id] = false
  }
}

async function saveStatusOnly(order) {
  saving[order.id] = true
  try {
    const updated = await apiFetch(`/orders/${order.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: drafts[order.id].status })
    })
    const idx = orders.value.findIndex(o => o.id === order.id)
    if (idx !== -1) orders.value[idx] = { ...orders.value[idx], ...updated }
    saveSuccess[order.id] = true
    setTimeout(() => { saveSuccess[order.id] = false }, 2000)
    await loadCounts()
  } catch (e) {
    alert(e.message)
  } finally {
    saving[order.id] = false
  }
}

function printPackingSlip(order) {
  window.open(`http://localhost:3200/api/orders/${order.id}/packing-slip`, '_blank')
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  load()
  loadCounts()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
.badge-count {
  padding: .3rem .85rem; border-radius: 999px; font-size: .82rem; font-weight: 700;
  background: hsl(355,70%,20%); color: var(--accent);
}
.stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: .75rem; margin-bottom: 1.25rem; }
.stat-card { padding: .85rem 1rem; border-radius: .75rem; text-align: center; }
.stat-num { font-size: 1.8rem; font-weight: 700; color: var(--accent); line-height: 1; }
.stat-lbl { font-size: .75rem; color: var(--text-muted); margin-top: .2rem; }
.fulfillment-list { display: flex; flex-direction: column; gap: .6rem; }
.order-row { border-radius: .9rem; overflow: hidden; transition: box-shadow .2s; }
.order-row.row-selected { box-shadow: 0 0 0 2px hsl(355,70%,40%); }
.row-summary {
  display: flex; align-items: center; gap: 1rem;
  padding: .85rem 1.1rem; cursor: pointer;
  transition: background .15s;
}
.row-summary:hover { background: rgba(255,255,255,.03); }
.row-left { display: flex; flex-direction: column; gap: .1rem; min-width: 160px; }
.order-num { font-weight: 700; font-size: .95rem; }
.customer-name { font-size: .82rem; }
.row-center { display: flex; align-items: center; gap: .5rem; flex: 1; flex-wrap: wrap; }
.item-count { font-size: .82rem; }
.country-pill {
  font-size: .75rem; padding: .15rem .55rem; border-radius: 999px;
  background: rgba(255,255,255,.07); color: var(--text-muted); font-weight: 600;
}
.track-pill {
  font-size: .75rem; padding: .15rem .55rem; border-radius: 999px;
  background: hsl(180,60%,15%); color: hsl(180,60%,65%); font-family: monospace;
}
.row-right { display: flex; align-items: center; gap: .75rem; }
.order-date { font-size: .78rem; }
.expand-icon { font-size: .7rem; color: var(--text-muted); }
.status-badge { font-size: .72rem; font-weight: 700; padding: .2rem .65rem; border-radius: 999px; text-transform: capitalize; }
.status-pending    { background: hsl(44,80%,18%);  color: hsl(44,80%,65%); }
.status-processing { background: hsl(210,70%,18%); color: hsl(210,70%,65%); }
.status-shipped    { background: hsl(180,60%,15%); color: hsl(180,60%,55%); }
.status-completed  { background: hsl(140,60%,12%); color: hsl(140,60%,55%); }
.status-cancelled  { background: hsl(355,60%,18%); color: hsl(355,60%,65%); }
.row-detail {
  border-top: 1px solid rgba(255,255,255,.07);
  padding: 1rem 1.1rem 1.1rem;
}
.items-mini { display: flex; flex-direction: column; gap: .4rem; margin-bottom: .75rem; }
.item-mini-row { display: flex; align-items: center; gap: .6rem; font-size: .87rem; }
.item-thumb { width: 28px; height: 28px; border-radius: .3rem; object-fit: cover; }
.item-thumb-placeholder { font-size: 1.1rem; }
.item-name { flex: 1; }
.variant-chip { font-size: .77rem; padding: .1rem .45rem; border-radius: .3rem; background: rgba(255,255,255,.06); }
.item-qty { font-size: .82rem; }
.ship-addr { font-size: .82rem; margin-bottom: .85rem; }
.fulfill-form { background: rgba(255,255,255,.03); border-radius: .65rem; padding: .9rem 1rem; }
.ff-row { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: .6rem; }
.ff-field { display: flex; flex-direction: column; gap: .25rem; flex: 1; min-width: 160px; }
.ff-field label { font-size: .75rem; color: var(--text-muted); font-weight: 600; }
.ff-actions { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; margin-top: .75rem; }
.save-ok { font-size: .82rem; color: hsl(140,60%,55%); }
.input-sm { padding: .4rem .7rem; font-size: .87rem; }
.loading-bar {
  height: 2px; background: var(--accent);
  animation: pulse 1s infinite; border-radius: 2px;
}
@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
</style>
