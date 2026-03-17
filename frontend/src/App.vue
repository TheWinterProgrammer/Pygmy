<template>
  <div v-if="site.loaded">
    <SiteNav />
    <RouterView />
    <SiteFooter />
  </div>
  <div v-else class="loading-screen">
    <div class="spinner"></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSiteStore } from './stores/site.js'
import SiteNav from './components/SiteNav.vue'
import SiteFooter from './components/SiteFooter.vue'

const site = useSiteStore()
onMounted(() => site.load())
</script>

<style>
.loading-screen {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
