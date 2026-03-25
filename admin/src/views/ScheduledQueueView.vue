<template>
  <div class="sq-view">
    <div class="page-header">
      <div>
        <h1>⏰ Scheduled Content Queue</h1>
        <p class="subtitle">All posts, pages, and products waiting to be published</p>
      </div>
      <div class="header-actions">
        <button class="btn-ghost" @click="load" :disabled="loading">🔄 Refresh</button>
        <button
          class="btn-primary"
          v-if="selected.length > 0"
          @click="bulkPublishNow"
          :disabled="publishing"
        >
          ⚡ Publish {{ selected.length }} Now
        </button>
      </div>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Scheduled</div>
      </div>
      <div class="stat-card accent" v-if="stats.overdue > 0">
        <div class="stat-value red">{{ stats.overdue }}</div>
        <div class="stat-label">⚠️ Overdue</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.upcoming_24h }}</div>
        <div class="stat-label">Next 24h</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.posts }}</div>
        <div class="stat-label">Posts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.pages }}</div>
        <div class="stat-label">Pages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.products }}</div>
        <div class="stat-label">Products</div>
      </div>
    </div>

    <!-- Filter -->
    <div class="toolbar glass" style="padding: 0.75rem 1.25rem; display:flex; gap:0.75rem; align-items:center; margin-bottom:1.5rem;">
      <label style="font-size:0.82rem;color:var(--text-muted);">Type:</label>
      <button
        v-for="t in typeFilters"
        :key="t.value"
        class="pill-btn"
        :class="{ active: filterType === t.value }"
        @click="filterType = t.value; load()"
      >{{ t.label }}</button>
      <div style="flex:1"></div>
      <label style="font-size:0.82rem;color:var(--text-muted);">Sort by:</label>
      <select v-model="sortBy" class="input" style="width:160px">
        <option value="schedule">Scheduled Date ↑</option>
        <option value="schedule_desc">Scheduled Date ↓</option>
        <option value="type">Content Type</option>
      </select>
    </div>

    <!-- Empty state -->
    <div class="glass empty-state" v-if="!loading && items.length === 0">
      <div class="empty-icon">📭</div>
      <p>No scheduled content found.</p>
      <p class="text-muted" style="font-size:0.85rem;margin-top:0.25rem">Schedule posts, pages, or products with a future publish date to see them here.</p>
    </div>

    <!-- Queue table -->
    <div class="glass table-wrap" v-if="items.length > 0">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:36px">
              <input type="checkbox" @change="toggleAll" :checked="selected.length === items.length && items.length > 0" />
            </th>
            <th>Content</th>
            <th>Type</th>
            <th>Slug</th>
            <th>Scheduled For</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedItems" :key="item.entity_type + '-' + item.id" :class="{ overdue: isOverdue(item) }">
            <td><input type="checkbox" :value="{ entity_type: item.entity_type, id: item.id }" v-model="selected" /></td>
            <td>
              <div class="item-title">{{ item.title }}</div>
              <div class="item-author" v-if="item.author_name">by {{ item.author_name }}</div>
            </td>
            <td>
              <span class="type-badge" :class="'type-' + item.entity_type">
                {{ typeIcon(item.entity_type) }} {{ item.entity_type }}
              </span>
            </td>
            <td><code class="slug-code">{{ item.slug }}</code></td>
            <td>
              <div class="schedule-cell">
                <span v-if="!editingId || editingId !== item.entity_type + '-' + item.id">
                  <span :class="isOverdue(item) ? 'overdue-badge' : 'schedule-date'">
                    {{ formatDate(item.scheduled_at) }}
                  </span>
                  <span class="overdue-label" v-if="isOverdue(item)">⚠️ Overdue</span>
                </span>
                <input
                  v-else
                  type="datetime-local"
                  v-model="editDate"
                  class="input"
                  style="font-size:0.82rem;width:195px"
                />
              </div>
            </td>
            <td>
              <span class="badge badge-blue">Scheduled</span>
            </td>
            <td>
              <div class="action-row">
                <!-- Reschedule toggle -->
                <button
                  v-if="editingId !== item.entity_type + '-' + item.id"
                  class="btn-icon" title="Reschedule"
                  @click="startEdit(item)"
                >✏️</button>
                <template v-else>
                  <button class="btn-icon green" title="Save new date" @click="saveReschedule(item)">✓</button>
                  <button class="btn-icon" title="Cancel" @click="editingId = null">✕</button>
                </template>

                <!-- Publish now -->
                <button
                  class="btn-icon accent" title="Publish now"
                  @click="publishNow(item)"
                  :disabled="publishing"
                >▶</button>

                <!-- Move to draft -->
                <button
                  class="btn-icon" title="Move to Draft"
                  @click="unschedule(item)"
                >↩</button>

                <!-- Edit link -->
                <RouterLink
                  :to="editLink(item)"
                  class="btn-icon" title="Edit content"
                >🔗</RouterLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Overdue notice -->
    <div class="glass notice-warn" v-if="stats && stats.overdue > 0" style="margin-top:1.5rem">
      <strong>⚠️ {{ stats.overdue }} item{{ stats.overdue !== 1 ? 's are' : ' is' }} overdue!</strong>
      The scheduler runs every 60 seconds. If content hasn't published automatically, check the backend is running.
      <button class="btn-ghost btn-sm" style="margin-left:1rem" @click="publishAllOverdue">Publish All Overdue Now</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'
import { useToast } from '../composables/useToast.js'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const publishing = ref(false)
const items = ref([])
const stats = ref(null)
const selected = ref([])
const filterType = ref('')
const sortBy = ref('schedule')
const editingId = ref(null)
const editDate = ref('')

const typeFilters = [
  { value: '', label: 'All' },
  { value: 'post', label: '✍️ Posts' },
  { value: 'page', label: '📄 Pages' },
  { value: 'product', label: '🛍️ Products' },
]

const sortedItems = computed(() => {
  const arr = [...items.value]
  if (sortBy.value === 'schedule') return arr.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
  if (sortBy.value === 'schedule_desc') return arr.sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
  if (sortBy.value === 'type') return arr.sort((a, b) => a.entity_type.localeCompare(b.entity_type))
  return arr
})

function isOverdue(item) {
  return new Date(item.scheduled_at) < new Date()
}

function typeIcon(type) {
  return type === 'post' ? '✍️' : type === 'page' ? '📄' : '🛍️'
}

function formatDate(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function editLink(item) {
  if (item.entity_type === 'post') return `/posts/${item.id}`
  if (item.entity_type === 'page') return `/pages/${item.id}`
  if (item.entity_type === 'product') return `/products/${item.id}`
  return '/'
}

function toggleAll(e) {
  if (e.target.checked) {
    selected.value = items.value.map(i => ({ entity_type: i.entity_type, id: i.id }))
  } else {
    selected.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const params = filterType.value ? `?type=${filterType.value}` : ''
    const res = await fetch(`/api/scheduled-queue${params}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    const data = await res.json()
    items.value = data.items || []
    stats.value = data.stats || null
    selected.value = []
  } catch (e) {
    toast.error('Failed to load scheduled queue')
  } finally {
    loading.value = false
  }
}

function startEdit(item) {
  editingId.value = item.entity_type + '-' + item.id
  // Convert UTC to local datetime-local format
  const d = new Date(item.scheduled_at)
  const pad = n => String(n).padStart(2, '0')
  editDate.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function saveReschedule(item) {
  if (!editDate.value) return
  try {
    const res = await fetch('/api/scheduled-queue/reschedule', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: item.entity_type, id: item.id, publish_at: editDate.value })
    })
    const data = await res.json()
    if (data.ok) {
      toast.success('Rescheduled!')
      editingId.value = null
      load()
    } else {
      toast.error(data.error || 'Failed to reschedule')
    }
  } catch (e) {
    toast.error('Failed to reschedule')
  }
}

async function publishNow(item) {
  if (!confirm(`Publish "${item.title}" now?`)) return
  publishing.value = true
  try {
    const res = await fetch('/api/scheduled-queue/publish-now', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: item.entity_type, id: item.id })
    })
    const data = await res.json()
    if (data.ok) {
      toast.success('Published!')
      load()
    } else {
      toast.error(data.error || 'Failed to publish')
    }
  } finally {
    publishing.value = false
  }
}

async function unschedule(item) {
  if (!confirm(`Move "${item.title}" back to Draft?`)) return
  try {
    const res = await fetch('/api/scheduled-queue/unschedule', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: item.entity_type, id: item.id })
    })
    const data = await res.json()
    if (data.ok) {
      toast.success('Moved to Draft')
      load()
    } else {
      toast.error(data.error || 'Failed')
    }
  } catch (e) {
    toast.error('Failed to unschedule')
  }
}

async function bulkPublishNow() {
  if (!selected.value.length) return
  if (!confirm(`Publish ${selected.value.length} item(s) right now?`)) return
  publishing.value = true
  try {
    const res = await fetch('/api/scheduled-queue/bulk-publish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: selected.value })
    })
    const data = await res.json()
    if (data.ok) {
      toast.success(`Published ${data.published} item(s)`)
      selected.value = []
      load()
    } else {
      toast.error(data.error || 'Failed')
    }
  } finally {
    publishing.value = false
  }
}

async function publishAllOverdue() {
  const overdue = items.value
    .filter(i => isOverdue(i))
    .map(i => ({ entity_type: i.entity_type, id: i.id }))
  if (!overdue.length) return
  if (!confirm(`Publish all ${overdue.length} overdue item(s)?`)) return
  publishing.value = true
  try {
    const res = await fetch('/api/scheduled-queue/bulk-publish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: overdue })
    })
    const data = await res.json()
    if (data.ok) {
      toast.success(`Published ${data.published} overdue item(s)`)
      load()
    }
  } finally {
    publishing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.sq-view {}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}
.page-header h1 { font-size: 1.5rem; font-weight: 700; }
.subtitle { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; }

.stats-strip {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.stat-card {
  flex: 1;
  min-width: 100px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
}
.stat-value { font-size: 1.6rem; font-weight: 700; }
.stat-value.red { color: hsl(355, 70%, 60%); }
.stat-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

.pill-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.pill-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  text-align: left;
  padding: 0.65rem 1rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.data-table td {
  padding: 0.7rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
}
.data-table tr.overdue td { background: rgba(220, 50, 50, 0.05); }
.data-table tr:hover td { background: var(--glass-bg); }

.item-title { font-weight: 600; font-size: 0.9rem; }
.item-author { font-size: 0.75rem; color: var(--text-muted); }

.type-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}
.type-post { background: rgba(100, 150, 255, 0.15); color: #7db0ff; }
.type-page { background: rgba(100, 200, 150, 0.15); color: #7dd4a0; }
.type-product { background: rgba(255, 180, 80, 0.15); color: #ffc164; }

.slug-code {
  font-family: monospace;
  font-size: 0.78rem;
  color: var(--text-muted);
  background: rgba(255,255,255,0.05);
  padding: 1px 6px;
  border-radius: 4px;
}

.schedule-cell { display: flex; align-items: center; gap: 0.5rem; }
.schedule-date { font-size: 0.85rem; }
.overdue-badge { color: hsl(355, 70%, 60%); font-weight: 600; font-size: 0.85rem; }
.overdue-label { font-size: 0.72rem; color: hsl(355, 70%, 60%); }

.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.badge-blue { background: rgba(100, 150, 255, 0.15); color: #7db0ff; }

.action-row { display: flex; gap: 0.35rem; align-items: center; }
.btn-icon {
  width: 30px; height: 30px;
  border: 1px solid var(--glass-border);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
  text-decoration: none;
  color: var(--text);
}
.btn-icon:hover { background: var(--glass-bg); }
.btn-icon.accent { color: var(--accent); border-color: var(--accent); }
.btn-icon.green { color: hsl(140, 60%, 55%); border-color: hsl(140, 60%, 40%); }

.empty-state {
  padding: 3rem;
  text-align: center;
}
.empty-icon { font-size: 3rem; margin-bottom: 0.75rem; }
.text-muted { color: var(--text-muted); }

.notice-warn {
  padding: 1rem 1.25rem;
  border: 1px solid hsl(40, 80%, 40%);
  background: rgba(220, 160, 50, 0.1);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-ghost {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text);
  padding: 0.45rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  font-family: var(--font);
}
.btn-ghost:hover { background: var(--surface2); }
.btn-ghost.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.78rem; }
.btn-primary {
  background: var(--accent);
  color: #fff;
  padding: 0.45rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  border: none;
  font-family: var(--font);
  transition: background 0.2s;
}
.btn-primary:hover { background: var(--accent-dim); }
.btn-primary:disabled, .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.input {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--font);
  font-size: 0.9rem;
  outline: none;
  padding: 0.45rem 0.7rem;
}
.loading-bar {
  height: 3px;
  background: linear-gradient(90deg, var(--accent), transparent);
  border-radius: 2px;
  margin-bottom: 1.5rem;
  animation: loadbar 1.2s ease-in-out infinite;
}
@keyframes loadbar {
  0% { opacity: 1; transform: scaleX(0.1); transform-origin: left; }
  50% { opacity: 1; transform: scaleX(0.8); }
  100% { opacity: 0.4; transform: scaleX(1); }
}
</style>
