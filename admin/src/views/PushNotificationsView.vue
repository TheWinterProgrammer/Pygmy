<template>
  <div class="push-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1>🔔 Web Push Notifications</h1>
        <p class="subtitle">Send browser push notifications to your subscribers</p>
      </div>
      <button class="btn-primary" @click="openCreate">+ New Campaign</button>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.subscribers }}</div>
        <div class="stat-label">Active Subscribers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_campaigns }}</div>
        <div class="stat-label">Total Campaigns</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.sent_campaigns }}</div>
        <div class="stat-label">Sent</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_sent }}</div>
        <div class="stat-label">Notifications Sent</div>
      </div>
    </div>

    <!-- VAPID Setup Banner -->
    <div v-if="!vapidConfigured" class="setup-banner">
      <div class="setup-icon">🔑</div>
      <div class="setup-body">
        <strong>VAPID Keys Required</strong>
        <p>Web Push requires VAPID keys to work. Generate them once — they'll be stored in your settings.</p>
      </div>
      <button class="btn-accent" @click="generateVapid" :disabled="generatingVapid">
        {{ generatingVapid ? 'Generating…' : 'Generate VAPID Keys' }}
      </button>
    </div>

    <!-- Campaigns Table -->
    <div class="glass-card">
      <div class="card-header">
        <h2>Campaigns</h2>
      </div>
      <div v-if="loading" class="loading-state">Loading campaigns…</div>
      <div v-else-if="!campaigns.length" class="empty-state">
        <div class="empty-icon">📢</div>
        <p>No campaigns yet. Create your first push notification!</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Body</th>
            <th>Status</th>
            <th>Sent</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in campaigns" :key="c.id">
            <td class="fw-600">{{ c.title }}</td>
            <td class="text-muted ellipsis" style="max-width:220px">{{ c.body }}</td>
            <td>
              <span :class="['status-pill', `status-${c.status}`]">{{ c.status }}</span>
            </td>
            <td>
              <span v-if="c.status === 'sent'">✅ {{ c.sent_count }} / ❌ {{ c.fail_count }}</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="text-muted text-sm">{{ fmtDate(c.created_at) }}</td>
            <td>
              <div class="action-btns">
                <button v-if="c.status !== 'sent'" class="btn-sm btn-ghost" @click="openEdit(c)" title="Edit">✏️</button>
                <button v-if="c.status !== 'sent'" class="btn-sm btn-accent" @click="confirmSend(c)" :disabled="sendingId === c.id" title="Send Now">
                  {{ sendingId === c.id ? '…' : '📤 Send' }}
                </button>
                <button class="btn-sm btn-danger" @click="confirmDelete(c)" title="Delete">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Subscribers Card -->
    <div class="glass-card mt-1">
      <div class="card-header">
        <h2>Active Subscribers <span class="badge-count">{{ stats?.subscribers || 0 }}</span></h2>
        <button class="btn-sm btn-ghost" @click="loadSubscribers">↻ Refresh</button>
      </div>
      <div v-if="subscribers.length === 0" class="empty-note">No subscribers yet. Add the push prompt to your frontend to start collecting.</div>
      <div v-else class="subscriber-list">
        <div v-for="s in subscribers.slice(0, 20)" :key="s.id" class="subscriber-row">
          <span class="sub-endpoint">{{ truncateEndpoint(s.endpoint) }}</span>
          <span class="text-muted text-sm">{{ s.page_path }}</span>
          <span class="text-muted text-sm">{{ fmtDate(s.created_at) }}</span>
        </div>
        <div v-if="subscribers.length > 20" class="text-muted text-sm mt-05">
          … and {{ subscribers.length - 20 }} more
        </div>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ editingCampaign ? 'Edit Campaign' : 'New Campaign' }}</h3>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <!-- Preview -->
          <div class="push-preview">
            <div class="push-preview-card">
              <div class="push-preview-icon">
                <img v-if="form.icon" :src="form.icon" alt="" />
                <div v-else class="push-icon-placeholder">🔔</div>
              </div>
              <div class="push-preview-text">
                <div class="push-preview-title">{{ form.title || 'Notification Title' }}</div>
                <div class="push-preview-body">{{ form.body || 'Notification message goes here…' }}</div>
              </div>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group full-width">
              <label>Title <span class="required">*</span></label>
              <input v-model="form.title" placeholder="Notification title" class="form-input" />
            </div>
            <div class="form-group full-width">
              <label>Message <span class="required">*</span></label>
              <textarea v-model="form.body" placeholder="Notification body text…" rows="3" class="form-input" />
            </div>
            <div class="form-group">
              <label>Click URL</label>
              <input v-model="form.url" placeholder="https://yoursite.com/page" class="form-input" />
            </div>
            <div class="form-group">
              <label>Icon URL</label>
              <input v-model="form.icon" placeholder="/logo.png" class="form-input" />
            </div>
            <div class="form-group">
              <label>Image URL (large banner)</label>
              <input v-model="form.image" placeholder="https://…/banner.jpg" class="form-input" />
            </div>
            <div class="form-group">
              <label>Schedule At (optional)</label>
              <input v-model="form.schedule_at" type="datetime-local" class="form-input" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="closeModal">Cancel</button>
          <button class="btn-primary" @click="saveCampaign" :disabled="saving">
            {{ saving ? 'Saving…' : (editingCampaign ? 'Save Changes' : 'Create Campaign') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Send Confirm Modal -->
    <div v-if="sendConfirmCampaign" class="modal-overlay" @click.self="sendConfirmCampaign = null">
      <div class="modal-card modal-sm">
        <div class="modal-header">
          <h3>📤 Send Campaign</h3>
          <button class="modal-close" @click="sendConfirmCampaign = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Send <strong>{{ sendConfirmCampaign.title }}</strong> to all <strong>{{ stats?.subscribers || 0 }}</strong> active subscribers?</p>
          <p class="text-muted text-sm">This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="sendConfirmCampaign = null">Cancel</button>
          <button class="btn-accent" @click="sendCampaign(sendConfirmCampaign)" :disabled="!!sendingId">
            {{ sendingId ? 'Sending…' : '📤 Send Now' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-card modal-sm">
        <div class="modal-header">
          <h3>Delete Campaign</h3>
          <button class="modal-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Delete <strong>{{ deleteTarget.title }}</strong>? This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn-danger" @click="deleteCampaign">Delete</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" :class="['toast', toast.type]">{{ toast.msg }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API = 'http://localhost:3200'
const token = () => localStorage.getItem('pygmy_token')
const authH = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

const stats = ref(null)
const campaigns = ref([])
const subscribers = ref([])
const loading = ref(true)
const vapidConfigured = ref(false)
const generatingVapid = ref(false)
const showModal = ref(false)
const editingCampaign = ref(null)
const saving = ref(false)
const sendingId = ref(null)
const sendConfirmCampaign = ref(null)
const deleteTarget = ref(null)
const toast = ref(null)

const form = ref({ title: '', body: '', url: '', icon: '', image: '', schedule_at: '' })

function showToast (msg, type = 'success') {
  toast.value = { msg, type }
  setTimeout(() => { toast.value = null }, 3500)
}

async function loadAll () {
  loading.value = true
  try {
    const [statsRes, campRes, subRes, vapidRes] = await Promise.all([
      fetch(`${API}/api/push/stats`, { headers: authH() }),
      fetch(`${API}/api/push/campaigns`, { headers: authH() }),
      fetch(`${API}/api/push/subscriptions`, { headers: authH() }),
      fetch(`${API}/api/push/vapid-public`).catch(() => null),
    ])
    stats.value = await statsRes.json()
    campaigns.value = await campRes.json()
    const subData = await subRes.json()
    subscribers.value = subData.subscriptions || []
    vapidConfigured.value = vapidRes && vapidRes.ok
  } catch (e) { console.error(e) }
  loading.value = false
}

async function loadSubscribers () {
  const r = await fetch(`${API}/api/push/subscriptions`, { headers: authH() })
  const d = await r.json()
  subscribers.value = d.subscriptions || []
  if (stats.value) stats.value.subscribers = d.total
}

async function generateVapid () {
  generatingVapid.value = true
  try {
    const r = await fetch(`${API}/api/push/generate-vapid`, { method: 'POST', headers: authH() })
    const d = await r.json()
    if (r.ok) {
      vapidConfigured.value = true
      showToast('VAPID keys generated! Share the public key with your service worker.')
    } else showToast(d.error || 'Failed', 'error')
  } catch { showToast('Network error', 'error') }
  generatingVapid.value = false
}

function openCreate () {
  editingCampaign.value = null
  form.value = { title: '', body: '', url: '', icon: '', image: '', schedule_at: '' }
  showModal.value = true
}

function openEdit (c) {
  editingCampaign.value = c
  form.value = {
    title:       c.title,
    body:        c.body,
    url:         c.url         || '',
    icon:        c.icon        || '',
    image:       c.image       || '',
    schedule_at: c.schedule_at || '',
  }
  showModal.value = true
}

function closeModal () { showModal.value = false }

async function saveCampaign () {
  if (!form.value.title.trim() || !form.value.body.trim()) {
    showToast('Title and body are required', 'error'); return
  }
  saving.value = true
  const payload = {
    title:       form.value.title.trim(),
    body:        form.value.body.trim(),
    url:         form.value.url || null,
    icon:        form.value.icon || null,
    image:       form.value.image || null,
    schedule_at: form.value.schedule_at || null,
  }
  const url    = editingCampaign.value
    ? `${API}/api/push/campaigns/${editingCampaign.value.id}`
    : `${API}/api/push/campaigns`
  const method = editingCampaign.value ? 'PUT' : 'POST'
  const r = await fetch(url, { method, headers: authH(), body: JSON.stringify(payload) })
  const d = await r.json()
  if (r.ok) {
    showToast(editingCampaign.value ? 'Campaign updated' : 'Campaign created')
    closeModal()
    await loadAll()
  } else showToast(d.error || 'Failed to save', 'error')
  saving.value = false
}

function confirmSend (c) { sendConfirmCampaign.value = c }

async function sendCampaign (c) {
  sendingId.value = c.id
  try {
    const r = await fetch(`${API}/api/push/campaigns/${c.id}/send`, { method: 'POST', headers: authH() })
    const d = await r.json()
    if (r.ok) {
      showToast(`Sent to ${d.sent} subscribers! (${d.failed} failed)`)
      sendConfirmCampaign.value = null
      await loadAll()
    } else showToast(d.error || 'Send failed', 'error')
  } catch { showToast('Network error', 'error') }
  sendingId.value = null
}

function confirmDelete (c) { deleteTarget.value = c }

async function deleteCampaign () {
  const r = await fetch(`${API}/api/push/campaigns/${deleteTarget.value.id}`, { method: 'DELETE', headers: authH() })
  if (r.ok) {
    showToast('Campaign deleted')
    deleteTarget.value = null
    await loadAll()
  } else showToast('Delete failed', 'error')
}

function fmtDate (d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncateEndpoint (ep) {
  if (!ep) return '—'
  const parts = ep.split('/')
  return '…/' + parts[parts.length - 1].substring(0, 32) + (parts[parts.length - 1].length > 32 ? '…' : '')
}

onMounted(loadAll)
</script>

<style scoped>
.push-view { display:flex; flex-direction:column; gap:1.5rem; }
.page-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; }
.page-header h1 { margin:0; font-size:1.6rem; }
.subtitle { color:var(--text-muted); font-size:0.9rem; margin:0.2rem 0 0; }

.stats-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; }
@media(max-width:600px){ .stats-strip { grid-template-columns:repeat(2,1fr); } }
.stat-card { background:var(--surface); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem 1.5rem; text-align:center; }
.stat-value { font-size:2rem; font-weight:700; color:var(--accent); }
.stat-label { font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem; }

.setup-banner { background:rgba(255,200,50,0.08); border:1px solid rgba(255,200,50,0.3); border-radius:1rem; padding:1.25rem 1.5rem; display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
.setup-icon { font-size:2rem; }
.setup-body { flex:1; }
.setup-body strong { display:block; margin-bottom:0.25rem; }
.setup-body p { margin:0; color:var(--text-muted); font-size:0.9rem; }

.glass-card { background:var(--surface); border:1px solid rgba(255,255,255,0.08); border-radius:1.25rem; padding:1.5rem; }
.mt-1 { margin-top:0; }
.card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; }
.card-header h2 { margin:0; font-size:1.1rem; display:flex; align-items:center; gap:0.5rem; }
.badge-count { background:var(--accent); color:#fff; border-radius:999px; padding:0.1rem 0.5rem; font-size:0.75rem; }

.data-table { width:100%; border-collapse:collapse; font-size:0.9rem; }
.data-table th { text-align:left; color:var(--text-muted); padding:0.5rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.07); font-weight:600; font-size:0.8rem; text-transform:uppercase; }
.data-table td { padding:0.75rem; border-bottom:1px solid rgba(255,255,255,0.05); vertical-align:middle; }
.data-table tr:hover td { background:rgba(255,255,255,0.02); }
.fw-600 { font-weight:600; }
.ellipsis { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.status-pill { display:inline-block; padding:0.2rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:600; text-transform:capitalize; }
.status-draft     { background:rgba(255,255,255,0.1); color:var(--text-muted); }
.status-scheduled { background:rgba(255,170,50,0.15); color:#ffa832; }
.status-sent      { background:rgba(50,220,100,0.15); color:#32dc64; }

.action-btns { display:flex; gap:0.4rem; flex-wrap:wrap; }

.empty-state { text-align:center; padding:3rem; color:var(--text-muted); }
.empty-icon { font-size:2.5rem; margin-bottom:0.75rem; }
.empty-note { color:var(--text-muted); font-size:0.9rem; padding:1rem 0; }

.loading-state { padding:2rem; text-align:center; color:var(--text-muted); }

.subscriber-list { display:flex; flex-direction:column; gap:0.5rem; max-height:260px; overflow-y:auto; }
.subscriber-row { display:flex; align-items:center; gap:1rem; padding:0.5rem 0.75rem; background:rgba(255,255,255,0.03); border-radius:0.5rem; font-size:0.85rem; }
.sub-endpoint { flex:1; font-family:monospace; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mt-05 { margin-top:0.5rem; }

/* Modal */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:200; padding:1rem; }
.modal-card { background:var(--surface); border:1px solid rgba(255,255,255,0.1); border-radius:1.5rem; width:100%; max-width:580px; max-height:90vh; overflow-y:auto; }
.modal-sm { max-width:420px; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid rgba(255,255,255,0.07); }
.modal-header h3 { margin:0; font-size:1.1rem; }
.modal-close { background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem; padding:0.25rem 0.5rem; }
.modal-body { padding:1.5rem; }
.modal-footer { display:flex; justify-content:flex-end; gap:0.75rem; padding:1.25rem 1.5rem; border-top:1px solid rgba(255,255,255,0.07); }

/* Push Preview */
.push-preview { margin-bottom:1.25rem; }
.push-preview-card { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; padding:0.75rem 1rem; display:flex; align-items:flex-start; gap:0.75rem; }
.push-preview-icon { width:40px; height:40px; border-radius:50%; overflow:hidden; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.push-preview-icon img { width:100%; height:100%; object-fit:cover; }
.push-icon-placeholder { font-size:1.25rem; }
.push-preview-title { font-weight:700; font-size:0.9rem; margin-bottom:0.25rem; }
.push-preview-body { font-size:0.8rem; color:var(--text-muted); }

.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.form-group { display:flex; flex-direction:column; gap:0.4rem; }
.full-width { grid-column:1/-1; }
.form-group label { font-size:0.85rem; font-weight:600; color:var(--text-muted); }
.form-input { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:0.5rem; color:#fff; padding:0.6rem 0.9rem; font-size:0.9rem; font-family:Poppins,sans-serif; width:100%; box-sizing:border-box; transition:border-color 0.2s; }
.form-input:focus { outline:none; border-color:var(--accent); }
.required { color:var(--accent); }

/* Buttons */
.btn-primary { background:var(--accent); border:none; border-radius:0.6rem; color:#fff; cursor:pointer; font-family:Poppins,sans-serif; font-size:0.9rem; font-weight:600; padding:0.65rem 1.25rem; transition:opacity 0.2s; }
.btn-primary:hover { opacity:0.85; }
.btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
.btn-accent { background:linear-gradient(135deg,#e8485a,#c42b3c); border:none; border-radius:0.6rem; color:#fff; cursor:pointer; font-family:Poppins,sans-serif; font-size:0.9rem; font-weight:600; padding:0.65rem 1.25rem; transition:opacity 0.2s; }
.btn-accent:hover { opacity:0.85; }
.btn-accent:disabled { opacity:0.5; cursor:not-allowed; }
.btn-ghost { background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:0.6rem; color:var(--text-muted); cursor:pointer; font-family:Poppins,sans-serif; font-size:0.9rem; padding:0.65rem 1.25rem; transition:all 0.2s; }
.btn-ghost:hover { background:rgba(255,255,255,0.12); color:#fff; }
.btn-danger { background:rgba(220,50,50,0.2); border:1px solid rgba(220,50,50,0.3); border-radius:0.6rem; color:#ff6b6b; cursor:pointer; font-family:Poppins,sans-serif; font-size:0.9rem; padding:0.65rem 1.25rem; }
.btn-danger:hover { background:rgba(220,50,50,0.35); }
.btn-sm { border-radius:0.4rem; cursor:pointer; font-size:0.8rem; padding:0.3rem 0.6rem; font-family:Poppins,sans-serif; }

.text-muted { color:var(--text-muted); }
.text-sm { font-size:0.8rem; }

/* Toast */
.toast { position:fixed; bottom:2rem; right:2rem; padding:0.9rem 1.5rem; border-radius:0.75rem; font-weight:600; font-size:0.9rem; z-index:999; box-shadow:0 8px 32px rgba(0,0,0,0.4); }
.toast.success { background:rgba(50,200,100,0.15); border:1px solid rgba(50,200,100,0.4); color:#32dc64; }
.toast.error   { background:rgba(220,50,50,0.15);  border:1px solid rgba(220,50,50,0.4);  color:#ff6b6b; }
</style>
