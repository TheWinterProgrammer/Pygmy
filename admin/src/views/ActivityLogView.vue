<template>
  <div>
    <div class="page-header">
      <h1>🕐 Activity Log</h1>
      <div style="display:flex;gap:.5rem;">
        <button class="btn btn-ghost btn-sm" @click="exportCsv" :disabled="exportLoading">
          {{ exportLoading ? 'Exporting…' : '⬇️ Export CSV' }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="fetchActivity">↺ Refresh</button>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar glass">
      <input v-model="q" @input="debounceFetch" placeholder="Search action, entity, user…" class="input filter-input" />
      <select v-model="entityFilter" @change="fetchActivity" class="input filter-select">
        <option value="">All Types</option>
        <option value="post">Posts</option>
        <option value="page">Pages</option>
        <option value="product">Products</option>
        <option value="media">Media</option>
        <option value="comment">Comments</option>
        <option value="user">Users</option>
        <option value="redirect">Redirects</option>
        <option value="event">Events</option>
        <option value="gift_card">Gift Cards</option>
        <option value="order">Orders</option>
        <option value="coupon">Coupons</option>
      </select>
      <select v-model="actionFilter" @change="fetchActivity" class="input filter-select">
        <option value="">All Actions</option>
        <option value="create">Create</option>
        <option value="update">Update</option>
        <option value="delete">Delete</option>
        <option value="publish">Publish</option>
        <option value="status_change">Status Change</option>
      </select>
    </div>

    <!-- Log table -->
    <div class="glass table-wrap">
      <div v-if="loading" class="loading-bar"></div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>When</th>
            <th>User</th>
            <th>Action</th>
            <th>Type</th>
            <th>Entity</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!log.length">
            <td colspan="5" class="empty">No activity found.</td>
          </tr>
          <tr v-for="item in log" :key="item.id">
            <td class="text-muted small" :title="new Date(item.created_at).toLocaleString()">{{ timeAgo(item.created_at) }}</td>
            <td>
              <div class="user-chip">
                <span class="user-avatar">{{ (item.user_name || 'S').charAt(0).toUpperCase() }}</span>
                <span>{{ item.user_name || 'system' }}</span>
              </div>
            </td>
            <td><span :class="['action-pill', item.action]">{{ item.action }}</span></td>
            <td class="text-muted small">{{ item.entity_type || '—' }}</td>
            <td>
              <span v-if="item.entity_title" class="entity-title">{{ item.entity_title }}</span>
              <span v-else class="text-muted">—</span>
              <span v-if="item.entity_id" class="entity-id text-muted">#{{ item.entity_id }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="total > perPage">
      <button class="btn btn-ghost btn-sm" :disabled="offset === 0" @click="prev">← Prev</button>
      <span class="pag-info">{{ offset + 1 }}–{{ Math.min(offset + perPage, total) }} of {{ total }}</span>
      <button class="btn btn-ghost btn-sm" :disabled="offset + perPage >= total" @click="next">Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const log = ref([])
const total = ref(0)
const loading = ref(false)
const exportLoading = ref(false)
const q = ref('')
const entityFilter = ref('')
const actionFilter = ref('')
const offset = ref(0)
const perPage = 50

async function exportCsv() {
  exportLoading.value = true
  try {
    const params = {}
    if (q.value) params.q = q.value
    if (entityFilter.value) params.entity_type = entityFilter.value
    if (actionFilter.value) params.action = actionFilter.value
    const res = await api.get('/activity/export/csv', { params, responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-log-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch {} finally {
    exportLoading.value = false
  }
}

let debounceTimer = null
function debounceFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { offset.value = 0; fetchActivity() }, 350)
}

function timeAgo(dateStr) {
  const now = new Date()
  const then = new Date(dateStr)
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

async function fetchActivity() {
  loading.value = true
  try {
    const params = { limit: perPage, offset: offset.value }
    if (q.value) params.q = q.value
    if (entityFilter.value) params.entity_type = entityFilter.value
    if (actionFilter.value) params.action = actionFilter.value
    const { data } = await api.get('/activity', { params })
    // Support both array (old) and paginated (new)
    if (Array.isArray(data)) {
      log.value = data
      total.value = data.length
    } else {
      log.value = data.log || data.items || []
      total.value = data.total || log.value.length
    }
  } catch {
    log.value = []
  } finally {
    loading.value = false
  }
}

function prev() { offset.value = Math.max(0, offset.value - perPage); fetchActivity() }
function next() { offset.value += perPage; fetchActivity() }

onMounted(fetchActivity)
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }

.filter-bar { display: flex; gap: 0.75rem; padding: 0.85rem 1rem; margin-bottom: 1rem; border-radius: var(--radius); flex-wrap: wrap; }
.filter-input { flex: 1; min-width: 200px; }
.filter-select { min-width: 140px; }

.table-wrap { border-radius: var(--radius); overflow: hidden; margin-bottom: 1rem; }
.table { width: 100%; border-collapse: collapse; }
.table th { padding: 0.6rem 0.85rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); text-align: left; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border); }
.table td { padding: 0.7rem 0.85rem; border-bottom: 1px solid var(--border); font-size: 0.875rem; vertical-align: middle; }
.table tr:last-child td { border-bottom: none; }
.empty { text-align: center; color: var(--text-muted); padding: 2rem !important; }

.text-muted { color: var(--text-muted); }
.small { font-size: 0.8rem; }

.user-chip { display: flex; align-items: center; gap: 0.5rem; }
.user-avatar { width: 24px; height: 24px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: #fff; flex-shrink: 0; }

.action-pill { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.action-pill.create { background: rgba(74,222,128,0.15); color: #4ade80; }
.action-pill.update { background: rgba(96,165,250,0.15); color: #60a5fa; }
.action-pill.delete { background: rgba(239,68,68,0.15); color: #ef4444; }
.action-pill.publish { background: rgba(167,139,250,0.15); color: #a78bfa; }
.action-pill.status_change { background: rgba(251,191,36,0.15); color: #fbbf24; }

.entity-title { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: middle; }
.entity-id { font-size: 0.72rem; margin-left: 0.4rem; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 0.5rem; }
.pag-info { font-size: 0.85rem; color: var(--text-muted); }

.input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.55rem 0.75rem; color: var(--text); font-size: 0.875rem; font-family: inherit; }
.input:focus { outline: none; border-color: var(--accent); }
</style>
