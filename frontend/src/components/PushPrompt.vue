<template>
  <Transition name="slide-up">
    <div v-if="visible && !dismissed" class="push-prompt-bar">
      <div class="push-prompt-inner">
        <div class="push-prompt-icon">🔔</div>
        <div class="push-prompt-text">
          <strong>Stay in the loop</strong>
          <span>Get notified about new posts, deals, and updates.</span>
        </div>
        <div class="push-prompt-actions">
          <button class="pp-btn pp-allow" @click="subscribe" :disabled="loading">
            {{ loading ? 'Enabling…' : '✓ Allow' }}
          </button>
          <button class="pp-btn pp-dismiss" @click="dismiss">Later</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API = 'http://localhost:3200'
const visible   = ref(false)
const dismissed = ref(false)
const loading   = ref(false)

function urlBase64ToUint8Array (base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  const arr     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i)
  return arr
}

function dismiss () {
  dismissed.value = true
  localStorage.setItem('push_dismissed', Date.now().toString())
}

async function subscribe () {
  loading.value = true
  try {
    // Get VAPID public key
    const keyRes = await fetch(`${API}/api/push/vapid-public`)
    if (!keyRes.ok) { loading.value = false; return }
    const { publicKey } = await keyRes.json()

    // Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Subscribe
    const pushSub = await reg.pushManager.subscribe({
      userVisibleOnly:    true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    })

    // Send to backend
    const sessionId = localStorage.getItem('pygmy_session') || Math.random().toString(36).slice(2)
    localStorage.setItem('pygmy_session', sessionId)

    await fetch(`${API}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: pushSub.toJSON(),
        session_id:   sessionId,
        page_path:    window.location.pathname
      })
    })

    localStorage.setItem('push_subscribed', '1')
    dismissed.value = true
    loading.value = false
  } catch (err) {
    console.warn('Push subscription failed:', err)
    loading.value = false
    dismiss()
  }
}

onMounted(async () => {
  // Check if push is supported
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  // Check if already subscribed or dismissed recently
  if (localStorage.getItem('push_subscribed')) return
  const dismissedAt = localStorage.getItem('push_dismissed')
  if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 3600 * 1000) return
  // Check if VAPID is configured
  try {
    const r = await fetch(`${API}/api/push/vapid-public`)
    if (!r.ok) return
  } catch { return }

  // Show after 5 seconds
  setTimeout(() => { visible.value = true }, 5000)
})
</script>

<style scoped>
.push-prompt-bar {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  width: min(480px, calc(100vw - 2rem));
}
.push-prompt-inner {
  background: rgba(20, 20, 28, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}
.push-prompt-icon { font-size: 1.75rem; flex-shrink: 0; }
.push-prompt-text { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; }
.push-prompt-text strong { font-size: 0.9rem; color: #fff; }
.push-prompt-text span { font-size: 0.8rem; color: rgba(255,255,255,0.55); }
.push-prompt-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.pp-btn {
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: Poppins, sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  transition: opacity 0.2s;
}
.pp-allow {
  background: hsl(355, 70%, 58%);
  color: #fff;
}
.pp-allow:hover { opacity: 0.85; }
.pp-allow:disabled { opacity: 0.5; cursor: not-allowed; }
.pp-dismiss {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
}
.pp-dismiss:hover { background: rgba(255,255,255,0.15); color: #fff; }

/* Transition */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateX(-50%) translateY(1.5rem) scale(0.95); }
</style>
