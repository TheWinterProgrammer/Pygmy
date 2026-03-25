<template>
  <div class="margin-view">
    <div class="page-header">
      <div class="header-left">
        <h1>📊 Profit Margin Tracker</h1>
        <p class="subtitle">Track product cost prices and profit margins</p>
      </div>
      <div class="header-right">
        <button class="btn btn-ghost" @click="exportCsv">⬇️ Export CSV</button>
        <RouterLink to="/products" class="btn btn-ghost">← Products</RouterLink>
      </div>
    </div>

    <div v-if="loading" class="loading-bar"></div>

    <!-- Summary -->
    <div class="stats-strip" v-if="summary">
      <div class="stat-card accent">
        <div class="stat-value">{{ summary.with_cost }} / {{ summary.total_products }}</div>
        <div class="stat-label">Products with Cost Set</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.avg_margin_pct != null ? summary.avg_margin_pct + '%' : '—' }}</div>
        <div class="stat-label">Avg Margin</div>
      </div>
      <div class="stat-card" :class="summary.low_margin_count > 0 ? 'warn' : ''">
        <div class="stat-value">{{ summary.low_margin_count }}</div>
        <div class="stat-label">Low Margin (&lt;20%)</div>
      </div>
      <div class="stat-card" :class="summary.negative_margin_count > 0 ? 'danger' : ''">
        <div class="stat-value">{{ summary.negative_margin_count }}</div>
        <div class="stat-label">Negative Margin</div>
      </div>
    </div>

    <!-- Top/Worst Margin -->
    <div class="two-col" v-if="summary && summary.best?.length">
      <div class="glass panel">
        <h3>🏆 Highest Margin Products</h3>
        <table class="table-minimal">
          <thead><tr><th>Product</th><th>Cost</th><th>Price</th><th>Margin</th></tr></thead>
          <tbody>
            <tr v-for="p in summary.best" :key="p.id">
              <td>{{ p.name }}</td>
              <td>{{ fmt(p.cost_price) }}</td>
              <td>{{ fmt(p.sale_price || p.price) }}</td>
              <td><span class="badge green">{{ p.margin_pct }}%</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="glass panel">
        <h3>⚠️ Lowest Margin Products</h3>
        <table class="table-minimal">
          <thead><tr><th>Product</th><th>Cost</th><th>Price</th><th>Margin</th></tr></thead>
          <tbody>
            <tr v-for="p in summary.worst" :key="p.id">
              <td>{{ p.name }}</td>
              <td>{{ fmt(p.cost_price) }}</td>
              <td>{{ fmt(p.sale_price || p.price) }}</td>
              <td><span class="badge" :class="p.margin_pct < 0 ? 'red' : p.margin_pct < 20 ? 'orange' : 'green'">{{ p.margin_pct }}%</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Category Breakdown -->
    <div class="glass panel" v-if="summary?.byCategory?.length" style="margin-bottom:1.5rem">
      <h3>📂 Margin by Category</h3>
      <div class="category-bars">
        <div v-for="cat in summary.byCategory" :key="cat.category" class="cat-bar-row">
          <span class="cat-name">{{ cat.category }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: Math.max(0, Math.min(100, cat.avg_margin_pct || 0)) + '%', background: marginColor(cat.avg_margin_pct) }"></div>
          </div>
          <span class="cat-pct">{{ cat.avg_margin_pct != null ? cat.avg_margin_pct + '%' : '—' }}</span>
          <span class="cat-count text-muted">({{ cat.products }})</span>
        </div>
      </div>
    </div>

    <!-- Product Table -->
    <div class="glass panel">
      <div class="table-toolbar">
        <input v-model="q" @input="debounceLoad" class="input search-input" placeholder="Search products…" />
        <select v-model="sort" @change="load" class="input" style="width:180px">
          <option value="margin_asc">Margin: Low → High</option>
          <option value="margin_desc">Margin: High → Low</option>
          <option value="price">Price: High → Low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Cost Price</th>
            <th>Selling Price</th>
            <th>Margin</th>
            <th>Units Sold</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td>
              <div style="display:flex;align-items:center;gap:.5rem">
                <img v-if="p.cover_image" :src="p.cover_image" style="width:32px;height:32px;object-fit:cover;border-radius:.5rem;" />
                <div>
                  <div>{{ p.name }}</div>
                  <div class="text-muted" style="font-size:.8rem">{{ p.category || 'Uncategorized' }}</div>
                </div>
              </div>
            </td>
            <td class="mono">{{ p.sku || '—' }}</td>
            <td>
              <div v-if="editingId === p.id" style="display:flex;gap:.4rem;align-items:center">
                <input
                  v-model="editCost"
                  type="number"
                  step="0.01"
                  min="0"
                  class="input input-sm"
                  style="width:90px"
                  @keydown.enter="saveCost(p)"
                  @keydown.escape="editingId = null"
                  @blur="saveCost(p)"
                  ref="costInput"
                />
              </div>
              <div v-else @click="startEdit(p)" class="cost-cell" :class="{ 'missing': !p.cost_price }">
                {{ p.cost_price ? fmt(p.cost_price) : '— click to set' }}
              </div>
            </td>
            <td>
              <div>{{ fmt(p.effective_price) }}</div>
              <div v-if="p.sale_price" class="text-muted" style="font-size:.8rem;text-decoration:line-through">{{ fmt(p.price) }}</div>
            </td>
            <td>
              <span v-if="p.margin_pct != null" class="badge" :class="marginClass(p.margin_pct)">
                {{ p.margin_pct }}%
                <span style="font-size:.75rem;opacity:.8"> ({{ fmt(p.margin_amt) }})</span>
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>{{ p.units_sold }}</td>
            <td>
              <RouterLink :to="`/products/${p.id}/edit`" class="btn btn-ghost btn-sm">✏️ Edit</RouterLink>
            </td>
          </tr>
          <tr v-if="!loading && !products.length">
            <td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)">No products found</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination" v-if="total > pageSize">
        <button class="btn btn-ghost btn-sm" @click="prevPage" :disabled="page === 1">← Prev</button>
        <span style="color:var(--muted);font-size:.9rem">Page {{ page }} / {{ Math.ceil(total / pageSize) }}</span>
        <button class="btn btn-ghost btn-sm" @click="nextPage" :disabled="page * pageSize >= total">Next →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { RouterLink } from 'vue-router'
import api from '../api.js'

const loading = ref(false)
const products = ref([])
const total = ref(0)
const summary = ref(null)
const q = ref('')
const sort = ref('margin_asc')
const page = ref(1)
const pageSize = 50

const editingId = ref(null)
const editCost = ref('')
const costInput = ref(null)

let debounceTimer = null
function debounceLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; load() }, 300)
}

const currencySymbol = ref('€')

async function loadSettings() {
  try {
    const data = await api.get('/settings')
    currencySymbol.value = data.shop_currency_symbol || '€'
  } catch {}
}

function fmt(v) {
  if (v == null) return '—'
  return currencySymbol.value + Number(v).toFixed(2)
}

async function loadSummary() {
  try {
    summary.value = await api.get('/margin/summary')
  } catch {}
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
      sort: sort.value,
    })
    if (q.value) params.set('q', q.value)
    const data = await api.get(`/margin?${params}`)
    products.value = data.products
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function startEdit(p) {
  editingId.value = p.id
  editCost.value = p.cost_price ?? ''
  nextTick(() => {
    const el = document.querySelector('.cost-cell + input, input[type="number"]')
    // Focus the input inside this row
  })
}

async function saveCost(p) {
  if (editingId.value !== p.id) return
  editingId.value = null
  const newCost = editCost.value !== '' ? Number(editCost.value) : null
  if (newCost === p.cost_price) return

  try {
    await api.put(`/margin/${p.id}`, { cost_price: newCost })
    // Update in-place
    const idx = products.value.findIndex(x => x.id === p.id)
    if (idx >= 0) {
      const updated = { ...products.value[idx], cost_price: newCost }
      if (newCost && updated.effective_price) {
        updated.margin_amt = parseFloat((updated.effective_price - newCost).toFixed(2))
        updated.margin_pct = parseFloat(((updated.margin_amt / updated.effective_price) * 100).toFixed(1))
      } else {
        updated.margin_amt = null
        updated.margin_pct = null
      }
      products.value[idx] = updated
    }
    // Refresh summary
    loadSummary()
  } catch (e) {
    alert('Failed to save: ' + (e.message || 'Error'))
  }
}

function marginClass(pct) {
  if (pct < 0) return 'red'
  if (pct < 20) return 'orange'
  if (pct < 40) return 'yellow'
  return 'green'
}

function marginColor(pct) {
  if (!pct || pct < 0) return 'var(--accent)'
  if (pct < 20) return '#f59e0b'
  if (pct < 40) return '#60a5fa'
  return '#34d399'
}

async function exportCsv() {
  const token = localStorage.getItem('pygmy_token')
  const res = await fetch('/api/margin/export/csv', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `product-margins-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function prevPage() { if (page.value > 1) { page.value--; load() } }
function nextPage() { if (page.value * pageSize < total.value) { page.value++; load() } }

onMounted(() => {
  loadSettings()
  loadSummary()
  load()
})
</script>

<style scoped>
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
@media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }

.panel { padding: 1.25rem; }
.panel h3 { margin: 0 0 1rem; font-size: 1rem; }

.table-minimal { width: 100%; border-collapse: collapse; font-size: .9rem; }
.table-minimal th { font-size: .75rem; font-weight: 600; color: var(--muted); padding: .5rem; text-align: left; }
.table-minimal td { padding: .5rem; border-top: 1px solid rgba(255,255,255,.05); }

.table-toolbar { display: flex; gap: .75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 200px; }

.cost-cell { cursor: pointer; color: var(--muted); font-size: .9rem; }
.cost-cell:hover { color: var(--accent); }
.cost-cell.missing { opacity: .5; font-style: italic; }

.category-bars { display: flex; flex-direction: column; gap: .75rem; }
.cat-bar-row { display: grid; grid-template-columns: 140px 1fr 60px 60px; align-items: center; gap: .75rem; }
.bar-track { background: rgba(255,255,255,.05); border-radius: 1rem; height: 8px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 1rem; transition: width .4s; }
.cat-pct { font-size: .85rem; font-weight: 600; text-align: right; }
.cat-name { font-size: .85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.badge { padding: .25rem .6rem; border-radius: .5rem; font-size: .8rem; font-weight: 600; white-space: nowrap; }
.badge.green { background: rgba(52,211,153,.15); color: #34d399; }
.badge.orange { background: rgba(245,158,11,.15); color: #f59e0b; }
.badge.yellow { background: rgba(250,204,21,.15); color: #facc15; }
.badge.red { background: rgba(239,68,68,.15); color: #ef4444; }

.stats-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: rgba(255,255,255,.05); border-radius: 1rem; padding: 1.25rem; border: 1px solid rgba(255,255,255,.08); }
.stat-card.accent { border-color: var(--accent); }
.stat-card.warn { border-color: #f59e0b; }
.stat-card.danger { border-color: #ef4444; }
.stat-value { font-size: 1.6rem; font-weight: 700; }
.stat-label { font-size: .8rem; color: var(--muted); margin-top: .25rem; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th { font-size: .75rem; font-weight: 600; color: var(--muted); padding: .75rem .5rem; border-bottom: 1px solid rgba(255,255,255,.08); text-align: left; }
.data-table td { padding: .75rem .5rem; border-bottom: 1px solid rgba(255,255,255,.05); font-size: .9rem; vertical-align: middle; }

.mono { font-family: monospace; font-size: .85rem; }
.text-muted { color: var(--muted); }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 1rem 0 0; }

.btn { display: inline-flex; align-items: center; gap: .35rem; padding: .5rem 1rem; border-radius: .75rem; font-size: .875rem; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: all .15s; }
.btn-ghost { background: rgba(255,255,255,.06); color: inherit; }
.btn-ghost:hover { background: rgba(255,255,255,.12); }
.btn-sm { padding: .35rem .75rem; font-size: .8rem; }

.input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; color: inherit; font-family: inherit; font-size: .9rem; padding: .5rem .75rem; outline: none; }
.input-sm { padding: .3rem .6rem; font-size: .85rem; }
.input:focus { border-color: var(--accent); }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
.header-left h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 .25rem; }
.subtitle { color: var(--muted); font-size: .9rem; margin: 0; }
.header-right { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }

.loading-bar { height: 3px; background: linear-gradient(90deg, var(--accent), transparent); border-radius: 2px; margin-bottom: 1rem; animation: shimmer 1.5s infinite; }
@keyframes shimmer { 0% { opacity: 1 } 50% { opacity: .4 } 100% { opacity: 1 } }

.glass { background: rgba(255,255,255,.04); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.08); border-radius: 1.25rem; }
</style>
