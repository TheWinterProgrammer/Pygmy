<template>
  <div>
    <div class="page-header">
      <h1>📋 Waitlist</h1>
      <p class="subtitle">Customers waiting for out-of-stock products</p>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Entries</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">Pending Notify</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.notified }}</div>
        <div class="stat-label">Notified</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.products?.length || 0 }}</div>
        <div class="stat-label">Products Watched</div>
      </div>
    </div>

    <!-- Most-watched products -->
    <div class="section" v-if="stats?.products?.length">
      <h2>Most Watched Products</h2>
      <div class="product-grid">
        <div v-for="p in stats.products" :key="p.id" class="product-watch-card">
          <div class="product-watch-name">{{ p.name }}</div>
          <div class="product-watch-meta">
            <span class="badge">{{ p.watchers }} watcher{{ p.watchers !== 1 ? 's' : '' }}</span>
            <span v-if="p.stock_quantity <= 0" class="badge red">Out of Stock</span>
            <span v-else class="badge green">{{ p.stock_quantity }} in stock</span>
          </div>
          <button class="btn-sm btn-accent" @click="notifyProduct(p.id, p.name)">
            📧 Notify All
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="section">
      <div class="filter-bar">
        <input v-model="q" @input="load" placeholder="Search by email or name…" class="search-input">
        <select v-model="notifiedFilter" @change="load" class="select-input">
          <option value="">All entries</option>
          <option value="0">Pending only</option>
          <option value="1">Notified only</option>
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Product</th>
              <th>Variant</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="center">Loading…</td></tr>
            <tr v-else-if="!items.length"><td colspan="7" class="center muted">No entries found</td></tr>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.email }}</td>
              <td>{{ item.name || '—' }}</td>
              <td>
                <a :href="`/products/${item.product_id}`" target="_blank" class="product-link">
                  {{ item.product_name }}
                </a>
              </td>
              <td>{{ item.variant_key || '—' }}</td>
              <td>
                <span v-if="item.notified" class="badge green">Notified</span>
                <span v-else class="badge orange">Pending</span>
              </td>
              <td>{{ fmtDate(item.created_at) }}</td>
              <td>
                <button class="btn-icon" title="Delete" @click="deleteEntry(item.id)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" v-if="total > perPage">
        <button @click="page--; load()" :disabled="page === 1">← Prev</button>
        <span>{{ page }} / {{ Math.ceil(total / perPage) }}</span>
        <button @click="page++; load()" :disabled="page >= Math.ceil(total / perPage)">Next →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const stats = ref(null)
const items = ref([])
const total = ref(0)
const loading = ref(false)
const q = ref('')
const notifiedFilter = ref('')
const page = ref(1)
const perPage = 50

async function loadStats() {
  const { data } = await api.get('/waitlist/stats')
  stats.value = data
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/waitlist', {
      params: { q: q.value, notified: notifiedFilter.value, limit: perPage, offset: (page.value - 1) * perPage }
    })
    items.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function notifyProduct(productId, productName) {
  if (!confirm(`Send back-in-stock emails for "${productName}" to all pending waitlist members?`)) return
  try {
    const { data } = await api.post(`/waitlist/notify/${productId}`)
    alert(`✅ Sent ${data.sent} notification${data.sent !== 1 ? 's' : ''}`)
    await loadStats()
    await load()
  } catch (e) {
    alert('Error: ' + (e.response?.data?.error || e.message))
  }
}

async function deleteEntry(id) {
  if (!confirm('Remove this waitlist entry?')) return
  await api.delete(`/waitlist/${id}`)
  load()
  loadStats()
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(() => { loadStats(); load() })
</script>

<style scoped>
.page-header { margin-bottom: 24px; }
.page-header h1 { font-size: 24px; font-weight: 700; }
.subtitle { color: var(--text-muted, #888); font-size: 14px; margin-top: 4px; }

.stats-strip { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
.stat-card { background: var(--surface, #1e1f23); border-radius: 12px; padding: 16px 20px; flex: 1; min-width: 120px; border: 1px solid rgba(255,255,255,0.07); }
.stat-card.accent .stat-value { color: var(--accent, #c84b4b); }
.stat-value { font-size: 28px; font-weight: 700; }
.stat-label { font-size: 12px; color: #888; margin-top: 2px; }

.section { background: var(--surface, #1e1f23); border-radius: 16px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.07); }
.section h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }

.product-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.product-watch-card { background: rgba(255,255,255,0.04); border-radius: 10px; padding: 14px; min-width: 200px; flex: 1; border: 1px solid rgba(255,255,255,0.07); }
.product-watch-name { font-weight: 600; margin-bottom: 8px; font-size: 14px; }
.product-watch-meta { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }

.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.search-input, .select-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: inherit; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
.search-input { flex: 1; min-width: 200px; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.1); }
tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); }
tbody tr:hover { background: rgba(255,255,255,0.03); }
td { padding: 10px 12px; }
.center { text-align: center; padding: 24px; }
.muted { color: #888; }

.badge { display: inline-block; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.1); }
.badge.green { background: rgba(34,197,94,0.15); color: #4ade80; }
.badge.red { background: rgba(239,68,68,0.15); color: #f87171; }
.badge.orange { background: rgba(251,191,36,0.15); color: #fbbf24; }

.product-link { color: var(--accent, #c84b4b); text-decoration: none; }
.product-link:hover { text-decoration: underline; }

.btn-sm { padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; border: none; font-weight: 600; }
.btn-accent { background: var(--accent, #c84b4b); color: #fff; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; opacity: 0.7; }
.btn-icon:hover { opacity: 1; }

.pagination { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 16px; }
.pagination button { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: inherit; padding: 6px 14px; border-radius: 6px; cursor: pointer; }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
