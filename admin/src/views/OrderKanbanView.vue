<template>
  <div>
    <div class="page-header">
      <h1>📋 Order Kanban</h1>
      <div style="display:flex;align-items:center;gap:.75rem;">
        <input class="input" style="width:220px;" placeholder="Search orders…" v-model="q" @input="debouncedLoad" />
        <button class="btn btn-ghost btn-sm" @click="load">🔄 Refresh</button>
        <RouterLink to="/orders" class="btn btn-ghost btn-sm">📦 List View</RouterLink>
      </div>
    </div>

    <div v-if="loading" class="loading-bar"></div>

    <!-- Column totals strip -->
    <div class="kanban-totals glass" v-if="!loading">
      <div v-for="col in columns" :key="col.status" class="ktotal"
           :style="`border-left:3px solid ${col.color}`">
        <span class="ktotal-count">{{ board[col.status]?.count ?? 0 }}</span>
        <span class="ktotal-label">{{ col.label }}</span>
      </div>
    </div>

    <!-- Kanban Board -->
    <div class="kanban-board" v-if="!loading">
      <div
        v-for="col in columns"
        :key="col.status"
        class="kanban-col glass"
        :style="`--col-accent:${col.color}`"
        @dragover.prevent="dragOver($event, col.status)"
        @dragenter.prevent="dragEnter(col.status)"
        @dragleave="dragLeave(col.status)"
        @drop="onDrop($event, col.status)"
        :class="{ 'drop-target': dragTarget === col.status }"
      >
        <!-- Column header -->
        <div class="col-header">
          <span class="col-dot" :style="`background:${col.color}`"></span>
          <span class="col-title">{{ col.label }}</span>
          <span class="col-count">{{ board[col.status]?.count ?? 0 }}</span>
        </div>

        <!-- Order cards -->
        <div class="col-cards">
          <div
            v-for="order in board[col.status]?.orders ?? []"
            :key="order.id"
            class="order-card glass-card"
            draggable="true"
            @dragstart="dragStart($event, order)"
            @click="openOrder(order)"
            :class="{ 'dragging': draggingId === order.id }"
          >
            <div class="card-top">
              <strong class="card-num">{{ order.order_number }}</strong>
              <span class="card-total">{{ fmtCurrency(order.total) }}</span>
            </div>
            <div class="card-customer">👤 {{ order.customer_name }}</div>
            <div class="card-email text-muted">{{ order.customer_email }}</div>
            <div class="card-items" v-if="order.items?.length">
              <span v-for="(item, i) in order.items.slice(0,3)" :key="i" class="card-item-pill">
                {{ item.name || item.product_name }} ×{{ item.quantity }}
              </span>
              <span v-if="order.items.length > 3" class="card-item-more">+{{ order.items.length - 3 }}</span>
            </div>
            <div class="card-date text-muted">{{ fmtDate(order.created_at) }}</div>
            <div class="card-tags" v-if="order.coupon_code">
              <span class="tag-pill">🎟️ {{ order.coupon_code }}</span>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="!board[col.status]?.orders?.length" class="col-empty">
            No {{ col.label.toLowerCase() }} orders
          </div>

          <!-- Load more -->
          <button
            v-if="(board[col.status]?.count ?? 0) > (board[col.status]?.orders?.length ?? 0)"
            class="btn btn-ghost btn-sm load-more-btn"
            @click="loadMore(col.status)"
          >
            Load more ({{ (board[col.status]?.count ?? 0) - (board[col.status]?.orders?.length ?? 0) }} more)
          </button>
        </div>
      </div>
    </div>

    <!-- Order Detail Modal -->
    <Teleport to="body">
      <div v-if="selectedOrder" class="modal-overlay" @click.self="selectedOrder = null">
        <div class="modal-box glass-modal">
          <div class="modal-header">
            <h3>{{ selectedOrder.order_number }}</h3>
            <button class="btn-close" @click="selectedOrder = null">✕</button>
          </div>
          <div class="modal-body">
            <div class="detail-grid">
              <div class="dg-item"><span class="dg-label">Customer</span><span>{{ selectedOrder.customer_name }}</span></div>
              <div class="dg-item"><span class="dg-label">Email</span><span>{{ selectedOrder.customer_email }}</span></div>
              <div class="dg-item"><span class="dg-label">Total</span><span><strong>{{ fmtCurrency(selectedOrder.total) }}</strong></span></div>
              <div class="dg-item"><span class="dg-label">Date</span><span>{{ fmtDateFull(selectedOrder.created_at) }}</span></div>
            </div>

            <!-- Items -->
            <div v-if="selectedOrder.items?.length" style="margin-top:1rem;">
              <div class="sub-label">Items</div>
              <div class="items-table">
                <div v-for="(item, i) in selectedOrder.items" :key="i" class="item-row">
                  <img v-if="item.cover_image" :src="`/uploads/${item.cover_image}`" class="item-thumb" />
                  <div class="item-thumb placeholder-thumb" v-else>🛍️</div>
                  <div class="item-name">{{ item.name || item.product_name }}</div>
                  <div class="item-qty text-muted">×{{ item.quantity }}</div>
                  <div class="item-price">{{ fmtCurrency((item.price || item.unit_price) * item.quantity) }}</div>
                </div>
              </div>
            </div>

            <!-- Status change -->
            <div style="margin-top:1.25rem;">
              <div class="sub-label">Change Status</div>
              <div class="status-btns">
                <button
                  v-for="col in columns"
                  :key="col.status"
                  class="status-btn"
                  :class="{ active: selectedOrder.status === col.status }"
                  :style="`--sb-color:${col.color}`"
                  @click="changeStatus(selectedOrder, col.status)"
                  :disabled="statusChanging"
                >{{ col.label }}</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <RouterLink :to="`/orders`" class="btn btn-ghost btn-sm" @click="selectedOrder=null">View in Orders →</RouterLink>
            <button class="btn btn-ghost btn-sm" @click="selectedOrder = null">Close</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
// import { useSiteStore } from '../stores/site.js' // removed: admin has no site store

const auth = useAuthStore()
const site = { settings: { shop_currency_symbol: '€' } }

const loading = ref(false)
const board = ref({})
const q = ref('')
const dragTarget = ref(null)
const draggingId = ref(null)
const draggingOrder = ref(null)
const selectedOrder = ref(null)
const statusChanging = ref(false)

const columns = [
  { status: 'pending',    label: 'Pending',    color: '#e8a838' },
  { status: 'processing', label: 'Processing', color: '#4f9ee8' },
  { status: 'shipped',    label: 'Shipped',    color: '#9b59b6' },
  { status: 'completed',  label: 'Completed',  color: '#27ae60' },
  { status: 'cancelled',  label: 'Cancelled',  color: '#e74c3c' },
  { status: 'refunded',   label: 'Refunded',   color: '#95a5a6' },
]

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 350)
}

async function load() {
  loading.value = true
  try {
    const qParam = q.value ? `&q=${encodeURIComponent(q.value)}` : ''
    const res = await fetch(`/api/orders/kanban?limit=20${qParam}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    if (res.ok) {
      board.value = await res.json()
    }
  } catch (e) { console.error(e) }
  loading.value = false
}

async function loadMore(status) {
  const current = board.value[status]?.orders?.length ?? 0
  const qParam = q.value ? `&q=${encodeURIComponent(q.value)}` : ''
  try {
    const res = await fetch(`/api/orders/kanban?limit=${current + 20}${qParam}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    if (res.ok) {
      const data = await res.json()
      if (board.value[status]) {
        board.value[status] = data[status]
      }
    }
  } catch (e) { console.error(e) }
}

function dragStart(e, order) {
  draggingId.value = order.id
  draggingOrder.value = order
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', order.id)
}

function dragOver(e, status) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

function dragEnter(status) {
  dragTarget.value = status
}

function dragLeave(status) {
  if (dragTarget.value === status) dragTarget.value = null
}

async function onDrop(e, newStatus) {
  e.preventDefault()
  dragTarget.value = null
  const order = draggingOrder.value
  draggingId.value = null
  draggingOrder.value = null
  if (!order || order.status === newStatus) return
  await changeStatus(order, newStatus)
}

async function changeStatus(order, newStatus) {
  if (order.status === newStatus) return
  statusChanging.value = true
  const oldStatus = order.status

  // Optimistically move card
  const col = board.value[oldStatus]
  if (col) {
    col.orders = col.orders.filter(o => o.id !== order.id)
    col.count = Math.max(0, (col.count || 1) - 1)
  }
  order.status = newStatus
  if (!board.value[newStatus]) board.value[newStatus] = { orders: [], count: 0 }
  board.value[newStatus].orders.unshift(order)
  board.value[newStatus].count++

  try {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`
      },
      body: JSON.stringify({ status: newStatus })
    })
    if (!res.ok) throw new Error('Failed')
    if (selectedOrder.value?.id === order.id) {
      selectedOrder.value = { ...selectedOrder.value, status: newStatus }
    }
  } catch (e) {
    // Rollback on failure
    board.value[newStatus].orders = board.value[newStatus].orders.filter(o => o.id !== order.id)
    board.value[newStatus].count--
    order.status = oldStatus
    if (!board.value[oldStatus]) board.value[oldStatus] = { orders: [], count: 0 }
    board.value[oldStatus].orders.unshift(order)
    board.value[oldStatus].count++
  }
  statusChanging.value = false
}

function openOrder(order) {
  selectedOrder.value = order
}

function fmtCurrency(v) {
  const symbol = site.settings?.shop_currency_symbol || '€'
  return `${symbol}${Number(v || 0).toFixed(2)}`
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function fmtDateFull(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  site.loadSettings()
  load()
})
</script>

<style scoped>
.kanban-totals {
  display: flex;
  gap: .5rem;
  padding: .75rem 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}
.ktotal {
  display: flex;
  align-items: center;
  gap: .4rem;
  padding: .35rem .75rem;
  border-radius: .5rem;
  background: rgba(255,255,255,.04);
}
.ktotal-count { font-size: 1.1rem; font-weight: 700; }
.ktotal-label { font-size: .78rem; color: var(--text-muted); }

.kanban-board {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: .75rem;
  min-height: 60vh;
  align-items: start;
}
@media (max-width: 1400px) { .kanban-board { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px)  { .kanban-board { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .kanban-board { grid-template-columns: 1fr; } }

.kanban-col {
  border-radius: 1rem;
  padding: .75rem .65rem;
  min-height: 200px;
  border-top: 3px solid var(--col-accent, var(--accent));
  transition: background .15s;
}
.kanban-col.drop-target {
  background: rgba(255,255,255,.07);
  outline: 2px dashed var(--col-accent, var(--accent));
}

.col-header {
  display: flex;
  align-items: center;
  gap: .45rem;
  margin-bottom: .75rem;
}
.col-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.col-title { font-size: .82rem; font-weight: 600; flex: 1; }
.col-count {
  font-size: .72rem;
  background: rgba(255,255,255,.1);
  padding: .15rem .4rem;
  border-radius: 9rem;
  font-weight: 700;
}

.col-cards {
  display: flex;
  flex-direction: column;
  gap: .55rem;
}

.order-card {
  border-radius: .75rem;
  padding: .65rem .75rem;
  cursor: grab;
  border: 1px solid rgba(255,255,255,.08);
  transition: transform .1s, box-shadow .1s, opacity .15s;
  user-select: none;
}
.order-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.3); }
.order-card.dragging { opacity: .45; cursor: grabbing; }
.order-card:active { cursor: grabbing; }

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: .3rem;
}
.card-num { font-size: .82rem; color: var(--accent); }
.card-total { font-size: .85rem; font-weight: 700; }
.card-customer { font-size: .8rem; font-weight: 500; margin-bottom: .15rem; }
.card-email { font-size: .72rem; margin-bottom: .4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-items { display: flex; flex-wrap: wrap; gap: .25rem; margin-bottom: .35rem; }
.card-item-pill {
  font-size: .68rem;
  background: rgba(255,255,255,.07);
  border-radius: 9rem;
  padding: .1rem .4rem;
  white-space: nowrap;
  overflow: hidden;
  max-width: 100px;
  text-overflow: ellipsis;
}
.card-item-more { font-size: .68rem; color: var(--text-muted); }
.card-date { font-size: .7rem; }
.card-tags { margin-top: .3rem; }
.tag-pill {
  font-size: .68rem;
  background: rgba(255,200,50,.12);
  color: #e8b84b;
  border-radius: 9rem;
  padding: .1rem .4rem;
}

.col-empty {
  text-align: center;
  font-size: .8rem;
  color: var(--text-muted);
  padding: 1.5rem .5rem;
  border: 1.5px dashed rgba(255,255,255,.1);
  border-radius: .75rem;
}
.load-more-btn { width: 100%; margin-top: .25rem; font-size: .76rem; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 999;
  backdrop-filter: blur(4px);
}
.modal-box {
  width: 520px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  border-radius: 1.25rem;
  padding: 1.5rem;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.modal-header h3 { font-size: 1.15rem; color: var(--accent); }
.btn-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.1rem; }
.btn-close:hover { color: white; }
.modal-footer { margin-top: 1.25rem; display: flex; gap: .5rem; justify-content: flex-end; }

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .65rem;
}
.dg-item { display: flex; flex-direction: column; gap: .15rem; }
.dg-label { font-size: .72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }

.sub-label { font-size: .78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: .5rem; }

.items-table { display: flex; flex-direction: column; gap: .4rem; }
.item-row {
  display: flex;
  align-items: center;
  gap: .65rem;
  padding: .4rem .5rem;
  background: rgba(255,255,255,.04);
  border-radius: .5rem;
}
.item-thumb {
  width: 36px; height: 36px;
  border-radius: .4rem;
  object-fit: cover;
  flex-shrink: 0;
}
.placeholder-thumb {
  width: 36px; height: 36px;
  border-radius: .4rem;
  background: rgba(255,255,255,.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}
.item-name { flex: 1; font-size: .83rem; }
.item-qty { font-size: .8rem; }
.item-price { font-size: .85rem; font-weight: 600; }

.status-btns {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem;
}
.status-btn {
  padding: .3rem .75rem;
  border-radius: 9rem;
  font-size: .78rem;
  border: 1.5px solid rgba(255,255,255,.15);
  background: rgba(255,255,255,.05);
  color: var(--text-muted);
  cursor: pointer;
  transition: all .15s;
}
.status-btn:hover {
  border-color: var(--sb-color, var(--accent));
  color: var(--sb-color, var(--accent));
  background: rgba(255,255,255,.08);
}
.status-btn.active {
  background: var(--sb-color, var(--accent));
  border-color: var(--sb-color, var(--accent));
  color: white;
  font-weight: 600;
}
.status-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
