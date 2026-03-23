<template>
  <div class="ltv-view">
    <div class="page-header">
      <div>
        <h1>📊 Customer LTV Analytics</h1>
        <p class="subtitle">Lifetime value, cohort analysis, and revenue forecasting</p>
      </div>
      <button class="btn-accent" @click="refreshLtv" :disabled="refreshing">
        {{ refreshing ? '⏳ Refreshing…' : '🔄 Refresh LTV' }}
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="summary-cards" v-if="summary">
      <div class="sum-card">
        <div class="sum-icon">👥</div>
        <div class="sum-value">{{ summary.total_customers }}</div>
        <div class="sum-label">Customers with data</div>
      </div>
      <div class="sum-card accent">
        <div class="sum-icon">💰</div>
        <div class="sum-value">€{{ fmt(summary.avg_ltv) }}</div>
        <div class="sum-label">Avg LTV</div>
      </div>
      <div class="sum-card">
        <div class="sum-icon">🛒</div>
        <div class="sum-value">€{{ fmt(summary.avg_order_value) }}</div>
        <div class="sum-label">Avg Order Value</div>
      </div>
      <div class="sum-card">
        <div class="sum-icon">📅</div>
        <div class="sum-value">{{ fmt(summary.avg_order_frequency, 2) }}/mo</div>
        <div class="sum-label">Avg Order Frequency</div>
      </div>
      <div class="sum-card green">
        <div class="sum-icon">🔮</div>
        <div class="sum-value">€{{ fmt(summary.avg_predicted_ltv) }}</div>
        <div class="sum-label">Avg Predicted LTV (12m)</div>
      </div>
      <div class="sum-card">
        <div class="sum-icon">📈</div>
        <div class="sum-value">€{{ fmtK(summary.total_predicted_revenue_12m) }}</div>
        <div class="sum-label">Total Predicted Revenue (12m)</div>
      </div>
    </div>

    <!-- Tier breakdown -->
    <div class="tier-section" v-if="summary?.tiers?.length">
      <h2>Customer Tiers</h2>
      <div class="tier-cards">
        <div v-for="tier in summary.tiers" :key="tier.ltv_tier" class="tier-card" :class="tier.ltv_tier">
          <div class="tier-badge">{{ tierEmoji(tier.ltv_tier) }}</div>
          <div class="tier-name">{{ capitalize(tier.ltv_tier) }}</div>
          <div class="tier-count">{{ tier.count }} customers</div>
          <div class="tier-stats">
            <div class="ts">Avg Spent <strong>€{{ fmt(tier.avg_spent) }}</strong></div>
            <div class="ts">Predicted <strong>€{{ fmt(tier.avg_predicted) }}</strong></div>
          </div>
          <button class="tier-filter-btn" @click="filterByTier(tier.ltv_tier)">View →</button>
        </div>
      </div>
    </div>

    <!-- Monthly Revenue Chart -->
    <div class="chart-section" v-if="summary?.monthly_revenue?.length">
      <h2>Monthly Revenue (Last 12 Months)</h2>
      <div class="bar-chart">
        <div v-for="month in summary.monthly_revenue" :key="month.month" class="bar-col">
          <div class="bar-value">€{{ fmtK(month.revenue) }}</div>
          <div class="bar-fill" :style="{ height: barHeight(month.revenue, maxRevenue) + 'px' }"></div>
          <div class="bar-label">{{ month.month.substring(5) }}</div>
          <div class="bar-orders">{{ month.orders }} orders</div>
        </div>
      </div>
    </div>

    <!-- Cohort Analysis -->
    <div class="cohort-section" v-if="summary?.cohorts?.length">
      <h2>Customer Cohorts (by Join Month)</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Customers</th>
              <th>Total Orders</th>
              <th>Total Revenue</th>
              <th>Avg per Customer</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in summary.cohorts" :key="c.cohort_month">
              <td>{{ c.cohort_month }}</td>
              <td>{{ c.customers }}</td>
              <td>{{ c.total_orders }}</td>
              <td>€{{ fmt(c.total_revenue) }}</td>
              <td>€{{ fmt(c.customers > 0 ? c.total_revenue / c.customers : 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Top Customers -->
    <div class="top-customers-section" v-if="summary?.top_customers?.length">
      <h2>🏆 Top VIP Customers</h2>
      <div class="top-grid">
        <div v-for="(c, i) in summary.top_customers" :key="c.customer_id" class="vip-card" @click="openCustomer(c.customer_id)">
          <div class="vip-rank">#{{ i + 1 }}</div>
          <div class="vip-info">
            <div class="vip-name">{{ c.first_name }} {{ c.last_name }}</div>
            <div class="vip-email muted">{{ c.email }}</div>
          </div>
          <div class="vip-stats">
            <div class="vip-stat">€{{ fmt(c.total_spent) }} spent</div>
            <div class="vip-stat">{{ c.total_orders }} orders</div>
            <div class="vip-tier"><span class="tier-pill" :class="c.ltv_tier">{{ tierEmoji(c.ltv_tier) }} {{ capitalize(c.ltv_tier) }}</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Customer table with filter -->
    <div class="customer-table-section">
      <div class="table-header">
        <h2>All Customers</h2>
        <div class="table-controls">
          <input v-model="q" @input="debounceLoad" placeholder="Search customers…" class="search-input" />
          <select v-model="filterTier" @change="loadCustomers">
            <option value="">All Tiers</option>
            <option value="new">New</option>
            <option value="occasional">Occasional</option>
            <option value="regular">Regular</option>
            <option value="loyal">Loyal</option>
            <option value="vip">VIP</option>
          </select>
          <select v-model="sortBy" @change="loadCustomers">
            <option value="total_spent">Total Spent</option>
            <option value="predicted_ltv">Predicted LTV</option>
            <option value="total_orders">Total Orders</option>
            <option value="avg_order_value">Avg Order Value</option>
            <option value="order_frequency">Order Frequency</option>
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Tier</th>
              <th>Total Spent</th>
              <th>Orders</th>
              <th>Avg Order</th>
              <th>Frequency</th>
              <th>Days Active</th>
              <th>Predicted LTV</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingCustomers"><td colspan="9" class="empty-row">Loading…</td></tr>
            <tr v-else-if="!customers.length"><td colspan="9" class="empty-row">No data yet. Click "Refresh LTV" to compute.</td></tr>
            <tr v-for="c in customers" :key="c.customer_id">
              <td>
                <div class="customer-name">{{ c.first_name }} {{ c.last_name }}</div>
                <div class="muted small">{{ c.email }}</div>
              </td>
              <td><span class="tier-pill" :class="c.ltv_tier">{{ tierEmoji(c.ltv_tier) }} {{ capitalize(c.ltv_tier) }}</span></td>
              <td class="money">€{{ fmt(c.total_spent) }}</td>
              <td>{{ c.total_orders }}</td>
              <td class="money">€{{ fmt(c.avg_order_value) }}</td>
              <td>{{ fmt(c.order_frequency, 2) }}/mo</td>
              <td>{{ c.days_as_customer }}d</td>
              <td class="money predicted">€{{ fmt(c.predicted_ltv) }}</td>
              <td>
                <button class="btn-sm" @click="openCustomer(c.customer_id)" title="LTV Detail">📊</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Customer Detail Modal -->
    <div v-if="customerDetail" class="modal-overlay" @click.self="customerDetail = null">
      <div class="modal-panel large">
        <div class="modal-header">
          <h2>{{ customerDetail.first_name }} {{ customerDetail.last_name }} — LTV Detail</h2>
          <button class="close-btn" @click="customerDetail = null">✕</button>
        </div>
        <div class="modal-body">
          <!-- Tier pill -->
          <div class="detail-tier">
            <span class="tier-pill large" :class="customerDetail.ltv_tier">
              {{ tierEmoji(customerDetail.ltv_tier) }} {{ capitalize(customerDetail.ltv_tier) }} Customer
            </span>
            <span class="muted">Since {{ customerDetail.customer_since?.substring(0,10) }}</span>
          </div>

          <!-- Stats grid -->
          <div class="detail-stats">
            <div class="ds">
              <div class="ds-value">€{{ fmt(customerDetail.total_spent) }}</div>
              <div class="ds-label">Total Spent</div>
            </div>
            <div class="ds">
              <div class="ds-value">{{ customerDetail.total_orders }}</div>
              <div class="ds-label">Total Orders</div>
            </div>
            <div class="ds">
              <div class="ds-value">€{{ fmt(customerDetail.avg_order_value) }}</div>
              <div class="ds-label">Avg Order Value</div>
            </div>
            <div class="ds accent">
              <div class="ds-value">€{{ fmt(customerDetail.predicted_ltv) }}</div>
              <div class="ds-label">Predicted LTV (12m)</div>
            </div>
            <div class="ds">
              <div class="ds-value">{{ fmt(customerDetail.order_frequency, 2) }}</div>
              <div class="ds-label">Orders/Month</div>
            </div>
            <div class="ds">
              <div class="ds-value">{{ customerDetail.days_as_customer }}</div>
              <div class="ds-label">Days as Customer</div>
            </div>
          </div>

          <!-- Monthly spend chart -->
          <div v-if="customerDetail.monthly_spend?.length" class="section-title">Monthly Spending</div>
          <div class="bar-chart small-chart" v-if="customerDetail.monthly_spend?.length">
            <div v-for="m in customerDetail.monthly_spend" :key="m.month" class="bar-col">
              <div class="bar-value">€{{ fmtK(m.spent) }}</div>
              <div class="bar-fill" :style="{ height: barHeight(m.spent, maxCustomerSpend) + 'px' }"></div>
              <div class="bar-label">{{ m.month.substring(5) }}</div>
            </div>
          </div>

          <!-- Top products -->
          <div v-if="customerDetail.top_products?.length" class="section-title">Top Purchased Products</div>
          <div class="top-products" v-if="customerDetail.top_products?.length">
            <div v-for="p in customerDetail.top_products" :key="p.slug" class="tp-row">
              <img v-if="p.cover_image" :src="p.cover_image" class="tp-img" />
              <div class="tp-info">
                <div class="tp-name">{{ p.name }}</div>
                <div class="muted small">{{ p.qty }} units · €{{ fmt(p.spent) }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="customerDetail = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const summary = ref(null)
const customers = ref([])
const loadingCustomers = ref(false)
const customerDetail = ref(null)
const refreshing = ref(false)
const q = ref('')
const filterTier = ref('')
const sortBy = ref('total_spent')
let debounceTimer = null
const API = '/api'

function fmt (v, dec = 2) { return (v || 0).toFixed(dec) }
function fmtK (v) { if (v >= 1000) return (v / 1000).toFixed(1) + 'k'; return (v || 0).toFixed(0) }
function capitalize (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function tierEmoji (t) { return { new: '🌱', occasional: '☀️', regular: '⭐', loyal: '💫', vip: '👑' }[t] || '🌱' }

const maxRevenue = computed(() => Math.max(1, ...(summary.value?.monthly_revenue?.map(m => m.revenue) || [0])))
const maxCustomerSpend = computed(() => Math.max(1, ...(customerDetail.value?.monthly_spend?.map(m => m.spent) || [0])))

function barHeight (v, max) { return Math.max(4, (v / max) * 120) }

function filterByTier (tier) { filterTier.value = tier; loadCustomers() }
function debounceLoad () { clearTimeout(debounceTimer); debounceTimer = setTimeout(loadCustomers, 300) }

async function loadSummary () {
  const res = await fetch(`${API}/customer-ltv/summary`, { headers: { Authorization: `Bearer ${auth.token}` } })
  summary.value = await res.json()
}

async function loadCustomers () {
  loadingCustomers.value = true
  const params = new URLSearchParams({ sort: sortBy.value, limit: 50, offset: 0 })
  if (filterTier.value) params.set('tier', filterTier.value)
  if (q.value) params.set('q', q.value)
  const res = await fetch(`${API}/customer-ltv?${params}`, { headers: { Authorization: `Bearer ${auth.token}` } })
  const data = await res.json()
  customers.value = data.rows || []
  loadingCustomers.value = false
}

async function openCustomer (id) {
  const res = await fetch(`${API}/customer-ltv/${id}`, { headers: { Authorization: `Bearer ${auth.token}` } })
  customerDetail.value = await res.json()
}

async function refreshLtv () {
  refreshing.value = true
  await fetch(`${API}/customer-ltv/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${auth.token}` } })
  await loadSummary()
  await loadCustomers()
  refreshing.value = false
}

onMounted(() => { loadSummary(); loadCustomers() })
</script>

<style scoped>
.ltv-view { padding: 2rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
.page-header h1 { margin: 0; font-size: 1.5rem; }
.subtitle { margin: 0.25rem 0 0; color: rgba(255,255,255,0.5); font-size: 0.85rem; }
.btn-accent { background: var(--accent,#e03c3c); color: #fff; border: none; border-radius: 0.5rem; padding: 0.5rem 1.25rem; cursor: pointer; font-weight: 600; white-space: nowrap; }
.btn-accent:disabled { opacity: 0.6; cursor: not-allowed; }

.summary-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.sum-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
.sum-card.accent { border-color: rgba(var(--accent-rgb,220,60,60),0.4); }
.sum-card.green { border-color: rgba(80,200,120,0.3); }
.sum-icon { font-size: 1.5rem; }
.sum-value { font-size: 1.6rem; font-weight: 700; }
.sum-label { font-size: 0.72rem; color: rgba(255,255,255,0.5); }

.tier-section, .chart-section, .cohort-section, .top-customers-section, .customer-table-section { margin-bottom: 2rem; }
h2 { font-size: 1rem; font-weight: 600; margin: 0 0 1rem; }

.tier-cards { display: flex; gap: 1rem; flex-wrap: wrap; }
.tier-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1.25rem; min-width: 150px; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; cursor: pointer; transition: border-color 0.2s; }
.tier-card:hover { border-color: rgba(255,255,255,0.2); }
.tier-card.vip { border-color: rgba(255,215,0,0.3); }
.tier-card.loyal { border-color: rgba(100,150,255,0.3); }
.tier-card.regular { border-color: rgba(80,200,120,0.3); }
.tier-badge { font-size: 1.5rem; }
.tier-name { font-weight: 700; font-size: 0.9rem; }
.tier-count { font-size: 0.75rem; color: rgba(255,255,255,0.5); }
.tier-stats .ts { font-size: 0.75rem; color: rgba(255,255,255,0.6); }
.tier-filter-btn { background: none; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 0.75rem; padding: 0.25rem 0.5rem; margin-top: 0.5rem; align-self: flex-start; }

.bar-chart { display: flex; align-items: flex-end; gap: 0.5rem; height: 160px; padding: 0.5rem 0; overflow-x: auto; }
.small-chart { height: 120px; }
.bar-col { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; min-width: 44px; }
.bar-value { font-size: 0.6rem; color: rgba(255,255,255,0.5); writing-mode: vertical-lr; transform: rotate(180deg); }
.bar-fill { width: 28px; background: var(--accent,#e03c3c); border-radius: 0.25rem 0.25rem 0 0; transition: height 0.3s; }
.bar-label { font-size: 0.65rem; color: rgba(255,255,255,0.5); }
.bar-orders { font-size: 0.6rem; color: rgba(255,255,255,0.3); }

.table-wrap { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; overflow: auto; }
table { width: 100%; border-collapse: collapse; }
th { padding: 0.75rem 1rem; text-align: left; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.08); }
td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.83rem; }
.empty-row { text-align: center; color: rgba(255,255,255,0.4); padding: 2rem !important; }
.muted { color: rgba(255,255,255,0.4); }
.small { font-size: 0.75rem; }
.money { font-variant-numeric: tabular-nums; }
.predicted { color: #a8d8a8; font-weight: 600; }

.tier-pill { font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 0.5rem; background: rgba(255,255,255,0.1); display: inline-block; }
.tier-pill.large { font-size: 0.9rem; padding: 0.3rem 0.9rem; }
.tier-pill.vip { background: rgba(255,215,0,0.2); color: #ffd700; }
.tier-pill.loyal { background: rgba(100,150,255,0.2); color: #6496ff; }
.tier-pill.regular { background: rgba(80,200,120,0.2); color: #50c878; }
.tier-pill.occasional { background: rgba(255,180,60,0.2); color: #ffb43c; }
.tier-pill.new { background: rgba(200,200,200,0.1); color: rgba(255,255,255,0.6); }

.table-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
.table-controls { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.search-input, select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 0.75rem; color: #fff; font-family: inherit; }

.top-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }
.vip-card { display: flex; align-items: center; gap: 1rem; background: rgba(255,215,0,0.05); border: 1px solid rgba(255,215,0,0.15); border-radius: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; transition: background 0.15s; }
.vip-card:hover { background: rgba(255,215,0,0.1); }
.vip-rank { font-size: 1.2rem; font-weight: 700; color: rgba(255,215,0,0.8); min-width: 36px; }
.vip-info { flex: 1; min-width: 0; }
.vip-name { font-weight: 600; }
.vip-email { font-size: 0.75rem; }
.vip-stats { text-align: right; }
.vip-stat { font-size: 0.78rem; color: rgba(255,255,255,0.7); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-panel { background: hsl(228,4%,12%); border: 1px solid rgba(255,255,255,0.12); border-radius: 1.5rem; width: 90%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; }
.modal-panel.large { max-width: 750px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.close-btn { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1.2rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; }
.btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 1.25rem; color: #fff; cursor: pointer; }

.detail-tier { display: flex; align-items: center; gap: 1rem; }
.detail-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; }
.ds { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 0.75rem; }
.ds.accent { border-color: rgba(var(--accent-rgb,220,60,60),0.3); }
.ds-value { font-size: 1.3rem; font-weight: 700; }
.ds-label { font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem; }
.section-title { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.5); }
.top-products { display: flex; flex-direction: column; gap: 0.5rem; }
.tp-row { display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.04); border-radius: 0.5rem; padding: 0.5rem; }
.tp-img { width: 40px; height: 40px; object-fit: cover; border-radius: 0.4rem; }
.tp-name { font-size: 0.85rem; font-weight: 600; }
.btn-sm { background: rgba(255,255,255,0.08); border: none; border-radius: 0.4rem; padding: 0.25rem 0.5rem; cursor: pointer; color: #fff; }
</style>
