<template>
  <div class="view-contact">
    <div class="view-header">
      <div>
        <h1 class="view-title">Contact Submissions</h1>
        <p class="view-sub">Messages sent via the public contact form</p>
      </div>
      <div class="header-stats glass">
        <span class="stat-num">{{ stats.total }}</span> total
        <span class="divider">·</span>
        <span :class="['stat-num', stats.unread > 0 ? 'accent' : '']">{{ stats.unread }}</span> unread
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <button
        v-for="f in filters" :key="f.value"
        :class="['btn btn-sm', activeFilter === f.value ? 'btn-accent' : 'btn-ghost']"
        @click="setFilter(f.value)"
      >{{ f.label }}</button>
    </div>

    <!-- List -->
    <div class="submissions-list glass">
      <div v-if="loading" class="loading-rows">
        <div v-for="n in 4" :key="n" class="skeleton skeleton-row" />
      </div>

      <template v-else-if="rows.length">
        <div
          v-for="row in rows"
          :key="row.id"
          :class="['submission-item', row.status === 'unread' ? 'unread' : '']"
          @click="openRow(row)"
        >
          <div class="sub-dot" :class="row.status" />
          <div class="sub-main">
            <div class="sub-header">
              <span class="sub-name">{{ row.name }}</span>
              <span class="sub-email text-muted">{{ row.email }}</span>
              <span v-if="row.subject" class="sub-subject">{{ row.subject }}</span>
              <span class="sub-date text-muted text-sm">{{ formatDate(row.created_at) }}</span>
            </div>
            <p class="sub-preview text-muted">{{ truncate(row.message, 120) }}</p>
          </div>
          <div class="sub-actions" @click.stop>
            <button class="btn btn-sm btn-ghost" @click="cycleStatus(row)">
              {{ statusLabel(row.status) }}
            </button>
            <button class="btn btn-sm btn-danger" @click="confirmDelete(row)">✕</button>
          </div>
        </div>
      </template>

      <div v-else class="empty-state">
        <p>No submissions found.</p>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <button class="btn btn-ghost btn-sm" :disabled="offset === 0" @click="offset -= limit; load()">← Prev</button>
      <span class="text-muted text-sm">{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <button class="btn btn-ghost btn-sm" :disabled="offset + limit >= total" @click="offset += limit; load()">Next →</button>
    </div>

    <!-- Detail Modal -->
    <Teleport to="body">
      <div v-if="detail" class="modal-overlay" @click.self="detail = null">
        <div class="modal-card glass">
          <div class="detail-header">
            <div>
              <div class="detail-name">{{ detail.name }}</div>
              <div class="detail-email text-muted">{{ detail.email }}</div>
            </div>
            <div class="detail-meta">
              <span v-if="detail.subject" class="badge badge-muted">{{ detail.subject }}</span>
              <span class="text-muted text-sm">{{ formatDate(detail.created_at) }}</span>
            </div>
          </div>
          <div class="detail-body">{{ detail.message }}</div>
          <div v-if="detail.ip" class="detail-ip text-muted text-sm">IP: {{ detail.ip }}</div>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="detail = null">Close</button>
            <button class="btn btn-ghost" @click="cycleStatus(detail); detail = null">
              Mark {{ nextStatus(detail.status) }}
            </button>
            <a :href="`mailto:${detail.email}`" class="btn btn-accent">Reply via Email</a>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal-card glass modal-sm">
          <h2 class="modal-title">Delete Submission</h2>
          <p class="text-muted">Permanently delete message from <strong>{{ deleteTarget.name }}</strong>?</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import api from '../api.js'

const rows = ref([])
const loading = ref(true)
const detail = ref(null)
const deleteTarget = ref(null)
const total = ref(0)
const offset = ref(0)
const limit = 20
const activeFilter = ref('')
const stats = reactive({ total: 0, unread: 0 })

const filters = [
  { label: 'All', value: '' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
  { label: 'Archived', value: 'archived' },
]

async function load() {
  loading.value = true
  try {
    const params = { limit, offset: offset.value }
    if (activeFilter.value) params.status = activeFilter.value
    const [res, statsRes] = await Promise.all([
      api.get('/contact', { params }),
      api.get('/contact/stats'),
    ])
    rows.value = res.data.submissions
    total.value = res.data.total
    Object.assign(stats, statsRes.data)
  } finally {
    loading.value = false
  }
}

function setFilter(val) {
  activeFilter.value = val
  offset.value = 0
  load()
}

function openRow(row) {
  detail.value = row
  if (row.status === 'unread') {
    markStatus(row, 'read')
    row.status = 'read'
    stats.unread = Math.max(0, stats.unread - 1)
  }
}

async function markStatus(row, newStatus) {
  await api.put(`/contact/${row.id}`, { status: newStatus })
}

function cycleStatus(row) {
  const next = nextStatus(row.status)
  markStatus(row, next)
  row.status = next
}

function nextStatus(status) {
  if (status === 'unread')  return 'read'
  if (status === 'read')    return 'archived'
  return 'unread'
}

function statusLabel(status) {
  if (status === 'unread')  return 'Mark read'
  if (status === 'read')    return 'Archive'
  return 'Unarchive'
}

function confirmDelete(row) {
  deleteTarget.value = row
}

async function doDelete() {
  await api.delete(`/contact/${deleteTarget.value.id}`)
  deleteTarget.value = null
  load()
}

function formatDate(dt) {
  return new Date(dt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str
}

onMounted(load)
</script>

<style scoped>
.view-contact { display: flex; flex-direction: column; gap: 1.25rem; }

.view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.view-title  { font-size: 1.6rem; font-weight: 700; margin: 0; }
.view-sub    { color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0 0; }

.header-stats {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 1rem; border-radius: var(--radius-sm);
  font-size: 0.85rem; color: var(--text-muted);
}
.stat-num { font-weight: 700; color: var(--text); }
.stat-num.accent { color: var(--accent); }
.divider { color: var(--border); }

.filters { display: flex; gap: 0.4rem; flex-wrap: wrap; }

/* Submissions list */
.submissions-list { border-radius: var(--radius); overflow: hidden; }
.submission-item {
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}
.submission-item:last-child { border-bottom: none; }
.submission-item:hover { background: rgba(255,255,255,0.03); }
.submission-item.unread { background: rgba(213, 70, 80, 0.05); }

.sub-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 0.35rem;
}
.sub-dot.unread  { background: var(--accent); }
.sub-dot.read     { background: var(--text-muted); opacity: 0.4; }
.sub-dot.archived { background: transparent; border: 1px solid var(--border); }

.sub-main { flex: 1; min-width: 0; }
.sub-header { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
.sub-name   { font-weight: 600; font-size: 0.88rem; }
.sub-email  { font-size: 0.8rem; }
.sub-subject { font-size: 0.78rem; background: var(--glass-bg); padding: 0.1rem 0.45rem; border-radius: 2rem; color: var(--text-muted); }
.sub-date   { margin-left: auto; }
.sub-preview { font-size: 0.82rem; margin: 0; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sub-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }

.empty-state { padding: 3rem; text-align: center; color: var(--text-muted); }

/* Pagination */
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; }

/* Detail modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 1rem;
}
.modal-card { width: 100%; max-width: 560px; padding: 2rem; border-radius: var(--radius); display: flex; flex-direction: column; gap: 1.25rem; }
.modal-sm { max-width: 380px; }
.modal-title { font-size: 1.1rem; font-weight: 700; margin: 0; }
.modal-actions { display: flex; gap: 0.6rem; justify-content: flex-end; flex-wrap: wrap; }

.detail-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.detail-name  { font-weight: 700; font-size: 1rem; }
.detail-email { font-size: 0.83rem; margin-top: 0.1rem; }
.detail-meta  { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; }
.detail-body  {
  background: var(--glass-bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 1rem; white-space: pre-wrap; font-size: 0.88rem; line-height: 1.7; max-height: 280px; overflow-y: auto;
}
.detail-ip { border-top: 1px solid var(--border); padding-top: 0.5rem; }

.badge { display: inline-flex; align-items: center; padding: 0.15rem 0.55rem; border-radius: 2rem; font-size: 0.72rem; font-weight: 600; }
.badge-muted { background: var(--glass-bg); color: var(--text-muted); }
.text-muted { color: var(--text-muted); }
.text-sm { font-size: 0.8rem; }
.btn-danger { background: hsl(355,70%,20%); color: hsl(355,70%,65%); }
.btn-danger:hover { background: hsl(355,70%,25%); }

.loading-rows { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }
.skeleton-row { height: 70px; border-radius: var(--radius-sm); }
</style>
