<template>
  <div class="reorder-view">
    <div class="page-header">
      <div>
        <h1>📦 Reorder Management</h1>
        <p class="subtitle">Set reorder points and get alerts when stock runs low</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" @click="runCheck" :disabled="checking">
          {{ checking ? '⏳ Checking…' : '🔔 Check Now' }}
        </button>
        <button class="btn btn-primary" @click="bulkSaveAll" :disabled="saving">
          {{ saving ? 'Saving…' : '💾 Save All' }}
        </button>
      </div>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card critical" v-if="stats.critical > 0">
        <div class="stat-value red">{{ stats.critical }}</div>
        <div class="stat-label">🔴 Out of Stock</div>
      </div>
      <div class="stat-card" v-else>
        <div class="stat-value">0</div>
        <div class="stat-label">🔴 Out of Stock</div>
      </div>
      <div class="stat-card warning" v-if="stats.at_reorder > 0">
        <div class="stat-value orange">{{ stats.at_reorder }}</div>
        <div class="stat-label">🟠 At Reorder Point</div>
      </div>
      <div class="stat-card" v-else>
        <div class="stat-value">0</div>
        <div class="stat-label">🟠 At Reorder Point</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.ok }}</div>
        <div class="stat-label">🟢 OK Stock</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.no_reorder }}</div>
        <div class="stat-label">⬛ No Reorder Set</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.tracked }}</div>
        <div class="stat-label">Total Tracked</div>
      </div>
    </div>

    <!-- Check result banner -->
    <div v-if="checkResult" class="check-result glass" :class="{ success: checkResult.alerts.length > 0 }">
      <span v-if="checkResult.alerts.length === 0">✅ All products are above their reorder points.</span>
      <span v-else>🔔 {{ checkResult.alerts.length }} product(s) at reorder point. Alert email sent.</span>
      <button class="close-btn" @click="checkResult = null">✕</button>
    </div>

    <!-- Filters -->
    <div class="filters-bar glass">
      <input v-model="q" @input="debounceLoad" placeholder="Search products…" class="form-input" style="max-width:250px" />
      <select v-model="filterRisk" @change="load" class="form-input" style="width:170px">
        <option value="">All Risk Levels</option>
        <option value="critical">🔴 Out of Stock</option>
        <option value="low">🟠 At Reorder Point</option>
        <option value="ok">🟢 OK Stock</option>
        <option value="no_reorder">⬛ No Reorder Set</option>
      </select>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Products Table -->
    <div class="glass section">
      <div v-if="products.length === 0 && !loading" class="empty-state">
        <p>No stock-tracked products found.</p>
      </div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Current Stock</th>
            <th>Reorder Point</th>
            <th>Reorder Qty</th>
            <th>Supplier</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id" :class="`risk-row-${p.risk_level}`">
            <td>
              <div class="product-name-cell">
                <img v-if="p.cover_image" :src="p.cover_image" class="product-thumb" :alt="p.name" />
                <span class="product-name">{{ p.name }}</span>
              </div>
            </td>
            <td><code class="mono">{{ p.sku || '—' }}</code></td>
            <td>
              <span :class="['stock-pill', { 'stock-zero': p.stock_quantity <= 0, 'stock-low': p.stock_quantity > 0 && p.reorder_point > 0 && p.stock_quantity <= p.reorder_point }]">
                {{ p.stock_quantity }}
              </span>
            </td>
            <td>
              <input
                v-model.number="edits[p.id].reorder_point"
                type="number" min="0"
                class="form-input number-input"
                @change="markDirty(p.id)"
              />
            </td>
            <td>
              <input
                v-model.number="edits[p.id].reorder_qty"
                type="number" min="0"
                class="form-input number-input"
                @change="markDirty(p.id)"
              />
            </td>
            <td>
              <span class="supplier-name">{{ p.supplier_name || '—' }}</span>
            </td>
            <td>
              <span :class="['risk-badge', `risk-${p.risk_level}`]">{{ riskLabel(p.risk_level) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Recent Alerts -->
    <div class="glass section" v-if="alerts.length > 0">
      <h3 class="section-title">Recent Reorder Alerts</h3>
      <table class="table" style="font-size:.8rem">
        <thead>
          <tr><th>Product</th><th>SKU</th><th>Stock at Alert</th><th>Reorder Point</th><th>Notified</th><th>Date</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in alerts.slice(0,10)" :key="a.id">
            <td>{{ a.product_name }}</td>
            <td><code class="mono">{{ a.sku || '—' }}</code></td>
            <td class="red">{{ a.stock_qty }}</td>
            <td>{{ a.reorder_point }}</td>
            <td>{{ a.notified ? '✅ Yes' : '⏳ Pending' }}</td>
            <td>{{ fmt(a.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue'
import { useApi } from '../api.js'

const { get, post } = useApi()

const products = ref([])
const stats = ref(null)
const alerts = ref([])
const loading = ref(false)
const saving = ref(false)
const checking = ref(false)
const checkResult = ref(null)
const q = ref('')
const filterRisk = ref('')
const edits = reactive({})
const dirty = ref(new Set())
let debounce = null

function debounceLoad () {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(), 350)
}

function markDirty (id) {
  dirty.value = new Set([...dirty.value, id])
}

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit: 200 })
    if (q.value) params.set('q', q.value)
    if (filterRisk.value) params.set('risk', filterRisk.value)
    const data = await get(`/api/reorder?${params}`)
    products.value = data.products || []
    stats.value = data.stats

    // Init edits
    for (const p of products.value) {
      if (!edits[p.id]) {
        edits[p.id] = { reorder_point: p.reorder_point || 0, reorder_qty: p.reorder_qty || 0 }
      }
    }
  } finally { loading.value = false }
}

async function loadAlerts () {
  try {
    const data = await get('/api/reorder/alerts')
    alerts.value = data || []
  } catch {}
}

async function bulkSaveAll () {
  if (dirty.value.size === 0) return
  saving.value = true
  try {
    const updates = Array.from(dirty.value)
      .filter(id => edits[id])
      .map(id => ({ product_id: id, ...edits[id] }))
    await post('/api/reorder/bulk-set', { updates })
    dirty.value = new Set()
    await load()
  } finally { saving.value = false }
}

async function runCheck () {
  checking.value = true
  try {
    const result = await post('/api/reorder/check', {})
    checkResult.value = result
    await load()
    await loadAlerts()
  } finally { checking.value = false }
}

function riskLabel (r) {
  const map = { critical: '🔴 Critical', low: '🟠 Reorder', ok: '🟢 OK', no_reorder: '⬛ No Point' }
  return map[r] || r
}

function fmt (d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => { load(); loadAlerts() })
</script>

<style scoped>
.reorder-view { max-width: 1100px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.6rem; font-weight: 700; }
.subtitle { color: rgba(255,255,255,.5); font-size: .9rem; margin-top: .2rem; }
.header-actions { display: flex; gap: .75rem; }
.stats-strip { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { background: rgba(255,255,255,.05); border-radius: 1rem; padding: .8rem 1.2rem; min-width: 100px; text-align: center; }
.stat-card.critical { background: rgba(244,67,54,.1); border: 1px solid rgba(244,67,54,.3); }
.stat-card.warning { background: rgba(255,152,0,.1); border: 1px solid rgba(255,152,0,.3); }
.stat-value { font-size: 1.5rem; font-weight: 700; }
.stat-value.red { color: #f44336; }
.stat-value.orange { color: #ff9800; }
.stat-label { font-size: .75rem; color: rgba(255,255,255,.5); margin-top: .2rem; }
.glass { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; }
.section { padding: 1.5rem; margin-bottom: 1.5rem; overflow-x: auto; }
.section-title { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; }
.filters-bar { padding: .75rem 1rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.loading-bar { height: 3px; background: var(--accent); border-radius: 2px; animation: loading 1s infinite; margin-bottom: 1rem; }
@keyframes loading { 0%,100%{opacity:.3} 50%{opacity:1} }
.check-result { padding: .8rem 1.2rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; font-size: .875rem; }
.check-result.success { border-color: rgba(76,175,80,.4); }
.close-btn { background: none; border: none; color: rgba(255,255,255,.5); cursor: pointer; font-size: 1.1rem; }
.table { width: 100%; border-collapse: collapse; font-size: .875rem; }
.table th { text-align: left; padding: .75rem; color: rgba(255,255,255,.5); font-weight: 600; border-bottom: 1px solid rgba(255,255,255,.1); white-space: nowrap; }
.table td { padding: .75rem; border-bottom: 1px solid rgba(255,255,255,.06); vertical-align: middle; }
.product-name-cell { display: flex; align-items: center; gap: .5rem; }
.product-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: .4rem; }
.product-name { font-size: .85rem; font-weight: 600; }
.mono { font-family: monospace; font-size: .8rem; background: rgba(255,255,255,.08); padding: .1rem .35rem; border-radius: .25rem; }
.stock-pill { display: inline-block; padding: .2rem .6rem; border-radius: .4rem; font-weight: 700; font-size: .85rem; background: rgba(76,175,80,.2); color: #4caf50; }
.stock-pill.stock-zero { background: rgba(244,67,54,.2); color: #f44336; }
.stock-pill.stock-low { background: rgba(255,152,0,.2); color: #ff9800; }
.number-input { width: 80px; text-align: center; padding: .4rem .5rem; }
.supplier-name { font-size: .8rem; color: rgba(255,255,255,.6); }
.risk-badge { border-radius: .4rem; padding: .2rem .5rem; font-size: .75rem; font-weight: 600; }
.risk-critical { background: rgba(244,67,54,.2); color: #f44336; }
.risk-low { background: rgba(255,152,0,.2); color: #ff9800; }
.risk-ok { background: rgba(76,175,80,.2); color: #4caf50; }
.risk-no_reorder { background: rgba(158,158,158,.2); color: #9e9e9e; }
.risk-row-critical td { background: rgba(244,67,54,.04); }
.risk-row-low td { background: rgba(255,152,0,.04); }
.empty-state { text-align: center; padding: 2rem; color: rgba(255,255,255,.4); }
.form-input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; padding: .6rem .9rem; color: #fff; font-size: .9rem; }
.btn { padding: .6rem 1.4rem; border-radius: .8rem; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; }
.btn-primary { background: var(--accent, hsl(355,70%,58%)); color: #fff; }
.btn-ghost { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }
.red { color: #f44336; }
</style>
