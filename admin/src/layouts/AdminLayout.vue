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
    <main class="admin-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const navItems = [
  { to: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { to: '/pages',      icon: '📄', label: 'Pages' },
  { to: '/posts',      icon: '✍️',  label: 'Posts' },
  { to: '/media',      icon: '🖼️',  label: 'Media' },
  { to: '/navigation', icon: '🧭', label: 'Navigation' },
  { to: '/comments',   icon: '💬', label: 'Comments' },
  { to: '/settings',   icon: '⚙️',  label: 'Settings' },
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
.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}
</style>
