<template>
  <div>
    <div class="page-header">
      <h1>Products</h1>
      <RouterLink to="/products/new" class="btn btn-primary">+ New Product</RouterLink>
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

async function deleteSingle(p) {
  if (!confirm(`Delete "${p.name}"?`)) return
  await api.delete(`/products/${p.id}`)
  toast.success('Product deleted')
  await load()
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
