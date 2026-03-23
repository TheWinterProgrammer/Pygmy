<template>
  <div>
    <div class="page-header">
      <h1>📅 Content Calendar</h1>
      <div class="header-actions">
        <button class="btn btn-ghost" :class="{ active: view === 'month' }" @click="view = 'month'">Month</button>
        <button class="btn btn-ghost" :class="{ active: view === 'list' }" @click="view = 'list'">List</button>
      </div>
    </div>

    <!-- Month navigator -->
    <div class="cal-nav glass">
      <button class="btn btn-ghost" @click="prevMonth">← Prev</button>
      <h2 class="cal-title">{{ monthLabel }}</h2>
      <button class="btn btn-ghost" @click="nextMonth">Next →</button>
    </div>

    <!-- Legend -->
    <div class="legend">
      <span class="legend-item" v-for="t in types" :key="t.key">
        <span class="dot" :class="t.key"></span>{{ t.label }}
      </span>
      <span class="legend-item">
        <span class="dot draft"></span>Draft
      </span>
      <span class="legend-item">
        <span class="dot scheduled"></span>Scheduled
      </span>
      <span class="legend-item">
        <span class="dot published"></span>Published
      </span>
    </div>

    <!-- Month view -->
    <div v-if="view === 'month'" class="cal-wrap glass">
      <div class="cal-grid">
        <!-- Weekday headers -->
        <div class="cal-day-header" v-for="d in weekdays" :key="d">{{ d }}</div>
        <!-- Blank leading cells -->
        <div class="cal-cell blank" v-for="n in leadingBlanks" :key="'b' + n"></div>
        <!-- Day cells -->
        <div
          v-for="day in daysInMonth"
          :key="day"
          class="cal-cell"
          :class="{ today: isToday(day) }"
        >
          <span class="day-num">{{ day }}</span>
          <div class="day-events">
            <div
              v-for="item in getItems(day)"
              :key="item.content_type + item.id"
              class="cal-event"
              :class="[item.content_type, item.status]"
              :title="`${item.title} (${item.content_type})`"
              @click="openItem(item)"
            >
              <span class="event-icon">{{ typeIcon(item.content_type) }}</span>
              <span class="event-title">{{ item.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List view -->
    <div v-else class="list-wrap">
      <div v-if="list.length === 0" class="glass empty-state">
        <p>No content items found for {{ monthLabel }}.</p>
      </div>
      <div v-else class="list-table glass">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Title</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.content_type + item.id">
              <td class="date-col">{{ formatDate(item.date) }}</td>
              <td><span class="type-badge" :class="item.content_type">{{ typeIcon(item.content_type) }} {{ item.content_type }}</span></td>
              <td class="title-col">{{ item.title }}</td>
              <td><span class="status-pill" :class="item.status">{{ item.status }}</span></td>
              <td>
                <button class="btn btn-ghost btn-sm" @click="openItem(item)">Edit →</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Upcoming scheduled sidebar -->
    <div class="upcoming-strip glass" v-if="upcoming.length > 0">
      <h3>⏰ Upcoming Scheduled</h3>
      <div class="upcoming-list">
        <div v-for="item in upcoming" :key="item.content_type + item.id" class="upcoming-item" @click="openItem(item)">
          <span class="up-icon">{{ typeIcon(item.content_type) }}</span>
          <div class="up-body">
            <div class="up-title">{{ item.title }}</div>
            <div class="up-date">{{ formatDate(item.date) }}</div>
          </div>
          <span class="status-pill scheduled">scheduled</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'

const router = useRouter()

const now       = new Date()
const year      = ref(now.getFullYear())
const month     = ref(now.getMonth() + 1)
const view      = ref('month')
const calendar  = ref({})
const list      = ref([])
const upcoming  = ref([])

const weekdays  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const types     = [
  { key: 'post',    label: 'Post' },
  { key: 'page',    label: 'Page' },
  { key: 'event',   label: 'Event' },
  { key: 'product', label: 'Product' },
]

const monthLabel = computed(() => {
  return new Date(year.value, month.value - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const daysInMonth = computed(() => {
  return new Date(year.value, month.value, 0).getDate()
})

const leadingBlanks = computed(() => {
  return new Date(year.value, month.value - 1, 1).getDay()
})

function isToday(day) {
  const t = new Date()
  return t.getFullYear() === year.value && (t.getMonth() + 1) === month.value && t.getDate() === day
}

function pad(n) { return String(n).padStart(2, '0') }

function getItems(day) {
  const key = `${year.value}-${pad(month.value)}-${pad(day)}`
  return calendar.value[key] || []
}

function typeIcon(type) {
  return { post: '✍️', page: '📄', event: '📆', product: '🛍️' }[type] || '📌'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

async function load() {
  try {
    const { data } = await api.get('/content-calendar', { params: { year: year.value, month: month.value } })
    calendar.value = data.calendar || {}
    list.value     = data.list || []
  } catch (e) {
    console.error(e)
  }
}

async function loadUpcoming() {
  try {
    const { data } = await api.get('/content-calendar/upcoming', { params: { limit: 8 } })
    upcoming.value = data.items || []
  } catch {}
}

function prevMonth() {
  if (month.value === 1) { month.value = 12; year.value-- }
  else month.value--
}

function nextMonth() {
  if (month.value === 12) { month.value = 1; year.value++ }
  else month.value++
}

function openItem(item) {
  const routes = { post: '/posts/', page: '/pages/', event: '/events/', product: '/products/' }
  const base = routes[item.content_type]
  if (base) router.push(base + item.id)
}

watch([year, month], load)
onMounted(() => { load(); loadUpcoming() })
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.header-actions { display: flex; gap: 0.5rem; }
.btn.active { background: var(--accent); color: #fff; }

.cal-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1.25rem; border-radius: 1rem; margin-bottom: 1rem;
}
.cal-title { font-size: 1.1rem; font-weight: 600; color: var(--text); }

.legend {
  display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem;
  margin-bottom: 1rem; font-size: 0.8rem; color: var(--muted);
}
.legend-item { display: flex; align-items: center; gap: 0.35rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.dot.post      { background: #4e88e6; }
.dot.page      { background: #8b5cf6; }
.dot.event     { background: #f59e0b; }
.dot.product   { background: #10b981; }
.dot.draft     { background: var(--muted); }
.dot.scheduled { background: #f59e0b; }
.dot.published { background: #10b981; }

.cal-wrap { padding: 1rem; border-radius: 1.25rem; }

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.cal-day-header {
  text-align: center; font-size: 0.72rem; font-weight: 600;
  color: var(--muted); text-transform: uppercase;
  padding: 0.5rem 0;
}
.cal-cell {
  background: rgba(255,255,255,0.03);
  border-radius: 0.5rem;
  min-height: 90px;
  padding: 0.4rem;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}
.cal-cell:hover { border-color: var(--border); }
.cal-cell.today { border-color: var(--accent) !important; }
.cal-cell.blank { background: transparent; border: none; }

.day-num {
  display: block; font-size: 0.8rem; font-weight: 600;
  color: var(--muted); margin-bottom: 0.25rem;
}
.cal-cell.today .day-num { color: var(--accent); }

.day-events { display: flex; flex-direction: column; gap: 2px; }

.cal-event {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 5px; border-radius: 4px;
  font-size: 0.7rem; cursor: pointer;
  white-space: nowrap; overflow: hidden;
  transition: opacity 0.15s;
}
.cal-event:hover { opacity: 0.8; }

.cal-event.post.published      { background: rgba(78,136,230,0.25); color: #90bcff; }
.cal-event.post.draft          { background: rgba(78,136,230,0.1);  color: #6a9ad6; }
.cal-event.post.scheduled      { background: rgba(245,158,11,0.2);  color: #f59e0b; }
.cal-event.page.published      { background: rgba(139,92,246,0.25); color: #c4b5fd; }
.cal-event.page.draft          { background: rgba(139,92,246,0.1);  color: #9d86e0; }
.cal-event.page.scheduled      { background: rgba(245,158,11,0.2);  color: #f59e0b; }
.cal-event.event               { background: rgba(245,158,11,0.2);  color: #f59e0b; }
.cal-event.product.published   { background: rgba(16,185,129,0.2);  color: #6ee7b7; }
.cal-event.product.draft       { background: rgba(16,185,129,0.08); color: #6ee7b7; opacity: 0.7; }

.event-icon  { flex-shrink: 0; font-size: 0.65rem; }
.event-title { overflow: hidden; text-overflow: ellipsis; }

/* List view */
.list-wrap { margin-top: 0.5rem; }
.list-table { border-radius: 1rem; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.75rem 1rem; text-align: left; font-size: 0.88rem; border-bottom: 1px solid var(--border); }
th { font-weight: 600; color: var(--muted); font-size: 0.78rem; text-transform: uppercase; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.02); }

.date-col  { white-space: nowrap; color: var(--muted); }
.title-col { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.type-badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.55rem; border-radius: 999px;
  font-size: 0.75rem; text-transform: capitalize;
}
.type-badge.post    { background: rgba(78,136,230,0.15); color: #90bcff; }
.type-badge.page    { background: rgba(139,92,246,0.15); color: #c4b5fd; }
.type-badge.event   { background: rgba(245,158,11,0.15); color: #f59e0b; }
.type-badge.product { background: rgba(16,185,129,0.15); color: #6ee7b7; }

.status-pill {
  padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 0.72rem;
  font-weight: 600; text-transform: capitalize;
}
.status-pill.published { background: rgba(16,185,129,0.2); color: #6ee7b7; }
.status-pill.draft     { background: rgba(100,100,120,0.3); color: var(--muted); }
.status-pill.scheduled { background: rgba(245,158,11,0.2); color: #f59e0b; }

.btn-sm { padding: 0.25rem 0.6rem; font-size: 0.8rem; }

/* Upcoming sidebar strip */
.upcoming-strip {
  margin-top: 1.25rem; padding: 1.25rem; border-radius: 1.25rem;
}
.upcoming-strip h3 { margin: 0 0 0.75rem; font-size: 0.95rem; }
.upcoming-list { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.upcoming-item {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 0.75rem; border-radius: 0.6rem;
  background: rgba(255,255,255,0.04); cursor: pointer;
  border: 1px solid transparent; transition: border-color 0.15s;
  min-width: 200px; max-width: 280px;
}
.upcoming-item:hover { border-color: var(--border); }
.up-icon { font-size: 1.1rem; }
.up-body { flex: 1; min-width: 0; }
.up-title { font-size: 0.85rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-date  { font-size: 0.75rem; color: var(--muted); }

.empty-state { padding: 2rem; text-align: center; color: var(--muted); border-radius: 1rem; }
</style>
