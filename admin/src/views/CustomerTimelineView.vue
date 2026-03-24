<template>
  <div>
    <div class="page-header">
      <h1>⏱️ Customer Activity Timeline</h1>
      <p class="subtitle">Full interaction history for any customer</p>
    </div>

    <!-- Search -->
    <div class="search-area glass">
      <input v-model="searchEmail" @keydown.enter="searchCustomer" placeholder="Search customer by email or name…" class="search-input" />
      <button class="btn btn-primary" @click="searchCustomer">Search</button>
    </div>

    <!-- Customer list results -->
    <div class="glass customer-results" v-if="searchResults.length && !selected">
      <div class="result-item" v-for="c in searchResults" :key="c.id" @click="loadTimeline(c)">
        <div class="cust-info">
          <strong>{{ c.first_name }} {{ c.last_name }}</strong>
          <span class="meta">{{ c.email }}</span>
        </div>
        <div class="cust-stats">
          <span class="badge">{{ c.order_count }} orders</span>
          <span class="badge accent">€{{ (c.total_spent || 0).toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Timeline display -->
    <div v-if="selected && timeline">
      <!-- Customer header -->
      <div class="customer-header glass">
        <button class="back-btn" @click="selected = null; timeline = null">← Back</button>
        <div class="cust-avatar">{{ initials(selected) }}</div>
        <div class="cust-details">
          <h2>{{ selected.first_name }} {{ selected.last_name }}</h2>
          <span class="meta">{{ selected.email }}</span>
          <span v-if="selected.phone" class="meta">· {{ selected.phone }}</span>
        </div>
        <div class="cust-summary-pills">
          <div class="sum-pill">
            <div class="sum-num">{{ summary.total_orders }}</div>
            <div class="sum-label">Orders</div>
          </div>
          <div class="sum-pill">
            <div class="sum-num">€{{ (summary.total_spent || 0).toFixed(0) }}</div>
            <div class="sum-label">Spent</div>
          </div>
          <div class="sum-pill" v-if="summary.points_balance">
            <div class="sum-num">{{ summary.points_balance }}</div>
            <div class="sum-label">Points</div>
          </div>
          <div class="sum-pill" v-if="summary.store_credit">
            <div class="sum-num">€{{ summary.store_credit.toFixed(0) }}</div>
            <div class="sum-label">Credit</div>
          </div>
        </div>
      </div>

      <!-- Filter by event type -->
      <div class="type-filters">
        <button :class="['type-btn', filterType === '' && 'active']" @click="filterType = ''">All ({{ events.length }})</button>
        <button v-for="t in eventTypes" :key="t.type" :class="['type-btn', filterType === t.type && 'active']" @click="filterType = t.type">
          {{ t.icon }} {{ t.label }} ({{ t.count }})
        </button>
      </div>

      <!-- Timeline -->
      <div class="timeline-wrap" v-if="filteredEvents.length">
        <div v-for="(evt, idx) in filteredEvents" :key="idx" class="tl-item">
          <div class="tl-connector" v-if="idx > 0"></div>
          <div class="tl-dot" :class="`type-${evt.type}`">{{ evt.icon }}</div>
          <div class="tl-card glass">
            <div class="tl-header">
              <span class="tl-label">{{ evt.label }}</span>
              <span class="tl-time">{{ formatDate(evt.created_at) }}</span>
            </div>
            <div class="tl-desc">{{ evt.description }}</div>
            <div class="tl-meta-pills" v-if="evt.meta">
              <span v-for="(v, k) in evt.meta" :key="k" class="meta-pill">{{ k }}: {{ v }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>No events for this filter.</div>
    </div>

    <div class="empty-state" v-else-if="searchEmail && !searchResults.length && !selected && searched">
      No customers found.
    </div>

    <div class="hero-hint" v-if="!selected && !searchResults.length && !searched">
      <div class="hint-icon">⏱️</div>
      <h3>Customer Activity Timeline</h3>
      <p>Search for a customer to view their complete interaction history — orders, reviews, support tickets, loyalty points, and more.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'

const route = useRoute()

const searchEmail = ref('')
const searchResults = ref([])
const selected = ref(null)
const timeline = ref(null)
const summary = ref({})
const events = ref([])
const filterType = ref('')
const searched = ref(false)

async function searchCustomer() {
  if (!searchEmail.value.trim()) return
  const data = await api.get(`/api/customers?q=${encodeURIComponent(searchEmail.value)}&limit=10`)
  searchResults.value = data.customers || data
  searched.value = true
  selected.value = null
  timeline.value = null
}

async function loadTimeline(customer) {
  selected.value = customer
  searchResults.value = []
  const data = await api.get(`/api/customer-timeline/${customer.id}`)
  timeline.value = data
  events.value = data.events || []
  summary.value = data.summary || {}
}

const filteredEvents = computed(() => {
  if (!filterType.value) return events.value
  return events.value.filter(e => e.type === filterType.value)
})

const eventTypes = computed(() => {
  const types = {}
  for (const e of events.value) {
    if (!types[e.type]) types[e.type] = { type: e.type, icon: e.icon, label: typeLabel(e.type), count: 0 }
    types[e.type].count++
  }
  return Object.values(types)
})

function typeLabel(type) {
  const map = { order: 'Orders', review: 'Reviews', support: 'Support', newsletter: 'Newsletter',
    loyalty: 'Loyalty', gift_registry: 'Gift Registry', booking: 'Bookings',
    store_credit: 'Store Credit', registered: 'Registration' }
  return map[type] || type
}

function initials(c) {
  return `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase() || '?'
}

onMounted(async () => {
  // If ?id= query param, load that customer directly
  if (route.query.id) {
    try {
      const data = await api.get(`/api/customers/${route.query.id}`)
      if (data?.email) {
        selected.value = data
        await loadTimeline(data)
      }
    } catch (_) {}
  }
})

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.page-header { margin-bottom: 24px; }
.page-header h1 { margin-bottom: 4px; }
.subtitle { opacity: 0.55; font-size: 13px; }

.search-area { display: flex; gap: 10px; padding: 16px; border-radius: 1rem; margin-bottom: 20px; }
.search-input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 14px; color: inherit; font-size: 14px; }
.search-input::placeholder { opacity: 0.4; }
.btn { padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-primary { background: var(--accent); color: white; }

.customer-results { border-radius: 1rem; overflow: hidden; margin-bottom: 20px; }
.result-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s; }
.result-item:hover { background: rgba(255,255,255,0.05); }
.cust-info { display: flex; flex-direction: column; gap: 2px; }
.cust-stats { display: flex; gap: 8px; }
.badge { background: rgba(255,255,255,0.08); padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
.badge.accent { background: rgba(217,79,90,0.15); color: var(--accent); }

.customer-header { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 1.5rem; margin-bottom: 20px; flex-wrap: wrap; }
.back-btn { background: rgba(255,255,255,0.07); border: none; color: inherit; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.cust-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: white; flex-shrink: 0; }
.cust-details { flex: 1; min-width: 150px; }
.cust-details h2 { margin: 0 0 4px; font-size: 16px; }
.cust-summary-pills { display: flex; gap: 12px; flex-wrap: wrap; margin-left: auto; }
.sum-pill { text-align: center; background: rgba(255,255,255,0.06); border-radius: 10px; padding: 8px 14px; }
.sum-num { font-size: 18px; font-weight: 800; }
.sum-label { font-size: 10px; opacity: 0.5; margin-top: 2px; }

.type-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.type-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 6px 14px; color: inherit; cursor: pointer; font-size: 12px; transition: all 0.15s; }
.type-btn.active { background: var(--accent); border-color: var(--accent); color: white; font-weight: 600; }

.timeline-wrap { position: relative; padding-left: 40px; }
.tl-item { position: relative; margin-bottom: 16px; }
.tl-connector { position: absolute; left: -25px; top: -16px; bottom: 50%; width: 2px; background: rgba(255,255,255,0.1); }
.tl-dot { position: absolute; left: -36px; top: 14px; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.15); z-index: 1; }
.tl-dot.type-order { background: rgba(217,79,90,0.2); border-color: var(--accent); }
.tl-dot.type-registered { background: rgba(16,185,129,0.2); border-color: #10b981; }
.tl-dot.type-loyalty { background: rgba(245,158,11,0.2); border-color: #f59e0b; }
.tl-dot.type-support { background: rgba(99,102,241,0.2); border-color: #6366f1; }
.tl-card { padding: 14px 16px; border-radius: 1rem; }
.tl-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.tl-label { font-size: 13px; font-weight: 700; }
.tl-time { font-size: 11px; opacity: 0.5; white-space: nowrap; }
.tl-desc { font-size: 13px; opacity: 0.75; }
.tl-meta-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.meta-pill { background: rgba(255,255,255,0.06); font-size: 10px; padding: 2px 8px; border-radius: 99px; opacity: 0.8; }

.meta { opacity: 0.55; font-size: 12px; }
.empty-state { padding: 48px; text-align: center; opacity: 0.4; }
.hero-hint { text-align: center; padding: 60px 40px; opacity: 0.6; }
.hint-icon { font-size: 48px; margin-bottom: 16px; }
.hero-hint h3 { margin-bottom: 8px; }
.hero-hint p { max-width: 400px; margin: 0 auto; font-size: 14px; line-height: 1.7; }
.glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(16px); }
</style>
