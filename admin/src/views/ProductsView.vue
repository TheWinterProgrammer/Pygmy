<template>
  <div>
    <div class="page-header">
      <h1>Products</h1>
      <RouterLink to="/products/new" class="btn btn-primary">+ New Product</RouterLink>
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

    <div class="glass section" v-if="filtered.length">
      <table class="data-table">
        <thead>
          <tr>
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
          <tr v-for="p in filtered" :key="p.id">
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
                <button class="btn btn-danger btn-sm" @click="deleteProduct(p)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state glass" v-else>
      <p>No products yet. <RouterLink to="/products/new">Add your first product.</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const products = ref([])
const categories = ref([])
const activeCategory = ref(null)

const filtered = computed(() =>
  activeCategory.value
    ? products.value.filter(p => p.category_id === activeCategory.value)
    : products.value
)

onMounted(load)

async function load() {
  const [pRes, cRes] = await Promise.all([
    api.get('/products?all=1&limit=200'),
    api.get('/products/categories'),
  ])
  products.value = pRes.data.products
  categories.value = cRes.data
}

async function deleteProduct(p) {
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
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
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
</style>
