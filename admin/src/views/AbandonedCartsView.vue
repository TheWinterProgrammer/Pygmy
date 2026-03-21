<template>
  <div>
    <div class="page-header">
      <h1>🛒 Abandoned Carts</h1>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="load" title="Refresh">↻ Refresh</button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="selected.size === 0 || sending"
          @click="sendEmails"
        >
          {{ sending ? 'Sending…' : `📤 Send Recovery Email${selected.size > 1 ? 's' : ''} (${selected.size})` }}
        </button>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="stats">
      <div class="scard glass">
        <div class="scard-num">{{ stats.total }}</div>
        <div class="scard-label">Abandoned</div>
      </div>
      <div class="scard glass">
        <div class="scard-num">{{ stats.notified }}</div>
        <div class="scard-label">Emailed</div>
      </div>
      <div class="scard glass scard-green">
        <div class="scard-num">{{ stats.recovered }}</div>
        <div class="scard-label">Recovered</div>
      </div>
      <div class="scard glass scard-red">
        <div class="scard-num">{{ currencySymbol }}{{ Number(stats.revenue || 0).toFixed(2) }}</div>
        <div class="scard-label">Lost Revenue</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters glass">
      <input class="input filter-input" v-model="searchQ" placeholder="Search by email or name…" @input="debouncedLoad" />
      <select class="select filter-select" v-model="filterRecovered" @change="load">
        <option value="">All carts</option>
        <option value="0">Not recovered</option>
        <option value="1">Recovered</option>
      </select>
      <select class="select filter-select" v-model="filterNotified" @change="load">
        <option value="">Any notification</option>
        <option value="0">Not emailed</option>
        <option value="1">Already emailed</option>
      </select>
      <select class="select filter-select" v-model="filterHoursOld" @change="load">
        <option value="0.5">Abandoned 30 min+</option>
        <option value="1">Abandoned 1h+</option>
        <option value="3">Abandoned 3h+</option>
        <option value="24">Abandoned 24h+</option>
      </select>
    </div>

    <!-- Bulk select bar -->
    <div class="bulk-bar glass" v-if="carts.length > 0">
      <label class="checkbox-row">
        <input type="checkbox" :checked="allSelected" :indeterminate="someSelected && !allSelected" @change="toggleAll" />
        <span class="text-muted" style="font-size:.82rem;">
          {{ selected.size ? `${selected.size} selected` : 'Select all' }}
        </span>
      </label>
      <span v-if="selected.size > 0" class="bulk-info text-muted" style="font-size:.82rem;">
        · Only carts with an email address can receive recovery emails.
      </span>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <div class="loading-bar" v-if="loading"></div>

      <table class="data-table" v-if="carts.length">
        <thead>
          <tr>
            <th style="width:36px;"></th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Idle Since</th>
            <th>Status</th>
            <th style="width:90px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="cart in carts"
            :key="cart.id"
            class="cart-row"
            :class="{ selected: selected.has(cart.id), recovered: cart.recovered }"
            @click.stop
          >
            <td>
              <input type="checkbox" :checked="selected.has(cart.id)" @change="toggleSelect(cart.id)" />
            </td>
            <td>
              <div class="customer-cell">
                <span v-if="cart.name" class="customer-name">{{ cart.name }}</span>
                <span v-if="cart.email" class="customer-email">{{ cart.email }}</span>
                <span v-if="!cart.email && !cart.name" class="text-muted" style="font-size:.82rem;">Anonymous</span>
                <span v-if="!cart.email && cart.name" class="text-muted" style="font-size:.8rem;">No email</span>
              </div>
            </td>
            <td>
              <button class="btn btn-ghost btn-xs" @click="viewCart(cart)">
                🛍️ {{ cart.items.length }} item{{ cart.items.length !== 1 ? 's' : '' }}
              </button>
            </td>
            <td>
              <strong>{{ currencySymbol }}{{ Number(cart.subtotal).toFixed(2) }}</strong>
            </td>
            <td>
              <span class="text-muted" style="font-size:.82rem;">{{ timeAgo(cart.updated_at) }}</span>
            </td>
            <td>
              <div class="status-pills">
                <span v-if="cart.recovered" class="pill pill-green">✓ Recovered</span>
                <span v-else-if="cart.notified" class="pill pill-blue">📤 Emailed</span>
                <span v-else class="pill pill-grey">Pending</span>
                <span v-if="!cart.email" class="pill pill-amber" title="Cannot send email without address">No email</span>
              </div>
            </td>
            <td class="row-actions">
              <button
                class="btn btn-ghost btn-xs"
                :disabled="!cart.email || cart.recovered || sending"
                @click="sendSingleEmail(cart)"
                title="Send recovery email"
              >📤</button>
              <button class="btn btn-ghost btn-xs btn-danger" @click="confirmDelete(cart)" title="Delete">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="empty-state" v-else-if="!loading">
        <div style="font-size:2.5rem;margin-bottom:.5rem">🛒</div>
        <p>No abandoned carts found with the current filters.</p>
        <p class="text-muted" style="font-size:.85rem;">Abandoned carts appear here when customers add items but don't complete checkout.</p>
      </div>

      <!-- Pagination -->
      <div class="pagination" v-if="total > pageSize">
        <button class="btn btn-ghost btn-sm" :disabled="page === 0" @click="prevPage">← Prev</button>
        <span class="text-muted" style="font-size:.85rem;">
          Showing {{ page * pageSize + 1 }}–{{ Math.min((page + 1) * pageSize, total) }} of {{ total }}
        </span>
        <button class="btn btn-ghost btn-sm" :disabled="(page + 1) * pageSize >= total" @click="nextPage">Next →</button>
      </div>
    </div>

    <!-- Cart detail modal -->
    <div class="modal-overlay" v-if="detailCart" @click.self="detailCart = null">
      <div class="modal glass" style="max-width:540px;">
        <div class="modal-header">
          <h2>Cart Details</h2>
          <button class="btn-close" @click="detailCart = null">✕</button>
        </div>
        <div class="modal-body">
          <!-- Customer info -->
          <div class="detail-info">
            <div class="detail-field" v-if="detailCart.name">
              <span class="detail-label">Name</span>
              <span>{{ detailCart.name }}</span>
            </div>
            <div class="detail-field" v-if="detailCart.email">
              <span class="detail-label">Email</span>
              <a :href="`mailto:${detailCart.email}`" class="link">{{ detailCart.email }}</a>
            </div>
            <div class="detail-field">
              <span class="detail-label">Session ID</span>
              <code style="font-size:.78rem;opacity:.6;">{{ detailCart.session_id }}</code>
            </div>
            <div class="detail-field">
              <span class="detail-label">IP</span>
              <code style="font-size:.78rem;opacity:.6;">{{ detailCart.ip || '—' }}</code>
            </div>
            <div class="detail-field">
              <span class="detail-label">Created</span>
              <span>{{ formatDate(detailCart.created_at) }}</span>
            </div>
            <div class="detail-field">
              <span class="detail-label">Last seen</span>
              <span>{{ formatDate(detailCart.updated_at) }} ({{ timeAgo(detailCart.updated_at) }})</span>
            </div>
            <div class="detail-field" v-if="detailCart.notified_at">
              <span class="detail-label">Emailed</span>
              <span>{{ formatDate(detailCart.notified_at) }}</span>
            </div>
          </div>

          <!-- Items table -->
          <div class="items-table-wrap">
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Price</th>
                  <th style="text-align:right;">Line</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in detailCart.items" :key="i">
                  <td>
                    <div>{{ item.name || item.product_name || 'Product' }}</div>
                    <div v-if="item.variant_label" class="variant-label">{{ item.variant_label }}</div>
                  </td>
                  <td style="text-align:center;">{{ item.quantity }}</td>
                  <td style="text-align:right;">{{ currencySymbol }}{{ Number(item.unit_price || 0).toFixed(2) }}</td>
                  <td style="text-align:right;">{{ currencySymbol }}{{ Number((item.unit_price || 0) * item.quantity).toFixed(2) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align:right;font-weight:700;padding:.5rem .6rem;">Total</td>
                  <td style="text-align:right;font-weight:700;padding:.5rem .6rem;">
                    {{ currencySymbol }}{{ Number(detailCart.subtotal).toFixed(2) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="detailCart = null">Close</button>
          <button
            class="btn btn-primary"
            v-if="detailCart.email && !detailCart.recovered"
            :disabled="sending"
            @click="sendSingleEmail(detailCart); detailCart = null"
          >
            📤 Send Recovery Email
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass" style="max-width:400px;">
        <div class="modal-header">
          <h2>Delete Cart</h2>
          <button class="btn-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Delete this abandoned cart record for <strong>{{ deleteTarget.email || 'anonymous visitor' }}</strong>?</p>
          <p class="text-muted" style="font-size:.85rem;">This only removes the tracking record — it won't affect any orders.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-primary btn-danger" @click="doDelete" :disabled="deleting">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()

// ── State ──────────────────────────────────────────────────────────────────────
const carts       = ref([])
const stats       = ref(null)
const loading     = ref(false)
const sending     = ref(false)
const deleting    = ref(false)
const total       = ref(0)
const page        = ref(0)
const pageSize    = 20
const selected    = ref(new Set())
const detailCart  = ref(null)
const deleteTarget = ref(null)
const currencySymbol = ref('€')

const searchQ        = ref('')
const filterRecovered = ref('')
const filterNotified  = ref('')
const filterHoursOld  = ref('1')

// ── Computed ───────────────────────────────────────────────────────────────────
const allSelected  = computed(() => carts.value.length > 0 && carts.value.every(c => selected.value.has(c.id)))
const someSelected = computed(() => carts.value.some(c => selected.value.has(c.id)))

// ── Data loading ───────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      limit: pageSize,
      offset: page.value * pageSize,
      hours_old: filterHoursOld.value,
    })
    if (searchQ.value.trim())    params.set('q', searchQ.value.trim())
    if (filterRecovered.value !== '') params.set('recovered', filterRecovered.value)
    if (filterNotified.value  !== '') params.set('notified',  filterNotified.value)

    const { data } = await api.get(`/abandoned-carts?${params}`)
    carts.value = data.carts || []
    total.value = data.total || 0
    selected.value = new Set()
  } catch {
    toast.error('Failed to load abandoned carts')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const { data } = await api.get('/abandoned-carts/stats')
    stats.value = data
  } catch {}
}

async function loadCurrencySymbol() {
  try {
    const { data } = await api.get('/settings')
    currencySymbol.value = data.shop_currency_symbol || '€'
  } catch {}
}

onMounted(() => {
  load()
  loadStats()
  loadCurrencySymbol()
})

// ── Debounced search ──────────────────────────────────────────────────────────
let searchTimer = null
function debouncedLoad() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 0; load() }, 350)
}

// ── Selection ──────────────────────────────────────────────────────────────────
function toggleSelect(id) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(carts.value.map(c => c.id))
  }
}

// ── Actions ────────────────────────────────────────────────────────────────────
function viewCart(cart) {
  detailCart.value = cart
}

function confirmDelete(cart) {
  deleteTarget.value = cart
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.delete(`/abandoned-carts/${deleteTarget.value.id}`)
    carts.value = carts.value.filter(c => c.id !== deleteTarget.value.id)
    selected.value.delete(deleteTarget.value.id)
    toast.success('Cart deleted')
    deleteTarget.value = null
    loadStats()
  } catch {
    toast.error('Delete failed')
  } finally {
    deleting.value = false
  }
}

async function sendSingleEmail(cart) {
  if (!cart.email) { toast.error('No email address on this cart'); return }
  sending.value = true
  try {
    const { data } = await api.post('/abandoned-carts/notify', { ids: [cart.id] })
    if (data.sent > 0) {
      toast.success('Recovery email sent!')
      const idx = carts.value.findIndex(c => c.id === cart.id)
      if (idx !== -1) carts.value[idx] = { ...carts.value[idx], notified: 1 }
      loadStats()
    } else {
      toast.error('Email not delivered. Check SMTP settings.')
    }
  } catch {
    toast.error('Failed to send email. Check SMTP settings.')
  } finally {
    sending.value = false
  }
}

async function sendEmails() {
  if (selected.value.size === 0) return
  sending.value = true
  try {
    const ids = Array.from(selected.value)
    const { data } = await api.post('/abandoned-carts/notify', { ids })
    toast.success(`Recovery emails sent: ${data.sent} delivered, ${data.skipped} skipped.`)
    selected.value = new Set()
    load()
    loadStats()
  } catch {
    toast.error('Failed to send emails. Check SMTP settings.')
  } finally {
    sending.value = false
  }
}

// ── Pagination ─────────────────────────────────────────────────────────────────
function prevPage() { page.value--; load() }
function nextPage() { page.value++; load() }

// ── Formatting ─────────────────────────────────────────────────────────────────
function timeAgo(dt) {
  if (!dt) return ''
  const diff = (Date.now() - new Date(dt + 'Z').getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt + (dt.includes('T') ? '' : 'Z')).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
/* ── Stats strip ─────────────────────────────────────────────────────────────── */
.stats-strip {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.scard {
  padding: .875rem 1.25rem;
  border-radius: 1rem;
  min-width: 130px;
  text-align: center;
}
.scard-num   { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.scard-label { font-size: .75rem; color: var(--text-muted); margin-top: .2rem; }
.scard-green .scard-num { color: hsl(140,60%,55%); }
.scard-red   .scard-num { color: var(--accent); }

/* ── Filters ──────────────────────────────────────────────────────────────────── */
.filters {
  display: flex;
  gap: .75rem;
  flex-wrap: wrap;
  padding: .875rem 1rem;
  border-radius: 1rem;
  margin-bottom: 1rem;
  align-items: center;
}
.filter-input  { flex: 1; min-width: 180px; }
.filter-select { min-width: 150px; }

/* ── Bulk bar ─────────────────────────────────────────────────────────────────── */
.bulk-bar {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .5rem 1rem;
  border-radius: .75rem;
  margin-bottom: .75rem;
}
.bulk-info { flex: 1; }

/* ── Table ────────────────────────────────────────────────────────────────────── */
.table-wrap { border-radius: 1rem; overflow: hidden; position: relative; }

.cart-row.recovered td { opacity: .5; }
.cart-row.selected  td { background: rgba(var(--accent-rgb), .05); }

.customer-cell { display: flex; flex-direction: column; gap: .1rem; }
.customer-name { font-weight: 600; font-size: .9rem; }
.customer-email { font-size: .8rem; color: var(--text-muted); }

.status-pills { display: flex; gap: .35rem; flex-wrap: wrap; }

.pill {
  display: inline-flex; align-items: center;
  padding: .2em .6em; border-radius: 999px;
  font-size: .72rem; font-weight: 600;
}
.pill-green { background: hsl(140,55%,14%); color: hsl(140,60%,60%); }
.pill-blue  { background: hsl(220,55%,18%); color: hsl(220,70%,70%); }
.pill-grey  { background: rgba(255,255,255,.07); color: var(--text-muted); }
.pill-amber { background: hsl(40,60%,16%); color: hsl(40,80%,65%); }

.row-actions { display: flex; gap: .3rem; }
.btn-danger  { color: var(--accent) !important; }
.btn-xs { padding: .25rem .5rem !important; font-size: .78rem !important; }

/* ── Pagination ────────────────────────────────────────────────────────────────── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: .875rem;
  border-top: 1px solid var(--border);
}

/* ── Empty state ─────────────────────────────────────────────────────────────── */
.empty-state { padding: 3rem; text-align: center; color: var(--text-muted); }

/* ── Cart detail modal ───────────────────────────────────────────────────────── */
.detail-info {
  display: flex;
  flex-direction: column;
  gap: .5rem;
  margin-bottom: 1.25rem;
}
.detail-field { display: flex; gap: .75rem; align-items: baseline; font-size: .88rem; }
.detail-label { font-size: .75rem; color: var(--text-muted); min-width: 90px; }

.items-table-wrap { overflow-x: auto; border-radius: .5rem; }
.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
}
.items-table th {
  text-align: left;
  padding: .4rem .6rem;
  font-size: .75rem;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.items-table td { padding: .5rem .6rem; border-bottom: 1px solid rgba(255,255,255,.04); }
.items-table tfoot td { border-top: 1px solid var(--border); border-bottom: none; }

.variant-label { font-size: .75rem; color: var(--text-muted); margin-top: .15rem; }
.link { color: var(--accent); text-decoration: none; }
.link:hover { text-decoration: underline; }

/* ── Modal ───────────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 1rem;
}
.modal { width: 100%; max-width: 540px; border-radius: 1.25rem; overflow: hidden; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
}
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.btn-close {
  background: none; border: none; color: var(--text-muted);
  font-size: 1rem; cursor: pointer; padding: .25rem .5rem; border-radius: .4rem;
}
.btn-close:hover { background: rgba(255,255,255,.08); color: var(--text); }
.modal-body   { padding: 1.5rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border); }

/* ── Misc ────────────────────────────────────────────────────────────────────── */
.text-muted { color: var(--text-muted); }
.checkbox-row { display: flex; align-items: center; gap: .5rem; cursor: pointer; }
.checkbox-row input { accent-color: var(--accent); }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: .75rem; }
.header-actions { display: flex; gap: .5rem; align-items: center; }
</style>
