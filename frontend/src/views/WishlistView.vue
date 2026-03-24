<template>
  <div class="wishlist-page">
    <div class="container">
      <div class="wishlist-header">
        <h1>♡ Wishlist</h1>
        <div class="header-actions" v-if="(displayItems !== null ? displayItems.length : wishlist.items.length)">
          <span class="text-muted" style="font-size:.9rem;">
            {{ (displayItems !== null ? displayItems.length : wishlist.count) }} item{{ (displayItems !== null ? displayItems.length : wishlist.count) !== 1 ? 's' : '' }}
          </span>
          <span v-if="customer.isLoggedIn" class="text-muted" style="font-size:.8rem;opacity:.6;">☁️ Synced</span>
          <button class="btn btn-ghost btn-sm" @click="wishlist.clear(); if (displayItems !== null) displayItems = []">Clear all</button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="serverLoading" class="loading-state glass" style="padding:2rem;text-align:center;border-radius:1rem;">
        Loading your wishlist…
      </div>

      <!-- Empty state -->
      <div class="empty-state glass" v-else-if="(displayItems !== null ? !displayItems.length : !wishlist.items.length)">
        <div style="font-size:3rem;margin-bottom:.75rem;">♡</div>
        <h2>Your wishlist is empty</h2>
        <p class="text-muted">Save products you love and come back to them later.</p>
        <RouterLink to="/shop" class="btn btn-primary" style="margin-top:1rem;">Browse Shop</RouterLink>
      </div>

      <!-- Server error notice -->
      <div v-if="serverError" style="color:#f87171;font-size:.85rem;margin-bottom:.75rem;">{{ serverError }}</div>

      <!-- Share Wishlist (logged-in only) -->
      <div v-if="customer.isLoggedIn && !serverLoading && (displayItems !== null ? displayItems.length : wishlist.items.length)" class="share-section glass">
        <div class="share-info">
          <span class="share-icon">🔗</span>
          <div>
            <strong>Share your wishlist</strong>
            <p v-if="!sharedWishlist">Anyone with the link can view your wishlist items.</p>
            <p v-else>
              Your wishlist is shared! <a :href="sharedUrl" target="_blank" class="share-link">{{ sharedUrl }}</a>
            </p>
          </div>
        </div>
        <div class="share-actions">
          <template v-if="!sharedWishlist">
            <button class="btn btn-primary btn-sm" @click="createShare" :disabled="sharing">
              {{ sharing ? 'Creating…' : '🌐 Create Public Link' }}
            </button>
          </template>
          <template v-else>
            <button class="btn btn-ghost btn-sm" @click="copyShareLink">
              {{ shareCopied ? '✅ Copied!' : '📋 Copy Link' }}
            </button>
            <button class="btn btn-danger btn-sm" @click="removeShare" :disabled="sharing">Remove</button>
          </template>
        </div>
      </div>

      <!-- Wishlist grid -->
      <div class="wishlist-grid" v-if="!serverLoading && (displayItems !== null ? displayItems.length : wishlist.items.length)">
        <div class="wishlist-card glass" v-for="item in (displayItems !== null ? displayItems : wishlist.items)" :key="item.id">
          <div class="card-img">
            <RouterLink :to="`/shop/${item.slug}`">
              <img v-if="item.cover_image" :src="item.cover_image" :alt="item.name" />
              <div v-else class="img-placeholder">🛍️</div>
            </RouterLink>
            <button class="remove-heart"
              @click="displayItems !== null ? removeServerItem(item.id) : wishlist.remove(item.id)"
              title="Remove from wishlist">♥</button>
          </div>

          <div class="card-body">
            <RouterLink :to="`/shop/${item.slug}`" class="item-name">{{ item.name }}</RouterLink>
            <p class="item-excerpt text-muted" v-if="item.excerpt">{{ item.excerpt }}</p>

            <div class="price-block">
              <span class="price-sale" v-if="item.sale_price">{{ fmt(item.sale_price) }}</span>
              <span :class="item.sale_price ? 'price-orig' : 'price-normal'" v-if="item.price !== null">{{ fmt(item.price) }}</span>
              <span class="price-free" v-else>Free</span>
            </div>

            <div class="card-actions">
              <RouterLink :to="`/shop/${item.slug}`" class="btn btn-primary btn-sm">View Product</RouterLink>
              <button class="btn btn-ghost btn-sm" @click="addToCart(item)">🛒 Add to Cart</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useWishlistStore } from '../stores/wishlist.js'
import { useCartStore } from '../stores/cart.js'
import { useSiteStore } from '../stores/site.js'
import { useCustomerStore } from '../stores/customer.js'
import api from '../api.js'

const wishlist  = useWishlistStore()
const cart      = useCartStore()
const site      = useSiteStore()
const customer  = useCustomerStore()

// Server-side wishlist state (for logged-in customers)
const serverItems   = ref(null)  // null = not loaded yet
const serverLoading = ref(false)
const serverError   = ref(null)

// Items to display: prefer server items when logged in
const displayItems = ref(null)

async function loadServerWishlist() {
  if (!customer.isLoggedIn) return
  serverLoading.value = true
  try {
    const { data } = await api.get('/wishlists/me', {
      headers: { Authorization: `Bearer ${customer.token}` }
    })
    serverItems.value = data || []
    displayItems.value = data
  } catch (e) {
    serverError.value = 'Could not load wishlist from server.'
  } finally {
    serverLoading.value = false
  }
}

// ── Shared Wishlist ───────────────────────────────────────────────────────────
const sharedWishlist = ref(null)
const sharing = ref(false)
const shareCopied = ref(false)
const sharedUrl = ref('')

async function loadSharedWishlist() {
  if (!customer.isLoggedIn) return
  try {
    const { data } = await api.get('/wishlists/me/shared', {
      headers: { Authorization: `Bearer ${customer.token}` }
    })
    sharedWishlist.value = data
    if (data) sharedUrl.value = `${window.location.origin}/wishlist/shared/${data.share_code}`
  } catch {}
}

async function createShare() {
  sharing.value = true
  try {
    const { data } = await api.post('/wishlists/me/share', { name: 'My Wishlist', public: 1 }, {
      headers: { Authorization: `Bearer ${customer.token}` }
    })
    sharedWishlist.value = data
    sharedUrl.value = `${window.location.origin}/wishlist/shared/${data.share_code}`
  } catch (e) {
    alert('Could not create shared wishlist')
  } finally { sharing.value = false }
}

async function removeShare() {
  sharing.value = true
  try {
    await api.delete('/wishlists/me/shared', { headers: { Authorization: `Bearer ${customer.token}` } })
    sharedWishlist.value = null
    sharedUrl.value = ''
  } catch {} finally { sharing.value = false }
}

function copyShareLink() {
  navigator.clipboard.writeText(sharedUrl.value)
  shareCopied.value = true
  setTimeout(() => { shareCopied.value = false }, 2500)
}

async function removeServerItem(productId) {
  try {
    await api.delete(`/wishlists/me/${productId}`, {
      headers: { Authorization: `Bearer ${customer.token}` }
    })
    serverItems.value = serverItems.value.filter(i => i.id !== productId)
    displayItems.value = serverItems.value
    // Also remove from local store
    wishlist.remove(productId)
  } catch {}
}

onMounted(async () => {
  await loadServerWishlist()
  await loadSharedWishlist()
})

function fmt(v) {
  const symbol = site.settings?.shop_currency_symbol || '€'
  const currency = site.settings?.shop_currency || 'EUR'
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(v || 0)
  } catch {
    return `${symbol}${Number(v || 0).toFixed(2)}`
  }
}

function addToCart(item) {
  cart.addItem(item, 1)
  cart.open()
}
</script>

<style scoped>
.wishlist-page {
  min-height: 60vh;
  padding: 2rem 0 4rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.wishlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.wishlist-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  border-radius: 1.5rem;
  max-width: 460px;
  margin: 0 auto;
}

/* Grid */
.wishlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
}

.wishlist-card {
  border-radius: 1.25rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform .2s, box-shadow .2s;
}
.wishlist-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(0,0,0,.35);
}

.share-section {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding: 1rem 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
}
.share-info { display: flex; align-items: flex-start; gap: .75rem; flex: 1; }
.share-icon { font-size: 1.3rem; }
.share-info strong { display: block; margin-bottom: .2rem; }
.share-info p { margin: 0; color: var(--text-muted, #aaa); font-size: .85rem; }
.share-link { color: var(--accent); word-break: break-all; font-size: .8rem; }
.share-actions { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
.btn-danger { background: rgba(239,68,68,.15); color: #f87171; border: 1px solid rgba(239,68,68,.3); }
.btn-danger:hover { background: rgba(239,68,68,.25); }

.card-img {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: rgba(255,255,255,.04);
}
.card-img img {
  width: 100%; height: 100%; object-fit: cover;
  transition: transform .3s;
}
.wishlist-card:hover .card-img img { transform: scale(1.04); }
.img-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem;
  color: rgba(255,255,255,.2);
}

.remove-heart {
  position: absolute;
  top: .6rem; right: .6rem;
  background: rgba(0,0,0,.55);
  border: none;
  color: var(--accent);
  font-size: 1.1rem;
  cursor: pointer;
  border-radius: 50%;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s, transform .15s;
}
.remove-heart:hover {
  background: var(--accent);
  color: #fff;
  transform: scale(1.1);
}

.card-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: .5rem;
  flex: 1;
}

.item-name {
  font-weight: 600;
  font-size: 1rem;
  color: #fff;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.item-name:hover { color: var(--accent); }

.item-excerpt {
  font-size: .85rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.price-block { display: flex; align-items: baseline; gap: .5rem; }
.price-sale { color: var(--accent); font-size: 1.1rem; font-weight: 700; }
.price-orig { color: var(--text-muted); font-size: .9rem; text-decoration: line-through; }
.price-normal { color: var(--accent); font-size: 1.1rem; font-weight: 700; }
.price-free { color: hsl(140,60%,60%); font-size: 1.1rem; font-weight: 700; }

.card-actions {
  display: flex;
  gap: .5rem;
  margin-top: auto;
  padding-top: .5rem;
  flex-wrap: wrap;
}
</style>
