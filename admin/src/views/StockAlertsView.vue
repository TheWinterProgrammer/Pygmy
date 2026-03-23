<template>
  <div>
    <div class="page-header">
      <h1>🔔 Back-in-Stock Alerts</h1>
      <p class="subtitle">Customers signed up to be notified when out-of-stock products are restocked</p>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-num accent-text">{{ stats.pending }}</div>
        <div class="stat-lbl">Pending Alerts</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.notified }}</div>
        <div class="stat-lbl">Already Notified</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.products_with_alerts }}</div>
        <div class="stat-lbl">Products Watched</div>
      </div>
    </div>

    <!-- Top Products -->
    <div v-if="stats?.top_products?.length" class="glass section" style="margin-bottom:1.5rem;padding:1.25rem">
      <h3 style="margin:0 0 1rem;font-size:1rem">🔥 Most Wanted Products</h3>
      <div class="top-products">
        <div v-for="p in stats.top_products" :key="p.product_id" class="top-product-card glass">
          <div class="tp-info">
            <div class="tp-name">{{ p.name }}</div>
            <div class="tp-stock text-muted">
              <span v-if="p.stock_quantity <= 0" class="pill pill-red">Out of Stock</span>
              <span v-else class="pill pill-green">{{ p.stock_quantity }} in stock</span>
            </div>
          </div>
          <div class="tp-right">
            <div class="tp-count">{{ p.alert_count }} <span class="text-muted">waiting</span></div>
            <button class="btn btn-primary btn-sm" @click="notifyProduct(p)" :disabled="notifying[p.product_id]">
              {{ notifying[p.product_id] ? '⏳ Sending…' : '📧 Notify All' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="toolbar glass" style="margin-bottom:1rem;padding:.75rem 1rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
      <input v-model="q" @input="debSearch" class="input input-sm" placeholder="Search by email or product…" style="flex:1;min-width:180px" />
      <select v-model="filterNotified" @change="load" class="input input-sm" style="min-width:160px">
        <option value="">All Alerts</option>
        <option value="0">Pending Only</option>
        <option value="1">Notified Only</option>
      </select>
    </div>

    <!-- Alerts Table -->
    <div class="glass table-card">
      <div v-if="loading" class="loading-state"><div class="loading-bar"></div></div>
      <div v-else-if="!alerts.length" class="empty-state">
        <div style="font-size:2rem;margin-bottom:.5rem">🔔</div>
        <div>No stock alerts found.</div>
        <div class="text-muted" style="font-size:.85rem;margin-top:.5rem">Customers can sign up on any out-of-stock product page.</div>
      </div>
      <table v-else class="admin-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Product</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Signed Up</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in alerts" :key="a.id">
            <td>
              <div>{{ a.name || '(Anonymous)' }}</div>
              <div class="text-muted" style="font-size:.8rem">{{ a.email }}</div>
            </td>
            <td>
              <div>{{ a.product_name }}</div>
              <div class="text-muted" style="font-size:.8rem">/shop/{{ a.product_slug }}</div>
            </td>
            <td>
              <span v-if="a.stock_quantity <= 0" class="pill pill-red">Out</span>
              <span v-else class="pill pill-green">{{ a.stock_quantity }}</span>
            </td>
            <td>
              <span v-if="a.notified" class="pill pill-gray">Notified {{ fmtDate(a.notified_at) }}</span>
              <span v-else class="pill pill-yellow">Pending</span>
            </td>
            <td class="text-muted" style="font-size:.82rem">{{ fmtDate(a.created_at) }}</td>
            <td>
              <div style="display:flex;gap:.3rem">
                <button v-if="!a.notified" class="btn btn-sm btn-primary" @click="notifyOne(a)" :disabled="notifying[a.id]">
                  {{ notifying[a.id] ? '⏳' : '📧 Notify' }}
                </button>
                <button class="btn-icon danger" @click="deleteAlert(a)" title="Delete">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > limit" class="pagination">
        <button :disabled="offset === 0" @click="prev" class="btn btn-sm">← Prev</button>
        <span class="text-muted" style="font-size:.85rem">{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
        <button :disabled="offset + limit >= total" @click="next" class="btn btn-sm">Next →</button>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="toast glass">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = 'http://localhost:3200/api'

const loading = ref(false)
const alerts = ref([])
const stats = ref(null)
const total = ref(0)
const offset = ref(0)
const limit = 50
const q = ref('')
const filterNotified = ref('')
const notifying = reactive({})
const toast = ref('')

function apiFetch(path, opts = {}) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, ...(opts.headers || {}) },
  }).then(r => r.json())
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit, offset: offset.value })
    if (q.value) params.set('q', q.value)
    if (filterNotified.value !== '') params.set('notified', filterNotified.value)
    const [data, s] = await Promise.all([
      apiFetch(`/stock-alerts?${params}`),
      apiFetch('/stock-alerts/stats'),
    ])
    alerts.value = data.alerts || []
    total.value = data.total || 0
    stats.value = s
  } finally { loading.value = false }
}

let debTimer = null
function debSearch() {
  clearTimeout(debTimer)
  debTimer = setTimeout(() => { offset.value = 0; load() }, 300)
}

function prev() { offset.value -= limit; load() }
function next() { offset.value += limit; load() }

async function notifyProduct(p) {
  notifying[p.product_id] = true
  try {
    const r = await apiFetch('/stock-alerts/notify', { method: 'POST', body: JSON.stringify({ product_id: p.product_id }) })
    showToast(`✓ Sent ${r.sent} notification${r.sent !== 1 ? 's' : ''}`)
    load()
  } catch { showToast('⚠️ Error sending notifications') }
  finally { notifying[p.product_id] = false }
}

async function notifyOne(a) {
  notifying[a.id] = true
  try {
    const r = await apiFetch('/stock-alerts/notify', { method: 'POST', body: JSON.stringify({ product_id: a.product_id }) })
    showToast(`✓ Notification sent to ${a.email}`)
    load()
  } catch { showToast('⚠️ Error') }
  finally { notifying[a.id] = false }
}

async function deleteAlert(a) {
  if (!confirm(`Remove alert for ${a.email}?`)) return
  await apiFetch(`/stock-alerts/${a.id}`, { method: 'DELETE' })
  load()
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 3000)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.page-header { margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.75rem; margin: 0 0 .25rem; }
.subtitle { color: var(--muted, #888); margin: 0; font-size: .9rem; }

.stats-strip { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card { padding: .75rem 1.25rem; border-radius: 1rem; min-width: 120px; }
.stat-card.glass { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
.stat-num { font-size: 1.5rem; font-weight: 700; }
.stat-lbl { font-size: .78rem; color: var(--muted, #888); }
.accent-text { color: hsl(355,70%,58%); }

.section { background: rgba(255,255,255,.04); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); }

.top-products { display: flex; flex-direction: column; gap: .6rem; }
.top-product-card { background: rgba(255,255,255,.05); border-radius: .75rem; border: 1px solid rgba(255,255,255,.1); padding: .75rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.tp-name { font-weight: 500; font-size: .9rem; }
.tp-stock { font-size: .8rem; margin-top: .2rem; }
.tp-right { display: flex; align-items: center; gap: .75rem; }
.tp-count { font-size: 1.1rem; font-weight: 700; }
.text-muted { color: #888; }

.toolbar { background: rgba(255,255,255,.05); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); }
.input { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; padding: .45rem .75rem; color: inherit; font-size: .9rem; width: 100%; }
.input-sm { padding: .35rem .65rem; font-size: .85rem; width: auto; }

.table-card { background: rgba(255,255,255,.04); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); overflow: hidden; }
.loading-state { padding: 2rem; }
.loading-bar { height: 3px; background: linear-gradient(90deg, transparent, hsl(355,70%,58%), transparent); animation: shimmer 1.5s infinite; border-radius: 2px; }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.empty-state { text-align: center; padding: 2.5rem; color: #888; }

.admin-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
.admin-table th { padding: .65rem 1rem; text-align: left; color: #888; font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid rgba(255,255,255,.07); }
.admin-table td { padding: .65rem 1rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.admin-table tr:last-child td { border-bottom: none; }

.pill { padding: .2rem .6rem; border-radius: 2rem; font-size: .75rem; font-weight: 600; }
.pill-green { background: rgba(34,197,94,.15); color: #22c55e; border: 1px solid rgba(34,197,94,.25); }
.pill-red { background: rgba(239,68,68,.15); color: #ef4444; border: 1px solid rgba(239,68,68,.25); }
.pill-yellow { background: rgba(234,179,8,.15); color: #eab308; border: 1px solid rgba(234,179,8,.25); }
.pill-gray { background: rgba(156,163,175,.15); color: #9ca3af; border: 1px solid rgba(156,163,175,.25); }

.btn { padding: .45rem 1rem; border-radius: .6rem; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); cursor: pointer; color: inherit; font-size: .85rem; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-sm { padding: .3rem .75rem; font-size: .8rem; }
.btn-primary { background: hsl(355,70%,58%); border-color: transparent; color: #fff; }
.btn-icon { background: transparent; border: none; cursor: pointer; padding: .3rem; border-radius: .4rem; font-size: .9rem; opacity: .7; transition: opacity .2s; }
.btn-icon.danger:hover { background: rgba(239,68,68,.1); color: #ef4444; opacity: 1; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: .75rem; }

.toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: .75rem 1.25rem; border-radius: .75rem; background: hsl(228,4%,20%); border: 1px solid rgba(255,255,255,.12); color: #fff; font-size: .9rem; z-index: 9999; animation: fadeIn .2s ease; }
@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
</style>
