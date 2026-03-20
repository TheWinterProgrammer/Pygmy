<template>
  <div>
    <div class="page-header">
      <h1>🔔 Notifications</h1>
      <span class="header-sub" v-if="totalCount > 0">{{ totalCount }} items need your attention</span>
    </div>

    <div v-if="loading" class="loading-state glass section">Loading…</div>

    <template v-else>
      <!-- Summary cards -->
      <div class="notif-summary">
        <RouterLink to="/comments" class="summary-card glass" :class="{ 'card-alert': counts.comments > 0 }">
          <span class="card-icon">💬</span>
          <div>
            <div class="card-num">{{ counts.comments }}</div>
            <div class="card-label">Pending Comments</div>
          </div>
        </RouterLink>
        <RouterLink to="/contact" class="summary-card glass" :class="{ 'card-alert': counts.contact > 0 }">
          <span class="card-icon">✉️</span>
          <div>
            <div class="card-num">{{ counts.contact }}</div>
            <div class="card-label">Unread Messages</div>
          </div>
        </RouterLink>
        <RouterLink to="/forms" class="summary-card glass" :class="{ 'card-alert': counts.forms > 0 }">
          <span class="card-icon">📋</span>
          <div>
            <div class="card-num">{{ counts.forms }}</div>
            <div class="card-label">Form Submissions</div>
          </div>
        </RouterLink>
      </div>

      <!-- Notification feed -->
      <div class="glass section" v-if="items.length > 0">
        <h2 style="margin-bottom:1rem;">Recent Alerts</h2>
        <div class="notif-feed">
          <RouterLink
            v-for="item in items"
            :key="item.type + item.id"
            :to="linkFor(item)"
            class="notif-row"
          >
            <span class="notif-icon">{{ iconFor(item.type) }}</span>
            <div class="notif-body">
              <div class="notif-title">
                <strong>{{ typeLabel(item.type) }}:</strong>
                {{ item.title }}
              </div>
              <div class="notif-sub" v-if="item.body">{{ excerpt(item.body) }}</div>
              <div class="notif-ref" v-if="item.ref_label && item.type === 'comment'">
                on post: {{ item.ref_label }}
              </div>
            </div>
            <div class="notif-meta">
              <span class="notif-time">{{ timeAgo(item.created_at) }}</span>
              <span class="notif-arrow">→</span>
            </div>
          </RouterLink>
        </div>
      </div>

      <div v-else class="glass section empty-state">
        <div class="empty-icon">🎉</div>
        <div>All caught up! No pending items.</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const loading = ref(true)
const counts = ref({ total: 0, comments: 0, contact: 0, forms: 0 })
const items = ref([])

const totalCount = computed(() => counts.value.total)

async function load() {
  loading.value = true
  try {
    const [countRes, itemsRes] = await Promise.all([
      api.get('/notifications/count'),
      api.get('/notifications')
    ])
    counts.value = countRes.data
    items.value = itemsRes.data
  } finally {
    loading.value = false
  }
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

function typeLabel(type) {
  if (type === 'comment') return 'Pending comment'
  if (type === 'contact') return 'Unread message'
  if (type === 'form') return 'Form submission'
  return 'Notification'
}

function excerpt(str) {
  if (!str) return ''
  return str.length > 120 ? str.slice(0, 120) + '…' : str
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

onMounted(load)
</script>

<style scoped>
.header-sub { font-size: 0.9rem; color: var(--accent); font-weight: 500; }

.notif-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius);
  text-decoration: none;
  color: var(--text);
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid transparent;
}
.summary-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.summary-card.card-alert { border-color: rgba(var(--accent-rgb, 219,68,82), 0.4); }

.card-icon { font-size: 2rem; }
.card-num { font-size: 1.8rem; font-weight: 800; line-height: 1; }
.card-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; }
.card-alert .card-num { color: var(--accent); }

.section { padding: 1.5rem; }

.notif-feed { display: flex; flex-direction: column; gap: 0.25rem; }

.notif-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text);
  border: 1px solid var(--border);
  background: var(--glass-bg);
  transition: background 0.15s, border-color 0.15s;
}
.notif-row:hover { border-color: var(--accent); background: rgba(255,255,255,0.06); }

.notif-icon { font-size: 1.2rem; flex-shrink: 0; }
.notif-body { flex: 1; min-width: 0; }
.notif-title { font-size: 0.88rem; font-weight: 500; }
.notif-sub { font-size: 0.8rem; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notif-ref { font-size: 0.77rem; color: var(--text-muted); margin-top: 2px; font-style: italic; }

.notif-meta { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.notif-time { font-size: 0.78rem; color: var(--text-muted); }
.notif-arrow { color: var(--text-muted); }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-muted);
  text-align: center;
}
.empty-icon { font-size: 2.5rem; }

.loading-state { padding: 2rem; text-align: center; color: var(--text-muted); }

@media (max-width: 600px) {
  .notif-summary { grid-template-columns: 1fr; }
}
</style>
