<template>
  <div class="social-scheduler">
    <div class="view-header">
      <div>
        <h1>📅 Social Media Scheduler</h1>
        <p class="subtitle">Plan, compose, and schedule posts across social platforms</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="showAccountsModal = true">⚙️ Accounts</button>
        <button class="btn-primary" @click="openNewPost">✏️ New Post</button>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <span class="stat-num">{{ stats.accounts }}</span>
        <span class="stat-label">Connected Accounts</span>
      </div>
      <div class="stat-card">
        <span class="stat-num accent">{{ stats.scheduled }}</span>
        <span class="stat-label">Scheduled</span>
      </div>
      <div class="stat-card">
        <span class="stat-num green">{{ stats.published }}</span>
        <span class="stat-label">Published</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ stats.draft }}</span>
        <span class="stat-label">Drafts</span>
      </div>
      <div class="stat-card" v-if="stats.upcoming > 0">
        <span class="stat-num amber">{{ stats.upcoming }}</span>
        <span class="stat-label">Due This Week</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button :class="['tab-btn', {active: tab==='queue'}]" @click="tab='queue'">📋 Queue</button>
      <button :class="['tab-btn', {active: tab==='calendar'}]" @click="tab='calendar'">🗓️ Calendar</button>
    </div>

    <!-- Queue Tab -->
    <div v-if="tab==='queue'">
      <!-- Filters -->
      <div class="filter-row">
        <select v-model="filterStatus" @change="loadPosts">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>
        <select v-model="filterAccount" @change="loadPosts">
          <option value="">All Accounts</option>
          <option v-for="a in accounts" :key="a.id" :value="a.id">{{ platformEmoji(a.platform) }} {{ a.name }}</option>
        </select>
      </div>

      <div v-if="posts.length === 0" class="empty-state">No posts yet. Click "New Post" to get started.</div>

      <div class="posts-list">
        <div class="post-card" v-for="p in posts" :key="p.id">
          <div class="post-platform">
            <span class="platform-badge" :class="p.platform">{{ platformEmoji(p.platform) }} {{ p.platform || 'No account' }}</span>
            <span class="status-badge" :class="p.status">{{ p.status }}</span>
          </div>
          <div class="post-content">{{ truncate(p.content, 120) }}</div>
          <div class="post-meta">
            <span v-if="p.scheduled_at">🕐 {{ fmtDate(p.scheduled_at) }}</span>
            <span v-else-if="p.published_at">✅ Published {{ fmtDate(p.published_at) }}</span>
            <span v-else>📝 Draft</span>
            <span v-if="p.link_url" class="link-pill">🔗 Has link</span>
            <span v-if="p.media_url" class="link-pill">🖼️ Has media</span>
          </div>
          <div class="post-actions">
            <button class="btn-xs" @click="editPost(p)">✏️ Edit</button>
            <button class="btn-xs green" v-if="p.status !== 'published'" @click="publishNow(p)">📤 Publish Now</button>
            <button class="btn-xs danger" @click="deletePost(p.id)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Calendar Tab -->
    <div v-if="tab==='calendar'" class="calendar-tab">
      <div class="cal-nav">
        <button class="btn-secondary" @click="changeMonth(-1)">◀</button>
        <span class="cal-label">{{ monthName }} {{ calYear }}</span>
        <button class="btn-secondary" @click="changeMonth(1)">▶</button>
      </div>
      <div class="cal-grid">
        <div class="cal-day-header" v-for="d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="d">{{ d }}</div>
        <div class="cal-cell" v-for="cell in calendarCells" :key="cell.date || cell.empty"
             :class="{empty: cell.empty, today: cell.isToday}">
          <div class="cal-date" v-if="!cell.empty">{{ cell.day }}</div>
          <div class="cal-event" v-for="ev in cell.events" :key="ev.id"
               :class="ev.platform" @click="editPostById(ev.id)">
            {{ platformEmoji(ev.platform) }} {{ truncate(ev.content, 30) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Compose / Edit Modal -->
    <div class="modal-overlay" v-if="showPostModal" @click.self="showPostModal=false">
      <div class="modal-card wide">
        <div class="modal-header">
          <h2>{{ editingPost?.id ? 'Edit Post' : 'New Post' }}</h2>
          <button class="modal-close" @click="showPostModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Account</label>
            <select v-model="form.account_id">
              <option value="">— No account / draft —</option>
              <option v-for="a in accounts" :key="a.id" :value="a.id">{{ platformEmoji(a.platform) }} {{ a.name }} (@{{ a.handle }})</option>
            </select>
          </div>
          <div class="form-group">
            <label>Content <span class="char-count">{{ form.content.length }}/280</span></label>
            <textarea v-model="form.content" rows="5" maxlength="500" placeholder="What's on your mind?"></textarea>
          </div>
          <div class="form-group">
            <label>Link URL (optional)</label>
            <input type="url" v-model="form.link_url" placeholder="https://…" />
          </div>
          <div class="form-group">
            <label>Media URL (optional)</label>
            <input type="url" v-model="form.media_url" placeholder="https://cdn.example.com/image.jpg" />
          </div>
          <div class="form-group">
            <label>Schedule Date/Time</label>
            <input type="datetime-local" v-model="form.scheduled_at" />
            <small>Leave blank to save as draft</small>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select v-model="form.status">
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showPostModal=false">Cancel</button>
          <button class="btn-primary" @click="savePost" :disabled="saving">{{ saving ? 'Saving…' : 'Save Post' }}</button>
        </div>
      </div>
    </div>

    <!-- Accounts Manager Modal -->
    <div class="modal-overlay" v-if="showAccountsModal" @click.self="showAccountsModal=false">
      <div class="modal-card">
        <div class="modal-header">
          <h2>⚙️ Connected Accounts</h2>
          <button class="modal-close" @click="showAccountsModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="accounts-list">
            <div class="account-row" v-for="a in accounts" :key="a.id">
              <span class="platform-emoji">{{ platformEmoji(a.platform) }}</span>
              <div class="account-info">
                <strong>{{ a.name }}</strong>
                <span class="account-handle">@{{ a.handle }} · {{ a.platform }}</span>
              </div>
              <span class="status-dot" :class="{green: a.active, gray: !a.active}"></span>
              <button class="btn-xs danger" @click="deleteAccount(a.id)">🗑️</button>
            </div>
            <div class="empty-state small" v-if="accounts.length === 0">No accounts added yet</div>
          </div>
          <hr />
          <h3>Add Account</h3>
          <div class="form-grid-2">
            <div class="form-group">
              <label>Platform</label>
              <select v-model="newAccount.platform">
                <option value="twitter">🐦 Twitter / X</option>
                <option value="instagram">📸 Instagram</option>
                <option value="facebook">📘 Facebook</option>
                <option value="linkedin">💼 LinkedIn</option>
                <option value="mastodon">🐘 Mastodon</option>
                <option value="bluesky">🦋 Bluesky</option>
                <option value="threads">🧵 Threads</option>
                <option value="tiktok">🎵 TikTok</option>
              </select>
            </div>
            <div class="form-group">
              <label>Display Name</label>
              <input v-model="newAccount.name" placeholder="My Twitter Account" />
            </div>
            <div class="form-group">
              <label>Handle / Username</label>
              <input v-model="newAccount.handle" placeholder="@handle" />
            </div>
            <div class="form-group">
              <label>API Token (optional)</label>
              <input type="password" v-model="newAccount.access_token" placeholder="Bearer token…" />
            </div>
          </div>
          <button class="btn-primary" @click="addAccount" :disabled="saving">Add Account</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api.js'

const tab = ref('queue')
const posts = ref([])
const accounts = ref([])
const stats = ref(null)
const filterStatus = ref('')
const filterAccount = ref('')
const saving = ref(false)
const showPostModal = ref(false)
const showAccountsModal = ref(false)
const editingPost = ref(null)

const form = ref({ account_id: '', content: '', link_url: '', media_url: '', scheduled_at: '', status: 'draft' })
const newAccount = ref({ platform: 'twitter', name: '', handle: '', access_token: '' })

// Calendar
const calYear = ref(new Date().getFullYear())
const calMonth = ref(new Date().getMonth() + 1)
const calendarEvents = ref([])

const monthName = computed(() => {
  return new Date(calYear.value, calMonth.value - 1, 1).toLocaleString('default', { month: 'long' })
})

async function loadStats() {
  const { data } = await api.get('/social-scheduler/stats')
  stats.value = data
}

async function loadAccounts() {
  const { data } = await api.get('/social-scheduler/accounts')
  accounts.value = data
}

async function loadPosts() {
  const params = {}
  if (filterStatus.value) params.status = filterStatus.value
  if (filterAccount.value) params.account_id = filterAccount.value
  const { data } = await api.get('/social-scheduler', { params })
  posts.value = data.posts
}

async function loadCalendar() {
  const { data } = await api.get('/social-scheduler/calendar', { params: { year: calYear.value, month: calMonth.value } })
  calendarEvents.value = data
}

function changeMonth(delta) {
  calMonth.value += delta
  if (calMonth.value > 12) { calMonth.value = 1; calYear.value++ }
  if (calMonth.value < 1) { calMonth.value = 12; calYear.value-- }
  loadCalendar()
}

const calendarCells = computed(() => {
  const firstDay = new Date(calYear.value, calMonth.value - 1, 1).getDay()
  const daysInMonth = new Date(calYear.value, calMonth.value, 0).getDate()
  const offset = (firstDay + 6) % 7 // Mon-start
  const today = new Date().toISOString().split('T')[0]
  const cells = []
  for (let i = 0; i < offset; i++) cells.push({ empty: true })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear.value}-${String(calMonth.value).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({
      day: d,
      date: dateStr,
      isToday: dateStr === today,
      events: calendarEvents.value.filter(e => e.scheduled_at?.startsWith(dateStr))
    })
  }
  return cells
})

function platformEmoji(platform) {
  const map = { twitter: '🐦', instagram: '📸', facebook: '📘', linkedin: '💼', mastodon: '🐘', bluesky: '🦋', threads: '🧵', tiktok: '🎵' }
  return map[platform] || '📱'
}

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : s }
function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function openNewPost() {
  editingPost.value = null
  form.value = { account_id: '', content: '', link_url: '', media_url: '', scheduled_at: '', status: 'draft' }
  showPostModal.value = true
}

function editPost(p) {
  editingPost.value = p
  form.value = {
    account_id: p.account_id ?? '',
    content: p.content,
    link_url: p.link_url ?? '',
    media_url: p.media_url ?? '',
    scheduled_at: p.scheduled_at ? p.scheduled_at.replace(' ', 'T').slice(0, 16) : '',
    status: p.status
  }
  showPostModal.value = true
}

async function editPostById(id) {
  const p = posts.value.find(x => x.id === id)
  if (p) { editPost(p); return }
  // load from API
  const { data } = await api.get(`/social-scheduler?limit=1&offset=0`) // fallback
  editPost(data.posts.find(x => x.id === id) || { id })
}

async function savePost() {
  saving.value = true
  try {
    const payload = {
      account_id: form.value.account_id || null,
      content: form.value.content,
      link_url: form.value.link_url,
      media_url: form.value.media_url,
      scheduled_at: form.value.scheduled_at || null,
      status: form.value.status
    }
    if (form.value.scheduled_at && form.value.status === 'draft') payload.status = 'scheduled'
    if (editingPost.value?.id) {
      await api.put(`/social-scheduler/${editingPost.value.id}`, payload)
    } else {
      await api.post('/social-scheduler', payload)
    }
    showPostModal.value = false
    await Promise.all([loadPosts(), loadStats(), loadCalendar()])
  } finally {
    saving.value = false
  }
}

async function publishNow(p) {
  if (!confirm(`Publish this post now?\n\n${p.content.slice(0, 80)}`)) return
  await api.post(`/social-scheduler/${p.id}/publish`)
  await Promise.all([loadPosts(), loadStats()])
}

async function deletePost(id) {
  if (!confirm('Delete this post?')) return
  await api.delete(`/social-scheduler/${id}`)
  await Promise.all([loadPosts(), loadStats()])
}

async function addAccount() {
  if (!newAccount.value.name || !newAccount.value.handle) return alert('Name and handle required')
  saving.value = true
  try {
    await api.post('/social-scheduler/accounts', newAccount.value)
    newAccount.value = { platform: 'twitter', name: '', handle: '', access_token: '' }
    await loadAccounts()
    await loadStats()
  } finally {
    saving.value = false
  }
}

async function deleteAccount(id) {
  if (!confirm('Delete this account? Posts linked to it will lose their association.')) return
  await api.delete(`/social-scheduler/accounts/${id}`)
  await loadAccounts()
  await loadStats()
}

onMounted(() => Promise.all([loadStats(), loadAccounts(), loadPosts(), loadCalendar()]))
</script>

<style scoped>
.view-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:.75rem; }
.view-header h1 { margin:0; }
.subtitle { color:var(--text-muted); margin:.25rem 0 0; font-size:.9rem; }
.header-actions { display:flex; gap:.5rem; }
.stats-strip { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; }
.stat-card { background:var(--surface); border:1px solid rgba(255,255,255,.08); border-radius:.75rem; padding:.75rem 1.25rem; min-width:120px; text-align:center; }
.stat-num { display:block; font-size:1.6rem; font-weight:700; }
.stat-num.accent { color:var(--accent); }
.stat-num.green { color:#4ade80; }
.stat-num.amber { color:#fbbf24; }
.stat-label { font-size:.75rem; color:var(--text-muted); }
.tabs-bar { display:flex; gap:.5rem; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,.08); padding-bottom:.5rem; }
.tab-btn { background:none; border:none; color:var(--text-muted); padding:.5rem 1rem; cursor:pointer; border-radius:.5rem; font-size:.9rem; }
.tab-btn.active { background:rgba(255,255,255,.07); color:var(--text); }
.filter-row { display:flex; gap:.75rem; margin-bottom:1rem; flex-wrap:wrap; }
.filter-row select { background:var(--surface); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.4rem .75rem; border-radius:.5rem; font-size:.85rem; }
.posts-list { display:flex; flex-direction:column; gap:.75rem; }
.post-card { background:var(--surface); border:1px solid rgba(255,255,255,.08); border-radius:.75rem; padding:1rem 1.25rem; }
.post-platform { display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem; }
.platform-badge { font-size:.75rem; padding:.2rem .6rem; border-radius:999px; background:rgba(255,255,255,.07); }
.status-badge { font-size:.7rem; padding:.2rem .6rem; border-radius:999px; font-weight:600; text-transform:uppercase; }
.status-badge.draft { background:rgba(255,255,255,.08); color:var(--text-muted); }
.status-badge.scheduled { background:rgba(251,191,36,.15); color:#fbbf24; }
.status-badge.published { background:rgba(74,222,128,.15); color:#4ade80; }
.status-badge.failed { background:rgba(239,68,68,.15); color:#ef4444; }
.post-content { font-size:.9rem; color:var(--text); margin-bottom:.5rem; line-height:1.4; }
.post-meta { font-size:.75rem; color:var(--text-muted); display:flex; gap:.75rem; flex-wrap:wrap; align-items:center; margin-bottom:.6rem; }
.link-pill { background:rgba(255,255,255,.07); padding:.1rem .5rem; border-radius:999px; }
.post-actions { display:flex; gap:.5rem; }
.btn-xs { font-size:.75rem; padding:.3rem .7rem; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.05); color:var(--text); border-radius:.4rem; cursor:pointer; }
.btn-xs.green { color:#4ade80; border-color:rgba(74,222,128,.3); }
.btn-xs.danger { color:#ef4444; border-color:rgba(239,68,68,.3); }
.empty-state { text-align:center; color:var(--text-muted); padding:2rem; font-size:.9rem; }
.empty-state.small { padding:.75rem; }

/* Calendar */
.calendar-tab { }
.cal-nav { display:flex; align-items:center; gap:1rem; margin-bottom:1rem; }
.cal-label { font-size:1.1rem; font-weight:600; min-width:160px; text-align:center; }
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.cal-day-header { text-align:center; font-size:.7rem; color:var(--text-muted); padding:.4rem; font-weight:600; text-transform:uppercase; }
.cal-cell { background:var(--surface); border-radius:.4rem; min-height:80px; padding:.3rem .4rem; font-size:.8rem; }
.cal-cell.empty { background:transparent; }
.cal-cell.today { border:1px solid var(--accent); }
.cal-date { font-weight:700; margin-bottom:.2rem; }
.cal-event { background:rgba(255,255,255,.07); border-radius:.25rem; padding:.15rem .3rem; margin:.1rem 0; font-size:.7rem; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cal-event:hover { background:rgba(255,255,255,.13); }

/* Accounts modal */
.accounts-list { display:flex; flex-direction:column; gap:.5rem; margin-bottom:1rem; }
.account-row { display:flex; align-items:center; gap:.75rem; background:rgba(255,255,255,.04); border-radius:.5rem; padding:.5rem .75rem; }
.platform-emoji { font-size:1.3rem; }
.account-info { flex:1; }
.account-info strong { display:block; font-size:.9rem; }
.account-handle { font-size:.75rem; color:var(--text-muted); }
.status-dot { width:8px; height:8px; border-radius:50%; }
.status-dot.green { background:#4ade80; }
.status-dot.gray { background:#6b7280; }
.char-count { font-size:.75rem; color:var(--text-muted); float:right; }

/* Shared form styles */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:1rem; }
.modal-card { background:var(--surface); border:1px solid rgba(255,255,255,.12); border-radius:1.25rem; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; }
.modal-card.wide { max-width:640px; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid rgba(255,255,255,.07); }
.modal-header h2 { margin:0; font-size:1.1rem; }
.modal-close { background:none; border:none; color:var(--text-muted); font-size:1.1rem; cursor:pointer; }
.modal-body { padding:1.25rem 1.5rem; display:flex; flex-direction:column; gap:1rem; }
.modal-footer { padding:1rem 1.5rem; border-top:1px solid rgba(255,255,255,.07); display:flex; justify-content:flex-end; gap:.75rem; }
.form-group { display:flex; flex-direction:column; gap:.35rem; }
.form-group label { font-size:.8rem; color:var(--text-muted); font-weight:500; }
.form-group input, .form-group select, .form-group textarea {
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text);
  border-radius:.5rem; padding:.5rem .75rem; font-size:.9rem;
}
.form-group small { font-size:.75rem; color:var(--text-muted); }
.form-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
@media (max-width:500px) { .form-grid-2 { grid-template-columns:1fr; } }
.btn-primary { background:var(--accent); color:#fff; border:none; padding:.55rem 1.25rem; border-radius:.6rem; cursor:pointer; font-size:.9rem; font-weight:600; }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-secondary { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.5rem 1rem; border-radius:.6rem; cursor:pointer; font-size:.85rem; }
hr { border:none; border-top:1px solid rgba(255,255,255,.07); margin:.5rem 0; }
h3 { font-size:.95rem; margin:.5rem 0; color:var(--text-muted); }
</style>
