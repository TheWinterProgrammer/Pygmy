<template>
  <div>
    <div class="page-header">
      <h1>Events</h1>
      <RouterLink to="/events/new" class="btn btn-primary">+ New Event</RouterLink>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input v-model="search" class="input search-input" placeholder="🔍 Search events…" />
      <select v-model="statusFilter" class="select">
        <option value="">All statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
      <select v-model="timeFilter" class="select">
        <option value="">All time</option>
        <option value="upcoming">Upcoming</option>
        <option value="past">Past</option>
      </select>
      <span class="count-badge" v-if="filtered.length !== events.length">
        {{ filtered.length }} / {{ events.length }}
      </span>
    </div>

    <div class="glass section" v-if="filtered.length">
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            <th>Location</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ev in filtered" :key="ev.id">
            <td>
              <div class="row-title">{{ ev.title }}</div>
              <div class="row-slug">{{ ev.slug }}</div>
            </td>
            <td>
              <div class="event-date-cell">
                <span class="date-icon">📅</span>
                <span>{{ formatDate(ev.start_date) }}</span>
                <span v-if="isUpcoming(ev)" class="pill-badge upcoming">Upcoming</span>
                <span v-else-if="ev.status === 'published'" class="pill-badge past">Past</span>
              </div>
            </td>
            <td>
              <span v-if="ev.location" class="location-cell">📍 {{ ev.location }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td>
              <span class="status-badge" :class="ev.status">{{ ev.status }}</span>
              <span v-if="ev.featured" class="featured-star" title="Featured">⭐</span>
            </td>
            <td>
              <div class="row-actions">
                <RouterLink :to="`/events/${ev.id}`" class="btn btn-ghost btn-sm">Edit</RouterLink>
                <button class="btn btn-ghost btn-sm" @click="toggleStatus(ev)">
                  {{ ev.status === 'published' ? 'Unpublish' : 'Publish' }}
                </button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete(ev)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state glass" v-else-if="!loading">
      <p>No events yet. <RouterLink to="/events/new">Create your first event</RouterLink>.</p>
    </div>

    <!-- Delete confirm modal -->
    <Teleport to="body">
      <div class="modal-backdrop" v-if="deleteTarget" @click.self="deleteTarget = null">
        <div class="modal glass">
          <h3>Delete event?</h3>
          <p>Are you sure you want to delete <strong>{{ deleteTarget.title }}</strong>? This cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const events = ref([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const timeFilter = ref('')
const deleteTarget = ref(null)

const filtered = computed(() => {
  let list = events.value
  if (statusFilter.value) list = list.filter(e => e.status === statusFilter.value)
  if (timeFilter.value === 'upcoming') list = list.filter(e => isUpcoming(e))
  if (timeFilter.value === 'past') list = list.filter(e => !isUpcoming(e))
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q) ||
      e.venue?.toLowerCase().includes(q)
    )
  }
  return list
})

function isUpcoming(ev) {
  return new Date(ev.start_date) >= new Date()
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/events?all=1&limit=200')
    events.value = data.events || []
  } finally {
    loading.value = false
  }
}

async function toggleStatus(ev) {
  const newStatus = ev.status === 'published' ? 'draft' : 'published'
  await api.put(`/events/${ev.id}`, { status: newStatus })
  ev.status = newStatus
}

function confirmDelete(ev) {
  deleteTarget.value = ev
}

async function doDelete() {
  if (!deleteTarget.value) return
  await api.delete(`/events/${deleteTarget.value.id}`)
  events.value = events.value.filter(e => e.id !== deleteTarget.value.id)
  deleteTarget.value = null
}

onMounted(load)
</script>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 1rem; }
.search-input { flex: 1; }
.count-badge { font-size: 0.8rem; color: var(--text-muted); }

.section { overflow-x: auto; }

.event-date-cell { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.location-cell { color: var(--text-muted); font-size: 0.85rem; }

.pill-badge {
  font-size: 0.65rem; font-weight: 700;
  padding: 2px 7px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.pill-badge.upcoming { background: hsl(145, 60%, 25%); color: hsl(145, 70%, 70%); }
.pill-badge.past { background: hsl(228, 4%, 22%); color: var(--text-muted); }

.status-badge {
  font-size: 0.72rem; font-weight: 600;
  padding: 2px 8px; border-radius: 999px; text-transform: capitalize;
}
.status-badge.published { background: hsl(145,60%,25%); color: hsl(145,70%,70%); }
.status-badge.draft { background: hsl(228,4%,22%); color: var(--text-muted); }

.featured-star { margin-left: 4px; font-size: 0.8rem; }

.row-title { font-weight: 500; }
.row-slug { font-size: 0.78rem; color: var(--text-muted); }
.muted { color: var(--text-muted); }

.row-actions { display: flex; gap: 0.4rem; }
</style>
