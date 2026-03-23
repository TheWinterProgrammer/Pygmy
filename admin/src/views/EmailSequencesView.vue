<template>
  <div>
    <div class="page-header">
      <h1>📧 Email Sequences</h1>
      <button class="btn btn-primary" @click="openCreate">+ New Sequence</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.total }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num accent">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.total_enrollments }}</div>
        <div class="stat-label">Total Enrolled</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.active_enrollments }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.completed_enrollments }}</div>
        <div class="stat-label">Completed</div>
      </div>
    </div>

    <!-- Sequences list -->
    <div class="glass section">
      <div v-if="loading" class="loading-bar"></div>
      <div v-else-if="!sequences.length" class="empty-state">
        <p>No sequences yet. Create your first email drip campaign!</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Trigger</th>
            <th>Steps</th>
            <th>Enrolled</th>
            <th>Completed</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="seq in sequences" :key="seq.id">
            <td>
              <strong>{{ seq.name }}</strong>
              <div class="text-muted small" v-if="seq.description">{{ seq.description }}</div>
            </td>
            <td>
              <span class="badge badge-ghost">{{ triggerLabel(seq.trigger_type) }}</span>
            </td>
            <td>{{ seq.step_count }}</td>
            <td>{{ seq.active_enrollments }}</td>
            <td>{{ seq.completed_enrollments }}</td>
            <td>
              <span class="badge" :class="statusClass(seq.status)">{{ seq.status }}</span>
            </td>
            <td>
              <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
                <button class="btn btn-sm btn-ghost" @click="openEdit(seq)">✏️</button>
                <button class="btn btn-sm btn-ghost" @click="openSteps(seq)">📝 Steps</button>
                <button class="btn btn-sm btn-ghost" @click="openEnrollments(seq)">👥</button>
                <button v-if="seq.status === 'draft'" class="btn btn-sm btn-primary" @click="setStatus(seq, 'active')">▶ Start</button>
                <button v-else-if="seq.status === 'active'" class="btn btn-sm btn-ghost" @click="setStatus(seq, 'paused')">⏸</button>
                <button v-else-if="seq.status === 'paused'" class="btn btn-sm btn-primary" @click="setStatus(seq, 'active')">▶ Resume</button>
                <button class="btn btn-sm btn-danger" @click="confirmDelete(seq)">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal glass">
        <h2>{{ editing ? 'Edit Sequence' : 'New Sequence' }}</h2>
        <div class="form-group">
          <label>Name *</label>
          <input v-model="form.name" class="input" placeholder="Welcome Sequence" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input v-model="form.description" class="input" placeholder="Optional description" />
        </div>
        <div class="form-group">
          <label>Trigger</label>
          <select v-model="form.trigger_type" class="input">
            <option value="manual">Manual (enroll manually)</option>
            <option value="subscriber_join">Subscriber joins newsletter</option>
            <option value="order_placed">Customer places order</option>
            <option value="customer_register">Customer registers</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveSequence" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Steps Modal -->
    <div class="modal-overlay" v-if="showSteps" @click.self="showSteps = false">
      <div class="modal glass wide-modal">
        <h2>📝 Steps — {{ activeSeq?.name }}</h2>
        <p class="text-muted small">Emails are sent in order. Set delays between steps.</p>

        <div v-if="steps.length === 0" class="empty-state small">No steps yet.</div>

        <div v-for="(step, idx) in steps" :key="step.id" class="step-card glass">
          <div class="step-header">
            <span class="step-num">Step {{ step.step_number }}</span>
            <span class="text-muted small" v-if="idx === 0">Sent immediately (or after initial delay)</span>
            <span class="text-muted small" v-else>
              After {{ step.delay_days }}d {{ step.delay_hours }}h
            </span>
            <button class="btn btn-sm btn-danger" @click="deleteStep(step)">🗑️</button>
          </div>
          <div class="form-group">
            <label>Subject</label>
            <input v-model="step.subject" class="input" placeholder="Hi {{name}}, welcome!" @blur="saveStep(step)" />
          </div>
          <div class="form-group">
            <label>Delay (days / hours after previous step)</label>
            <div style="display:flex;gap:0.5rem">
              <input v-model.number="step.delay_days" type="number" min="0" class="input" style="width:80px" @blur="saveStep(step)" />
              <span style="line-height:2.5rem">days</span>
              <input v-model.number="step.delay_hours" type="number" min="0" max="23" class="input" style="width:80px" @blur="saveStep(step)" />
              <span style="line-height:2.5rem">hours</span>
            </div>
          </div>
          <div class="form-group">
            <label>Email Body (HTML)</label>
            <textarea v-model="step.body" class="input" rows="8" placeholder="<p>Hi {{name}},</p><p>...</p>" @blur="saveStep(step)" style="font-family:monospace;font-size:0.8rem"></textarea>
            <div class="hint">Use <code>{{name}}</code> and <code>{{email}}</code> as placeholders.</div>
          </div>
        </div>

        <!-- Add Step -->
        <div class="glass section" style="margin-top:1rem">
          <h3 style="margin:0 0 0.75rem">+ Add Step</h3>
          <div class="form-group">
            <label>Subject</label>
            <input v-model="newStep.subject" class="input" placeholder="Email subject…" />
          </div>
          <div class="form-group">
            <label>Delay after previous step</label>
            <div style="display:flex;gap:0.5rem">
              <input v-model.number="newStep.delay_days" type="number" min="0" class="input" style="width:80px" />
              <span style="line-height:2.5rem">days</span>
              <input v-model.number="newStep.delay_hours" type="number" min="0" max="23" class="input" style="width:80px" />
              <span style="line-height:2.5rem">hours</span>
            </div>
          </div>
          <div class="form-group">
            <label>Body (HTML)</label>
            <textarea v-model="newStep.body" class="input" rows="6" placeholder="<p>Hi {{name}},</p>" style="font-family:monospace;font-size:0.8rem"></textarea>
          </div>
          <button class="btn btn-primary" @click="addStep" :disabled="!newStep.subject.trim()">Add Step</button>
        </div>

        <div class="modal-actions" style="margin-top:1rem">
          <button class="btn btn-ghost" @click="showSteps = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Enrollments Modal -->
    <div class="modal-overlay" v-if="showEnroll" @click.self="showEnroll = false">
      <div class="modal glass wide-modal">
        <h2>👥 Enrollments — {{ activeSeq?.name }}</h2>

        <!-- Enroll form -->
        <div class="glass section" style="margin-bottom:1rem">
          <h3 style="margin:0 0 0.75rem">Enroll Emails</h3>
          <div class="form-group">
            <label>Email addresses (one per line)</label>
            <textarea v-model="enrollEmails" class="input" rows="4" placeholder="user@example.com&#10;another@example.com"></textarea>
          </div>
          <button class="btn btn-primary" @click="doEnroll" :disabled="enrolling">
            {{ enrolling ? 'Enrolling…' : 'Enroll' }}
          </button>
          <span v-if="enrollResult" class="text-muted small" style="margin-left:1rem">{{ enrollResult }}</span>
        </div>

        <!-- Enrollment list -->
        <div v-if="enrollments.length === 0" class="empty-state small">No enrollments yet.</div>
        <table v-else class="data-table">
          <thead>
            <tr><th>Email</th><th>Name</th><th>Next Step</th><th>Next Send</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="e in enrollments" :key="e.id">
              <td>{{ e.email }}</td>
              <td>{{ e.name || '—' }}</td>
              <td>{{ e.next_step }}</td>
              <td>{{ e.status === 'active' ? formatDate(e.next_send_at) : '—' }}</td>
              <td><span class="badge" :class="enrollStatusClass(e.status)">{{ e.status }}</span></td>
              <td><button class="btn btn-sm btn-danger" @click="removeEnrollment(e)">✕</button></td>
            </tr>
          </tbody>
        </table>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showEnroll = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api.js'

const sequences = ref([])
const stats = ref(null)
const loading = ref(true)
const saving = ref(false)

const showModal = ref(false)
const showSteps = ref(false)
const showEnroll = ref(false)
const editing = ref(null)
const activeSeq = ref(null)
const steps = ref([])
const enrollments = ref([])
const enrollEmails = ref('')
const enrolling = ref(false)
const enrollResult = ref('')

const form = ref({ name: '', description: '', trigger_type: 'manual' })
const newStep = ref({ subject: '', body: '', delay_days: 1, delay_hours: 0 })

function triggerLabel(t) {
  const map = { manual: 'Manual', subscriber_join: 'Newsletter Join', order_placed: 'Order Placed', customer_register: 'Registration' }
  return map[t] || t
}

function statusClass(s) {
  return { active: 'badge-success', paused: 'badge-warning', draft: 'badge-ghost' }[s] || 'badge-ghost'
}

function enrollStatusClass(s) {
  return { active: 'badge-success', completed: 'badge-info', unsubscribed: 'badge-ghost', failed: 'badge-danger' }[s] || 'badge-ghost'
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

async function load() {
  loading.value = true
  try {
    const [seqRes, statsRes] = await Promise.all([
      api.get('/email-sequences'),
      api.get('/email-sequences/stats')
    ])
    sequences.value = seqRes.data
    stats.value = statsRes.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', description: '', trigger_type: 'manual' }
  showModal.value = true
}

function openEdit(seq) {
  editing.value = seq
  form.value = { name: seq.name, description: seq.description || '', trigger_type: seq.trigger_type }
  showModal.value = true
}

async function saveSequence() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/email-sequences/${editing.value.id}`, form.value)
    } else {
      await api.post('/email-sequences', form.value)
    }
    showModal.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function setStatus(seq, status) {
  await api.put(`/email-sequences/${seq.id}/status`, { status })
  await load()
}

async function confirmDelete(seq) {
  if (!confirm(`Delete "${seq.name}"? This will remove all enrollments.`)) return
  await api.delete(`/email-sequences/${seq.id}`)
  await load()
}

async function openSteps(seq) {
  activeSeq.value = seq
  newStep.value = { subject: '', body: '', delay_days: 1, delay_hours: 0 }
  const res = await api.get(`/email-sequences/${seq.id}`)
  steps.value = res.data.steps || []
  showSteps.value = true
}

async function addStep() {
  await api.post(`/email-sequences/${activeSeq.value.id}/steps`, newStep.value)
  newStep.value = { subject: '', body: '', delay_days: 1, delay_hours: 0 }
  const res = await api.get(`/email-sequences/${activeSeq.value.id}`)
  steps.value = res.data.steps || []
  await load()
}

async function saveStep(step) {
  await api.put(`/email-sequences/${activeSeq.value.id}/steps/${step.id}`, {
    subject: step.subject, body: step.body, delay_days: step.delay_days, delay_hours: step.delay_hours
  })
}

async function deleteStep(step) {
  if (!confirm('Delete this step?')) return
  await api.delete(`/email-sequences/${activeSeq.value.id}/steps/${step.id}`)
  const res = await api.get(`/email-sequences/${activeSeq.value.id}`)
  steps.value = res.data.steps || []
  await load()
}

async function openEnrollments(seq) {
  activeSeq.value = seq
  enrollEmails.value = ''
  enrollResult.value = ''
  const res = await api.get(`/email-sequences/${seq.id}/enrollments`)
  enrollments.value = res.data.rows || []
  showEnroll.value = true
}

async function doEnroll() {
  const lines = enrollEmails.value.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return
  enrolling.value = true
  try {
    const emails = lines.map(e => ({ email: e }))
    const res = await api.post(`/email-sequences/${activeSeq.value.id}/enroll`, { emails })
    enrollResult.value = `✓ Enrolled: ${res.data.enrolled}, Skipped: ${res.data.skipped}`
    enrollEmails.value = ''
    const res2 = await api.get(`/email-sequences/${activeSeq.value.id}/enrollments`)
    enrollments.value = res2.data.rows || []
  } finally {
    enrolling.value = false
  }
}

async function removeEnrollment(e) {
  await api.delete(`/email-sequences/${activeSeq.value.id}/enrollments/${e.id}`)
  const res = await api.get(`/email-sequences/${activeSeq.value.id}/enrollments`)
  enrollments.value = res.data.rows || []
}

onMounted(load)
</script>

<style scoped>
.stats-strip { display:flex; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap }
.stat-card { padding:1rem 1.5rem; text-align:center; min-width:120px }
.stat-num { font-size:1.8rem; font-weight:700 }
.stat-num.accent { color:var(--accent) }
.stat-label { font-size:0.75rem; color:var(--muted); margin-top:0.25rem }
.badge { padding:0.2rem 0.6rem; border-radius:1rem; font-size:0.75rem; font-weight:600 }
.badge-success { background:rgba(34,197,94,0.2); color:#4ade80 }
.badge-warning { background:rgba(234,179,8,0.2); color:#facc15 }
.badge-ghost { background:rgba(255,255,255,0.08); color:var(--muted) }
.badge-info { background:rgba(59,130,246,0.2); color:#60a5fa }
.badge-danger { background:rgba(239,68,68,0.2); color:#f87171 }
.step-card { padding:1rem 1.25rem; margin-bottom:1rem; border-radius:1rem }
.step-header { display:flex; align-items:center; gap:1rem; margin-bottom:0.75rem }
.step-num { font-weight:700; color:var(--accent) }
.wide-modal { max-width:780px; max-height:85vh; overflow-y:auto }
.hint { font-size:0.75rem; color:var(--muted); margin-top:0.25rem }
.hint code { background:rgba(255,255,255,0.08); padding:0.1rem 0.3rem; border-radius:4px }
.empty-state.small { padding:1rem; text-align:center; color:var(--muted) }
</style>
