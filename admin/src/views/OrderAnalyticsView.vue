<template>
  <div class="order-analytics-view">
    <div class="page-header">
      <div>
        <h1>📈 Order Analytics</h1>
        <p class="subtitle">Revenue trends, order patterns, and top-selling products</p>
      </div>
      <div class="header-actions">
        <select v-model="days" @change="load" class="form-input" style="width:140px;">
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 365 days</option>
        </select>
        <select v-model="granularity" @change="load" class="form-input" style="width:120px;">
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </div>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Summary Cards -->
    <div class="stats-strip" v-if="data">
      <div class="stat-card">
        <div class="stat-value">{{ fmt(data.summary.total_revenue) }}</div>
        <div class="stat-label">Total Revenue</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ data.summary.total_orders }}</div>
        <div class="stat-label">Total Orders</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmt(data.summary.avg_order_value) }}</div>
        <div class="stat-label">Avg Order Value</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ data.summary.unique_customers }}</div>
        <div class="stat-label">Unique Customers</div>
      </div>
      <div class="stat-card" v-if="data.summary.refunded_revenue > 0">
        <div class="stat-value red">{{ fmt(data.summary.refunded_revenue) }}</div>
        <div class="stat-label">Refunded</div>
      </div>
    </div>

    <!-- Revenue Chart -->
    <div class="glass chart-card" v-if="data?.daily_revenue?.length">
      <div class="chart-header">
        <h3>💰 Revenue Over Time</h3>
        <div class="chart-legend">
          <span class="legend-dot accent"></span> Revenue &nbsp;
          <span class="legend-dot blue"></span> Orders
        </div>
      </div>
      <div class="bar-chart" ref="chartEl">
        <div
          v-for="(d, i) in chartData"
          :key="i"
          class="bar-col"
          :title="`${d.period}\nRevenue: ${fmt(d.revenue)}\nOrders: ${d.order_count}`"
        >
          <div class="bar-pair">
            <div
              class="bar revenue-bar"
              :style="{ height: `${(d.revenue / maxRevenue) * 100}%` }"
            ></div>
            <div
              class="bar orders-bar"
              :style="{ height: `${(d.order_count / maxOrders) * 100}%` }"
            ></div>
          </div>
          <div class="bar-label">{{ shortLabel(d.period) }}</div>
        </div>
      </div>
    </div>

    <div class="two-col">
      <!-- Status Breakdown -->
      <div class="glass breakdown-card" v-if="data?.status_breakdown?.length">
        <h3 class="card-title">📦 Status Breakdown</h3>
        <div v-for="s in data.status_breakdown" :key="s.status" class="status-row">
          <div class="status-info">
            <span class="status-dot" :class="statusColor(s.status)"></span>
            <span class="status-name">{{ s.status }}</span>
          </div>
          <div class="status-right">
            <span class="status-count">{{ s.count }}</span>
            <span class="status-rev text-muted">{{ fmt(s.revenue) }}</span>
          </div>
          <div class="status-bar-wrap">
            <div
              class="status-bar-fill"
              :class="statusColor(s.status)"
              :style="{ width: `${(s.count / data.summary.total_orders) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Day of week heatmap -->
      <div class="glass dow-card" v-if="data?.dow_distribution?.length">
        <h3 class="card-title">📅 Orders by Day of Week</h3>
        <div class="dow-grid">
          <div v-for="d in dowData" :key="d.dow" class="dow-col">
            <div
              class="dow-bar"
              :style="{ height: `${(d.count / maxDow) * 100}%`, opacity: d.count > 0 ? 0.4 + (d.count / maxDow) * 0.6 : 0.15 }"
            ></div>
            <div class="dow-label">{{ d.label }}</div>
            <div class="dow-count">{{ d.count }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hourly heatmap -->
    <div class="glass hourly-card" v-if="data?.hourly_distribution?.length">
      <h3 class="card-title">🕐 Orders by Hour of Day</h3>
      <div class="hourly-grid">
        <div
          v-for="h in hourlyData"
          :key="h.hour"
          class="hour-cell"
          :title="`${h.hour}:00 — ${h.count} orders`"
          :style="{
            background: h.count > 0 ? `rgba(192,67,78,${0.15 + (h.count / maxHourly) * 0.75})` : 'rgba(255,255,255,.03)'
          }"
        >
          <div class="hour-label">{{ h.hour }}h</div>
          <div class="hour-count">{{ h.count }}</div>
        </div>
      </div>
    </div>

    <!-- Top Products -->
    <div class="glass top-products-card" v-if="data?.top_products?.length">
      <h3 class="card-title">🏆 Top Products by Revenue</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Revenue</th>
            <th>Units Sold</th>
            <th>Orders</th>
            <th>Avg Price</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in data.top_products" :key="p.product_id">
            <td>
              <span class="rank-badge" :class="i < 3 ? `rank-${i+1}` : ''">{{ i + 1 }}</span>
            </td>
            <td class="product-name-cell">{{ p.name || `Product #${p.product_id}` }}</td>
            <td><strong>{{ fmt(p.revenue) }}</strong></td>
            <td>{{ p.units_sold }}</td>
            <td>{{ p.order_count }}</td>
            <td class="text-muted">{{ p.units_sold > 0 ? fmt(p.revenue / p.units_sold) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const days = ref('30')
const granularity = ref('day')
const loading = ref(false)
const data = ref(null)

const currency = ref('€')

async function load() {
  loading.value = true
  try {
    const [ana, settings] = await Promise.all([
      api.get('/orders/analytics', { params: { days: days.value, granularity: granularity.value } }),
      api.get('/settings')
    ])
    data.value = ana.data
    currency.value = settings.data.shop_currency_symbol || '€'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function fmt(val) {
  return `${currency.value}${Number(val || 0).toFixed(2)}`
}

// Fill missing days in chart data
const chartData = computed(() => {
  if (!data.value?.daily_revenue) return []
  // For 'day' granularity, pad with zeros so chart is continuous
  if (granularity.value !== 'day') return data.value.daily_revenue
  const map = {}
  for (const d of data.value.daily_revenue) map[d.period] = d
  const result = []
  const n = parseInt(days.value)
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const key = date.toISOString().substring(0, 10)
    result.push(map[key] || { period: key, order_count: 0, revenue: 0, avg_order_value: 0 })
  }
  return result
})

const maxRevenue = computed(() => Math.max(1, ...chartData.value.map(d => d.revenue)))
const maxOrders = computed(() => Math.max(1, ...chartData.value.map(d => d.order_count)))

function shortLabel(period) {
  if (granularity.value === 'day') {
    const [, m, d] = period.split('-')
    return `${m}/${d}`
  }
  if (granularity.value === 'week') return `W${period.split('-W')[1]}`
  return period.slice(0, 7)
}

const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dowData = computed(() => {
  if (!data.value?.dow_distribution) return []
  const map = {}
  for (const d of data.value.dow_distribution) map[d.dow] = d
  return [0, 1, 2, 3, 4, 5, 6].map(dow => ({
    dow,
    label: dowLabels[dow],
    count: map[dow]?.count || 0,
    revenue: map[dow]?.revenue || 0
  }))
})
const maxDow = computed(() => Math.max(1, ...dowData.value.map(d => d.count)))

const hourlyData = computed(() => {
  if (!data.value?.hourly_distribution) return []
  const map = {}
  for (const h of data.value.hourly_distribution) map[h.hour] = h
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: map[i]?.count || 0
  }))
})
const maxHourly = computed(() => Math.max(1, ...hourlyData.value.map(h => h.count)))

function statusColor(s) {
  const map = {
    pending: 'amber', processing: 'blue', shipped: 'purple',
    completed: 'green', cancelled: 'red', refunded: 'gray'
  }
  return map[s] || 'gray'
}
</script>

<style scoped>
.order-analytics-view { max-width: 1100px; }

.stats-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: .75rem;
  margin-bottom: 1.5rem;
}
.stat-card {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: .75rem;
  padding: 1rem;
}
.stat-value { font-size: 1.4rem; font-weight: 800; margin-bottom: .25rem; }
.stat-value.red { color: var(--accent); }
.stat-label { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #aaa); }

.chart-card { padding: 1.5rem; margin-bottom: 1.5rem; }
.chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.chart-header h3 { margin: 0; font-size: 1rem; }
.chart-legend { display: flex; align-items: center; gap: .3rem; font-size: .8rem; color: var(--text-muted, #aaa); }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.legend-dot.accent { background: var(--accent); }
.legend-dot.blue { background: #60a5fa; }

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 180px;
  overflow-x: auto;
  padding-bottom: 1.5rem;
  position: relative;
}
.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 20px;
  flex: 1;
  max-width: 40px;
}
.bar-pair {
  display: flex;
  gap: 1px;
  align-items: flex-end;
  height: 150px;
  width: 100%;
}
.bar {
  border-radius: 2px 2px 0 0;
  transition: height .3s ease;
  flex: 1;
}
.revenue-bar { background: var(--accent); opacity: .85; }
.orders-bar { background: #60a5fa; opacity: .7; }
.bar-label { font-size: .6rem; color: var(--text-muted, #aaa); margin-top: .25rem; writing-mode: vertical-lr; text-orientation: mixed; transform: rotate(180deg); max-height: 40px; overflow: hidden; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
@media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }

.breakdown-card, .dow-card, .hourly-card, .top-products-card { padding: 1.5rem; margin-bottom: 1.5rem; }
.card-title { margin: 0 0 1rem; font-size: 1rem; }

.status-row { margin-bottom: .75rem; }
.status-info { display: flex; align-items: center; gap: .5rem; margin-bottom: .25rem; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.green { background: #22c55e; }
.status-dot.amber { background: #f59e0b; }
.status-dot.blue { background: #60a5fa; }
.status-dot.purple { background: #a78bfa; }
.status-dot.red { background: var(--accent); }
.status-dot.gray { background: #9ca3af; }
.status-name { font-size: .85rem; font-weight: 600; text-transform: capitalize; }
.status-right { display: flex; gap: 1rem; font-size: .85rem; margin-bottom: .2rem; }
.status-bar-wrap { height: 4px; background: rgba(255,255,255,.06); border-radius: 2px; overflow: hidden; }
.status-bar-fill { height: 100%; border-radius: 2px; transition: width .4s ease; }
.status-bar-fill.green { background: #22c55e; }
.status-bar-fill.amber { background: #f59e0b; }
.status-bar-fill.blue { background: #60a5fa; }
.status-bar-fill.purple { background: #a78bfa; }
.status-bar-fill.red { background: var(--accent); }
.status-bar-fill.gray { background: #9ca3af; }

.dow-grid { display: flex; gap: .5rem; height: 120px; align-items: flex-end; }
.dow-col { flex: 1; display: flex; flex-direction: column; align-items: center; }
.dow-bar { width: 100%; background: var(--accent); border-radius: 2px 2px 0 0; min-height: 3px; transition: height .3s; margin-bottom: .25rem; }
.dow-label { font-size: .7rem; font-weight: 600; }
.dow-count { font-size: .65rem; color: var(--text-muted, #aaa); }

.hourly-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: .3rem; }
.hour-cell { border-radius: .3rem; padding: .3rem .2rem; text-align: center; transition: background .3s; }
.hour-label { font-size: .6rem; color: var(--text-muted, #aaa); }
.hour-count { font-size: .75rem; font-weight: 700; }

.rank-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(255,255,255,.08); font-size: .75rem; font-weight: 700;
}
.rank-badge.rank-1 { background: #fbbf24; color: #000; }
.rank-badge.rank-2 { background: #9ca3af; color: #000; }
.rank-badge.rank-3 { background: #92400e; color: #fff; }

.product-name-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
