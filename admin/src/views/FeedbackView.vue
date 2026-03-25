<template>
  <div class="feedback-view">
    <div class="page-header">
      <div>
        <h1>💬 Feedback Board</h1>
        <p class="subtitle">Manage customer feedback, ideas, and feature requests</p>
      </div>
      <div class="header-actions">
        <select v-model="filterStatus" @change="load" class="form-input" style="width:140px">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
        <input v-model="q" @input="debounceLoad" placeholder="Search…" class="form-input" style="width:200px" />
      </div>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card accent" v-if="stats.open > 0">
        <div class="stat-value">{{ stats.open || 0 }}</div>
        <div class="stat-label">Open</div>
      </div>
      <div class="stat-card" v-else>
        <div class="stat-value">{{ stats.open || 0 }}</div>
        <div class="stat-label">Open</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.planned || 0 }}</div>
        <div class="stat-label">Planned</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.in_progress || 0 }}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.completed || 0 }}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_votes || 0 }}</div>
        <div class="stat-label">Total Votes</div>
      </div>
    </div>

    <!-- Feedback list -->
    <div class="glass section">
      <div v-if="items.length === 0 && !loading" class="empty-state">
        <div class="empty-icon">💬</div>
        <p>No feedback yet.</p>
      </div>

      <div v-for="item in items" :key="item.id" class="feedback-card" :class="{ pinned: item.is_pinned }">
        <div class="feedback-meta">
          <span class="vote-badge">👍 {{ item.votes }}</span>
          <span :class="['status-pill', `status-${item.status}`]">{{ statusLabel(item.status) }}</span>
          <span class="category-badge">{{ item.category }}</span>
          <span v-if="item.is_pinned" class="pin-badge">📌 Pinned</span>
          <span class="feedback-date">{{ fmt(item.created_at) }}</span>
        </div>
        <h3 class="feedback-title">{{ item.title }}</h3>
        <p class="feedback-desc" v-if="item.description">{{ item.description }}</p>
        <div class="feedback-author">
          By <strong>{{ item.customer_name }}</strong>
          <span v-if="item.customer_email"> — {{ item.customer_email }}</span>
        </div>
        <div v-if="item.admin_response" class="admin-response">
          <strong>📣 Admin Response:</strong> {{ item.admin_response }}
        </div>
        <div class="feedback-actions">
          <button class="btn-sm btn-primary" @click="openEdit(item)">✏️ Respond</button>
          <button class="btn-sm btn-ghost" @click="togglePin(item)">
            {{ item.is_pinned ? '📌 Unpin' : '📌 Pin' }}
          </button>
          <button class="btn-sm btn-danger" @click="del(item)">🗑️</button>
        </div>
      </div>

      <div class="pagination" v-if="total > limit">
        <button @click="page--; load()" :disabled="page <= 1" class="btn-ghost">← Prev</button>
        <span>Page {{ page }} of {{ Math.ceil(total / limit) }}</span>
        <button @click="page++; load()" :disabled="page >= Math.ceil(total / limit)" class="btn-ghost">Next →</button>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editItem" class="modal-overlay" @click.self="editItem = null">
      <div class="modal glass">
        <div class="modal-header">
          <h2>Respond to Feedback</h2>
          <button class="close-btn" @click="editItem = null">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="label">Title</label>
            <input v-model="editItem.title" class="form-input" />
          </div>
          <div class="field">
            <label class="label">Status</label>
            <select v-model="editItem.status" class="form-input">
              <option value="open">Open</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div class="field">
            <label class="label">Admin Response (shown publicly)</label>
            <textarea v-model="editItem.admin_response" class="form-input" rows="4" placeholder="Leave a response visible to voters…"></textarea>
          </div>
          <div class="field">
            <label class="label">
              <input type="checkbox" v-model="editItem.is_pinned" :true-value="1" :false-value="0" />
              Pin to top of board
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="editItem = null">Cancel</button>
          <button class="btn btn-primary" @click="saveEdit" :disabled="saving">
            {{ saving ? 'Saving…' : '💾 Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../api.js'

const { get, put, del: apiDel } = useApi()

const items = ref([])
const total = ref(0)
const stats = ref(null)
const loading = ref(false)
const saving = ref(false)
const editItem = ref(null)
const filterStatus = ref('')
const q = ref('')
const page = ref(1)
const limit = 20
let debounce = null

function debounceLoad () {
  clearTimeout(debounce)
  debounce = setTimeout(() => { page.value = 1; load() }, 350)
}

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams({
      limit,
      offset: (page.value - 1) * limit,
      sort: 'votes',
    })
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (q.value) params.set('q', q.value)
    const data = await get(`/api/feedback/admin/all?${params}`)
    items.value = data.items || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

async function loadStats () {
  try {
    const data = await get('/api/feedback')
    stats.value = data.stats
  } catch {}
}

function openEdit (item) {
  editItem.value = { ...item }
}

async function saveEdit () {
  saving.value = true
  try {
    await put(`/api/feedback/${editItem.value.id}`, {
      status: editItem.value.status,
      admin_response: editItem.value.admin_response,
      is_pinned: editItem.value.is_pinned,
      title: editItem.value.title,
    })
    editItem.value = null
    await load()
    await loadStats()
  } finally { saving.value = false }
}

async function togglePin (item) {
  await put(`/api/feedback/${item.id}`, { is_pinned: item.is_pinned ? 0 : 1 })
  await load()
}

async function del (item) {
  if (!confirm(`Delete "${item.title}"?`)) return
  await apiDel(`/api/feedback/${item.id}`)
  await load()
  await loadStats()
}

function statusLabel (s) {
  const map = { open: '🟡 Open', planned: '🔵 Planned', in_progress: '🟠 In Progress', completed: '✅ Done', rejected: '❌ Rejected', archived: '⬛ Archived' }
  return map[s] || s
}

function fmt (d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => { load(); loadStats() })
</script>

<style scoped>
.feedback-view { max-width: 900px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.6rem; font-weight: 700; }
.subtitle { color: rgba(255,255,255,.5); font-size: .9rem; margin-top: .2rem; }
.header-actions { display: flex; gap: .75rem; align-items: center; }
.stats-strip { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { background: rgba(255,255,255,.05); border-radius: 1rem; padding: .8rem 1.2rem; min-width: 90px; text-align: center; }
.stat-card.accent { background: rgba(var(--accent-rgb, 220,50,70),.15); border: 1px solid rgba(var(--accent-rgb,220,50,70),.4); }
.stat-value { font-size: 1.5rem; font-weight: 700; }
.stat-label { font-size: .75rem; color: rgba(255,255,255,.5); margin-top: .2rem; }
.glass { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; }
.section { padding: 1.5rem; margin-bottom: 1.5rem; }
.empty-state { text-align: center; padding: 3rem 1rem; color: rgba(255,255,255,.4); }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.feedback-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 1rem; padding: 1.2rem; margin-bottom: 1rem; }
.feedback-card.pinned { border-color: rgba(255,200,0,.3); background: rgba(255,200,0,.04); }
.feedback-meta { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; margin-bottom: .6rem; }
.vote-badge { background: rgba(255,255,255,.1); border-radius: .5rem; padding: .2rem .6rem; font-size: .8rem; font-weight: 600; }
.category-badge { background: rgba(255,255,255,.08); border-radius: .4rem; padding: .2rem .5rem; font-size: .75rem; color: rgba(255,255,255,.6); }
.pin-badge { font-size: .75rem; color: #ffc107; }
.feedback-date { font-size: .75rem; color: rgba(255,255,255,.4); margin-left: auto; }
.status-pill { border-radius: .4rem; padding: .2rem .6rem; font-size: .75rem; font-weight: 600; }
.status-open { background: rgba(255,200,0,.2); color: #ffc107; }
.status-planned { background: rgba(66,133,244,.2); color: #4285f4; }
.status-in_progress { background: rgba(255,152,0,.2); color: #ff9800; }
.status-completed { background: rgba(76,175,80,.2); color: #4caf50; }
.status-rejected { background: rgba(244,67,54,.2); color: #f44336; }
.status-archived { background: rgba(158,158,158,.2); color: #9e9e9e; }
.feedback-title { font-size: 1rem; font-weight: 600; margin-bottom: .4rem; }
.feedback-desc { font-size: .875rem; color: rgba(255,255,255,.65); margin-bottom: .6rem; line-height: 1.5; }
.feedback-author { font-size: .8rem; color: rgba(255,255,255,.4); margin-bottom: .6rem; }
.admin-response { background: rgba(66,133,244,.1); border-left: 3px solid #4285f4; padding: .6rem .8rem; border-radius: .4rem; font-size: .85rem; margin-bottom: .6rem; }
.feedback-actions { display: flex; gap: .5rem; }
.btn-sm { padding: .3rem .8rem; border-radius: .5rem; border: none; cursor: pointer; font-size: .8rem; font-weight: 600; }
.btn-primary { background: var(--accent, hsl(355,70%,58%)); color: #fff; }
.btn-ghost { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }
.btn-danger { background: rgba(244,67,54,.2); color: #f44336; }
.btn-ghost:hover { background: rgba(255,255,255,.12); }
.loading-bar { height: 3px; background: var(--accent); border-radius: 2px; animation: loading 1s infinite; margin-bottom: 1rem; }
@keyframes loading { 0%,100%{opacity:.3} 50%{opacity:1} }
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal { width: 100%; max-width: 540px; border-radius: 1.5rem; overflow: hidden; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.1); }
.modal-header h2 { font-size: 1.1rem; font-weight: 700; }
.close-btn { background: none; border: none; color: rgba(255,255,255,.5); font-size: 1.2rem; cursor: pointer; }
.modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.1); }
.field { display: flex; flex-direction: column; gap: .4rem; }
.label { font-size: .85rem; font-weight: 600; color: rgba(255,255,255,.7); }
.form-input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; padding: .6rem .9rem; color: #fff; font-size: .9rem; width: 100%; }
textarea.form-input { resize: vertical; }
.btn { padding: .6rem 1.4rem; border-radius: .8rem; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; }
</style>
