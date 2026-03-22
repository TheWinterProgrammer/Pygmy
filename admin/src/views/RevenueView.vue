<template>
  <div class="revenue-view">
    <div class="view-header">
      <h1>💰 Revenue Reports</h1>
      <div class="header-controls">
        <select v-model="days" @change="load" class="glass-select">
          <option :value="7">Last 7 days</option>
          <option :value="30">Last 30 days</option>
          <option :value="60">Last 60 days</option>
          <option :value="90">Last 90 days</option>
          <option :value="365">Last 12 months</option>
        </select>
        <button class="btn" @click="exportCsv">⬇️ Export CSV</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading revenue data…</div>
    <template v-else-if="data">

      <!-- Summary cards -->
      <div class="stats-grid">
        <div class="stat-card glass accent-card">
          <div class="stat-icon">💵</div>
          <div class="stat-body">
            <div class="stat-value accent">{{ fmt(data.summary.total_revenue) }}</div>
            <div class="stat-label">Total Revenue</div>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon">📦</div>
          <div class="stat-body">
            <div class="stat-value">{{ data.summary.total_orders }}</div>
            <div class="stat-label">Orders</div>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon">🛒</div>
          <div class="stat-body">
            <div class="stat-value">{{ fmt(data.summary.avg_order_value) }}</div>
            <div class="stat-label">Avg Order Value</div>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon">📅</div>
          <div class="stat-body">
            <div class="stat-value">{{ fmt(data.summary.today_revenue) }}</div>
            <div class="stat-label">Today</div>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon">📆</div>
          <div class="stat-body">
            <div class="stat-value">{{ fmt(data.summary.week_revenue) }}</div>
            <div class="stat-label">Last 7 days</div>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon">🗓️</div>
          <div class="stat-body">
            <div class="stat-value">{{ fmt(data.summary.month_revenue) }}</div>
            <div class="stat-label">Last 30 days</div>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon">🚚</div>
          <div class="stat-body">
            <div class="stat-value">{{ fmt(data.summary.shipping_revenue) }}</div>
            <div class="stat-label">Shipping Collected</div>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon">🧾</div>
          <div class="stat-body">
            <div class="stat-value">{{ fmt(data.summary.tax_collected) }}</div>
            <div class="stat-label">Tax Collected</div>
          </div>
        </div>
        <div class="stat-card glass warn-card" v-if="data.summary.refunded_revenue > 0">
          <div class="stat-icon">↩️</div>
          <div class="stat-body">
            <div class="stat-value warn">{{ fmt(data.summary.refunded_revenue) }}</div>
            <div class="stat-label">Refunded</div>
          </div>
        </div>
      </div>

      <!-- Revenue chart -->
      <div class="glass chart-section" v-if="data.timeSeries?.length">
        <h2>Revenue over time <span class="muted">({{ days }}d)</span></h2>
        <div class="bar-chart">
          <div
            v-for="d in data.timeSeries"
            :key="d.date"
            class="bar-wrap"
            :title="`${d.date}: ${fmtEur(d.revenue)} (${d.orders} orders)`"
          >
            <div class="bar revenue-bar" :style="{ height: barH(d.revenue, maxRevenue) + '%' }"></div>
            <div class="bar-label" v-if="data.timeSeries.length <= 14 || d.date.endsWith('-01') || d.date === data.timeSeries[data.timeSeries.length-1].date">
              {{ d.date.slice(5) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Two-column lower -->
      <div class="lower-grid">

        <!-- Top products -->
        <div class="glass panel">
          <h2>🏆 Top Products</h2>
          <table v-if="data.topProducts?.length">
            <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>
              <tr v-for="(p, i) in data.topProducts" :key="i">
                <td class="product-name">{{ p.product_name }}</td>
                <td>{{ p.units }}</td>
                <td class="accent">{{ fmtEur(p.revenue) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty-msg">No product data yet.</p>
        </div>

        <!-- Status breakdown -->
        <div class="glass panel">
          <h2>📊 Orders by Status</h2>
          <div v-if="data.byStatus?.length" class="status-breakdown">
            <div v-for="s in data.byStatus" :key="s.status" class="status-row">
              <div class="status-info">
                <span class="badge" :class="statusClass(s.status)">{{ s.status }}</span>
                <span class="status-count">{{ s.count }} orders</span>
              </div>
              <div class="status-revenue">{{ fmtEur(s.revenue) }}</div>
            </div>
          </div>
          <p v-else class="empty-msg">No order data.</p>
        </div>

        <!-- Coupon usage -->
        <div class="glass panel" v-if="data.couponUsage?.length">
          <h2>🏷️ Coupon Usage</h2>
          <table>
            <thead><tr><th>Code</th><th>Uses</th><th>Discount</th></tr></thead>
            <tbody>
              <tr v-for="c in data.couponUsage" :key="c.coupon_code">
                <td><code>{{ c.coupon_code }}</code></td>
                <td>{{ c.uses }}</td>
                <td class="warn">–{{ fmtEur(c.total_discount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MRR card if subscriptions exist -->
        <div class="glass panel" v-if="subStats?.active > 0">
          <h2>💳 Subscription MRR</h2>
          <div class="mrr-block">
            <div class="mrr-value accent">{{ fmtEur(subStats.mrr) }}</div>
            <div class="mrr-label">Monthly Recurring Revenue</div>
          </div>
          <div class="sub-stats">
            <div class="sub-stat">
              <span class="badge badge-published">{{ subStats.active }} active</span>
            </div>
            <div class="sub-stat" v-if="subStats.trialing">
              <span class="badge badge-info">{{ subStats.trialing }} trialing</span>
            </div>
            <div class="sub-stat" v-if="subStats.cancelled">
              <span class="badge badge-draft">{{ subStats.cancelled }} cancelled</span>
            </div>
          </div>
          <div class="mrr-arr">
            <span class="muted">ARR estimate: </span>
            <strong>{{ fmtEur(subStats.mrr * 12) }}</strong>
          </div>
        </div>

      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = 'http://localhost:3200/api'

const days = ref(30)
const loading = ref(true)
const data = ref(null)
const subStats = ref(null)

const maxRevenue = ref(1)

function fmt(val) {
  return `€${(val || 0).toFixed(2)}`
}
function fmtEur(val) { return `€${(val || 0).toFixed(2)}` }

function barH(val, max) {
  if (!max) return 0
  return Math.max(4, Math.round((val / max) * 100))
}

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  return res.json()
}

async function load() {
  loading.value = true
  const [rev, subs] = await Promise.all([
    apiFetch(`/subscriptions/revenue?days=${days.value}`),
    apiFetch('/subscriptions/stats')
  ])
  data.value = rev
  subStats.value = subs
  maxRevenue.value = Math.max(1, ...((rev.timeSeries || []).map(d => d.revenue)))
  loading.value = false
}

function statusClass(status) {
  const map = {
    pending: 'badge-draft', processing: 'badge-info', completed: 'badge-published',
    shipped: 'badge-info', cancelled: 'badge-draft', refunded: 'badge-warning'
  }
  return map[status] || 'badge-draft'
}

async function exportCsv() {
  const res = await fetch(`${API}/subscriptions/revenue/export?days=${days.value}`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `revenue-${days.value}d.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(load)
</script>

<style scoped>
.view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: .75rem; }
.header-controls { display: flex; gap: .75rem; }
.loading { padding: 2rem; text-align: center; color: var(--muted); }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat-card { display: flex; gap: 1rem; align-items: center; padding: 1.25rem; border-radius: 1rem; }
.stat-icon { font-size: 1.5rem; }
.stat-value { font-size: 1.3rem; font-weight: 700; }
.stat-value.accent { color: var(--accent); }
.stat-value.warn { color: #fbbf24; }
.stat-label { font-size: .78rem; color: var(--muted); margin-top: .15rem; }
.accent-card { border-color: var(--accent) !important; }
.warn-card { border-color: #fbbf24 !important; }
.chart-section { padding: 1.5rem; border-radius: 1.25rem; margin-bottom: 2rem; }
.chart-section h2 { margin: 0 0 1rem; font-size: 1rem; }
.bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 160px; overflow-x: auto; }
.bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 18px; flex: 1; }
.bar { width: 100%; border-radius: 4px 4px 0 0; min-height: 4px; background: var(--accent); opacity: .8; transition: height .3s; }
.bar-label { font-size: .6rem; color: var(--muted); white-space: nowrap; }
.lower-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
.panel { padding: 1.5rem; border-radius: 1.25rem; }
.panel h2 { margin: 0 0 1rem; font-size: 1rem; }
table { width: 100%; border-collapse: collapse; font-size: .88rem; }
thead th { padding: .5rem .75rem; text-align: left; color: var(--muted); font-weight: 500; border-bottom: 1px solid rgba(255,255,255,.08); }
tbody td { padding: .5rem .75rem; border-bottom: 1px solid rgba(255,255,255,.04); }
.product-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.accent { color: var(--accent); font-weight: 600; }
.warn { color: #fbbf24; }
.empty-msg { color: var(--muted); font-size: .88rem; }
.status-breakdown { display: flex; flex-direction: column; gap: .75rem; }
.status-row { display: flex; justify-content: space-between; align-items: center; }
.status-info { display: flex; align-items: center; gap: .5rem; }
.status-count { font-size: .82rem; color: var(--muted); }
.status-revenue { font-weight: 600; }
.badge-info { background: rgba(59,130,246,.25); color: #93c5fd; }
.badge-warning { background: rgba(251,191,36,.25); color: #fde68a; }
.mrr-block { text-align: center; padding: 1rem 0; }
.mrr-value { font-size: 2rem; font-weight: 700; }
.mrr-label { color: var(--muted); font-size: .85rem; }
.sub-stats { display: flex; gap: .5rem; flex-wrap: wrap; justify-content: center; margin-top: .75rem; }
.mrr-arr { text-align: center; margin-top: .75rem; font-size: .88rem; color: var(--muted); }
.muted { color: var(--muted); }
</style>
