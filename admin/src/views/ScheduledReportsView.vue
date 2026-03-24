<template>
  <div class="scheduled-reports-view">
    <div class="page-header">
      <div>
        <h1>📊 Scheduled Reports</h1>
        <p class="subtitle">Automatically email periodic performance summaries to your team</p>
      </div>
      <button class="btn btn-primary" @click="openCreate()">+ New Report</button>
    </div>

    <!-- Reports list -->
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="!reports.length" class="glass section empty-state">
      <div class="empty-icon">📊</div>
      <h3>No scheduled reports yet</h3>
      <p>Create your first report to automatically email performance summaries.</p>
      <button class="btn btn-primary" @click="openCreate()">Create Report</button>
    </div>

    <div v-else class="reports-grid">
      <div v-for="report in reports" :key="report.id" class="glass report-card">
        <div class="report-header">
          <div>
            <h3 class="report-name">{{ report.name }}</h3>
            <div class="report-meta">
              <span class="badge" :class="freqClass(report.frequency)">{{ report.frequency }}</span>
              <span class="report-time">{{ report.send_time }}</span>
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" :checked="report.active" @change="toggleActive(report)" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="report-body">
          <div class="detail-row">
            <span class="detail-label">Recipients</span>
            <span class="detail-value">{{ report.recipients.join(', ') || '—' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Report sections</span>
            <div class="type-pills">
              <span v-for="t in report.report_types" :key="t" class="type-pill">{{ t }}</span>
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-label">Next send</span>
            <span class="detail-value">{{ fmtDate(report.next_send_at) }}</span>
          </div>
          <div v-if="report.last_sent_at" class="detail-row">
            <span class="detail-label">Last sent</span>
            <span class="detail-value">{{ fmtDate(report.last_sent_at) }}</span>
          </div>
        </div>

        <div class="report-footer">
          <button class="btn-sm btn-ghost" @click="sendNow(report)" :disabled="sending === report.id">
            {{ sending === report.id ? '⏳ Sending…' : '📤 Send Now' }}
          </button>
          <button class="btn-sm btn-ghost" @click="openEdit(report)">✏️ Edit</button>
          <button class="btn-sm btn-danger" @click="confirmDelete(report)">🗑️</button>
        </div>
      </div>
    </div>

    <!-- Send result -->
    <div v-if="sendResult" class="glass notice" :class="sendResult.ok ? 'notice-success' : 'notice-error'" style="margin-top:16px">
      {{ sendResult.ok ? `✅ Sent to ${sendResult.sent} recipient(s)` : '❌ ' + sendResult.error }}
      <button @click="sendResult=null" style="margin-left:12px;background:none;border:none;color:inherit;cursor:pointer">✕</button>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal=false">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ editing ? 'Edit Report' : 'New Scheduled Report' }}</h2>
          <button @click="showModal=false" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Report Name *</label>
            <input v-model="form.name" class="form-input" placeholder="Weekly Performance Summary" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Frequency</label>
              <select v-model="form.frequency" class="form-input">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div class="form-group" v-if="form.frequency === 'weekly'">
              <label>Day of Week</label>
              <select v-model.number="form.day_of_week" class="form-input">
                <option :value="0">Sunday</option>
                <option :value="1">Monday</option>
                <option :value="2">Tuesday</option>
                <option :value="3">Wednesday</option>
                <option :value="4">Thursday</option>
                <option :value="5">Friday</option>
                <option :value="6">Saturday</option>
              </select>
            </div>
            <div class="form-group" v-if="form.frequency === 'monthly'">
              <label>Day of Month</label>
              <input v-model.number="form.day_of_month" type="number" min="1" max="28" class="form-input" />
            </div>
            <div class="form-group">
              <label>Send Time (UTC)</label>
              <input v-model="form.send_time" type="time" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label>Recipients (one per line) *</label>
            <textarea
              v-model="recipientText"
              class="form-input"
              rows="3"
              placeholder="admin@example.com&#10;team@example.com"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Report Sections</label>
            <div class="checkbox-grid">
              <label v-for="t in reportTypeOptions" :key="t.value" class="check-item">
                <input type="checkbox" :value="t.value" v-model="form.report_types" />
                {{ t.label }}
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="check-item">
              <input type="checkbox" v-model="form.active" />
              Active (report will be sent on schedule)
            </label>
          </div>

          <div v-if="formError" class="error-msg">{{ formError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showModal=false">Cancel</button>
          <button class="btn btn-primary" @click="save()" :disabled="saving">
            {{ saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Report') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget=null">
      <div class="modal glass" style="max-width:420px">
        <div class="modal-header">
          <h2>Delete Report</h2>
          <button @click="deleteTarget=null" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <p>Delete "<strong>{{ deleteTarget.name }}</strong>"? This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget=null">Cancel</button>
          <button class="btn btn-danger" @click="deleteReport()">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const reports = ref([])
const loading = ref(false)
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const sending = ref(null)
const sendResult = ref(null)
const deleteTarget = ref(null)
const formError = ref('')
const recipientText = ref('')

const reportTypeOptions = [
  { value: 'orders', label: '🛒 Orders' },
  { value: 'revenue', label: '💰 Revenue' },
  { value: 'customers', label: '👥 Customers' },
  { value: 'products', label: '🛍️ Top Products' },
  { value: 'subscribers', label: '📧 Subscribers' },
]

const form = ref({
  name: '',
  frequency: 'weekly',
  day_of_week: 1,
  day_of_month: 1,
  send_time: '08:00',
  report_types: ['orders', 'revenue'],
  active: true,
})

async function load() {
  loading.value = true
  try {
    const res = await api.get('/api/scheduled-reports')
    reports.value = res.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', frequency: 'weekly', day_of_week: 1, day_of_month: 1, send_time: '08:00', report_types: ['orders', 'revenue'], active: true }
  recipientText.value = ''
  formError.value = ''
  showModal.value = true
}

function openEdit(report) {
  editing.value = report
  form.value = {
    name: report.name,
    frequency: report.frequency,
    day_of_week: report.day_of_week ?? 1,
    day_of_month: report.day_of_month ?? 1,
    send_time: report.send_time,
    report_types: [...report.report_types],
    active: !!report.active,
  }
  recipientText.value = report.recipients.join('\n')
  formError.value = ''
  showModal.value = true
}

async function save() {
  formError.value = ''
  const recipients = recipientText.value.split('\n').map(e => e.trim()).filter(Boolean)
  if (!form.value.name) { formError.value = 'Name is required'; return }
  if (!recipients.length) { formError.value = 'At least one recipient required'; return }
  if (!form.value.report_types.length) { formError.value = 'Select at least one section'; return }

  saving.value = true
  try {
    const payload = { ...form.value, recipients }
    if (editing.value) {
      await api.put(`/api/scheduled-reports/${editing.value.id}`, payload)
    } else {
      await api.post('/api/scheduled-reports', payload)
    }
    showModal.value = false
    await load()
  } catch (e) {
    formError.value = e.response?.data?.error || 'Error saving report'
  } finally {
    saving.value = false
  }
}

async function toggleActive(report) {
  await api.put(`/api/scheduled-reports/${report.id}`, { active: !report.active })
  await load()
}

async function sendNow(report) {
  sending.value = report.id
  sendResult.value = null
  try {
    const res = await api.post(`/api/scheduled-reports/${report.id}/send`)
    sendResult.value = res.data
    await load()
  } catch (e) {
    sendResult.value = { ok: false, error: e.response?.data?.error || 'Error sending' }
  } finally {
    sending.value = null
  }
}

function confirmDelete(report) {
  deleteTarget.value = report
}

async function deleteReport() {
  await api.delete(`/api/scheduled-reports/${deleteTarget.value.id}`)
  deleteTarget.value = null
  await load()
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function freqClass(f) {
  return { daily: 'badge-blue', weekly: 'badge-green', monthly: 'badge-purple' }[f] || ''
}

onMounted(load)
</script>

<style scoped>
.scheduled-reports-view { padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.subtitle { color: #888; margin: 4px 0 0; font-size: 0.9rem; }
.loading { text-align: center; padding: 60px; color: #888; }
.glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
.section { padding: 24px; }
.empty-state { text-align: center; padding: 60px; color: #888; }
.empty-icon { font-size: 3rem; margin-bottom: 12px; }
.empty-state h3 { color: #ccc; margin: 0 0 8px; }
.empty-state p { margin: 0 0 20px; }

.reports-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; }
.report-card { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.report-header { display: flex; justify-content: space-between; align-items: flex-start; }
.report-name { margin: 0 0 8px; font-size: 1.1rem; font-weight: 600; }
.report-meta { display: flex; gap: 8px; align-items: center; }
.badge { padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; }
.badge-blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
.badge-green { background: rgba(34,197,94,0.2); color: #4ade80; }
.badge-purple { background: rgba(168,85,247,0.2); color: #c084fc; }
.report-time { font-size: 0.8rem; color: #888; }
.detail-row { display: flex; align-items: flex-start; gap: 12px; font-size: 0.85rem; margin-bottom: 8px; }
.detail-label { color: #888; width: 120px; flex-shrink: 0; }
.detail-value { color: #ccc; word-break: break-all; }
.type-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.type-pill { background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; color: #ccc; }
.report-footer { display: flex; gap: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; }
.btn-sm { padding: 6px 12px; border-radius: 8px; font-size: 0.82rem; cursor: pointer; border: 1px solid rgba(255,255,255,0.15); background: none; color: #ccc; }
.btn-sm:hover { background: rgba(255,255,255,0.06); }
.btn-sm.btn-ghost { color: #ccc; }
.btn-sm.btn-danger { border-color: rgba(239,68,68,0.3); color: #ef4444; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toggle */
.toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; inset: 0; background: rgba(255,255,255,0.1); border-radius: 22px; cursor: pointer; transition: 0.2s; }
.toggle input:checked + .toggle-slider { background: #e05560; }
.toggle-slider:before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
.toggle input:checked + .toggle-slider:before { transform: translateX(18px); }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; }
.modal-header { padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { margin: 0; font-size: 1.2rem; }
.close-btn { background: none; border: none; color: #888; font-size: 1.2rem; cursor: pointer; padding: 4px; }
.modal-body { padding: 20px 24px; overflow-y: auto; }
.modal-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; gap: 12px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 0.85rem; color: #ccc; margin-bottom: 6px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 8px 12px; font-family: inherit; font-size: 0.9rem; box-sizing: border-box; }
.form-input:focus { outline: none; border-color: #e05560; }
.checkbox-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.check-item { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; color: #ccc; }
.check-item input { accent-color: #e05560; width: 16px; height: 16px; }
.error-msg { color: #e05560; font-size: 0.85rem; margin-top: 8px; }
.notice { padding: 14px 16px; border-radius: 10px; display: flex; align-items: center; }
.notice-success { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.3); color: #4ade80; }
.notice-error { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.3); color: #f87171; }
.btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; }
.btn-primary { background: #e05560; color: #fff; }
.btn-primary:hover { background: #c0392b; }
.btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; border: 1px solid rgba(255,255,255,0.12); }
.btn-danger { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
