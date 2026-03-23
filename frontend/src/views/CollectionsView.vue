<template>
  <div class="collections-page">
    <div class="container">
      <h1 class="page-title">Collections</h1>

      <div v-if="loading" class="grid">
        <div v-for="i in 6" :key="i" class="col-card glass skeleton"></div>
      </div>

      <div v-else-if="!collections.length" class="empty glass">
        No collections available yet.
      </div>

      <div v-else class="grid">
        <RouterLink v-for="col in collections" :key="col.id" :to="`/collections/${col.slug}`" class="col-card glass">
          <div class="col-image" :style="col.cover_image ? `background-image:url(${col.cover_image})` : ''">
            <div v-if="!col.cover_image" class="col-placeholder">🗂️</div>
          </div>
          <div class="col-body">
            <h2>{{ col.name }}</h2>
            <p v-if="col.description" class="text-muted">{{ col.description }}</p>
            <div class="col-count">{{ col.product_count }} product{{ col.product_count !== 1 ? 's' : '' }}</div>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const collections = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const { data } = await api.get('/collections')
    collections.value = data
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.collections-page { padding: 6rem 0 4rem; min-height: 100vh; }
.page-title { font-size: 2.5rem; font-weight: 800; margin-bottom: 2rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
.col-card { border-radius: 1.25rem; overflow: hidden; text-decoration: none; color: inherit; transition: transform .2s; display: flex; flex-direction: column; }
.col-card:hover { transform: translateY(-3px); }
.col-image { height: 180px; background: rgba(255,255,255,.06) center/cover no-repeat; display: flex; align-items: center; justify-content: center; }
.col-placeholder { font-size: 3rem; opacity: .3; }
.col-body { padding: 1.25rem; }
.col-body h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: .35rem; }
.col-count { font-size: .82rem; color: var(--accent); font-weight: 600; margin-top: .5rem; }
.skeleton { height: 260px; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:.6}50%{opacity:.3} }
.empty { padding: 3rem; text-align: center; border-radius: 1.25rem; color: var(--text-muted); }
.text-muted { color: var(--text-muted); font-size: .9rem; }
</style>
