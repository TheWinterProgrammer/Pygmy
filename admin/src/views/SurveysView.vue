<template>
  <div class="surveys-view">
    <div class="page-header">
      <div>
        <h1>📝 Survey Builder</h1>
        <p class="subtitle">Create multi-question surveys and collect responses</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ New Survey</button>
    </div>

    <!-- Stats -->
    <div class="stats-row" v-if="stats.total !== undefined">
      <div class="stat-card glass">
        <div class="stat-label">Total Surveys</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Active</div>
        <div class="stat-value accent">{{ stats.active }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Total Responses</div>
        <div class="stat-value">{{ stats.responses }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Questions Created</div>
        <div class="stat-value">{{ stats.questions }}</div>
      </div>
    </div>

    <!-- List -->
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="!surveys.length" class="glass section empty-state">
      <div class="empty-icon">📝</div>
      <h3>No surveys yet</h3>
      <p>Create your first survey to start collecting feedback.</p>
      <button class="btn btn-primary" @click="openCreate">Create Survey</button>
    </div>
    <div v-else class="surveys-grid">
      <div v-for="s in surveys" :key="s.id" class="glass survey-card">
        <div class="survey-card-header">
          <div>
            <h3 class="survey-title">{{ s.title }}</h3>
            <p class="survey-desc text-muted">{{ s.description || 'No description' }}</p>
          </div>
          <span class="status-badge" :class="s.status">{{ s.status }}</span>
        </div>
        <div class="survey-meta">
          <span class="meta-pill">❓ {{ s.question_count }} questions</span>
          <span class="meta-pill">👥 {{ s.response_count }} responses</span>
          <span class="meta-pill">🔗 /surveys/{{ s.slug }}</span>
        </div>
        <div class="survey-actions">
          <a class="btn btn-ghost btn-sm" :href="`${siteUrl}/surveys/${s.slug}`" target="_blank" v-if="s.status === 'active'">🌐 Preview</a>
          <button class="btn btn-ghost btn-sm" @click="viewAnalytics(s)">📊 Analytics</button>
          <button class="btn btn-ghost btn-sm" @click="editQuestions(s)">❓ Questions</button>
          <button class="btn btn-ghost btn-sm" @click="openEdit(s)">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(s)">🗑️</button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal glass">
        <h2>{{ editing ? 'Edit Survey' : 'New Survey' }}</h2>
        <form @submit.prevent="save">
          <div class="form-group">
            <label>Title *</label>
            <input v-model="form.title" class="input" required placeholder="Customer Satisfaction Survey" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="form.description" class="input" rows="2" placeholder="Brief description shown to respondents" />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select v-model="form.status" class="input">
              <option value="draft">Draft</option>
              <option value="active">Active (accepting responses)</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div class="form-group">
            <label>Success Message</label>
            <textarea v-model="form.success_message" class="input" rows="2" placeholder="Thank you for your response!" />
          </div>
          <div class="form-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.show_progress" />
              Show progress bar
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.allow_multiple" />
              Allow multiple responses
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save Survey' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Questions Modal -->
    <div v-if="showQuestionsModal" class="modal-overlay modal-large" @click.self="showQuestionsModal = false">
      <div class="modal glass modal-xl">
        <div class="modal-header">
          <h2>❓ Questions — {{ currentSurvey?.title }}</h2>
          <button class="btn btn-primary btn-sm" @click="addQuestion">+ Add Question</button>
        </div>

        <div v-if="questionsLoading" class="loading">Loading…</div>
        <div v-else-if="!questions.length" class="empty-state small">
          <p>No questions yet. Add your first question above.</p>
        </div>

        <div v-else class="questions-list">
          <div v-for="(q, idx) in questions" :key="q.id || idx" class="glass question-card" :class="{ editing: q._editing }">
            <div class="question-header">
              <div class="question-num">{{ idx + 1 }}</div>
              <div class="question-info" v-if="!q._editing" @click="q._editing = true">
                <div class="question-text">{{ q.text }}</div>
                <div class="question-meta">
                  <span class="type-badge">{{ q.type }}</span>
                  <span v-if="q.required" class="required-badge">required</span>
                </div>
              </div>
              <div class="question-editor" v-else>
                <input v-model="q.text" class="input" placeholder="Question text" />
                <div class="editor-row">
                  <select v-model="q.type" class="input input-sm">
                    <option value="text">Short Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="email">Email</option>
                    <option value="number">Number</option>
                    <option value="radio">Multiple Choice (radio)</option>
                    <option value="checkbox">Checkboxes</option>
                    <option value="select">Dropdown</option>
                    <option value="rating">Star Rating (1–5)</option>
                    <option value="scale">Scale (1–10)</option>
                    <option value="nps">NPS (0–10)</option>
                    <option value="date">Date</option>
                  </select>
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="q.required" /> Required
                  </label>
                </div>
                <!-- Options for radio/checkbox/select -->
                <div v-if="['radio', 'checkbox', 'select'].includes(q.type)" class="options-editor">
                  <label class="form-label-sm">Options (one per line)</label>
                  <textarea
                    :value="(q.options || []).join('\n')"
                    @input="q.options = $event.target.value.split('\n').map(s => s.trim()).filter(Boolean)"
                    class="input" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                </div>
                <input v-model="q.placeholder" class="input input-sm" placeholder="Placeholder text (optional)" />
              </div>
              <div class="question-actions">
                <template v-if="q._editing">
                  <button class="btn btn-primary btn-sm" @click="saveQuestion(q)">💾</button>
                  <button class="btn btn-ghost btn-sm" @click="q._editing = false">✕</button>
                </template>
                <template v-else>
                  <button class="btn btn-ghost btn-sm" @click="moveQuestion(idx, -1)" :disabled="idx === 0">↑</button>
                  <button class="btn btn-ghost btn-sm" @click="moveQuestion(idx, 1)" :disabled="idx === questions.length - 1">↓</button>
                  <button class="btn btn-ghost btn-sm" @click="q._editing = true">✏️</button>
                  <button class="btn btn-ghost btn-sm danger" @click="deleteQuestion(q, idx)">🗑️</button>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showQuestionsModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Analytics Modal -->
    <div v-if="showAnalyticsModal" class="modal-overlay" @click.self="showAnalyticsModal = false">
      <div class="modal glass modal-xl">
        <div class="modal-header">
          <h2>📊 Analytics — {{ currentSurvey?.title }}</h2>
          <div class="response-count-badge">{{ analytics?.total_responses || 0 }} responses</div>
        </div>

        <div v-if="analyticsLoading" class="loading">Loading analytics…</div>
        <div v-else-if="!analytics?.questions?.length" class="empty-state small">
          <p>No responses yet.</p>
        </div>

        <div v-else class="analytics-list">
          <div v-for="(q, idx) in analytics.questions" :key="q.id" class="glass analytic-card">
            <div class="analytic-header">
              <span class="question-num">{{ idx + 1 }}</span>
              <div>
                <div class="question-text">{{ q.text }}</div>
                <span class="type-badge">{{ q.type }} · {{ q.total_answers }} answer{{ q.total_answers !== 1 ? 's' : '' }}</span>
              </div>
            </div>

            <!-- NPS score -->
            <div v-if="q.type === 'nps' && q.nps_score !== null" class="nps-result">
              <div class="nps-score" :class="npsClass(q.nps_score)">{{ q.nps_score }}</div>
              <div class="nps-label">NPS Score</div>
            </div>

            <!-- Bar chart for radio/checkbox/select/rating/scale -->
            <div v-if="['radio', 'checkbox', 'select', 'rating', 'scale', 'nps'].includes(q.type) && q.type_data?.length" class="bar-chart">
              <div v-for="item in q.type_data" :key="item.answer_text || item.score" class="bar-row">
                <span class="bar-label">{{ item.answer_text || item.score }}</span>
                <div class="bar-wrap">
                  <div class="bar-fill" :style="{ width: barWidth(item.count, q.total_answers) + '%' }"></div>
                </div>
                <span class="bar-count">{{ item.count }}</span>
              </div>
            </div>

            <!-- Text answers -->
            <div v-else-if="q.type_data?.length" class="text-answers">
              <div v-for="a in q.type_data.slice(0, 10)" :key="a.submitted_at" class="text-answer-row">
                <span class="answer-text">{{ a.answer_text }}</span>
                <span class="answer-date text-muted">{{ fmtDate(a.submitted_at) }}</span>
              </div>
              <div v-if="q.type_data.length > 10" class="text-muted" style="font-size:0.82rem;margin-top:6px">
                + {{ q.type_data.length - 10 }} more
              </div>
            </div>

            <div v-else class="text-muted small">No answers yet</div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showAnalyticsModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal glass modal-sm">
        <h3>Delete Survey</h3>
        <p>Delete "<strong>{{ deleting.title }}</strong>"? All questions and responses will be lost.</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleting = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const siteUrl = window.__PYGMY_SITE_URL__ || (window.location.protocol + '//' + window.location.hostname + ':5174')

const surveys = ref([])
const stats = ref({})
const loading = ref(true)
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const deleting = ref(null)
const currentSurvey = ref(null)

// Questions
const showQuestionsModal = ref(false)
const questions = ref([])
const questionsLoading = ref(false)

// Analytics
const showAnalyticsModal = ref(false)
const analytics = ref(null)
const analyticsLoading = ref(false)

const form = ref({
  title: '', description: '', status: 'draft',
  show_progress: true, allow_multiple: false,
  success_message: 'Thank you for your response!'
})

async function load() {
  loading.value = true
  try {
    const [{ data: s }, { data: st }] = await Promise.all([
      api.get('/surveys'),
      api.get('/surveys/stats'),
    ])
    surveys.value = s
    stats.value = st
  } finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  form.value = { title: '', description: '', status: 'draft', show_progress: true, allow_multiple: false, success_message: 'Thank you for your response!' }
  showModal.value = true
}

function openEdit(s) {
  editing.value = s
  form.value = { ...s, show_progress: !!s.show_progress, allow_multiple: !!s.allow_multiple }
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/surveys/${editing.value.id}`, form.value)
    } else {
      await api.post('/surveys', form.value)
    }
    closeModal()
    load()
  } finally { saving.value = false }
}

function confirmDelete(s) { deleting.value = s }
async function doDelete() {
  await api.delete(`/surveys/${deleting.value.id}`)
  deleting.value = null
  load()
}

// Questions
async function editQuestions(s) {
  currentSurvey.value = s
  showQuestionsModal.value = true
  questionsLoading.value = true
  try {
    const { data } = await api.get(`/surveys/${s.id}/questions`)
    questions.value = data.map(q => ({ ...q, _editing: false }))
  } finally { questionsLoading.value = false }
}

function addQuestion() {
  questions.value.push({
    _new: true, _editing: true,
    text: '', type: 'text', options: [], required: true, sort_order: questions.value.length, placeholder: ''
  })
}

async function saveQuestion(q) {
  const payload = { text: q.text, type: q.type, options: q.options || [], required: q.required ? 1 : 0, sort_order: questions.value.indexOf(q), placeholder: q.placeholder || '' }
  if (q._new) {
    const { data } = await api.post(`/surveys/${currentSurvey.value.id}/questions`, payload)
    const idx = questions.value.indexOf(q)
    questions.value[idx] = { ...data, options: data.options || [], _editing: false }
  } else {
    const { data } = await api.put(`/surveys/${currentSurvey.value.id}/questions/${q.id}`, payload)
    const idx = questions.value.indexOf(q)
    questions.value[idx] = { ...data, options: data.options || [], _editing: false }
  }
  load() // refresh counts
}

async function deleteQuestion(q, idx) {
  if (q._new) { questions.value.splice(idx, 1); return }
  if (!confirm('Delete this question?')) return
  await api.delete(`/surveys/${currentSurvey.value.id}/questions/${q.id}`)
  questions.value.splice(idx, 1)
  load()
}

async function moveQuestion(idx, dir) {
  const newIdx = idx + dir
  if (newIdx < 0 || newIdx >= questions.value.length) return
  const tmp = questions.value[idx]
  questions.value[idx] = questions.value[newIdx]
  questions.value[newIdx] = tmp
  // Persist order
  const order = questions.value.map(q => q.id).filter(Boolean)
  await api.post(`/surveys/${currentSurvey.value.id}/questions/reorder`, { order })
}

// Analytics
async function viewAnalytics(s) {
  currentSurvey.value = s
  showAnalyticsModal.value = true
  analyticsLoading.value = true
  try {
    const { data } = await api.get(`/surveys/${s.id}/analytics`)
    analytics.value = data
  } finally { analyticsLoading.value = false }
}

function barWidth(count, total) {
  if (!total) return 0
  return Math.round((count / total) * 100)
}

function npsClass(score) {
  if (score >= 50) return 'nps-good'
  if (score >= 0) return 'nps-ok'
  return 'nps-bad'
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.surveys-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.5rem; }
.survey-card { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.survey-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.survey-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 4px; }
.survey-desc { font-size: 0.85rem; margin: 0; }
.status-badge { font-size: 0.72rem; padding: 3px 10px; border-radius: 12px; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
.status-badge.active { background: rgba(16,185,129,0.2); color: #10b981; }
.status-badge.draft { background: rgba(156,163,175,0.15); color: #9ca3af; }
.status-badge.closed { background: rgba(239,68,68,0.15); color: #ef4444; }
.survey-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.meta-pill { font-size: 0.78rem; background: rgba(255,255,255,0.07); padding: 3px 10px; border-radius: 12px; }
.survey-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.stats-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { padding: 1.2rem 1.5rem; min-width: 130px; }
.stat-label { font-size: 0.8rem; color: var(--text-muted, #9ca3af); margin-bottom: 4px; }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.stat-value.accent { color: var(--accent); }
.empty-state { text-align: center; padding: 3rem 2rem; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.empty-state.small { padding: 1.5rem; }
.questions-list { display: flex; flex-direction: column; gap: 1rem; max-height: 60vh; overflow-y: auto; }
.question-card { padding: 1rem 1.2rem; }
.question-header { display: flex; align-items: flex-start; gap: 1rem; }
.question-num { min-width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; }
.question-info { flex: 1; cursor: pointer; }
.question-info:hover .question-text { color: var(--accent); }
.question-text { font-weight: 600; }
.question-meta { display: flex; gap: 8px; margin-top: 4px; }
.type-badge { font-size: 0.72rem; background: rgba(99,102,241,0.2); color: #818cf8; padding: 2px 8px; border-radius: 8px; }
.required-badge { font-size: 0.72rem; background: rgba(239,68,68,0.1); color: #ef4444; padding: 2px 8px; border-radius: 8px; }
.question-editor { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.editor-row { display: flex; gap: 12px; align-items: center; }
.options-editor { display: flex; flex-direction: column; gap: 6px; }
.form-label-sm { font-size: 0.82rem; color: var(--text-muted, #9ca3af); }
.question-actions { display: flex; gap: 6px; }
.analytics-list { display: flex; flex-direction: column; gap: 1.2rem; max-height: 65vh; overflow-y: auto; }
.analytic-card { padding: 1.2rem 1.5rem; }
.analytic-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 1rem; }
.bar-chart { display: flex; flex-direction: column; gap: 8px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-label { min-width: 100px; font-size: 0.85rem; text-align: right; }
.bar-wrap { flex: 1; background: rgba(255,255,255,0.07); border-radius: 4px; height: 20px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.4s; }
.bar-count { min-width: 30px; font-size: 0.82rem; font-weight: 600; }
.nps-result { display: flex; align-items: center; gap: 12px; margin-bottom: 1rem; }
.nps-score { font-size: 2.5rem; font-weight: 800; }
.nps-score.nps-good { color: #10b981; }
.nps-score.nps-ok { color: #f59e0b; }
.nps-score.nps-bad { color: #ef4444; }
.nps-label { font-size: 0.85rem; color: var(--text-muted, #9ca3af); }
.text-answers { display: flex; flex-direction: column; gap: 8px; }
.text-answer-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.88rem; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.response-count-badge { background: rgba(99,102,241,0.2); color: #818cf8; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; }
.form-row { display: flex; gap: 1.5rem; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; }
.modal-large { align-items: flex-start; padding-top: 2rem; }
.modal-xl { width: 800px; max-width: 95vw; max-height: 90vh; overflow-y: auto; }
.modal-sm { width: 420px; max-width: 95vw; }
.input-sm { max-width: 180px; }
.btn-danger { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
.btn-danger:hover { background: rgba(239,68,68,0.25); }
.text-muted { color: var(--text-muted, #9ca3af); }
.small { font-size: 0.85rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.subtitle { color: var(--text-muted, #9ca3af); margin: 4px 0 0; font-size: 0.9rem; }
</style>
