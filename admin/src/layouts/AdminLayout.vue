<template>
  <div class="admin-layout">
    <!-- Sidebar -->
    <aside class="sidebar glass">
      <div class="sidebar-brand">
        <span class="brand-icon">🪆</span>
        <span class="brand-name">Pygmy</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item">
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span v-if="item.to === '/notifications' && notifCount > 0" class="sidebar-badge">
            {{ notifCount > 99 ? '99+' : notifCount }}
          </span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info" v-if="auth.user">
          <div class="user-avatar">{{ auth.user.name?.[0] ?? 'A' }}</div>
          <div class="user-meta">
            <div class="user-name">{{ auth.user.name }}</div>
            <div class="user-role">{{ auth.user.role }}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">Sign out</button>
      </div>
    </aside>

    <!-- Main content -->
    <div class="admin-content">
      <!-- Top bar -->
      <header class="admin-topbar">
        <div class="topbar-left">
          <span class="topbar-page">{{ currentLabel }}</span>
        </div>
        <div class="topbar-right">
          <NotificationBell />
          <a href="http://localhost:5174" target="_blank" class="topbar-btn" title="View site">🌐</a>
        </div>
      </header>
      <main class="admin-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRouter, useRoute } from 'vue-router'
import NotificationBell from '../components/NotificationBell.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const currentLabel = computed(() => {
  const match = navItems.find(i => route.path.startsWith(i.to) && i.to !== '/')
  return match?.label ?? 'Dashboard'
})

// Sidebar notification badge
const notifCount = ref(0)
let notifTimer = null

async function fetchNotifCount() {
  if (!auth.token) return
  try {
    const res = await fetch('/api/notifications/count', {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    if (res.ok) {
      const d = await res.json()
      notifCount.value = d.total || 0
    }
  } catch {}
}

onMounted(() => {
  fetchNotifCount()
  notifTimer = setInterval(fetchNotifCount, 90000)
})

onUnmounted(() => clearInterval(notifTimer))

const navItems = [
  { to: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { to: '/pages',      icon: '📄', label: 'Pages' },
  { to: '/posts',      icon: '✍️',  label: 'Posts' },
  { to: '/products',   icon: '🛍️',  label: 'Products' },
  { to: '/media',      icon: '🖼️',  label: 'Media' },
  { to: '/navigation', icon: '🧭', label: 'Navigation' },
  { to: '/comments',   icon: '💬', label: 'Comments' },
  { to: '/contact',    icon: '✉️',  label: 'Contact' },
  { to: '/users',      icon: '👥', label: 'Users' },
  { to: '/analytics',  icon: '📈', label: 'Analytics' },
  { to: '/redirects',  icon: '🔀', label: 'Redirects' },
  { to: '/newsletter', icon: '📨', label: 'Newsletter' },
  { to: '/tags',       icon: '🏷️',  label: 'Tags' },
  { to: '/forms',      icon: '📋', label: 'Forms' },
  { to: '/webhooks',      icon: '🔗', label: 'Webhooks' },
  { to: '/notifications', icon: '🔔', label: 'Notifications' },
  { to: '/backup',        icon: '🗄️',  label: 'Backup' },
  { to: '/settings',      icon: '⚙️',  label: 'Settings' },
]

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ─── Sidebar ─────────────────────────────────────────────────────────── */
.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 0;
  border-radius: 0;
  border-top: none;
  border-bottom: none;
  border-left: none;
  overflow-y: auto;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 1.25rem 1.25rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.75rem;
}
.brand-icon { font-size: 1.4rem; }
.brand-name { font-size: 1.1rem; font-weight: 700; color: var(--text); }

.sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; padding: 0 0.75rem; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.88rem;
  transition: all 0.2s;
}
.nav-item:hover { background: var(--glass-bg); color: var(--text); }
.nav-item.router-link-active { background: hsl(355,70%,20%); color: var(--accent); }
.nav-icon { font-size: 1rem; width: 1.2rem; text-align: center; }
.sidebar-badge {
  margin-left: auto;
  background: var(--accent);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 999px;
  min-width: 16px;
  text-align: center;
  line-height: 1.5;
}

.sidebar-footer {
  padding: 1rem 1.25rem 0;
  border-top: 1px solid var(--border);
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.user-info { display: flex; align-items: center; gap: 0.6rem; }
.user-avatar {
  width: 32px; height: 32px;
  background: var(--accent);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.9rem; color: #fff;
  flex-shrink: 0;
}
.user-name { font-size: 0.85rem; font-weight: 600; }
.user-role { font-size: 0.72rem; color: var(--text-muted); text-transform: capitalize; }

/* ─── Main ───────────────────────────────────────────────────────────── */
.admin-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(0,0,0,0.15);
  flex-shrink: 0;
}
.topbar-left { display: flex; align-items: center; gap: 0.75rem; }
.topbar-page { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); }
.topbar-right { display: flex; align-items: center; gap: 0.25rem; }
.topbar-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 1.1rem;
  line-height: 1;
  text-decoration: none;
  transition: background 0.2s;
}
.topbar-btn:hover { background: var(--glass-bg); }

.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}
</style>
