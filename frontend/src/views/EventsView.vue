<template>
  <div class="events-page">

    <div class="events-hero container">
      <h1>Events</h1>
      <p class="subtitle">Upcoming happenings and things to do</p>
    </div>

    <!-- Time filter tabs -->
    <div class="filters container">
      <button class="filter-btn" :class="{ active: tab === 'upcoming' }" @click="setTab('upcoming')">Upcoming</button>
      <button class="filter-btn" :class="{ active: tab === 'past' }" @click="setTab('past')">Past</button>
      <button class="filter-btn" :class="{ active: tab === 'all' }" @click="setTab('all')">All Events</button>
    </div>

    <!-- Loading skeleton -->
    <div class="container events-grid" v-if="loading">
      <div class="skeleton glass" v-for="i in 4" :key="i"></div>
    </div>

    <!-- Events grid -->
    <div class="container events-grid" v-else-if="events.length">
      <RouterLink
        v-for="ev in events"
        :key="ev.id"
        :to="`/events/${ev.slug}`"
        class="event-card glass"
      >
        <!-- Cover image -->
        <div class="card-img" v-if="ev.cover_image">
          <img :src="ev.cover_image" :alt="ev.title" loading="lazy" />
        </div>
        <div class="card-img card-img-placeholder" v-else>📆</div>

        <!-- Date badge -->
        <div class="date-badge">
          <span class="date-month">{{ formatMonth(ev.start_date) }}</span>
          <span class="date-day">{{ formatDay(ev.start_date) }}</span>
        </div>

        <div class="card-body">
          <div class="card-meta">
            <span v-if="isUpcoming(ev)" class="upcoming-pill">Upcoming</span>
            <span class="event-time">{{ formatDateTime(ev.start_date, ev.all_day) }}</span>
          </div>
          <h2 class="card-title">{{ ev.title }}</h2>
          <p class="card-excerpt" v-if="ev.excerpt">{{ ev.excerpt }}</p>
          <div class="card-location" v-if="ev.location || ev.venue">
            <span class="loc-icon">📍</span>
            <span>{{ ev.venue ? ev.venue + (ev.location ? ', ' + ev.location : '') : ev.location }}</span>
          </div>
          <div class="card-tags" v-if="ev.tags?.length">
            <span class="pill" v-for="tag in ev.tags" :key="tag">{{ tag }}</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Empty state -->
    <div class="container" v-else>
      <div class="empty-state glass">
        <p>{{ tab === 'upcoming' ? 'No upcoming events at the moment.' : 'No events found.' }}</p>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination container" v-if="totalPages > 1">
      <button class="btn" :disabled="page === 1" @click="gotoPage(page - 1)">← Prev</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button class="btn" :disabled="page === totalPages" @click="gotoPage(page + 1)">Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import api from '../api.js'
import { useSiteStore } from '../stores/site.js'

const site = useSiteStore()

useHead(computed(() => ({
  title: `Events — ${site.settings.site_name || 'Pygmy'}`,
  meta: [
    { name: 'description', content: `Upcoming events from ${site.settings.site_name || 'Pygmy'}` }
  ]
})))

const events = ref([])
const loading = ref(true)
const total = ref(0)
const page = ref(1)
const perPage = 9
const tab = ref('upcoming')

const totalPages = computed(() => Math.ceil(total.value / perPage))

function isUpcoming(ev) {
  return new Date(ev.start_date) >= new Date()
}

function formatMonth(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}
function formatDay(d) {
  return new Date(d).getDate()
}
function formatDateTime(d, allDay) {
  if (!d) return ''
  const date = new Date(d)
  if (allDay) return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function setTab(t) {
  tab.value = t
  page.value = 1
  load()
}

function gotoPage(p) {
  page.value = p
  load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function load() {
  loading.value = true
  try {
    const params = {
      limit: perPage,
      offset: (page.value - 1) * perPage,
    }
    if (tab.value === 'upcoming') params.upcoming = '1'
    if (tab.value === 'past') params.past = '1'
    const { data } = await api.get('/events', { params })
    events.value = (data.events || []).map(e => ({
      ...e,
      tags: typeof e.tags === 'string' ? JSON.parse(e.tags) : e.tags
    }))
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.events-page { padding-bottom: 4rem; }

.events-hero {
  padding: 5rem 1.5rem 2rem;
  text-align: center;
}
.events-hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; margin-bottom: 0.4rem; }
.subtitle { color: var(--text-muted); font-size: 1.05rem; }

.filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0 1.5rem 2rem;
}
.filter-btn {
  background: var(--glass-bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 0.45rem 1rem;
  border-radius: 999px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-btn.active,
.filter-btn:hover { background: var(--accent); border-color: var(--accent); color: #fff; }

.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 0 1.5rem 2rem;
}

.event-card {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--text);
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}
.event-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }

.card-img { width: 100%; aspect-ratio: 16/9; overflow: hidden; background: var(--surface); }
.card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.event-card:hover .card-img img { transform: scale(1.04); }
.card-img-placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem; background: var(--surface);
}

/* Floating date badge */
.date-badge {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  background: var(--accent);
  color: #fff;
  border-radius: 0.5rem;
  padding: 0.3rem 0.55rem;
  text-align: center;
  min-width: 44px;
  line-height: 1.1;
}
.date-month { display: block; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.date-day { display: block; font-size: 1.2rem; font-weight: 800; }

.card-body { padding: 1.1rem 1.25rem 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }

.card-meta { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.upcoming-pill {
  background: hsl(145,60%,22%);
  color: hsl(145,70%,65%);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}
.event-time { font-size: 0.78rem; color: var(--text-muted); }

.card-title { font-size: 1.05rem; font-weight: 700; margin: 0; line-height: 1.3; }
.card-excerpt { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0; }

.card-location {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.8rem; color: var(--text-muted);
}
.loc-icon { flex-shrink: 0; }

.card-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: auto; padding-top: 0.5rem; }
.pill {
  background: rgba(255,255,255,0.08);
  color: var(--text-muted);
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
}

.skeleton { height: 340px; border-radius: var(--radius); }

.empty-state { padding: 3rem; text-align: center; color: var(--text-muted); border-radius: var(--radius); }

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem 0;
}
.page-info { font-size: 0.85rem; color: var(--text-muted); }
</style>
