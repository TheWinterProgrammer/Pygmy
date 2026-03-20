<template>
  <div class="notif-wrap" ref="wrapRef">
    <button class="notif-btn" @click="toggle" :class="{ active: open }">
      <span class="notif-icon">🔔</span>
      <span v-if="count.total > 0" class="notif-badge">{{ count.total > 99 ? '99+' : count.total }}</span>
    </button>

    <Transition name="dropdown">
      <div v-if="open" class="notif-dropdown glass">
        <div class="notif-header">
          <span class="notif-title">Notifications</span>
          <span v-if="count.total > 0" class="notif-subtitle">{{ count.total }} unread</span>
        </div>

        <div v-if="loading" class="notif-empty">Loading…</div>

        <template v-else-if="items.length">
          <RouterLink
            v-for="item in items"
            :key="item.type + item.id"
            :to="linkFor(item)"
            class="notif-item"
            @click="open = false"
          >
            <span class="notif-item-icon">{{ iconFor(item.type) }}</span>
            <div class="notif-item-body">
              <div class="notif-item-title">{{ item.title }}</div>
              <div class="notif-item-sub">{{ excerpt(item.body) }}</div>
              <div class="notif-item-time">{{ timeAgo(item.created_at) }}</div>
            </div>
            <span class="notif-dot" />
          </RouterLink>
        </template>

        <div v-else class="notif-empty">
          <span>🎉</span>
          <span>All caught up!</span>
        </div>

        <div class="notif-footer">
          <RouterLink to="/comments" @click="open = false" v-if="count.comments > 0">
            💬 {{ count.comments }} pending comments
          </RouterLink>
          <RouterLink to="/contact" @click="open = false" v-if="count.contact > 0">
            ✉️ {{ count.contact }} unread messages
          </RouterLink>
          <RouterLink to="/forms" @click="open = false" v-if="count.forms > 0">
            📋 {{ count.forms }} form submissions
          </RouterLink>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const open = ref(false)
const loading = ref(false)
const count = ref({ total: 0, comments: 0, contact: 0, forms: 0 })
const items = ref([])
const wrapRef = ref(null)

let pollTimer = null

async function fetchCount() {
  try {
    const res = await fetch('/api/notifications/count', {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    if (res.ok) count.value = await res.json()
  } catch {}
}

async function fetchItems() {
  loading.value = true
  try {
    const res = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    if (res.ok) items.value = await res.json()
  } catch {}
  loading.value = false
}

function toggle() {
  open.value = !open.value
  if (open.value) fetchItems()
}

function linkFor(item) {
  if (item.type === 'comment') return '/comments'
  if (item.type === 'contact') return '/contact'
  if (item.type === 'form') return `/forms/${item.ref_id}/submissions`
  return '/'
}

function iconFor(type) {
  if (type === 'comment') return '💬'
  if (type === 'contact') return '✉️'
  if (type === 'form') return '📋'
  return '🔔'
}

function excerpt(str) {
  if (!str) return ''
  return str.length > 60 ? str.slice(0, 60) + '…' : str
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function handleOutsideClick(e) {
  if (wrapRef.value && !wrapRef.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => {
  fetchCount()
  pollTimer = setInterval(fetchCount, 60000) // re-poll every 60s
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  clearInterval(pollTimer)
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped>
.notif-wrap { position: relative; }

.notif-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 1.15rem;
  line-height: 1;
  transition: background 0.2s;
}
.notif-btn:hover, .notif-btn.active { background: var(--glass-bg); }

.notif-badge {
  position: absolute;
  top: -2px; right: -4px;
  background: var(--accent);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 999px;
  min-width: 16px;
  text-align: center;
  line-height: 1.4;
}

.notif-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  border-radius: var(--radius);
  overflow: hidden;
  z-index: 1000;
  max-height: 480px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border);
}
.notif-title { font-weight: 700; font-size: 0.9rem; }
.notif-subtitle { font-size: 0.75rem; color: var(--accent); }

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
  color: var(--text);
  text-decoration: none;
}
.notif-item:hover { background: var(--glass-bg); }
.notif-item-icon { font-size: 1rem; flex-shrink: 0; margin-top: 2px; }
.notif-item-body { flex: 1; min-width: 0; }
.notif-item-title { font-size: 0.82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notif-item-sub { font-size: 0.75rem; color: var(--text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notif-item-time { font-size: 0.7rem; color: var(--text-muted); margin-top: 3px; }
.notif-dot { width: 7px; height: 7px; background: var(--accent); border-radius: 50%; flex-shrink: 0; margin-top: 5px; }

.notif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.5rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.notif-footer {
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.notif-footer a {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.2rem 0;
}
.notif-footer a:hover { color: var(--accent); }

/* Transition */
.dropdown-enter-active, .dropdown-leave-active { transition: opacity 0.15s, transform 0.15s; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
