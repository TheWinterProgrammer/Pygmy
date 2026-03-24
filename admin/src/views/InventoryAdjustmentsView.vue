<template>
  <div class="inventory-adj-view">
    <div class="page-header">
      <div>
        <h1>📦 Inventory Adjustment Log</h1>
        <p class="subtitle">Track every stock change with full audit trail</p>
      </div>
      <div class="header-actions">
        <button @click="showAdjustModal = true" class="btn-accent">➕ New Adjustment</button>
        <a :href="exportUrl" class="btn-ghost">⬇️ Export CSV</a>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="statsData">
      <div class="stat-card">
        <div class="stat-value">{{ statsData.stats?.total_adjustments || 0 }}</div>
        <div class="stat-label">Adjustments ({{ days }}d)</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">+{{ statsData.stats?.total_added || 0 }}</div>
        <div class="stat-label">Units Added</div>
      </div>
      <div class="stat-card red">
        <div class="stat-value">-{{ statsData.stats?.total_removed || 0 }}</div>
        <div class="stat-label">Units Removed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ statsData.stats?.products_adjusted || 0 }}</div>
        <div class="stat-label">Products Touched</div>
      </div>
    </div>

    <!-- Reason breakdown -->
    <div class="reason-cards" v-if="statsData?.byReason?.length">
      <div class="reason-card" v-for="r in statsData.byReason" :key="r.reason"
        @click="reasonFilter = reasonFilter === r.reason ? '' : r.reason; loadAdjustments()"
        :class="{ active: reasonFilter === r.reason }">
        <span class="reason-badge" :class="r.reason">{{ r.reason }}</span>
        <span class="reason-count">{{ r.cnt }} × ({{ r.net_change > 0 ? '+' : '' }}{{ r.net_change }})</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" placeholder="Search product..." class="search-input"
        @input="debouncedSearch" />
      <select v-model="reasonFilter" @change="page = 0; loadAdjustments()" class="filter-select">
        <option value="">All reasons</option>
        <option value="manual">Manual</option>
        <option value="sale">Sale</option>
        <option value="return">Return</option>
        <option value="import">Import</option>
        <option value="restock">Restock</option>
      </select>
      <input type="date" v-model="fromDate" @change="loadAdjustments()" class="date-input" placeholder="From" />
      <input type="date" v-model="toDate"   @change="loadAdjustments()" class="date-input" placeholder="To" />
      <button v-if="fromDate || toDate || reasonFilter" @click="clearFilters" class="btn-ghost small">✕ Clear</button>
    </div>

    <!-- Table -->
    <div class="glass-card">
      <table class="adj-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Product</th>
            <th>SKU</th>
            <th>Reason</th>
            <th>Before</th>
            <th>Change</th>
            <th>After</th>
            <th>Note</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in adjustments" :key="a.id">
            <td class="date-cell">{{ fmtDate(a.created_at) }}</td>
            <td class="product-cell">{{ a.product_name }}</td>
            <td class="sku-cell"><code>{{ a.sku || '—' }}</code></td>
            <td><span class="reason-badge" :class="a.reason">{{ a.reason }}</span></td>
            <td class="qty-cell">{{ a.qty_before }}</td>
            <td class="qty-cell change" :class="a.qty_change > 0 ? 'positive' : 'negative'">
              {{ a.qty_change > 0 ? '+' : '' }}{{ a.qty_change }}
            </td>
            <td class="qty-cell">{{ a.qty_after }}</td>
            <td class="note-cell">{{ a.note || '—' }}</td>
            <td class="user-cell">{{ a.user_name || 'system' }}</td>
          </tr>
          <tr v-if="!adjustments.length">
            <td colspan="9" class="empty">No adjustments found.</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination" v-if="total > limit">
        <button @click="page--; loadAdjustments()" :disabled="page === 0">← Prev</button>
        <span>Page {{ page + 1 }} of {{ Math.ceil(total / limit) }}</span>
        <button @click="page++; loadAdjustments()" :disabled="(page + 1) * limit >= total">Next →</button>
      </div>
    </div>

    <!-- New Adjustment Modal -->
    <div class="modal-overlay" v-if="showAdjustModal" @click.self="showAdjustModal = false">
      <div class="modal glass-card">
        <h3>📦 New Stock Adjustment</h3>

        <div class="field-group">
          <label>Product</label>
          <div class="product-search-wrap">
            <input v-model="adjProductSearch" placeholder="Search products..."
              @input="searchProducts" class="form-input" />
            <div class="product-results" v-if="productResults.length">
              <div v-for="p in productResults" :key="p.id"
                class="product-result-row" @click="selectProduct(p)">
                <span class="product-result-name">{{ p.name }}</span>
                <span class="product-result-stock">Stock: {{ p.stock_quantity }}</span>
              </div>
            </div>
          </div>
          <div class="selected-product" v-if="adjProduct">
            ✅ {{ adjProduct.name }} (Current stock: <strong>{{ adjProduct.stock_quantity }}</strong>)
          </div>
        </div>

        <div class="field-row">
          <div class="field-group">
            <label>Qty Change</label>
            <input type="number" v-model.number="adjChange" class="form-input"
              placeholder="e.g. +10 or -5" />
            <div class="change-preview" v-if="adjProduct && adjChange !== 0">
              {{ adjProduct.stock_quantity }} → {{ adjProduct.stock_quantity + adjChange }}
              <span :class="adjChange > 0 ? 'positive' : 'negative'">
                ({{ adjChange > 0 ? '+' : '' }}{{ adjChange }})
              </span>
            </div>
          </div>
          <div class="field-group">
            <label>Reason</label>
            <select v-model="adjReason" class="form-input">
              <option value="manual">Manual</option>
              <option value="restock">Restock</option>
              <option value="return">Return</option>
              <option value="import">Import</option>
              <option value="sale">Sale (correction)</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label>Note (optional)</label>
          <textarea v-model="adjNote" class="form-input" rows="2" placeholder="Reason for adjustment..."></textarea>
        </div>

        <div class="modal-footer">
          <button @click="saveAdjustment" class="btn-accent"
            :disabled="!adjProduct || !adjChange">💾 Save Adjustment</button>
          <button @click="showAdjustModal = false" class="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const adjustments = ref([])
const total = ref(0)
const page = ref(0)
const limit = 50
const statsData = ref(null)
const days = ref(30)

const search = ref('')
const reasonFilter = ref('')
const fromDate = ref('')
const toDate = ref('')

// New adjustment modal
const showAdjustModal = ref(false)
const adjProductSearch = ref('')
const adjProduct = ref(null)
const productResults = ref([])
const adjChange = ref(0)
const adjReason = ref('manual')
const adjNote = ref('')

let searchTimeout = null

const exportUrl = computed(() => {
  const params = new URLSearchParams()
  if (reasonFilter.value) params.set('reason', reasonFilter.value)
  if (fromDate.value) params.set('from', fromDate.value)
  if (toDate.value)   params.set('to', toDate.value)
  return `/api/inventory-adjustments/export/csv?${params.toString()}`
})

onMounted(() => {
  loadStats()
  loadAdjustments()
})

async function loadStats() {
  try {
    const { data } = await api.get('/inventory-adjustments/stats', { params: { days: days.value } })
    statsData.value = data
  } catch {}
}

async function loadAdjustments() {
  try {
    const params = { limit, offset: page.value * limit }
    if (reasonFilter.value) params.reason = reasonFilter.value
    if (fromDate.value)     params.from = fromDate.value
    if (toDate.value)       params.to = toDate.value

    const { data } = await api.get('/inventory-adjustments', { params })
    adjustments.value = data.adjustments || []
    total.value = data.total || 0
  } catch {}
}

function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { page.value = 0; loadAdjustments() }, 300)
}

function clearFilters() {
  reasonFilter.value = ''
  fromDate.value = ''
  toDate.value = ''
  page.value = 0
  loadAdjustments()
}

let productSearchTimeout = null
async function searchProducts() {
  clearTimeout(productSearchTimeout)
  productSearchTimeout = setTimeout(async () => {
    if (!adjProductSearch.value.trim()) { productResults.value = []; return }
    try {
      const { data } = await api.get('/products', { params: { all: 1, q: adjProductSearch.value, limit: 10 } })
      productResults.value = (data.products || data || []).slice(0, 10)
    } catch {}
  }, 250)
}

function selectProduct(p) {
  adjProduct.value = { ...p }
  adjProductSearch.value = p.name
  productResults.value = []
}

async function saveAdjustment() {
  if (!adjProduct.value || !adjChange.value) return
  try {
    await api.post('/inventory-adjustments', {
      product_id: adjProduct.value.id,
      qty_change: adjChange.value,
      reason: adjReason.value,
      note: adjNote.value || undefined
    })
    showAdjustModal.value = false
    adjProduct.value = null
    adjProductSearch.value = ''
    adjChange.value = 0
    adjNote.value = ''
    adjReason.value = 'manual'
    loadAdjustments()
    loadStats()
  } catch (e) {
    alert('Failed: ' + (e.response?.data?.error || e.message))
  }
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
</script>

<style scoped>
.inventory-adj-view { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
.page-header h1 { margin: 0; font-size: 1.5rem; }
.subtitle { color: var(--text-muted, #aaa); margin: 0.25rem 0 0; font-size: 0.875rem; }
.header-actions { display: flex; gap: 0.75rem; }

.stats-strip { display: flex; gap: 1rem; flex-wrap: wrap; }
.stat-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 1rem 1.25rem; min-width: 120px; }
.stat-card.green { border-color: #22c55e44; }
.stat-card.red   { border-color: #ef444444; }
.stat-value { font-size: 1.5rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: var(--text-muted, #aaa); }

.reason-cards { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.reason-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.5rem; padding: 0.4rem 0.75rem; cursor: pointer; display: flex; gap: 0.5rem; align-items: center; font-size: 0.8rem; }
.reason-card:hover, .reason-card.active { border-color: var(--accent); }

.reason-badge { padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; text-transform: capitalize; }
.reason-badge.manual   { background: #a0a0a033; color: #a0a0a0; }
.reason-badge.sale     { background: #ef444433; color: #f87171; }
.reason-badge.return   { background: #f5a62333; color: #f5a623; }
.reason-badge.import   { background: #3b82f633; color: #60a5fa; }
.reason-badge.restock  { background: #22c55e33; color: #4ade80; }

.filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.search-input, .filter-select, .date-input, .form-input {
  background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.5rem;
  color: inherit; padding: 0.5rem 0.875rem; font-size: 0.875rem;
}
.search-input { flex: 1; min-width: 200px; }
.filter-select, .date-input { min-width: 140px; }

.glass-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; overflow: hidden; }
.adj-table { width: 100%; border-collapse: collapse; }
.adj-table th, .adj-table td { padding: 0.65rem 0.875rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.8rem; }
.adj-table th { color: var(--text-muted, #aaa); font-weight: 500; background: rgba(255,255,255,0.02); }
.date-cell { color: var(--text-muted, #aaa); white-space: nowrap; }
.sku-cell code { font-size: 0.75rem; background: rgba(255,255,255,0.05); padding: 0.1rem 0.35rem; border-radius: 0.25rem; }
.qty-cell { font-weight: 600; text-align: center; }
.qty-cell.change.positive { color: #4ade80; }
.qty-cell.change.negative { color: #f87171; }
.note-cell { color: var(--text-muted, #aaa); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-cell { color: var(--text-muted, #aaa); }
.empty { text-align: center; color: var(--text-muted, #aaa); padding: 2rem !important; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; padding: 1rem; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
.modal { min-width: 420px; max-width: 580px; width: 100%; padding: 1.5rem; border-radius: 1rem; display: flex; flex-direction: column; gap: 1rem; }
.modal h3 { margin: 0; }
.field-group { display: flex; flex-direction: column; gap: 0.35rem; }
.field-group label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted, #aaa); text-transform: uppercase; letter-spacing: 0.05em; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-input { width: 100%; }
textarea.form-input { resize: vertical; }

.product-search-wrap { position: relative; }
.product-results { position: absolute; top: 100%; left: 0; right: 0; background: hsl(228,4%,12%); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; z-index: 10; max-height: 200px; overflow-y: auto; }
.product-result-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.875rem; }
.product-result-row:hover { background: rgba(255,255,255,0.06); }
.product-result-stock { font-size: 0.75rem; color: var(--text-muted, #aaa); }
.selected-product { font-size: 0.875rem; color: #4ade80; padding: 0.35rem 0; }
.change-preview { font-size: 0.8rem; color: var(--text-muted, #aaa); }
.positive { color: #4ade80; }
.negative { color: #f87171; }

.modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06); }
.btn-accent { background: var(--accent); color: white; border: none; border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; font-weight: 600; text-decoration: none; }
.btn-accent:disabled { opacity: 0.5; cursor: default; }
.btn-ghost { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: inherit; border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; text-decoration: none; }
.btn-ghost.small { padding: 0.35rem 0.75rem; font-size: 0.8rem; }
</style>
