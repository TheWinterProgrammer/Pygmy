<template>
  <div class="charity-view">
    <div class="page-header">
      <div>
        <h1>💝 Charity Campaigns</h1>
        <p class="subtitle">Collect donations at checkout and track fundraising progress</p>
      </div>
      <button class="btn-primary" @click="openCreate">+ New Campaign</button>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-number">{{ stats.total_campaigns || 0 }}</div>
        <div class="stat-label">Campaigns</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-number">{{ currency }}{{ fmtNum(stats.total_raised || 0) }}</div>
        <div class="stat-label">Total Raised</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.total_donations || 0 }}</div>
        <div class="stat-label">Donations</div>
      </div>
    </div>

    <!-- Campaigns Table -->
    <div class="glass-card">
      <div v-if="loading" class="loading-state">Loading campaigns…</div>
      <div v-else-if="!campaigns.length" class="empty-state">
        <div class="empty-icon">💝</div>
        <p>No campaigns yet. Create one to start accepting donations at checkout.</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Mode</th>
            <th>Raised</th>
            <th>Donations</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in campaigns" :key="c.id">
            <td>
              <div class="campaign-info">
                <img v-if="c.logo" :src="c.logo" class="campaign-logo" alt="" />
                <div v-else class="campaign-logo-placeholder">💝</div>
                <div>
                  <div class="campaign-name">{{ c.name }}</div>
                  <div class="campaign-desc">{{ c.description }}</div>
                </div>
              </div>
            </td>
            <td><span class="mode-badge" :class="c.mode">{{ modeLabel(c.mode) }}</span></td>
            <td>{{ currency }}{{ fmtNum(c.total_raised) }}</td>
            <td>{{ c.donation_count }}</td>
            <td>
              <span class="status-pill" :class="c.active ? 'active' : 'inactive'">
                {{ c.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="actions">
              <button class="btn-ghost small" @click="viewDonations(c)">📋 Donations</button>
              <button class="btn-ghost small" @click="editCampaign(c)">✏️ Edit</button>
              <button class="btn-danger small" @click="deleteCampaign(c)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Monthly Chart -->
    <div class="glass-card chart-card" v-if="stats?.monthly?.length">
      <h3>Monthly Donations</h3>
      <div class="bar-chart">
        <div v-for="m in stats.monthly.slice().reverse()" :key="m.month" class="bar-item">
          <div class="bar-label">{{ m.month.slice(5) }}</div>
          <div class="bar-track">
            <div class="bar-fill" :style="{ height: barHeight(m.total) + '%' }" :title="currency + fmtNum(m.total)"></div>
          </div>
          <div class="bar-value">{{ currency }}{{ fmtNum(m.total) }}</div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal-panel glass-card">
        <h2>{{ editingId ? 'Edit Campaign' : 'New Campaign' }}</h2>

        <div class="form-group">
          <label>Campaign Name *</label>
          <input v-model="form.name" placeholder="e.g. Plant a Tree, Red Cross" class="form-input" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="form.description" class="form-input" rows="2" placeholder="Short description shown at checkout"></textarea>
        </div>
        <div class="form-group">
          <label>Logo URL</label>
          <input v-model="form.logo" class="form-input" placeholder="https://..." />
        </div>
        <div class="form-group">
          <label>Donation Mode</label>
          <select v-model="form.mode" class="form-input">
            <option value="roundup">Round Up (e.g. round order to next €1)</option>
            <option value="fixed">Fixed Amounts (customer picks amount)</option>
            <option value="custom">Custom Amount (customer types their own)</option>
          </select>
        </div>
        <div class="form-group" v-if="form.mode === 'fixed'">
          <label>Fixed Amount Options (comma-separated)</label>
          <input v-model="fixedAmountsStr" class="form-input" placeholder="1,2,5,10" />
          <p class="form-hint">Customer can choose one of these amounts</p>
        </div>
        <div class="form-group toggle-row">
          <label>Active</label>
          <label class="toggle">
            <input type="checkbox" v-model="form.active" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" @click="showModal = false">Cancel</button>
          <button class="btn-primary" @click="saveCampaign" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save Campaign' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Donations Modal -->
    <div class="modal-overlay" v-if="showDonations" @click.self="showDonations = false">
      <div class="modal-panel glass-card wide">
        <h2>💝 {{ selectedCampaign?.name }} — Donations</h2>
        <div class="donations-stats">
          <div class="stat-chip">Total: <strong>{{ currency }}{{ fmtNum(selectedCampaign?.total_raised || 0) }}</strong></div>
          <div class="stat-chip">Count: <strong>{{ selectedCampaign?.donation_count || 0 }}</strong></div>
        </div>
        <table class="data-table" v-if="donations.length">
          <thead>
            <tr><th>Order</th><th>Email</th><th>Amount</th><th>Date</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in donations" :key="d.id">
              <td>{{ d.order_number || '—' }}</td>
              <td>{{ d.customer_email || '—' }}</td>
              <td>{{ currency }}{{ fmtNum(d.amount) }}</td>
              <td>{{ fmtDate(d.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">No donations yet.</div>
        <button class="btn-ghost mt" @click="showDonations = false">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const campaigns = ref([])
const stats = ref(null)
const loading = ref(true)
const showModal = ref(false)
const showDonations = ref(false)
const selectedCampaign = ref(null)
const donations = ref([])
const saving = ref(false)
const editingId = ref(null)
const currency = ref('€')
const fixedAmountsStr = ref('1,2,5')

const form = ref({ name: '', description: '', logo: '', mode: 'roundup', fixed_amounts: [1, 2, 5], active: true })

async function load() {
  loading.value = true
  try {
    const [c, s, settings] = await Promise.all([
      api.get('/charity'),
      api.get('/charity/stats'),
      api.get('/settings'),
    ])
    campaigns.value = c.data
    stats.value = s.data
    currency.value = settings.data.shop_currency_symbol || '€'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = { name: '', description: '', logo: '', mode: 'roundup', fixed_amounts: [1, 2, 5], active: true }
  fixedAmountsStr.value = '1,2,5'
  showModal.value = true
}

function editCampaign(c) {
  editingId.value = c.id
  form.value = { name: c.name, description: c.description, logo: c.logo || '', mode: c.mode, fixed_amounts: c.fixed_amounts, active: Boolean(c.active) }
  fixedAmountsStr.value = (c.fixed_amounts || []).join(',')
  showModal.value = true
}

async function saveCampaign() {
  if (!form.value.name.trim()) return alert('Campaign name is required')
  saving.value = true
  try {
    const payload = {
      ...form.value,
      fixed_amounts: fixedAmountsStr.value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v) && v > 0),
    }
    if (editingId.value) {
      await api.put(`/charity/${editingId.value}`, payload)
    } else {
      await api.post('/charity', payload)
    }
    showModal.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function deleteCampaign(c) {
  if (!confirm(`Delete campaign "${c.name}"? All donation history will also be deleted.`)) return
  await api.delete(`/charity/${c.id}`)
  await load()
}

async function viewDonations(c) {
  selectedCampaign.value = c
  const { data } = await api.get(`/charity/${c.id}/donations`)
  donations.value = data.donations || []
  showDonations.value = true
}

function modeLabel(mode) {
  return { roundup: '↑ Round Up', fixed: '💵 Fixed', custom: '✏️ Custom' }[mode] || mode
}

function fmtNum(n) { return (parseFloat(n) || 0).toFixed(2) }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : '—' }

function barHeight(val) {
  const max = Math.max(...(stats.value?.monthly || []).map(m => m.total), 1)
  return Math.round((val / max) * 100)
}

onMounted(load)
</script>

<style scoped>
.charity-view { padding: 2rem; max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.page-header h1 { margin: 0 0 .25rem; }
.subtitle { color: var(--text-muted, #888); margin: 0; }

.stats-strip { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
.stat-card { background: var(--surface); border-radius: 1rem; padding: 1.25rem 1.5rem; min-width: 160px; }
.stat-card.accent .stat-number { color: var(--accent); }
.stat-number { font-size: 1.75rem; font-weight: 700; }
.stat-label { font-size: .8rem; color: #888; margin-top: .25rem; }

.glass-card { background: var(--surface); border-radius: 1.5rem; padding: 1.5rem; margin-bottom: 1.5rem; }
.loading-state, .empty-state { text-align: center; padding: 3rem; color: #888; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th { text-align: left; padding: .75rem 1rem; font-size: .8rem; color: #888; border-bottom: 1px solid rgba(255,255,255,.05); }
.data-table td { padding: .75rem 1rem; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }

.campaign-info { display: flex; align-items: center; gap: .75rem; }
.campaign-logo { width: 36px; height: 36px; border-radius: .5rem; object-fit: cover; }
.campaign-logo-placeholder { width: 36px; height: 36px; border-radius: .5rem; background: rgba(255,255,255,.08); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.campaign-name { font-weight: 600; }
.campaign-desc { font-size: .8rem; color: #888; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.mode-badge { padding: .2rem .6rem; border-radius: .4rem; font-size: .75rem; font-weight: 600; }
.mode-badge.roundup { background: rgba(59,130,246,.15); color: #60a5fa; }
.mode-badge.fixed { background: rgba(34,197,94,.15); color: #4ade80; }
.mode-badge.custom { background: rgba(168,85,247,.15); color: #c084fc; }

.status-pill { padding: .2rem .6rem; border-radius: 999px; font-size: .75rem; font-weight: 600; }
.status-pill.active { background: rgba(34,197,94,.15); color: #4ade80; }
.status-pill.inactive { background: rgba(255,255,255,.05); color: #888; }

.actions { display: flex; gap: .5rem; }
.btn-primary { background: var(--accent); color: white; border: none; border-radius: .75rem; padding: .65rem 1.25rem; cursor: pointer; font-weight: 600; }
.btn-ghost { background: rgba(255,255,255,.07); color: white; border: none; border-radius: .75rem; padding: .65rem 1.25rem; cursor: pointer; }
.btn-ghost.small { padding: .35rem .75rem; font-size: .8rem; }
.btn-danger { background: rgba(239,68,68,.15); color: #f87171; border: none; border-radius: .75rem; padding: .35rem .75rem; cursor: pointer; font-size: .8rem; }

/* Chart */
.chart-card h3 { margin: 0 0 1.5rem; }
.bar-chart { display: flex; gap: .5rem; align-items: flex-end; height: 120px; }
.bar-item { display: flex; flex-direction: column; align-items: center; gap: .25rem; flex: 1; }
.bar-label { font-size: .65rem; color: #888; }
.bar-track { flex: 1; width: 100%; background: rgba(255,255,255,.05); border-radius: .25rem; display: flex; align-items: flex-end; overflow: hidden; }
.bar-fill { width: 100%; background: var(--accent); border-radius: .25rem; min-height: 2px; transition: height .3s; }
.bar-value { font-size: .65rem; color: #888; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-panel { width: 100%; max-width: 520px; max-height: 85vh; overflow-y: auto; }
.modal-panel.wide { max-width: 700px; }
.modal-panel h2 { margin: 0 0 1.5rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }

.form-group { margin-bottom: 1.25rem; }
.form-group label { display: block; font-size: .85rem; font-weight: 600; margin-bottom: .4rem; color: #ccc; }
.form-input { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; padding: .65rem 1rem; color: white; font-family: inherit; box-sizing: border-box; }
.form-hint { font-size: .75rem; color: #888; margin-top: .3rem; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; }
.toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; inset: 0; background: #444; border-radius: 22px; cursor: pointer; transition: .3s; }
.toggle input:checked + .toggle-slider { background: var(--accent); }
.toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

.donations-stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
.stat-chip { background: rgba(255,255,255,.06); border-radius: .5rem; padding: .4rem .8rem; font-size: .85rem; }
.mt { margin-top: 1.5rem; }
</style>
