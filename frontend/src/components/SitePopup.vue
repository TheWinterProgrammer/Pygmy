<template>
  <Transition name="popup-fade">
    <div v-if="visible && popup" class="popup-overlay" @click.self="close">
      <div class="popup-card" :style="{ background: popup.bg_color }">
        <button class="popup-close" @click="close" aria-label="Close">✕</button>

        <img v-if="popup.image_url" :src="popup.image_url" class="popup-image" alt="" />

        <div class="popup-body">
          <h2 v-if="popup.title" class="popup-title">{{ popup.title }}</h2>
          <p v-if="popup.body" class="popup-text">{{ popup.body }}</p>

          <!-- Newsletter form -->
          <form v-if="popup.type === 'newsletter'" class="popup-form" @submit.prevent="submitNewsletter">
            <input
              v-model="email"
              type="email"
              required
              placeholder="your@email.com"
              class="popup-input"
            />
            <button type="submit" class="popup-cta" :disabled="subLoading">
              {{ subLoading ? 'Subscribing…' : (popup.cta_label || 'Subscribe') }}
            </button>
            <p v-if="subSuccess" class="popup-success">✓ You're in! Check your inbox.</p>
            <p v-if="subError" class="popup-error">{{ subError }}</p>
          </form>

          <!-- Promo / Announcement / Custom CTA -->
          <a v-else-if="popup.cta_url" :href="popup.cta_url" class="popup-cta-btn" @click="trackConversion">
            {{ popup.cta_label || 'Learn more →' }}
          </a>
          <div v-else-if="popup.type === 'custom'" class="popup-custom" v-html="popup.body"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '../api.js'
import { useRoute } from 'vue-router'

const route = useRoute()
const popup = ref(null)
const visible = ref(false)
const email = ref('')
const subLoading = ref(false)
const subSuccess = ref(false)
const subError = ref('')
let exitBound = false
let triggered = false

onMounted(async () => {
  try {
    const r = await api.get('/popups')
    const allPopups = r.data
    if (!allPopups.length) return

    // Find a matching popup for the current route
    const currentPath = route.path
    const match = allPopups.find(p => {
      if (!p.active) return false
      if (p.show_on === 'all') return true
      if (p.show_on === 'home' && currentPath === '/') return true
      if (p.show_on === 'blog' && currentPath.startsWith('/blog')) return true
      if (p.show_on === 'shop' && currentPath.startsWith('/shop')) return true
      if (p.show_on === 'product' && currentPath.match(/^\/shop\/[^/]+$/)) return true
      if (p.show_on === 'custom') {
        return (p.show_on_paths || []).some(pat => currentPath.startsWith(pat))
      }
      return false
    })

    if (!match) return

    // Check cookie
    const cookieKey = `pygmy_popup_${match.id}`
    if (match.show_once && document.cookie.includes(cookieKey)) return

    popup.value = match
    setupTrigger(match)
  } catch {}
})

onUnmounted(cleanup)

function setupTrigger(p) {
  if (p.trigger === 'timed') {
    setTimeout(show, (p.trigger_delay || 5) * 1000)
  } else if (p.trigger === 'exit_intent') {
    document.addEventListener('mouseleave', onExitIntent)
    exitBound = true
  } else if (p.trigger === 'scroll') {
    window.addEventListener('scroll', onScroll)
  }
}

function onExitIntent(e) {
  if (e.clientY <= 0) show()
}

function onScroll() {
  if (!popup.value) return
  const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
  if (pct >= (popup.value.trigger_delay || 50)) show()
}

function cleanup() {
  if (exitBound) document.removeEventListener('mouseleave', onExitIntent)
  window.removeEventListener('scroll', onScroll)
}

function show() {
  if (triggered) return
  triggered = true
  visible.value = true
  if (popup.value?.id) {
    api.post(`/popups/${popup.value.id}/track`, { event: 'display' }).catch(() => {})
  }
  cleanup()
}

function close() {
  visible.value = false
  if (popup.value?.show_once && popup.value.cookie_days > 0) {
    const expires = new Date()
    expires.setDate(expires.getDate() + popup.value.cookie_days)
    document.cookie = `pygmy_popup_${popup.value.id}=1; expires=${expires.toUTCString()}; path=/`
  }
}

function trackConversion() {
  if (popup.value?.id) {
    api.post(`/popups/${popup.value.id}/track`, { event: 'conversion' }).catch(() => {})
  }
}

async function submitNewsletter() {
  subLoading.value = true
  subError.value = ''
  try {
    await api.post('/newsletter/subscribe', { email: email.value })
    subSuccess.value = true
    trackConversion()
    setTimeout(close, 2500)
  } catch (err) {
    subError.value = err.response?.data?.error || 'Subscription failed. Try again.'
  } finally {
    subLoading.value = false
  }
}
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
  padding: 1rem;
}
.popup-card {
  position: relative;
  border-radius: 1.5rem;
  border: 1px solid rgba(255,255,255,.12);
  backdrop-filter: blur(20px);
  max-width: 480px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,.5);
}
.popup-close {
  position: absolute;
  top: .75rem;
  right: .75rem;
  background: rgba(255,255,255,.1);
  border: none;
  color: rgba(255,255,255,.7);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .85rem;
  cursor: pointer;
  z-index: 10;
}
.popup-close:hover { background: rgba(255,255,255,.2); color: #fff; }
.popup-image {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  display: block;
}
.popup-body {
  padding: 2rem;
  text-align: center;
}
.popup-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 .75rem;
  line-height: 1.25;
}
.popup-text {
  color: rgba(255,255,255,.75);
  font-size: .95rem;
  line-height: 1.6;
  margin: 0 0 1.5rem;
}
.popup-form {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}
.popup-input {
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.2);
  border-radius: .75rem;
  padding: .7rem 1rem;
  color: #fff;
  font-size: .95rem;
  text-align: center;
  width: 100%;
}
.popup-input::placeholder { color: rgba(255,255,255,.4); }
.popup-input:focus { outline: none; border-color: var(--accent,#e05260); }
.popup-cta, .popup-cta-btn {
  display: block;
  background: var(--accent,#e05260);
  color: #fff;
  border: none;
  border-radius: .75rem;
  padding: .75rem 1.5rem;
  font-size: .95rem;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
  width: 100%;
}
.popup-cta:disabled { opacity: .65; }
.popup-cta-btn { margin-top: 1rem; }
.popup-success { color: hsl(140,60%,65%); font-size: .85rem; margin: .5rem 0 0; }
.popup-error { color: hsl(355,70%,65%); font-size: .85rem; margin: .5rem 0 0; }
.popup-custom { color: rgba(255,255,255,.8); font-size: .9rem; text-align: left; }

.popup-fade-enter-active, .popup-fade-leave-active { transition: opacity .3s ease; }
.popup-fade-enter-from, .popup-fade-leave-to { opacity: 0; }
.popup-fade-enter-active .popup-card, .popup-fade-leave-active .popup-card { transition: transform .3s ease; }
.popup-fade-enter-from .popup-card { transform: scale(.9); }
.popup-fade-leave-to .popup-card { transform: scale(.9); }
</style>
