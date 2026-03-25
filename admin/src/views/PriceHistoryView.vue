<template>
  <div class="price-history-view">
    <div class="view-header">
      <div>
        <h1>📉 Price History</h1>
        <p class="subtitle">Track and audit price changes across your product catalog</p>
      </div>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.products_changed || 0 }}</div>
        <div class="stat-label">Products Changed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_changes || 0 }}</div>
        <div class="stat-label">Total Changes ({{ days }}d)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.last_change ? formatDate(stats.last_change) : '—' }}</div>
        <div class="stat-label">Last Change</div>
      </div>
    </div>

    <!-- Recent Changes + Product Lookup -->
    <div class="layout-two-col">
      <!-- Recent Changes -->
      <div class="glass-card">
        <div class="card-header">
          <h3>Recent Changes</h3>
          <select v-model="days" @change="fetchStats" class="period-select">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
        <div v-if="!stats?.recent?.length" class="empty-state">No price changes in this period.</div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Sale</th>
              <th>By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in stats.recent" :key="item.id" @click="lookupProduct(item)" class="clickable-row">
              <td>
                <span class="product-link">{{ item.product_name || '—' }}</span>
              </td>
              <td><strong>€{{ parseFloat(item.price).toFixed(2) }}</strong></td>
              <td>{{ item.sale_price ? '€' + parseFloat(item.sale_price).toFixed(2) : '—' }}</td>
              <td>{{ item.changed_by_name || '—' }}</td>
              <td class="date-cell">{{ formatDate(item.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Product Price Lookup -->
      <div class="glass-card">
        <div class="card-header">
          <h3>Product Price History</h3>
        </div>
        <div class="search-group">
          <input v-model="productSearch" @input="searchProducts" placeholder="Search product by name..." class="search-input" />
          <div v-if="productResults.length" class="search-dropdown">
            <div v-for="p in productResults" :key="p.id" @click="selectProduct(p)" class="search-option">
              {{ p.name }} — €{{ p.price }}
            </div>
          </div>
        </div>

        <div v-if="selectedProduct" class="product-detail">
          <div class="product-info-bar">
            <strong>{{ selectedProduct.name }}</strong>
            <span class="current-price">Current: €{{ parseFloat(selectedProduct.price).toFixed(2) }}
              <span v-if="selectedProduct.sale_price" class="sale-tag"> / Sale: €{{ parseFloat(selectedProduct.sale_price).toFixed(2) }}</span>
            </span>
          </div>

          <!-- Price chart (simplified bar chart) -->
          <div class="price-chart" v-if="productHistory.length > 1">
            <div class="chart-title">Price trend ({{ productHistory.length }} changes)</div>
            <div class="chart-bars">
              <div v-for="(entry, i) in chartData" :key="i" class="chart-bar-wrap" :title="'€' + entry.price.toFixed(2) + ' — ' + formatDate(entry.created_at)">
                <div class="chart-bar" :style="{ height: entry.heightPct + '%' }"></div>
                <div class="chart-label">{{ entry.shortDate }}</div>
              </div>
            </div>
            <div class="chart-range">
              <span>Min: €{{ minPrice.toFixed(2) }}</span>
              <span>Max: €{{ maxPrice.toFixed(2) }}</span>
            </div>
          </div>

          <!-- History table -->
          <div v-if="loadingHistory" class="loading-state">Loading history...</div>
          <table v-else-if="productHistory.length" class="data-table history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>Sale Price</th>
                <th>Change</th>
                <th>By</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, i) in productHistory" :key="entry.id">
                <td class="date-cell">{{ formatDate(entry.created_at) }}</td>
                <td><strong>€{{ parseFloat(entry.price).toFixed(2) }}</strong></td>
                <td>{{ entry.sale_price ? '€' + parseFloat(entry.sale_price).toFixed(2) : '—' }}</td>
                <td>
                  <span v-if="i < productHistory.length - 1" class="change-badge" :class="getPriceChangeClass(entry, productHistory[i+1])">
                    {{ getPriceChangeDiff(entry, productHistory[i+1]) }}
                  </span>
                  <span v-else class="change-badge initial">Initial</span>
                </td>
                <td>{{ entry.changed_by_name || '—' }}</td>
                <td class="note-cell">{{ entry.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state">No price history yet for this product.</div>
        </div>
        <div v-else class="empty-state product-hint">
          Search for a product above to view its full price history.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const stats = ref(null)
const days = ref('30')
const productSearch = ref('')
const productResults = ref([])
const selectedProduct = ref(null)
const productHistory = ref([])
const loadingHistory = ref(false)
let searchTimer = null

async function fetchStats () {
  try { stats.value = await api.get(`/api/price-history/stats?days=${days.value}`) } catch {}
}

function searchProducts () {
  clearTimeout(searchTimer)
  if (!productSearch.value.trim()) { productResults.value = []; return }
  searchTimer = setTimeout(async () => {
    try {
      const data = await api.get(`/api/products?all=1&q=${encodeURIComponent(productSearch.value)}&limit=10`)
      productResults.value = data.products || data || []
    } catch { productResults.value = [] }
  }, 300)
}

async function selectProduct (p) {
  selectedProduct.value = p
  productSearch.value = p.name
  productResults.value = []
  await loadHistory(p.id)
}

async function lookupProduct (item) {
  if (!item.product_id) return
  loadingHistory.value = true
  try {
    const data = await api.get(`/api/price-history/admin?product_id=${item.product_id}`)
    selectedProduct.value = data.product || { name: item.product_name, id: item.product_id, price: item.price }
    productSearch.value = selectedProduct.value.name || ''
    productHistory.value = data.history || []
  } finally { loadingHistory.value = false }
}

async function loadHistory (productId) {
  loadingHistory.value = true
  try {
    const data = await api.get(`/api/price-history/admin?product_id=${productId}`)
    productHistory.value = data.history || []
  } finally { loadingHistory.value = false }
}

const minPrice = computed(() => Math.min(...productHistory.value.map(e => e.price)))
const maxPrice = computed(() => Math.max(...productHistory.value.map(e => e.price)))

const chartData = computed(() => {
  const entries = [...productHistory.value].reverse().slice(-20)
  const min = Math.min(...entries.map(e => e.price))
  const max = Math.max(...entries.map(e => e.price))
  const range = max - min || 1
  return entries.map(e => ({
    ...e,
    heightPct: Math.max(10, ((e.price - min) / range) * 80 + 10),
    shortDate: new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }))
})

function getPriceChangeDiff (current, previous) {
  if (!previous) return ''
  const diff = current.price - previous.price
  return (diff >= 0 ? '+' : '') + '€' + diff.toFixed(2)
}

function getPriceChangeClass (current, previous) {
  if (!previous) return ''
  return current.price > previous.price ? 'up' : current.price < previous.price ? 'down' : 'neutral'
}

function formatDate (d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(fetchStats)
</script>

<style scoped>
.price-history-view { padding: 1.5rem; }
.view-header { margin-bottom: 1.5rem; }
.subtitle { color: #888; margin-top: .25rem; }

.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: var(--surface, hsl(228,4%,15%)); border-radius: 1rem; padding: 1rem 1.5rem; }
.stat-value { font-size: 1.4rem; font-weight: 700; }
.stat-label { font-size: .8rem; color: #888; }

.layout-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 900px) { .layout-two-col { grid-template-columns: 1fr; } }

.glass-card { background: var(--surface); border-radius: 1rem; padding: 1.25rem; border: 1px solid rgba(255,255,255,.08); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.card-header h3 { margin: 0; font-size: 1rem; }
.period-select { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .35rem .75rem; color: inherit; }

.empty-state { text-align: center; padding: 2rem; color: #888; }
.product-hint { padding: 3rem 2rem; }

.data-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.data-table th { color: #888; text-align: left; padding: .5rem .75rem; border-bottom: 1px solid rgba(255,255,255,.08); font-size: .78rem; text-transform: uppercase; }
.data-table td { padding: .5rem .75rem; border-bottom: 1px solid rgba(255,255,255,.05); }
.clickable-row { cursor: pointer; }
.clickable-row:hover { background: rgba(255,255,255,.03); }
.date-cell { color: #888; font-size: .8rem; white-space: nowrap; }
.note-cell { color: #888; font-size: .85rem; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.product-link { color: var(--accent); cursor: pointer; }

.change-badge { padding: .15rem .5rem; border-radius: .4rem; font-size: .8rem; font-weight: 600; }
.change-badge.up { background: rgba(239,68,68,.15); color: #f87171; }
.change-badge.down { background: rgba(34,197,94,.15); color: #4ade80; }
.change-badge.neutral { background: rgba(107,114,128,.15); color: #9ca3af; }
.change-badge.initial { background: rgba(168,85,247,.15); color: #c084fc; }

.search-group { position: relative; margin-bottom: 1rem; }
.search-input { width: 100%; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; padding: .6rem 1rem; color: inherit; box-sizing: border-box; }
.search-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; z-index: 100; max-height: 200px; overflow-y: auto; }
.search-option { padding: .6rem 1rem; cursor: pointer; font-size: .9rem; }
.search-option:hover { background: rgba(255,255,255,.06); }

.product-detail { margin-top: .5rem; }
.product-info-bar { display: flex; justify-content: space-between; align-items: center; padding: .75rem 0; border-bottom: 1px solid rgba(255,255,255,.08); margin-bottom: 1rem; flex-wrap: wrap; gap: .5rem; }
.current-price { color: #aaa; font-size: .9rem; }
.sale-tag { color: var(--accent); }

.price-chart { background: rgba(255,255,255,.03); border-radius: .75rem; padding: 1rem; margin-bottom: 1rem; }
.chart-title { font-size: .8rem; color: #888; margin-bottom: .75rem; }
.chart-bars { display: flex; align-items: flex-end; gap: 4px; height: 80px; }
.chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.chart-bar { width: 100%; background: var(--accent, hsl(355,70%,58%)); border-radius: 3px 3px 0 0; opacity: .7; transition: opacity .2s; cursor: pointer; }
.chart-bar:hover { opacity: 1; }
.chart-label { font-size: .65rem; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40px; text-align: center; }
.chart-range { display: flex; justify-content: space-between; font-size: .75rem; color: #888; margin-top: .5rem; }

.loading-state { text-align: center; padding: 1.5rem; color: #888; }
.history-table { margin-top: .5rem; }
</style>
