<template>
  <!-- Maintenance mode screen -->
  <div v-if="site.maintenance" class="maintenance-screen">
    <div class="glass maintenance-card">
      <div class="maint-icon">🔧</div>
      <h1>Under Maintenance</h1>
      <p>{{ site.maintenanceMessage }}</p>
    </div>
  </div>

  <!-- Normal site -->
  <div v-else-if="site.loaded">
    <SiteNav />
    <RouterView />
    <SiteFooter />
    <CartDrawer />
  </div>

  <!-- Loading screen -->
  <div v-else class="loading-screen">
    <div class="spinner"></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSiteStore } from './stores/site.js'
import SiteNav from './components/SiteNav.vue'
import SiteFooter from './components/SiteFooter.vue'
import CartDrawer from './components/CartDrawer.vue'

const site = useSiteStore()
onMounted(() => site.load())
</script>

<style>
.loading-screen,
.maintenance-screen {
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

.maintenance-card {
  text-align: center;
  padding: 3rem 4rem;
  border-radius: 1.5rem;
  max-width: 480px;
}
.maint-icon { font-size: 3.5rem; margin-bottom: 1rem; }
.maintenance-card h1 { margin: 0 0 0.75rem; font-size: 1.8rem; }
.maintenance-card p { color: var(--muted); margin: 0; line-height: 1.6; }
</style>
