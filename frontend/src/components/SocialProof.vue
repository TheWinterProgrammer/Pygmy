<template>
  <!-- Live viewers count -->
  <div class="social-proof" v-if="enabled">
    <Transition name="fade">
      <div v-if="viewers > 0" class="viewers-badge">
        <span class="live-dot"></span>
        {{ viewers }} {{ viewers === 1 ? 'person' : 'people' }} viewing this
      </div>
    </Transition>

    <!-- Recent purchase ticker -->
    <Transition name="slide-up">
      <div v-if="latestActivity" class="activity-toast">
        <div class="toast-icon">🛍️</div>
        <div class="toast-body">
          <strong>{{ latestActivity.customer_display }}</strong>
          <span v-if="latestActivity.city"> from {{ latestActivity.city }}</span>
          just purchased <strong>{{ latestActivity.product_name }}</strong>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  enabled: { type: Boolean, default: true },
})

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
const route = useRoute()

const viewers = ref(0)
const recentActivity = ref([])
const latestActivity = ref(null)
let pingInterval = null
let viewersInterval = null
let toastTimeout = null
let activityIdx = 0

function getSessionId() {
  let sid = localStorage.getItem('pygmy_sid')
  if (!sid) { sid = Math.random().toString(36).slice(2); localStorage.setItem('pygmy_sid', sid) }
  return sid
}

async function ping() {
  try {
    const res = await fetch(`${API}/api/social-proof/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: route.path, session_id: getSessionId() }),
    })
    if (res.ok) {
      // Refresh viewers count after ping
      const vRes = await fetch(`${API}/api/social-proof/viewers?path=${encodeURIComponent(route.path)}`)
      if (vRes.ok) {
        const data = await vRes.json()
        viewers.value = data.viewers || 0
      }
    }
  } catch {}
}

async function fetchActivity() {
  try {
    const res = await fetch(`${API}/api/social-proof/recent?limit=8`)
    if (res.ok) {
      recentActivity.value = await res.json()
      showNextToast()
    }
  } catch {}
}

function showNextToast() {
  if (!recentActivity.value.length) return
  if (toastTimeout) clearTimeout(toastTimeout)
  latestActivity.value = recentActivity.value[activityIdx % recentActivity.value.length]
  activityIdx++

  toastTimeout = setTimeout(() => {
    latestActivity.value = null
    // Show next one after a delay
    toastTimeout = setTimeout(showNextToast, 8000 + Math.random() * 8000)
  }, 4500)
}

onMounted(() => {
  if (!props.enabled) return

  // Ping immediately + every 30s
  ping()
  pingInterval = setInterval(ping, 30000)

  // Fetch + show activity after 5s delay
  setTimeout(() => {
    fetchActivity()
    // Refresh activity every 2 minutes
    setInterval(fetchActivity, 120000)
  }, 5000 + Math.random() * 5000)
})

onUnmounted(() => {
  if (pingInterval) clearInterval(pingInterval)
  if (viewersInterval) clearInterval(viewersInterval)
  if (toastTimeout) clearTimeout(toastTimeout)
})
</script>

<style scoped>
.social-proof {
  position: relative;
  z-index: 10;
}

/* Viewers badge */
.viewers-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 99px;
  padding: 5px 12px;
  font-size: .8rem;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.live-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #4ce88a;
  box-shadow: 0 0 6px #4ce88a;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .6; transform: scale(.85); }
}

/* Activity toast — fixed bottom-left */
.activity-toast {
  position: fixed;
  bottom: 24px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(20, 20, 28, .92);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 1rem;
  padding: 12px 16px;
  max-width: 320px;
  font-size: .82rem;
  z-index: 999;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
}

.toast-icon { font-size: 1.25rem; flex-shrink: 0; }
.toast-body { line-height: 1.4; }
.toast-body strong { color: #fff; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity .4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active { transition: all .4s cubic-bezier(.16,1,.3,1); }
.slide-up-leave-active { transition: all .3s ease; }
.slide-up-enter-from  { opacity: 0; transform: translateY(16px); }
.slide-up-leave-to    { opacity: 0; transform: translateX(-16px); }
</style>
