<template>
  <div class="collection-page">
    <div class="container">
      <!-- Loading -->
      <div v-if="loading" class="hero-skeleton glass"></div>

      <!-- Not found -->
      <div v-else-if="!collection" class="empty glass">
        <div class="empty-icon">🗂️</div>
        <h2>Collection not found</h2>
        <RouterLink to="/collections" class="btn btn-ghost" style="margin-top:1rem">← All Collections</RouterLink>
      </div>

      <template v-else>
        <!-- Hero -->
        <div class="col-hero glass" :style="collection.cover_image ? `background-image:url(${collection.cover_image})` : ''">
          <div class="col-hero-overlay">
            <h1>{{ collection.name }}</h1>
            <p v-if="collection.description">{{ collection.description }}</p>
            <div class="col-count">{{ collection.products?.length || 0 }} products</div>
          </div>
        </div>

        <div class="breadcrumb">
          <RouterLink to="/collections">Collections</RouterLink>
          <span>›</span>
          <span>{{ collection.name }}</span>
        </div>

        <!-- Products -->
        <div v-if="!collection.products?.length" class="empty-products glass">
          No products in this collection yet.
        </div>
        <div v-else class="products-grid">
          <RouterLink v-for="p in collection.products" :key="p.id" :to="`/shop/${p.slug}`" class="product-card glass">
            <div class="product-img" :style="p.cover_image ? `background-image:url(${p.cover_image})` : ''">
              <div v-if="!p.cover_image" class="img-placeholder">🛍️</div>
              <div v-if="p.sale_price" class="sale-badge">Sale</div>
            </div>
            <div class="product-body">
              <div class="product-name">{{ p.name }}</div>
              <div class="product-price">
                <span v-if="p.sale_price" class="original">€{{ parseFloat(p.price).toFixed(2) }}</span>
                <span class="price">€{{ parseFloat(p.sale_price || p.price).toFixed(2) }}</span>
              </div>
            </div>
          </RouterLink>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'

const route = useRoute()
const collection = ref(null)
const loading    = ref(true)

onMounted(async () => {
  try {
    const { data } = await api.get(`/collections/${route.params.slug}`)
    collection.value = data
  } catch {
    collection.value = null
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.collection-page { padding: 6rem 0 4rem; min-height: 100vh; }
.col-hero { min-height: 280px; border-radius: 1.5rem; margin-bottom: 1.5rem; background: rgba(255,255,255,.06) center/cover no-repeat; position: relative; overflow: hidden; display: flex; align-items: flex-end; }
.col-hero-overlay { padding: 2.5rem; background: linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 100%); width: 100%; }
.col-hero h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: .35rem; }
.col-hero p { color: rgba(255,255,255,.7); max-width: 480px; }
.col-count { font-size: .88rem; color: var(--accent); font-weight: 600; margin-top: .5rem; }
.breadcrumb { display: flex; gap: .5rem; align-items: center; font-size: .85rem; color: var(--text-muted); margin-bottom: 2rem; }
.breadcrumb a { color: var(--accent); text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
.product-card { border-radius: 1.25rem; overflow: hidden; text-decoration: none; color: inherit; transition: transform .2s; }
.product-card:hover { transform: translateY(-3px); }
.product-img { height: 200px; background: rgba(255,255,255,.06) center/cover no-repeat; display: flex; align-items: center; justify-content: center; position: relative; }
.img-placeholder { font-size: 2.5rem; opacity: .3; }
.sale-badge { position: absolute; top: .75rem; left: .75rem; background: var(--accent); color: #fff; font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.product-body { padding: 1rem; }
.product-name { font-weight: 600; margin-bottom: .35rem; }
.product-price { display: flex; align-items: center; gap: .5rem; }
.original { text-decoration: line-through; color: var(--text-muted); font-size: .88rem; }
.price { font-weight: 700; color: var(--accent); }
.hero-skeleton { height: 280px; border-radius: 1.5rem; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:.6}50%{opacity:.3} }
.empty { padding: 3rem; text-align: center; border-radius: 1.5rem; }
.empty-icon { font-size: 3rem; margin-bottom: .75rem; }
.empty-products { padding: 2rem; text-align: center; border-radius: 1.25rem; color: var(--text-muted); }
</style>
