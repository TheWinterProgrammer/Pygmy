<template>
  <div>
    <div class="page-header">
      <h1>⚡ Performance & Web Vitals</h1>
      <div style="display:flex;gap:8px;align-items:center">
        <label class="text-muted" style="font-size:0.85rem">Period:</label>
        <select v-model="days" @change="load" class="select-sm">
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
          <option value="60">60 days</option>
          <option value="90">90 days</option>
        </select>
        <label class="text-muted" style="font-size:0.85rem">Metric:</label>
        <select v-model="chartMetric" @change="loadDaily" class="select-sm">
          <option value="lcp">LCP</option>
          <option value="cls">CLS</option>
          <option value="fcp">FCP</option>
          <option value="ttfb">TTFB</option>
          <option value="inp">INP</option>
          <option value="fid">FID</option>
        </select>
      </div>
    </div>

    <!-- No Data Notice -->
    <div v-if="!summary?.samples" class="glass notice-card">
      <div class="notice-icon">⚡</div>
      <h3>No Performance Data Yet</h3>
      <p>Add the Web Vitals beacon to your public frontend to start collecting Core Web Vitals data.</p>
      <div class="code-block">
        <pre>// Add to frontend/src/main.js or App.vue:
import { initWebVitals } from './webVitals.js'
initWebVitals()</pre>
      </div>
      <p class="text-muted" style="font-size:0.85rem">The Pygmy public frontend automatically reports vitals once the script is included.</p>
    </div>

    <template v-else>
      <!-- Overall Score -->
      <div class="glass score-card" :class="'score-' + (summary?.overall || 'unknown')">
        <div class="score-label">Overall Performance</div>
        <div class="score-value">{{ overallLabel }}</div>
        <div class="score-samples">Based on {{ summary?.samples?.toLocaleString() }} samples over {{ days }} days</div>
      </div>

      <!-- Metrics Grid -->
      <div class="metrics-grid">
        <div v-for="m in metrics" :key="m.key"
          class="metric-card glass"
          :class="'rate-' + (summary?.ratings?.[m.key] || 'unknown')">
          <div class="metric-name">{{ m.label }}</div>
          <div class="metric-value">{{ formatMetric(m.key, summary?.[`avg_${m.key}`]) }}</div>
          <div class="metric-rating">
            <span class="rating-dot"></span>
            {{ ratingLabel(summary?.ratings?.[m.key]) }}
          </div>
          <div class="metric-thresholds text-muted">
            Good: ≤{{ formatMetric(m.key, m.goodThreshold) }} · Poor: &gt;{{ formatMetric(m.key, m.poorThreshold) }}
          </div>
        </div>
      </div>

      <!-- Daily Chart -->
      <div class="glass chart-card">
        <div class="chart-header">
          <h3>📈 {{ metricLabel(chartMetric) }} Over Time</h3>
        </div>
        <div class="chart-wrap" v-if="daily.data?.length">
          <div class="chart-bars">
            <div v-for="d in daily.data" :key="d.date" class="bar-wrap" :title="`${d.date}: ${d.avg_val != null ? formatMetric(chartMetric, d.avg_val) : 'no data'}`">
              <div class="bar" :style="{ height: barHeight(d.avg_val) + '%' }"
                :class="getBarClass(d.avg_val)"></div>
              <div class="bar-label">{{ d.date.slice(5) }}</div>
            </div>
          </div>
          <div class="chart-thresholds">
            <span class="threshold good">● Good</span>
            <span class="threshold ni">● Needs improvement</span>
            <span class="threshold poor">● Poor</span>
          </div>
        </div>
        <div v-else class="text-muted" style="padding:20px">No chart data available.</div>
      </div>

      <!-- Device Breakdown -->
      <div class="two-col">
        <div class="glass" style="padding:20px" v-if="deviceBreakdown.length">
          <h3 style="margin:0 0 16px">📱 Device Breakdown</h3>
          <div class="device-grid">
            <div v-for="d in deviceBreakdown" :key="d.device" class="device-card glass">
              <div class="device-icon">{{ d.device === 'mobile' ? '📱' : d.device === 'tablet' ? '📟' : '🖥️' }}</div>
              <div class="device-name">{{ d.device }}</div>
              <div class="device-samples">{{ d.samples }} samples</div>
              <div class="device-metrics">
                <div><span class="dm-label">LCP</span> <span :class="rateClass('lcp', d.avg_lcp)">{{ formatMetric('lcp', d.avg_lcp) }}</span></div>
                <div><span class="dm-label">CLS</span> <span :class="rateClass('cls', d.avg_cls)">{{ formatMetric('cls', d.avg_cls) }}</span></div>
                <div><span class="dm-label">TTFB</span> <span :class="rateClass('ttfb', d.avg_ttfb)">{{ formatMetric('ttfb', d.avg_ttfb) }}</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pages Needing Attention -->
        <div class="glass" style="padding:20px" v-if="worstPages.length">
          <h3 style="margin:0 0 16px">🐢 Slowest Pages (by LCP)</h3>
          <div v-for="p in worstPages" :key="p.path" class="worst-row">
            <div class="worst-path" :title="p.path">{{ p.path }}</div>
            <div class="worst-metrics">
              <span :class="rateClass('lcp', p.avg_lcp)">{{ formatMetric('lcp', p.avg_lcp) }}</span>
              <span class="text-muted" style="font-size:0.75rem">{{ p.samples }}×</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Per-page Table -->
      <div class="glass table-wrap">
        <div class="table-head-row">
          <h3>📋 Per-page Breakdown</h3>
        </div>
        <table class="data-table" v-if="pages.length">
          <thead>
            <tr>
              <th>Page</th>
              <th>Samples</th>
              <th>LCP</th>
              <th>CLS</th>
              <th>FCP</th>
              <th>TTFB</th>
              <th>INP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pages" :key="p.path">
              <td class="path-cell" :title="p.path">{{ p.path }}</td>
              <td class="text-muted">{{ p.samples }}</td>
              <td><span :class="rateClass('lcp', p.avg_lcp)">{{ formatMetric('lcp', p.avg_lcp) }}</span></td>
              <td><span :class="rateClass('cls', p.avg_cls)">{{ formatMetric('cls', p.avg_cls) }}</span></td>
              <td><span :class="rateClass('fcp', p.avg_fcp)">{{ formatMetric('fcp', p.avg_fcp) }}</span></td>
              <td><span :class="rateClass('ttfb', p.avg_ttfb)">{{ formatMetric('ttfb', p.avg_ttfb) }}</span></td>
              <td><span :class="rateClass('inp', p.avg_inp)">{{ formatMetric('inp', p.avg_inp) }}</span></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state" style="padding:30px">
          <p class="text-muted">No per-page data available yet.</p>
        </div>
      </div>

      <!-- Purge old data -->
      <div class="glass" style="padding:16px;display:flex;align-items:center;gap:12px;margin-top:8px">
        <span class="text-muted" style="font-size:0.85rem">Purge data older than:</span>
        <select v-model="purgeDays" class="select-sm">
          <option value="30">30 days</option>
          <option value="60">60 days</option>
          <option value="90">90 days</option>
          <option value="180">180 days</option>
        </select>
        <button class="btn btn-ghost btn-sm btn-danger" @click="purge">🗑️ Purge Old Data</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const days = ref(30)
const chartMetric = ref('lcp')
const purgeDays = ref(90)

const summary = ref(null)
const daily = ref({ data: [] })
const pages = ref([])
const deviceBreakdown = ref([])
const worstPages = ref([])

const metrics = [
  { key: 'lcp', label: 'LCP', desc: 'Largest Contentful Paint', goodThreshold: 2500, poorThreshold: 4000, unit: 'ms' },
  { key: 'fcp', label: 'FCP', desc: 'First Contentful Paint', goodThreshold: 1800, poorThreshold: 3000, unit: 'ms' },
  { key: 'cls', label: 'CLS', desc: 'Cumulative Layout Shift', goodThreshold: 0.1, poorThreshold: 0.25, unit: '' },
  { key: 'ttfb', label: 'TTFB', desc: 'Time to First Byte', goodThreshold: 800, poorThreshold: 1800, unit: 'ms' },
  { key: 'inp', label: 'INP', desc: 'Interaction to Next Paint', goodThreshold: 200, poorThreshold: 500, unit: 'ms' },
  { key: 'fid', label: 'FID', desc: 'First Input Delay', goodThreshold: 100, poorThreshold: 300, unit: 'ms' },
]

const overallLabel = computed(() => {
  const map = { good: '✅ Good', 'needs-improvement': '🟡 Needs Improvement', poor: '🔴 Poor' }
  return map[summary.value?.overall] || '⚪ No data'
})

function metricLabel(key) {
  return metrics.find(m => m.key === key)?.label || key.toUpperCase()
}

function formatMetric(key, val) {
  if (val == null || val === undefined) return '—'
  if (key === 'cls') return val.toFixed(3)
  return Math.round(val) + 'ms'
}

function ratingLabel(r) {
  return { good: '✅ Good', 'needs-improvement': '🟡 Needs improvement', poor: '🔴 Poor' }[r] || '⚪ No data'
}

function rateClass(metric, val) {
  if (val == null) return 'text-muted'
  const thresholds = { lcp: [2500, 4000], fid: [100, 300], cls: [0.1, 0.25], fcp: [1800, 3000], ttfb: [800, 1800], inp: [200, 500] }
  const [good, poor] = thresholds[metric] || [0, 0]
  if (val <= good) return 'rate-good'
  if (val <= poor) return 'rate-ni'
  return 'rate-poor'
}

// Chart helpers
function barHeight(val) {
  if (val == null) return 0
  const maxes = { lcp: 6000, cls: 0.5, fcp: 4000, ttfb: 3000, inp: 800, fid: 500 }
  const max = maxes[chartMetric.value] || 5000
  return Math.min(100, Math.round((val / max) * 100))
}

function getBarClass(val) {
  if (val == null) return 'bar-empty'
  const thresholds = { lcp: [2500, 4000], fid: [100, 300], cls: [0.1, 0.25], fcp: [1800, 3000], ttfb: [800, 1800], inp: [200, 500] }
  const [good, poor] = thresholds[chartMetric.value] || [0, 0]
  if (val <= good) return 'bar-good'
  if (val <= poor) return 'bar-ni'
  return 'bar-poor'
}

async function load() {
  const [sum, pgs, dev, worst] = await Promise.all([
    api.get(`/web-vitals/summary?days=${days.value}`),
    api.get(`/web-vitals/pages?days=${days.value}&limit=30`),
    api.get(`/web-vitals/device-breakdown?days=${days.value}`),
    api.get(`/web-vitals/worst?days=${days.value}`),
  ])
  summary.value = sum.data
  pages.value = pgs.data
  deviceBreakdown.value = dev.data
  worstPages.value = worst.data
  await loadDaily()
}

async function loadDaily() {
  const { data } = await api.get(`/web-vitals/daily?days=${days.value}&metric=${chartMetric.value}`)
  daily.value = data
}

async function purge() {
  if (!confirm(`Delete Web Vitals data older than ${purgeDays.value} days?`)) return
  await api.delete(`/web-vitals/purge?days=${purgeDays.value}`)
  await load()
}

onMounted(load)
</script>

<style scoped>
.notice-card { padding: 40px; text-align: center; }
.notice-icon { font-size: 3rem; margin-bottom: 12px; }
.notice-card h3 { margin: 0 0 8px; }
.code-block { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; margin: 16px 0; text-align: left; }
.code-block pre { margin: 0; font-size: 0.82rem; color: #a0f0a0; }

.score-card { padding: 20px 28px; margin-bottom: 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid transparent; }
.score-good { border-left-color: #4ade80; }
.score-needs-improvement { border-left-color: #facc15; }
.score-poor { border-left-color: var(--accent); }
.score-label { font-size: 0.82rem; color: var(--text-muted); text-transform: uppercase; flex-shrink: 0; }
.score-value { font-size: 1.1rem; font-weight: 700; }
.score-samples { font-size: 0.8rem; color: var(--text-muted); margin-left: auto; }

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
.metric-card { padding: 16px; }
.metric-name { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 4px; }
.metric-value { font-size: 1.6rem; font-weight: 700; }
.rate-good .metric-value { color: #4ade80; }
.rate-needs-improvement .metric-value { color: #facc15; }
.rate-poor .metric-value { color: var(--accent); }
.metric-rating { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; margin-top: 6px; }
.rating-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.rate-good .rating-dot { background: #4ade80; }
.rate-needs-improvement .rating-dot { background: #facc15; }
.rate-poor .rating-dot { background: var(--accent); }
.metric-thresholds { font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; }

.chart-card { padding: 20px; margin-bottom: 20px; }
.chart-header h3 { margin: 0 0 16px; }
.chart-wrap { }
.chart-bars { display: flex; align-items: flex-end; height: 120px; gap: 2px; overflow-x: auto; padding-bottom: 24px; position: relative; }
.bar-wrap { flex: 1; min-width: 14px; display: flex; flex-direction: column; align-items: center; gap: 2px; height: 100%; justify-content: flex-end; }
.bar { width: 100%; min-height: 2px; border-radius: 3px 3px 0 0; transition: height 0.3s; }
.bar-good { background: #4ade80; }
.bar-ni { background: #facc15; }
.bar-poor { background: var(--accent); }
.bar-empty { background: rgba(255,255,255,0.1); }
.bar-label { font-size: 0.55rem; color: var(--text-muted); white-space: nowrap; position: absolute; bottom: 0; }
.chart-thresholds { display: flex; gap: 16px; margin-top: 8px; font-size: 0.78rem; }
.threshold.good { color: #4ade80; }
.threshold.ni { color: #facc15; }
.threshold.poor { color: var(--accent); }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
@media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }

.device-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.device-card { padding: 14px; text-align: center; }
.device-icon { font-size: 1.5rem; }
.device-name { font-weight: 600; text-transform: capitalize; margin: 4px 0; }
.device-samples { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px; }
.device-metrics { font-size: 0.78rem; display: flex; flex-direction: column; gap: 2px; text-align: left; }
.dm-label { color: var(--text-muted); display: inline-block; width: 36px; }

.worst-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); }
.worst-row:last-child { border-bottom: none; }
.worst-path { font-size: 0.85rem; font-family: monospace; overflow: hidden; text-overflow: ellipsis; max-width: 70%; }
.worst-metrics { display: flex; align-items: center; gap: 8px; }

.path-cell { font-family: monospace; font-size: 0.82rem; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.table-head-row { padding: 16px 16px 0; }
.table-head-row h3 { margin: 0 0 12px; }

.rate-good { color: #4ade80; font-weight: 600; }
.rate-ni { color: #facc15; font-weight: 600; }
.rate-poor { color: var(--accent); font-weight: 600; }

.select-sm { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; font-size: 0.85rem; }
</style>
