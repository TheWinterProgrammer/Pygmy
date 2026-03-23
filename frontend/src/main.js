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
