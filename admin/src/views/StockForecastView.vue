<template>
  <div class="stock-forecast-view">
    <div class="page-header">
      <div>
        <h1>📈 Stock Forecasting</h1>
        <p class="subtitle">Predict stockouts based on order velocity</p>
      </div>
      <div class="header-controls">
        <select v-model="filter" @change="loadForecast" class="filter-select">
          <option value="all">All Products</option>
          <option value="critical">Critical (≤7 days)</option>
          <option value="warning">Warning (≤30 days)</option>
          <option value="healthy">Healthy</option>
          <option value="no_movement">No Movement</option>
        </select>
        <select v-model="days" @change="loadForecast" class="filter-select">
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>
    </div>

    <!-- Summary stats -->
    <div class="stats-strip" v-if="summary">
      <div class="stat-card stat-danger">
        <span class="stat-value">{{ summary.out_of_stock }}</span>
        <span class="stat-label">🚨 Out of Stock</span>
      </div>
      <div class="stat-card stat-warning">
        <span class="stat-value">{{ summary.critical }}</span>
        <span class="stat-label">⚠️ Critical (≤7 days)</span>
      </div>
      <div class="stat-card stat-caution">
        <span class="stat-value">{{ summary.warning }}</span>
        <span class="stat-label">📉 Warning (≤30 days)</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ summary.no_movement }}</span>
        <span class="stat-label">💤 No Movement</span>
      </div>
      <div class="stat-card stat-success">
        <span class="stat-value">{{ summary.healthy }}</span>
        <span class="stat-label">✅ Healthy</span>
      </div>
    </div>

    <!-- Forecast table -->
    <div class="glass-card table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Current Stock</th>
            <th>Daily Velocity</th>
            <th>Sold ({{ days }}d)</th>
            <th>Stockout In</th>
            <th>Reorder Suggestion</th>
            <th>Risk</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="empty-row">Loading…</td>
          </tr>
          <tr v-else-if="!items.length">
            <td colspan="8" class="empty-row">No products found with stock tracking enabled.</td>
          </tr>
          <tr v-for="item in items" :key="item.id" :class="'row-' + item.risk">
            <td>
              <div class="product-cell">
                <img v-if="item.cover_image" :src="item.cover_image" class="product-thumb" />
                <div>
                  <strong>{{ item.name }}</strong>
                  <small v-if="item.sku" class="sku-text">SKU: {{ item.sku }}</small>
                </div>
              </div>
            </td>
            <td>
              <span :class="['stock-badge', item.stock_quantity <= 0 ? 'out' : item.stock_quantity <= (item.low_stock_threshold || 5) ? 'low' : 'ok']">
                {{ item.stock_quantity }}
              </span>
            </td>
            <td>{{ item.daily_velocity }}/day</td>
            <td>{{ item.total_sold }}</td>
            <td>
              <span v-if="item.days_until_stockout === null || item.days_until_stockout === undefined" class="text-muted">N/A</span>
              <span v-else-if="item.days_until_stockout === 0" class="badge badge-red">Already out</span>
              <span v-else class="badge" :class="daysClass(item.days_until_stockout)">
                {{ item.days_until_stockout }}d ({{ item.stockout_date }})
              </span>
            </td>
            <td>
              <span v-if="item.reorder_suggestion > 0" class="reorder-pill">
                Order {{ item.reorder_suggestion }} units
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span class="risk-badge" :class="'risk-' + item.risk">{{ riskLabel(item.risk) }}</span>
            </td>
            <td>
              <button class="btn-icon" title="View Detail" @click="openDetail(item)">📊</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="total > limit" class="pagination">
        <button :disabled="offset === 0" class="btn-secondary" @click="prev">← Prev</button>
        <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
        <button :disabled="offset + limit >= total" class="btn-secondary" @click="next">Next →</button>
      </div>
    </div>

    <!-- Detail Modal: day-by-day chart -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal-card modal-wide">
        <h2>📊 {{ detailProduct?.product?.name }}</h2>
        <div class="detail-stats">
          <div class="detail-stat">
            <span class="stat-value">{{ detailProduct?.daily_velocity }}/day</span>
            <span class="stat-label">Daily Velocity</span>
          </div>
          <div class="detail-stat">
            <span class="stat-value">{{ detailProduct?.total_sold }}</span>
            <span class="stat-label">Units Sold ({{ days }}d)</span>
          </div>
          <div class="detail-stat">
            <span class="stat-value">{{ detailProduct?.product?.stock_quantity }}</span>
            <span class="stat-label">Current Stock</span>
          </div>
          <div class="detail-stat" v-if="detailProduct?.reorder_suggestion > 0">
            <span class="stat-value">{{ detailProduct?.reorder_suggestion }}</span>
            <span class="stat-label">Suggested Reorder</span>
          </div>
        </div>

        <!-- Simple bar chart for history -->
        <div class="chart-section">
          <h3>Sales History ({{ days }} days)</h3>
          <div class="bar-chart">
            <div v-for="d in detailProduct?.history?.slice(-30)" :key="d.date" class="bar-col">
              <div class="bar-fill" :style="{ height: barHeight(d.qty, maxHistorySale) + 'px' }" :title="`${d.date}: ${d.qty} sold`"></div>
              <span class="bar-label">{{ d.date.slice(5) }}</span>
            </div>
          </div>
        </div>

        <!-- Projection -->
        <div class="chart-section" v-if="detailProduct?.daily_velocity > 0">
          <h3>Stock Projection (60 days)</h3>
          <div class="projection-chart">
            <div v-for="(p, i) in detailProduct?.projection?.filter((_, i) => i % 5 === 0)" :key="p.date" class="proj-point">
              <div class="proj-bar" :style="{ height: Math.max(2, barHeight(p.projected_stock, detailProduct?.product?.stock_quantity)) + 'px' }"
                :class="p.projected_stock <= 0 ? 'proj-empty' : p.projected_stock <= 5 ? 'proj-critical' : 'proj-ok'"></div>
              <span class="bar-label">{{ p.date.slice(5) }}</span>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="showDetail = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const API = 'http://localhost:3200/api'
const token = () => localStorage.getItem('pygmy_token')
const headers = () => ({ Authorization: `Bearer ${token()}` })

const items    = ref([])
const summary  = ref(null)
const total    = ref(0)
const loading  = ref(false)
const days     = ref('30')
const filter   = ref('all')
const limit    = 50
const offset   = ref(0)

const showDetail   = ref(false)
const detailProduct = ref(null)

const maxHistorySale = computed(() => {
  if (!detailProduct.value?.history) return 1
  return Math.max(1, ...detailProduct.value.history.map(d => d.qty))
})

async function loadForecast() {
  loading.value = true
  offset.value = 0
  await fetchData()
}

async function fetchData() {
  loading.value = true
  const r = await fetch(
    `${API}/stock-forecast?days=${days.value}&filter=${filter.value}&limit=${limit}&offset=${offset.value}`,
    { headers: headers() }
  )
  const data = await r.json()
  items.value   = data.items || []
  summary.value = data.summary
  total.value   = data.total || 0
  loading.value = false
}

onMounted(loadForecast)

function prev() { offset.value = Math.max(0, offset.value - limit); fetchData() }
function next() { offset.value += limit; fetchData() }

async function openDetail(item) {
  showDetail.value = true
  detailProduct.value = null
  const r = await fetch(`${API}/stock-forecast/${item.id}?days=${days.value}`, { headers: headers() })
  detailProduct.value = await r.json()
}

function riskLabel(risk) {
  return { out_of_stock: '🚨 Out of Stock', critical: '⚠️ Critical', warning: '📉 Warning', low: '📦 Low', healthy: '✅ Healthy' }[risk] || risk
}

function daysClass(d) {
  if (d <= 7)  return 'badge-red'
  if (d <= 30) return 'badge-orange'
  return 'badge-green'
}

function barHeight(val, max) {
  if (!max) return 2
  return Math.round((val / max) * 80)
}
</script>

<style scoped>
.stock-forecast-view { padding: 2rem; max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
h1 { margin: 0; font-size: 1.6rem; }
.subtitle { color: #888; font-size: 0.9rem; margin: 0.25rem 0 0; }
.header-controls { display: flex; gap: 0.75rem; }
.filter-select { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); color: inherit; border-radius: 0.75rem; padding: 0.5rem 0.85rem; font-size: 0.88rem; }

.stats-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 1rem 1.25rem; }
.stat-card.stat-danger  { border-color: rgba(239,68,68,0.3); }
.stat-card.stat-warning { border-color: rgba(245,158,11,0.3); }
.stat-card.stat-caution { border-color: rgba(251,191,36,0.2); }
.stat-card.stat-success { border-color: rgba(34,197,94,0.3); }
.stat-value { display: block; font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.78rem; color: #888; }

.glass-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; padding: 1.5rem; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: #888; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 500; }
.data-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: middle; }
.empty-row { text-align: center; color: #888; padding: 2rem !important; }

.row-out_of_stock { background: rgba(239,68,68,0.04); }
.row-critical { background: rgba(245,158,11,0.04); }

.product-cell { display: flex; align-items: center; gap: 0.75rem; }
.product-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 0.5rem; }
.sku-text { display: block; color: #888; font-size: 0.75rem; }
.text-muted { color: #666; }

.stock-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700; }
.stock-badge.out { background: rgba(239,68,68,0.2); color: #fca5a5; }
.stock-badge.low { background: rgba(245,158,11,0.2); color: #fde68a; }
.stock-badge.ok  { background: rgba(34,197,94,0.15); color: #86efac; }

.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; }
.badge-red    { background: rgba(239,68,68,0.2); color: #fca5a5; }
.badge-orange { background: rgba(245,158,11,0.2); color: #fde68a; }
.badge-green  { background: rgba(34,197,94,0.2); color: #86efac; }

.reorder-pill { background: rgba(99,102,241,0.15); color: #a5b4fc; border-radius: 999px; padding: 0.2rem 0.65rem; font-size: 0.78rem; font-weight: 600; }

.risk-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; }
.risk-out_of_stock { background: rgba(239,68,68,0.2); color: #fca5a5; }
.risk-critical  { background: rgba(245,158,11,0.25); color: #fde68a; }
.risk-warning   { background: rgba(251,191,36,0.15); color: #fef08a; }
.risk-low       { background: rgba(99,102,241,0.15); color: #a5b4fc; }
.risk-healthy   { background: rgba(34,197,94,0.15); color: #86efac; }

.btn-icon { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); color: inherit; border-radius: 0.5rem; padding: 0.3rem 0.5rem; cursor: pointer; font-size: 1rem; }
.btn-secondary { background: rgba(255,255,255,0.08); color: inherit; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.75rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.88rem; }
.btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

.pagination { display: flex; align-items: center; gap: 1rem; justify-content: center; margin-top: 1.25rem; font-size: 0.88rem; color: #888; }

/* Detail Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
.modal-card { background: hsl(228,4%,15%); border: 1px solid rgba(255,255,255,0.15); border-radius: 1.5rem; padding: 2rem; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
.modal-wide { max-width: 820px; }
.modal-card h2 { margin: 0 0 1.25rem; font-size: 1.3rem; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }

.detail-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.detail-stat { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 0.75rem 1rem; }

.chart-section { margin-bottom: 1.5rem; }
.chart-section h3 { font-size: 0.95rem; margin: 0 0 0.75rem; color: #aaa; }

.bar-chart, .projection-chart { display: flex; align-items: flex-end; gap: 3px; height: 90px; padding: 0.5rem 0; overflow-x: auto; }
.bar-col, .proj-point { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; }
.bar-fill { width: 14px; background: var(--accent, #e54e5d); border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.3s; }
.proj-bar { width: 14px; border-radius: 3px 3px 0 0; min-height: 2px; }
.proj-ok       { background: rgba(34,197,94,0.6); }
.proj-critical { background: rgba(245,158,11,0.7); }
.proj-empty    { background: rgba(239,68,68,0.5); }
.bar-label { font-size: 0.6rem; color: #666; transform: rotate(-45deg); white-space: nowrap; }

@media (max-width: 768px) {
  .stats-strip { grid-template-columns: repeat(2, 1fr); }
  .detail-stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
