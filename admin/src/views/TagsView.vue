<template>
  <div class="tags-view">
    <div class="view-header">
      <h1>🏷️ Tag Manager</h1>
      <div class="header-actions">
        <input
          v-model="search"
          class="input search-input"
          placeholder="Filter tags…"
        />
      </div>
    </div>

    <div class="glass info-banner">
      Tags are shared across <strong>Posts</strong> and <strong>Products</strong>.
      Renaming or deleting a tag updates every item that uses it.
    </div>

    <div v-if="loading" class="loading-state">Loading tags…</div>
    <div v-else-if="filtered.length === 0" class="empty-state glass">
      <p>{{ search ? 'No tags match your search.' : 'No tags found. Add tags to your posts or products.' }}</p>
    </div>

    <div v-else class="tags-table glass">
      <table>
        <thead>
          <tr>
            <th>Tag</th>
            <th class="num-col">Posts</th>
            <th class="num-col">Products</th>
            <th class="num-col">Total</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in filtered" :key="t.tag">
            <td>
              <span v-if="renaming !== t.tag" class="tag-chip">{{ t.tag }}</span>
              <div v-else class="rename-row">
                <input
                  v-model="renameValue"
                  class="input input-sm"
                  @keyup.enter="confirmRename(t.tag)"
                  @keyup.escape="renaming = null"
                  ref="renameInput"
                />
                <button class="btn btn-primary btn-sm" @click="confirmRename(t.tag)">✓</button>
                <button class="btn btn-ghost btn-sm" @click="renaming = null">✕</button>
              </div>
            </td>
            <td class="num-col">
              <span v-if="t.post_count > 0" class="count-badge post-badge">{{ t.post_count }}</span>
              <span v-else class="count-zero">0</span>
            </td>
            <td class="num-col">
              <span v-if="t.product_count > 0" class="count-badge product-badge">{{ t.product_count }}</span>
              <span v-else class="count-zero">0</span>
            </td>
            <td class="num-col total-col">{{ t.total }}</td>
            <td class="actions-col">
              <button
                v-if="renaming !== t.tag"
                class="btn btn-ghost btn-sm"
                @click="startRename(t.tag)"
              >✏️ Rename</button>
              <button
                class="btn btn-danger btn-sm"
                @click="confirmDelete(t.tag)"
              >🗑 Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Stats footer -->
    <div class="stats-footer" v-if="tags.length">
      <span>{{ tags.length }} unique tag{{ tags.length !== 1 ? 's' : '' }}</span>
      <span>·</span>
      <span>{{ totalUsage }} total usages across all content</span>
    </div>

    <!-- Confirm Delete Modal -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="confirm-box glass">
        <h3>Delete tag "{{ deleteTarget }}"?</h3>
        <p>This will remove the tag from <strong>{{ deleteTargetCount }}</strong> item{{ deleteTargetCount !== 1 ? 's' : '' }}. This cannot be undone.</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete tag</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'

const auth  = useAuthStore()
const toast = useToastStore()

const tags    = ref([])
const loading = ref(true)
const search  = ref('')

const renaming     = ref(null)
const renameValue  = ref('')
const renameInput  = ref(null)
const deleteTarget = ref(null)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return q ? tags.value.filter(t => t.tag.toLowerCase().includes(q)) : tags.value
})

const totalUsage = computed(() => tags.value.reduce((s, t) => s + t.total, 0))
const deleteTargetCount = computed(() => tags.value.find(t => t.tag === deleteTarget.value)?.total ?? 0)

function api(method, path, body) {
  return fetch(`http://localhost:3200/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`
    },
    body: body ? JSON.stringify(body) : undefined
  }).then(r => r.json())
}

async function load() {
  loading.value = true
  tags.value = await api('GET', '/tags')
  loading.value = false
}

function startRename(tag) {
  renaming.value = tag
  renameValue.value = tag
  nextTick(() => {
    if (renameInput.value) {
      const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value
      el?.focus()
    }
  })
}

async function confirmRename(oldTag) {
  const newTag = renameValue.value.trim()
  if (!newTag || newTag === oldTag) { renaming.value = null; return }

  const res = await api('PUT', '/tags/rename', { from: oldTag, to: newTag })
  if (res.error) { toast.error(res.error); return }

  toast.success(`Renamed "${oldTag}" → "${newTag}" on ${res.updated} item(s)`)
  renaming.value = null
  await load()
}

function confirmDelete(tag) {
  deleteTarget.value = tag
}

async function doDelete() {
  const tag = deleteTarget.value
  deleteTarget.value = null
  const res = await api('DELETE', '/tags', { tag })
  if (res.error) { toast.error(res.error); return }
  toast.success(`Removed tag "${tag}" from ${res.removed} item(s)`)
  await load()
}

onMounted(load)
</script>

<style scoped>
.tags-view { padding: 2rem; max-width: 900px; }

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
}
.view-header h1 { margin: 0; font-size: 1.6rem; }

.search-input { min-width: 220px; }

.info-banner {
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 1.25rem;
  border-left: 3px solid var(--accent);
}

.loading-state { text-align: center; padding: 3rem; color: var(--muted); }
.empty-state {
  text-align: center;
  padding: 3rem;
  border-radius: 1rem;
  color: var(--muted);
}

.tags-table {
  border-radius: 1rem;
  overflow: hidden;
  margin-bottom: 0.75rem;
}
.tags-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.tags-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.tags-table td {
  padding: 0.65rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
}
.tags-table tr:last-child td { border-bottom: none; }
.tags-table tr:hover td { background: rgba(255,255,255,0.02); }

.num-col     { text-align: center; width: 80px; }
.actions-col { text-align: right; width: 180px; }
.total-col   { font-weight: 600; color: var(--accent); }

.tag-chip {
  display: inline-block;
  padding: 0.2rem 0.65rem;
  background: rgba(255,255,255,0.07);
  border-radius: 99px;
  font-size: 0.82rem;
  border: 1px solid rgba(255,255,255,0.1);
}

.count-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  font-size: 0.78rem;
  font-weight: 600;
}
.post-badge    { background: rgba(var(--accent-rgb,205,57,70),0.15); color: var(--accent); }
.product-badge { background: rgba(100,180,255,0.12); color: #7ec8f4; }
.count-zero    { color: var(--muted); font-size: 0.8rem; }

.rename-row { display: flex; align-items: center; gap: 0.4rem; }
.input-sm   { height: 2rem; padding: 0 0.6rem; font-size: 0.85rem; border-radius: 0.4rem; }

.actions-col button { margin-left: 0.35rem; }

.btn-danger {
  background: rgba(220,50,50,0.15);
  color: #f77;
  border: 1px solid rgba(220,50,50,0.3);
}
.btn-danger:hover {
  background: rgba(220,50,50,0.3);
}

.stats-footer {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--muted);
  padding: 0.25rem 0.25rem;
}

/* ── Confirm modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.confirm-box {
  border-radius: 1.25rem;
  padding: 2rem;
  max-width: 420px;
  width: 90%;
}
.confirm-box h3 { margin: 0 0 0.75rem; font-size: 1.1rem; }
.confirm-box p  { margin: 0 0 1.5rem; color: var(--muted); font-size: 0.9rem; line-height: 1.5; }
.confirm-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
</style>
