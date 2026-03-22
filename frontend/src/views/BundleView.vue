<template>
  <div class="bundle-page">
    <div v-if="loading" class="container">
      <div class="loading-skeleton">
        <div class="skel-hero"></div>
        <div class="skel-row"><div class="skel-block"></div><div class="skel-block"></div></div>
      </div>
    </div>

    <div v-else-if="!bundle" class="not-found container">
      <div class="glass card-404">
        <div class="emoji-404">📦</div>
        <h1>Bundle not found</h1>
        <p>This bundle doesn't exist or is no longer available.</p>
        <RouterLink to="/shop" class="btn btn-primary">← Back to Shop</RouterLink>
      </div>
    </div>

    <template v-else>
      <!-- Hero -->
      <div class="bundle-hero" :style="bundle.cover_image ? `background-image:url('${bundle.cover_image}')` : ''">
        <div class="bundle-hero-overlay">
          <div class="container">
            <div class="bundle-badge">Bundle Deal</div>
            <h1 class="bundle-title">{{ bundle.name }}</h1>
            <p class="bundle-desc" v-if="bundle.description">{{ bundle.description }}</p>
            <div class="bundle-price-summary">
              <span class="orig-total">Was {{ fmt(bundle.original_total) }}</span>
              <span class="arrow">→</span>
              <span class="bundle-price">{{ fmt(bundle.bundle_price) }}</span>
              <span class="savings-badge" v-if="savingsPercent > 0">Save {{ savingsPercent }}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="container bundle-body">
        <!-- Products in bundle -->
        <div class="bundle-items-section">
          <h2>What's included</h2>
          <div class="bundle-items-grid">
            <div
              v-for="item in bundle.items"
              :key="item.product_id"
              class="bundle-item-card glass"
            >
              <div class="item-img" v-if="item.cover_image">
                <img :src="item.cover_image" :alt="item.name" loading="lazy" />
              </div>
              <div class="item-img item-img-ph" v-else>🛍️</div>
              <div class="item-body">
                <div class="item-qty-badge" v-if="item.quantity > 1">× {{ item.quantity }}</div>
                <h3 class="item-name">{{ item.name }}</h3>
                <div class="item-price">{{ fmt(item.price) }} each</div>
              </div>
              <RouterLink :to="`/shop/${item.slug}`" class="item-link">View →</RouterLink>
            </div>
          </div>
        </div>

        <!-- Add bundle to cart (as individual items) -->
        <div class="bundle-cta-section glass">
          <div class="cta-left">
            <div class="cta-breakdown">
              <div class="cta-line">
                <span>Original total</span>
                <span class="muted strikethrough">{{ fmt(bundle.original_total) }}</span>
              </div>
              <div class="cta-line accent">
                <span>Bundle price</span>
                <span class="bold">{{ fmt(bundle.bundle_price) }}</span>
              </div>
              <div class="cta-line green" v-if="savingsAbs > 0">
                <span>You save</span>
                <span>{{ fmt(savingsAbs) }} ({{ savingsPercent }}%)</span>
              </div>
            </div>
          </div>
          <div class="cta-right">
            <button
              class="btn btn-primary btn-lg"
              :class="{ added: justAdded }"
              @click="addAllToCart"
            >
              <span v-if="!justAdded">🛍️ Add Bundle to Cart</span>
              <span v-else>✓ Added!</span>
            </button>
            <p class="cta-note">Adds {{ bundle.items?.length }} product(s) to your cart</p>
          </div>
        </div>

        <!-- All bundles link -->
        <div class="more-bundles">
          <RouterLink to="/shop/bundles" class="btn btn-ghost">← All Bundles</RouterLink>
          <RouterLink to="/shop" class="btn btn-ghost">Browse Shop →</RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import { useCartStore } from '../stores/cart.js'
import { useCurrency } from '../composables/useCurrency.js'

const route = useRoute()
const cart = useCartStore()
const { fmt, ensureLoaded } = useCurrency()

const bundle = ref(null)
const loading = ref(true)
const justAdded = ref(false)

const savingsAbs = computed(() => {
  if (!bundle.value) return 0
  return (bundle.value.original_total || 0) - (bundle.value.bundle_price || 0)
})

const savingsPercent = computed(() => {
  if (!bundle.value?.original_total) return 0
  return Math.round((savingsAbs.value / bundle.value.original_total) * 100)
})

onMounted(async () => {
  await ensureLoaded()
  try {
    const { data } = await api.get(`/bundles/${route.params.slug}`)
    bundle.value = data
  } catch {
    bundle.value = null
  } finally {
    loading.value = false
  }
})

async function addAllToCart() {
  if (!bundle.value?.items?.length) return
  for (const item of bundle.value.items) {
    // Add each item (quantity from bundle)
    const product = {
      id: item.product_id,
      name: item.name,
      price: item.price,
      sale_price: item.sale_price,
      cover_image: item.cover_image,
      slug: item.slug,
      track_stock: 0,
      in_stock: true,
    }
    for (let q = 0; q < (item.quantity || 1); q++) {
      cart.addItem(product)
    }
  }
  justAdded.value = true
  cart.isOpen = true
  setTimeout(() => { justAdded.value = false }, 2500)
}
</script>

<style scoped>
.bundle-page { min-height: 80vh; }

/* Hero */
.bundle-hero {
  min-height: 340px;
  background: var(--bg) center/cover no-repeat;
  position: relative;
}
.bundle-hero-overlay {
  min-height: 340px;
  background: linear-gradient(135deg, rgba(10,10,18,.88) 0%, rgba(10,10,18,.5) 100%);
  display: flex;
  align-items: center;
  padding: 4rem 0 3rem;
}
.bundle-badge {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  padding: .3rem .8rem;
  border-radius: 2rem;
  margin-bottom: 1rem;
}
.bundle-title {
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 700;
  margin: 0 0 0.75rem;
  color: #fff;
}
.bundle-desc {
  font-size: 1.05rem;
  color: rgba(255,255,255,.7);
  max-width: 580px;
  margin-bottom: 1.5rem;
}
.bundle-price-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.orig-total {
  color: rgba(255,255,255,.5);
  text-decoration: line-through;
  font-size: 1rem;
}
.arrow { color: rgba(255,255,255,.4); }
.bundle-price {
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--accent);
}
.savings-badge {
  background: rgba(60,200,80,.15);
  color: hsl(140,60%,60%);
  border: 1px solid rgba(60,200,80,.3);
  padding: .3rem .75rem;
  border-radius: 2rem;
  font-size: .8rem;
  font-weight: 600;
}

/* Body */
.bundle-body { padding: 3rem 1.5rem; }

.bundle-items-section h2 {
  font-size: 1.25rem;
  margin-bottom: 1.25rem;
}
.bundle-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}
.bundle-item-card {
  border-radius: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform .2s, box-shadow .2s;
}
.bundle-item-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,.4); }
.item-img { aspect-ratio: 1/1; overflow: hidden; }
.item-img img { width: 100%; height: 100%; object-fit: cover; }
.item-img-ph {
  background: rgba(255,255,255,.04);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
}
.item-body { padding: .9rem 1rem .5rem; flex: 1; }
.item-qty-badge {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  font-size: .65rem;
  font-weight: 700;
  padding: .1rem .45rem;
  border-radius: 4px;
  margin-bottom: .4rem;
}
.item-name { font-size: .9rem; font-weight: 600; margin: 0 0 .25rem; }
.item-price { font-size: .78rem; color: var(--text-muted, #aaa); }
.item-link {
  display: block;
  padding: .6rem 1rem;
  font-size: .78rem;
  color: var(--accent);
  text-decoration: none;
  border-top: 1px solid rgba(255,255,255,.06);
  transition: background .15s;
}
.item-link:hover { background: rgba(255,255,255,.04); }

/* CTA section */
.bundle-cta-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.75rem 2rem;
  border-radius: 1.25rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}
.cta-breakdown { display: flex; flex-direction: column; gap: .5rem; }
.cta-line {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  font-size: .9rem;
}
.cta-line.accent .bold { color: var(--accent); font-size: 1.15rem; }
.cta-line.green { color: hsl(140,60%,60%); }
.muted { color: var(--text-muted, #aaa); }
.strikethrough { text-decoration: line-through; }
.bold { font-weight: 700; }

.cta-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .5rem;
}
.btn-lg {
  padding: .85rem 2rem;
  font-size: 1rem;
  border-radius: 0.75rem;
  transition: background .2s, transform .1s;
}
.btn-lg.added { background: hsl(140,50%,40%); }
.cta-note { font-size: .75rem; color: var(--text-muted, #aaa); margin: 0; }

.more-bundles {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Loading skeletons */
.loading-skeleton { padding: 2rem 1.5rem; }
.skel-hero {
  height: 280px;
  background: rgba(255,255,255,.06);
  border-radius: 1rem;
  margin-bottom: 2rem;
  animation: pulse 1.5s infinite;
}
.skel-row { display: flex; gap: 1rem; }
.skel-block {
  flex: 1;
  height: 180px;
  background: rgba(255,255,255,.04);
  border-radius: 1rem;
  animation: pulse 1.5s infinite;
}
@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }

/* 404 */
.not-found { padding: 4rem 1.5rem; }
.card-404 {
  text-align: center;
  padding: 3rem;
  border-radius: 1.5rem;
  max-width: 400px;
  margin: 0 auto;
}
.emoji-404 { font-size: 3rem; margin-bottom: 1rem; }

.container { max-width: 1100px; margin: 0 auto; }

@media (max-width: 640px) {
  .bundle-cta-section { flex-direction: column; align-items: stretch; }
  .cta-right { align-items: stretch; }
  .btn-lg { text-align: center; }
}
</style>
