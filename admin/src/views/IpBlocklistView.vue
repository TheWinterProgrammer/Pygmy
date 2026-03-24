<template>
  <div class="ip-blocklist-view">
    <div class="page-header">
      <div>
        <h1>🛡️ IP Blocklist</h1>
        <p class="page-desc">Block specific IPs, CIDR ranges, or wildcard patterns from accessing your site.</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">+ Add Entry</button>
    </div>

    <!-- Stats -->
    <div v-if="stats" class="stats-strip">
      <div class="stat-card">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-label">Total Entries</span>
      </div>
      <div class="stat-card accent">
        <span class="stat-num">{{ stats.active_count }}</span>
        <span class="stat-label">Active Blocks</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ stats.total_hits || 0 }}</span>
        <span class="stat-label">Total Hits Blocked</span>
      </div>
    </div>

    <!-- Filter -->
    <div class="filter-bar glass">
      <input v-model="q" class="input" placeholder="🔍 Search by IP or note…" @input="load" />
      <select v-model="filterActive" class="select" @change="load">
        <option value="">All statuses</option>
        <option value="1">Active only</option>
        <option value="0">Disabled only</option>
      </select>
    </div>

    <!-- Table -->
    <div v-if="rows.length" class="table-wrap glass">
      <table class="table">
        <thead>
          <tr>
            <th>Pattern</th>
            <th>Type</th>
            <th>Note</th>
            <th>Hits</th>
            <th>Status</th>
            <th>Added</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td class="mono">{{ row.pattern }}</td>
            <td><span class="badge" :class="typeBadge(row.type)">{{ row.type }}</span></td>
            <td class="note-cell">{{ row.note || '—' }}</td>
            <td>{{ row.hits }}</td>
            <td>
              <button class="status-toggle" :class="row.active ? 'active' : 'inactive'" @click="toggle(row)">
                {{ row.active ? '🟢 Active' : '⚫ Disabled' }}
              </button>
            </td>
            <td class="muted">{{ fmtDate(row.created_at) }}</td>
            <td class="actions">
              <button class="btn btn-ghost btn-sm" @click="openEdit(row)" title="Edit">✏️</button>
              <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(row)" title="Delete">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="!loading" class="empty-state glass">
      <span>🛡️</span>
      <p>No blocked IPs yet. Add an entry to start blocking malicious traffic.</p>
    </div>

    <!-- Add/Edit Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
        <div class="modal glass">
          <h3>{{ editRow ? 'Edit Block Entry' : 'Add Block Entry' }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Pattern *</label>
              <input v-model="form.pattern" class="input" placeholder="192.168.1.1 or 10.0.0.0/8 or 192.168.*" />
              <span class="field-hint">Exact IP, CIDR range, or wildcard (use * for ranges)</span>
            </div>
            <div class="form-group">
              <label>Type</label>
              <select v-model="form.type" class="select">
                <option value="exact">Exact IP</option>
                <option value="cidr">CIDR Range (e.g. 10.0.0.0/8)</option>
                <option value="wildcard">Wildcard (e.g. 192.168.*)</option>
              </select>
            </div>
            <div class="form-group full">
              <label>Note</label>
              <input v-model="form.note" class="input" placeholder="Why this IP was blocked (optional)" />
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.active" />
                <span>Active (block is enforced)</span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showForm = false">Cancel</button>
            <button class="btn btn-primary" @click="save" :disabled="saving">
              {{ saving ? 'Saving…' : editRow ? 'Save Changes' : 'Add Block' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="deleteRow" class="modal-overlay" @click.self="deleteRow = null">
        <div class="modal glass confirm-modal">
          <h3>🗑️ Remove Block?</h3>
          <p>Remove IP block for <strong class="mono">{{ deleteRow.pattern }}</strong>?</p>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="deleteRow = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete">Remove</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const rows = ref([])
const stats = ref(null)
const loading = ref(false)
const q = ref('')
const filterActive = ref('')
const showForm = ref(false)
const editRow = ref(null)
const deleteRow = ref(null)
const saving = ref(false)

const form = ref({ pattern: '', type: 'exact', note: '', active: true })

async function load() {
  loading.value = true
  const params = {}
  if (q.value) params.q = q.value
  if (filterActive.value !== '') params.active = filterActive.value
  const { data } = await api.get('/ip-blocklist', { params })
  rows.value = data.rows
  stats.value = data.stats
  loading.value = false
}

function openAdd() {
  editRow.value = null
  form.value = { pattern: '', type: 'exact', note: '', active: true }
  showForm.value = true
}

function openEdit(row) {
  editRow.value = row
  form.value = { pattern: row.pattern, type: row.type, note: row.note || '', active: !!row.active }
  showForm.value = true
}

async function save() {
  if (!form.value.pattern) return
  saving.value = true
  try {
    if (editRow.value) {
      await api.put(`/ip-blocklist/${editRow.value.id}`, form.value)
    } else {
      await api.post('/ip-blocklist', form.value)
    }
    showForm.value = false
    await load()
  } finally {
    saving.value = false
  }
}

function confirmDelete(row) { deleteRow.value = row }

async function doDelete() {
  await api.delete(`/ip-blocklist/${deleteRow.value.id}`)
  deleteRow.value = null
  await load()
}

async function toggle(row) {
  await api.post(`/ip-blocklist/${row.id}/toggle`)
  await load()
}

function typeBadge(t) {
  if (t === 'exact') return 'badge-blue'
  if (t === 'cidr') return 'badge-orange'
  return 'badge-purple'
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.ip-blocklist-view { max-width: 1000px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-desc { color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-top: 0.25rem; }
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1rem 1.5rem; min-width: 140px; }
.stat-card.accent { border-color: var(--accent); }
.stat-num { display: block; font-size: 1.75rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: rgba(255,255,255,0.5); }
.filter-bar { display: flex; gap: 1rem; padding: 1rem 1.5rem; border-radius: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.filter-bar .input { flex: 1; min-width: 200px; }
.table-wrap { border-radius: 1rem; overflow: hidden; margin-bottom: 1rem; }
.table { width: 100%; border-collapse: collapse; }
.table th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.07); }
.table td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.875rem; }
.mono { font-family: monospace; font-size: 0.85rem; }
.note-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,0.6); }
.muted { color: rgba(255,255,255,0.4); font-size: 0.8rem; }
.actions { display: flex; gap: 0.4rem; }
.badge { padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.7rem; font-weight: 600; }
.badge-blue { background: rgba(99,102,241,0.2); color: #818cf8; }
.badge-orange { background: rgba(249,115,22,0.2); color: #fb923c; }
.badge-purple { background: rgba(168,85,247,0.2); color: #c084fc; }
.status-toggle { background: none; border: none; cursor: pointer; font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 0.5rem; }
.status-toggle:hover { background: rgba(255,255,255,0.07); }
.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; }
.empty-state span { font-size: 3rem; display: block; margin-bottom: 1rem; }
.empty-state p { color: rgba(255,255,255,0.5); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal { width: 100%; max-width: 520px; border-radius: 1.5rem; padding: 2rem; }
.modal h3 { margin-bottom: 1.25rem; font-size: 1.1rem; font-weight: 700; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group.full { grid-column: 1/-1; }
.form-group label { font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600; }
.field-hint { font-size: 0.72rem; color: rgba(255,255,255,0.4); }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.875rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.confirm-modal p { margin-bottom: 0.5rem; }
.btn-danger { background: hsl(355,70%,45%); color: #fff; border: none; padding: 0.5rem 1.25rem; border-radius: 0.75rem; cursor: pointer; font-weight: 600; }
.btn-danger:hover { background: hsl(355,70%,38%); }
</style>
