<template>
  <section class="recently-viewed" v-if="products.length">
    <div class="container">
      <h2 class="rv-title">Recently Viewed</h2>
      <div class="rv-grid">
        <RouterLink
          v-for="p in products" :key="p.id"
          :to="`/shop/${p.slug}`"
          class="rv-card glass"
        >
          <div class="rv-img">
            <img v-if="p.cover_image" :src="p.cover_image" :alt="p.name" />
            <div v-else class="rv-img-placeholder">🛍️</div>
          </div>
          <div class="rv-info">
            <div class="rv-name">{{ p.name }}</div>
            <div class="rv-price">
              <span v-if="p.sale_price" class="price-sale">{{ fmt(p.sale_price) }}</span>
              <span :class="p.sale_price ? 'price-original' : 'price-main'">{{ fmt(p.price) }}</span>
            </div>
          </div>
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useSiteStore } from '../stores/site.js'

const props = defineProps({
  excludeId: { type: Number, default: null },
})

const site     = useSiteStore()
const products = ref([])

function getSessionId() {
  try {
    let id = localStorage.getItem('pygmy_sid')
    if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('pygmy_sid', id) }
    return id
  } catch { return 'anon' }
}

function fmt(v) {
  const sym      = site.settings?.shop_currency_symbol || '€'
  const currency = site.settings?.shop_currency || 'EUR'
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(v || 0)
  } catch { return `${sym}${Number(v || 0).toFixed(2)}` }
}

onMounted(async () => {
  const sessionId = getSessionId()
  try {
    const params = new URLSearchParams({ session_id: sessionId, limit: 6 })
    if (props.excludeId) params.set('exclude', props.excludeId)
    const { data } = await api.get(`/recently-viewed?${params}`)
    products.value = data || []
  } catch {}
})

// Exposed so ProductView can call this via template ref or import
function trackView(productId) {
  const sessionId = getSessionId()
  api.post('/recently-viewed', { session_id: sessionId, product_id: productId }).catch(() => {})
}

defineExpose({ trackView })
</script>

<style scoped>
.recently-viewed { padding: 3rem 0 2rem; }
.rv-title {
  font-size: 1.25rem; font-weight: 700; margin: 0 0 1.25rem;
  color: var(--text-muted);
}
.rv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}
.rv-card {
  border-radius: 1rem; overflow: hidden; text-decoration: none; color: inherit;
  transition: transform .2s, box-shadow .2s;
}
.rv-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,.3); }
.rv-img { aspect-ratio: 1; overflow: hidden; background: rgba(255,255,255,.05); }
.rv-img img { width: 100%; height: 100%; object-fit: cover; }
.rv-img-placeholder { width: 100%; height: 100%; display:flex;align-items:center;justify-content:center;font-size:2rem; }
.rv-info { padding: .75rem; }
.rv-name { font-size: .85rem; font-weight: 600; margin-bottom: .25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rv-price { font-size: .82rem; }
.price-sale { color: var(--accent); font-weight: 700; margin-right: .35rem; }
.price-original { text-decoration: line-through; color: var(--muted); font-size: .78rem; }
.price-main { font-weight: 700; }
</style>
