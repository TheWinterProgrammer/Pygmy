<template>
  <div class="funnel-view">
    <div class="page-header">
      <h1>🔭 Sales Funnel Analytics</h1>
      <p class="subtitle">Track conversion from product views → add to cart → checkout → orders.</p>
    </div>

    <div class="controls">
      <label>Period:</label>
      <select v-model="days" @change="loadAll">
        <option value="7">Last 7 days</option>
        <option value="14">Last 14 days</option>
        <option value="30">Last 30 days</option>
        <option value="60">Last 60 days</option>
        <option value="90">Last 90 days</option>
      </select>
      <button class="btn btn-ghost btn-sm" @click="loadAll">🔄 Refresh</button>
    </div>

    <!-- Funnel Stages -->
    <div v-if="summary" class="funnel-strip">
      <div v-for="(stage, idx) in stages" :key="stage.key" class="funnel-stage-wrap">
        <div class="funnel-stage" :style="{ '--w': stageWidth(idx) }">
          <div class="stage-icon">{{ stage.icon }}</div>
          <div class="stage-count">{{ summary.counts[stage.key].toLocaleString() }}</div>
          <div class="stage-label">{{ stage.label }}</div>
          <div v-if="idx > 0" class="stage-cr">
            {{ stageCR(idx) }}% from prev
          </div>
        </div>
        <div v-if="idx < stages.length - 1" class="funnel-arrow">→</div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div v-if="summary" class="stats-grid">
      <div class="stat-card accent">
        <span class="stat-num">{{ summary.conversions.overall }}%</span>
        <span class="stat-label">Overall Conversion (view → order)</span>
      </div>
      <div class="stat-card green">
        <span class="stat-num">{{ fmtCurrency(summary.revenue) }}</span>
        <span class="stat-label">Revenue This Period</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ summary.orders }}</span>
        <span class="stat-label">Orders Placed</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ summary.orders > 0 ? fmtCurrency(summary.revenue / summary.orders) : '—' }}</span>
        <span class="stat-label">Avg Order Value</span>
      </div>
    </div>

    <!-- Conversion Rate Cards -->
    <div v-if="summary" class="glass-card cr-card">
      <h3>Stage Conversion Rates</h3>
      <div class="cr-grid">
        <div v-for="cr in crRows" :key="cr.label" class="cr-row">
          <span class="cr-label">{{ cr.label }}</span>
          <div class="cr-bar-track">
            <div class="cr-bar-fill" :class="crColor(cr.pct)" :style="{ width: cr.pct + '%' }"></div>
          </div>
          <span class="cr-pct" :class="crColor(cr.pct)">{{ cr.pct }}%</span>
        </div>
      </div>
    </div>

    <!-- Daily Trend Chart -->
    <div v-if="daily.length" class="glass-card chart-card">
      <h3>Daily Trends</h3>
      <div class="legend">
        <span v-for="s in stages" :key="s.key" class="leg-item">
          <span class="leg-dot" :style="{ background: s.color }"></span>{{ s.label }}
        </span>
      </div>
      <div class="line-chart-wrap">
        <div class="line-chart">
          <div v-for="d in daily" :key="d.day" class="day-col">
            <div class="day-bars">
              <div v-for="s in stages" :key="s.key"
                class="day-bar"
                :style="{ height: barH(d[s.key], s.key) + 'px', background: s.color }"
                :title="`${s.label}: ${d[s.key] || 0}`">
              </div>
            </div>
            <span class="day-label">{{ d.day.slice(5) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Per-Product Table -->
    <div class="glass-card product-table-card">
      <h3>Per-Product Funnel</h3>
      <div class="period-note" v-if="productsTotal">{{ productsTotal }} products tracked</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th class="num">Views</th>
            <th class="num">Add to Cart</th>
            <th class="num">View→Cart</th>
            <th class="num">Checkouts</th>
            <th class="num">Orders</th>
            <th class="num">Cart→Order</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.product_id">
            <td class="product-cell">
              <img v-if="p.cover_image" :src="p.cover_image" class="prod-thumb" />
              <span v-else class="prod-emoji">🛍️</span>
              <span>{{ p.product_name || p.product_slug || `#${p.product_id}` }}</span>
            </td>
            <td class="num">{{ p.views }}</td>
            <td class="num">{{ p.carts }}</td>
            <td class="num"><span :class="['cr-pill', crColor(p.view_to_cart)]">{{ p.view_to_cart }}%</span></td>
            <td class="num">{{ p.checkouts }}</td>
            <td class="num">{{ p.orders }}</td>
            <td class="num"><span :class="['cr-pill', crColor(p.cart_to_order)]">{{ p.cart_to_order }}%</span></td>
          </tr>
          <tr v-if="!products.length"><td colspan="7" class="empty">No product funnel data yet for this period.</td></tr>
        </tbody>
      </table>
      <div class="pagination" v-if="productsTotal > 20">
        <button class="btn btn-ghost btn-sm" :disabled="productPage === 0" @click="productPage--; loadProducts()">← Prev</button>
        <span>Page {{ productPage + 1 }}</span>
        <button class="btn btn-ghost btn-sm" :disabled="(productPage + 1) * 20 >= productsTotal" @click="productPage++; loadProducts()">Next →</button>
      </div>
    </div>

    <!-- Help box -->
    <div class="glass-card help-card">
      <h3>📡 How Tracking Works</h3>
      <p>The public frontend sends events to <code>POST /api/funnel/event</code> on key user actions:</p>
      <ul>
        <li><strong>product_view</strong> — when a visitor opens a product detail page</li>
        <li><strong>add_to_cart</strong> — when a visitor adds a product to cart</li>
        <li><strong>checkout_start</strong> — when a visitor navigates to checkout</li>
        <li><strong>order_placed</strong> — when an order is successfully completed</li>
      </ul>
      <p>Conversion rates use <em>unique sessions</em> per stage to avoid counting repeated page refreshes.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const days = ref('30')
const summary = ref(null)
const daily = ref([])
const products = ref([])
const productsTotal = ref(0)
const productPage = ref(0)

const stages = [
  { key: 'product_view',    label: 'Product Views',    icon: '👁️',  color: 'rgba(99,102,241,0.7)' },
  { key: 'add_to_cart',     label: 'Add to Cart',      icon: '🛒',  color: 'rgba(245,158,11,0.7)' },
  { key: 'checkout_start',  label: 'Checkout Start',   icon: '📋',  color: 'rgba(16,185,129,0.7)' },
  { key: 'order_placed',    label: 'Order Placed',     icon: '✅',  color: 'rgba(239,68,68,0.8)' },
]

onMounted(loadAll)

async function loadAll() {
  await Promise.all([loadSummary(), loadDaily(), loadProducts()])
}

async function loadSummary() {
  const { data } = await api.get('/funnel/summary', { params: { days: days.value } })
  summary.value = data
}

async function loadDaily() {
  const { data } = await api.get('/funnel/daily', { params: { days: days.value } })
  daily.value = data
}

async function loadProducts() {
  const { data } = await api.get('/funnel/products', {
    params: { days: days.value, limit: 20, offset: productPage.value * 20 }
  })
  products.value = data.products
  productsTotal.value = data.total
}

function stageWidth(idx) {
  // Funnel visual narrowing
  return 100 - idx * 15
}

function stageCR(idx) {
  if (!summary.value) return 0
  const keys = stages.map(s => s.key)
  const prev = summary.value.counts[keys[idx - 1]] || 1
  const curr = summary.value.counts[keys[idx]] || 0
  return Math.round((curr / prev) * 1000) / 10
}

const crRows = computed(() => {
  if (!summary.value) return []
  const c = summary.value.conversions
  return [
    { label: 'View → Add to Cart',      pct: c.view_to_cart },
    { label: 'Cart → Checkout',         pct: c.cart_to_checkout },
    { label: 'Checkout → Order',        pct: c.checkout_to_order },
    { label: 'Overall (View → Order)',  pct: c.overall },
  ]
})

function crColor(pct) {
  if (pct >= 5) return 'good'
  if (pct >= 2) return 'ok'
  return 'low'
}

function fmtCurrency(n) {
  return '€' + Number(n || 0).toFixed(2)
}

function barH(n, key) {
  const max = Math.max(...daily.value.map(d => d[key] || 0), 1)
  return Math.max(2, Math.round(((n || 0) / max) * 80))
}
</script>

<style scoped>
.funnel-view { max-width: 1100px; }
.page-header { margin-bottom: 1.5rem; }
.page-header h1 { margin: 0; }
.subtitle { color: var(--text-muted); margin: 0.25rem 0 0; }

.controls { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
.controls label { color: var(--text-muted); font-size: 0.9rem; }
.controls select { background: var(--surface); border: 1px solid rgba(255,255,255,0.1); color: var(--text); padding: 0.4rem 0.75rem; border-radius: 0.5rem; }

/* Funnel strip */
.funnel-strip { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; }
.funnel-stage-wrap { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.funnel-stage {
  background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem;
  padding: 1.25rem 1.5rem; text-align: center; min-width: 130px;
  position: relative;
  border-bottom-width: 3px;
}
.stage-icon { font-size: 1.8rem; }
.stage-count { font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0; }
.stage-label { font-size: 0.78rem; color: var(--text-muted); }
.stage-cr { font-size: 0.72rem; color: var(--accent); margin-top: 0.25rem; }
.funnel-arrow { color: var(--text-muted); font-size: 1.2rem; }

/* Stats grid */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1.25rem 1rem; text-align: center; }
.stat-card.accent { border-color: rgba(239,68,68,0.4); }
.stat-card.green { border-color: rgba(34,197,94,0.3); }
.stat-num { display: block; font-size: 1.6rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: var(--text-muted); }

.glass-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1.5rem; margin-bottom: 1.5rem; }
.glass-card h3 { margin: 0 0 1rem; font-size: 1rem; }

/* Conversion rates */
.cr-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.cr-row { display: flex; align-items: center; gap: 1rem; }
.cr-label { width: 200px; font-size: 0.85rem; flex-shrink: 0; }
.cr-bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
.cr-bar-fill { height: 100%; border-radius: 4px; transition: width .4s; }
.cr-bar-fill.good { background: #22c55e; }
.cr-bar-fill.ok   { background: #f59e0b; }
.cr-bar-fill.low  { background: #ef4444; }
.cr-pct { width: 50px; text-align: right; font-size: 0.85rem; font-weight: 600; }
.cr-pct.good { color: #22c55e; }
.cr-pct.ok   { color: #f59e0b; }
.cr-pct.low  { color: #ef4444; }

/* Chart */
.chart-card { }
.legend { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.leg-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
.leg-dot { width: 10px; height: 10px; border-radius: 50%; }
.line-chart-wrap { overflow-x: auto; }
.line-chart { display: flex; align-items: flex-end; gap: 6px; min-height: 90px; }
.day-col { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; min-width: 28px; }
.day-bars { display: flex; gap: 2px; align-items: flex-end; }
.day-bar { width: 6px; border-radius: 2px 2px 0 0; min-height: 2px; transition: height .3s; }
.day-label { font-size: 0.6rem; color: var(--text-muted); }

/* Products table */
.period-note { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.data-table th { text-align: left; padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.08); }
.data-table th.num, .data-table td.num { text-align: right; }
.data-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
.product-cell { display: flex; align-items: center; gap: 0.5rem; }
.prod-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 0.4rem; flex-shrink: 0; }
.prod-emoji { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.cr-pill { padding: 0.15rem 0.5rem; border-radius: 0.3rem; font-size: 0.75rem; font-weight: 600; }
.cr-pill.good { background: rgba(34,197,94,0.15); color: #22c55e; }
.cr-pill.ok   { background: rgba(245,158,11,0.15); color: #f59e0b; }
.cr-pill.low  { background: rgba(239,68,68,0.15); color: #ef4444; }
.empty { text-align: center; color: var(--text-muted); padding: 2rem !important; }

.pagination { display: flex; align-items: center; gap: 1rem; padding: 1rem 0 0; justify-content: center; }

/* Help */
.help-card { font-size: 0.85rem; }
.help-card p { color: var(--text-muted); margin: 0.5rem 0; }
.help-card ul { color: var(--text-muted); margin: 0.5rem 0; padding-left: 1.25rem; }
.help-card li { margin-bottom: 0.35rem; }
.help-card strong { color: var(--text); }
code { background: rgba(255,255,255,0.07); padding: 0.1rem 0.4rem; border-radius: 0.3rem; font-size: 0.8rem; }

.btn { padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; cursor: pointer; font-size: 0.9rem; transition: all .2s; }
.btn-ghost { background: rgba(255,255,255,0.07); color: var(--text); border: 1px solid rgba(255,255,255,0.1); }
.btn-sm { padding: 0.35rem 0.9rem; font-size: 0.82rem; }

@media (max-width: 700px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .funnel-strip { flex-direction: column; }
  .funnel-arrow { transform: rotate(90deg); }
}
</style>
