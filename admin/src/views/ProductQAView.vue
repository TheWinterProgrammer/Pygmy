<template>
  <div>
    <div class="page-header">
      <h1>❓ Product Q&amp;A</h1>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card glass">
        <div class="stat-label">Total</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Pending</div>
        <div class="stat-value" :class="{ accent: stats.pending > 0 }">{{ stats.pending }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Published</div>
        <div class="stat-value">{{ stats.published }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input v-model="search" class="input" placeholder="Search questions…" style="flex:1" />
      <select v-model="statusFilter" class="input" style="width:150px">
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="published">Published</option>
        <option value="spam">Spam</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Question</th>
            <th>Product</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" style="text-align:center;padding:2rem">Loading…</td></tr>
          <tr v-else-if="filtered.length === 0"><td colspan="6" style="text-align:center;padding:2rem;opacity:.5">No questions found</td></tr>
          <tr v-for="qa in filtered" :key="qa.id">
            <td style="max-width:280px">
              <div style="font-weight:600;margin-bottom:.25rem">{{ qa.question }}</div>
              <div v-if="qa.answer" style="opacity:.6;font-size:.85rem">💬 {{ qa.answer.substring(0, 80) }}{{ qa.answer.length > 80 ? '…' : '' }}</div>
              <div v-else style="opacity:.4;font-size:.8rem;font-style:italic">No answer yet</div>
            </td>
            <td>
              <RouterLink :to="`/products/${qa.product_id}`" class="text-link" style="font-size:.85rem">
                {{ productNames[qa.product_id] || `#${qa.product_id}` }}
              </RouterLink>
            </td>
            <td>{{ qa.customer_name }}</td>
            <td>
              <span class="badge" :class="statusClass(qa.status)">{{ qa.status }}</span>
            </td>
            <td style="opacity:.6;font-size:.85rem">{{ fmtDate(qa.created_at) }}</td>
            <td>
              <button class="btn btn-sm btn-ghost" @click="openEdit(qa)">✏️</button>
              <button class="btn btn-sm btn-ghost" @click="confirmDelete(qa)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Modal -->
    <div v-if="editModal" class="modal-backdrop" @click.self="editModal = false">
      <div class="modal glass" style="max-width:600px;width:100%">
        <div class="modal-header">
          <h2>Answer Question</h2>
          <button class="btn btn-ghost btn-sm" @click="editModal = false">✕</button>
        </div>
        <div class="modal-body">
          <label class="label">Question</label>
          <textarea v-model="form.question" class="input" rows="3" style="width:100%;margin-bottom:1rem;resize:vertical"></textarea>

          <label class="label">Answer *</label>
          <textarea v-model="form.answer" class="input" rows="5" placeholder="Type your answer here…" style="width:100%;margin-bottom:1rem;resize:vertical"></textarea>

          <div style="display:flex;gap:1rem;flex-wrap:wrap">
            <div style="flex:1">
              <label class="label">Status</label>
              <select v-model="form.status" class="input" style="width:100%">
                <option value="pending">Pending</option>
                <option value="published">Published</option>
                <option value="spam">Spam</option>
              </select>
            </div>
            <div style="flex:1;display:flex;align-items:flex-end;gap:.5rem">
              <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
                <input type="checkbox" v-model="form.is_featured" />
                <span>Featured (pinned to top)</span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="editModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveEdit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
      <div class="modal glass" style="max-width:400px">
        <div class="modal-header"><h2>Delete Q&amp;A</h2></div>
        <div class="modal-body">
          <p>Delete this question permanently?</p>
          <blockquote style="opacity:.7;font-style:italic">{{ deleteTarget.question }}</blockquote>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRoute } from 'vue-router'

const auth = useAuthStore()
const route = useRoute()
const items = ref([])
const stats = ref({ total: 0, pending: 0, published: 0 })
const loading = ref(true)
const search = ref('')
const statusFilter = ref('pending')
const productIdFilter = ref(route.query.product_id || '')
const editModal = ref(false)
const deleteTarget = ref(null)
const saving = ref(false)
const form = ref({})

const productNames = ref({})

async function load() {
  loading.value = true
  try {
    const pid = productIdFilter.value ? `&product_id=${productIdFilter.value}` : ''
    const [qaRes, statsRes, productsRes] = await Promise.all([
      fetch(`/api/product-qa?status=all&limit=200${pid}`, { headers: { Authorization: `Bearer ${auth.token}` } }),
      fetch('/api/product-qa/stats', { headers: { Authorization: `Bearer ${auth.token}` } }),
      fetch('/api/products?all=1&limit=999', { headers: { Authorization: `Bearer ${auth.token}` } }),
    ])
    const qaData = await qaRes.json()
    items.value = qaData.items || []
    stats.value = await statsRes.json()
    const pData = await productsRes.json()
    const pList = pData.products || pData.items || pData || []
    productNames.value = Object.fromEntries((Array.isArray(pList) ? pList : []).map(p => [p.id, p.name]))
  } catch {}
  loading.value = false
}

const filtered = computed(() => {
  return items.value.filter(qa => {
    const matchStatus = statusFilter.value === 'all' || qa.status === statusFilter.value
    const q = search.value.toLowerCase()
    const matchSearch = !q || qa.question.toLowerCase().includes(q) || (qa.answer || '').toLowerCase().includes(q) || qa.customer_name.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })
})

function openEdit(qa) {
  form.value = { ...qa }
  editModal.value = true
}

async function saveEdit() {
  saving.value = true
  try {
    await fetch(`/api/product-qa/${form.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(form.value),
    })
    await load()
    editModal.value = false
  } catch {}
  saving.value = false
}

function confirmDelete(qa) { deleteTarget.value = qa }

async function doDelete() {
  await fetch(`/api/product-qa/${deleteTarget.value.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  deleteTarget.value = null
  await load()
}

function statusClass(s) {
  return { pending: 'badge-warning', published: 'badge-success', spam: 'badge-danger' }[s] || ''
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : ''
}

onMounted(load)
</script>
