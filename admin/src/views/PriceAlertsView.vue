<template>
  <div>
    <div class="page-header">
      <h1>📉 Price Drop Alerts</h1>
      <p class="subtitle">Customers waiting to be notified of price reductions</p>
    </div>

    <!-- Stats -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-label">Pending Alerts</div>
        <div class="stat-value" :class="{ accent: stats.pending > 0 }">{{ stats.pending }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Products Watched</div>
        <div class="stat-value">{{ stats.products_with_alerts }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Already Notified</div>
        <div class="stat-value">{{ stats.notified }}</div>
      </div>
    </div>

    <!-- Top Wanted Products -->
    <div v-if="stats?.top_products?.length" class="glass" style="padding:20px;margin-bottom:24px;">
      <h3 style="margin:0 0 12px;">🔥 Most Watched Products</h3>
      <div class="top-grid">
        <div v-for="p in stats.top_products" :key="p.id" class="top-card glass-sm">
          <div class="top-name">{{ p.name }}</div>
          <div class="top-meta">
            <span class="badge badge-accent">{{ p.alert_count }} watchers</span>
            <span class="top-price">{{ fmt(p.sale_price || p.price) }}</span>
          </div>
          <button class="btn btn-sm btn-outline" @click="notifyProduct(p.id, p.name)">
            Send Alerts
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input v-model="search" class="input" placeholder="Search by email or product…" style="flex:1" />
      <select v-model="notifiedFilter" class="input" style="width:160px">
        <option value="">All</option>
        <option value="0">Pending only</option>
        <option value="1">Notified only</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass" style="overflow-x:auto;">
      <table class="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Email</th>
            <th>Name</th>
            <th>Target Price</th>
            <th>Price at Signup</th>
            <th>Current Price</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="9" class="text-center muted">Loading…</td></tr>
          <tr v-else-if="!filtered.length"><td colspan="9" class="text-center muted">No alerts found</td></tr>
          <tr v-for="a in filtered" :key="a.id">
            <td><strong>{{ a.product_name }}</strong></td>
            <td>{{ a.email }}</td>
            <td>{{ a.name || '—' }}</td>
            <td>{{ a.target_price ? fmt(a.target_price) : 'Any drop' }}</td>
            <td>{{ fmt(a.current_price_at_signup) }}</td>
            <td :class="{ 'text-accent': (a.sale_price || a.current_price) < a.current_price_at_signup }">
              {{ fmt(a.sale_price || a.current_price) }}
              <span v-if="(a.sale_price || a.current_price) < a.current_price_at_signup" title="Price dropped!">📉</span>
            </td>
            <td>
              <span class="badge" :class="a.notified ? 'badge-green' : 'badge-orange'">
                {{ a.notified ? 'Notified' : 'Pending' }}
              </span>
            </td>
            <td>{{ formatDate(a.created_at) }}</td>
            <td>
              <button class="btn btn-xs btn-ghost btn-danger" @click="deleteAlert(a.id)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const alerts = ref([])
const stats = ref(null)
const loading = ref(true)
const search = ref('')
const notifiedFilter = ref('')
const symbol = ref('€')

async function load() {
  loading.value = true
  try {
    const [alertsRes, statsRes, settingsRes] = await Promise.all([
      api.get('/price-alerts'),
      api.get('/price-alerts/stats'),
      api.get('/settings'),
    ])
    alerts.value = alertsRes.data.items || []
    stats.value = statsRes.data
    symbol.value = settingsRes.data.shop_currency_symbol || '€'
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let list = alerts.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(a => a.email.includes(q) || a.product_name?.toLowerCase().includes(q) || a.name?.toLowerCase().includes(q))
  }
  if (notifiedFilter.value !== '') {
    list = list.filter(a => String(a.notified) === notifiedFilter.value)
  }
  return list
})

async function deleteAlert(id) {
  if (!confirm('Delete this alert?')) return
  await api.delete(`/price-alerts/${id}`)
  alerts.value = alerts.value.filter(a => a.id !== id)
}

async function notifyProduct(productId, productName) {
  if (!confirm(`Send price drop emails for "${productName}"?`)) return
  try {
    const res = await api.post(`/price-alerts/notify/${productId}`)
    alert(`Sent: ${res.data.sent} email(s). Failed: ${res.data.failed}.`)
    load()
  } catch (e) {
    alert(e.response?.data?.error || 'Send failed')
  }
}

function fmt(n) {
  if (n == null) return '—'
  return symbol.value + parseFloat(n).toFixed(2)
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.stats-row { display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
.stat-card { padding:16px 20px; min-width:140px; text-align:center; }
.stat-label { font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); }
.stat-value { font-size:1.8rem; font-weight:700; margin-top:4px; }
.stat-value.accent { color: var(--accent); }

.top-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
.top-card { padding:12px 14px; display:flex; flex-direction:column; gap:8px; }
.top-name { font-weight:600; font-size:.9rem; }
.top-meta { display:flex; align-items:center; justify-content:space-between; }
.top-price { font-size:.85rem; color:var(--text-muted); }

.filter-bar { display:flex; gap:12px; padding:14px 16px; margin-bottom:16px; }
.table { width:100%; border-collapse:collapse; font-size:.85rem; }
.table th { padding:10px 12px; text-align:left; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); border-bottom:1px solid var(--border); }
.table td { padding:10px 12px; border-bottom:1px solid var(--border-subtle); }
.table tr:last-child td { border-bottom:none; }
.text-center { text-align:center; }
.muted { color:var(--text-muted); }
.badge { display:inline-block; padding:2px 8px; border-radius:99px; font-size:.72rem; font-weight:600; }
.badge-green  { background:rgba(80,200,120,.15); color:#4ce88a; }
.badge-orange { background:rgba(255,160,50,.15); color:#ffa030; }
.badge-accent { background:rgba(var(--accent-rgb),.15); color:var(--accent); }
.text-accent { color:var(--accent); }
.btn { display:inline-flex; align-items:center; justify-content:center; padding:6px 12px; border-radius:8px; font-size:.8rem; font-weight:600; cursor:pointer; border:1px solid transparent; transition:.15s; }
.btn-xs { padding:3px 8px; font-size:.72rem; }
.btn-sm { padding:5px 10px; font-size:.78rem; }
.btn-ghost { background:transparent; border-color:var(--border); color:var(--text); }
.btn-ghost:hover { border-color:var(--accent); color:var(--accent); }
.btn-outline { background:transparent; border-color:var(--accent); color:var(--accent); }
.btn-outline:hover { background:rgba(var(--accent-rgb),.1); }
.btn-danger:hover { border-color:var(--accent); color:var(--accent); }
.page-header { margin-bottom:20px; }
.page-header h1 { margin:0 0 4px; }
.subtitle { margin:0; color:var(--text-muted); font-size:.85rem; }
.glass { background:var(--surface); border:1px solid rgba(255,255,255,.08); border-radius:1rem; }
.glass-sm { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); border-radius:.75rem; }
.input { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:.5rem; padding:8px 12px; color:var(--text); font-family:inherit; font-size:.85rem; }
.input:focus { outline:none; border-color:var(--accent); }
</style>
