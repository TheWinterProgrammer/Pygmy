<template>
  <div>
    <div class="page-header">
      <h1>⭐ Review Request Automation</h1>
      <p class="subtitle">Auto-send review request emails when orders complete</p>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">Total Queued</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ stats.pending || 0 }}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.sent || 0 }}</div>
        <div class="stat-label">Sent</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.skipped || 0 }}</div>
        <div class="stat-label">Skipped</div>
      </div>
    </div>

    <!-- Config card -->
    <div class="config-card glass">
      <h3>⚙️ Configuration</h3>
      <div class="config-row">
        <label class="toggle-label">
          <input type="checkbox" v-model="config.review_requests_enabled" true-value="1" false-value="0" @change="saveConfig" />
          Enable Review Request Emails
        </label>
      </div>
      <div class="config-row" v-if="config.review_requests_enabled === '1'">
        <label>Send review request after</label>
        <div class="inline-field">
          <input v-model.number="config.review_request_delay_days" type="number" min="0" max="60" style="width:70px" @change="saveConfig" />
          <span>days after order completion</span>
        </div>
      </div>
      <div class="config-row" v-if="config.review_requests_enabled === '1'">
        <label>Email Subject</label>
        <input v-model="config.review_request_subject" placeholder="How was your order from {{site_name}}?" @blur="saveConfig" style="max-width:400px" />
        <small>Use {{site_name}} and {{order_number}} as placeholders</small>
      </div>
      <div class="config-note" v-if="config.review_requests_enabled === '1'">
        💡 Emails are sent automatically when an order is marked as <strong>completed</strong> or <strong>delivered</strong>. You can also trigger them manually below.
      </div>
    </div>

    <!-- Filter + table -->
    <div class="glass section">
      <div class="filter-bar">
        <input v-model="q" placeholder="Search by email or order…" @input="load" />
        <select v-model="statusFilter" @change="load">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="skipped">Skipped</option>
        </select>
        <button class="btn btn-ghost" @click="load">🔄 Refresh</button>
      </div>

      <table class="admin-table" v-if="requests.length">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Products</th>
            <th>Send After</th>
            <th>Sent At</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rr in requests" :key="rr.id">
            <td><strong>#{{ rr.order_number }}</strong></td>
            <td>
              <div>{{ rr.customer_name || '—' }}</div>
              <div style="font-size:.8rem;color:#888">{{ rr.customer_email }}</div>
            </td>
            <td>
              <span class="pill">{{ productCount(rr) }} product{{ productCount(rr) !== 1 ? 's' : '' }}</span>
            </td>
            <td style="font-size:.85rem;color:#aaa">{{ formatDate(rr.send_after) }}</td>
            <td style="font-size:.85rem;color:#aaa">{{ rr.sent_at ? formatDate(rr.sent_at) : '—' }}</td>
            <td>
              <span class="pill" :class="statusClass(rr.status)">{{ rr.status }}</span>
            </td>
            <td>
              <button
                v-if="rr.status !== 'sent'"
                class="btn btn-sm btn-ghost"
                @click="sendNow(rr)"
                title="Send now"
              >📤 Send</button>
              <button
                v-if="rr.status === 'pending'"
                class="btn btn-sm btn-ghost"
                @click="skipRequest(rr)"
                title="Skip this request"
              >🚫 Skip</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <p v-if="statusFilter || q">No review requests match your filters.</p>
        <p v-else>No review requests queued yet. They'll appear here when orders are marked completed.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const _feedback = ref(null)
const toast = {
  success: (msg) => { _feedback.value = { t: 's', msg }; setTimeout(() => { _feedback.value = null }, 3000) },
  error:   (msg) => { _feedback.value = { t: 'e', msg }; setTimeout(() => { _feedback.value = null }, 4000) },
}
const requests    = ref([])
const stats       = ref(null)
const q           = ref('')
const statusFilter = ref('')

const config = ref({
  review_requests_enabled: '1',
  review_request_delay_days: 7,
  review_request_subject: 'How was your order from {{site_name}}?',
})

async function load() {
  const { data: s } = await api.get('/review-requests/stats')
  stats.value = s

  const { data } = await api.get('/review-requests', {
    params: { q: q.value, status: statusFilter.value, limit: 100 }
  })
  requests.value = data.rows || data
}

async function loadConfig() {
  const { data } = await api.get('/settings')
  config.value = {
    review_requests_enabled:   data.review_requests_enabled   ?? '1',
    review_request_delay_days: data.review_request_delay_days ?? 7,
    review_request_subject:    data.review_request_subject    ?? 'How was your order from {{site_name}}?',
  }
}

async function saveConfig() {
  await api.put('/settings', {
    review_requests_enabled:   config.value.review_requests_enabled,
    review_request_delay_days: String(config.value.review_request_delay_days),
    review_request_subject:    config.value.review_request_subject,
  })
  toast.success('Config saved')
}

async function sendNow(rr) {
  try {
    await api.post(`/review-requests/${rr.id}/send`)
    toast.success('Review request sent!')
    load()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Send failed')
  }
}

async function skipRequest(rr) {
  await api.delete(`/review-requests/${rr.id}`)
  toast.success('Request skipped')
  load()
}

function productCount(rr) {
  try { return JSON.parse(rr.product_ids || '[]').length } catch { return 0 }
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusClass(s) {
  if (s === 'sent') return 'pill-green'
  if (s === 'pending') return 'pill-yellow'
  return 'pill-gray'
}

onMounted(() => { load(); loadConfig() })
</script>

<style scoped>
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1rem 1.5rem; min-width: 120px; }
.stat-card.accent { border-color: var(--accent); }
.stat-value { font-size: 1.6rem; font-weight: 700; color: #e2e2e8; }
.stat-label { font-size: .8rem; color: #888; margin-top: .2rem; }
.config-card { padding: 1.5rem; border-radius: 16px; margin-bottom: 1.5rem; }
.config-card h3 { margin: 0 0 1rem; font-size: 1rem; }
.config-row { display: flex; align-items: center; gap: 1rem; margin-bottom: .9rem; flex-wrap: wrap; }
.config-row label { color: #aaa; font-size: .9rem; min-width: 160px; }
.config-row input[type="text"], .config-row input[type="number"] { padding: .5rem .8rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #e2e2e8; }
.inline-field { display: flex; align-items: center; gap: .5rem; color: #aaa; font-size: .9rem; }
.config-note { background: rgba(255,200,0,0.1); border: 1px solid rgba(255,200,0,0.2); border-radius: 8px; padding: .75rem 1rem; font-size: .85rem; color: #c0a000; margin-top: .5rem; }
.section { padding: 1.5rem; border-radius: 16px; }
.filter-bar { display: flex; gap: .75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.filter-bar input, .filter-bar select { padding: .6rem .9rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #e2e2e8; font-size: .9rem; }
.filter-bar input { flex: 1; min-width: 200px; }
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th { text-align: left; padding: .75rem; color: #888; font-size: .8rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
.admin-table td { padding: .75rem; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: middle; }
.pill { display: inline-block; padding: .2rem .6rem; border-radius: 20px; font-size: .78rem; font-weight: 600; background: rgba(255,255,255,0.08); color: #aaa; }
.pill-green { background: rgba(76,175,80,0.2); color: #4caf50; }
.pill-yellow { background: rgba(255,200,0,0.15); color: #c0a000; }
.pill-gray { background: rgba(255,255,255,0.06); color: #666; }
.empty-state { text-align: center; padding: 3rem; color: #666; }
.toggle-label { display: flex; align-items: center; gap: .6rem; cursor: pointer; color: #e2e2e8; }
.btn-sm { padding: .3rem .6rem; font-size: .8rem; }
</style>
