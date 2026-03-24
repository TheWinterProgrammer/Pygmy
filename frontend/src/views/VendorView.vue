<template>
  <div class="vendor-page">
    <SiteNav />

    <!-- Loading -->
    <div v-if="loading" class="loading-state container">
      <div class="skel glass hero-skel"></div>
    </div>

    <!-- Not found -->
    <div v-else-if="!vendor" class="not-found container">
      <div class="glass not-found-card">
        <h2>Vendor not found</h2>
        <RouterLink to="/vendors" class="btn btn-primary">← Back to Vendors</RouterLink>
      </div>
    </div>

    <template v-else>
      <!-- Vendor Hero -->
      <div class="vendor-hero" :style="vendor.banner ? `background-image:url('${vendor.banner}')` : ''">
        <div class="hero-overlay"></div>
        <div class="hero-content container">
          <RouterLink to="/vendors" class="back-link">← All Vendors</RouterLink>
          <div class="vendor-profile">
            <img v-if="vendor.logo" :src="vendor.logo" class="vendor-logo" :alt="vendor.name" />
            <div v-else class="vendor-logo-ph">{{ vendor.name[0] }}</div>
            <div class="vendor-info">
              <h1>{{ vendor.name }}</h1>
              <p v-if="vendor.description">{{ vendor.description }}</p>
              <div class="vendor-stats">
                <span class="stat-pill">{{ vendor.product_count }} Products</span>
                <span class="stat-pill" v-if="vendor.total_sales > 0">{{ fmt(vendor.total_sales) }} in Sales</span>
                <span class="stat-pill">Joined {{ fmtDate(vendor.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Products section -->
      <div class="container products-section">
        <div class="section-header">
          <h2>Products by {{ vendor.name }}</h2>
          <!-- Filter bar -->
          <div class="filter-bar">
            <input v-model="search" @input="debouncedLoad" placeholder="Search products..." class="filter-input" />
            <select v-model="sortBy" @change="loadProducts" class="filter-select">
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">A–Z</option>
            </select>
          </div>
        </div>

        <div v-if="productsLoading" class="products-grid">
          <div v-for="i in 8" :key="i" class="product-card glass skel"></div>
        </div>

        <div v-else-if="!products.length" class="empty-state glass">
          <p>No products found{{ search ? ' for "' + search + '"' : '' }}.</p>
        </div>

        <div v-else class="products-grid">
          <RouterLink
            v-for="p in products"
            :key="p.id"
            :to="`/shop/${p.slug}`"
            class="product-card glass"
          >
            <div class="product-img">
              <img v-if="p.cover_image" :src="p.cover_image" :alt="p.name" loading="lazy" />
              <div v-else class="product-img-ph">🛍️</div>
              <div class="product-badge sale" v-if="p.sale_price">SALE</div>
            </div>
            <div class="product-body">
              <p class="product-cat" v-if="p.category_name">{{ p.category_name }}</p>
              <h3 class="product-name">{{ p.name }}</h3>
              <p class="product-excerpt" v-if="p.excerpt">{{ truncate(p.excerpt, 70) }}</p>
              <div class="product-price">
                <span class="price-current">{{ fmt(p.sale_price || p.price) }}</span>
                <span class="price-orig" v-if="p.sale_price">{{ fmt(p.price) }}</span>
              </div>
            </div>
          </RouterLink>
        </div>

        <!-- Pagination -->
        <div class="pagination" v-if="total > perPage">
          <button class="btn btn-ghost" :disabled="page === 1" @click="changePage(page-1)">← Prev</button>
          <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
          <button class="btn btn-ghost" :disabled="page >= totalPages" @click="changePage(page+1)">Next →</button>
        </div>
      </div>
    </template>

    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
const route = useRoute()

const vendor = ref(null)
const products = ref([])
const total = ref(0)
const loading = ref(true)
const productsLoading = ref(false)
const search = ref('')
const sortBy = ref('newest')
const page = ref(1)
const perPage = 24

const totalPages = computed(() => Math.ceil(total.value / perPage))

function fmt(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function truncate(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

let debounceTimer
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; loadProducts() }, 350)
}

async function loadProducts() {
  productsLoading.value = true
  try {
    const params = new URLSearchParams({
      limit: perPage,
      offset: (page.value - 1) * perPage,
      sort: sortBy.value,
      ...(search.value ? { q: search.value } : {})
    })
    const res = await fetch(`${API}/api/vendors/public/${route.params.slug}?${params}`)
    if (!res.ok) { vendor.value = null; loading.value = false; productsLoading.value = false; return }
    const data = await res.json()
    if (!vendor.value) vendor.value = data.vendor
    products.value = data.products || []
    total.value = data.total || 0
  } catch {}
  loading.value = false
  productsLoading.value = false
}

function changePage(p) {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
  loadProducts()
}

onMounted(async () => {
  await loadProducts()
})

watch(() => route.params.slug, () => {
  vendor.value = null
  page.value = 1
  loading.value = true
  loadProducts()
})
</script>

<style scoped>
.vendor-page { min-height: 100vh; background: var(--bg); }

.vendor-hero {
  padding: 6rem 0 4rem;
  background: linear-gradient(135deg, hsl(355,70%,20%), hsl(228,4%,12%));
  background-size: cover;
  background-position: center;
  position: relative;
}
.hero-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.55); backdrop-filter: blur(2px); }
.hero-content { position: relative; z-index: 1; }

.back-link { color: rgba(255,255,255,.6); text-decoration: none; font-size: .9rem; margin-bottom: 2rem; display: inline-block; }
.back-link:hover { color: #fff; }

.vendor-profile { display: flex; align-items: flex-end; gap: 2rem; }
.vendor-logo, .vendor-logo-ph {
  width: 100px; height: 100px; border-radius: 50%;
  border: 4px solid rgba(255,255,255,.2);
  object-fit: cover;
  flex-shrink: 0;
}
.vendor-logo-ph {
  background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem; font-weight: 700; color: #fff;
}
.vendor-info h1 { font-size: 2rem; font-weight: 700; margin-bottom: .4rem; }
.vendor-info p { color: rgba(255,255,255,.7); margin-bottom: 1rem; max-width: 500px; }
.vendor-stats { display: flex; flex-wrap: wrap; gap: .5rem; }
.stat-pill { font-size: .8rem; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.15); padding: .3rem .8rem; border-radius: 999px; color: rgba(255,255,255,.8); }

.products-section { padding: 3rem 1rem; }

.section-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }
.section-header h2 { font-size: 1.4rem; font-weight: 600; }

.filter-bar { display: flex; gap: .75rem; flex-wrap: wrap; }
.filter-input, .filter-select {
  padding: .55rem 1rem;
  border-radius: .75rem;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12);
  color: #fff;
  font-size: .9rem;
}
.filter-select option { background: hsl(228,4%,15%); }

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.product-card { border-radius: 1.25rem; overflow: hidden; text-decoration: none; color: inherit; transition: transform .2s; }
.product-card:hover { transform: translateY(-3px); }

.product-img { position: relative; height: 180px; overflow: hidden; }
.product-img img { width: 100%; height: 100%; object-fit: cover; }
.product-img-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 3rem; background: rgba(255,255,255,.05); }
.product-badge { position: absolute; top: .6rem; right: .6rem; font-size: .7rem; font-weight: 700; padding: .2rem .5rem; border-radius: .4rem; }
.product-badge.sale { background: var(--accent); color: #fff; }

.product-body { padding: 1rem; }
.product-cat { font-size: .75rem; color: var(--accent); margin-bottom: .3rem; text-transform: uppercase; letter-spacing: .04em; }
.product-name { font-size: .95rem; font-weight: 600; margin-bottom: .3rem; }
.product-excerpt { font-size: .8rem; color: rgba(255,255,255,.5); margin-bottom: .6rem; }
.product-price { display: flex; gap: .5rem; align-items: baseline; }
.price-current { font-size: 1.05rem; font-weight: 700; color: var(--accent); }
.price-orig { font-size: .85rem; color: rgba(255,255,255,.4); text-decoration: line-through; }

.product-card.skel { height: 280px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.3} }

.empty-state { padding: 3rem; text-align: center; border-radius: 1.5rem; color: rgba(255,255,255,.6); }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; }
.page-info { color: rgba(255,255,255,.6); }

.loading-state { padding: 8rem 0; }
.hero-skel { height: 280px; border-radius: 1.5rem; }

.not-found { padding: 8rem 1rem; }
.not-found-card { padding: 3rem; border-radius: 2rem; text-align: center; max-width: 400px; margin: 0 auto; }

.btn { padding: .7rem 1.4rem; border-radius: .75rem; border: none; cursor: pointer; font-weight: 600; transition: opacity .2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-ghost { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }
.btn:disabled { opacity: .4; cursor: default; }

@media (max-width: 600px) {
  .vendor-profile { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .products-grid { grid-template-columns: 1fr 1fr; }
  .section-header { flex-direction: column; align-items: flex-start; }
}
</style>
