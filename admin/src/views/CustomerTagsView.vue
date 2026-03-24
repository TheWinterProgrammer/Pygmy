<template>
  <div class="customer-tags-view">
    <div class="page-header">
      <div>
        <h1>🏷️ Customer Tags</h1>
        <p class="subtitle">Organize customers with color-coded tags for segmentation and filtering</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ New Tag</button>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card glass">
        <div class="stat-label">Total Tags</div>
        <div class="stat-value">{{ tags.length }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Customers Tagged</div>
        <div class="stat-value">{{ totalTagged }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Most Used Tag</div>
        <div class="stat-value small" v-if="tags.length">{{ tags[0]?.name }}</div>
        <div class="stat-value text-muted" v-else>—</div>
      </div>
    </div>

    <!-- Tags grid -->
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="!tags.length" class="glass section empty-state">
      <div class="empty-icon">🏷️</div>
      <h3>No tags yet</h3>
      <p>Create tags to categorize and segment your customers.</p>
      <button class="btn btn-primary" @click="openCreate">Create First Tag</button>
    </div>

    <div v-else>
      <!-- Tag cards -->
      <div class="tags-grid">
        <div v-for="tag in tags" :key="tag.id" class="glass tag-card">
          <div class="tag-header">
            <div class="tag-dot" :style="{ background: tag.color }"></div>
            <span class="tag-name">{{ tag.name }}</span>
            <span class="tag-count">{{ tag.customer_count }} customers</span>
          </div>
          <div class="tag-preview" v-if="tag.customer_count > 0">
            <button class="btn btn-ghost btn-xs" @click="viewCustomers(tag)">👥 View Customers</button>
          </div>
          <div class="tag-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(tag)">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(tag)">🗑️ Delete</button>
          </div>
        </div>
      </div>

      <!-- Search/assign section -->
      <div class="glass section assign-section" style="margin-top: 2rem;">
        <h3>🔍 Find Customer & Assign Tags</h3>
        <div class="search-row">
          <input v-model="searchEmail" class="input" placeholder="Search customer by email or name…" @input="searchCustomers" />
        </div>
        <div v-if="customerResults.length" class="customer-results">
          <div v-for="c in customerResults" :key="c.id" class="glass customer-row">
            <div class="customer-info">
              <strong>{{ c.first_name }} {{ c.last_name }}</strong>
              <span class="text-muted">{{ c.email }}</span>
            </div>
            <div class="customer-tags-row">
              <span v-for="ct in (c.assigned_tags || [])" :key="ct.id" class="inline-tag" :style="{ background: ct.color + '33', borderColor: ct.color, color: ct.color }">
                {{ ct.name }}
                <button class="remove-tag-btn" @click="removeTagFromCustomer(c, ct)">×</button>
              </span>
              <button class="btn btn-ghost btn-xs" @click="openTagAssign(c)">+ Tag</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Tag Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal glass modal-sm">
        <h2>{{ editingTag ? 'Edit Tag' : 'New Tag' }}</h2>
        <form @submit.prevent="saveTag">
          <div class="form-group">
            <label>Tag Name *</label>
            <input v-model="tagForm.name" class="input" required placeholder="e.g. VIP, Wholesale, At-Risk" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <div class="color-row">
              <input type="color" v-model="tagForm.color" class="color-input" />
              <div class="color-presets">
                <div v-for="c in colorPresets" :key="c" class="color-preset" :style="{ background: c }" @click="tagForm.color = c" :class="{ active: tagForm.color === c }"></div>
              </div>
            </div>
            <div class="tag-preview-badge" :style="{ background: tagForm.color + '33', borderColor: tagForm.color, color: tagForm.color }">
              {{ tagForm.name || 'Preview' }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save Tag' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Assign Tags Modal -->
    <div v-if="showAssignModal" class="modal-overlay" @click.self="showAssignModal = false">
      <div class="modal glass modal-sm">
        <h2>Assign Tags to {{ assignTarget?.first_name }} {{ assignTarget?.last_name }}</h2>
        <p class="text-muted">{{ assignTarget?.email }}</p>
        <div class="tags-checklist">
          <label v-for="tag in tags" :key="tag.id" class="tag-check-row">
            <input type="checkbox" :value="tag.id" v-model="assignSelected" />
            <span class="tag-dot" :style="{ background: tag.color }"></span>
            <span>{{ tag.name }}</span>
            <span class="text-muted small">({{ tag.customer_count }})</span>
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showAssignModal = false">Cancel</button>
          <button class="btn btn-primary" @click="applyTagAssignment">Apply</button>
        </div>
      </div>
    </div>

    <!-- Customers Modal -->
    <div v-if="showCustomersModal" class="modal-overlay" @click.self="showCustomersModal = false">
      <div class="modal glass">
        <h2>👥 {{ viewingTag?.name }} — Customers</h2>
        <div v-if="tagCustomersLoading" class="loading">Loading…</div>
        <div v-else class="glass table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th></tr></thead>
            <tbody>
              <tr v-if="!tagCustomers.length"><td colspan="3" class="empty">No customers with this tag</td></tr>
              <tr v-for="c in tagCustomers" :key="c.id">
                <td>{{ c.first_name }} {{ c.last_name }}</td>
                <td class="text-muted">{{ c.email }}</td>
                <td class="text-muted small">{{ fmtDate(c.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="tagCustomersTotal > tagCustomers.length" class="text-muted small" style="margin-top:8px">
          Showing {{ tagCustomers.length }} of {{ tagCustomersTotal }}
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showCustomersModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal glass modal-sm">
        <h3>Delete Tag</h3>
        <p>Delete the "<strong>{{ deleting.name }}</strong>" tag? It will be removed from all {{ deleting.customer_count }} customer(s).</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleting = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const tags = ref([])
const loading = ref(true)
const showModal = ref(false)
const editingTag = ref(null)
const saving = ref(false)
const deleting = ref(null)

const tagForm = ref({ name: '', color: '#6366f1' })
const colorPresets = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#64748b']

// Search
const searchEmail = ref('')
const customerResults = ref([])
let searchTimeout = null

// Assign
const showAssignModal = ref(false)
const assignTarget = ref(null)
const assignSelected = ref([])

// Customers for tag
const showCustomersModal = ref(false)
const viewingTag = ref(null)
const tagCustomers = ref([])
const tagCustomersTotal = ref(0)
const tagCustomersLoading = ref(false)

const totalTagged = computed(() => {
  const set = new Set()
  // Just sum unique usage — rough
  return tags.value.reduce((sum, t) => sum + t.customer_count, 0)
})

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/customer-tags')
    tags.value = data
  } finally { loading.value = false }
}

function openCreate() {
  editingTag.value = null
  tagForm.value = { name: '', color: '#6366f1' }
  showModal.value = true
}

function openEdit(tag) {
  editingTag.value = tag
  tagForm.value = { name: tag.name, color: tag.color }
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function saveTag() {
  saving.value = true
  try {
    if (editingTag.value) {
      await api.put(`/customer-tags/${editingTag.value.id}`, tagForm.value)
    } else {
      await api.post('/customer-tags', tagForm.value)
    }
    closeModal()
    load()
  } finally { saving.value = false }
}

function confirmDelete(tag) { deleting.value = tag }
async function doDelete() {
  await api.delete(`/customer-tags/${deleting.value.id}`)
  deleting.value = null
  load()
}

// Customer search
function searchCustomers() {
  clearTimeout(searchTimeout)
  if (!searchEmail.value || searchEmail.value.length < 2) { customerResults.value = []; return }
  searchTimeout = setTimeout(async () => {
    try {
      const { data } = await api.get('/customers', { params: { q: searchEmail.value, limit: 10 } })
      const customers = data.customers || data
      // Load tags for each customer
      const withTags = await Promise.all(customers.slice(0, 8).map(async c => {
        try {
          const { data: ctags } = await api.get(`/customer-tags/customer/${c.id}`)
          return { ...c, assigned_tags: ctags }
        } catch { return { ...c, assigned_tags: [] } }
      }))
      customerResults.value = withTags
    } catch {}
  }, 300)
}

async function removeTagFromCustomer(customer, tag) {
  await api.delete(`/customer-tags/customer/${customer.id}/${tag.id}`)
  customer.assigned_tags = customer.assigned_tags.filter(t => t.id !== tag.id)
  load()
}

function openTagAssign(customer) {
  assignTarget.value = customer
  assignSelected.value = (customer.assigned_tags || []).map(t => t.id)
  showAssignModal.value = true
}

async function applyTagAssignment() {
  const currentIds = (assignTarget.value.assigned_tags || []).map(t => t.id)
  const toAdd = assignSelected.value.filter(id => !currentIds.includes(id))
  const toRemove = currentIds.filter(id => !assignSelected.value.includes(id))
  if (toAdd.length) await api.post(`/customer-tags/customer/${assignTarget.value.id}`, { tag_ids: toAdd })
  for (const id of toRemove) await api.delete(`/customer-tags/customer/${assignTarget.value.id}/${id}`)
  showAssignModal.value = false
  // Refresh this customer in results
  const { data: ctags } = await api.get(`/customer-tags/customer/${assignTarget.value.id}`)
  const c = customerResults.value.find(r => r.id === assignTarget.value.id)
  if (c) c.assigned_tags = ctags
  load()
}

async function viewCustomers(tag) {
  viewingTag.value = tag
  showCustomersModal.value = true
  tagCustomersLoading.value = true
  try {
    const { data } = await api.get(`/customer-tags/${tag.id}/customers`)
    tagCustomers.value = data.customers
    tagCustomersTotal.value = data.total
  } finally { tagCustomersLoading.value = false }
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.subtitle { color: var(--text-muted, #9ca3af); margin: 4px 0 0; font-size: 0.9rem; }
.stats-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { padding: 1.2rem 1.5rem; min-width: 130px; }
.stat-label { font-size: 0.8rem; color: var(--text-muted, #9ca3af); margin-bottom: 4px; }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.stat-value.small { font-size: 1.2rem; }
.empty-state { text-align: center; padding: 3rem 2rem; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.tags-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.2rem; }
.tag-card { padding: 1.2rem; display: flex; flex-direction: column; gap: 10px; }
.tag-header { display: flex; align-items: center; gap: 10px; }
.tag-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
.tag-name { font-weight: 700; flex: 1; }
.tag-count { font-size: 0.8rem; color: var(--text-muted, #9ca3af); }
.tag-actions { display: flex; gap: 8px; }
.color-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.color-input { width: 48px; height: 36px; border: none; background: none; cursor: pointer; padding: 0; }
.color-presets { display: flex; gap: 6px; flex-wrap: wrap; }
.color-preset { width: 22px; height: 22px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: transform 0.1s; }
.color-preset.active, .color-preset:hover { transform: scale(1.3); border-color: rgba(255,255,255,0.5); }
.tag-preview-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; border: 1px solid; font-size: 0.85rem; font-weight: 600; margin-top: 8px; }
.assign-section { padding: 1.5rem; }
.search-row { margin: 1rem 0; }
.customer-results { display: flex; flex-direction: column; gap: 8px; margin-top: 1rem; }
.customer-row { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.customer-info { display: flex; flex-direction: column; }
.customer-tags-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.inline-tag { font-size: 0.78rem; padding: 3px 8px; border-radius: 10px; border: 1px solid; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.remove-tag-btn { background: none; border: none; cursor: pointer; color: inherit; line-height: 1; padding: 0; font-size: 1rem; opacity: 0.7; }
.remove-tag-btn:hover { opacity: 1; }
.tags-checklist { display: flex; flex-direction: column; gap: 10px; margin: 1rem 0; }
.tag-check-row { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 0.9rem; }
.modal-sm { width: 420px; max-width: 95vw; }
.btn-danger { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
.btn-danger:hover { background: rgba(239,68,68,0.25); }
.btn-xs { font-size: 0.75rem; padding: 4px 10px; }
.text-muted { color: var(--text-muted, #9ca3af); }
.small { font-size: 0.82rem; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 0.88rem; }
.table th { font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted, #9ca3af); font-weight: 600; }
.empty { text-align: center; color: var(--text-muted, #9ca3af); padding: 2rem; }
</style>
