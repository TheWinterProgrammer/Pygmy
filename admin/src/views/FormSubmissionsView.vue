<template>
  <div class="submissions-view">
    <div class="view-header">
      <div class="header-left">
        <RouterLink :to="`/forms/${route.params.id}`" class="back-link">← Edit Form</RouterLink>
        <h1>📥 {{ formName }} — Submissions</h1>
      </div>
      <div class="header-actions">
        <select v-model="statusFilter" @change="load" class="glass-select-sm">
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
          <option value="archived">Archived</option>
        </select>
        <button @click="exportCsv" class="btn-ghost">⬇️ Export CSV</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading submissions…</div>
    <div v-else-if="rows.length === 0" class="empty-state glass">
      <p>No submissions yet{{ statusFilter ? ` (${statusFilter})` : '' }}.</p>
    </div>
    <div v-else>
      <div class="table-wrapper glass">
        <table class="sub-table">
          <thead>
            <tr>
              <th>Date</th>
              <th v-for="col in columns" :key="col">{{ col }}</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="sub in rows"
              :key="sub.id"
              :class="{ unread: sub.status === 'unread' }"
              @click="openDetail(sub)"
              style="cursor:pointer"
            >
              <td class="date-cell">{{ fmtDate(sub.created_at) }}</td>
              <td v-for="col in columns" :key="col" class="data-cell">{{ parseData(sub.data)[col] || '—' }}</td>
              <td>
                <span :class="['status-dot', sub.status]">{{ sub.status }}</span>
              </td>
              <td @click.stop>
                <div class="row-actions">
                  <button @click="cycle(sub)" class="act-btn" :title="`Mark as ${nextStatus(sub.status)}`">
                    {{ nextStatus(sub.status) === 'read' ? '✓' : nextStatus(sub.status) === 'archived' ? '📦' : '↩' }}
                  </button>
                  <button @click="remove(sub)" class="act-btn danger" title="Delete">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" v-if="total > pageSize">
        <button @click="page--; load()" :disabled="page <= 0" class="btn-ghost-sm">← Prev</button>
        <span class="page-info">{{ page * pageSize + 1 }}–{{ Math.min((page + 1) * pageSize, total) }} of {{ total }}</span>
        <button @click="page++; load()" :disabled="(page + 1) * pageSize >= total" class="btn-ghost-sm">Next →</button>
      </div>
    </div>

    <!-- Detail modal -->
    <Teleport to="body">
      <div v-if="detail" class="modal-backdrop" @click.self="detail = null">
        <div class="modal glass">
          <div class="modal-header">
            <h2>Submission #{{ detail.id }}</h2>
            <button @click="detail = null" class="close-btn">✕</button>
          </div>
          <div class="modal-body">
            <p class="detail-meta">Submitted {{ fmtDate(detail.created_at) }} from {{ detail.ip || 'unknown IP' }}</p>
            <div class="detail-fields">
              <div v-for="(val, key) in parseData(detail.data)" :key="key" class="detail-field">
                <span class="detail-key">{{ key }}</span>
                <span class="detail-val">{{ val || '—' }}</span>
              </div>
            </div>
            <div class="modal-footer">
              <select :value="detail.status" @change="updateStatus(detail, $event.target.value)" class="glass-select-sm">
                <option value="unread">Unread</option>
                <option value="read">Read</option>
                <option value="archived">Archived</option>
              </select>
              <button @click="remove(detail); detail = null" class="btn-danger">Delete</button>
              <button @click="detail = null" class="btn-ghost">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToastStore } from '../stores/toast.js'
import api from '../api.js'

const route = useRoute()
const toast = useToastStore()

const rows = ref([])
const total = ref(0)
const loading = ref(true)
const statusFilter = ref('')
const page = ref(0)
const pageSize = 25
const detail = ref(null)
const formName = ref('Form')

const columns = computed(() => {
  const keys = new Set()
  rows.value.forEach(r => {
    Object.keys(parseData(r.data)).forEach(k => keys.add(k))
  })
  return [...keys].slice(0, 5) // cap columns for readability
})

function parseData (raw) {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit: pageSize, offset: page.value * pageSize })
    if (statusFilter.value) params.set('status', statusFilter.value)
    const res = await api.get(`/forms/${route.params.id}/submissions?${params}`)
    rows.value = res.data.rows
    total.value = res.data.total
    if (res.data.rows.length > 0) formName.value = res.data.rows[0].form_name
  } catch { toast.error('Failed to load submissions') }
  finally { loading.value = false }
}

async function loadFormName () {
  try {
    const res = await api.get('/forms?all=1')
    const found = res.data.find(f => f.id === parseInt(route.params.id))
    if (found) formName.value = found.name
  } catch {}
}

function fmtDate (dt) {
  return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

function nextStatus (s) {
  return s === 'unread' ? 'read' : s === 'read' ? 'archived' : 'unread'
}

async function cycle (sub) {
  await updateStatus(sub, nextStatus(sub.status))
}

async function updateStatus (sub, newStatus) {
  try {
    await api.put(`/forms/${route.params.id}/submissions/${sub.id}`, { status: newStatus })
    sub.status = newStatus
    if (detail.value?.id === sub.id) detail.value.status = newStatus
  } catch { toast.error('Update failed') }
}

async function remove (sub) {
  try {
    await api.delete(`/forms/${route.params.id}/submissions/${sub.id}`)
    rows.value = rows.value.filter(r => r.id !== sub.id)
    total.value--
    toast.success('Deleted')
  } catch { toast.error('Delete failed') }
}

function openDetail (sub) {
  detail.value = { ...sub }
  if (sub.status === 'unread') updateStatus(sub, 'read')
}

function exportCsv () {
  if (rows.value.length === 0) return toast.error('No data to export')
  const keys = [...new Set(rows.value.flatMap(r => Object.keys(parseData(r.data))))]
  const header = ['id', 'date', 'ip', ...keys, 'status']
  const csvRows = rows.value.map(r => {
    const d = parseData(r.data)
    return [r.id, r.created_at, r.ip || '', ...keys.map(k => JSON.stringify(d[k] ?? '')), r.status].join(',')
  })
  const blob = new Blob([[header.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `${formName.value.replace(/\s+/g, '_')}_submissions.csv`; a.click()
}

onMounted(async () => { await loadFormName(); await load() })
</script>

<style scoped>
.view-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
.header-left { display:flex; flex-direction:column; gap:.25rem; }
.header-left h1 { margin:0; font-size:1.1rem; }
.back-link { color:var(--muted); text-decoration:none; font-size:.85rem; }
.back-link:hover { color:var(--text); }
.header-actions { display:flex; gap:.75rem; align-items:center; }
.glass-select-sm { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.4rem .75rem; border-radius:.5rem; font-size:.85rem; font-family:inherit; outline:none; cursor:pointer; }
.btn-ghost { background:transparent; border:1px solid rgba(255,255,255,.15); color:var(--muted); padding:.4rem 1rem; border-radius:.5rem; cursor:pointer; font-size:.85rem; }
.loading, .empty-state { text-align:center; padding:3rem; color:var(--muted); }
.empty-state { border-radius:1.2rem; }

.table-wrapper { border-radius:1.2rem; overflow-x:auto; }
.sub-table { width:100%; border-collapse:collapse; font-size:.85rem; }
.sub-table th { padding:.65rem 1rem; text-align:left; color:var(--muted); font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid rgba(255,255,255,.07); }
.sub-table td { padding:.7rem 1rem; border-bottom:1px solid rgba(255,255,255,.05); }
.sub-table tr.unread td { background:rgba(239,68,68,.04); }
.sub-table tr:hover td { background:rgba(255,255,255,.03); }
.date-cell { white-space:nowrap; color:var(--muted); }
.data-cell { max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.status-dot { font-size:.7rem; font-weight:700; text-transform:uppercase; padding:.15rem .5rem; border-radius:.4rem; }
.status-dot.unread { background:rgba(239,68,68,.15); color:#f87171; }
.status-dot.read { background:rgba(34,197,94,.1); color:#22c55e; }
.status-dot.archived { background:rgba(255,255,255,.08); color:var(--muted); }
.row-actions { display:flex; gap:.3rem; }
.act-btn { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); color:var(--text); width:28px; height:28px; border-radius:.4rem; cursor:pointer; font-size:.8rem; display:flex; align-items:center; justify-content:center; }
.act-btn.danger:hover { background:rgba(239,68,68,.2); color:#f87171; }

.pagination { display:flex; align-items:center; justify-content:center; gap:1rem; margin-top:1.2rem; }
.page-info { font-size:.85rem; color:var(--muted); }
.btn-ghost-sm { background:transparent; border:1px solid rgba(255,255,255,.15); color:var(--muted); padding:.35rem .8rem; border-radius:.5rem; cursor:pointer; font-size:.82rem; }

/* Modal */
.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:100; display:flex; align-items:center; justify-content:center; }
.modal { width:min(560px,95vw); border-radius:1.5rem; overflow:hidden; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:1.2rem 1.5rem; border-bottom:1px solid rgba(255,255,255,.08); }
.modal-header h2 { margin:0; font-size:1.05rem; }
.close-btn { background:none; border:none; color:var(--muted); font-size:1.2rem; cursor:pointer; }
.modal-body { padding:1.5rem; }
.detail-meta { font-size:.8rem; color:var(--muted); margin:0 0 1rem; }
.detail-fields { display:flex; flex-direction:column; gap:.6rem; }
.detail-field { display:grid; grid-template-columns:140px 1fr; gap:.5rem; font-size:.88rem; }
.detail-key { font-weight:600; color:var(--muted); text-transform:capitalize; }
.detail-val { color:var(--text); word-break:break-word; }
.modal-footer { display:flex; justify-content:flex-end; gap:.75rem; margin-top:1.2rem; align-items:center; }
.btn-danger { background:hsl(0,70%,50%); border:none; color:#fff; padding:.5rem 1.1rem; border-radius:.6rem; cursor:pointer; font-weight:600; }
</style>
