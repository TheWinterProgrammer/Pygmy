<template>
  <div class="canned-responses">
    <div class="view-header">
      <div>
        <h1>💬 Canned Responses</h1>
        <p class="subtitle">Reusable message templates for live chat and support tickets</p>
      </div>
      <button class="btn-primary" @click="openNew">+ New Response</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat-card">
        <span class="stat-num green">{{ stats.active }}</span>
        <span class="stat-label">Active</span>
      </div>
      <div class="stat-card">
        <span class="stat-num accent">{{ stats.totalUse }}</span>
        <span class="stat-label">Total Uses</span>
      </div>
    </div>

    <!-- Top Used -->
    <div class="top-used" v-if="stats?.topUsed?.length">
      <h3>🔥 Most Used</h3>
      <div class="top-chips">
        <span class="top-chip" v-for="r in stats.topUsed" :key="r.id" @click="editById(r.id)">
          {{ r.title }} <span class="use-num">×{{ r.use_count }}</span>
        </span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-row">
      <input v-model="filterQ" @input="loadResponses" placeholder="🔍 Search…" class="search-input" />
      <select v-model="filterCategory" @change="loadResponses">
        <option value="">All Categories</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="filterScope" @change="loadResponses">
        <option value="">All Scopes</option>
        <option value="chat">Live Chat</option>
        <option value="support">Support Tickets</option>
        <option value="both">Both</option>
      </select>
    </div>

    <!-- Category Groups -->
    <div v-for="group in groupedResponses" :key="group.category" class="response-group">
      <div class="group-header">
        <span class="group-name">{{ group.category }}</span>
        <span class="group-count">{{ group.items.length }}</span>
      </div>
      <div class="response-card" v-for="r in group.items" :key="r.id">
        <div class="response-meta">
          <strong class="response-title">{{ r.title }}</strong>
          <span class="shortcut" v-if="r.shortcut">/{{ r.shortcut }}</span>
          <span class="scope-badge" :class="r.scope">{{ r.scope }}</span>
          <span class="status-dot" :class="{green: r.active, gray: !r.active}"></span>
        </div>
        <div class="response-body">{{ truncate(r.body, 150) }}</div>
        <div class="response-footer">
          <span class="use-count">Used {{ r.use_count }} times</span>
          <div class="response-actions">
            <button class="btn-xs" @click="copyBody(r.body)">📋 Copy</button>
            <button class="btn-xs" @click="editResponse(r)">✏️ Edit</button>
            <button class="btn-xs danger" @click="deleteResponse(r.id)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <div class="empty-state" v-if="responses.length === 0">
      No canned responses yet. Create some to speed up support!
    </div>

    <!-- Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal=false">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ editing?.id ? 'Edit Response' : 'New Canned Response' }}</h2>
          <button class="modal-close" @click="showModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Title</label>
            <input v-model="form.title" placeholder="e.g. Refund Policy Explanation" />
          </div>
          <div class="form-group">
            <label>Shortcut <small>(type /shortcut to insert quickly)</small></label>
            <input v-model="form.shortcut" placeholder="refund-policy" />
          </div>
          <div class="form-group">
            <label>Category</label>
            <input v-model="form.category" list="cat-list" placeholder="general" />
            <datalist id="cat-list">
              <option v-for="c in categories" :key="c" :value="c" />
            </datalist>
          </div>
          <div class="form-group">
            <label>Available in</label>
            <select v-model="form.scope">
              <option value="both">Both (Chat + Support)</option>
              <option value="chat">Live Chat only</option>
              <option value="support">Support Tickets only</option>
            </select>
          </div>
          <div class="form-group">
            <label>Response Body</label>
            <textarea v-model="form.body" rows="6" placeholder="Type the canned message here…"></textarea>
          </div>
          <div class="form-group toggle-row">
            <label>Active</label>
            <label class="toggle">
              <input type="checkbox" v-model="form.active" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showModal=false">Cancel</button>
          <button class="btn-primary" @click="saveResponse" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>

    <!-- Copy toast -->
    <div class="toast" v-if="showToast">✅ Copied to clipboard!</div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api.js'

const responses = ref([])
const categories = ref([])
const stats = ref(null)
const filterQ = ref('')
const filterCategory = ref('')
const filterScope = ref('')
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const showToast = ref(false)

const form = ref({ title: '', shortcut: '', body: '', category: 'general', scope: 'both', active: true })

async function loadStats() {
  const { data } = await api.get('/canned-responses/stats')
  stats.value = data
}

async function loadCategories() {
  const { data } = await api.get('/canned-responses/categories')
  categories.value = data
}

async function loadResponses() {
  const params = {}
  if (filterQ.value) params.q = filterQ.value
  if (filterCategory.value) params.category = filterCategory.value
  if (filterScope.value) params.scope = filterScope.value
  const { data } = await api.get('/canned-responses', { params })
  responses.value = data
}

const groupedResponses = computed(() => {
  const groups = {}
  for (const r of responses.value) {
    if (!groups[r.category]) groups[r.category] = []
    groups[r.category].push(r)
  }
  return Object.entries(groups).map(([category, items]) => ({ category, items }))
})

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : s }

function openNew() {
  editing.value = null
  form.value = { title: '', shortcut: '', body: '', category: 'general', scope: 'both', active: true }
  showModal.value = true
}

function editResponse(r) {
  editing.value = r
  form.value = { title: r.title, shortcut: r.shortcut, body: r.body, category: r.category, scope: r.scope, active: !!r.active }
  showModal.value = true
}

async function editById(id) {
  const r = responses.value.find(x => x.id === id)
  if (r) editResponse(r)
}

async function saveResponse() {
  if (!form.value.title || !form.value.body) return alert('Title and body required')
  saving.value = true
  try {
    if (editing.value?.id) {
      await api.put(`/canned-responses/${editing.value.id}`, form.value)
    } else {
      await api.post('/canned-responses', form.value)
    }
    showModal.value = false
    await Promise.all([loadResponses(), loadStats(), loadCategories()])
  } finally {
    saving.value = false
  }
}

async function deleteResponse(id) {
  if (!confirm('Delete this canned response?')) return
  await api.delete(`/canned-responses/${id}`)
  await Promise.all([loadResponses(), loadStats()])
}

async function copyBody(body) {
  await navigator.clipboard.writeText(body)
  showToast.value = true
  setTimeout(() => showToast.value = false, 2000)
}

onMounted(() => Promise.all([loadStats(), loadCategories(), loadResponses()]))
</script>

<style scoped>
.view-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:.75rem; }
.view-header h1 { margin:0; }
.subtitle { color:var(--text-muted); font-size:.9rem; margin:.25rem 0 0; }
.stats-strip { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.25rem; }
.stat-card { background:var(--surface); border:1px solid rgba(255,255,255,.08); border-radius:.75rem; padding:.75rem 1.25rem; min-width:100px; text-align:center; }
.stat-num { display:block; font-size:1.6rem; font-weight:700; }
.stat-num.accent { color:var(--accent); }
.stat-num.green { color:#4ade80; }
.stat-label { font-size:.75rem; color:var(--text-muted); }
.top-used { margin-bottom:1.25rem; }
.top-used h3 { font-size:.85rem; color:var(--text-muted); margin:0 0 .5rem; }
.top-chips { display:flex; flex-wrap:wrap; gap:.5rem; }
.top-chip { background:rgba(255,255,255,.07); border-radius:999px; padding:.25rem .8rem; font-size:.8rem; cursor:pointer; }
.top-chip:hover { background:rgba(255,255,255,.12); }
.use-num { color:var(--accent); margin-left:.3rem; font-weight:600; }
.filter-row { display:flex; gap:.75rem; margin-bottom:1.25rem; flex-wrap:wrap; }
.search-input { flex:1; min-width:160px; background:var(--surface); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.4rem .75rem; border-radius:.5rem; font-size:.85rem; }
.filter-row select { background:var(--surface); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.4rem .75rem; border-radius:.5rem; font-size:.85rem; }
.response-group { margin-bottom:1.5rem; }
.group-header { display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem; }
.group-name { font-weight:700; font-size:.9rem; text-transform:capitalize; }
.group-count { background:rgba(255,255,255,.1); border-radius:999px; font-size:.7rem; padding:.1rem .5rem; }
.response-card { background:var(--surface); border:1px solid rgba(255,255,255,.07); border-radius:.75rem; padding:.9rem 1.1rem; margin-bottom:.5rem; }
.response-meta { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; margin-bottom:.4rem; }
.response-title { font-size:.9rem; }
.shortcut { font-family:monospace; font-size:.75rem; background:rgba(255,255,255,.08); padding:.1rem .4rem; border-radius:.3rem; color:var(--accent); }
.scope-badge { font-size:.7rem; padding:.15rem .5rem; border-radius:999px; font-weight:600; }
.scope-badge.chat { background:rgba(96,165,250,.15); color:#60a5fa; }
.scope-badge.support { background:rgba(167,139,250,.15); color:#a78bfa; }
.scope-badge.both { background:rgba(74,222,128,.15); color:#4ade80; }
.status-dot { width:8px; height:8px; border-radius:50%; margin-left:auto; }
.status-dot.green { background:#4ade80; }
.status-dot.gray { background:#6b7280; }
.response-body { font-size:.85rem; color:var(--text-muted); margin-bottom:.6rem; line-height:1.4; white-space:pre-wrap; }
.response-footer { display:flex; align-items:center; gap:.75rem; }
.use-count { font-size:.75rem; color:var(--text-muted); flex:1; }
.response-actions { display:flex; gap:.4rem; }
.btn-xs { font-size:.75rem; padding:.3rem .6rem; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.05); color:var(--text); border-radius:.4rem; cursor:pointer; }
.btn-xs.danger { color:#ef4444; border-color:rgba(239,68,68,.3); }
.empty-state { text-align:center; color:var(--text-muted); padding:2rem; font-size:.9rem; }
/* Modal */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:1rem; }
.modal-card { background:var(--surface); border:1px solid rgba(255,255,255,.12); border-radius:1.25rem; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; }
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
.form-group small { font-size:.73rem; color:var(--text-muted); }
.toggle-row { flex-direction:row; align-items:center; gap:1rem; }
.toggle { position:relative; display:inline-block; width:40px; height:22px; }
.toggle input { opacity:0; width:0; height:0; }
.slider { position:absolute; cursor:pointer; inset:0; background:#374151; border-radius:22px; transition:.3s; }
.slider::before { content:''; position:absolute; height:16px; width:16px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.3s; }
input:checked + .slider { background:var(--accent); }
input:checked + .slider::before { transform:translateX(18px); }
.btn-primary { background:var(--accent); color:#fff; border:none; padding:.55rem 1.25rem; border-radius:.6rem; cursor:pointer; font-size:.9rem; font-weight:600; }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-secondary { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.5rem 1rem; border-radius:.6rem; cursor:pointer; font-size:.85rem; }
.toast { position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%); background:rgba(74,222,128,.2); border:1px solid rgba(74,222,128,.4); color:#4ade80; padding:.6rem 1.25rem; border-radius:.75rem; font-size:.85rem; z-index:2000; backdrop-filter:blur(8px); }
</style>
