<template>
  <div class="shared-wishlist-page">
    <div class="container">
      <!-- Loading -->
      <div class="loading-state" v-if="loading">
        <div class="spinner"></div>
        <p>Loading wishlist…</p>
      </div>

      <!-- Error -->
      <div class="error-state glass" v-else-if="error">
        <div class="error-icon">💔</div>
        <h2>Wishlist Not Found</h2>
        <p>{{ error }}</p>
        <RouterLink to="/shop" class="btn btn-primary">Browse Shop</RouterLink>
      </div>

      <!-- Wishlist content -->
      <template v-else-if="wishlist">
        <!-- Header -->
        <div class="wishlist-hero glass">
          <div class="wh-icon">💝</div>
          <div class="wh-info">
            <h1 class="wh-title">{{ wishlist.name }}</h1>
            <p class="wh-sub">
              {{ wishlist.owner_name }}'s wishlist · {{ wishlist.items.length }} item{{ wishlist.items.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <div class="wh-actions">
            <button class="btn btn-ghost" @click="copyLink">
              {{ copied ? '✅ Copied!' : '🔗 Copy Link' }}
            </button>
            <RouterLink to="/shop" class="btn btn-outline">🛍️ Browse Shop</RouterLink>
          </div>
        </div>

        <!-- Empty -->
        <div class="empty-state glass" v-if="wishlist.items.length === 0">
          <div class="empty-icon">📭</div>
          <h3>This wishlist is empty</h3>
          <p>Nothing has been added yet.</p>
        </div>

        <!-- Products grid -->
        <div class="products-grid" v-else>
          <div v-for="p in wishlist.items" :key="p.id" class="product-card glass">
            <RouterLink :to="`/shop/${p.slug}`" class="card-img">
              <img v-if="p.cover_image" :src="p.cover_image" :alt="p.name" loading="lazy" />
              <div class="img-ph" v-else>🛍️</div>
              <div class="sale-badge" v-if="p.sale_price">Sale</div>
            </RouterLink>
            <div class="card-body">
              <p class="card-cat" v-if="p.category_name">{{ p.category_name }}</p>
              <RouterLink :to="`/shop/${p.slug}`" class="card-name">{{ p.name }}</RouterLink>
              <p class="card-excerpt" v-if="p.excerpt">{{ p.excerpt }}</p>
              <div class="card-pricing">
                <span class="price-sale" v-if="p.sale_price">{{ fmt(p.sale_price) }}</span>
                <span class="price-orig" :class="{ 'price-strike': p.sale_price }">{{ fmt(p.price) }}</span>
              </div>
              <div class="card-stock">
                <span v-if="!p.track_stock || p.stock_quantity > 0" class="stock-in">In Stock</span>
                <span v-else class="stock-out">Out of Stock</span>
              </div>
              <RouterLink :to="`/shop/${p.slug}`" class="btn btn-primary btn-full">View Product →</RouterLink>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import { useCurrency } from '../composables/useCurrency.js'

const route = useRoute()
const { fmt, ensureLoaded } = useCurrency()

const wishlist = ref(null)
const loading = ref(true)
const error = ref(null)
const copied = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    await ensureLoaded()
    const { data } = await api.get(`/wishlists/shared/${route.params.code}`)
    wishlist.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'This wishlist could not be found.'
  } finally { loading.value = false }
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2500)
}

onMounted(load)
</script>

<style scoped>
.shared-wishlist-page { min-height: 100vh; padding: 2rem 0 4rem; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 40vh; gap: 1rem; color: var(--text-muted, #aaa); }
.spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,.1); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.error-state { text-align: center; padding: 4rem 2rem; border-radius: 2rem; margin: 3rem 0; }
.error-icon { font-size: 3rem; margin-bottom: 1rem; }
.error-state h2 { margin: 0 0 .5rem; }
.error-state p { color: var(--text-muted, #aaa); margin: 0 0 1.5rem; }

.wishlist-hero {
  display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem;
  border-radius: 1.5rem; margin-bottom: 2rem; flex-wrap: wrap;
}
.wh-icon { font-size: 2.5rem; }
.wh-info { flex: 1; }
.wh-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 .25rem; }
.wh-sub { color: var(--text-muted, #aaa); margin: 0; font-size: .9rem; }
.wh-actions { display: flex; gap: .75rem; flex-wrap: wrap; }

.empty-state { text-align: center; padding: 3rem 2rem; border-radius: 2rem; margin: 2rem 0; }
.empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }
.empty-state h3 { margin: 0 0 .5rem; }
.empty-state p { color: var(--text-muted, #aaa); margin: 0; }

.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.25rem; }

.product-card { border-radius: 1.25rem; overflow: hidden; display: flex; flex-direction: column; transition: transform .2s; }
.product-card:hover { transform: translateY(-4px); }

.card-img { display: block; position: relative; height: 200px; overflow: hidden; background: rgba(255,255,255,.04); text-decoration: none; }
.card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.product-card:hover .card-img img { transform: scale(1.04); }
.img-ph { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 2.5rem; }
.sale-badge { position: absolute; top: .5rem; right: .5rem; background: var(--accent); color: #fff; font-size: .65rem; font-weight: 700; padding: .2rem .5rem; border-radius: .3rem; }

.card-body { padding: 1rem; flex: 1; display: flex; flex-direction: column; gap: .35rem; }
.card-cat { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); margin: 0; }
.card-name { font-weight: 600; text-decoration: none; color: inherit; font-size: .95rem; }
.card-name:hover { color: var(--accent); }
.card-excerpt { font-size: .8rem; color: var(--text-muted, #aaa); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-pricing { display: flex; gap: .5rem; align-items: baseline; margin-top: auto; }
.price-sale { font-weight: 700; color: var(--accent); font-size: 1.1rem; }
.price-orig { font-size: 1rem; font-weight: 600; }
.price-strike { text-decoration: line-through; color: var(--text-muted, #aaa); font-size: .85rem; font-weight: 400; }
.card-stock { font-size: .75rem; }
.stock-in { color: #4ade80; }
.stock-out { color: #f87171; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; padding: .5rem 1rem; border-radius: 2rem; font-size: .85rem; font-weight: 500; cursor: pointer; text-decoration: none; border: none; transition: all .2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { opacity: .88; }
.btn-outline { background: transparent; border: 1px solid rgba(255,255,255,.2); color: inherit; }
.btn-outline:hover { background: rgba(255,255,255,.06); border-color: var(--accent); }
.btn-ghost { background: rgba(255,255,255,.06); color: inherit; }
.btn-ghost:hover { background: rgba(255,255,255,.12); }
.btn-full { width: 100%; margin-top: .5rem; border-radius: .5rem; }
</style>
