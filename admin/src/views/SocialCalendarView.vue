<template>
  <div class="social-calendar-view">
    <div class="page-header">
      <div>
        <h1>📅 Social Media Calendar</h1>
        <p class="subtitle">Visual calendar of all scheduled social posts</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" @click="prevMonth">← Prev</button>
        <h2 class="month-label">{{ monthLabel }}</h2>
        <button class="btn btn-ghost" @click="nextMonth">Next →</button>
        <RouterLink to="/social-scheduler" class="btn btn-accent">+ Schedule Post</RouterLink>
      </div>
    </div>

    <!-- Legend -->
    <div class="legend glass">
      <span v-for="p in platformColors" :key="p.name" class="legend-item">
        <span class="legend-dot" :style="{ background: p.color }"></span>
        {{ p.label }}
      </span>
    </div>

    <!-- Calendar Grid -->
    <div class="calendar-grid">
      <div class="day-header" v-for="d in dayNames" :key="d">{{ d }}</div>

      <!-- Empty padding cells -->
      <div class="empty-cell" v-for="n in startPadding" :key="`pad-${n}`"></div>

      <!-- Day cells -->
      <div
        v-for="day in daysInMonth"
        :key="day"
        :class="['day-cell glass', { today: isToday(day), 'has-posts': postsForDay(day).length > 0 }]"
      >
        <div class="day-number">{{ day }}</div>
        <div class="day-posts">
          <div
            v-for="post in postsForDay(day)"
            :key="post.id"
            class="post-chip"
            :style="{ background: platformColor(post.platform) + '22', borderColor: platformColor(post.platform) + '55', color: platformColor(post.platform) }"
            :title="`${post.platform}: ${post.content?.substring(0,80)}`"
            @click="previewPost(post)"
          >
            <span class="platform-icon">{{ platformIcon(post.platform) }}</span>
            <span class="post-time">{{ formatTime(post.scheduled_at) }}</span>
            <span class="post-excerpt">{{ post.content?.substring(0, 25) }}…</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip">
      <div class="stat-card glass">
        <div class="stat-val">{{ allPosts.length }}</div>
        <div class="stat-label">This Month</div>
      </div>
      <div class="stat-card glass" v-for="p in platformStats" :key="p.platform">
        <div class="stat-val" :style="{ color: platformColor(p.platform) }">{{ p.count }}</div>
        <div class="stat-label">{{ platformIcon(p.platform) }} {{ p.platform }}</div>
      </div>
    </div>

    <!-- Post Preview Modal -->
    <div v-if="previewModal.show" class="modal-overlay" @click.self="previewModal.show = false">
      <div class="modal-panel glass">
        <div class="modal-header">
          <div class="post-platform-badge" :style="{ background: platformColor(previewModal.post?.platform) + '22', color: platformColor(previewModal.post?.platform) }">
            {{ platformIcon(previewModal.post?.platform) }} {{ previewModal.post?.platform }}
          </div>
          <button class="btn-close" @click="previewModal.show = false">✕</button>
        </div>
        <div class="modal-body" v-if="previewModal.post">
          <div class="preview-time">📅 {{ formatDateTime(previewModal.post.scheduled_at) }}</div>
          <div class="preview-content">{{ previewModal.post.content }}</div>
          <div v-if="previewModal.post.image_url" class="preview-image">
            <img :src="previewModal.post.image_url" alt="Post image" />
          </div>
          <div v-if="previewModal.post.link_url" class="preview-link">
            🔗 <a :href="previewModal.post.link_url" target="_blank">{{ previewModal.post.link_url }}</a>
          </div>
          <div class="preview-status">
            Status: <span :class="`status-${previewModal.post.status}`">{{ previewModal.post.status }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <RouterLink :to="`/social-scheduler`" class="btn btn-ghost btn-sm">✏️ Edit in Scheduler</RouterLink>
          <button class="btn btn-ghost btn-sm" @click="previewModal.show = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())
const allPosts = ref([])

const previewModal = ref({ show: false, post: null })

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const platformColors = [
  { name: 'twitter', label: 'Twitter/X', color: '#1DA1F2' },
  { name: 'x', label: 'X', color: '#1DA1F2' },
  { name: 'instagram', label: 'Instagram', color: '#E1306C' },
  { name: 'facebook', label: 'Facebook', color: '#4267B2' },
  { name: 'linkedin', label: 'LinkedIn', color: '#0077B5' },
  { name: 'pinterest', label: 'Pinterest', color: '#E60023' }
]

function platformColor(platform) {
  const p = platform?.toLowerCase()
  const match = platformColors.find(c => c.name === p)
  return match?.color || '#888'
}

function platformIcon(platform) {
  const icons = { twitter: '🐦', x: '𝕏', instagram: '📷', facebook: '👥', linkedin: '💼', pinterest: '📌' }
  return icons[platform?.toLowerCase()] || '📱'
}

const monthLabel = computed(() => {
  return new Date(viewYear.value, viewMonth.value, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
})

const daysInMonth = computed(() => {
  return new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
})

const startPadding = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1).getDay()
  return firstDay === 0 ? 6 : firstDay - 1 // Monday-first grid
})

const platformStats = computed(() => {
  const counts = {}
  for (const p of allPosts.value) {
    counts[p.platform] = (counts[p.platform] || 0) + 1
  }
  return Object.entries(counts).map(([platform, count]) => ({ platform, count }))
})

function isToday(day) {
  return viewYear.value === today.getFullYear() &&
    viewMonth.value === today.getMonth() &&
    day === today.getDate()
}

function postsForDay(day) {
  return allPosts.value.filter(p => {
    if (!p.scheduled_at) return false
    const d = new Date(p.scheduled_at)
    return d.getFullYear() === viewYear.value &&
      d.getMonth() === viewMonth.value &&
      d.getDate() === day
  })
}

function formatTime(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('default', { dateStyle: 'medium', timeStyle: 'short' })
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
  loadPosts()
}

function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
  loadPosts()
}

function previewPost(post) {
  previewModal.value = { show: true, post }
}

async function loadPosts() {
  try {
    const from = new Date(viewYear.value, viewMonth.value, 1).toISOString().slice(0, 10)
    const to = new Date(viewYear.value, viewMonth.value + 1, 0).toISOString().slice(0, 10)
    const { data } = await api.get(`/social-scheduler?from=${from}&to=${to}&limit=200`)
    // Handle both array and {posts, total} response formats
    allPosts.value = Array.isArray(data) ? data : (data?.posts || data?.items || [])
  } catch {
    allPosts.value = []
  }
}

onMounted(loadPosts)
</script>

<style scoped>
.social-calendar-view { padding: 2rem; max-width: 1400px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; gap: 1rem; flex-wrap: wrap; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }
.subtitle { color: var(--text-muted, #aaa); font-size: .875rem; margin-top: .2rem; }
.header-actions { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
.month-label { font-size: 1.1rem; font-weight: 600; min-width: 160px; text-align: center; }
.glass { background: rgba(255,255,255,.04); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1rem; }

.legend { display: flex; gap: 1.25rem; padding: .75rem 1.25rem; margin-bottom: 1rem; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: .4rem; font-size: .8rem; color: rgba(255,255,255,.7); }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; }

.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 1.25rem; }
.day-header { text-align: center; font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.4); padding: .5rem 0; }
.empty-cell { border-radius: .75rem; min-height: 90px; }
.day-cell { border-radius: .75rem; min-height: 90px; padding: .5rem; transition: border-color .2s; position: relative; }
.day-cell.today { border-color: var(--accent, #e05469); box-shadow: 0 0 0 1px var(--accent, #e05469); }
.day-cell.has-posts { background: rgba(255,255,255,.06); }
.day-number { font-size: .75rem; font-weight: 700; color: rgba(255,255,255,.5); margin-bottom: .35rem; }
.day-cell.today .day-number { color: var(--accent, #e05469); }
.day-posts { display: flex; flex-direction: column; gap: 3px; }
.post-chip { display: flex; align-items: center; gap: 4px; border-radius: .35rem; padding: 2px 5px; font-size: .65rem; cursor: pointer; border: 1px solid; overflow: hidden; white-space: nowrap; transition: opacity .15s; }
.post-chip:hover { opacity: .8; }
.platform-icon { font-size: .7rem; flex-shrink: 0; }
.post-time { font-weight: 700; flex-shrink: 0; }
.post-excerpt { overflow: hidden; text-overflow: ellipsis; }

.stats-strip { display: flex; gap: .75rem; flex-wrap: wrap; }
.stat-card { padding: .75rem 1.25rem; text-align: center; }
.stat-val { font-size: 1.5rem; font-weight: 800; }
.stat-label { font-size: .75rem; color: rgba(255,255,255,.5); margin-top: .1rem; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-panel { width: 480px; max-width: 95vw; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.post-platform-badge { padding: .3rem .75rem; border-radius: 9999px; font-size: .85rem; font-weight: 600; }
.btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: rgba(255,255,255,.5); }
.modal-body { padding: 1.25rem; }
.preview-time { font-size: .85rem; color: rgba(255,255,255,.5); margin-bottom: .75rem; }
.preview-content { font-size: .95rem; line-height: 1.6; white-space: pre-wrap; margin-bottom: .75rem; background: rgba(255,255,255,.04); padding: .75rem; border-radius: .5rem; }
.preview-image img { width: 100%; border-radius: .5rem; margin-bottom: .5rem; max-height: 200px; object-fit: cover; }
.preview-link { font-size: .85rem; color: var(--accent, #e05469); margin-bottom: .5rem; word-break: break-all; }
.preview-link a { color: inherit; }
.preview-status { font-size: .85rem; color: rgba(255,255,255,.5); }
.status-published { color: #2ecc71; }
.status-scheduled { color: #f39c12; }
.status-draft { color: rgba(255,255,255,.4); }
.status-failed { color: var(--accent, #e05469); }
.modal-footer { display: flex; gap: .5rem; padding: 1rem 1.25rem; border-top: 1px solid rgba(255,255,255,.08); }

.btn { padding: .5rem 1rem; border-radius: .5rem; cursor: pointer; font-size: .875rem; border: none; transition: all .2s; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; }
.btn-accent { background: var(--accent, #e05469); color: white; }
.btn-ghost { background: rgba(255,255,255,.06); color: white; border: 1px solid rgba(255,255,255,.12); }
.btn-ghost:hover { background: rgba(255,255,255,.1); }
.btn-sm { padding: .35rem .7rem; font-size: .8rem; }
</style>
