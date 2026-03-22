<template>
  <div class="bundles-page">
    <div class="bundles-hero container">
      <h1>🪄 Bundle Deals</h1>
      <p class="subtitle">Save more when you buy together</p>
    </div>

    <div class="container bundles-body">
      <div v-if="loading" class="bundles-grid">
        <div v-for="i in 4" :key="i" class="bundle-card skel glass"></div>
      </div>

      <div v-else-if="!bundles.length" class="empty-state">
        <div class="glass empty-card">
          <div class="empty-emoji">🪄</div>
          <h2>No bundles yet</h2>
          <p>Check back soon for special bundle deals!</p>
          <RouterLink to="/shop" class="btn btn-primary">Browse Shop →</RouterLink>
        </div>
      </div>

      <div v-else class="bundles-grid">
        <RouterLink
          v-for="b in bundles"
          :key="b.id"
          :to="`/shop/bundles/${b.slug}`"
          class="bundle-card glass"
        >
          <div class="card-img" v-if="b.cover_image">
            <img :src="b.cover_image" :alt="b.name" loading="lazy" />
          </div>
          <div class="card-img card-img-ph" v-else>🪄</div>

          <div class="card-body">
            <div class="card-items-count">{{ b.items?.length ?? 0 }} products included</div>
            <h2 class="card-title">{{ b.name }}</h2>
            <p class="card-desc" v-if="b.description">{{ truncate(b.description) }}</p>

            <div class="price-block">
              <span class="orig-price">{{ fmt(b.original_total) }}</span>
              <span class="bundle-price">{{ fmt(b.bundle_price) }}</span>
              <span class="savings-badge" v-if="savings(b) > 0">Save {{ savings(b) }}%</span>
            </div>

            <div class="card-cta">View Bundle →</div>
          </div>
        </RouterLink>
      </div>

      <div class="back-link-row">
        <RouterLink to="/shop" class="btn btn-ghost">← Back to Shop</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useCurrency } from '../composables/useCurrency.js'

const { fmt, ensureLoaded } = useCurrency()
const bundles = ref([])
const loading = ref(true)

onMounted(async () => {
  await ensureLoaded()
  try {
    const { data } = await api.get('/bundles')
    bundles.value = data
  } finally {
    loading.value = false
  }
})

function truncate(str, n = 120) {
  return str && str.length > n ? str.slice(0, n).trim() + '…' : str
}

function savings(b) {
  if (!b.original_total) return 0
  return Math.round(((b.original_total - b.bundle_price) / b.original_total) * 100)
}
</script>

<style scoped>
.bundles-page { min-height: 80vh; }

.bundles-hero {
  padding: 4rem 1.5rem 2.5rem;
  text-align: center;
}
.bundles-hero h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; margin-bottom: .5rem; }
.subtitle { color: var(--text-muted, #aaa); font-size: 1.05rem; }

.bundles-body { padding: 0 1.5rem 4rem; }

.bundles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.bundle-card {
  border-radius: 1.25rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  transition: transform .2s, box-shadow .2s;
}
.bundle-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,.45); }
.bundle-card.skel {
  height: 300px;
  animation: pulse 1.5s infinite;
}

.card-img { aspect-ratio: 16/9; overflow: hidden; background: rgba(255,255,255,.04); }
.card-img img { width: 100%; height: 100%; object-fit: cover; }
.card-img-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
}

.card-body { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; }
.card-items-count {
  font-size: .72rem;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: .5rem;
}
.card-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 .5rem; }
.card-desc { font-size: .82rem; color: var(--text-muted, #aaa); flex: 1; margin-bottom: 1rem; }

.price-block {
  display: flex;
  align-items: center;
  gap: .75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.orig-price {
  font-size: .85rem;
  color: var(--text-muted, #aaa);
  text-decoration: line-through;
}
.bundle-price {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent);
}
.savings-badge {
  font-size: .72rem;
  background: rgba(60,200,80,.12);
  color: hsl(140,60%,60%);
  border: 1px solid rgba(60,200,80,.25);
  padding: .2rem .6rem;
  border-radius: 2rem;
  font-weight: 600;
}

.card-cta {
  font-size: .82rem;
  color: var(--accent);
  font-weight: 600;
}

.empty-state { padding: 3rem 0; }
.empty-card {
  max-width: 380px;
  margin: 0 auto;
  text-align: center;
  padding: 3rem;
  border-radius: 1.5rem;
}
.empty-emoji { font-size: 3rem; margin-bottom: 1rem; }

.back-link-row { display: flex; }

.container { max-width: 1100px; margin: 0 auto; }

@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
</style>
