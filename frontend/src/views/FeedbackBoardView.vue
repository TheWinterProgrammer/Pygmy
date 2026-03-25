<template>
  <div class="feedback-board-view">
    <SiteNav />

    <main class="main-content">
      <div class="container">
        <!-- Header -->
        <div class="page-hero">
          <h1>💡 Feedback Board</h1>
          <p>Share ideas, report issues, and vote for features you want to see. We read everything!</p>
        </div>

        <!-- Stats + actions row -->
        <div class="board-toolbar">
          <div class="filter-pills">
            <button :class="['pill', !filterStatus && 'active']" @click="filterStatus = ''">All</button>
            <button :class="['pill', filterStatus === 'open' && 'active']" @click="filterStatus = 'open'">💭 Open</button>
            <button :class="['pill', filterStatus === 'planned' && 'active']" @click="filterStatus = 'planned'">📌 Planned</button>
            <button :class="['pill', filterStatus === 'in_progress' && 'active']" @click="filterStatus = 'in_progress'">⚡ In Progress</button>
            <button :class="['pill', filterStatus === 'completed' && 'active']" @click="filterStatus = 'completed'">✅ Completed</button>
          </div>
          <div class="toolbar-right">
            <select v-model="sortBy" class="sort-select">
              <option value="votes">Most Voted</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <button class="btn btn-primary" @click="showForm = true">+ Submit Idea</button>
          </div>
        </div>

        <!-- Category filter -->
        <div class="category-bar" v-if="categories.length > 0">
          <button :class="['cat-pill', !filterCategory && 'active']" @click="filterCategory = ''">All Categories</button>
          <button
            v-for="cat in categories"
            :key="cat.category"
            :class="['cat-pill', filterCategory === cat.category && 'active']"
            @click="filterCategory = cat.category"
          >
            {{ cat.category }} ({{ cat.count }})
          </button>
        </div>

        <!-- Feedback List -->
        <div class="loading-bar" v-if="loading"></div>

        <div class="feedback-list">
          <!-- Stats summary -->
          <div class="stats-row" v-if="stats">
            <span>{{ stats.total }} ideas</span>
            <span>{{ stats.total_votes }} total votes</span>
          </div>

          <div v-if="items.length === 0 && !loading" class="empty-state glass">
            <div class="empty-icon">💭</div>
            <h3>No feedback yet</h3>
            <p>Be the first to share an idea!</p>
          </div>

          <div v-for="item in items" :key="item.id" class="feedback-card glass">
            <div class="card-vote">
              <button
                :class="['vote-btn', votedIds.has(item.id) && 'voted']"
                @click="vote(item)"
              >
                ▲
              </button>
              <span class="vote-count">{{ item.votes }}</span>
            </div>
            <div class="card-body">
              <div class="card-header">
                <h3 class="card-title">{{ item.title }}</h3>
                <div class="card-badges">
                  <span v-if="item.is_pinned" class="badge pin">📌 Pinned</span>
                  <span :class="['badge', `status-${item.status}`]">{{ statusLabel(item.status) }}</span>
                  <span class="badge category" v-if="item.category">{{ item.category }}</span>
                </div>
              </div>
              <p class="card-desc" v-if="item.description">{{ item.description }}</p>
              <div class="card-footer-row">
                <span class="card-author">by {{ item.author_name || 'Anonymous' }}</span>
                <span class="card-date">{{ timeAgo(item.created_at) }}</span>
                <span v-if="item.admin_response" class="has-response">💬 Admin replied</span>
              </div>
              <div class="admin-response" v-if="item.admin_response">
                <div class="response-label">💬 Response from team:</div>
                <p>{{ item.admin_response }}</p>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div class="pagination" v-if="total > limit">
            <button class="btn btn-ghost btn-sm" :disabled="offset === 0" @click="prev">← Previous</button>
            <span>Page {{ currentPage }} of {{ totalPages }}</span>
            <button class="btn btn-ghost btn-sm" :disabled="offset + limit >= total" @click="next">Next →</button>
          </div>
        </div>

        <!-- Submit Form Modal -->
        <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
          <div class="modal-box glass">
            <div class="modal-header">
              <h2>💡 Submit Your Idea</h2>
              <button class="close-btn" @click="showForm = false">✕</button>
            </div>

            <div v-if="formSubmitted" class="success-state">
              <div class="success-icon">🎉</div>
              <h3>Idea Submitted!</h3>
              <p>Thanks for sharing. Our team reviews all feedback regularly.</p>
              <button class="btn btn-primary" @click="showForm = false; formSubmitted = false">Close</button>
            </div>

            <form v-else @submit.prevent="submitFeedback" class="feedback-form">
              <div class="form-group">
                <label class="form-label">Title <span class="required">*</span></label>
                <input v-model="newItem.title" type="text" class="form-input" placeholder="A clear, concise title for your idea" maxlength="200" required />
              </div>
              <div class="form-group">
                <label class="form-label">Category</label>
                <select v-model="newItem.category" class="form-input">
                  <option value="">Select a category…</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Bug Report">Bug Report</option>
                  <option value="Improvement">Improvement</option>
                  <option value="Question">Question</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea v-model="newItem.description" class="form-input" rows="4" placeholder="Describe your idea in detail. What problem does it solve? How would it work?" maxlength="2000"></textarea>
              </div>
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label">Your Name</label>
                  <input v-model="newItem.author_name" type="text" class="form-input" placeholder="Optional" />
                </div>
                <div class="form-group">
                  <label class="form-label">Your Email</label>
                  <input v-model="newItem.author_email" type="email" class="form-input" placeholder="For updates (not shown publicly)" />
                </div>
              </div>
              <div v-if="submitError" class="error-banner">{{ submitError }}</div>
              <div class="modal-actions">
                <button type="button" class="btn btn-ghost" @click="showForm = false">Cancel</button>
                <button type="submit" class="btn btn-primary" :disabled="submitting">
                  {{ submitting ? '⏳ Submitting…' : '🚀 Submit Idea' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'
import api from '../api.js'

const items = ref([])
const stats = ref(null)
const categories = ref([])
const loading = ref(false)
const total = ref(0)
const limit = 12
const offset = ref(0)

const filterStatus = ref('')
const filterCategory = ref('')
const sortBy = ref('votes')

const currentPage = computed(() => Math.floor(offset.value / limit) + 1)
const totalPages = computed(() => Math.ceil(total.value / limit))

// Voted items stored in localStorage
const votedIds = ref(new Set(JSON.parse(localStorage.getItem('pygmy_voted_feedback') || '[]')))

watch([filterStatus, filterCategory, sortBy], () => { offset.value = 0; load() })

onMounted(load)

async function load () {
  loading.value = true
  try {
    const { data } = await api.get('/feedback', {
      params: { status: filterStatus.value || undefined, category: filterCategory.value || undefined, sort: sortBy.value, limit, offset: offset.value }
    })
    items.value = data.items || []
    stats.value = data.stats
    categories.value = data.categories || []
    total.value = data.total || 0
  } catch {}
  loading.value = false
}

function prev () { offset.value = Math.max(0, offset.value - limit); load() }
function next () { offset.value = offset.value + limit; load() }

// Stable per-browser session ID for vote deduplication
function getVoterSession () {
  let s = localStorage.getItem('pygmy_voter_session')
  if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('pygmy_voter_session', s) }
  return s
}

async function vote (item) {
  if (votedIds.value.has(item.id)) return
  try {
    const { data } = await api.post(`/feedback/${item.id}/vote`, { voter_session: getVoterSession() })
    item.votes = data.votes
    if (data.voted) {
      votedIds.value.add(item.id)
    } else {
      votedIds.value.delete(item.id)
    }
    localStorage.setItem('pygmy_voted_feedback', JSON.stringify([...votedIds.value]))
  } catch {}
}

// Submit new feedback
const showForm = ref(false)
const formSubmitted = ref(false)
const submitting = ref(false)
const submitError = ref('')
const newItem = reactive({ title: '', description: '', category: '', author_name: '', author_email: '' })

async function submitFeedback () {
  submitError.value = ''
  if (!newItem.title.trim()) { submitError.value = 'Title is required'; return }
  submitting.value = true
  try {
    await api.post('/feedback', {
      title: newItem.title,
      description: newItem.description,
      category: newItem.category || 'general',
      customer_name: newItem.author_name || 'Anonymous',
      customer_email: newItem.author_email || ''
    })
    formSubmitted.value = true
    Object.assign(newItem, { title: '', description: '', category: '', author_name: '', author_email: '' })
    await load()
  } catch (e) {
    submitError.value = e.response?.data?.error || 'Failed to submit. Please try again.'
  } finally {
    submitting.value = false
  }
}

function statusLabel (s) {
  const map = { open: 'Open', planned: 'Planned', in_progress: 'In Progress', completed: 'Completed', rejected: 'Rejected' }
  return map[s] || s
}

function timeAgo (d) {
  const ms = Date.now() - new Date(d).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
</script>

<style scoped>
.feedback-board-view { min-height: 100vh; display: flex; flex-direction: column; }
.main-content { flex: 1; padding-bottom: 3rem; }
.container { max-width: 900px; margin: 0 auto; padding: 0 1.5rem; }

.page-hero { text-align: center; padding: 3rem 0 2rem; }
.page-hero h1 { font-size: 2.4rem; margin-bottom: 0.75rem; }
.page-hero p { color: rgba(255,255,255,0.6); font-size: 1.1rem; }

.board-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.filter-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.pill {
  padding: 0.35rem 1rem;
  border: 1px solid rgba(255,255,255,0.15);
  background: transparent;
  color: rgba(255,255,255,0.6);
  border-radius: 2rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.pill.active, .pill:hover { background: var(--accent); border-color: var(--accent); color: #fff; }

.toolbar-right { display: flex; gap: 0.75rem; align-items: center; }
.sort-select {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.7);
  padding: 0.45rem 0.8rem;
  border-radius: 0.6rem;
  font-size: 0.85rem;
}

.category-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.cat-pill {
  padding: 0.25rem 0.75rem;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: rgba(255,255,255,0.5);
  border-radius: 1rem;
  cursor: pointer;
  font-size: 0.8rem;
}
.cat-pill.active { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); }

.loading-bar { height: 3px; background: var(--accent); border-radius: 2px; margin-bottom: 1rem; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }

.stats-row { font-size: 0.8rem; color: rgba(255,255,255,0.4); display: flex; gap: 1rem; margin-bottom: 1rem; }

.empty-state { text-align: center; padding: 3rem; border-radius: 1.5rem; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.empty-state h3 { margin-bottom: 0.5rem; }
.empty-state p { color: rgba(255,255,255,0.5); }

.feedback-list { display: flex; flex-direction: column; gap: 1rem; }

.feedback-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-radius: 1rem;
}

.card-vote {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 44px;
}
.vote-btn {
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vote-btn:hover { border-color: var(--accent); color: var(--accent); }
.vote-btn.voted { background: var(--accent); border-color: var(--accent); color: #fff; }
.vote-count { font-size: 0.9rem; font-weight: 700; }

.card-body { flex: 1; min-width: 0; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.card-title { font-size: 1rem; font-weight: 600; margin: 0; }
.card-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }

.badge { padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.72rem; font-weight: 600; }
.badge.pin { background: rgba(234,179,8,0.15); color: #fde047; }
.status-open { background: rgba(59,130,246,0.15); color: #93c5fd; }
.status-planned { background: rgba(139,92,246,0.15); color: #c4b5fd; }
.status-in_progress { background: rgba(249,115,22,0.15); color: #fdba74; }
.status-completed { background: rgba(34,197,94,0.15); color: #86efac; }
.status-rejected { background: rgba(239,68,68,0.15); color: #fca5a5; }
.badge.category { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }

.card-desc { font-size: 0.9rem; color: rgba(255,255,255,0.65); margin: 0 0 0.75rem; line-height: 1.5; }
.card-footer-row { display: flex; gap: 1rem; font-size: 0.78rem; color: rgba(255,255,255,0.4); align-items: center; }
.has-response { color: var(--accent); }
.admin-response {
  background: rgba(255,255,255,0.04);
  border-left: 3px solid var(--accent);
  padding: 0.75rem;
  border-radius: 0 0.5rem 0.5rem 0;
  margin-top: 0.75rem;
}
.response-label { font-size: 0.8rem; font-weight: 600; margin-bottom: 0.25rem; color: var(--accent); }
.admin-response p { margin: 0; font-size: 0.875rem; color: rgba(255,255,255,0.75); }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; font-size: 0.9rem; color: rgba(255,255,255,0.5); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal-box { padding: 2rem; border-radius: 1.5rem; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.modal-header h2 { margin: 0; font-size: 1.3rem; }
.close-btn { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 1.2rem; cursor: pointer; }

.feedback-form { display: flex; flex-direction: column; gap: 0; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-label { font-size: 0.88rem; color: rgba(255,255,255,0.6); }
.required { color: var(--accent); }
.form-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 0.6rem 0.9rem; border-radius: 0.6rem; font-size: 0.9rem; width: 100%; }
.form-input:focus { outline: none; border-color: var(--accent); }
textarea.form-input { resize: vertical; }
select.form-input option { background: #1e1e2e; }

.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
@media (max-width: 480px) { .form-grid-2 { grid-template-columns: 1fr; } }

.error-banner { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 0.75rem 1rem; border-radius: 0.6rem; font-size: 0.9rem; margin-bottom: 0.5rem; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
.btn { padding: 0.65rem 1.4rem; border-radius: 0.75rem; border: none; cursor: pointer; font-size: 0.95rem; font-weight: 600; transition: all 0.2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-ghost { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); }
.btn-sm { padding: 0.4rem 0.9rem; font-size: 0.82rem; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.success-state { text-align: center; padding: 2rem 0; }
.success-icon { font-size: 3rem; margin-bottom: 1rem; }
.success-state h3 { margin-bottom: 0.5rem; }
.success-state p { color: rgba(255,255,255,0.6); margin-bottom: 1.5rem; }
</style>
