<template>
  <div>
    <div class="page-header">
      <h1>Products</h1>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" @click="exportCsv" title="Download all products as CSV">⬇️ Export CSV</button>
        <label class="btn btn-ghost btn-sm" title="Import products from CSV file" style="cursor:pointer;">
          ⬆️ Import CSV
          <input type="file" accept=".csv" style="display:none;" @change="importCsv" ref="csvFileInput" />
        </label>
        <RouterLink to="/products/new" class="btn btn-primary">+ New Product</RouterLink>
      </div>
    </div>

    <!-- Import result banner -->
    <div v-if="importResult" class="import-banner glass" :class="importResult.ok ? 'banner-ok' : 'banner-err'">
      <div v-if="importResult.ok">
        ✅ Import complete — {{ importResult.report.created }} created, {{ importResult.report.updated }} updated, {{ importResult.report.skipped }} skipped
        <span v-if="importResult.report.errors?.length"> · ⚠️ {{ importResult.report.errors.length }} errors</span>
      </div>
      <div v-else>❌ Import failed: {{ importResult.error }}</div>
      <button class="btn-close-sm" @click="importResult = null">✕</button>
    </div>

    <!-- Filters row -->
    <div class="filter-bar glass">
      <input
        v-model="search"
        class="input search-input"
        placeholder="🔍 Search products…"
      />
      <select v-model="statusFilter" class="select">
        <option value="">All statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
      <span class="count-badge" v-if="filtered.length !== products.length">
        {{ filtered.length }} / {{ products.length }}
      </span>
    </div>

    <!-- Category filters -->
    <div class="filters" v-if="categories.length">
      <button
        class="filter-btn"
        :class="{ active: !activeCategory }"
        @click="activeCategory = null"
      >All</button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="filter-btn"
        :class="{ active: activeCategory === cat.id }"
        @click="activeCategory = cat.id"
      >{{ cat.name }}</button>
    </div>

    <!-- Bulk action bar -->
    <Transition name="slide-up">
      <div class="bulk-bar glass" v-if="selected.size > 0">
        <span class="bulk-count">{{ selected.size }} selected</span>
        <button class="btn btn-sm btn-ghost" @click="bulkAction('publish')">✅ Publish</button>
        <button class="btn btn-sm btn-ghost" @click="bulkAction('unpublish')">📝 Unpublish</button>
        <button class="btn btn-sm btn-ghost" @click="openBulkEdit">✏️ Edit Prices/Stock</button>
        <button class="btn btn-sm btn-danger" @click="bulkAction('delete')">🗑 Delete</button>
        <button class="btn btn-sm btn-ghost" @click="selected.clear()">✕ Deselect</button>
      </div>
    </Transition>

    <!-- Bulk Price/Stock Edit Modal -->
    <div class="modal-overlay" v-if="bulkEditOpen" @click.self="bulkEditOpen = false">
      <div class="modal glass-modal">
        <div class="modal-header">
          <h2>✏️ Bulk Edit — {{ selected.size }} product{{ selected.size !== 1 ? 's' : '' }}</h2>
          <button class="modal-close" @click="bulkEditOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <p class="modal-hint">Leave a field blank to keep existing values unchanged.</p>
          <div class="form-two-col">
            <div class="form-row">
              <label>Set Price (€)</label>
              <input v-model="bulkEditForm.price" type="number" min="0" step="0.01" class="input" placeholder="e.g. 29.99" />
            </div>
            <div class="form-row">
              <label>Set Sale Price (€)</label>
              <input v-model="bulkEditForm.sale_price" type="number" min="0" step="0.01" class="input" placeholder="Leave blank = no sale" />
            </div>
            <div class="form-row">
              <label>Set Stock Quantity</label>
              <input v-model="bulkEditForm.stock_quantity" type="number" min="0" class="input" placeholder="e.g. 100" />
            </div>
            <div class="form-row">
              <label>Set Status</label>
              <select v-model="bulkEditForm.status" class="select">
                <option value="">— keep existing —</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
          <div class="form-row" style="margin-top:.75rem">
            <label>
              <input type="checkbox" v-model="bulkEditForm.clear_sale" style="margin-right:.4rem" />
              Clear sale price (remove discounts)
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="bulkEditOpen = false">Cancel</button>
          <button class="btn btn-primary" @click="applyBulkEdit" :disabled="bulkEditing">
            {{ bulkEditing ? 'Saving…' : `Apply to ${selected.size} product${selected.size !== 1 ? 's' : ''}` }}
          </button>
        </div>
      </div>
    </div>

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
            <th style="width:56px"></th>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Status</th>
            <th>Featured</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filtered" :key="p.id" :class="{ 'row-selected': selected.has(p.id) }">
            <td class="col-check">
              <input
                type="checkbox"
                :checked="selected.has(p.id)"
                @change="toggleOne(p.id)"
                class="check"
              />
            </td>
            <td>
              <div class="thumb">
                <img v-if="p.cover_image" :src="p.cover_image" alt="" />
                <span v-else>🛍️</span>
              </div>
            </td>
            <td>
              <strong>{{ p.name }}</strong>
              <div class="slug-hint">{{ p.slug }}</div>
            </td>
            <td class="text-muted">{{ p.category_name || '—' }}</td>
            <td>
              <template v-if="p.price !== null">
                <span v-if="p.sale_price" class="sale-price">{{ fmt(p.sale_price) }}</span>
                <span :class="p.sale_price ? 'original-price' : ''">{{ fmt(p.price) }}</span>
              </template>
              <span v-else class="text-muted">—</span>
            </td>
            <td><span class="badge" :class="`badge-${p.status}`">{{ p.status }}</span></td>
            <td>
              <span v-if="p.featured" title="Featured" class="star">★</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td style="text-align:right">
              <div class="actions">
                <RouterLink :to="`/products/${p.id}`" class="btn btn-ghost btn-sm">Edit</RouterLink>
                <button class="btn btn-ghost btn-sm" @click="duplicateProduct(p)" title="Duplicate as draft">⧉</button>
                <button class="btn btn-danger btn-sm" @click="deleteSingle(p)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state glass" v-else-if="products.length">
      <p>No products match your filters.</p>
    </div>

    <div class="empty-state glass" v-else>
      <p>No products yet. <RouterLink to="/products/new">Add your first product.</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const products = ref([])
const categories = ref([])
const activeCategory = ref(null)
const search = ref('')
const statusFilter = ref('')
const selected = reactive(new Set())
const bulkEditOpen = ref(false)
const bulkEditing = ref(false)
const bulkEditForm = ref({ price: '', sale_price: '', stock_quantity: '', status: '', clear_sale: false })

const filtered = computed(() => {
  let list = products.value
  if (activeCategory.value) list = list.filter(p => p.category_id === activeCategory.value)
  if (statusFilter.value) list = list.filter(p => p.status === statusFilter.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q) || (p.slug || '').includes(q))
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

onMounted(load)

async function load() {
  const [pRes, cRes] = await Promise.all([
    api.get('/products?all=1&limit=200'),
    api.get('/products/categories'),
  ])
  products.value = pRes.data.products
  categories.value = cRes.data
  selected.clear()
}

async function bulkAction(action) {
  const ids = [...selected]
  if (action === 'delete' && !confirm(`Delete ${ids.length} product(s)?`)) return
  try {
    await api.post('/products/bulk', { action, ids })
    toast.success(`${ids.length} product(s) ${action === 'delete' ? 'deleted' : action === 'publish' ? 'published' : 'unpublished'}`)
    await load()
  } catch {
    toast.error('Bulk action failed')
  }
}

function openBulkEdit() {
  bulkEditForm.value = { price: '', sale_price: '', stock_quantity: '', status: '', clear_sale: false }
  bulkEditOpen.value = true
}

async function applyBulkEdit() {
  const ids = [...selected]
  const patch = {}
  if (bulkEditForm.value.price !== '') patch.price = Number(bulkEditForm.value.price)
  if (bulkEditForm.value.clear_sale) {
    patch.sale_price = null
  } else if (bulkEditForm.value.sale_price !== '') {
    patch.sale_price = Number(bulkEditForm.value.sale_price)
  }
  if (bulkEditForm.value.stock_quantity !== '') patch.stock_quantity = Number(bulkEditForm.value.stock_quantity)
  if (bulkEditForm.value.status) patch.status = bulkEditForm.value.status

  if (!Object.keys(patch).length) {
    toast.error('No changes specified')
    return
  }

  bulkEditing.value = true
  let updated = 0
  let failed = 0
  for (const id of ids) {
    try {
      await api.put(`/products/${id}`, patch)
      updated++
    } catch {
      failed++
    }
  }
  bulkEditing.value = false
  bulkEditOpen.value = false
  if (updated > 0) toast.success(`Updated ${updated} product${updated !== 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}`)
  else toast.error('All updates failed')
  await load()
}

async function deleteSingle(p) {
  if (!confirm(`Delete "${p.name}"?`)) return
  await api.delete(`/products/${p.id}`)
  toast.success('Product deleted')
  await load()
}

async function duplicateProduct(p) {
  try {
    const { data } = await api.post(`/products/${p.id}/duplicate`)
    toast.success(`"${data.name}" created as draft`)
    await load()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Duplicate failed')
  }
}

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border-radius: 0.75rem;
}
.search-input { flex: 1; min-width: 0; }
.count-badge { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.filter-btn {
  padding: 0.3rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.83rem;
  transition: all 0.2s;
}
.filter-btn:hover, .filter-btn.active {
  background: hsl(355,70%,20%);
  color: var(--accent);
  border-color: var(--accent);
}

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

/* Bulk Edit Modal */
.modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.55);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.glass-modal {
  background: hsl(228,4%,16%);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 1.25rem;
  width: 100%; max-width: 560px;
  box-shadow: 0 24px 64px rgba(0,0,0,.5);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.modal-header h2 { font-size: 1.05rem; margin: 0; }
.modal-close {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  font-size: 1.2rem; padding: 0 .25rem;
  transition: color .15s;
}
.modal-close:hover { color: var(--text); }
.modal-body { padding: 1.25rem 1.5rem; }
.modal-hint { font-size: .82rem; color: var(--text-muted); margin-bottom: 1rem; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: .75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255,255,255,.07);
}
.form-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.form-row { display: flex; flex-direction: column; gap: .35rem; }
.form-row label { font-size: .82rem; color: var(--text-muted); }
.input { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .5rem .75rem; color: var(--text); font-size: .88rem; width: 100%; }
.select { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .5rem .75rem; color: var(--text); font-size: .88rem; width: 100%; }

.section { padding: 0; overflow: hidden; }
.text-muted { color: var(--text-muted); font-size: 0.85rem; }
.actions { display: flex; gap: 0.4rem; justify-content: flex-end; }
.empty-state { padding: 2rem; text-align: center; color: var(--text-muted); }

.thumb {
  width: 40px; height: 40px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--glass-bg);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem;
}
.thumb img { width: 100%; height: 100%; object-fit: cover; }

.slug-hint { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
.sale-price { color: var(--accent); font-weight: 600; margin-right: 0.35rem; }
.original-price { text-decoration: line-through; color: var(--text-muted); font-size: 0.82rem; }
.star { color: gold; font-size: 1rem; }

.slide-up-enter-active,
.slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-enter-from,
.slide-up-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
