<template>
  <div class="changelog-view">
    <div class="page-header">
      <div>
        <h1>📋 Changelog / Release Notes</h1>
        <p class="subtitle">Publish release notes and product updates visible on the public changelog page</p>
      </div>
      <button class="btn-accent" @click="openCreate">+ New Entry</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Entries</div>
      </div>
      <div class="stat-card">
        <div class="stat-value accent">{{ stats.published }}</div>
        <div class="stat-label">Published</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.drafts }}</div>
        <div class="stat-label">Drafts</div>
      </div>
      <template v-for="t in stats.byType" :key="t.type">
        <div class="stat-card">
          <div class="stat-value">{{ t.count }}</div>
          <div class="stat-label">{{ typeLabel(t.type) }}</div>
        </div>
      </template>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar glass">
      <input v-model="search" type="text" class="form-input" placeholder="Search entries…" style="max-width:280px" />
      <select v-model="filterType" class="form-input" style="width:150px">
        <option value="">All types</option>
        <option value="feature">✨ Feature</option>
        <option value="improvement">🔧 Improvement</option>
        <option value="bugfix">🐛 Bug Fix</option>
        <option value="breaking">⚠️ Breaking Change</option>
        <option value="security">🔒 Security</option>
        <option value="deprecation">🗑️ Deprecation</option>
      </select>
      <select v-model="filterStatus" class="form-input" style="width:130px">
        <option value="">All statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
      <RouterLink to="/settings" class="btn-ghost btn-sm">⚙️ Settings</RouterLink>
    </div>

    <!-- Loading -->
    <div class="loading-bar" v-if="loading"></div>

    <!-- Table -->
    <div class="glass table-card" v-if="!loading">
      <table class="data-table" v-if="filtered.length">
        <thead>
          <tr>
            <th>Version</th>
            <th>Title</th>
            <th>Type</th>
            <th>Status</th>
            <th>Published</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in filtered" :key="entry.id">
            <td><span class="version-badge">{{ entry.version }}</span></td>
            <td>
              <div class="entry-title">{{ entry.title }}</div>
              <div class="entry-excerpt text-muted" v-if="entry.content">{{ stripHtml(entry.content).slice(0, 80) }}…</div>
            </td>
            <td><span class="type-badge" :class="`type-${entry.type}`">{{ typeIcon(entry.type) }} {{ typeLabel(entry.type) }}</span></td>
            <td><span class="status-pill" :class="entry.status">{{ entry.status }}</span></td>
            <td class="text-muted" style="font-size:0.8rem">
              {{ entry.published_at ? formatDate(entry.published_at) : '—' }}
            </td>
            <td>
              <div class="action-row">
                <button class="btn-ghost btn-sm" @click="openEdit(entry)">✏️ Edit</button>
                <button
                  v-if="entry.status === 'draft'"
                  class="btn-ghost btn-sm accent"
                  @click="publish(entry)"
                >✅ Publish</button>
                <button
                  v-else
                  class="btn-ghost btn-sm"
                  @click="unpublish(entry)"
                >⏸ Unpublish</button>
                <button class="btn-ghost btn-sm danger" @click="confirmDelete(entry)">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <div class="empty-icon">📋</div>
        <h2>No changelog entries yet</h2>
        <p>Click "New Entry" to create your first release note.</p>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal-card glass">
        <div class="modal-header">
          <h2>{{ editEntry ? 'Edit Entry' : 'New Changelog Entry' }}</h2>
          <button class="modal-close" @click="showModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Version *</label>
              <input v-model="form.version" type="text" class="form-input" placeholder="e.g. v2.1.0" />
            </div>
            <div class="field-group">
              <label class="field-label">Type *</label>
              <select v-model="form.type" class="form-input">
                <option value="feature">✨ Feature</option>
                <option value="improvement">🔧 Improvement</option>
                <option value="bugfix">🐛 Bug Fix</option>
                <option value="breaking">⚠️ Breaking Change</option>
                <option value="security">🔒 Security</option>
                <option value="deprecation">🗑️ Deprecation</option>
              </select>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Title *</label>
            <input v-model="form.title" type="text" class="form-input" placeholder="Short summary of this release" />
          </div>

          <div class="field-group">
            <label class="field-label">Content (HTML or Markdown-style)</label>
            <textarea
              v-model="form.content"
              class="form-input"
              rows="10"
              placeholder="Describe what changed, was fixed, or was added…"
              style="font-family: monospace; font-size: 0.85rem; resize: vertical;"
            ></textarea>
            <div class="field-hint">You can use HTML. Lists: &lt;ul&gt;&lt;li&gt;...&lt;/li&gt;&lt;/ul&gt;</div>
          </div>

          <div class="form-row-2">
            <div class="field-group">
              <label class="field-label">Status</label>
              <select v-model="form.status" class="form-input">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Publish Date</label>
              <input v-model="form.published_at" type="datetime-local" class="form-input" />
            </div>
          </div>

          <!-- Content Preview -->
          <div v-if="form.content" class="preview-box glass">
            <div class="preview-label text-muted">Preview</div>
            <div class="changelog-preview" v-html="form.content"></div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" @click="showModal = false">Cancel</button>
          <button class="btn-accent" @click="saveEntry" :disabled="saving">
            {{ saving ? 'Saving…' : (editEntry ? 'Save Changes' : 'Create Entry') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal-card glass" style="max-width:420px">
        <div class="modal-header">
          <h2>Delete Entry?</h2>
          <button class="modal-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete <strong>{{ deleteTarget.version }} — {{ deleteTarget.title }}</strong>? This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const entries  = ref([])
const stats    = ref(null)
const loading  = ref(true)
const search   = ref('')
const filterType   = ref('')
const filterStatus = ref('')

const showModal  = ref(false)
const editEntry  = ref(null)
const deleteTarget = ref(null)
const saving     = ref(false)

const form = ref({
  version: '', title: '', content: '', type: 'feature', status: 'draft', published_at: ''
})

const filtered = computed(() => {
  return entries.value.filter(e => {
    const q = search.value.toLowerCase()
    if (q && !e.title.toLowerCase().includes(q) && !e.version.toLowerCase().includes(q)) return false
    if (filterType.value && e.type !== filterType.value) return false
    if (filterStatus.value && e.status !== filterStatus.value) return false
    return true
  })
})

async function load() {
  loading.value = true
  try {
    const [entriesRes, statsRes] = await Promise.all([
      api.get('/changelog', { params: { all: 1, limit: 100 } }),
      api.get('/changelog/stats')
    ])
    entries.value = entriesRes.data.entries || []
    stats.value = statsRes.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editEntry.value = null
  form.value = { version: '', title: '', content: '', type: 'feature', status: 'draft', published_at: '' }
  showModal.value = true
}

function openEdit(entry) {
  editEntry.value = entry
  form.value = {
    version: entry.version,
    title: entry.title,
    content: entry.content || '',
    type: entry.type,
    status: entry.status,
    published_at: entry.published_at ? entry.published_at.slice(0, 16) : '',
  }
  showModal.value = true
}

async function saveEntry() {
  if (!form.value.version || !form.value.title) {
    alert('Version and title are required')
    return
  }
  saving.value = true
  try {
    const payload = { ...form.value }
    if (payload.published_at) payload.published_at = new Date(payload.published_at).toISOString()

    if (editEntry.value) {
      await api.put(`/changelog/${editEntry.value.id}`, payload)
    } else {
      await api.post('/changelog', payload)
    }
    showModal.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function publish(entry) {
  await api.put(`/changelog/${entry.id}`, { status: 'published' })
  await load()
}

async function unpublish(entry) {
  await api.put(`/changelog/${entry.id}`, { status: 'draft' })
  await load()
}

function confirmDelete(entry) { deleteTarget.value = entry }

async function doDelete() {
  await api.delete(`/changelog/${deleteTarget.value.id}`)
  deleteTarget.value = null
  await load()
}

function typeLabel(t) {
  return { feature: 'Feature', improvement: 'Improvement', bugfix: 'Bug Fix',
    breaking: 'Breaking', security: 'Security', deprecation: 'Deprecation' }[t] || t
}

function typeIcon(t) {
  return { feature: '✨', improvement: '🔧', bugfix: '🐛',
    breaking: '⚠️', security: '🔒', deprecation: '🗑️' }[t] || '•'
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.changelog-view { display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; }
.page-header h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
.subtitle { color: rgba(255,255,255,.5); margin: 0; font-size: .9rem; }

.stats-strip { display: flex; gap: .75rem; flex-wrap: wrap; }
.stat-card { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; padding: .75rem 1rem; min-width: 90px; }
.stat-value { font-size: 1.5rem; font-weight: 700; line-height: 1; }
.stat-value.accent { color: var(--accent); }
.stat-label { font-size: .75rem; color: rgba(255,255,255,.5); margin-top: .25rem; }

.filter-bar { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; padding: .75rem 1rem; border-radius: .75rem; }

.loading-bar { height: 3px; background: linear-gradient(90deg, transparent, var(--accent), transparent); border-radius: 2px; animation: load 1s ease-in-out infinite; }
@keyframes load { 0%,100%{transform:scaleX(.3);opacity:.6} 50%{transform:scaleX(1);opacity:1} }

.table-card { border-radius: 1rem; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { padding: .75rem 1rem; text-align: left; font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.5); border-bottom: 1px solid rgba(255,255,255,.08); }
.data-table td { padding: .75rem 1rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: rgba(255,255,255,.03); }

.version-badge { background: rgba(255,255,255,.1); color: #fff; font-size: .78rem; font-weight: 700; padding: .2rem .5rem; border-radius: .4rem; font-family: monospace; }

.entry-title { font-weight: 600; }
.entry-excerpt { font-size: .78rem; margin-top: .15rem; }

.type-badge { font-size: .72rem; font-weight: 600; padding: .2rem .5rem; border-radius: .4rem; white-space: nowrap; }
.type-feature    { background: rgba(34,197,94,.15);  color: #4ade80; }
.type-improvement{ background: rgba(59,130,246,.15); color: #60a5fa; }
.type-bugfix     { background: rgba(239,68,68,.15);  color: #f87171; }
.type-breaking   { background: rgba(245,158,11,.15); color: #fbbf24; }
.type-security   { background: rgba(168,85,247,.15); color: #c084fc; }
.type-deprecation{ background: rgba(107,114,128,.15);color: #9ca3af; }

.status-pill { font-size: .72rem; font-weight: 600; padding: .2rem .5rem; border-radius: .4rem; text-transform: capitalize; }
.status-pill.published { background: rgba(34,197,94,.15); color: #4ade80; }
.status-pill.draft     { background: rgba(107,114,128,.15); color: #9ca3af; }

.action-row { display: flex; gap: .4rem; align-items: center; }
.btn-ghost.accent { color: var(--accent); }
.btn-ghost.danger { color: #f87171; }
.btn-danger { background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3); color: #f87171; padding: .5rem 1rem; border-radius: .5rem; cursor: pointer; font-size: .85rem; }

.empty-state { text-align: center; padding: 3rem 2rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }
.empty-state h2 { font-size: 1.1rem; margin: 0 0 .5rem; }
.empty-state p { color: rgba(255,255,255,.5); font-size: .9rem; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-card { border-radius: 1rem; max-width: 700px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-close { background: none; border: none; color: rgba(255,255,255,.6); cursor: pointer; font-size: 1.2rem; }
.modal-body { padding: 1.25rem 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.08); display: flex; justify-content: flex-end; gap: .75rem; }

.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field-group { display: flex; flex-direction: column; gap: .35rem; }
.field-label { font-size: .8rem; font-weight: 600; color: rgba(255,255,255,.7); }
.field-hint { font-size: .75rem; color: rgba(255,255,255,.4); margin-top: .2rem; }
.form-input { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; color: #fff; padding: .5rem .75rem; font-size: .875rem; font-family: inherit; }
.form-input:focus { outline: none; border-color: var(--accent); }

.preview-box { border-radius: .75rem; padding: 1rem; }
.preview-label { font-size: .75rem; margin-bottom: .5rem; }
.changelog-preview { font-size: .9rem; line-height: 1.6; }
.changelog-preview :deep(ul) { padding-left: 1.5rem; margin: .5rem 0; }
.changelog-preview :deep(li) { margin: .25rem 0; }
.changelog-preview :deep(strong) { color: #fff; }

.text-muted { color: rgba(255,255,255,.5); }
</style>
