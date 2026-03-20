<template>
  <div class="products-page">
    <div class="products-hero container">
      <h1>Shop</h1>
      <p class="subtitle">Browse our collection</p>
    </div>

    <!-- Category filters -->
    <div class="filters container" v-if="categories.length">
      <button
        class="filter-btn"
        :class="{ active: !activeCategory }"
        @click="setCategory(null)"
      >All</button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="filter-btn"
        :class="{ active: activeCategory === cat.slug }"
        @click="setCategory(cat.slug)"
      >{{ cat.name }}</button>
    </div>

    <!-- Tag badge -->
    <div class="container" v-if="activeTag" style="padding:0 1.5rem 1.5rem">
      <span class="tag-filter-badge">
        #{{ activeTag }}
        <button @click="activeTag = null; load()" class="tag-clear">✕</button>
      </span>
    </div>

    <!-- Product grid -->
    <div class="container products-grid" v-if="products.length">
      <RouterLink
        v-for="p in products"
        :key="p.id"
        :to="`/shop/${p.slug}`"
        class="product-card glass"
      >
        <div class="card-img" v-if="p.cover_image">
          <img :src="p.cover_image" :alt="p.name" loading="lazy" />
          <div class="sale-badge" v-if="p.sale_price">Sale</div>
          <div class="featured-badge" v-if="p.featured">★ Featured</div>
          <div class="oos-badge" v-if="p.track_stock && !p.in_stock">Out of Stock</div>
        </div>
        <div class="card-img card-img-placeholder" v-else>🛍️</div>

        <div class="card-body">
          <div class="card-meta">
            <span class="cat-tag" v-if="p.category_name">{{ p.category_name }}</span>
          </div>
          <h2 class="card-title">{{ p.name }}</h2>
          <p class="card-excerpt" v-if="p.excerpt">{{ p.excerpt }}</p>

          <div class="card-footer">
            <div class="price-block">
              <span v-if="p.sale_price" class="price-sale">{{ fmt(p.sale_price) }}</span>
              <span :class="p.sale_price ? 'price-orig' : 'price-normal'" v-if="p.price !== null">{{ fmt(p.price) }}</span>
              <span class="price-free" v-else-if="p.price === null">Free</span>
            </div>
            <div class="tags-row" v-if="p.tags?.length">
              <button
                v-for="tag in p.tags.slice(0,3)"
                :key="tag"
                class="pill"
                @click.prevent="filterTag(tag)"
              >#{{ tag }}</button>
            </div>
            <!-- Quick Add to Cart -->
            <button
              v-if="p.price !== null && (p.in_stock || !p.track_stock)"
              class="quick-atc"
              @click.prevent="quickAdd(p)"
              :class="{ added: addedIds.has(p.id) }"
              :title="addedIds.has(p.id) ? 'Added!' : 'Add to cart'"
            >
              {{ addedIds.has(p.id) ? '✓' : '🛒' }}
            </button>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Loading skeleton -->
    <div class="container products-grid" v-else-if="loading">
      <div class="skeleton glass" v-for="i in 6" :key="i" style="height:340px"></div>
    </div>

    <!-- Empty -->
    <div class="container empty-state" v-else>
      <div class="glass empty-card">
        <p>No products found.</p>
        <button v-if="activeCategory || activeTag" class="btn btn-outline" @click="clearFilters">
          Clear filters
        </button>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination container" v-if="total > limit">
      <button
        class="btn btn-ghost"
        :disabled="offset === 0"
        @click="prev"
      >← Prev</button>
      <span class="page-info">{{ Math.floor(offset / limit) + 1 }} / {{ Math.ceil(total / limit) }}</span>
      <button
        class="btn btn-ghost"
        :disabled="offset + limit >= total"
        @click="next"
      >Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api.js'
import { useCartStore } from '../stores/cart.js'

const route  = useRoute()
const router = useRouter()
const cart   = useCartStore()

const products       = ref([])
const categories     = ref([])
const loading        = ref(true)
const total          = ref(0)
const limit          = 12
const offset         = ref(0)
const activeCategory = ref(route.query.category || null)
const activeTag      = ref(route.query.tag || null)
const addedIds       = ref(new Set())

function quickAdd(product) {
  cart.addItem(product, 1)
  cart.open()
  addedIds.value = new Set([...addedIds.value, product.id])
  setTimeout(() => {
    addedIds.value.delete(product.id)
    addedIds.value = new Set(addedIds.value)
  }, 2000)
}

onMounted(async () => {
  const { data } = await api.get('/products/categories')
  categories.value = data
  await load()
})

watch([activeCategory, activeTag], () => {
  offset.value = 0
  load()
})

async function load() {
  loading.value = true
  const params = { limit, offset: offset.value }
  if (activeCategory.value) params.category = activeCategory.value
  if (activeTag.value) params.tag = activeTag.value

  const { data } = await api.get('/products', { params })
  products.value = data.products
  total.value = data.total
  loading.value = false
}

function setCategory(slug) {
  activeCategory.value = slug
  router.replace({ query: { ...route.query, category: slug || undefined } })
}

function filterTag(tag) {
  activeTag.value = tag
  router.replace({ query: { ...route.query, tag } })
}

function clearFilters() {
  activeCategory.value = null
  activeTag.value = null
  router.replace({ query: {} })
}

function prev() { offset.value = Math.max(0, offset.value - limit); load() }
function next() { offset.value += limit; load() }

function fmt(n) {
  if (n === null || n === undefined) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
</script>

<style scoped>
.products-page { padding-bottom: 4rem; }

.products-hero {
  padding: 4rem 1.5rem 2.5rem;
  text-align: center;
}
.products-hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; margin-bottom: 0.5rem; }
.subtitle { color: var(--text-muted); font-size: 1.05rem; }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0 1.5rem 1.5rem;
}
.filter-btn {
  padding: 0.35rem 1rem;
  border: 1px solid var(--border);
  border-radius: 2rem;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.filter-btn:hover, .filter-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.tag-filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: hsl(355,70%,20%);
  color: var(--accent);
  padding: 0.25rem 0.75rem;
  border-radius: 2rem;
  font-size: 0.82rem;
}
.tag-clear { background: none; border: none; color: inherit; cursor: pointer; font-size: 0.75rem; }

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 0 1.5rem 2rem;
}

.product-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: var(--text);
}
.product-card:hover { transform: translateY(-4px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }

.card-img {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: var(--glass-bg);
}
.card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.product-card:hover .card-img img { transform: scale(1.04); }
.card-img-placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem; background: var(--glass-bg);
}

.sale-badge, .featured-badge {
  position: absolute;
  top: 0.6rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.sale-badge { left: 0.6rem; background: var(--accent); color: #fff; }
.featured-badge { right: 0.6rem; background: gold; color: #000; }
.oos-badge { left: 0; right: 0; bottom: 0; top: auto; border-radius: 0; background: rgba(0,0,0,.75); color: rgba(255,255,255,.8); font-size: .75rem; text-align: center; }

.card-body { padding: 1rem 1.25rem 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
.card-meta { display: flex; gap: 0.5rem; align-items: center; }
.cat-tag {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--accent);
  font-weight: 600;
}
.card-title { font-size: 1.05rem; font-weight: 700; margin: 0; }
.card-excerpt { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; flex: 1; }

.card-footer { margin-top: auto; padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }

.price-block { display: flex; align-items: baseline; gap: 0.5rem; }
.price-sale { color: var(--accent); font-weight: 700; font-size: 1.1rem; }
.price-orig { text-decoration: line-through; color: var(--text-muted); font-size: 0.85rem; }
.price-normal { font-weight: 700; font-size: 1.1rem; }
.price-free { font-weight: 700; color: #4caf50; font-size: 1rem; }

.tags-row { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.pill {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 2rem;
  background: var(--glass-bg);
  color: var(--text-muted);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}
.pill:hover { color: var(--accent); border-color: var(--accent); }

/* Quick Add to Cart button */
.quick-atc {
  align-self: flex-end;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: .5rem;
  padding: .3rem .65rem;
  font-size: .85rem;
  cursor: pointer;
  transition: all .2s;
}
.quick-atc:hover { border-color: var(--accent); color: var(--accent); background: rgba(var(--accent-rgb),.1); }
.quick-atc.added { border-color: #4caf50; color: #4caf50; background: rgba(76,175,80,.12); }

.empty-state { display: flex; justify-content: center; padding: 3rem 1.5rem; }
.empty-card { padding: 2rem 3rem; text-align: center; border-radius: var(--radius); }
.empty-card p { color: var(--text-muted); margin-bottom: 1rem; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
}
.page-info { color: var(--text-muted); font-size: 0.85rem; }
</style>
