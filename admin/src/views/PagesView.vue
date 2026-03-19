<template>
  <div>
    <div class="page-header">
      <h1>Pages</h1>
      <RouterLink to="/pages/new" class="btn btn-primary">+ New Page</RouterLink>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input
        v-model="search"
        class="input search-input"
        placeholder="🔍 Search pages…"
      />
      <select v-model="statusFilter" class="select">
        <option value="">All statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
        <option value="scheduled">Scheduled</option>
      </select>
      <span class="count-badge" v-if="filtered.length !== pages.length">
        {{ filtered.length }} / {{ pages.length }}
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
            <th>Slug</th>
            <th>Status</th>
            <th>Updated</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in filtered" :key="page.id" :class="{ 'row-selected': selected.has(page.id) }">
            <td class="col-check">
              <input
                type="checkbox"
                :checked="selected.has(page.id)"
                @change="toggleOne(page.id)"
                class="check"
              />
            </td>
            <td><strong>{{ page.title }}</strong></td>
            <td class="text-muted">/{{ page.slug }}</td>
            <td><span class="badge" :class="`badge-${page.status}`">{{ page.status }}</span></td>
            <td class="text-muted">{{ formatDate(page.updated_at) }}</td>
            <td style="text-align:right">
              <div class="actions">
                <RouterLink :to="`/pages/${page.id}`" class="btn btn-ghost btn-sm">Edit</RouterLink>
                <button class="btn btn-danger btn-sm" @click="deleteSingle(page)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state glass" v-else-if="pages.length">
      <p>No pages match your filters.</p>
    </div>

    <div class="empty-state glass" v-else>
      <p>No pages yet. <RouterLink to="/pages/new">Create your first page.</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const pages = ref([])
const search = ref('')
const statusFilter = ref('')
const selected = reactive(new Set())

onMounted(load)

async function load() {
  const { data } = await api.get('/pages?all=1')
  pages.value = data
  selected.clear()
}

const filtered = computed(() => {
  let list = pages.value
  if (statusFilter.value) list = list.filter(p => p.status === statusFilter.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(p => p.title.toLowerCase().includes(q))
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
  if (action === 'delete' && !confirm(`Delete ${ids.length} page(s)?`)) return
  try {
    await api.post('/pages/bulk', { action, ids })
    toast.success(`${ids.length} page(s) ${action === 'delete' ? 'deleted' : action === 'publish' ? 'published' : 'unpublished'}`)
    await load()
  } catch {
    toast.error('Bulk action failed')
  }
}

async function deleteSingle(page) {
  if (!confirm(`Delete "${page.title}"?`)) return
  await api.delete(`/pages/${page.id}`)
  toast.success('Page deleted')
  await load()
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
.count-badge { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }

.col-check { width: 40px; }
.check { cursor: pointer; accent-color: var(--accent); }
.row-selected { background: rgba(255,255,255,0.04); }

.bulk-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  margin-bottom: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(var(--accent-rgb, 219,68,82), 0.4);
}
.bulk-count { font-size: 0.85rem; font-weight: 600; margin-right: 0.5rem; color: var(--accent); }

.slide-up-enter-active,
.slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-enter-from,
.slide-up-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
