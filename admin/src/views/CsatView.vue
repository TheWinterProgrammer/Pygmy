<template>
  <div>
    <div class="page-header">
      <h1>😊 CSAT Ratings</h1>
      <p class="subtitle">Customer satisfaction feedback collected from the public site</p>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="summary">
      <div class="stat-card accent">
        <div class="stat-value">{{ summary.totals?.total ?? 0 }}</div>
        <div class="stat-label">Total Ratings</div>
      </div>
      <div class="stat-card" :style="satStyle">
        <div class="stat-value">{{ summary.satisfaction_score != null ? summary.satisfaction_score + '%' : '—' }}</div>
        <div class="stat-label">Satisfaction Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmtRating(summary.totals?.avg_rating) }}</div>
        <div class="stat-label">Avg Rating</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.totals?.positive ?? 0 }}</div>
        <div class="stat-label">👍 Positive</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.totals?.negative ?? 0 }}</div>
        <div class="stat-label">👎 Negative</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.totals?.with_comment ?? 0 }}</div>
        <div class="stat-label">With Comment</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-row" v-if="summary">
      <!-- Rating distribution -->
      <div class="glass card-section" style="flex:0 0 300px">
        <h3 style="margin:0 0 1rem">Rating Distribution</h3>
        <div class="dist-bars">
          <div v-for="d in filledDistribution" :key="d.rating" class="dist-row">
            <span class="dist-label">{{ ratingLabel(d.rating) }}</span>
            <div class="dist-bar-wrap">
              <div class="dist-bar" :style="{ width: distPct(d.count) + '%', background: ratingColor(d.rating) }"></div>
            </div>
            <span class="dist-count">{{ d.count }}</span>
          </div>
        </div>
      </div>

      <!-- Daily chart -->
      <div class="glass card-section" style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <h3 style="margin:0">Daily Ratings</h3>
          <select class="filter-select" v-model="days" @change="load">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
        <div class="bar-chart" v-if="chartData.length">
          <div v-for="d in chartData" :key="d.day" class="bar-col" :title="d.day + ': ' + d.total + ' ratings'">
            <div class="bar-fill" :style="{ height: barHeight(d.total) + 'px', background: barGradient(d.avg_rating) }"></div>
            <div class="bar-label">{{ d.day.slice(5) }}</div>
          </div>
        </div>
        <div v-else class="empty-state" style="padding:2rem">No data yet</div>
      </div>
    </div>

    <!-- Top pages + Recent comments -->
    <div class="two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem">
      <!-- Top pages -->
      <div class="glass card-section">
        <h3 style="margin:0 0 1rem">Top Pages</h3>
        <div v-if="summary?.topPages?.length">
          <div v-for="p in summary.topPages" :key="p.page_path" class="page-row">
            <div class="page-path">{{ p.page_path }}</div>
            <div class="page-meta">
              <span class="badge" :style="{ background: ratingColor(Math.round(p.avg_rating)) }">
                {{ fmtRating(p.avg_rating) }} ★
              </span>
              <span class="muted">{{ p.total }} ratings</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">No data yet</div>
      </div>

      <!-- Recent comments -->
      <div class="glass card-section">
        <h3 style="margin:0 0 1rem">Recent Comments</h3>
        <div v-if="summary?.recentComments?.length">
          <div v-for="c in summary.recentComments" :key="c.id" class="comment-row">
            <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.3rem">
              <span style="font-size:1.1rem">{{ ratingEmoji(c.rating) }}</span>
              <span class="muted" style="font-size:.8rem">{{ c.page_path }}</span>
              <span class="muted" style="font-size:.8rem;margin-left:auto">{{ timeAgo(c.created_at) }}</span>
              <button class="btn-icon danger" @click="deleteRating(c.id)" title="Delete">🗑️</button>
            </div>
            <p style="margin:0;font-size:.9rem;opacity:.85">{{ c.comment }}</p>
          </div>
        </div>
        <div v-else class="empty-state">No comments yet</div>
      </div>
    </div>

    <!-- Settings hint -->
    <div class="glass card-section" style="margin-top:1.5rem">
      <h3 style="margin:0 0 .75rem">⚙️ Configuration</h3>
      <p style="margin:0;opacity:.7">
        Enable and configure the CSAT widget from
        <RouterLink to="/settings" style="color:var(--accent)">Settings → 😊 CSAT Widget</RouterLink>.
        The widget appears on all public pages after a configurable delay.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const summary = ref(null)
const days = ref('30')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const r = await fetch(`/api/csat/summary?days=${days.value}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    summary.value = await r.json()
  } finally {
    loading.value = false
  }
}

async function deleteRating(id) {
  if (!confirm('Delete this rating?')) return
  await fetch(`/api/csat/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  await load()
}

onMounted(load)

// Chart helpers
const chartData = computed(() => summary.value?.daily ?? [])
const maxTotal = computed(() => Math.max(...chartData.value.map(d => d.total), 1))

function barHeight(v) { return Math.max(4, Math.round((v / maxTotal.value) * 80)) }
function barGradient(avg) {
  if (!avg) return 'rgba(255,255,255,0.15)'
  if (avg >= 4) return 'linear-gradient(to top, #22c55e, #4ade80)'
  if (avg >= 3) return 'linear-gradient(to top, #f59e0b, #fbbf24)'
  return 'linear-gradient(to top, #ef4444, #f87171)'
}

// Distribution helpers
const filledDistribution = computed(() => {
  const map = {}
  for (const d of summary.value?.distribution ?? []) map[d.rating] = d.count
  return [5, 4, 3, 2, 1].map(r => ({ rating: r, count: map[r] ?? 0 }))
})
const maxDist = computed(() => Math.max(...filledDistribution.value.map(d => d.count), 1))
function distPct(v) { return Math.round((v / maxDist.value) * 100) }

function ratingColor(r) {
  if (r >= 4) return '#22c55e'
  if (r >= 3) return '#f59e0b'
  return '#ef4444'
}
function ratingLabel(r) {
  const m = { 5: '★★★★★', 4: '★★★★', 3: '★★★', 2: '★★', 1: '★' }
  return m[r] ?? r
}
function ratingEmoji(r) {
  if (r >= 4) return '😊'
  if (r === 3) return '😐'
  return '😞'
}
function fmtRating(v) {
  if (!v) return '—'
  return Number(v).toFixed(1)
}
function timeAgo(dt) {
  if (!dt) return ''
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'just now'
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  return Math.floor(h / 24) + 'd ago'
}
const satStyle = computed(() => {
  const s = summary.value?.satisfaction_score
  if (s == null) return {}
  if (s >= 70) return { borderColor: '#22c55e33' }
  if (s >= 40) return { borderColor: '#f59e0b33' }
  return { borderColor: '#ef444433' }
})
</script>

<style scoped>
.stats-strip { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { padding: 1rem 1.25rem; background: var(--surface); border-radius: 1rem; border: 1px solid rgba(255,255,255,0.08); min-width: 100px; }
.stat-card.accent { border-color: var(--accent); }
.stat-value { font-size: 1.6rem; font-weight: 700; }
.stat-label { font-size: .75rem; opacity: .6; margin-top: .15rem; }
.charts-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.card-section { padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.08); }
.dist-bars { display: flex; flex-direction: column; gap: .6rem; }
.dist-row { display: flex; align-items: center; gap: .5rem; font-size: .85rem; }
.dist-label { width: 60px; text-align: right; opacity: .7; }
.dist-bar-wrap { flex: 1; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
.dist-bar { height: 100%; border-radius: 4px; transition: width .4s; }
.dist-count { width: 28px; text-align: right; opacity: .6; }
.bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 100px; }
.bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; }
.bar-fill { width: 100%; border-radius: 3px 3px 0 0; min-height: 4px; transition: height .3s; }
.bar-label { font-size: .55rem; opacity: .5; margin-top: 2px; }
.page-row { display: flex; justify-content: space-between; align-items: center; padding: .6rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.page-row:last-child { border-bottom: none; }
.page-path { font-size: .85rem; font-family: monospace; opacity: .9; }
.page-meta { display: flex; gap: .5rem; align-items: center; }
.badge { padding: .15rem .5rem; border-radius: .5rem; font-size: .75rem; font-weight: 600; color: #fff; }
.muted { opacity: .5; font-size: .8rem; }
.comment-row { padding: .75rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.comment-row:last-child { border-bottom: none; }
.btn-icon { background: none; border: none; cursor: pointer; padding: .1rem .25rem; border-radius: .3rem; opacity: .5; }
.btn-icon:hover { opacity: 1; }
.empty-state { text-align: center; opacity: .4; padding: 1rem; }
.filter-select { background: var(--surface); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: .35rem .75rem; border-radius: .5rem; font-size: .85rem; cursor: pointer; }
</style>
