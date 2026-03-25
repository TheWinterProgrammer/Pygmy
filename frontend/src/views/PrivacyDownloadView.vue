<template>
  <div class="download-page">
    <SiteNav />
    <div class="download-container">
      <div class="glass download-card">
        <div class="icon">📤</div>
        <h1>Data Export</h1>
        <p v-if="loading">Preparing your download…</p>
        <p v-else-if="error" class="error">{{ error }}</p>
        <div v-else>
          <p>Your personal data export is ready. Click the button below to download it as a JSON file.</p>
          <a :href="downloadUrl" class="btn-download" download>⬇️ Download My Data</a>
          <p class="note">This file contains all personal data we hold about you, including your profile, addresses, orders, reviews, and loyalty transactions.</p>
        </div>
      </div>
    </div>
    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
const route = useRoute()
const loading = ref(true)
const error = ref(null)
const downloadUrl = ref(null)

onMounted(async () => {
  const token = route.params.token
  if (!token) { error.value = 'Invalid link'; loading.value = false; return }

  // Verify the token is valid before showing the download button
  try {
    const r = await fetch(`${API}/api/gdpr/download/${token}`, { method: 'HEAD' })
    if (!r.ok) {
      const data = await fetch(`${API}/api/gdpr/download/${token}`).then(x => x.json()).catch(() => ({}))
      error.value = data.error || 'Export not found or link has expired'
    } else {
      downloadUrl.value = `${API}/api/gdpr/download/${token}`
    }
  } catch (_) {
    error.value = 'Unable to verify download link'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.download-page { min-height: 100vh; background: var(--bg, hsl(228,4%,10%)); color: #fff; display: flex; flex-direction: column; }
.download-container { flex: 1; display: flex; align-items: center; justify-content: center; padding: 4rem 1.5rem; }
.glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(16px); border-radius: 1.5rem; }
.download-card { max-width: 480px; width: 100%; padding: 3rem; text-align: center; }
.icon { font-size: 3rem; margin-bottom: 1rem; }
h1 { font-size: 2rem; margin-bottom: 1rem; }
p { color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 1rem; }
.error { color: #f87171; }
.btn-download { display: inline-block; background: hsl(355,70%,58%); color: #fff; padding: 1rem 2rem; border-radius: 1rem; font-weight: 700; font-size: 1.1rem; text-decoration: none; margin: 1rem 0; }
.note { font-size: 0.85rem; color: rgba(255,255,255,0.4); margin-top: 1rem; }
</style>
