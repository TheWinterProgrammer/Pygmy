<template>
  <div>
    <div class="page-header">
      <h1>🩺 Site Health</h1>
      <button class="btn btn-primary" :disabled="loading" @click="load">
        {{ loading ? '⏳ Checking…' : '🔄 Re-check' }}
      </button>
    </div>

    <div v-if="loading" class="glass loading-card">
      <div class="loading-bar"></div>
      <p style="color:var(--muted);margin:0.5rem 0 0">Running health checks…</p>
    </div>

    <template v-else-if="report">
      <!-- Overall status banner -->
      <div class="overall-banner glass" :class="report.overall">
        <span class="overall-icon">{{ overallIcon }}</span>
        <div class="overall-body">
          <div class="overall-title">{{ overallTitle }}</div>
          <div class="overall-meta">
            <span class="pill ok">✓ {{ report.summary.passing }} passing</span>
            <span class="pill warn" v-if="report.summary.warnings > 0">⚠ {{ report.summary.warnings }} warning{{ report.summary.warnings > 1 ? 's' : '' }}</span>
            <span class="pill error" v-if="report.summary.errors > 0">✕ {{ report.summary.errors }} error{{ report.summary.errors > 1 ? 's' : '' }}</span>
          </div>
        </div>
        <div class="overall-time">Checked {{ checkedAt }}</div>
      </div>

      <!-- Check list -->
      <div class="checks-grid">
        <div
          v-for="check in report.checks"
          :key="check.id"
          class="check-card glass"
          :class="check.status"
        >
          <div class="check-header">
            <span class="check-icon">{{ check.icon }}</span>
            <span class="check-label">{{ check.label }}</span>
            <span class="check-badge" :class="check.status">
              {{ statusLabel(check.status) }}
            </span>
          </div>
          <p class="check-msg">{{ check.message }}</p>
        </div>
      </div>

      <!-- Content stats -->
      <div class="stats-section glass" v-if="report.stats">
        <h3>📊 Content Overview</h3>
        <div class="stats-grid">
          <div class="scard" v-for="(val, key) in report.stats" :key="key">
            <div class="scard-num">{{ val.toLocaleString() }}</div>
            <div class="scard-label">{{ statLabel(key) }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const loading = ref(false)
const report  = ref(null)

const overallIcon = computed(() => {
  if (!report.value) return '❓'
  return { ok: '✅', warn: '⚠️', error: '🚨' }[report.value.overall] || '❓'
})

const overallTitle = computed(() => {
  if (!report.value) return ''
  return {
    ok:    'All systems operational',
    warn:  'Some issues need attention',
    error: 'Critical issues found',
  }[report.value.overall] || ''
})

const checkedAt = computed(() => {
  if (!report.value?.checked_at) return ''
  return new Date(report.value.checked_at).toLocaleTimeString()
})

function statusLabel(s) {
  return { ok: '✓ OK', warn: '⚠ Warn', error: '✕ Error', info: 'ℹ Info' }[s] || s
}

function statLabel(key) {
  return {
    posts: 'Posts', pages: 'Pages', products: 'Products',
    media: 'Media Files', users: 'Users', orders: 'Orders',
    customers: 'Customers', subscribers: 'Subscribers',
  }[key] || key
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/site-health')
    report.value = data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }

.loading-card { padding: 2rem; border-radius: 1.25rem; text-align: center; }

/* Overall banner */
.overall-banner {
  display: flex; align-items: center; gap: 1rem;
  padding: 1.25rem 1.5rem; border-radius: 1.25rem;
  margin-bottom: 1.5rem; border-left: 4px solid transparent;
}
.overall-banner.ok    { border-left-color: #10b981; }
.overall-banner.warn  { border-left-color: #f59e0b; }
.overall-banner.error { border-left-color: var(--accent); }

.overall-icon  { font-size: 2rem; }
.overall-body  { flex: 1; }
.overall-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.4rem; }
.overall-meta  { display: flex; gap: 0.5rem; }
.overall-time  { font-size: 0.78rem; color: var(--muted); white-space: nowrap; align-self: flex-start; }

.pill {
  padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600;
}
.pill.ok    { background: rgba(16,185,129,0.2); color: #6ee7b7; }
.pill.warn  { background: rgba(245,158,11,0.2); color: #f59e0b; }
.pill.error { background: rgba(var(--accent-rgb, 176,48,58),0.2); color: var(--accent); }

/* Checks grid */
.checks-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem; margin-bottom: 1.5rem;
}
.check-card {
  padding: 1rem 1.25rem; border-radius: 1rem;
  border-left: 3px solid transparent;
}
.check-card.ok    { border-left-color: #10b981; }
.check-card.warn  { border-left-color: #f59e0b; }
.check-card.error { border-left-color: var(--accent); }
.check-card.info  { border-left-color: #4e88e6; }

.check-header {
  display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;
}
.check-icon  { font-size: 1.1rem; }
.check-label { flex: 1; font-weight: 600; font-size: 0.9rem; }
.check-badge {
  padding: 0.15rem 0.45rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700;
  white-space: nowrap;
}
.check-badge.ok    { background: rgba(16,185,129,0.15); color: #6ee7b7; }
.check-badge.warn  { background: rgba(245,158,11,0.15); color: #f59e0b; }
.check-badge.error { background: rgba(var(--accent-rgb, 176,48,58),0.15); color: var(--accent); }
.check-badge.info  { background: rgba(78,136,230,0.15); color: #90bcff; }

.check-msg { font-size: 0.82rem; color: var(--muted); margin: 0; line-height: 1.5; }

/* Stats section */
.stats-section { padding: 1.25rem; border-radius: 1.25rem; }
.stats-section h3 { margin: 0 0 1rem; font-size: 0.95rem; }
.stats-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.75rem;
}
.scard {
  background: rgba(255,255,255,0.04); border-radius: 0.75rem;
  padding: 0.75rem; text-align: center;
}
.scard-num   { font-size: 1.5rem; font-weight: 700; color: var(--text); }
.scard-label { font-size: 0.75rem; color: var(--muted); text-transform: capitalize; margin-top: 0.2rem; }
</style>
