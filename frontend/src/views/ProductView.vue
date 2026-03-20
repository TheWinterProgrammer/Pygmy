<template>
  <div class="product-page">
    <!-- Loading -->
    <div class="container skeleton-wrap" v-if="loading">
      <div class="skeleton-title"></div>
      <div class="skeleton-body glass"></div>
    </div>

    <!-- 404 -->
    <div class="container not-found" v-else-if="!product">
      <div class="glass not-found-card">
        <h1>404</h1>
        <p>Product not found.</p>
        <RouterLink to="/shop" class="btn btn-primary">← Back to Shop</RouterLink>
      </div>
    </div>

    <!-- Product -->
    <article v-else class="container product-article">
      <div class="product-layout">
        <!-- Images -->
        <div class="product-images">
          <div class="main-image glass">
            <img
              :src="activeImage || product.cover_image"
              :alt="product.name"
              v-if="activeImage || product.cover_image"
              class="main-img"
            />
            <div class="no-image" v-else>🛍️</div>
          </div>

          <!-- Gallery thumbnails -->
          <div class="gallery-thumbs" v-if="allImages.length > 1">
            <button
              v-for="(img, i) in allImages"
              :key="i"
              class="thumb-btn"
              :class="{ active: (activeImage || product.cover_image) === img }"
              @click="activeImage = img"
            >
              <img :src="img" :alt="`${product.name} image ${i+1}`" />
            </button>
          </div>
        </div>

        <!-- Info -->
        <div class="product-info">
          <div class="info-category" v-if="product.category_name">
            <RouterLink :to="`/shop?category=${product.category_slug || ''}`" class="cat-tag">
              {{ product.category_name }}
            </RouterLink>
          </div>

          <h1 class="product-name">{{ product.name }}</h1>
          <p class="product-excerpt" v-if="product.excerpt">{{ product.excerpt }}</p>

          <!-- Price -->
          <div class="price-block" v-if="product.price !== null">
            <span class="price-sale" v-if="product.sale_price">{{ fmt(product.sale_price) }}</span>
            <span :class="product.sale_price ? 'price-orig' : 'price-normal'">{{ fmt(product.price) }}</span>
            <span class="discount-tag" v-if="product.sale_price">
              {{ discountPct }}% off
            </span>
          </div>
          <div class="price-free" v-else>Free</div>

          <!-- SKU -->
          <div class="sku" v-if="product.sku">
            <span class="sku-label">SKU:</span> {{ product.sku }}
          </div>

          <!-- Tags -->
          <div class="tags-row" v-if="product.tags?.length">
            <RouterLink
              v-for="tag in product.tags"
              :key="tag"
              :to="`/shop?tag=${tag}`"
              class="pill"
            >#{{ tag }}</RouterLink>
          </div>

          <!-- Add to Cart -->
          <div class="atc-row" v-if="product.price !== null">
            <div class="qty-selector">
              <button @click="qty = Math.max(1, qty - 1)">−</button>
              <input type="number" v-model.number="qty" min="1" max="99" />
              <button @click="qty = Math.min(99, qty + 1)">+</button>
            </div>
            <button class="btn btn-primary btn-lg atc-btn" @click="addToCart">
              <span v-if="addedFlash">✓ Added!</span>
              <span v-else>🛒 Add to Cart</span>
            </button>
          </div>

          <div class="back-link">
            <RouterLink to="/shop" class="btn btn-outline">← Back to Shop</RouterLink>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div class="glass description-body" v-if="product.description">
        <h2>Product Details</h2>
        <div class="prose" v-html="product.description"></div>
      </div>
    </article>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import api from '../api.js'
import { useSiteStore } from '../stores/site.js'
import { useCartStore } from '../stores/cart.js'

const route   = useRoute()
const site    = useSiteStore()
const cart      = useCartStore()
const product   = ref(null)
const loading   = ref(true)
const isPreview = ref(false)
const activeImage = ref(null)
const qty        = ref(1)
const addedFlash = ref(false)

function addToCart() {
  if (!product.value) return
  cart.addItem(product.value, qty.value)
  cart.open()
  addedFlash.value = true
  setTimeout(() => { addedFlash.value = false }, 2000)
}

const allImages = computed(() => {
  if (!product.value) return []
  const imgs = []
  if (product.value.cover_image) imgs.push(product.value.cover_image)
  ;(product.value.gallery || []).forEach(u => { if (!imgs.includes(u)) imgs.push(u) })
  return imgs
})

const discountPct = computed(() => {
  if (!product.value?.price || !product.value?.sale_price) return 0
  return Math.round((1 - product.value.sale_price / product.value.price) * 100)
})

onMounted(load)
watch(() => route.params.slug, load)

async function load() {
  loading.value = true
  activeImage.value = null
  try {
    const previewToken = route.query.preview_token || ''
    const config = previewToken ? { headers: { Authorization: `Bearer ${previewToken}` } } : {}
    const { data } = await api.get(`/products/${route.params.slug}`, config)
    isPreview.value = !!data._preview
    product.value = data
    // Track page view
    api.post('/analytics/view', {
      entity_type: 'product',
      entity_id: data.id,
      entity_slug: data.slug,
      entity_title: data.name
    }).catch(() => {})
  } catch {
    product.value = null
  } finally {
    loading.value = false
  }
}

useHead(computed(() => {
  if (!product.value) return {}
  const siteName = site.settings.site_name || 'Pygmy'
  return {
    title: `${product.value.meta_title || product.value.name} — ${siteName}`,
    meta: [
      { name: 'description', content: product.value.meta_desc || product.value.excerpt || '' },
      { property: 'og:title', content: product.value.meta_title || product.value.name },
      { property: 'og:description', content: product.value.meta_desc || product.value.excerpt || '' },
      { property: 'og:image', content: product.value.cover_image || '' },
      { property: 'og:type', content: 'product' },
    ]
  }
}))

function fmt(n) {
  if (n === null || n === undefined) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
</script>

<style scoped>
.product-page { padding-bottom: 5rem; }

.skeleton-wrap { padding: 3rem 1.5rem; }
.skeleton-title { height: 2.5rem; background: var(--glass-bg); border-radius: 0.5rem; max-width: 500px; margin-bottom: 1.5rem; animation: pulse 1.5s infinite; }
.skeleton-body  { height: 400px; border-radius: var(--radius); animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

.not-found { display: flex; justify-content: center; padding: 5rem 1.5rem; }
.not-found-card { padding: 3rem; text-align: center; border-radius: var(--radius); }
.not-found-card h1 { font-size: 4rem; font-weight: 800; color: var(--accent); margin-bottom: 0.5rem; }
.not-found-card p  { color: var(--text-muted); margin-bottom: 1.5rem; }

/* Layout */
.product-article { padding: 3rem 1.5rem; }
.product-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  margin-bottom: 2.5rem;
  align-items: start;
}
@media (max-width: 700px) { .product-layout { grid-template-columns: 1fr; } }

/* Images */
.main-image {
  border-radius: var(--radius);
  overflow: hidden;
  aspect-ratio: 1;
}
.main-img { width: 100%; height: 100%; object-fit: cover; }
.no-image {
  width: 100%; aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  font-size: 5rem; background: var(--glass-bg);
  border-radius: var(--radius);
}

.gallery-thumbs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}
.thumb-btn {
  width: 64px; height: 64px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.2s;
  background: none;
}
.thumb-btn img { width: 100%; height: 100%; object-fit: cover; }
.thumb-btn.active { border-color: var(--accent); }
.thumb-btn:hover { border-color: var(--border); }

/* Info */
.product-info { display: flex; flex-direction: column; gap: 1rem; }
.cat-tag {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
}
.cat-tag:hover { text-decoration: underline; }

.product-name { font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 800; line-height: 1.2; margin: 0; }
.product-excerpt { color: var(--text-muted); font-size: 1rem; line-height: 1.6; margin: 0; }

.price-block { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
.price-sale  { font-size: 1.8rem; font-weight: 800; color: var(--accent); }
.price-orig  { font-size: 1.1rem; text-decoration: line-through; color: var(--text-muted); }
.price-normal{ font-size: 1.8rem; font-weight: 800; }
.price-free  { font-size: 1.6rem; font-weight: 800; color: #4caf50; }

.discount-tag {
  font-size: 0.78rem;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  padding: 0.15rem 0.5rem;
  border-radius: 2rem;
  letter-spacing: 0.04em;
}

.sku { font-size: 0.82rem; color: var(--text-muted); }
.sku-label { font-weight: 600; }

.tags-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.pill {
  font-size: 0.8rem;
  padding: 0.2rem 0.65rem;
  border-radius: 2rem;
  background: var(--glass-bg);
  color: var(--text-muted);
  border: 1px solid var(--border);
  text-decoration: none;
  transition: all 0.15s;
}
.pill:hover { color: var(--accent); border-color: var(--accent); }

/* Add to cart */
.atc-row {
  display: flex;
  gap: .75rem;
  align-items: center;
  flex-wrap: wrap;
}
.qty-selector {
  display: flex;
  align-items: center;
  gap: .35rem;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
  border-radius: .5rem;
  padding: .3rem .5rem;
}
.qty-selector button {
  background: none;
  border: none;
  color: var(--text);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 .25rem;
  line-height: 1;
}
.qty-selector input {
  width: 2.5rem;
  text-align: center;
  background: none;
  border: none;
  color: var(--text);
  font-size: .95rem;
  font-family: inherit;
}
.qty-selector input::-webkit-inner-spin-button,
.qty-selector input::-webkit-outer-spin-button { -webkit-appearance: none; }
.atc-btn { min-width: 160px; flex: 1; }

.back-link { margin-top: 0.5rem; }
.btn-outline {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  text-decoration: none;
  transition: all 0.2s;
}
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }

/* Description */
.description-body {
  padding: 2rem;
  border-radius: var(--radius);
  margin-top: 0.5rem;
}
.description-body h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: 1.25rem; }

.prose { line-height: 1.8; color: var(--text-muted); }
.prose :deep(h1), .prose :deep(h2), .prose :deep(h3) { color: var(--text); margin: 1.5rem 0 0.75rem; }
.prose :deep(p) { margin-bottom: 1rem; }
.prose :deep(ul), .prose :deep(ol) { padding-left: 1.5rem; margin-bottom: 1rem; }
.prose :deep(a) { color: var(--accent); }
.prose :deep(img) { max-width: 100%; border-radius: var(--radius-sm); }
.prose :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 1rem;
  color: var(--text-muted);
  font-style: italic;
  margin: 1rem 0;
}
.prose :deep(code) {
  background: var(--glass-bg);
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.88em;
}
.prose :deep(pre) {
  background: var(--glass-bg);
  padding: 1rem;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin-bottom: 1rem;
}
</style>
