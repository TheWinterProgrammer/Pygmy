<template>
  <div class="analytics-view">
    <div class="view-header">
      <h1>📈 Analytics</h1>
      <div class="header-controls">
        <select v-model="days" @change="loadAll" class="glass-select">
          <option :value="7">Last 7 days</option>
          <option :value="30">Last 30 days</option>
          <option :value="90">Last 90 days</option>
        </select>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="stats-grid" v-if="summary">
      <div class="stat-card glass">
        <div class="stat-icon">👁️</div>
        <div class="stat-body">
          <div class="stat-value">{{ fmt(summary.total) }}</div>
          <div class="stat-label">Total page views</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">📅</div>
        <div class="stat-body">
          <div class="stat-value">{{ fmt(summary.today) }}</div>
          <div class="stat-label">Today</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">📆</div>
        <div class="stat-body">
          <div class="stat-value">{{ fmt(summary.week) }}</div>
          <div class="stat-label">Last 7 days</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">🗓️</div>
        <div class="stat-body">
          <div class="stat-value">{{ fmt(summary.month) }}</div>
          <div class="stat-label">Last 30 days</div>
        </div>
      </div>
    </div>

    <!-- Daily chart -->
    <div class="glass chart-card" v-if="daily.length">
      <h2>Views over time <span class="muted">({{ days }}d)</span></h2>
      <div class="bar-chart">
        <div
          v-for="d in daily"
          :key="d.date"
          class="bar-wrap"
          :title="`${d.date}: ${d.views} views`"
        >
          <div
            class="bar"
            :style="{ height: barHeight(d.views) + '%' }"
          ></div>
          <div class="bar-label" v-if="daily.length <= 14 || d.date.endsWith('-01') || d.date === daily[daily.length-1].date">
            {{ shortDate(d.date) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Top pages -->
    <div class="two-col">
      <!-- Top posts -->
      <div class="glass top-card">
        <h2>🔝 Top Posts</h2>
        <div v-if="topPosts.length === 0" class="empty">No post views yet</div>
        <table v-else class="top-table">
          <thead><tr><th>Title</th><th>Views</th></tr></thead>
          <tbody>
            <tr v-for="r in topPosts" :key="r.entity_id">
              <td>
                <a :href="`http://localhost:5174/blog/${r.entity_slug}`" target="_blank" class="accent-link">
                  {{ r.entity_title || r.entity_slug }}
                </a>
              </td>
              <td class="views-cell">{{ fmt(r.total_views) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Top pages -->
      <div class="glass top-card">
        <h2>🔝 Top Pages</h2>
        <div v-if="topPages.length === 0" class="empty">No page views yet</div>
        <table v-else class="top-table">
          <thead><tr><th>Title</th><th>Views</th></tr></thead>
          <tbody>
            <tr v-for="r in topPages" :key="r.entity_id">
              <td>
                <a :href="`http://localhost:5174/${r.entity_slug}`" target="_blank" class="accent-link">
                  {{ r.entity_title || r.entity_slug }}
                </a>
              </td>
              <td class="views-cell">{{ fmt(r.total_views) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Top products -->
    <div class="glass top-card" v-if="topProducts.length">
      <h2>🔝 Top Products</h2>
      <table class="top-table">
        <thead><tr><th>Name</th><th>Views</th></tr></thead>
        <tbody>
          <tr v-for="r in topProducts" :key="r.entity_id">
            <td>
              <a :href="`http://localhost:5174/shop/${r.entity_slug}`" target="_blank" class="accent-link">
                {{ r.entity_title || r.entity_slug }}
              </a>
            </td>
            <td class="views-cell">{{ fmt(r.total_views) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- By type breakdown -->
    <div class="glass breakdown-card" v-if="summary && summary.byType.length">
      <h2>Views by content type</h2>
      <div class="type-bars">
        <div
          v-for="t in summary.byType"
          :key="t.entity_type"
          class="type-row"
        >
          <div class="type-label">{{ t.entity_type }}</div>
          <div class="type-track">
            <div class="type-fill" :style="{ width: typePercent(t.views) + '%' }"></div>
          </div>
          <div class="type-val">{{ fmt(t.views) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const days = ref(30)

const summary = ref(null)
const daily = ref([])
const topAll = ref([])

const topPosts    = computed(() => topAll.value.filter(r => r.entity_type === 'post'))
const topPages    = computed(() => topAll.value.filter(r => r.entity_type === 'page'))
const topProducts = computed(() => topAll.value.filter(r => r.entity_type === 'product'))

const maxViews = computed(() => Math.max(...daily.value.map(d => d.views), 1))

function barHeight(v) {
  return Math.max(2, Math.round((v / maxViews.value) * 100))
}

function typePercent(v) {
  const max = Math.max(...(summary.value?.byType?.map(t => t.views) || [1]))
  return Math.round((v / max) * 100)
}

function shortDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function fmt(n) {
  return Number(n).toLocaleString()
}

async function api(path) {
  const res = await fetch(`http://localhost:3200${path}`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  return res.json()
}

async function loadAll() {
  const [sum, dly, top] = await Promise.all([
    api('/api/analytics/summary'),
    api(`/api/analytics/daily?days=${days.value}`),
    api(`/api/analytics/top?days=${days.value}&limit=10`),
  ])
  summary.value = sum
  daily.value = dly
  topAll.value = top
}

onMounted(loadAll)
</script>

<style scoped>
.analytics-view { padding: 2rem; max-width: 1200px; }

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
.view-header h1 { margin: 0; font-size: 1.6rem; }

.glass-select {
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text);
  border-radius: 0.5rem;
  padding: 0.4rem 0.8rem;
  font-family: inherit;
  cursor: pointer;
}

/* ── Stats grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.stat-card {
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.stat-icon { font-size: 2rem; }
.stat-value { font-size: 1.8rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.8rem; color: var(--muted); }

/* ── Chart ── */
.chart-card {
  border-radius: 1.2rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.chart-card h2 { margin: 0 0 1rem; font-size: 1rem; }
.muted { font-weight: 400; color: var(--muted); font-size: 0.85rem; }

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 120px;
  overflow-x: auto;
  padding-bottom: 1.5rem;
  position: relative;
}
.bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 8px;
  height: 100%;
  justify-content: flex-end;
  position: relative;
}
.bar {
  width: 100%;
  background: var(--accent);
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  opacity: 0.8;
  transition: opacity 0.2s;
}
.bar-wrap:hover .bar { opacity: 1; }
.bar-label {
  position: absolute;
  bottom: -1.4rem;
  font-size: 0.6rem;
  color: var(--muted);
  white-space: nowrap;
}

/* ── Two-col top tables ── */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
@media(max-width:700px) { .two-col { grid-template-columns: 1fr; } }

.top-card {
  border-radius: 1.2rem;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.top-card h2 { margin: 0 0 1rem; font-size: 1rem; }
.empty { color: var(--muted); font-size: 0.85rem; }

.top-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.top-table th { text-align: left; color: var(--muted); padding-bottom: 0.5rem; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.06); }
.top-table td { padding: 0.4rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.views-cell { text-align: right; color: var(--accent); font-weight: 600; }
.accent-link { color: var(--text); text-decoration: none; }
.accent-link:hover { color: var(--accent); }

/* ── Breakdown ── */
.breakdown-card {
  border-radius: 1.2rem;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.breakdown-card h2 { margin: 0 0 1rem; font-size: 1rem; }
.type-bars { display: flex; flex-direction: column; gap: 0.75rem; }
.type-row { display: flex; align-items: center; gap: 0.75rem; }
.type-label { width: 70px; font-size: 0.8rem; color: var(--muted); text-transform: capitalize; }
.type-track { flex: 1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
.type-fill { height: 100%; background: var(--accent); border-radius: 99px; }
.type-val { width: 50px; text-align: right; font-size: 0.85rem; color: var(--accent); font-weight: 600; }
</style>
