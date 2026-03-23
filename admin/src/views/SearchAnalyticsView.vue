<template>
  <div class="sa-wrap">
    <div class="page-header">
      <h1>🔍 Search Analytics</h1>
      <div class="header-actions">
        <select v-model="days" @change="load" class="input" style="max-width:120px">
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="60">60 days</option>
          <option value="90">90 days</option>
        </select>
      </div>
    </div>

    <!-- Summary stats -->
    <div class="sa-stats" v-if="summary">
      <div class="sstat glass"><div class="sstat-num">{{ summary.total }}</div><div class="sstat-label">Total Searches</div></div>
      <div class="sstat glass"><div class="sstat-num">{{ summary.unique_queries }}</div><div class="sstat-label">Unique Queries</div></div>
      <div class="sstat glass accent"><div class="sstat-num">{{ summary.click_through_rate }}%</div><div class="sstat-label">Click-Through Rate</div></div>
      <div class="sstat glass warn"><div class="sstat-num">{{ summary.zero_result_rate }}%</div><div class="sstat-label">Zero-Result Rate</div></div>
      <div class="sstat glass"><div class="sstat-num">{{ summary.zero_results }}</div><div class="sstat-label">Zero Results</div></div>
    </div>

    <!-- Daily chart -->
    <div class="glass chart-card" v-if="daily.length">
      <h3>📈 Daily Search Volume</h3>
      <div class="bar-chart">
        <div
          v-for="d in daily"
          :key="d.date"
          class="bar-col"
          :title="`${d.date}: ${d.searches} searches`"
        >
          <div class="bar-fill" :style="{ height: barHeight(d.searches) + 'px' }"></div>
          <div class="bar-zero" v-if="d.zero_results" :style="{ height: zeroBarHeight(d.zero_results) + 'px' }"></div>
          <div class="bar-label" v-if="daily.length <= 30">{{ shortDate(d.date) }}</div>
        </div>
      </div>
      <div class="chart-legend">
        <span class="legend-dot accent"></span><span>Searches</span>
        <span class="legend-dot warn" style="margin-left:1rem"></span><span>Zero results</span>
      </div>
    </div>

    <!-- Two-column: Top queries + Zero-result queries -->
    <div class="dual-tables">
      <!-- Top queries -->
      <div class="glass table-card">
        <h3>🔝 Top Search Queries</h3>
        <table>
          <thead><tr><th>Query</th><th>Searches</th><th>Clicks</th><th>CTR</th><th>Avg Results</th></tr></thead>
          <tbody>
            <tr v-for="q in topQueries" :key="q.query">
              <td><strong>{{ q.query }}</strong></td>
              <td>{{ q.searches }}</td>
              <td>{{ q.clicks }}</td>
              <td>{{ q.searches > 0 ? ((q.clicks / q.searches) * 100).toFixed(0) : 0 }}%</td>
              <td>{{ Math.round(q.avg_results) }}</td>
            </tr>
            <tr v-if="!topQueries.length"><td colspan="5" class="text-muted" style="text-align:center;padding:1rem">No data yet</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Zero-result queries -->
      <div class="glass table-card">
        <h3>❌ Zero-Result Queries</h3>
        <p class="text-muted text-sm">These searches returned no results — consider creating content for them.</p>
        <table>
          <thead><tr><th>Query</th><th>Searches</th><th>Last Searched</th></tr></thead>
          <tbody>
            <tr v-for="q in zeroQueries" :key="q.query">
              <td><strong>{{ q.query }}</strong></td>
              <td><span class="warn-badge">{{ q.searches }}</span></td>
              <td class="text-muted text-sm">{{ fmt(q.last_searched_at) }}</td>
            </tr>
            <tr v-if="!zeroQueries.length"><td colspan="3" class="text-muted" style="text-align:center;padding:1rem">No zero-result queries 🎉</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Top click-throughs -->
    <div class="glass table-card" v-if="clicks.length">
      <h3>👆 Most Clicked Search Results</h3>
      <table>
        <thead><tr><th>Slug</th><th>Type</th><th>Clicks</th></tr></thead>
        <tbody>
          <tr v-for="c in clicks" :key="c.clicked_slug + c.clicked_type">
            <td><a :href="`/${c.clicked_slug}`" target="_blank" class="link">{{ c.clicked_slug }}</a></td>
            <td><span class="tag">{{ c.clicked_type || '—' }}</span></td>
            <td>{{ c.clicks }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const days = ref(30)
const summary = ref(null)
const daily = ref([])
const topQueries = ref([])
const zeroQueries = ref([])
const clicks = ref([])

async function load() {
  const d = days.value
  const [s, da, top, zero, cl] = await Promise.all([
    api.get(`/search-analytics/summary?days=${d}`),
    api.get(`/search-analytics/daily?days=${d}`),
    api.get(`/search-analytics/top?days=${d}&limit=25`),
    api.get(`/search-analytics/zero-results?days=${d}`),
    api.get(`/search-analytics/clicks?days=${d}`),
  ])
  summary.value = s.data
  daily.value = da.data.daily || []
  topQueries.value = top.data.queries || []
  zeroQueries.value = zero.data.queries || []
  clicks.value = cl.data.clicks || []
}

const maxSearches = () => Math.max(...daily.value.map(d => d.searches), 1)
const maxZero = () => Math.max(...daily.value.map(d => d.zero_results), 1)
const BAR_MAX = 80
function barHeight(n) { return Math.max(4, (n / maxSearches()) * BAR_MAX) }
function zeroBarHeight(n) { return Math.max(0, (n / maxZero()) * 20) }
function shortDate(d) { return d.slice(5) }
function fmt(d) { if (!d) return ''; return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }

onMounted(load)
</script>

<style scoped>
.sa-wrap { display: flex; flex-direction: column; gap: 1.25rem; }
.sa-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; }
.sstat { text-align: center; padding: 0.75rem 1rem; border-radius: 1rem; }
.sstat.accent { border-color: var(--accent); }
.sstat.warn { border-color: rgba(251,191,36,0.5); }
.sstat-num { font-size: 1.6rem; font-weight: 700; }
.sstat-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.chart-card { border-radius: 1rem; padding: 1.25rem; }
.chart-card h3 { margin: 0 0 1rem; }
.bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 100px; overflow-x: auto; padding-bottom: 0.25rem; }
.bar-col { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 12px; flex: 1; max-width: 28px; position: relative; }
.bar-fill { background: var(--accent); border-radius: 3px 3px 0 0; width: 100%; min-height: 4px; }
.bar-zero { background: rgba(251,191,36,0.6); border-radius: 3px 3px 0 0; width: 100%; position: absolute; bottom: 16px; }
.bar-label { font-size: 0.6rem; color: var(--muted); transform: rotate(-30deg); transform-origin: top center; white-space: nowrap; }
.chart-legend { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.legend-dot.accent { background: var(--accent); }
.legend-dot.warn { background: rgba(251,191,36,0.7); }
.dual-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 768px) { .dual-tables { grid-template-columns: 1fr; } }
.table-card { border-radius: 1rem; padding: 1rem; }
.table-card h3 { margin: 0 0 0.75rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
th, td { padding: 0.5rem 0.6rem; text-align: left; }
th { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; }
tr:hover td { background: rgba(255,255,255,0.03); }
.text-sm { font-size: 0.8rem; }
.warn-badge { background: rgba(251,191,36,0.2); color: #fbbf24; border-radius: 999px; padding: 0.1rem 0.5rem; font-weight: 700; font-size: 0.8rem; }
.tag { background: rgba(255,255,255,0.07); border-radius: 999px; padding: 0.15rem 0.5rem; font-size: 0.72rem; }
.link { color: var(--accent); text-decoration: none; }
.link:hover { text-decoration: underline; }
</style>
