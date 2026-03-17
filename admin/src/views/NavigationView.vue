<template>
  <div>
    <div class="page-header">
      <h1>Navigation</h1>
      <button class="btn btn-primary" @click="showForm = true">+ Add Item</button>
    </div>

    <div class="glass section">
      <p class="hint">Drag to reorder. Items with a parent become dropdown children.</p>

      <div v-if="items.length" class="nav-list">
        <div v-for="item in flatItems" :key="item.id" class="nav-item-row" :class="{ child: !!item.parent_id }">
          <div class="nav-item-info">
            <span class="nav-label">{{ item.label }}</span>
            <span class="nav-url text-muted">{{ item.url }}</span>
          </div>
          <div class="nav-actions">
            <button class="btn btn-ghost btn-sm" @click="editItem(item)">Edit</button>
            <button class="btn btn-danger btn-sm" @click="removeItem(item)">Delete</button>
          </div>
        </div>
      </div>

      <div class="empty-hint" v-else>No navigation items yet.</div>
    </div>

    <!-- Add/Edit Modal -->
    <div class="modal-overlay" v-if="showForm" @click.self="closeForm">
      <div class="modal-card glass">
        <h2 style="margin-bottom:1.25rem;">{{ editingId ? 'Edit Item' : 'Add Nav Item' }}</h2>

        <div class="form-group">
          <label>Label</label>
          <input v-model="formData.label" class="input" placeholder="Home" />
        </div>
        <div class="form-group">
          <label>URL</label>
          <input v-model="formData.url" class="input" placeholder="/" />
        </div>
        <div class="form-group">
          <label>Open in</label>
          <select v-model="formData.target" class="select">
            <option value="_self">Same tab</option>
            <option value="_blank">New tab</option>
          </select>
        </div>
        <div class="form-group">
          <label>Parent (optional)</label>
          <select v-model="formData.parent_id" class="select">
            <option :value="null">— None (top level) —</option>
            <option v-for="item in flatItems.filter(i => !i.parent_id)" :key="item.id" :value="item.id">
              {{ item.label }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>Sort Order</label>
          <input v-model.number="formData.sort_order" type="number" class="input" />
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="closeForm">Cancel</button>
          <button class="btn btn-primary" @click="saveItem">
            {{ editingId ? 'Save' : 'Add' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const items = ref([])
const showForm = ref(false)
const editingId = ref(null)

const formData = ref({ label: '', url: '/', target: '_self', sort_order: 0, parent_id: null })

const flatItems = computed(() => {
  const result = []
  const roots = items.value.filter(i => !i.parent_id)
  for (const r of roots) {
    result.push(r)
    const children = items.value.filter(i => i.parent_id === r.id)
    result.push(...children)
  }
  return result
})

onMounted(load)

async function load() {
  const { data } = await api.get('/navigation')
  // Flatten tree for display
  items.value = flattenTree(data)
}

function flattenTree(nodes, parent_id = null) {
  const out = []
  for (const n of nodes) {
    out.push({ ...n, parent_id })
    if (n.children?.length) out.push(...flattenTree(n.children, n.id))
  }
  return out
}

function editItem(item) {
  editingId.value = item.id
  formData.value = { label: item.label, url: item.url, target: item.target, sort_order: item.sort_order, parent_id: item.parent_id }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
  formData.value = { label: '', url: '/', target: '_self', sort_order: 0, parent_id: null }
}

async function saveItem() {
  if (!formData.value.label || !formData.value.url) {
    toast.error('Label and URL are required')
    return
  }
  if (editingId.value) {
    await api.put(`/navigation/${editingId.value}`, formData.value)
    toast.success('Item updated')
  } else {
    await api.post('/navigation', formData.value)
    toast.success('Item added')
  }
  await load()
  closeForm()
}

async function removeItem(item) {
  if (!confirm(`Remove "${item.label}" from navigation?`)) return
  await api.delete(`/navigation/${item.id}`)
  toast.success('Item removed')
  await load()
}
</script>

<style scoped>
.section { padding: 1.25rem; }
.hint { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; }
.nav-list { display: flex; flex-direction: column; gap: 0.4rem; }

.nav-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  background: var(--surface2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.nav-item-row.child { margin-left: 2rem; border-left: 2px solid var(--accent); }
.nav-item-info { display: flex; flex-direction: column; gap: 0.15rem; }
.nav-label { font-weight: 500; font-size: 0.9rem; }
.nav-url { font-size: 0.78rem; }
.text-muted { color: var(--text-muted); }
.nav-actions { display: flex; gap: 0.4rem; }
.empty-hint { color: var(--text-muted); font-size: 0.88rem; }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-card {
  width: 100%;
  max-width: 420px;
  padding: 2rem;
}
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
</style>
