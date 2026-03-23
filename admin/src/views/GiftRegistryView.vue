<template>
  <div class="gift-registry-view">
    <div class="page-header">
      <h1>🎁 Gift Registries</h1>
      <div class="header-stats" v-if="stats">
        <span class="stat-pill">{{ stats.total }} total</span>
        <span class="stat-pill active">{{ stats.active }} active</span>
        <span class="stat-pill">{{ stats.items }} items</span>
        <span class="stat-pill purchased">{{ stats.purchased }} purchased</span>
      </div>
    </div>

    <!-- Type breakdown -->
    <div class="type-strip" v-if="stats?.by_type?.length">
      <div class="type-card" v-for="t in stats.by_type" :key="t.event_type">
        <span class="type-icon">{{ typeEmoji(t.event_type) }}</span>
        <span class="type-label">{{ t.event_type }}</span>
        <span class="type-count">{{ t.count }}</span>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <input v-model="q" @input="debounceLoad" placeholder="Search by title or customer email…" class="search-input" />
      <select v-model="filterStatus" @change="loadRegistries">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      <select v-model="filterType" @change="loadRegistries">
        <option value="">All Types</option>
        <option value="wedding">Wedding</option>
        <option value="baby">Baby Shower</option>
        <option value="birthday">Birthday</option>
        <option value="other">Other</option>
      </select>
      <button class="btn-accent" @click="loadRegistries">Refresh</button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Customer</th>
            <th>Event Date</th>
            <th>Items</th>
            <th>Purchases</th>
            <th>Visibility</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="9" class="loading-row">Loading…</td></tr>
          <tr v-else-if="!rows.length"><td colspan="9" class="empty-row">No registries found.</td></tr>
          <tr v-for="reg in rows" :key="reg.id" @click="openDetail(reg)" class="clickable">
            <td>
              <strong>{{ reg.title }}</strong>
              <div class="slug">{{ reg.slug }}</div>
            </td>
            <td><span class="type-badge" :class="reg.event_type">{{ typeEmoji(reg.event_type) }} {{ reg.event_type }}</span></td>
            <td>
              <span v-if="reg.first_name">{{ reg.first_name }} {{ reg.last_name }}</span>
              <span v-else class="muted">—</span>
              <div class="muted small" v-if="reg.customer_email">{{ reg.customer_email }}</div>
            </td>
            <td>{{ reg.event_date || '—' }}</td>
            <td><span class="badge">{{ reg.item_count }}</span></td>
            <td><span class="badge purchased">{{ reg.purchase_count }}</span></td>
            <td><span class="vis-badge" :class="reg.is_public ? 'public' : 'private'">{{ reg.is_public ? '🌐 Public' : '🔒 Private' }}</span></td>
            <td><span class="status-pill" :class="reg.status">{{ reg.status }}</span></td>
            <td @click.stop>
              <button class="btn-sm" @click="openDetail(reg)">👁️</button>
              <button class="btn-sm danger" @click="deleteRegistry(reg)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div v-if="selected" class="modal-overlay" @click.self="selected = null">
      <div class="modal-panel large">
        <div class="modal-header">
          <h2>{{ typeEmoji(selected.event_type) }} {{ selected.title }}</h2>
          <button class="close-btn" @click="selected = null">✕</button>
        </div>

        <div class="registry-meta">
          <div class="meta-row">
            <span class="meta-label">Slug</span>
            <code>{{ selected.slug }}</code>
          </div>
          <div class="meta-row">
            <span class="meta-label">Type</span>
            <span>{{ selected.event_type }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Event Date</span>
            <span>{{ selected.event_date || '—' }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Customer</span>
            <span v-if="selected.customer">{{ selected.customer.first_name }} {{ selected.customer.last_name }} ({{ selected.customer.email }})</span>
            <span v-else class="muted">Anonymous</span>
          </div>
          <div class="meta-row" v-if="selected.description">
            <span class="meta-label">Description</span>
            <span>{{ selected.description }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Visibility</span>
            <span>{{ selected.is_public ? 'Public' : 'Private' }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Status</span>
            <select v-model="editStatus" @change="updateStatus">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <!-- Items list -->
        <h3>Items ({{ selected.items?.length || 0 }})</h3>
        <div class="items-grid">
          <div v-for="item in selected.items" :key="item.id" class="item-card">
            <img v-if="item.cover_image" :src="item.cover_image" :alt="item.name" class="item-thumb" />
            <div class="item-info">
              <div class="item-name">{{ item.name }}</div>
              <div class="item-price">€{{ item.price?.toFixed(2) }}</div>
              <div class="item-qty">
                <span class="progress-label">{{ item.purchased_qty }} / {{ item.quantity }} purchased</span>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: Math.min(100, (item.purchased_qty / item.quantity) * 100) + '%' }"></div>
                </div>
              </div>
              <div v-if="item.purchases?.length" class="purchases-list">
                <div v-for="(p, i) in item.purchases" :key="i" class="purchase-row">
                  🎁 <strong>{{ p.giver_name }}</strong> × {{ p.quantity }}
                  <span v-if="p.message" class="muted"> "{{ p.message }}"</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!selected.items?.length" class="empty-items">No items added yet.</div>
        </div>

        <!-- Thank you message -->
        <div v-if="selected.thank_you" class="thank-you-section">
          <h3>Thank You Message</h3>
          <p>{{ selected.thank_you }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn" @click="selected = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const rows = ref([])
const stats = ref(null)
const loading = ref(false)
const q = ref('')
const filterStatus = ref('')
const filterType = ref('')
const selected = ref(null)
const editStatus = ref('active')
let debounceTimer = null

const API = '/api'

function typeEmoji (type) {
  return { wedding: '💍', baby: '👶', birthday: '🎂', other: '🎁' }[type] || '🎁'
}

function debounceLoad () {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadRegistries, 300)
}

async function loadRegistries () {
  loading.value = true
  const params = new URLSearchParams({ limit: 50, offset: 0 })
  if (q.value) params.set('q', q.value)
  if (filterStatus.value) params.set('status', filterStatus.value)
  if (filterType.value) params.set('event_type', filterType.value)
  const res = await fetch(`${API}/gift-registry?${params}`, { headers: { Authorization: `Bearer ${auth.token}` } })
  const data = await res.json()
  rows.value = data.rows || []
  loading.value = false
}

async function loadStats () {
  const res = await fetch(`${API}/gift-registry/stats/summary`, { headers: { Authorization: `Bearer ${auth.token}` } })
  stats.value = await res.json()
}

async function openDetail (reg) {
  const res = await fetch(`${API}/gift-registry/${reg.id}`, { headers: { Authorization: `Bearer ${auth.token}` } })
  selected.value = await res.json()
  editStatus.value = selected.value.status
}

async function updateStatus () {
  await fetch(`${API}/gift-registry/${selected.value.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ status: editStatus.value }),
  })
  loadRegistries()
}

async function deleteRegistry (reg) {
  if (!confirm(`Delete registry "${reg.title}"?`)) return
  await fetch(`${API}/gift-registry/${reg.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } })
  loadRegistries()
  loadStats()
}

onMounted(() => { loadRegistries(); loadStats() })
</script>

<style scoped>
.gift-registry-view { padding: 2rem; }
.page-header { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.page-header h1 { margin: 0; font-size: 1.5rem; }
.header-stats { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.stat-pill { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 2rem; padding: 0.25rem 0.75rem; font-size: 0.8rem; }
.stat-pill.active { background: rgba(var(--accent-rgb, 220,60,60),0.15); border-color: var(--accent,#e03c3c); color: var(--accent,#e03c3c); }
.stat-pill.purchased { background: rgba(80,200,120,0.12); border-color: #50c878; color: #50c878; }

.type-strip { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.type-card { display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; padding: 0.5rem 1rem; }
.type-count { background: var(--accent,#e03c3c); color: #fff; border-radius: 1rem; padding: 0.1rem 0.5rem; font-size: 0.75rem; font-weight: 600; }

.filter-bar { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.search-input, select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 1rem; color: #fff; font-family: inherit; }
.search-input { flex: 1; min-width: 200px; }
.btn-accent { background: var(--accent,#e03c3c); color: #fff; border: none; border-radius: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; }

.table-wrap { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; overflow: auto; }
table { width: 100%; border-collapse: collapse; }
th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.08); }
td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; }
tr.clickable { cursor: pointer; transition: background 0.15s; }
tr.clickable:hover { background: rgba(255,255,255,0.04); }
.loading-row, .empty-row { text-align: center; color: rgba(255,255,255,0.4); padding: 2rem !important; }
.slug { font-size: 0.75rem; color: rgba(255,255,255,0.4); }
.muted { color: rgba(255,255,255,0.4); }
.small { font-size: 0.75rem; }
.badge { background: rgba(255,255,255,0.1); border-radius: 1rem; padding: 0.1rem 0.5rem; font-size: 0.75rem; }
.badge.purchased { background: rgba(80,200,120,0.15); color: #50c878; }
.type-badge { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 0.5rem; background: rgba(255,255,255,0.08); }
.vis-badge.public { color: #4caf50; }
.vis-badge.private { color: rgba(255,255,255,0.4); }
.status-pill { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 0.5rem; }
.status-pill.active { background: rgba(80,200,120,0.15); color: #50c878; }
.status-pill.archived { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); }
.btn-sm { background: rgba(255,255,255,0.08); border: none; border-radius: 0.4rem; padding: 0.25rem 0.5rem; cursor: pointer; color: #fff; margin-right: 0.25rem; }
.btn-sm.danger:hover { background: rgba(var(--accent-rgb,220,60,60),0.3); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-panel { background: hsl(228,4%,12%); border: 1px solid rgba(255,255,255,0.12); border-radius: 1.5rem; width: 90%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; }
.modal-panel.large { max-width: 900px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
.modal-header h2 { margin: 0; font-size: 1.2rem; }
.close-btn { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1.2rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; gap: 0.75rem; }
.btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 1.25rem; color: #fff; cursor: pointer; }

.registry-meta { padding: 1rem 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.meta-row { display: flex; flex-direction: column; gap: 0.25rem; }
.meta-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); }
code { background: rgba(255,255,255,0.08); padding: 0.2rem 0.4rem; border-radius: 0.3rem; font-family: monospace; font-size: 0.8rem; }

h3 { padding: 0 1.5rem; margin: 0.5rem 0; font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.6); }

.items-grid { padding: 0 1.5rem 1rem; display: grid; gap: 0.75rem; overflow-y: auto; max-height: 40vh; }
.item-card { display: flex; gap: 1rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 0.75rem; }
.item-thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 0.5rem; flex-shrink: 0; }
.item-info { flex: 1; min-width: 0; }
.item-name { font-weight: 600; font-size: 0.9rem; }
.item-price { color: var(--accent,#e03c3c); font-size: 0.85rem; }
.item-qty { margin-top: 0.5rem; }
.progress-label { font-size: 0.75rem; color: rgba(255,255,255,0.5); }
.progress-bar { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.25rem; }
.progress-fill { height: 100%; background: var(--accent,#e03c3c); border-radius: 2px; transition: width 0.3s; }
.purchases-list { margin-top: 0.5rem; }
.purchase-row { font-size: 0.78rem; color: rgba(255,255,255,0.6); }
.empty-items { color: rgba(255,255,255,0.3); font-style: italic; padding: 1rem; }

.thank-you-section { padding: 0 1.5rem 1rem; }
.thank-you-section p { background: rgba(255,255,255,0.04); border-radius: 0.5rem; padding: 0.75rem; font-style: italic; color: rgba(255,255,255,0.7); }

select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.25rem 0.5rem; color: #fff; font-family: inherit; }
</style>
