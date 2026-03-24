<template>
  <div class="tax-report-view">
    <div class="page-header">
      <div>
        <h1>🧾 Tax Report</h1>
        <p class="subtitle">Tax accounting breakdown by rate, country, and month</p>
      </div>
      <div class="header-actions">
        <a :href="csvUrl" class="btn-ghost">⬇️ Export CSV</a>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters glass-card">
      <div class="filter-row">
        <div class="filter-item">
          <label>From</label>
          <input type="date" v-model="fromDate" @change="load()" class="form-input" />
        </div>
        <div class="filter-item">
          <label>To</label>
          <input type="date" v-model="toDate" @change="load()" class="form-input" />
        </div>
        <div class="filter-item">
          <label>Country</label>
          <select v-model="countryFilter" @change="load()" class="form-input">
            <option value="">All countries</option>
            <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <button v-if="fromDate || toDate || countryFilter" @click="clearFilters()" class="btn-ghost">✕ Clear</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading tax report...</div>

    <template v-else-if="report">
      <!-- Summary cards -->
      <div class="stats-strip">
        <div class="stat-card">
          <div class="stat-value">{{ report.summary?.order_count || 0 }}</div>
          <div class="stat-label">Taxable Orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ symbol }}{{ fmt(report.summary?.gross_revenue) }}</div>
          <div class="stat-label">Gross Revenue</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">{{ symbol }}{{ fmt(report.summary?.total_tax) }}</div>
          <div class="stat-label">Total Tax Collected</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ symbol }}{{ fmt(report.summary?.net_revenue) }}</div>
          <div class="stat-label">Net Revenue (ex. tax)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ symbol }}{{ fmt(report.summary?.total_shipping) }}</div>
          <div class="stat-label">Shipping Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ symbol }}{{ fmt(report.summary?.total_discounts) }}</div>
          <div class="stat-label">Discounts Given</div>
        </div>
      </div>

      <div class="two-col">
        <!-- By Tax Rate -->
        <div class="glass-card">
          <h2 class="section-title">By Tax Rate</h2>
          <table class="report-table">
            <thead>
              <tr>
                <th>Rate Name</th>
                <th>Orders</th>
                <th>Tax Collected</th>
                <th>Gross</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in report.byRate" :key="r.rate_name">
                <td><span class="rate-pill">{{ r.rate_name }}</span></td>
                <td>{{ r.order_count }}</td>
                <td class="money accent">{{ symbol }}{{ fmt(r.tax_collected) }}</td>
                <td class="money">{{ symbol }}{{ fmt(r.gross) }}</td>
                <td class="money">{{ symbol }}{{ fmt(r.net) }}</td>
              </tr>
              <tr v-if="!report.byRate?.length">
                <td colspan="5" class="empty">No data</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- By Country -->
        <div class="glass-card">
          <h2 class="section-title">By Country</h2>
          <table class="report-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Orders</th>
                <th>Tax Collected</th>
                <th>Gross</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in report.byCountry" :key="c.country">
                <td><span class="country-flag">{{ countryFlag(c.country) }}</span> {{ c.country }}</td>
                <td>{{ c.order_count }}</td>
                <td class="money accent">{{ symbol }}{{ fmt(c.tax_collected) }}</td>
                <td class="money">{{ symbol }}{{ fmt(c.gross) }}</td>
              </tr>
              <tr v-if="!report.byCountry?.length">
                <td colspan="4" class="empty">No data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Monthly breakdown -->
      <div class="glass-card">
        <h2 class="section-title">Monthly Breakdown</h2>

        <!-- Mini bar chart -->
        <div class="monthly-chart" v-if="report.monthly?.length">
          <div v-for="m in report.monthly" :key="m.month" class="chart-col">
            <div class="bar-wrap">
              <div class="bar" :style="{ height: barHeight(m.tax_collected) + '%' }" :title="`${m.month}: ${symbol}${fmt(m.tax_collected)} tax`"></div>
            </div>
            <div class="chart-label">{{ m.month.slice(5) }}</div>
          </div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Orders</th>
              <th>Tax Collected</th>
              <th>Gross</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in report.monthly" :key="m.month">
              <td>{{ m.month }}</td>
              <td>{{ m.order_count }}</td>
              <td class="money accent">{{ symbol }}{{ fmt(m.tax_collected) }}</td>
              <td class="money">{{ symbol }}{{ fmt(m.gross) }}</td>
              <td class="money">{{ symbol }}{{ fmt(m.net) }}</td>
            </tr>
            <tr v-if="!report.monthly?.length">
              <td colspan="5" class="empty">No monthly data</td>
            </tr>
          </tbody>
          <tfoot v-if="report.monthly?.length">
            <tr class="totals-row">
              <td><strong>Total</strong></td>
              <td><strong>{{ report.summary?.order_count }}</strong></td>
              <td class="money accent"><strong>{{ symbol }}{{ fmt(report.summary?.total_tax) }}</strong></td>
              <td class="money"><strong>{{ symbol }}{{ fmt(report.summary?.gross_revenue) }}</strong></td>
              <td class="money"><strong>{{ symbol }}{{ fmt(report.summary?.net_revenue) }}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const report = ref(null)
const countries = ref([])
const loading = ref(false)
const fromDate = ref('')
const toDate = ref('')
const countryFilter = ref('')
const symbol = ref('€')

const csvUrl = computed(() => {
  const p = new URLSearchParams()
  if (fromDate.value) p.set('from', fromDate.value)
  if (toDate.value) p.set('to', toDate.value)
  if (countryFilter.value) p.set('country', countryFilter.value)
  return `/api/tax-report/export/csv?${p.toString()}`
})

onMounted(async () => {
  try {
    const { data } = await api.get('/settings')
    symbol.value = data.shop_currency_symbol || '€'
  } catch {}
  const { data } = await api.get('/tax-report/countries')
  countries.value = data || []
  load()
})

async function load() {
  loading.value = true
  try {
    const params = {}
    if (fromDate.value) params.from = fromDate.value
    if (toDate.value) params.to = toDate.value
    if (countryFilter.value) params.country = countryFilter.value
    const { data } = await api.get('/tax-report', { params })
    report.value = data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  fromDate.value = ''
  toDate.value = ''
  countryFilter.value = ''
  load()
}

function fmt(v) { return (v || 0).toFixed(2) }

function barHeight(val) {
  const maxTax = Math.max(...(report.value?.monthly?.map(m => m.tax_collected) || [1]))
  return maxTax > 0 ? Math.max(4, (val / maxTax) * 100) : 4
}

function countryFlag(country) {
  if (!country || country === 'Unknown') return '🌍'
  // ISO 2-letter → flag emoji
  if (country.length === 2) {
    return String.fromCodePoint(...[...country.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
  }
  return '🌍'
}
</script>

<style scoped>
.tax-report-view { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
.page-header h1 { margin: 0; font-size: 1.5rem; }
.subtitle { color: var(--text-muted, #aaa); margin: 0.25rem 0 0; font-size: 0.875rem; }
.header-actions { display: flex; gap: 0.75rem; }

.glass-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; overflow: hidden; }
.filters.glass-card { padding: 1rem 1.25rem; }
.filter-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
.filter-item { display: flex; flex-direction: column; gap: 0.25rem; }
.filter-item label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #aaa); text-transform: uppercase; letter-spacing: 0.05em; }
.form-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; color: inherit; padding: 0.5rem 0.875rem; font-size: 0.875rem; min-width: 120px; }

.loading { text-align: center; color: var(--text-muted, #aaa); padding: 3rem; }

.stats-strip { display: flex; flex-wrap: wrap; gap: 1rem; }
.stat-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 1rem 1.25rem; min-width: 130px; flex: 1; }
.stat-card.accent { border-color: var(--accent, hsl(355,70%,58%))44; }
.stat-value { font-size: 1.4rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: var(--text-muted, #aaa); }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }

.section-title { margin: 0; font-size: 1rem; padding: 1rem 1.25rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
.report-table { width: 100%; border-collapse: collapse; }
.report-table th, .report-table td { padding: 0.65rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.85rem; }
.report-table th { color: var(--text-muted, #aaa); font-weight: 500; background: rgba(255,255,255,0.02); }
.money { text-align: right; font-variant-numeric: tabular-nums; }
.money.accent { color: var(--accent, hsl(355,70%,58%)); font-weight: 600; }
.rate-pill { background: rgba(255,255,255,0.07); padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.8rem; }
.empty { text-align: center; color: var(--text-muted, #aaa); padding: 1.5rem !important; }
.totals-row td { background: rgba(255,255,255,0.03); border-top: 2px solid rgba(255,255,255,0.1); }
.country-flag { font-size: 1rem; }

/* Mini bar chart */
.monthly-chart { display: flex; gap: 0.25rem; padding: 1rem 1rem 0; height: 80px; align-items: flex-end; }
.chart-col { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 0.25rem; height: 100%; }
.bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.bar { width: 100%; background: var(--accent, hsl(355,70%,58%)); border-radius: 3px 3px 0 0; min-height: 4px; transition: height 0.3s; }
.chart-label { font-size: 0.65rem; color: var(--text-muted, #aaa); white-space: nowrap; }

.btn-accent { background: var(--accent); color: white; border: none; border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; font-weight: 600; text-decoration: none; }
.btn-ghost { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: inherit; border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; text-decoration: none; }
</style>
