<template>
  <div class="coupon-campaigns-view">
    <div class="page-header">
      <h1>🎟️ Coupon Campaigns</h1>
      <button class="btn btn-primary" @click="openCreate">➕ New Campaign</button>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip">
      <div class="stat-card">
        <div class="stat-value">{{ campaigns.length }}</div>
        <div class="stat-label">Total Campaigns</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ campaigns.filter(c => c.active).length }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ totalCodes }}</div>
        <div class="stat-label">Total Codes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ totalUsed }}</div>
        <div class="stat-label">Codes Used</div>
      </div>
    </div>

    <!-- Campaigns Table -->
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Discount</th>
              <th>Codes</th>
              <th>Used</th>
              <th>Expiry</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in campaigns" :key="c.id">
              <td>
                <div class="campaign-name">{{ c.name }}</div>
                <small class="muted" v-if="c.description">{{ c.description }}</small>
                <div class="prefix-badge" v-if="c.prefix">Prefix: {{ c.prefix }}</div>
              </td>
              <td>
                <span class="discount-badge">
                  {{ c.discount_type === 'percentage' ? c.discount_value + '%' : '€' + c.discount_value }} off
                </span>
              </td>
              <td><strong>{{ c.total_codes || 0 }}</strong></td>
              <td>
                <span :class="['used-count', c.used_codes > 0 && 'has-used']">{{ c.used_codes || 0 }}</span>
              </td>
              <td>
                <small class="muted">{{ c.expires_at ? formatDate(c.expires_at) : 'Never' }}</small>
              </td>
              <td>
                <span :class="['status-pill', c.active ? 'active' : 'inactive']">
                  {{ c.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="actions">
                <button class="btn btn-sm" @click="viewCodes(c)" title="View Codes">📋</button>
                <button class="btn btn-sm" @click="viewStats(c)" title="Stats">📊</button>
                <button class="btn btn-sm" @click="exportCodes(c)" title="Export CSV">⬇️</button>
                <button class="btn btn-sm" @click="openEdit(c)" title="Edit">✏️</button>
                <button class="btn btn-sm btn-danger" @click="deleteCampaign(c.id)" title="Delete">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!campaigns.length" class="empty">
          <div class="empty-icon">🎟️</div>
          <div>No campaigns yet. Create a campaign to bulk-generate discount codes for marketing.</div>
        </div>
      </div>
    </div>

    <!-- ── Create/Edit Modal ── -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingCampaign ? 'Edit Campaign' : 'New Coupon Campaign' }}</h3>
          <button class="btn-close" @click="showModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Campaign Name *</label>
            <input v-model="form.name" class="input" placeholder="e.g. Black Friday 2026" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <input v-model="form.description" class="input" placeholder="Optional internal note" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Discount Type</label>
              <select v-model="form.discount_type" class="input select" :disabled="!!editingCampaign">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (€)</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
            </div>
            <div class="form-group">
              <label>Discount Value</label>
              <input v-model.number="form.discount_value" type="number" class="input" min="1" :disabled="!!editingCampaign" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Expiry Date</label>
              <input v-model="form.expires_at" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>Min Order Amount (€)</label>
              <input v-model.number="form.min_order_amount" type="number" class="input" min="0" :disabled="!!editingCampaign" />
            </div>
          </div>

          <div class="form-grid" v-if="!editingCampaign">
            <div class="form-group">
              <label>Code Prefix (optional)</label>
              <input v-model="form.prefix" class="input" placeholder="BF26" maxlength="10" />
            </div>
            <div class="form-group">
              <label>Max Uses Per Code</label>
              <input v-model.number="form.max_uses_per_code" type="number" class="input" min="1" />
            </div>
          </div>

          <div class="form-grid" v-if="!editingCampaign">
            <div class="form-group">
              <label>Number of Codes to Generate</label>
              <input v-model.number="form.code_count" type="number" class="input" min="1" max="5000" />
              <small class="muted">Max 5,000 codes per campaign</small>
            </div>
            <div class="form-group">
              <label>Code Length (characters)</label>
              <input v-model.number="form.code_length" type="number" class="input" min="4" max="20" />
            </div>
          </div>

          <div class="form-group">
            <label class="toggle-row">
              <input type="checkbox" v-model="form.active" />
              <span>Active</span>
            </label>
          </div>

          <div v-if="!editingCampaign" class="info-box">
            💡 Codes will be generated in the format:
            <strong>{{ form.prefix ? form.prefix.toUpperCase() + '-XXXXXXXX' : 'XXXXXXXX' }}</strong>
          </div>

          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveCampaign" :disabled="saving">
            {{ saving ? (editingCampaign ? 'Saving…' : 'Generating…') : (editingCampaign ? 'Save Changes' : 'Generate Codes') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Codes Modal ── -->
    <div v-if="showCodes" class="modal-overlay" @click.self="showCodes = false">
      <div class="modal large">
        <div class="modal-header">
          <h3>📋 Codes — {{ codesTarget?.name }}</h3>
          <button class="btn-close" @click="showCodes = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="filter-bar">
            <input v-model="codesSearch" class="input" placeholder="Search code…" @input="loadCodes" />
            <select v-model="codesUsed" class="input select" @change="loadCodes">
              <option value="">All</option>
              <option value="0">Unused</option>
              <option value="1">Used</option>
            </select>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Code</th><th>Used</th><th>Active</th><th>Expires</th></tr></thead>
              <tbody>
                <tr v-for="code in codes" :key="code.id">
                  <td><code class="code-badge">{{ code.code }}</code></td>
                  <td><span :class="['used-count', code.used_count > 0 && 'has-used']">{{ code.used_count }}</span></td>
                  <td><span :class="['status-pill', code.active ? 'active' : 'inactive']">{{ code.active ? 'Yes' : 'No' }}</span></td>
                  <td><small class="muted">{{ code.expires_at ? formatDate(code.expires_at) : '—' }}</small></td>
                </tr>
              </tbody>
            </table>
            <div v-if="!codes.length" class="empty">No codes found.</div>
            <div v-if="codeTotal > 200" class="muted" style="text-align:center;padding:0.75rem">
              Showing 200 of {{ codeTotal }} codes. Use Export CSV to get all.
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showCodes = false">Close</button>
          <button class="btn btn-primary" @click="exportCodes(codesTarget)">⬇️ Export CSV</button>
        </div>
      </div>
    </div>

    <!-- ── Stats Modal ── -->
    <div v-if="showStatsModal" class="modal-overlay" @click.self="showStatsModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>📊 Campaign Stats — {{ campaignStats?.campaign?.name }}</h3>
          <button class="btn-close" @click="showStatsModal = false">✕</button>
        </div>
        <div class="modal-body" v-if="campaignStats">
          <div class="stats-grid">
            <div class="stat-block">
              <div class="stat-value">{{ campaignStats.total }}</div>
              <div class="stat-label">Total Codes</div>
            </div>
            <div class="stat-block">
              <div class="stat-value">{{ campaignStats.used }}</div>
              <div class="stat-label">Used</div>
            </div>
            <div class="stat-block">
              <div class="stat-value">{{ campaignStats.unused }}</div>
              <div class="stat-label">Unused</div>
            </div>
            <div class="stat-block">
              <div class="stat-value">{{ Math.round(campaignStats.used / (campaignStats.total || 1) * 100) }}%</div>
              <div class="stat-label">Usage Rate</div>
            </div>
          </div>
          <div class="revenue-row">
            <div class="revenue-item">
              <div class="revenue-label">Revenue Generated</div>
              <div class="revenue-value">€{{ Number(campaignStats.revenue || 0).toFixed(2) }}</div>
            </div>
            <div class="revenue-item">
              <div class="revenue-label">Discounts Given</div>
              <div class="revenue-value">€{{ Number(campaignStats.discount_given || 0).toFixed(2) }}</div>
            </div>
          </div>
          <!-- Usage progress bar -->
          <div class="progress-wrap">
            <div class="progress-label">
              <span>Code Usage</span>
              <span>{{ campaignStats.used }}/{{ campaignStats.total }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: Math.round(campaignStats.used / (campaignStats.total || 1) * 100) + '%' }"></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showStatsModal = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = '/api/coupon-campaigns'

const campaigns = ref([])
const showModal = ref(false)
const editingCampaign = ref(null)
const saving = ref(false)
const error = ref('')
const successMsg = ref('')

const showCodes = ref(false)
const codesTarget = ref(null)
const codes = ref([])
const codeTotal = ref(0)
const codesSearch = ref('')
const codesUsed = ref('')

const showStatsModal = ref(false)
const campaignStats = ref(null)

const totalCodes = computed(() => campaigns.value.reduce((s, c) => s + (c.total_codes || 0), 0))
const totalUsed = computed(() => campaigns.value.reduce((s, c) => s + (c.used_codes || 0), 0))

const defaultForm = () => ({
  name: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 10,
  expires_at: '',
  min_order_amount: 0,
  max_uses_per_code: 1,
  prefix: '',
  code_count: 100,
  code_length: 8,
  active: true,
})

const form = ref(defaultForm())
const headers = () => ({ Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' })

async function load() {
  const res = await fetch(API, { headers: headers() })
  campaigns.value = await res.json()
}

function openCreate() {
  editingCampaign.value = null
  form.value = defaultForm()
  error.value = ''
  successMsg.value = ''
  showModal.value = true
}

function openEdit(c) {
  editingCampaign.value = c
  form.value = {
    name: c.name,
    description: c.description || '',
    discount_type: c.discount_type,
    discount_value: c.discount_value,
    expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '',
    min_order_amount: c.min_order_amount || 0,
    max_uses_per_code: c.max_uses_per_code || 1,
    prefix: c.prefix || '',
    code_count: c.code_count || 100,
    code_length: c.code_length || 8,
    active: !!c.active,
  }
  error.value = ''
  successMsg.value = ''
  showModal.value = true
}

async function saveCampaign() {
  if (!form.value.name) { error.value = 'Campaign name is required.'; return }
  saving.value = true; error.value = ''
  try {
    const url = editingCampaign.value ? `${API}/${editingCampaign.value.id}` : API
    const method = editingCampaign.value ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(form.value) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Save failed')
    if (!editingCampaign.value) {
      successMsg.value = `✅ Campaign created with ${data.generated} codes!`
      setTimeout(() => { showModal.value = false; load() }, 2000)
    } else {
      showModal.value = false
      await load()
    }
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign? Unused codes will be removed; used codes will remain in the system.')) return
  await fetch(`${API}/${id}`, { method: 'DELETE', headers: headers() })
  await load()
}

async function viewCodes(campaign) {
  codesTarget.value = campaign
  codesSearch.value = ''
  codesUsed.value = ''
  await loadCodes()
  showCodes.value = true
}

async function loadCodes() {
  if (!codesTarget.value) return
  const params = new URLSearchParams({ limit: 200, offset: 0 })
  if (codesSearch.value) params.set('q', codesSearch.value)
  if (codesUsed.value !== '') params.set('used', codesUsed.value)
  const res = await fetch(`${API}/${codesTarget.value.id}/codes?${params}`, { headers: headers() })
  const data = await res.json()
  codes.value = data.codes || []
  codeTotal.value = data.total || 0
}

async function viewStats(campaign) {
  const res = await fetch(`${API}/${campaign.id}/stats`, { headers: headers() })
  campaignStats.value = await res.json()
  showStatsModal.value = true
}

function exportCodes(campaign) {
  const url = `${API}/${campaign.id}/export`
  const a = document.createElement('a')
  a.href = url
  a.setAttribute('download', `campaign-${campaign.id}-codes.csv`)
  // We need to fetch with auth header
  fetch(url, { headers: headers() })
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob)
      a.href = blobUrl
      a.click()
      URL.revokeObjectURL(blobUrl)
    })
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString()
}

onMounted(load)
</script>

<style scoped>
.coupon-campaigns-view { display: flex; flex-direction: column; gap: 1.5rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }

.stats-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
.stat-card { background: var(--surface); border-radius: var(--radius); padding: 1.25rem; text-align: center; }
.stat-value { font-size: 1.8rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }

.card { background: var(--surface); border-radius: var(--radius); padding: 1.5rem; }

.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.table th { text-align: left; padding: 0.6rem 0.8rem; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
.table td { padding: 0.75rem 0.8rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
.table tbody tr:last-child td { border-bottom: none; }
.table tbody tr:hover { background: rgba(255,255,255,0.02); }

.campaign-name { font-weight: 600; }
.muted { color: var(--text-muted); font-size: 0.8rem; }
.prefix-badge { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; font-family: monospace; }

.discount-badge { background: hsl(355,70%,18%); color: var(--accent); font-size: 0.8rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.used-count { color: var(--text-muted); }
.used-count.has-used { color: hsl(140,60%,55%); font-weight: 600; }
.code-badge { background: hsl(228,4%,20%); color: var(--text); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; letter-spacing: 0.05em; }

.status-pill { font-size: 0.75rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.status-pill.active { background: hsl(140,50%,18%); color: hsl(140,60%,55%); }
.status-pill.inactive { background: hsl(228,4%,20%); color: var(--text-muted); }

.actions { display: flex; gap: 0.4rem; }
.empty { text-align: center; padding: 2.5rem; color: var(--text-muted); }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }

.filter-bar { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal { background: var(--surface); border-radius: var(--radius); width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; }
.modal.large { max-width: 800px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 1; }
.modal-header h3 { font-size: 1.1rem; font-weight: 700; margin: 0; }
.btn-close { background: none; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer; }
.modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; flex: 1; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 0.75rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); }
.toggle-row { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }

.info-box { background: hsl(228,4%,20%); border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.85rem; color: var(--text-muted); }

.alert-error { background: hsl(355,70%,15%); border: 1px solid hsl(355,70%,30%); color: hsl(355,70%,65%); border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.88rem; }
.alert-success { background: hsl(140,50%,15%); border: 1px solid hsl(140,50%,30%); color: hsl(140,60%,65%); border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.88rem; }

.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.stat-block { background: var(--bg); border-radius: var(--radius-sm); padding: 1rem; text-align: center; }
.stat-block .stat-value { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.stat-block .stat-label { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem; }

.revenue-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.revenue-item { background: var(--bg); border-radius: var(--radius-sm); padding: 1rem; text-align: center; }
.revenue-label { font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.25rem; }
.revenue-value { font-size: 1.4rem; font-weight: 700; }

.progress-wrap { margin-top: 0.5rem; }
.progress-label { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.4rem; }
.progress-bar { height: 8px; background: var(--bg); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.4s; }

.input { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; font-size: 0.9rem; width: 100%; box-sizing: border-box; }
.input:disabled { opacity: 0.5; cursor: not-allowed; }
select.input { cursor: pointer; }
select option { background: var(--surface); }

.btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.1rem; border-radius: var(--radius-sm); font-size: 0.9rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { filter: brightness(1.1); }
.btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
.btn-outline:hover { background: var(--glass-bg); }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.82rem; }
.btn-danger { background: hsl(355,70%,20%); color: hsl(355,70%,65%); }
.btn-danger:hover { background: hsl(355,70%,25%); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
