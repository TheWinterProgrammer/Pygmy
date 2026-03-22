<template>
  <div>
    <div class="page-header">
      <h1>🔔 Back-in-Stock Alerts</h1>
    </div>

    <!-- Stats strip -->
    <div class="alert-stats" v-if="stats">
      <div class="astat glass">
        <div class="astat-num">{{ stats.pending }}</div>
        <div class="astat-label">Pending Alerts</div>
      </div>
      <div class="astat glass">
        <div class="astat-num">{{ stats.products_with_alerts }}</div>
        <div class="astat-label">Products</div>
      </div>
      <div class="astat glass">
        <div class="astat-num">{{ stats.notified }}</div>
        <div class="astat-label">Already Notified</div>
      </div>
    </div>

    <!-- Top products waiting for restock -->
    <div v-if="stats?.top_products?.length" class="glass" style="padding:20px;margin-bottom:24px;">
      <h3 style="margin:0 0 12px;">Most Wanted (by alert count)</h3>
      <div class="top-products-grid">
        <div v-for="p in stats.top_products" :key="p.product_id" class="top-product-card glass">
          <div class="top-product-name">{{ p.name }}</div>
          <div class="top-product-meta">
            <span class="badge badge-orange">{{ p.alert_count }} alerts</span>
            <span class="badge" :class="p.stock_quantity > 0 ? 'badge-green' : 'badge-red'">
              {{ p.stock_quantity > 0 ? `In stock (${p.stock_quantity})` : 'Out of stock' }}
            </span>
          </div>
          <button class="btn btn-primary btn-sm" @click="notifyProduct(p.product_id, p.name)" :disabled="p.stock_quantity <= 0">
            📧 Send Alerts
          </button>
        </div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar glass">
      <input v-model="search" placeholder="Search by email or product…" class="form-input" @input="debounceLoad" />
      <select v-model="filterNotified" class="form-select" @change="load">
        <option value="">All</option>
        <option value="0">Pending</option>
        <option value="1">Notified</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <div class="loading-bar" v-if="loading"></div>
      <table class="data-table" v-if="alerts.length">
        <thead>
          <tr>
            <th>Email</th>
            <th>Product</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Signed up</th>
            <th style="width:100px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in alerts" :key="a.id">
            <td>
              <div>{{ a.email }}</div>
              <div class="text-muted" v-if="a.name" style="font-size:12px;">{{ a.name }}</div>
            </td>
            <td>
              <a :href="`http://localhost:5174/shop/${a.product_slug}`" target="_blank" class="link-accent">
                {{ a.product_name }}
              </a>
            </td>
            <td>
              <span class="badge" :class="a.stock_quantity > 0 ? 'badge-green' : 'badge-red'">
                {{ a.stock_quantity > 0 ? `${a.stock_quantity} in stock` : 'Out of stock' }}
              </span>
            </td>
            <td>
              <span class="status-pill" :class="a.notified ? 'pill-green' : 'pill-yellow'">
                {{ a.notified ? '✓ Notified' : 'Pending' }}
              </span>
              <div class="text-muted" v-if="a.notified_at" style="font-size:11px;margin-top:2px;">
                {{ formatDate(a.notified_at) }}
              </div>
            </td>
            <td class="text-muted">{{ formatDate(a.created_at) }}</td>
            <td class="row-actions">
              <button class="btn btn-ghost btn-sm btn-danger" @click="deleteAlert(a)">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" v-else-if="!loading">
        <p>No back-in-stock alerts found.</p>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="total > limit">
      <button class="btn btn-ghost" :disabled="page === 1" @click="page--; load()">← Prev</button>
      <span>Page {{ page }} of {{ Math.ceil(total / limit) }}</span>
      <button class="btn btn-ghost" :disabled="page >= Math.ceil(total / limit)" @click="page++; load()">Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const API = 'http://localhost:3200/api'
const token = localStorage.getItem('pygmy_token')

const alerts = ref([])
const stats = ref(null)
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const limit = 30
const search = ref('')
const filterNotified = ref('')

let searchTimer = null
function debounceLoad() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 400)
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit, offset: (page.value - 1) * limit })
    if (filterNotified.value !== '') params.set('notified', filterNotified.value)
    const res = await fetch(`${API}/stock-alerts?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    alerts.value = data.alerts || []
    total.value = data.total || 0
  } catch {}
  loading.value = false
}

async function loadStats() {
  try {
    const res = await fetch(`${API}/stock-alerts/stats`, { headers: { Authorization: `Bearer ${token}` } })
    stats.value = await res.json()
  } catch {}
}

async function notifyProduct(productId, productName) {
  if (!confirm(`Send back-in-stock emails for "${productName}"?`)) return
  try {
    const res = await fetch(`${API}/stock-alerts/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ product_id: productId }),
    })
    const data = await res.json()
    alert(`Sent ${data.sent} email(s). Errors: ${data.errors || 0}`)
    load()
    loadStats()
  } catch (e) {
    alert('Error: ' + e.message)
  }
}

async function deleteAlert(a) {
  if (!confirm(`Remove alert for ${a.email}?`)) return
  await fetch(`${API}/stock-alerts/${a.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  load()
  loadStats()
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(() => { load(); loadStats() })
</script>

<style scoped>
.alert-stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.astat { padding: 16px 24px; text-align: center; border-radius: 12px; min-width: 100px; }
.astat-num { font-size: 28px; font-weight: 700; color: var(--accent); }
.astat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.top-products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.top-product-card { padding: 16px; border-radius: 12px; }
.top-product-name { font-weight: 600; margin-bottom: 8px; font-size: 14px; }
.top-product-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.filter-bar { display: flex; gap: 12px; padding: 16px; border-radius: 12px; margin-bottom: 20px; align-items: center; }
.filter-bar .form-input { flex: 1; }
.pagination { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 20px; }
</style>
