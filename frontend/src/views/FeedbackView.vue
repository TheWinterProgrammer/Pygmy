<template>
  <div class="feedback-page">
    <SiteNav />

    <!-- Hero -->
    <section class="feedback-hero">
      <div class="container">
        <h1>{{ title || 'Feedback & Ideas' }}</h1>
        <p class="hero-sub">{{ subtitle || 'Share your ideas and vote on what you want to see next.' }}</p>
      </div>
    </section>

    <div class="container feedback-container">
      <!-- Filters & Submit -->
      <div class="top-bar">
        <div class="filter-tabs">
          <button
            v-for="s in statusFilters" :key="s.value"
            :class="['filter-tab', { active: filterStatus === s.value }]"
            @click="filterStatus = s.value; load()"
          >{{ s.label }}</button>
        </div>
        <div class="sort-submit">
          <select v-model="sort" @change="load" class="sort-select">
            <option value="votes">Most Voted</option>
            <option value="newest">Newest</option>
          </select>
          <button class="btn-accent" @click="showForm = !showForm">
            {{ showForm ? '✕ Cancel' : '+ Submit Idea' }}
          </button>
        </div>
      </div>

      <!-- Submit Form -->
      <div v-if="showForm" class="glass submit-card">
        <h3 class="form-title">💡 Share Your Idea</h3>
        <div class="field">
          <label class="label">Title *</label>
          <input v-model="newItem.title" class="form-input" maxlength="150" placeholder="Brief summary of your idea…" />
        </div>
        <div class="field">
          <label class="label">Details</label>
          <textarea v-model="newItem.description" class="form-input" rows="4" placeholder="Explain your idea or describe the problem it solves…"></textarea>
        </div>
        <div class="form-row">
          <div class="field">
            <label class="label">Category</label>
            <select v-model="newItem.category" class="form-input">
              <option value="general">General</option>
              <option value="feature">Feature Request</option>
              <option value="bug">Bug Report</option>
              <option value="design">Design</option>
              <option value="performance">Performance</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field">
            <label class="label">Your Name</label>
            <input v-model="newItem.customer_name" class="form-input" placeholder="Anonymous" />
          </div>
          <div class="field">
            <label class="label">Email (optional)</label>
            <input v-model="newItem.customer_email" type="email" class="form-input" placeholder="for updates" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-accent" @click="submitFeedback" :disabled="submitting || !newItem.title">
            {{ submitting ? '⏳ Submitting…' : '🚀 Submit Idea' }}
          </button>
        </div>
        <div v-if="submitSuccess" class="success-msg">✅ Thank you! Your idea has been submitted.</div>
        <div v-if="submitError" class="error-msg">{{ submitError }}</div>
      </div>

      <!-- Stats row -->
      <div class="stats-row" v-if="stats">
        <div class="stat-chip">{{ stats.total || 0 }} total</div>
        <div class="stat-chip open">{{ stats.open || 0 }} open</div>
        <div class="stat-chip planned">{{ stats.planned || 0 }} planned</div>
        <div class="stat-chip done">{{ stats.completed || 0 }} done</div>
        <div class="stat-chip">{{ stats.total_votes || 0 }} votes</div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-bar"></div>

      <!-- Feedback items -->
      <div class="feedback-list">
        <div
          v-for="item in items" :key="item.id"
          :class="['feedback-card glass', { pinned: item.is_pinned }]"
        >
          <!-- Vote Button -->
          <div class="vote-col">
            <button
              :class="['vote-btn', { voted: votedItems.has(item.id) }]"
              @click="vote(item)"
              :disabled="votingId === item.id"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
            <span class="vote-count">{{ localVotes[item.id] ?? item.votes }}</span>
          </div>

          <!-- Content -->
          <div class="feedback-content">
            <div class="feedback-meta">
              <span :class="['status-dot', `dot-${item.status}`]"></span>
              <span class="status-text">{{ statusLabel(item.status) }}</span>
              <span class="category-tag">{{ item.category }}</span>
              <span v-if="item.is_pinned" class="pinned-tag">📌 Pinned</span>
            </div>
            <h3 class="feedback-title">{{ item.title }}</h3>
            <p class="feedback-desc" v-if="item.description">{{ item.description }}</p>
            <div v-if="item.admin_response" class="admin-response">
              <span class="response-label">📣 Update:</span>
              {{ item.admin_response }}
            </div>
            <div class="feedback-footer">
              By <strong>{{ item.customer_name }}</strong>
              · {{ fmt(item.created_at) }}
            </div>
          </div>
        </div>

        <div v-if="items.length === 0 && !loading" class="empty-state">
          <div class="empty-emoji">💡</div>
          <p>No feedback yet. Be the first to share an idea!</p>
        </div>
      </div>

      <div class="load-more" v-if="hasMore">
        <button class="btn-ghost" @click="loadMore" :disabled="loading">Load More</button>
      </div>
    </div>

    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'

const items = ref([])
const stats = ref(null)
const loading = ref(false)
const title = ref('')
const subtitle = ref('')
const filterStatus = ref('')
const sort = ref('votes')
const page = ref(0)
const limit = 20
const hasMore = ref(false)

const showForm = ref(false)
const submitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref('')

const votedItems = ref(new Set())
const localVotes = reactive({})
const votingId = ref(null)

// Stable per-browser session ID
const SESSION_KEY = 'pygmy_feedback_session'
let sessionId = localStorage.getItem(SESSION_KEY)
if (!sessionId) {
  sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36)
  localStorage.setItem(SESSION_KEY, sessionId)
}

const newItem = reactive({
  title: '', description: '', category: 'general', customer_name: '', customer_email: ''
})

const statusFilters = [
  { label: 'All', value: '' },
  { label: '🟡 Open', value: 'open' },
  { label: '🔵 Planned', value: 'planned' },
  { label: '🟠 In Progress', value: 'in_progress' },
  { label: '✅ Done', value: 'completed' },
]

async function load () {
  loading.value = true
  page.value = 0
  try {
    const params = new URLSearchParams({ sort: sort.value, limit, offset: 0 })
    if (filterStatus.value) params.set('status', filterStatus.value)
    const res = await fetch(`${API}/api/feedback?${params}`)
    const data = await res.json()
    items.value = data.items || []
    stats.value = data.stats
    hasMore.value = (data.total || 0) > limit
    // Restore vote states from localStorage
    const stored = JSON.parse(localStorage.getItem('pygmy_feedback_votes') || '[]')
    votedItems.value = new Set(stored)
  } finally { loading.value = false }
}

async function loadMore () {
  page.value++
  loading.value = true
  try {
    const params = new URLSearchParams({ sort: sort.value, limit, offset: page.value * limit })
    if (filterStatus.value) params.set('status', filterStatus.value)
    const res = await fetch(`${API}/api/feedback?${params}`)
    const data = await res.json()
    items.value = [...items.value, ...(data.items || [])]
    hasMore.value = items.value.length < (data.total || 0)
  } finally { loading.value = false }
}

async function submitFeedback () {
  if (!newItem.title.trim()) return
  submitting.value = true
  submitError.value = ''
  submitSuccess.value = false
  try {
    const res = await fetch(`${API}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newItem }),
    })
    if (!res.ok) throw new Error(await res.text())
    submitSuccess.value = true
    Object.assign(newItem, { title: '', description: '', category: 'general', customer_name: '', customer_email: '' })
    setTimeout(() => { showForm.value = false; load() }, 1500)
  } catch (e) {
    submitError.value = e.message || 'Failed to submit. Try again.'
  } finally { submitting.value = false }
}

async function vote (item) {
  if (votingId.value) return
  votingId.value = item.id
  try {
    const res = await fetch(`${API}/api/feedback/${item.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_session: sessionId }),
    })
    const data = await res.json()
    localVotes[item.id] = data.votes

    const voted = new Set(votedItems.value)
    if (data.voted) voted.add(item.id)
    else voted.delete(item.id)
    votedItems.value = voted
    localStorage.setItem('pygmy_feedback_votes', JSON.stringify(Array.from(voted)))
  } finally { votingId.value = null }
}

async function loadSettings () {
  try {
    const res = await fetch(`${API}/api/settings`)
    const s = await res.json()
    title.value = s.feedback_board_title || 'Feedback & Ideas'
    subtitle.value = s.feedback_board_subtitle || 'Share your ideas and vote on what you want to see next.'
  } catch {}
}

function statusLabel (s) {
  const map = { open: 'Open', planned: 'Planned', in_progress: 'In Progress', completed: 'Completed', rejected: 'Rejected', archived: 'Archived' }
  return map[s] || s
}

function fmt (d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => { loadSettings(); load() })
</script>

<style scoped>
.feedback-page { background: hsl(228, 4%, 10%); min-height: 100vh; color: #fff; }
.feedback-hero { background: linear-gradient(135deg, rgba(220,50,70,.15) 0%, transparent 60%); padding: 6rem 1rem 3rem; text-align: center; }
.feedback-hero h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: .75rem; }
.hero-sub { font-size: 1.1rem; color: rgba(255,255,255,.6); max-width: 500px; margin: 0 auto; }
.container { max-width: 820px; margin: 0 auto; padding: 0 1rem; }
.feedback-container { padding-top: 2rem; padding-bottom: 4rem; }
.top-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
.filter-tabs { display: flex; gap: .4rem; flex-wrap: wrap; }
.filter-tab { padding: .4rem .85rem; border-radius: 2rem; border: 1px solid rgba(255,255,255,.15); background: transparent; color: rgba(255,255,255,.7); font-size: .85rem; cursor: pointer; transition: all .15s; }
.filter-tab.active, .filter-tab:hover { background: rgba(255,255,255,.12); color: #fff; }
.sort-submit { display: flex; gap: .75rem; align-items: center; }
.sort-select { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; padding: .4rem .8rem; color: #fff; font-size: .875rem; cursor: pointer; }
.btn-accent { background: var(--accent, hsl(355,70%,58%)); color: #fff; border: none; border-radius: 2rem; padding: .5rem 1.2rem; font-size: .9rem; font-weight: 600; cursor: pointer; transition: opacity .15s; }
.btn-accent:hover { opacity: .88; }
.glass { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; }
.submit-card { padding: 1.5rem; margin-bottom: 2rem; }
.form-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 1.2rem; }
.field { display: flex; flex-direction: column; gap: .4rem; margin-bottom: .8rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
@media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
.label { font-size: .8rem; font-weight: 600; color: rgba(255,255,255,.6); }
.form-input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; padding: .6rem .9rem; color: #fff; font-size: .9rem; width: 100%; }
textarea.form-input { resize: vertical; }
.form-actions { margin-top: 1rem; }
.success-msg { color: #4caf50; font-size: .875rem; margin-top: .75rem; }
.error-msg { color: #f44336; font-size: .875rem; margin-top: .75rem; }
.stats-row { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-chip { background: rgba(255,255,255,.08); border-radius: 2rem; padding: .3rem .8rem; font-size: .8rem; color: rgba(255,255,255,.7); }
.stat-chip.open { background: rgba(255,200,0,.12); color: #ffc107; }
.stat-chip.planned { background: rgba(66,133,244,.12); color: #4285f4; }
.stat-chip.done { background: rgba(76,175,80,.12); color: #4caf50; }
.loading-bar { height: 3px; background: var(--accent); border-radius: 2px; animation: loading 1s infinite; margin-bottom: 1rem; }
@keyframes loading { 0%,100%{opacity:.3} 50%{opacity:1} }
.feedback-list { display: flex; flex-direction: column; gap: 1rem; }
.feedback-card { display: flex; gap: 1.2rem; padding: 1.25rem; transition: border-color .15s; }
.feedback-card:hover { border-color: rgba(255,255,255,.18); }
.feedback-card.pinned { border-color: rgba(255,200,0,.25); }
.vote-col { display: flex; flex-direction: column; align-items: center; gap: .35rem; min-width: 44px; }
.vote-btn { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.15); border-radius: .75rem; padding: .4rem; cursor: pointer; color: rgba(255,255,255,.6); transition: all .15s; display: flex; align-items: center; justify-content: center; }
.vote-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
.vote-btn.voted { background: rgba(220,50,70,.2); border-color: rgba(220,50,70,.5); color: var(--accent, hsl(355,70%,58%)); }
.vote-count { font-size: 1rem; font-weight: 700; }
.feedback-content { flex: 1; min-width: 0; }
.feedback-meta { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; margin-bottom: .5rem; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-open { background: #ffc107; }
.dot-planned { background: #4285f4; }
.dot-in_progress { background: #ff9800; }
.dot-completed { background: #4caf50; }
.dot-rejected { background: #f44336; }
.dot-archived { background: #9e9e9e; }
.status-text { font-size: .75rem; color: rgba(255,255,255,.5); font-weight: 600; }
.category-tag { background: rgba(255,255,255,.08); border-radius: .3rem; padding: .15rem .45rem; font-size: .7rem; color: rgba(255,255,255,.5); }
.pinned-tag { font-size: .75rem; color: #ffc107; }
.feedback-title { font-size: 1rem; font-weight: 700; margin-bottom: .4rem; }
.feedback-desc { font-size: .875rem; color: rgba(255,255,255,.65); line-height: 1.55; margin-bottom: .6rem; }
.admin-response { background: rgba(66,133,244,.1); border-left: 3px solid #4285f4; padding: .5rem .75rem; border-radius: .4rem; font-size: .85rem; color: rgba(255,255,255,.8); margin-bottom: .6rem; }
.response-label { font-weight: 700; color: #4285f4; margin-right: .3rem; }
.feedback-footer { font-size: .75rem; color: rgba(255,255,255,.4); }
.empty-state { text-align: center; padding: 4rem 1rem; color: rgba(255,255,255,.4); }
.empty-emoji { font-size: 3rem; margin-bottom: 1rem; }
.load-more { text-align: center; margin-top: 2rem; }
.btn-ghost { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); border: 1px solid rgba(255,255,255,.15); border-radius: 2rem; padding: .6rem 1.5rem; font-size: .9rem; cursor: pointer; }
</style>
