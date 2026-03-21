<template>
  <div>
    <div class="page-header">
      <h1>Posts</h1>
      <RouterLink to="/posts/new" class="btn btn-primary">+ New Post</RouterLink>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input
        v-model="search"
        class="input search-input"
        placeholder="🔍 Search posts…"
      />
      <select v-model="statusFilter" class="select">
        <option value="">All statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
        <option value="scheduled">Scheduled</option>
      </select>
      <span class="count-badge" v-if="filtered.length !== posts.length">
        {{ filtered.length }} / {{ posts.length }}
      </span>
    </div>

    <!-- Bulk action bar -->
    <Transition name="slide-up">
      <div class="bulk-bar glass" v-if="selected.size > 0">
        <span class="bulk-count">{{ selected.size }} selected</span>
        <button class="btn btn-sm btn-ghost" @click="bulkAction('publish')">✅ Publish</button>
        <button class="btn btn-sm btn-ghost" @click="bulkAction('unpublish')">📝 Unpublish</button>
        <button class="btn btn-sm btn-danger" @click="bulkAction('delete')">🗑 Delete</button>
        <button class="btn btn-sm btn-ghost" @click="selected.clear()">✕ Deselect</button>
      </div>
    </Transition>

    <div class="glass section" v-if="filtered.length">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-check">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="someSelected"
                @change="toggleAll"
                class="check"
              />
            </th>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Published</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in filtered" :key="post.id" :class="{ 'row-selected': selected.has(post.id) }">
            <td class="col-check">
              <input
                type="checkbox"
                :checked="selected.has(post.id)"
                @change="toggleOne(post.id)"
                class="check"
              />
            </td>
            <td>
              <strong>{{ post.title }}</strong>
            </td>
            <td class="text-muted">{{ post.category_name || '—' }}</td>
            <td>
              <span class="badge" :class="`badge-${post.status}`">{{ post.status }}</span>
            </td>
            <td class="text-muted">{{ post.published_at ? formatDate(post.published_at) : '—' }}</td>
            <td style="text-align:right">
              <div class="actions">
                <RouterLink :to="`/posts/${post.id}`" class="btn btn-ghost btn-sm">Edit</RouterLink>
                <button class="btn btn-ghost btn-sm" @click="duplicatePost(post)" title="Duplicate as draft">⧉</button>
                <button class="btn btn-danger btn-sm" @click="deleteSingle(post)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state glass" v-else-if="posts.length">
      <p>No posts match your filters.</p>
    </div>

    <div class="empty-state glass" v-else>
      <p>No posts yet. <RouterLink to="/posts/new">Write your first post.</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const posts = ref([])
const search = ref('')
const statusFilter = ref('')
const selected = reactive(new Set())

onMounted(load)

async function load() {
  const { data } = await api.get('/posts?all=1&limit=200')
  posts.value = data.posts
  selected.clear()
}

const filtered = computed(() => {
  let list = posts.value
  if (statusFilter.value) list = list.filter(p => p.status === statusFilter.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(p => p.title.toLowerCase().includes(q) || (p.excerpt || '').toLowerCase().includes(q))
  }
  return list
})

const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(p => selected.has(p.id)))
const someSelected = computed(() => !allSelected.value && filtered.value.some(p => selected.has(p.id)))

function toggleAll(e) {
  if (e.target.checked) filtered.value.forEach(p => selected.add(p.id))
  else filtered.value.forEach(p => selected.delete(p.id))
}
function toggleOne(id) {
  selected.has(id) ? selected.delete(id) : selected.add(id)
}

async function bulkAction(action) {
  const ids = [...selected]
  if (action === 'delete' && !confirm(`Delete ${ids.length} post(s)?`)) return
  try {
    await api.post('/posts/bulk', { action, ids })
    toast.success(`${ids.length} post(s) ${action === 'delete' ? 'deleted' : action === 'publish' ? 'published' : 'unpublished'}`)
    await load()
  } catch {
    toast.error('Bulk action failed')
  }
}

async function deleteSingle(post) {
  if (!confirm(`Delete "${post.title}"?`)) return
  await api.delete(`/posts/${post.id}`)
  toast.success('Post deleted')
  await load()
}

async function duplicatePost(post) {
  try {
    const { data } = await api.post(`/posts/${post.id}/duplicate`)
    toast.success(`"${data.title}" created as draft`)
    await load()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Duplicate failed')
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.section { padding: 0; overflow: hidden; }
.text-muted { color: var(--text-muted); font-size: 0.85rem; }
.actions { display: flex; gap: 0.4rem; justify-content: flex-end; }
.empty-state { padding: 2rem; text-align: center; color: var(--text-muted); }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 0.75rem;
}
.search-input { flex: 1; min-width: 0; }
.count-badge {
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.col-check { width: 40px; }
.check { cursor: pointer; accent-color: var(--accent); }
.row-selected { background: rgba(255,255,255,0.04); }

/* Bulk bar */
.bulk-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  margin-bottom: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(var(--accent-rgb, 219,68,82), 0.4);
}
.bulk-count {
  font-size: 0.85rem;
  font-weight: 600;
  margin-right: 0.5rem;
  color: var(--accent);
}

.slide-up-enter-active,
.slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-enter-from,
.slide-up-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
