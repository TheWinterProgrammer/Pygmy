<template>
  <div class="vendors-page">
    <SiteNav />

    <div class="vendors-hero">
      <div class="container">
        <h1>🏪 Marketplace Vendors</h1>
        <p class="subtitle">Discover independent sellers on our platform</p>
        <div class="hero-search">
          <input v-model="search" @input="loadVendors" placeholder="Search vendors..." class="search-input" />
        </div>
      </div>
    </div>

    <div class="container vendors-body">
      <!-- Loading skeletons -->
      <div v-if="loading" class="vendors-grid">
        <div v-for="i in 8" :key="i" class="vendor-card glass skel"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!vendors.length" class="empty-state">
        <div class="glass empty-card">
          <div class="empty-emoji">🏪</div>
          <h2>{{ search ? 'No vendors found' : 'No vendors yet' }}</h2>
          <p>{{ search ? 'Try a different search term.' : 'Check back soon for sellers on our marketplace.' }}</p>
          <RouterLink to="/shop" class="btn btn-primary">Browse Shop →</RouterLink>
        </div>
      </div>

      <!-- Vendor grid -->
      <div v-else class="vendors-grid">
        <RouterLink
          v-for="v in vendors"
          :key="v.id"
          :to="`/vendors/${v.slug}`"
          class="vendor-card glass"
        >
          <div class="vendor-banner" :style="v.banner ? `background-image:url('${v.banner}')` : ''">
            <div class="banner-overlay"></div>
          </div>
          <div class="vendor-logo-wrap">
            <img v-if="v.logo" :src="v.logo" class="vendor-logo" :alt="v.name" />
            <div v-else class="vendor-logo-ph">{{ v.name[0] }}</div>
          </div>
          <div class="vendor-info">
            <h2 class="vendor-name">{{ v.name }}</h2>
            <p class="vendor-desc" v-if="v.description">{{ truncate(v.description, 80) }}</p>
            <div class="vendor-meta">
              <span class="meta-badge">{{ v.product_count }} products</span>
              <span class="meta-badge sales" v-if="v.total_sales > 0">{{ fmt(v.total_sales) }} sold</span>
            </div>
          </div>
        </RouterLink>
      </div>

      <!-- Pagination -->
      <div class="pagination" v-if="total > perPage">
        <button class="btn btn-ghost" :disabled="page === 1" @click="changePage(page - 1)">← Prev</button>
        <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
        <button class="btn btn-ghost" :disabled="page >= totalPages" @click="changePage(page + 1)">Next →</button>
      </div>
    </div>

    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'

const vendors = ref([])
const total = ref(0)
const loading = ref(true)
const search = ref('')
const page = ref(1)
const perPage = 24

const totalPages = computed(() => Math.ceil(total.value / perPage))

function fmt(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)
}

function truncate(str, n = 80) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

async function loadVendors() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      limit: perPage,
      offset: (page.value - 1) * perPage,
      ...(search.value ? { q: search.value } : {})
    })
    const res = await fetch(`${API}/api/vendors/public?${params}`)
    const data = await res.json()
    vendors.value = data.vendors || []
    total.value = data.total || 0
  } catch {}
  loading.value = false
}

function changePage(p) {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
  loadVendors()
}

onMounted(loadVendors)
</script>

<style scoped>
.vendors-page { min-height: 100vh; background: var(--bg); }

.vendors-hero {
  padding: 7rem 1rem 4rem;
  background: linear-gradient(180deg, hsl(228,4%,12%) 0%, var(--bg) 100%);
  text-align: center;
}
.vendors-hero h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: .5rem; }
.vendors-hero .subtitle { color: rgba(255,255,255,.6); font-size: 1.1rem; margin-bottom: 2rem; }
.hero-search { max-width: 480px; margin: 0 auto; }
.hero-search .search-input { width: 100%; padding: .9rem 1.2rem; border-radius: 1rem; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); color: #fff; font-size: 1rem; }
.hero-search .search-input::placeholder { color: rgba(255,255,255,.4); }

.vendors-body { padding: 3rem 1rem; }

.vendors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.vendor-card {
  border-radius: 1.5rem;
  overflow: hidden;
  transition: transform .2s, box-shadow .2s;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
}
.vendor-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,.4); }

.vendor-banner {
  height: 100px;
  background: linear-gradient(135deg, hsl(355,70%,30%), hsl(228,4%,20%));
  background-size: cover;
  background-position: center;
  position: relative;
}
.banner-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.2); }

.vendor-logo-wrap {
  display: flex;
  justify-content: center;
  margin-top: -32px;
  position: relative;
  z-index: 1;
}
.vendor-logo, .vendor-logo-ph {
  width: 64px; height: 64px;
  border-radius: 50%;
  border: 3px solid var(--surface);
  object-fit: cover;
}
.vendor-logo-ph {
  background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.6rem; font-weight: 700; color: #fff;
}

.vendor-info { padding: 1rem 1.2rem 1.4rem; text-align: center; flex: 1; }
.vendor-name { font-size: 1.1rem; font-weight: 600; margin-bottom: .4rem; }
.vendor-desc { font-size: .85rem; color: rgba(255,255,255,.6); margin-bottom: .8rem; line-height: 1.4; }

.vendor-meta { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
.meta-badge {
  font-size: .75rem;
  background: rgba(255,255,255,.08);
  padding: .25rem .65rem;
  border-radius: 999px;
  color: rgba(255,255,255,.7);
}
.meta-badge.sales { background: rgba(var(--accent-rgb, 204,60,70),.15); color: var(--accent); }

.vendor-card.skel { height: 260px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.3} }

.empty-state { display: flex; justify-content: center; padding: 4rem 0; }
.empty-card { padding: 3rem; text-align: center; border-radius: 2rem; max-width: 400px; }
.empty-emoji { font-size: 3rem; margin-bottom: 1rem; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; }
.page-info { color: rgba(255,255,255,.6); }

.btn { padding: .7rem 1.4rem; border-radius: .75rem; border: none; cursor: pointer; font-weight: 600; transition: opacity .2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-ghost { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }
.btn:disabled { opacity: .4; cursor: default; }

@media (max-width: 600px) {
  .vendors-hero { padding: 6rem 1rem 3rem; }
  .vendors-hero h1 { font-size: 1.8rem; }
  .vendors-grid { grid-template-columns: 1fr 1fr; gap: 1rem; }
}
</style>
