<template>
  <div class="gdpr-view">
    <div class="page-header">
      <div class="header-left">
        <h1>🛡️ GDPR Privacy Center</h1>
        <p class="subtitle">Manage customer data export and deletion requests</p>
      </div>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card accent">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">Pending Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.exports }}</div>
        <div class="stat-label">Data Exports</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.deletions }}</div>
        <div class="stat-label">Deletion Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.completed }}</div>
        <div class="stat-label">Completed</div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="glass filter-bar">
      <input v-model="search" @input="loadRequests" type="text" class="form-input" placeholder="Search by email…" />
      <select v-model="filterStatus" @change="loadRequests" class="form-input">
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="rejected">Rejected</option>
      </select>
      <select v-model="filterType" @change="loadRequests" class="form-input">
        <option value="">All types</option>
        <option value="export">Data Export</option>
        <option value="delete">Deletion</option>
      </select>
    </div>

    <!-- Requests Table -->
    <div class="glass section" v-if="requests.length">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Type</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Completed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in requests" :key="req.id">
            <td>{{ req.email }}</td>
            <td><span :class="['type-badge', req.type]">{{ req.type === 'export' ? '📤 Data Export' : '🗑️ Deletion' }}</span></td>
            <td><span :class="['status-pill', req.status]">{{ req.status }}</span></td>
            <td>{{ fmtDate(req.created_at) }}</td>
            <td>{{ req.completed_at ? fmtDate(req.completed_at) : '—' }}</td>
            <td>
              <button v-if="req.status === 'pending'" class="btn-sm btn-primary" @click="openProcess(req)">Process</button>
              <button v-if="req.status === 'completed' && req.type === 'export'" class="btn-sm" @click="copyDownloadUrl(req)">📋 Copy Link</button>
              <button class="btn-sm btn-ghost" @click="deleteRequest(req.id)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination" v-if="total > limit">
        <button :disabled="offset === 0" @click="prevPage">← Prev</button>
        <span>{{ offset + 1 }} – {{ Math.min(offset + limit, total) }} of {{ total }}</span>
        <button :disabled="offset + limit >= total" @click="nextPage">Next →</button>
      </div>
    </div>
    <div v-else class="glass empty-state">
      <div class="empty-icon">🛡️</div>
      <p>No privacy requests found.</p>
    </div>

    <!-- Process Modal -->
    <div v-if="processModal" class="modal-backdrop" @click.self="processModal = null">
      <div class="modal-card glass">
        <h2>Process Request</h2>
        <div class="modal-field">
          <label>Email</label>
          <div class="info-text">{{ processModal.email }}</div>
        </div>
        <div class="modal-field">
          <label>Request Type</label>
          <div class="info-text">
            <span :class="['type-badge', processModal.type]">
              {{ processModal.type === 'export' ? '📤 Data Export' : '🗑️ Deletion' }}
            </span>
          </div>
        </div>
        <div class="modal-field" v-if="processModal.type === 'delete'">
          <div class="warning-box">
            ⚠️ Approving this request will <strong>anonymise the customer's personal data</strong> (name, email, phone, addresses). Order history is retained but de-personalised. This action cannot be undone.
          </div>
        </div>
        <div class="modal-field" v-if="processModal.type === 'export'">
          <div class="info-box">
            ℹ️ Approving will generate a full JSON export of the customer's data and send them a download link via email. The link uses their existing request token.
          </div>
        </div>
        <div class="modal-field">
          <label>Admin Notes</label>
          <textarea v-model="processForm.admin_notes" class="form-input" rows="3" placeholder="Optional internal note…"></textarea>
        </div>
        <div class="modal-field">
          <label>Action</label>
          <select v-model="processForm.status" class="form-input">
            <option value="completed">✅ Approve &amp; Complete</option>
            <option value="rejected">❌ Reject</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" @click="submitProcess" :disabled="processing">
            {{ processing ? 'Processing…' : 'Submit' }}
          </button>
          <button class="btn-ghost" @click="processModal = null">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Settings Section -->
    <div class="glass section" style="margin-top:2rem">
      <h2>⚙️ GDPR Settings</h2>
      <div class="settings-grid">
        <div class="setting-row">
          <label>Enable Data Export Requests</label>
          <input type="checkbox" v-model="settings.gdpr_data_export_enabled" true-value="1" false-value="0" @change="saveSetting('gdpr_data_export_enabled', settings.gdpr_data_export_enabled)" />
        </div>
        <div class="setting-row">
          <label>Enable Deletion Requests</label>
          <input type="checkbox" v-model="settings.gdpr_deletion_enabled" true-value="1" false-value="0" @change="saveSetting('gdpr_deletion_enabled', settings.gdpr_deletion_enabled)" />
        </div>
        <div class="setting-row">
          <label>Privacy Page Title</label>
          <input v-model="settings.gdpr_privacy_page_title" class="form-input" type="text" @blur="saveSetting('gdpr_privacy_page_title', settings.gdpr_privacy_page_title)" />
        </div>
        <div class="setting-row">
          <label>Privacy Page Subtitle</label>
          <input v-model="settings.gdpr_privacy_page_subtitle" class="form-input" type="text" @blur="saveSetting('gdpr_privacy_page_subtitle', settings.gdpr_privacy_page_subtitle)" />
        </div>
        <div class="setting-row">
          <label>DPO / Compliance Email</label>
          <input v-model="settings.gdpr_dpo_email" class="form-input" type="email" placeholder="dpo@example.com" @blur="saveSetting('gdpr_dpo_email', settings.gdpr_dpo_email)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const requests = ref([])
const stats = ref(null)
const search = ref('')
const filterStatus = ref('')
const filterType = ref('')
const offset = ref(0)
const limit = ref(50)
const total = ref(0)
const processModal = ref(null)
const processForm = ref({ status: 'completed', admin_notes: '' })
const processing = ref(false)
const settings = ref({
  gdpr_data_export_enabled: '1',
  gdpr_deletion_enabled: '1',
  gdpr_privacy_page_title: 'Your Privacy',
  gdpr_privacy_page_subtitle: 'Manage your personal data',
  gdpr_dpo_email: '',
})

async function loadRequests () {
  const params = new URLSearchParams({ limit: limit.value, offset: offset.value })
  if (search.value)       params.set('q', search.value)
  if (filterStatus.value) params.set('status', filterStatus.value)
  if (filterType.value)   params.set('type', filterType.value)
  const data = await api.get(`/gdpr/requests?${params}`)
  requests.value = data.requests
  total.value = data.total
}

async function loadStats () {
  stats.value = await api.get('/gdpr/requests/stats')
}

async function loadSettings () {
  const data = await api.get('/settings')
  for (const key of Object.keys(settings.value)) {
    if (data[key] !== undefined) settings.value[key] = data[key]
  }
}

async function saveSetting (key, value) {
  await api.put('/settings', { [key]: value })
}

function openProcess (req) {
  processModal.value = req
  processForm.value = { status: 'completed', admin_notes: '' }
}

async function submitProcess () {
  processing.value = true
  try {
    await api.put(`/gdpr/requests/${processModal.value.id}`, processForm.value)
    processModal.value = null
    await loadRequests()
    await loadStats()
  } finally {
    processing.value = false
  }
}

async function deleteRequest (id) {
  if (!confirm('Delete this privacy request record?')) return
  await api.delete(`/gdpr/requests/${id}`)
  await loadRequests()
  await loadStats()
}

function copyDownloadUrl (req) {
  const siteUrl = window.location.origin.replace('5173', '5174')
  const url = `${siteUrl}/privacy/download/${req.token}`
  navigator.clipboard.writeText(url)
  alert(`Download link copied:\n${url}`)
}

function fmtDate (d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function prevPage () { offset.value = Math.max(0, offset.value - limit.value); loadRequests() }
function nextPage () { offset.value = offset.value + limit.value; loadRequests() }

onMounted(() => {
  loadRequests()
  loadStats()
  loadSettings()
})
</script>

<style scoped>
.gdpr-view { padding: 1.5rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; }
.subtitle { color: var(--text-muted); margin-top: 0.25rem; }
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: var(--surface); border-radius: 1rem; padding: 1rem 1.5rem; text-align: center; flex: 1; min-width: 120px; }
.stat-card.accent { border: 1px solid var(--accent); }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }
.filter-bar { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; padding: 1rem; border-radius: 1rem; }
.filter-bar .form-input { flex: 1; min-width: 160px; }
.glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(16px); border-radius: 1rem; }
.section { padding: 1.5rem; margin-bottom: 1.5rem; }
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th, .admin-table td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
.admin-table th { color: var(--text-muted); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; }
.type-badge { padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.8rem; }
.type-badge.export { background: rgba(59,130,246,0.15); color: #60a5fa; }
.type-badge.delete { background: rgba(239,68,68,0.15); color: #f87171; }
.status-pill { padding: 0.2rem 0.75rem; border-radius: 99px; font-size: 0.8rem; text-transform: capitalize; }
.status-pill.pending { background: rgba(251,191,36,0.15); color: #fbbf24; }
.status-pill.completed { background: rgba(34,197,94,0.15); color: #4ade80; }
.status-pill.rejected { background: rgba(239,68,68,0.15); color: #f87171; }
.btn-sm { padding: 0.3rem 0.75rem; font-size: 0.82rem; border-radius: 0.5rem; cursor: pointer; background: var(--accent); color: #fff; border: none; margin-right: 0.25rem; }
.btn-sm.btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted); }
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1rem; }
.empty-state { padding: 3rem; text-align: center; color: var(--text-muted); }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { width: 100%; max-width: 520px; padding: 2rem; border-radius: 1.5rem; }
.modal-card h2 { margin-bottom: 1.5rem; }
.modal-field { margin-bottom: 1rem; }
.modal-field label { display: block; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.4rem; }
.modal-field .form-input { width: 100%; box-sizing: border-box; }
.info-text { font-size: 0.95rem; }
.warning-box { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #fbbf24; font-size: 0.88rem; }
.info-box { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #60a5fa; font-size: 0.88rem; }
.modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
.btn-primary { background: var(--accent); color: #fff; padding: 0.6rem 1.5rem; border: none; border-radius: 0.75rem; cursor: pointer; font-weight: 600; }
.btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); padding: 0.6rem 1.5rem; border-radius: 0.75rem; cursor: pointer; color: var(--text-muted); }
.settings-grid { display: flex; flex-direction: column; gap: 1rem; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.setting-row label { font-size: 0.9rem; color: var(--text-muted); }
.setting-row .form-input { max-width: 300px; }
h2 { font-size: 1.1rem; margin-bottom: 1.25rem; }
</style>
