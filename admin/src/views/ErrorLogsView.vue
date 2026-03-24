<template>
  <div>
    <div class="page-header">
      <h1>🚫 404 Error Tracker</h1>
      <div class="header-actions">
        <select v-model="days" @change="loadAll" class="filter-select">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <button class="btn btn-ghost" @click="clearResolved">🗑️ Clear Resolved</button>
        <button class="btn btn-ghost" @click="clearOld">🧹 Clear Old (90d)</button>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="stat-strip">
      <div class="stat-card glass">
        <div class="stat-num">{{ summary.total }}</div>
        <div class="stat-label">Total 404s</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num text-accent">{{ summary.unresolved }}</div>
        <div class="stat-label">Unresolved</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num text-green">{{ summary.unique }}</div>
        <div class="stat-label">Unique Paths</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num text-muted">{{ summary.resolved }}</div>
        <div class="stat-label">Resolved</div>
      </div>
    </div>

    <!-- Daily chart -->
    <div class="glass chart-card" v-if="daily.length">
      <h3 class="chart-title">Daily 404 Hits</h3>
      <div class="bar-chart">
        <div v-for="d in daily" :key="d.day" class="bar-col">
          <div class="bar-fill" :style="{ height: barHeight(d.hits) + '%' }" :title="`${d.day}: ${d.hits} hits`"></div>
          <div class="bar-label">{{ d.day.slice(5) }}</div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-nav">
      <button :class="['tab-btn', tab === 'top' && 'active']" @click="tab = 'top'">🔥 Top Paths</button>
      <button :class="['tab-btn', tab === 'all' && 'active']" @click="tab = 'all'">📋 All Logs</button>
      <button :class="['tab-btn', tab === 'referrers' && 'active']" @click="tab = 'referrers'">🔗 Referrers</button>
    </div>

    <!-- TOP PATHS -->
    <div v-if="tab === 'top'" class="glass table-wrap">
      <div class="loading-bar" v-if="loadingTop"></div>
      <table class="data-table" v-if="topPaths.length">
        <thead>
          <tr>
            <th>Path</th>
            <th>Hits</th>
            <th>Last Seen</th>
            <th>Redirect</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in topPaths" :key="row.path">
            <td><code class="path-code">{{ row.path }}</code></td>
            <td><span class="hit-badge">{{ row.hits }}</span></td>
            <td class="meta">{{ timeAgo(row.last_seen) }}</td>
            <td>
              <span v-if="row.existing_redirect" class="redir-badge" title="Redirect exists">
                → {{ row.existing_redirect }}
              </span>
              <span v-else class="no-redir meta">—</span>
            </td>
            <td>
              <span v-if="row.resolved" class="pill pill-green">✓ Resolved</span>
              <span v-else class="pill pill-red">Unresolved</span>
            </td>
            <td>
              <button class="icon-btn" @click="openResolve(row)" title="Resolve / Add Redirect">✅</button>
              <button class="icon-btn" @click="quickRedirect(row)" title="Quick: create redirect to homepage" v-if="!row.existing_redirect && !row.resolved">⚡</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" v-else-if="!loadingTop">No 404 paths logged in the selected period.</div>
    </div>

    <!-- ALL LOGS -->
    <div v-if="tab === 'all'">
      <div class="filter-bar">
        <input v-model="q" @input="debounce(loadLogs, 400)" placeholder="Search paths…" class="filter-input" />
        <select v-model="filterResolved" @change="loadLogs" class="filter-select">
          <option value="">All Status</option>
          <option value="0">Unresolved</option>
          <option value="1">Resolved</option>
        </select>
      </div>
      <div class="glass table-wrap">
        <div class="loading-bar" v-if="loadingLogs"></div>
        <table class="data-table" v-if="logs.length">
          <thead>
            <tr>
              <th>Path</th>
              <th>IP</th>
              <th>Referrer</th>
              <th>Time</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td><code class="path-code">{{ log.path }}</code></td>
              <td class="meta">{{ log.ip || '—' }}</td>
              <td class="meta truncate" :title="log.referrer">{{ truncate(log.referrer, 50) }}</td>
              <td class="meta">{{ timeAgo(log.created_at) }}</td>
              <td>
                <span v-if="log.resolved" class="pill pill-green">✓</span>
                <span v-else class="pill pill-red">×</span>
              </td>
              <td>
                <button class="icon-btn danger" @click="deleteLog(log.id)" title="Delete">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="empty-state" v-else-if="!loadingLogs">No logs found.</div>
        <div class="pagination" v-if="totalLogs > limitLogs">
          <button class="btn btn-ghost sm" :disabled="offsetLogs === 0" @click="prevPage">← Prev</button>
          <span class="meta">{{ offsetLogs + 1 }}–{{ Math.min(offsetLogs + limitLogs, totalLogs) }} of {{ totalLogs }}</span>
          <button class="btn btn-ghost sm" :disabled="offsetLogs + limitLogs >= totalLogs" @click="nextPage">Next →</button>
        </div>
      </div>
    </div>

    <!-- REFERRERS -->
    <div v-if="tab === 'referrers'" class="glass table-wrap">
      <div class="loading-bar" v-if="loadingRef"></div>
      <table class="data-table" v-if="referrers.length">
        <thead>
          <tr>
            <th>Referrer</th>
            <th>Hits</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in referrers" :key="r.referrer">
            <td><a :href="r.referrer" target="_blank" class="link">{{ r.referrer }}</a></td>
            <td><span class="hit-badge">{{ r.hits }}</span></td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" v-else-if="!loadingRef">No external referrers found.</div>
    </div>

    <!-- RESOLVE MODAL -->
    <div v-if="resolveModal" class="modal-overlay" @mousedown.self="resolveModal = false">
      <div class="modal-box glass">
        <h2>Resolve 404</h2>
        <p class="meta" style="margin-bottom:16px">Path: <code>{{ resolving?.path }}</code></p>
        <label>Redirect to (optional)</label>
        <input v-model="resolveTarget" placeholder="/new-path or https://example.com" class="form-input" />
        <label class="checkbox-label" style="margin-top:12px">
          <input type="checkbox" v-model="createRedirect" />
          Also create 301 redirect rule
        </label>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="resolveModal = false">Cancel</button>
          <button class="btn btn-primary" @click="doResolve">✅ Mark Resolved</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const days = ref('30')
const tab = ref('top')
const summary = ref({ total: 0, unresolved: 0, unique: 0, resolved: 0 })
const daily = ref([])
const topPaths = ref([])
const logs = ref([])
const referrers = ref([])
const totalLogs = ref(0)
const offsetLogs = ref(0)
const limitLogs = 50
const q = ref('')
const filterResolved = ref('')
const loadingTop = ref(false)
const loadingLogs = ref(false)
const loadingRef = ref(false)

const resolveModal = ref(false)
const resolving = ref(null)
const resolveTarget = ref('')
const createRedirect = ref(false)

let debounceTimer = null
function debounce(fn, ms) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fn, ms)
}

async function loadAll() {
  await Promise.all([loadSummary(), loadDaily(), loadTopPaths(), loadLogs(), loadReferrers()])
}

async function loadSummary() {
  const { data } = await api.get(`/error-logs/summary?days=${days.value}`)
  summary.value = data
}

async function loadDaily() {
  const { data } = await api.get(`/error-logs/daily?days=${days.value}`)
  daily.value = data
}

async function loadTopPaths() {
  loadingTop.value = true
  const { data } = await api.get(`/error-logs/top?days=${days.value}&limit=100`)
  topPaths.value = data
  loadingTop.value = false
}

async function loadLogs() {
  loadingLogs.value = true
  const params = new URLSearchParams({ days: days.value, limit: limitLogs, offset: offsetLogs.value })
  if (q.value) params.set('q', q.value)
  if (filterResolved.value !== '') params.set('resolved', filterResolved.value)
  const { data } = await api.get(`/error-logs?${params}`)
  logs.value = data.rows
  totalLogs.value = data.total
  loadingLogs.value = false
}

async function loadReferrers() {
  loadingRef.value = true
  const { data } = await api.get(`/error-logs/referrers?days=${days.value}`)
  referrers.value = data
  loadingRef.value = false
}

function barHeight(hits) {
  const max = Math.max(...daily.value.map(d => d.hits), 1)
  return Math.max(4, (hits / max) * 100)
}

function timeAgo(dt) {
  if (!dt) return '—'
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function truncate(str, n) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}

function openResolve(row) {
  resolving.value = row
  resolveTarget.value = ''
  createRedirect.value = false
  resolveModal.value = true
}

async function doResolve() {
  await api.put(`/error-logs/${resolving.value.id || 0}/resolve`, {
    redirect_to: resolveTarget.value || null,
    create_redirect: createRedirect.value
  })
  resolveModal.value = false
  await loadAll()
}

async function quickRedirect(row) {
  // Resolve with redirect to homepage
  resolving.value = row
  resolveTarget.value = '/'
  createRedirect.value = true
  await doResolve()
}

async function deleteLog(id) {
  await api.delete(`/error-logs/${id}`)
  await loadLogs()
}

async function clearResolved() {
  if (!confirm('Delete all resolved 404 logs?')) return
  await api.delete(`/error-logs?resolved=1`)
  await loadAll()
}

async function clearOld() {
  if (!confirm('Delete all 404 logs older than 90 days?')) return
  await api.delete(`/error-logs?days=90`)
  await loadAll()
}

function prevPage() { offsetLogs.value -= limitLogs; loadLogs() }
function nextPage() { offsetLogs.value += limitLogs; loadLogs() }

onMounted(loadAll)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { padding: 20px; border-radius: 1rem; text-align: center; }
.stat-num { font-size: 2rem; font-weight: 800; }
.stat-label { font-size: 12px; opacity: 0.6; margin-top: 4px; }
.text-accent { color: var(--accent); }
.text-green { color: #10b981; }
.text-muted { opacity: 0.5; }

.chart-card { padding: 20px; border-radius: 1rem; margin-bottom: 24px; }
.chart-title { font-size: 13px; font-weight: 600; opacity: 0.7; margin-bottom: 12px; }
.bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 120px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.bar-fill { width: 100%; background: var(--accent); border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s; }
.bar-label { font-size: 9px; opacity: 0.5; white-space: nowrap; }

.tabs-nav { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.tab-btn { background: none; border: none; color: inherit; padding: 10px 18px; cursor: pointer; opacity: 0.6; font-size: 13px; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tab-btn.active { opacity: 1; border-bottom-color: var(--accent); font-weight: 600; }

.filter-bar { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.filter-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: inherit; min-width: 200px; flex: 1; }
.filter-select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: inherit; }

.table-wrap { border-radius: 1rem; overflow: hidden; margin-bottom: 24px; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { background: rgba(255,255,255,0.04); padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6; text-align: left; }
.data-table td { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }

.path-code { font-family: monospace; font-size: 12px; background: rgba(255,255,255,0.07); padding: 2px 6px; border-radius: 4px; word-break: break-all; }
.hit-badge { background: var(--accent); color: white; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.redir-badge { background: rgba(16,185,129,0.15); color: #10b981; font-size: 11px; padding: 2px 8px; border-radius: 4px; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
.pill-green { background: rgba(16,185,129,0.15); color: #10b981; }
.pill-red { background: rgba(239,68,68,0.15); color: #ef4444; }
.meta { opacity: 0.55; font-size: 12px; }
.truncate { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link { color: var(--accent); text-decoration: none; word-break: break-all; }
.icon-btn { background: none; border: none; cursor: pointer; font-size: 15px; padding: 4px; border-radius: 4px; opacity: 0.7; transition: opacity 0.2s; }
.icon-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }
.icon-btn.danger:hover { background: rgba(239,68,68,0.15); }
.no-redir { opacity: 0.3; }
.loading-bar { height: 3px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: slide 1.2s infinite; }
@keyframes slide { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
.empty-state { padding: 40px; text-align: center; opacity: 0.4; }
.pagination { display: flex; align-items: center; gap: 12px; padding: 12px 14px; justify-content: center; }
.btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-primary { background: var(--accent); color: white; }
.btn-ghost { background: rgba(255,255,255,0.07); color: inherit; }
.btn.sm { padding: 5px 12px; font-size: 12px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { padding: 28px; border-radius: 1.5rem; width: 460px; max-width: 95vw; }
.modal-box h2 { margin-bottom: 12px; }
label { display: block; font-size: 12px; opacity: 0.7; margin-bottom: 6px; }
.form-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 9px 12px; color: inherit; font-size: 13px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; opacity: 0.9; cursor: pointer; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
