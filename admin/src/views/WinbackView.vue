<template>
  <div class="winback-view">
    <div class="page-header">
      <div class="header-left">
        <h1>💌 Win-back Campaigns</h1>
        <p class="subtitle">Re-engage lapsed customers with targeted emails and discounts</p>
      </div>
      <button class="btn-primary" @click="openCreate">+ New Campaign</button>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Campaigns</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_sent }}</div>
        <div class="stat-label">Emails Sent</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_conversions }}</div>
        <div class="stat-label">Conversions</div>
      </div>
    </div>

    <!-- Campaign List -->
    <div v-if="campaigns.length" class="campaigns-grid">
      <div v-for="c in campaigns" :key="c.id" class="glass campaign-card">
        <div class="campaign-header">
          <h3>{{ c.name }}</h3>
          <span :class="['status-pill', c.status]">{{ c.status }}</span>
        </div>

        <div class="campaign-meta">
          <span>⏱️ Inactive for <strong>{{ c.days_inactive }}+ days</strong></span>
          <span v-if="c.discount_pct > 0">🎟️ {{ c.discount_pct }}% off</span>
          <span v-if="c.coupon_code">Code: <code>{{ c.coupon_code }}</code></span>
        </div>

        <div class="campaign-stats">
          <div class="cs">
            <div class="cs-val">{{ c.sent_count }}</div>
            <div class="cs-label">Sent</div>
          </div>
          <div class="cs">
            <div class="cs-val">{{ c.open_count }}</div>
            <div class="cs-label">Opened</div>
          </div>
          <div class="cs">
            <div class="cs-val">{{ c.convert_count }}</div>
            <div class="cs-label">Converted</div>
          </div>
          <div class="cs">
            <div class="cs-val">{{ c.sent_count > 0 ? Math.round(c.convert_count / c.sent_count * 100) : 0 }}%</div>
            <div class="cs-label">Conv. Rate</div>
          </div>
        </div>

        <div class="campaign-subject">
          <span class="label">Subject:</span> {{ c.subject }}
        </div>

        <div v-if="c.last_sent_at" class="campaign-last">
          Last sent: {{ fmtDate(c.last_sent_at) }}
        </div>

        <div class="campaign-actions">
          <button class="btn-sm" @click="openPreview(c)">👁️ Preview Audience</button>
          <button class="btn-sm btn-send" @click="confirmSend(c)" :disabled="sending === c.id">
            {{ sending === c.id ? 'Sending…' : '📤 Send Now' }}
          </button>
          <button class="btn-sm btn-edit" @click="openEdit(c)">✏️ Edit</button>
          <button class="btn-sm btn-ghost" @click="deleteCampaign(c.id)">🗑️</button>
        </div>
      </div>
    </div>

    <div v-else class="glass empty-state">
      <div class="empty-icon">💌</div>
      <p>No win-back campaigns yet. Create your first one!</p>
    </div>

    <!-- Create / Edit Modal -->
    <div v-if="editModal" class="modal-backdrop" @click.self="editModal = null">
      <div class="modal-card glass">
        <h2>{{ editMode === 'create' ? 'New Win-back Campaign' : 'Edit Campaign' }}</h2>

        <div class="modal-field">
          <label>Campaign Name</label>
          <input v-model="form.name" class="form-input" type="text" placeholder="Summer Re-engagement" />
        </div>

        <div class="modal-row">
          <div class="modal-field">
            <label>Days Since Last Order</label>
            <input v-model.number="form.days_inactive" class="form-input" type="number" min="7" placeholder="90" />
            <small>Customers who haven't ordered in this many days</small>
          </div>
          <div class="modal-field">
            <label>Discount % (optional)</label>
            <input v-model.number="form.discount_pct" class="form-input" type="number" min="0" max="100" placeholder="15" />
          </div>
        </div>

        <div class="modal-field">
          <label>Coupon Code (optional)</label>
          <input v-model="form.coupon_code" class="form-input" type="text" placeholder="WINBACK15 — or leave blank for auto-generated codes" />
          <small>If blank and discount % &gt; 0, unique codes are generated per customer</small>
        </div>

        <div class="modal-field">
          <label>Email Subject</label>
          <input v-model="form.subject" class="form-input" type="text" placeholder="We miss you, {{first_name}}!" />
          <small>Supports: &#123;&#123;first_name&#125;&#125;, &#123;&#123;site_name&#125;&#125;</small>
        </div>

        <div class="modal-field">
          <label>Email Body (HTML)</label>
          <textarea v-model="form.body" class="form-input" rows="8" placeholder="<p>Hey {{first_name}}, we haven't seen you in a while…</p>&#10;<p>As a thank you, use code {{coupon_code}} for {{discount_pct}} off your next order!</p>"></textarea>
          <small>Supports: &#123;&#123;first_name&#125;&#125;, &#123;&#123;site_name&#125;&#125;, &#123;&#123;coupon_code&#125;&#125;, &#123;&#123;discount_pct&#125;&#125;</small>
        </div>

        <div class="modal-field">
          <label>Status</label>
          <select v-model="form.status" class="form-input">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn-primary" @click="saveModal" :disabled="saving">{{ saving ? 'Saving…' : 'Save Campaign' }}</button>
          <button class="btn-ghost" @click="editModal = null">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Preview Audience Modal -->
    <div v-if="previewModal" class="modal-backdrop" @click.self="previewModal = null">
      <div class="modal-card glass">
        <h2>👁️ Campaign Audience Preview</h2>
        <p style="color:var(--text-muted);margin-bottom:1rem">
          Customers inactive for <strong>{{ previewModal.campaign.days_inactive }}+ days</strong> who haven't received this campaign yet.
        </p>

        <div v-if="previewModal.loading" class="loading">Loading…</div>
        <div v-else>
          <div class="preview-count glass-mini">
            <strong>{{ previewModal.count }}</strong> customer(s) will receive this campaign
          </div>
          <table v-if="previewModal.customers.length" class="preview-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Last Order</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in previewModal.customers" :key="c.id">
                <td>{{ c.first_name }} {{ c.last_name }}</td>
                <td>{{ c.email }}</td>
                <td>{{ c.last_order ? fmtDate(c.last_order) : 'Never' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="previewModal.count > 20" style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem">
            Showing first 20 of {{ previewModal.count }} customers.
          </p>
        </div>

        <div class="modal-actions">
          <button class="btn-primary" @click="confirmSend(previewModal.campaign); previewModal = null">📤 Send to All</button>
          <button class="btn-ghost" @click="previewModal = null">Close</button>
        </div>
      </div>
    </div>

    <!-- Send Confirm Modal -->
    <div v-if="sendConfirm" class="modal-backdrop" @click.self="sendConfirm = null">
      <div class="modal-card glass">
        <h2>📤 Confirm Send</h2>
        <p>You're about to send <strong>{{ sendConfirm.name }}</strong> to all lapsed customers.</p>
        <div class="warning-box" style="margin:1rem 0">
          ⚠️ Emails will be sent immediately via your SMTP settings. This action cannot be undone.
        </div>
        <div class="modal-actions">
          <button class="btn-primary" @click="executeSend(sendConfirm)" :disabled="sending === sendConfirm.id">
            {{ sending === sendConfirm.id ? 'Sending…' : '📤 Send Now' }}
          </button>
          <button class="btn-ghost" @click="sendConfirm = null">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Send Result Toast -->
    <div v-if="sendResult" class="toast-success">
      ✅ {{ sendResult }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const campaigns = ref([])
const stats = ref(null)
const editModal = ref(false)
const editMode = ref('create')
const editingId = ref(null)
const previewModal = ref(null)
const sendConfirm = ref(null)
const saving = ref(false)
const sending = ref(null)
const sendResult = ref(null)

const defaultForm = () => ({
  name: '',
  days_inactive: 90,
  coupon_code: '',
  discount_pct: 0,
  subject: 'We miss you, {{first_name}}!',
  body: `<p>Hey {{first_name}},</p>\n<p>We noticed you haven't visited us in a while, and we miss you!</p>\n<p>Here's a little something to welcome you back:</p>\n{{coupon_code}}\n<p>Come back and see what's new in our store.</p>`,
  status: 'draft',
})

const form = ref(defaultForm())

async function loadCampaigns () {
  campaigns.value = await api.get('/winback')
}

async function loadStats () {
  stats.value = await api.get('/winback/stats')
}

function openCreate () {
  form.value = defaultForm()
  editMode.value = 'create'
  editingId.value = null
  editModal.value = true
}

function openEdit (c) {
  form.value = { ...c }
  editMode.value = 'edit'
  editingId.value = c.id
  editModal.value = true
}

async function saveModal () {
  saving.value = true
  try {
    if (editMode.value === 'create') {
      await api.post('/winback', form.value)
    } else {
      await api.put(`/winback/${editingId.value}`, form.value)
    }
    editModal.value = null
    await loadCampaigns()
    await loadStats()
  } finally {
    saving.value = false
  }
}

async function openPreview (campaign) {
  previewModal.value = { campaign, loading: true, count: 0, customers: [] }
  const data = await api.get(`/winback/${campaign.id}/preview`)
  previewModal.value.count = data.count
  previewModal.value.customers = data.customers
  previewModal.value.loading = false
}

function confirmSend (campaign) {
  sendConfirm.value = campaign
}

async function executeSend (campaign) {
  sending.value = campaign.id
  try {
    const result = await api.post(`/winback/${campaign.id}/send`, {})
    sendConfirm.value = null
    sendResult.value = result.message || `Sent to ${result.sent} customers`
    setTimeout(() => { sendResult.value = null }, 4000)
    await loadCampaigns()
    await loadStats()
  } finally {
    sending.value = null
  }
}

async function deleteCampaign (id) {
  if (!confirm('Delete this campaign?')) return
  await api.delete(`/winback/${id}`)
  await loadCampaigns()
  await loadStats()
}

function fmtDate (d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(() => {
  loadCampaigns()
  loadStats()
})
</script>

<style scoped>
.winback-view { padding: 1.5rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; }
.subtitle { color: var(--text-muted); margin-top: 0.25rem; }
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: var(--surface); border-radius: 1rem; padding: 1rem 1.5rem; text-align: center; flex: 1; min-width: 120px; }
.stat-card.accent { border: 1px solid var(--accent); }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }
.campaigns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.5rem; }
.glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(16px); border-radius: 1rem; }
.glass-mini { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 1rem; }
.campaign-card { padding: 1.5rem; }
.campaign-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.campaign-header h3 { margin: 0; font-size: 1rem; }
.status-pill { padding: 0.2rem 0.75rem; border-radius: 99px; font-size: 0.8rem; text-transform: capitalize; }
.status-pill.draft  { background: rgba(148,163,184,0.15); color: #94a3b8; }
.status-pill.active { background: rgba(34,197,94,0.15); color: #4ade80; }
.campaign-meta { display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem; flex-wrap: wrap; }
.campaign-meta code { background: rgba(255,255,255,0.1); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.82rem; }
.campaign-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.5rem; margin-bottom: 1rem; }
.cs { text-align: center; background: rgba(255,255,255,0.03); border-radius: 0.5rem; padding: 0.5rem; }
.cs-val { font-weight: 700; font-size: 1.1rem; }
.cs-label { font-size: 0.75rem; color: var(--text-muted); }
.campaign-subject { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
.campaign-subject .label { font-weight: 600; }
.campaign-last { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; }
.campaign-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.btn-sm { padding: 0.3rem 0.75rem; font-size: 0.82rem; border-radius: 0.5rem; cursor: pointer; background: var(--surface); border: 1px solid rgba(255,255,255,0.15); color: inherit; }
.btn-sm.btn-send { background: var(--accent); color: #fff; border: none; }
.btn-sm.btn-edit { background: rgba(59,130,246,0.15); color: #60a5fa; border-color: rgba(59,130,246,0.3); }
.btn-sm.btn-ghost { background: transparent; border-color: rgba(255,255,255,0.1); color: var(--text-muted); }
.empty-state { padding: 3rem; text-align: center; color: var(--text-muted); }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { width: 100%; max-width: 600px; padding: 2rem; border-radius: 1.5rem; max-height: 90vh; overflow-y: auto; }
.modal-card h2 { margin-bottom: 1.5rem; }
.modal-field { margin-bottom: 1rem; }
.modal-field label { display: block; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.4rem; }
.modal-field small { display: block; font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem; }
.modal-field .form-input { width: 100%; box-sizing: border-box; }
.modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
.btn-primary { background: var(--accent); color: #fff; padding: 0.6rem 1.5rem; border: none; border-radius: 0.75rem; cursor: pointer; font-weight: 600; }
.btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); padding: 0.6rem 1.5rem; border-radius: 0.75rem; cursor: pointer; color: var(--text-muted); }
.preview-count { text-align: center; font-size: 1.1rem; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.preview-table th, .preview-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
.preview-table th { color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase; }
.warning-box { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #fbbf24; font-size: 0.88rem; }
.loading { color: var(--text-muted); text-align: center; padding: 2rem; }
.toast-success { position: fixed; bottom: 2rem; right: 2rem; background: rgba(34,197,94,0.9); color: #fff; padding: 1rem 1.5rem; border-radius: 1rem; font-weight: 600; z-index: 2000; backdrop-filter: blur(8px); }
</style>
