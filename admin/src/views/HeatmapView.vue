<template>
  <div class="heatmap-view">
    <div class="page-header">
      <h1>🔥 Click Heatmaps</h1>
      <p class="subtitle">See where visitors click on each page. Track engagement and discover dead zones.</p>
    </div>

    <div class="controls">
      <label>Period:</label>
      <select v-model="days" @change="loadPages">
        <option value="7">Last 7 days</option>
        <option value="14">Last 14 days</option>
        <option value="30">Last 30 days</option>
        <option value="60">Last 60 days</option>
        <option value="90">Last 90 days</option>
      </select>
      <button class="btn btn-ghost btn-sm" @click="loadPages">🔄 Refresh</button>
      <button class="btn btn-ghost btn-sm" @click="confirmPurge">🗑️ Purge Old (>90d)</button>
    </div>

    <!-- Summary Stats -->
    <div class="stats-grid" v-if="stats">
      <div class="stat-card">
        <span class="stat-num">{{ stats.total.toLocaleString() }}</span>
        <span class="stat-label">Total Clicks</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ stats.sessions.toLocaleString() }}</span>
        <span class="stat-label">Unique Sessions</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ stats.pages }}</span>
        <span class="stat-label">Pages Tracked</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ stats.total > 0 ? Math.round(stats.total / Math.max(stats.sessions, 1)) : 0 }}</span>
        <span class="stat-label">Avg Clicks/Session</span>
      </div>
    </div>

    <div class="two-col">
      <!-- Pages List -->
      <div class="glass-card pages-list-card">
        <h3>Pages</h3>
        <div v-if="!pages.length" class="empty-hint">
          No click data yet. Add the tracking script to your frontend.
        </div>
        <div v-for="p in pages" :key="p.page_path"
          :class="['page-row', { active: selectedPath === p.page_path }]"
          @click="selectPage(p.page_path)">
          <div class="page-path">{{ p.page_path }}</div>
          <div class="page-meta">
            <span class="badge">{{ p.clicks.toLocaleString() }} clicks</span>
            <span class="badge-muted">{{ p.sessions }} sessions</span>
          </div>
        </div>
      </div>

      <!-- Heatmap Display -->
      <div class="glass-card heatmap-card">
        <div v-if="!selectedPath" class="empty-hint centered">
          ← Select a page to view its heatmap
        </div>

        <div v-else>
          <div class="heatmap-header">
            <div>
              <h3>{{ selectedPath }}</h3>
              <p class="meta">{{ heatmapData?.total?.toLocaleString() || 0 }} clicks tracked</p>
            </div>
            <div class="heatmap-controls">
              <label style="font-size:.8rem;color:var(--text-muted)">Resolution:</label>
              <select v-model="resolution" @change="loadHeatmap()" class="ctrl-select">
                <option value="10">10×10</option>
                <option value="20">20×20</option>
                <option value="30">30×30</option>
              </select>
            </div>
          </div>

          <div v-if="loadingHeatmap" class="loading-hint">Loading heatmap…</div>

          <div v-else-if="heatmapData">
            <!-- Color scale legend -->
            <div class="legend">
              <span class="leg-low">Low</span>
              <div class="legend-bar"></div>
              <span class="leg-high">High</span>
            </div>

            <!-- Grid -->
            <div class="heatmap-grid-wrap">
              <div class="heatmap-grid"
                :style="{ gridTemplateColumns: `repeat(${heatmapData.resolution}, 1fr)`, gridTemplateRows: `repeat(${heatmapData.resolution}, 1fr)` }">
                <div v-for="(row, ri) in heatmapData.grid" :key="ri"
                  v-for-alias="row"
                  class="grid-row-fragment">
                  <div v-for="(val, ci) in row" :key="ci"
                    class="heatmap-cell"
                    :style="cellStyle(val)"
                    :title="`(${Math.round(ci/heatmapData.resolution*100)}%,${Math.round(ri/heatmapData.resolution*100)}%): ${Math.round(val*100)}% density`">
                  </div>
                </div>
              </div>
            </div>

            <!-- Hotspots -->
            <div v-if="heatmapData.hotspots?.length" class="hotspots">
              <h4>🔥 Top Click Areas</h4>
              <div class="hotspot-list">
                <div v-for="(hs, i) in heatmapData.hotspots.slice(0, 5)" :key="i" class="hotspot-item">
                  <span class="hs-rank">#{{ i+1 }}</span>
                  <span class="hs-pos">X: {{ Math.round(hs.x / heatmapData.resolution * 100) }}% — Y: {{ Math.round(hs.y / heatmapData.resolution * 100) }}%</span>
                  <span class="hs-count">{{ hs.count }} clicks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Setup Guide -->
    <div class="glass-card setup-card">
      <h3>🛠️ Setup</h3>
      <p>Add this snippet to your public frontend (e.g. in <code>App.vue</code>) to enable click tracking:</p>
      <div class="code-block">
        <button class="copy-btn" @click="copyCode">{{ copied ? '✓ Copied' : 'Copy' }}</button>
        <pre>{{ trackingCode }}</pre>
      </div>
      <p class="hint">The tracker records clicks as percentages of viewport size — resolution-independent. Sampling rate can be configured in Settings → Heatmap.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api.js'

const days = ref('30')
const pages = ref([])
const stats = ref(null)
const selectedPath = ref('')
const heatmapData = ref(null)
const loadingHeatmap = ref(false)
const resolution = ref('20')
const copied = ref(false)

const trackingCode = `// Pygmy Click Heatmap — add to App.vue or main.js
const PYGMY_API = import.meta.env.VITE_API_URL || 'http://localhost:3200/api'
const hmSession = localStorage.getItem('pygmy_session') || crypto.randomUUID()
localStorage.setItem('pygmy_session', hmSession)

document.addEventListener('click', (e) => {
  const xPct = (e.clientX / window.innerWidth * 100).toFixed(2)
  const yOffsetPct = ((e.clientY + window.scrollY) / document.body.scrollHeight * 100).toFixed(2)
  fetch(PYGMY_API + '/heatmap/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page_path: window.location.pathname,
      x_pct: xPct,
      y_pct: yOffsetPct,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      session_id: hmSession,
    }),
    keepalive: true,
  }).catch(() => {})
})`

onMounted(async () => {
  await Promise.all([loadPages(), loadStats()])
})

async function loadPages() {
  const { data } = await api.get('/heatmap/pages', { params: { days: days.value } })
  pages.value = data
  await loadStats()
}

async function loadStats() {
  const { data } = await api.get('/heatmap/stats', { params: { days: days.value } })
  stats.value = data
}

async function selectPage(path) {
  selectedPath.value = path
  await loadHeatmap()
}

async function loadHeatmap() {
  if (!selectedPath.value) return
  loadingHeatmap.value = true
  try {
    const { data } = await api.get('/heatmap/data', {
      params: { path: selectedPath.value, days: days.value, resolution: resolution.value }
    })
    heatmapData.value = data
  } finally {
    loadingHeatmap.value = false
  }
}

function cellStyle(val) {
  if (val === 0) return { background: 'rgba(0,0,0,0)' }
  // Heat map: blue (low) → yellow → red (high)
  const r = Math.round(val * 255)
  const g = Math.round((1 - Math.abs(val - 0.5) * 2) * 200)
  const b = Math.round((1 - val) * 255)
  return { background: `rgba(${r},${g},${b},${0.15 + val * 0.75})` }
}

async function confirmPurge() {
  if (!confirm('Purge all heatmap clicks older than 90 days?')) return
  const { data } = await api.delete('/heatmap/purge', { params: { days: 90 } })
  alert(`Purged ${data.deleted} records.`)
  loadPages()
}

function copyCode() {
  navigator.clipboard.writeText(trackingCode)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped>
.heatmap-view { max-width: 1100px; }
.page-header { margin-bottom: 1.5rem; }
.page-header h1 { margin: 0; }
.subtitle { color: var(--text-muted); margin: 0.25rem 0 0; }

.controls { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.controls label { color: var(--text-muted); font-size: 0.9rem; }
.controls select { background: var(--surface); border: 1px solid rgba(255,255,255,0.1); color: var(--text); padding: 0.4rem 0.75rem; border-radius: 0.5rem; }

.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1.25rem 1rem; text-align: center; }
.stat-num { display: block; font-size: 1.6rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: var(--text-muted); }

.two-col { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
.glass-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1.5rem; }
.glass-card h3 { margin: 0 0 1rem; font-size: 1rem; }

/* Pages list */
.pages-list-card { overflow-y: auto; max-height: 600px; }
.page-row { padding: 0.6rem 0.75rem; border-radius: 0.5rem; cursor: pointer; transition: background .15s; margin-bottom: 2px; }
.page-row:hover { background: rgba(255,255,255,0.05); }
.page-row.active { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); }
.page-path { font-size: 0.85rem; font-family: monospace; word-break: break-all; }
.page-meta { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.badge { background: rgba(255,255,255,0.08); padding: 0.1rem 0.5rem; border-radius: 0.3rem; font-size: 0.72rem; }
.badge-muted { color: var(--text-muted); font-size: 0.72rem; }

/* Heatmap */
.heatmap-card { }
.heatmap-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.heatmap-header h3 { margin: 0; font-size: 0.9rem; font-family: monospace; word-break: break-all; }
.meta { font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0; }
.heatmap-controls { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.ctrl-select { background: var(--surface); border: 1px solid rgba(255,255,255,0.1); color: var(--text); padding: 0.3rem 0.6rem; border-radius: 0.4rem; font-size: 0.8rem; }

.legend { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; font-size: 0.75rem; color: var(--text-muted); }
.legend-bar { flex: 1; max-width: 120px; height: 8px; border-radius: 4px; background: linear-gradient(to right, rgba(0,0,255,0.5), rgba(255,255,0,0.7), rgba(255,0,0,0.9)); }
.leg-low { font-size: 0.72rem; }
.leg-high { font-size: 0.72rem; }

.heatmap-grid-wrap { width: 100%; overflow: hidden; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.07); }
.heatmap-grid {
  display: grid;
  width: 100%;
  aspect-ratio: 16/9;
}
/* Each grid row spans full width */
.grid-row-fragment { display: contents; }
.heatmap-cell { min-width: 0; min-height: 0; transition: background .3s; }

.hotspots { margin-top: 1rem; }
.hotspots h4 { font-size: 0.85rem; margin: 0 0 0.5rem; }
.hotspot-list { display: flex; flex-direction: column; gap: 0.35rem; }
.hotspot-item { display: flex; align-items: center; gap: 0.75rem; font-size: 0.82rem; }
.hs-rank { width: 24px; font-weight: 700; color: var(--accent); }
.hs-pos { flex: 1; font-family: monospace; color: var(--text-muted); }
.hs-count { font-weight: 600; }

/* Setup */
.setup-card { margin-bottom: 1.5rem; }
.setup-card p { color: var(--text-muted); font-size: 0.85rem; margin: 0 0 0.75rem; }
.hint { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.5rem !important; }
code { background: rgba(255,255,255,0.07); padding: 0.1rem 0.4rem; border-radius: 0.3rem; font-size: 0.8rem; }
.code-block { position: relative; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; overflow: hidden; }
.code-block pre { margin: 0; padding: 1rem; font-size: 0.75rem; color: #a0e0ff; overflow-x: auto; }
.copy-btn { position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: var(--text); border-radius: 0.4rem; padding: 0.25rem 0.75rem; font-size: 0.78rem; cursor: pointer; }

.empty-hint { text-align: center; color: var(--text-muted); padding: 2rem; font-size: 0.9rem; }
.empty-hint.centered { display: flex; align-items: center; justify-content: center; min-height: 300px; }
.loading-hint { text-align: center; color: var(--text-muted); padding: 2rem; }

.btn { padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; cursor: pointer; font-size: 0.9rem; transition: all .2s; }
.btn-ghost { background: rgba(255,255,255,0.07); color: var(--text); border: 1px solid rgba(255,255,255,0.1); }
.btn-sm { padding: 0.35rem 0.9rem; font-size: 0.82rem; }

@media (max-width: 700px) {
  .two-col { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
}
</style>
