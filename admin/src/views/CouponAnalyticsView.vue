<template>
  <div class="coupon-analytics">
    <div class="page-header">
      <div class="header-left">
        <h1>📊 Coupon Analytics</h1>
        <p class="subtitle">Coupon usage, savings, and performance insights</p>
      </div>
      <div class="header-right">
        <select v-model="days" @change="load" class="form-input" style="width:140px">
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <RouterLink to="/coupons" class="btn btn-ghost">← Back to Coupons</RouterLink>
      </div>
    </div>

    <div v-if="loading" class="loading-bar"></div>

    <!-- Summary Stats -->
    <div class="stats-strip" v-if="data">
      <div class="stat-card accent">
        <div class="stat-value">{{ data.totalUses }}</div>
        <div class="stat-label">Total Uses</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmt(data.totalSaved) }}</div>
        <div class="stat-label">Total Saved by Customers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ data.uniqueCoupons }}</div>
        <div class="stat-label">Unique Coupons Used</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ data.uniqueCustomers }}</div>
        <div class="stat-label">Unique Customers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ data.totalUses ? fmt(data.totalSaved / data.totalUses) : '—' }}</div>
        <div class="stat-label">Avg Discount / Use</div>
      </div>
    </div>

    <!-- Daily Usage Chart -->
    <div class="chart-card glass" v-if="data && data.daily.length">
      <h2>📈 Daily Usage</h2>
      <div class="chart-area">
        <div class="chart-bars">
          <div
            v-for="d in filledDaily" :key="d.day"
            class="chart-bar-col"
            :title="`${d.day}: ${d.uses} use(s), ${fmt(d.saved)} saved`"
          >
            <div class="bar-saved" :style="{ height: barHeight(d.saved, maxSaved) + 'px' }"></div>
            <div class="bar-uses" :style="{ height: barHeight(d.uses, maxUses) + 'px' }"></div>
            <div class="bar-label" v-if="filledDaily.length <= 14">{{ shortDate(d.day) }}</div>
          </div>
        </div>
      </div>
      <div class="chart-legend">
        <span class="legend-dot saved"></span> Savings (€)
        <span class="legend-dot uses" style="margin-left:1rem"></span> Uses
      </div>
    </div>

    <div class="two-col" v-if="data">
      <!-- Top Coupons -->
      <div class="glass card-block">
        <h2>🏆 Top Coupons</h2>
        <table class="data-table" v-if="data.topCoupons.length">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Uses</th>
              <th>Total Saved</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in data.topCoupons" :key="c.code">
              <td><code class="coupon-code">{{ c.code }}</code></td>
              <td><span class="badge" :class="'type-' + c.type">{{ typelabel(c) }}</span></td>
              <td>{{ c.uses }}</td>
              <td>{{ fmt(c.total_saved) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">No coupon usage in this period.</div>
      </div>

      <!-- Top Customers -->
      <div class="glass card-block">
        <h2>👤 Top Customers by Coupon Use</h2>
        <table class="data-table" v-if="data.topCustomers.length">
          <thead>
            <tr>
              <th>Email</th>
              <th>Uses</th>
              <th>Total Saved</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in data.topCustomers" :key="c.customer_email">
              <td class="email-cell">{{ c.customer_email || '—' }}</td>
              <td>{{ c.uses }}</td>
              <td>{{ fmt(c.total_saved) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">No data.</div>
      </div>
    </div>

    <!-- Coupon Type Breakdown -->
    <div class="glass card-block" v-if="data && data.byType.length" style="margin-top:1.5rem">
      <h2>🔖 Usage by Type</h2>
      <div class="type-breakdown">
        <div v-for="t in data.byType" :key="t.type" class="type-row">
          <span class="badge" :class="'type-' + t.type">{{ t.type }}</span>
          <div class="type-bar-wrap">
            <div class="type-bar" :style="{ width: typeBarWidth(t.uses) + '%' }"></div>
          </div>
          <span class="type-stats">{{ t.uses }} uses · {{ fmt(t.saved) }} saved</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const days = ref('30')
const loading = ref(false)
const data = ref(null)

async function load() {
  loading.value = true
  try {
    const { data: d } = await api.get('/coupons/analytics/summary', { params: { days: days.value } })
    data.value = d
  } catch {}
  loading.value = false
}

onMounted(load)

const maxSaved = computed(() => Math.max(...(data.value?.daily || []).map(d => d.saved), 1))
const maxUses = computed(() => Math.max(...(data.value?.daily || []).map(d => d.uses), 1))

function barHeight(val, max) {
  return Math.max(2, (val / max) * 80)
}

const filledDaily = computed(() => {
  if (!data.value?.daily) return []
  if (days.value <= 14) return data.value.daily
  // Fill gaps
  const map = {}
  for (const d of data.value.daily) map[d.day] = d
  const result = []
  const daysN = parseInt(days.value)
  for (let i = daysN - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    result.push(map[date] || { day: date, uses: 0, saved: 0 })
  }
  return result
})

function shortDate(d) {
  return d.slice(5) // MM-DD
}

function fmt(v) {
  return '€' + parseFloat(v || 0).toFixed(2)
}

function typelabel(c) {
  if (c.type === 'percentage') return `${c.value}% off`
  if (c.type === 'fixed') return `€${c.value} off`
  if (c.type === 'free_shipping') return 'Free ship'
  if (c.type === 'bogo') return 'BOGO'
  return c.type
}

const maxTypeUses = computed(() => Math.max(...(data.value?.byType || []).map(t => t.uses), 1))
function typeBarWidth(uses) {
  return (uses / maxTypeUses.value) * 100
}
</script>

<style scoped>
.coupon-analytics { padding: 2rem; max-width: 1200px; }
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap; }
.header-right { display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; }
.subtitle { color:var(--text-muted); margin:.25rem 0 0; font-size:.9rem; }
.stats-strip { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; }
.stat-card { background:var(--surface); border-radius:1rem; padding:1rem 1.5rem; min-width:140px; }
.stat-card.accent { border:1px solid var(--accent); }
.stat-value { font-size:1.6rem; font-weight:700; }
.stat-label { font-size:.8rem; color:var(--text-muted); margin-top:.25rem; }
.loading-bar { height:3px; background:linear-gradient(90deg,var(--accent),transparent); animation:slide 1s infinite; border-radius:2px; margin-bottom:1rem; }
@keyframes slide { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

.chart-card { padding:1.5rem; border-radius:1.5rem; margin-bottom:1.5rem; }
.chart-card h2 { margin:0 0 1rem; font-size:1rem; }
.chart-area { overflow-x:auto; }
.chart-bars { display:flex; gap:4px; align-items:flex-end; height:120px; min-width:300px; padding-bottom:1.5rem; position:relative; }
.chart-bar-col { display:flex; flex-direction:column; align-items:center; gap:2px; flex:1; min-width:8px; }
.bar-saved { background:var(--accent); border-radius:2px 2px 0 0; width:100%; transition:height .3s; }
.bar-uses { background:rgba(255,255,255,0.3); border-radius:2px 2px 0 0; width:100%; transition:height .3s; }
.bar-label { font-size:.6rem; color:var(--text-muted); transform:rotate(-40deg); white-space:nowrap; }
.chart-legend { display:flex; gap:.5rem; align-items:center; font-size:.8rem; margin-top:.5rem; color:var(--text-muted); }
.legend-dot { display:inline-block; width:10px; height:10px; border-radius:2px; }
.legend-dot.saved { background:var(--accent); }
.legend-dot.uses { background:rgba(255,255,255,0.3); }

.two-col { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }
@media (max-width:768px) { .two-col { grid-template-columns:1fr; } }
.card-block { padding:1.5rem; border-radius:1.5rem; }
.card-block h2 { margin:0 0 1rem; font-size:1rem; }
.data-table { width:100%; border-collapse:collapse; font-size:.85rem; }
.data-table th { text-align:left; padding:.5rem .75rem; font-size:.75rem; text-transform:uppercase; color:var(--text-muted); border-bottom:1px solid rgba(255,255,255,.1); }
.data-table td { padding:.5rem .75rem; border-bottom:1px solid rgba(255,255,255,.06); }
.coupon-code { background:rgba(255,255,255,.08); padding:.1rem .4rem; border-radius:.25rem; font-family:monospace; font-size:.8rem; }
.badge { padding:.2rem .5rem; border-radius:.5rem; font-size:.75rem; font-weight:600; }
.type-percentage { background:rgba(99,202,121,.2); color:#63ca79; }
.type-fixed { background:rgba(99,162,255,.2); color:#63a2ff; }
.type-free_shipping { background:rgba(255,186,99,.2); color:#ffba63; }
.type-bogo { background:rgba(255,99,199,.2); color:#ff63c7; }
.email-cell { font-size:.8rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.empty-state { color:var(--text-muted); text-align:center; padding:2rem; font-size:.9rem; }

.type-breakdown { display:flex; flex-direction:column; gap:.75rem; }
.type-row { display:flex; align-items:center; gap:1rem; }
.type-bar-wrap { flex:1; background:rgba(255,255,255,.08); border-radius:4px; height:8px; overflow:hidden; }
.type-bar { height:100%; background:var(--accent); border-radius:4px; transition:width .5s; }
.type-stats { font-size:.8rem; color:var(--text-muted); white-space:nowrap; min-width:160px; text-align:right; }
</style>
