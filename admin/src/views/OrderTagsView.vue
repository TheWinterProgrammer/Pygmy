<template>
  <div class="order-tags-view">
    <div class="page-header">
      <h1>🏷️ Order Tags</h1>
      <p class="subtitle">Label and filter orders with custom tags</p>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="stats.length">
      <div class="stat-card" v-for="s in stats.slice(0, 6)" :key="s.tag" @click="filterByTag(s.tag)"
        :class="{ active: tagFilter === s.tag }">
        <span class="tag-pill" :style="tagColor(s.tag)">{{ s.tag }}</span>
        <div class="stat-count">{{ s.usage_count }} orders</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" placeholder="Search orders by number, customer..." class="search-input" />
      <select v-model="statusFilter" class="filter-select">
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="completed">Completed</option>
        <option value="shipped">Shipped</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <div v-if="tagFilter" class="active-tag-filter">
        Filtered by tag: <span class="tag-pill small" :style="tagColor(tagFilter)">{{ tagFilter }}</span>
        <button @click="tagFilter = ''; loadOrders()" class="clear-btn">✕</button>
      </div>
    </div>

    <!-- Bulk actions -->
    <div class="bulk-bar" v-if="selected.length">
      <span>{{ selected.length }} selected</span>
      <div class="bulk-actions">
        <input v-model="bulkTag" placeholder="Tag to add..." class="bulk-tag-input" @keydown.enter="applyBulkTag" />
        <button @click="applyBulkTag" :disabled="!bulkTag.trim()" class="btn-accent">➕ Add Tag</button>
        <button @click="selected = []" class="btn-ghost">Deselect All</button>
      </div>
    </div>

    <!-- Orders table -->
    <div class="glass-card">
      <table class="orders-table">
        <thead>
          <tr>
            <th><input type="checkbox" @change="toggleAll" :checked="allSelected" /></th>
            <th>Order</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
            <th>Tags</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td><input type="checkbox" :value="order.id" v-model="selected" /></td>
            <td class="order-num">{{ order.order_number }}</td>
            <td>
              <div class="customer-name">{{ order.customer_name }}</div>
              <div class="customer-email">{{ order.customer_email }}</div>
            </td>
            <td><span class="status-pill" :class="order.status">{{ order.status }}</span></td>
            <td>{{ currencySymbol }}{{ (order.total || 0).toFixed(2) }}</td>
            <td class="tags-cell">
              <span v-for="tag in parseTags(order.tags)" :key="tag"
                class="tag-pill small" :style="tagColor(tag)">
                {{ tag }}
                <button class="tag-remove" @click="removeTag(order, tag)">✕</button>
              </span>
              <button class="add-tag-btn" @click="openTagEditor(order)">+</button>
            </td>
            <td>{{ fmtDate(order.created_at) }}</td>
            <td>
              <button class="btn-icon" @click="openTagEditor(order)" title="Edit tags">🏷️</button>
            </td>
          </tr>
          <tr v-if="!orders.length">
            <td colspan="8" class="empty">No orders found.</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination" v-if="total > limit">
        <button @click="page--; loadOrders()" :disabled="page === 0">← Prev</button>
        <span>{{ page + 1 }} / {{ Math.ceil(total / limit) }}</span>
        <button @click="page++; loadOrders()" :disabled="(page + 1) * limit >= total">Next →</button>
      </div>
    </div>

    <!-- Tag Editor Modal -->
    <div class="modal-overlay" v-if="editingOrder" @click.self="editingOrder = null">
      <div class="modal glass-card">
        <h3>🏷️ Tags for {{ editingOrder.order_number }}</h3>
        <div class="current-tags">
          <span v-for="tag in editingTags" :key="tag" class="tag-pill" :style="tagColor(tag)">
            {{ tag }}
            <button class="tag-remove" @click="editingTags = editingTags.filter(t => t !== tag)">✕</button>
          </span>
          <span v-if="!editingTags.length" class="empty-tags">No tags yet</span>
        </div>

        <div class="tag-suggestions">
          <span class="label">Suggested:</span>
          <button v-for="s in stats" :key="s.tag" class="suggestion-btn"
            @click="addEditingTag(s.tag)" :disabled="editingTags.includes(s.tag)">
            {{ s.tag }}
          </button>
        </div>

        <div class="add-tag-row">
          <input v-model="newTagInput" placeholder="New tag..." class="tag-input"
            @keydown.enter="addEditingTag(newTagInput)" />
          <button @click="addEditingTag(newTagInput)" :disabled="!newTagInput.trim()" class="btn-accent">Add</button>
        </div>

        <div class="modal-footer">
          <button @click="saveTags" class="btn-accent">💾 Save Tags</button>
          <button @click="editingOrder = null" class="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'

const orders = ref([])
const stats = ref([])
const total = ref(0)
const page = ref(0)
const limit = 30
const search = ref('')
const statusFilter = ref('')
const tagFilter = ref('')
const selected = ref([])
const bulkTag = ref('')
const currencySymbol = ref('€')

// Tag editor
const editingOrder = ref(null)
const editingTags = ref([])
const newTagInput = ref('')

let searchTimeout = null
watch([search, statusFilter], () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { page.value = 0; loadOrders() }, 300)
})

onMounted(async () => {
  loadStats()
  loadOrders()
  try {
    const { data } = await api.get('/settings')
    currencySymbol.value = data.shop_currency_symbol || '€'
  } catch {}
})

async function loadStats() {
  try {
    const { data } = await api.get('/order-tags')
    stats.value = data
  } catch {}
}

async function loadOrders() {
  try {
    const params = { limit, offset: page.value * limit }
    if (search.value) params.q = search.value
    if (statusFilter.value) params.status = statusFilter.value

    if (tagFilter.value) {
      const { data } = await api.get(`/order-tags/by-tag/${encodeURIComponent(tagFilter.value)}`, { params: { limit, offset: page.value * limit } })
      orders.value = data.orders || []
      total.value = data.total || 0
    } else {
      const { data } = await api.get('/orders', { params })
      orders.value = data.orders || data || []
      total.value = data.total || orders.value.length
    }
  } catch (e) {
    console.error(e)
  }
}

function filterByTag(tag) {
  tagFilter.value = tagFilter.value === tag ? '' : tag
  page.value = 0
  loadOrders()
}

function parseTags(raw) {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

function openTagEditor(order) {
  editingOrder.value = order
  editingTags.value = [...parseTags(order.tags)]
  newTagInput.value = ''
}

function addEditingTag(tag) {
  const t = tag?.trim().toLowerCase()
  if (t && !editingTags.value.includes(t)) editingTags.value.push(t)
  if (tag === newTagInput.value) newTagInput.value = ''
}

async function saveTags() {
  if (!editingOrder.value) return
  try {
    const { data } = await api.post(`/order-tags/order/${editingOrder.value.id}`, { tags: editingTags.value })
    const idx = orders.value.findIndex(o => o.id === editingOrder.value.id)
    if (idx !== -1) orders.value[idx].tags = JSON.stringify(data.tags)
    editingOrder.value = null
    loadStats()
  } catch (e) {
    alert('Failed to save tags: ' + (e.response?.data?.error || e.message))
  }
}

async function removeTag(order, tag) {
  try {
    await api.delete(`/order-tags/order/${order.id}/${encodeURIComponent(tag)}`)
    const idx = orders.value.findIndex(o => o.id === order.id)
    if (idx !== -1) {
      const tags = parseTags(orders.value[idx].tags).filter(t => t !== tag)
      orders.value[idx].tags = JSON.stringify(tags)
    }
    loadStats()
  } catch {}
}

async function applyBulkTag() {
  if (!bulkTag.value.trim() || !selected.value.length) return
  try {
    await api.post('/order-tags/bulk', { order_ids: selected.value, tag: bulkTag.value.trim() })
    bulkTag.value = ''
    selected.value = []
    loadOrders()
    loadStats()
  } catch (e) {
    alert('Bulk tag failed: ' + (e.response?.data?.error || e.message))
  }
}

const allSelected = computed(() => orders.value.length > 0 && orders.value.every(o => selected.value.includes(o.id)))
function toggleAll(e) {
  selected.value = e.target.checked ? orders.value.map(o => o.id) : []
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

const TAG_COLORS = ['#e05a6e','#5a9ee0','#5ae07e','#e0c45a','#9e5ae0','#5ae0d4','#e07a5a','#a0a0a0']
function tagColor(tag) {
  const idx = [...tag].reduce((n, c) => n + c.charCodeAt(0), 0) % TAG_COLORS.length
  return { backgroundColor: TAG_COLORS[idx] + '33', color: TAG_COLORS[idx], borderColor: TAG_COLORS[idx] + '66' }
}
</script>

<style scoped>
.order-tags-view { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header h1 { margin: 0; font-size: 1.5rem; }
.subtitle { color: var(--text-muted, #aaa); margin: 0.25rem 0 0; font-size: 0.875rem; }

.stats-strip { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.stat-card {
  background: var(--surface, hsl(228,4%,15%));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.75rem; padding: 0.75rem 1rem;
  cursor: pointer; display: flex; flex-direction: column; gap: 0.25rem;
  transition: border-color 0.15s;
}
.stat-card:hover, .stat-card.active { border-color: var(--accent, hsl(355,70%,58%)); }
.stat-count { font-size: 0.75rem; color: var(--text-muted, #aaa); }

.filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
.search-input, .filter-select, .bulk-tag-input, .tag-input {
  background: var(--surface, hsl(228,4%,15%));
  border: 1px solid rgba(255,255,255,0.08); border-radius: 0.5rem;
  color: inherit; padding: 0.5rem 0.875rem; font-size: 0.875rem;
}
.search-input { flex: 1; min-width: 200px; }
.filter-select { min-width: 140px; }

.active-tag-filter { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
.clear-btn { background: none; border: none; cursor: pointer; color: var(--text-muted, #aaa); font-size: 1rem; }

.bulk-bar {
  background: var(--surface); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.75rem; padding: 0.75rem 1rem;
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
}
.bulk-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.bulk-tag-input { min-width: 160px; }

.glass-card {
  background: var(--surface, hsl(228,4%,15%));
  border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem;
  overflow: hidden;
}
.orders-table { width: 100%; border-collapse: collapse; }
.orders-table th, .orders-table td {
  padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 0.875rem;
}
.orders-table th { color: var(--text-muted, #aaa); font-weight: 500; background: rgba(255,255,255,0.02); }
.customer-name { font-weight: 500; }
.customer-email { font-size: 0.75rem; color: var(--text-muted, #aaa); }
.order-num { font-family: monospace; font-weight: 600; }

.status-pill {
  display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px;
  font-size: 0.75rem; font-weight: 500; text-transform: capitalize;
}
.status-pill.pending { background: #f5a62333; color: #f5a623; }
.status-pill.processing { background: #3b82f633; color: #60a5fa; }
.status-pill.completed { background: #22c55e33; color: #4ade80; }
.status-pill.shipped { background: #8b5cf633; color: #a78bfa; }
.status-pill.cancelled { background: #ef444433; color: #f87171; }

.tags-cell { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; max-width: 220px; }
.tag-pill {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem;
  font-weight: 600; border: 1px solid;
}
.tag-pill.small { font-size: 0.7rem; padding: 0.15rem 0.4rem; }
.tag-remove { background: none; border: none; cursor: pointer; font-size: 0.65rem; opacity: 0.7; color: inherit; }
.tag-remove:hover { opacity: 1; }
.add-tag-btn { background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); border-radius: 999px; padding: 0.15rem 0.5rem; cursor: pointer; font-size: 0.75rem; color: var(--text-muted,#aaa); }
.add-tag-btn:hover { background: rgba(255,255,255,0.1); }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0.25rem; }
.empty { text-align: center; color: var(--text-muted, #aaa); padding: 2rem !important; }

.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; padding: 1rem; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
.modal { min-width: 400px; max-width: 560px; width: 100%; padding: 1.5rem; border-radius: 1rem; display: flex; flex-direction: column; gap: 1rem; }
.modal h3 { margin: 0; font-size: 1.1rem; }
.current-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; min-height: 36px; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 0.5rem; }
.empty-tags { color: var(--text-muted, #aaa); font-size: 0.875rem; align-self: center; }
.tag-suggestions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.label { font-size: 0.75rem; color: var(--text-muted, #aaa); margin-right: 0.25rem; }
.suggestion-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; padding: 0.2rem 0.6rem; cursor: pointer; font-size: 0.75rem; color: inherit; }
.suggestion-btn:disabled { opacity: 0.4; cursor: default; }
.suggestion-btn:not(:disabled):hover { background: rgba(255,255,255,0.1); }
.add-tag-row { display: flex; gap: 0.5rem; }
.tag-input { flex: 1; }
.modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06); }

.btn-accent { background: var(--accent, hsl(355,70%,58%)); color: white; border: none; border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.btn-accent:disabled { opacity: 0.5; cursor: default; }
.btn-ghost { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: inherit; border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.875rem; }
</style>
