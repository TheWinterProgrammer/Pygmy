<template>
  <div class="newsletter-view">
    <!-- Header -->
    <div class="view-header">
      <div>
        <h1>📨 Newsletter</h1>
        <p class="subtitle" v-if="stats">
          {{ stats.active }} active · {{ stats.unsubscribed }} unsubscribed · {{ stats.campaigns }} campaigns sent
        </p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="exportCSV">⬇️ Export CSV</button>
        <button class="btn btn-primary" @click="showCompose = true">✉️ Send Newsletter</button>
      </div>
    </div>

    <!-- Compose Modal -->
    <div class="modal-overlay" v-if="showCompose" @click.self="showCompose = false">
      <div class="modal glass">
        <h2 style="margin-bottom:1.5rem;">✉️ Send Newsletter</h2>

        <div class="form-group">
          <label>Subject</label>
          <input v-model="compose.subject" class="input" placeholder="Your newsletter subject…" />
        </div>
        <div class="form-group">
          <label>Message</label>
          <textarea v-model="compose.content" class="input" rows="10"
            placeholder="Write your newsletter content here. HTML is supported."></textarea>
          <small style="color:var(--muted);font-size:0.75rem">
            An unsubscribe link will be automatically appended to every email.
          </small>
        </div>

        <div class="send-preview glass" v-if="stats">
          <span>📬 Will be sent to <strong>{{ stats.active }}</strong> active subscriber{{ stats.active !== 1 ? 's' : '' }}</span>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showCompose = false">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="sending || !compose.subject.trim() || !compose.content.trim()"
            @click="sendCampaign"
          >
            {{ sending ? 'Sending…' : `Send to ${stats?.active ?? '…'} subscribers` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="['tab', { active: tab === 'subscribers' }]" @click="tab = 'subscribers'">
        Subscribers
        <span class="tab-badge">{{ stats?.total ?? 0 }}</span>
      </button>
      <button :class="['tab', { active: tab === 'campaigns' }]" @click="tab = 'campaigns'">
        Campaigns
        <span class="tab-badge">{{ stats?.campaigns ?? 0 }}</span>
      </button>
    </div>

    <!-- Subscribers tab -->
    <div v-if="tab === 'subscribers'">
      <!-- Filters -->
      <div class="filters glass">
        <input
          v-model="search"
          class="input filter-input"
          placeholder="Search by email or name…"
          @input="loadSubscribers"
        />
        <select v-model="statusFilter" @change="loadSubscribers" class="select filter-select">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
      </div>

      <!-- Table -->
      <div class="glass table-card">
        <div class="empty" v-if="!loading && subscribers.length === 0">
          No subscribers found.
          <span v-if="!search && !statusFilter">
            Add a newsletter subscribe form to your public site to collect emails.
          </span>
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Status</th>
              <th>Subscribed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sub in subscribers" :key="sub.id">
              <td class="email-cell">{{ sub.email }}</td>
              <td>{{ sub.name || '—' }}</td>
              <td>
                <span :class="['badge', sub.status === 'active' ? 'badge-active' : 'badge-unsub']">
                  {{ sub.status === 'active' ? '✅ Active' : '🚫 Unsubscribed' }}
                </span>
              </td>
              <td class="date-cell">{{ fmtDate(sub.subscribed_at) }}</td>
              <td class="actions-cell">
                <button
                  v-if="sub.status === 'active'"
                  class="btn btn-ghost btn-xs"
                  @click="updateStatus(sub, 'unsubscribed')"
                  title="Unsubscribe"
                >Unsub</button>
                <button
                  v-else
                  class="btn btn-ghost btn-xs"
                  @click="updateStatus(sub, 'active')"
                  title="Re-activate"
                >Reactivate</button>
                <button class="btn btn-danger btn-xs" @click="deleteSubscriber(sub)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Campaigns tab -->
    <div v-if="tab === 'campaigns'">
      <div class="glass table-card">
        <div class="empty" v-if="!loading && campaigns.length === 0">
          No campaigns sent yet. Write your first newsletter above!
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Recipients</th>
              <th>Sent at</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in campaigns" :key="c.id">
              <td><strong>{{ c.subject }}</strong></td>
              <td class="num-cell">{{ c.sent_to }}</td>
              <td class="date-cell">{{ fmtDate(c.sent_at) }}</td>
              <td>
                <button class="btn btn-ghost btn-xs" @click="previewCampaign = c">👁️ View</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Campaign preview modal -->
    <div class="modal-overlay" v-if="previewCampaign" @click.self="previewCampaign = null">
      <div class="modal glass">
        <h2 style="margin-bottom:0.5rem">{{ previewCampaign.subject }}</h2>
        <p style="color:var(--muted);font-size:0.82rem;margin-bottom:1.25rem">
          Sent to {{ previewCampaign.sent_to }} subscribers on {{ fmtDate(previewCampaign.sent_at) }}
        </p>
        <div class="preview-content">{{ previewCampaign.content }}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="previewCampaign = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'

const auth = useAuthStore()
const toast = useToastStore()

const BASE = 'http://localhost:3200'

const tab = ref('subscribers')
const subscribers = ref([])
const campaigns = ref([])
const stats = ref(null)
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const showCompose = ref(false)
const sending = ref(false)
const previewCampaign = ref(null)

const compose = ref({ subject: '', content: '' })

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
      ...(opts.headers || {}),
    },
  })
  return res.json()
}

async function loadStats() {
  stats.value = await api('/api/newsletter/stats')
}

async function loadSubscribers() {
  loading.value = true
  const q = new URLSearchParams()
  if (search.value) q.set('q', search.value)
  if (statusFilter.value) q.set('status', statusFilter.value)
  const data = await api(`/api/newsletter/subscribers?${q}`)
  subscribers.value = data.subscribers || []
  loading.value = false
}

async function loadCampaigns() {
  const data = await api('/api/newsletter/campaigns')
  campaigns.value = Array.isArray(data) ? data : []
}

async function updateStatus(sub, status) {
  await api(`/api/newsletter/subscribers/${sub.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  toast.success(`Subscriber ${status === 'active' ? 'reactivated' : 'unsubscribed'}`)
  sub.status = status
  loadStats()
}

async function deleteSubscriber(sub) {
  if (!confirm(`Remove ${sub.email} permanently?`)) return
  await api(`/api/newsletter/subscribers/${sub.id}`, { method: 'DELETE' })
  subscribers.value = subscribers.value.filter(s => s.id !== sub.id)
  toast.success('Subscriber removed')
  loadStats()
}

async function sendCampaign() {
  if (!compose.value.subject.trim() || !compose.value.content.trim()) return
  sending.value = true
  const res = await api('/api/newsletter/send', {
    method: 'POST',
    body: JSON.stringify(compose.value),
  })
  sending.value = false
  if (res.error) {
    toast.error(res.error)
    return
  }
  toast.success(`Campaign sent to ${res.sent_to} subscribers!`)
  showCompose.value = false
  compose.value = { subject: '', content: '' }
  loadStats()
  loadCampaigns()
}

function exportCSV() {
  const url = `${BASE}/api/backup/export/csv?type=subscribers`
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('Authorization', `Bearer ${auth.token}`)
  // Use fetch to download with auth
  fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } })
    .then(r => r.blob())
    .then(blob => {
      const burl = URL.createObjectURL(blob)
      link.href = burl
      link.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(burl)
    })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(async () => {
  await Promise.all([loadStats(), loadSubscribers(), loadCampaigns()])
})
</script>

<style scoped>
.newsletter-view { padding: 2rem; max-width: 1100px; }

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}
.view-header h1 { margin: 0 0 0.25rem; font-size: 1.6rem; }
.subtitle { margin: 0; color: var(--muted); font-size: 0.85rem; }

.header-actions { display: flex; gap: 0.5rem; align-items: center; }

/* Tabs */
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
.tab {
  padding: 0.45rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.88rem;
  display: flex; align-items: center; gap: 0.5rem;
  transition: all 0.2s;
}
.tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.tab-badge {
  background: rgba(255,255,255,0.15);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
  font-size: 0.75rem;
}

/* Filters */
.filters {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  align-items: center;
}
.filter-input { flex: 1; }
.filter-select { width: 180px; }

/* Table */
.table-card { border-radius: 1rem; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
}
.data-table td {
  padding: 0.7rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 0.88rem;
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: rgba(255,255,255,0.03); }

.email-cell { font-weight: 500; }
.date-cell { color: var(--muted); font-size: 0.82rem; }
.num-cell { text-align: right; color: var(--accent); font-weight: 600; }
.actions-cell { display: flex; gap: 0.35rem; align-items: center; }

/* Badges */
.badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.badge-active { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.badge-unsub { background: rgba(248, 113, 113, 0.15); color: #f87171; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  padding: 1rem;
}
.modal {
  width: 100%;
  max-width: 640px;
  border-radius: 1.25rem;
  padding: 2rem;
  max-height: 90vh;
  overflow-y: auto;
}
.modal h2 { font-size: 1.3rem; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 0.35rem; }

.send-preview {
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.88rem;
  margin-bottom: 1.25rem;
}

.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }

.empty { padding: 2.5rem 1.5rem; color: var(--muted); font-size: 0.88rem; }

/* Campaign preview */
.preview-content {
  background: rgba(255,255,255,0.04);
  border-radius: 0.5rem;
  padding: 1rem;
  white-space: pre-wrap;
  font-size: 0.88rem;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
}

/* Buttons */
.btn-xs { padding: 0.2rem 0.55rem; font-size: 0.75rem; }
.btn-danger { background: rgba(248,113,113,0.15); color: #f87171; border-color: rgba(248,113,113,0.3); }
.btn-danger:hover { background: rgba(248,113,113,0.3); }
</style>
