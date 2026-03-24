import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@vueuse/head'
import router from './router'
import App from './App.vue'
import './style.css'
import { initWebVitals } from './webVitals.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(createHead())
app.mount('#app')

// Initialize Web Vitals RUM beacon (Phase 36)
initWebVitals()

// Register Service Worker for PWA support (Phase 55)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker registration failed:', err)
    })
  })
}
