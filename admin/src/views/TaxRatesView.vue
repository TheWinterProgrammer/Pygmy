<template>
  <div>
    <div class="page-header">
      <h1>🧾 Tax Rates</h1>
      <button class="btn btn-primary" @click="openModal(null)">+ Add Rate</button>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip glass" v-if="rates.length > 0">
      <div class="stat-chip">
        <span class="stat-num">{{ rates.length }}</span>
        <span class="stat-lbl">Total Rates</span>
      </div>
      <div class="stat-chip">
        <span class="stat-num">{{ rates.filter(r => r.active).length }}</span>
        <span class="stat-lbl">Active</span>
      </div>
    </div>

    <!-- Info tips -->
    <div class="tips-row">
      <div class="tip glass-card">
        <span class="tip-icon">⚠️</span>
        <span>If <strong>inclusive</strong> is enabled, prices on your site are assumed to already include this tax (common in EU for B2C).</span>
      </div>
      <div class="tip glass-card">
        <span class="tip-icon">💡</span>
        <span>Set a catch-all <strong>*</strong> rate at priority 0, then override specific countries at higher priority.</span>
      </div>
    </div>

    <!-- Table -->
    <div class="glass table-wrap" v-if="rates.length > 0">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Country</th>
            <th>Rate %</th>
            <th>Inclusive</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rate in rates" :key="rate.id">
            <td><strong>{{ rate.name }}</strong></td>
            <td>
              <span v-if="rate.country === '*'" class="country-chip">🌍 All Countries</span>
              <span v-else class="country-chip">{{ countryFlag(rate.country) }} {{ rate.country }}</span>
              <span v-if="rate.state" class="muted" style="font-size:.8rem;"> / {{ rate.state }}</span>
            </td>
            <td><strong>{{ rate.rate }}%</strong></td>
            <td>
              <span v-if="rate.inclusive" class="badge badge-blue">Inclusive</span>
              <span v-else class="badge badge-muted">Exclusive</span>
            </td>
            <td>{{ rate.priority }}</td>
            <td>
              <button
                :class="['badge', 'badge-toggle', rate.active ? 'badge-green' : 'badge-red']"
                @click="toggleActive(rate)"
              >{{ rate.active ? 'Active' : 'Inactive' }}</button>
            </td>
            <td class="actions-cell">
              <button class="btn btn-ghost btn-sm" @click="openModal(rate)">Edit</button>
              <button class="btn btn-ghost btn-sm btn-danger" @click="confirmDelete(rate)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state glass" v-else-if="!loading">
      <div style="font-size:2.5rem;margin-bottom:.75rem;">🧾</div>
      <h3>No tax rates configured</h3>
      <p class="text-muted">Add a tax rate to start charging VAT/tax at checkout.</p>
      <button class="btn btn-primary" style="margin-top:1rem;" @click="openModal(null)">+ Add First Rate</button>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="modal.open" class="modal-overlay" @click.self="modal.open = false">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ modal.id ? 'Edit Tax Rate' : 'Add Tax Rate' }}</h2>
          <button class="modal-close" @click="modal.open = false">✕</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveRate">
            <div class="form-group">
              <label>Rate Name</label>
              <input v-model="modal.name" class="input" placeholder="e.g. VAT, GST, Sales Tax" required />
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label>Country</label>
                <select v-model="modal.country" class="input">
                  <option v-for="c in countryOptions" :key="c.code" :value="c.code">{{ c.flag }} {{ c.name }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>State / Province <span class="muted">(optional)</span></label>
                <input v-model="modal.state" class="input" placeholder="e.g. CA, TX (leave blank for all)" />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label>Rate (%)</label>
                <input v-model.number="modal.rate" type="number" step="0.01" min="0" max="100" class="input" placeholder="e.g. 20" required />
              </div>
              <div class="form-group">
                <label>Priority</label>
                <input v-model.number="modal.priority" type="number" class="input" placeholder="0" />
                <span class="hint">Higher = checked first</span>
              </div>
            </div>
            <div class="form-row-checks">
              <label class="check-label">
                <input type="checkbox" v-model="modal.inclusive" />
                <span>
                  <strong>Inclusive</strong> — prices already include this tax
                </span>
              </label>
              <label class="check-label">
                <input type="checkbox" v-model="modal.active" />
                <span>Active</span>
              </label>
            </div>
            <div v-if="modal.error" class="error-msg">{{ modal.error }}</div>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" @click="modal.open = false">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="modal.saving">
                {{ modal.saving ? 'Saving…' : (modal.id ? 'Update Rate' : 'Create Rate') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal modal-sm glass">
        <div class="modal-header">
          <h2>Delete Tax Rate</h2>
          <button class="modal-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Delete <strong>{{ deleteTarget.name }}</strong> ({{ deleteTarget.country }}, {{ deleteTarget.rate }}%)?</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const rates = ref([])
const loading = ref(false)
const deleteTarget = ref(null)

const modal = reactive({
  open: false,
  id: null,
  name: 'VAT',
  country: '*',
  state: '',
  rate: 20,
  inclusive: false,
  priority: 0,
  active: true,
  saving: false,
  error: '',
})

const countryOptions = [
  { code: '*', name: 'All Countries', flag: '🌍' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
]

function countryFlag(code) {
  if (code === '*') return '🌍'
  const opt = countryOptions.find(c => c.code === code)
  return opt ? opt.flag : '🏳️'
}

async function fetchRates() {
  loading.value = true
  try {
    const res = await fetch('/api/tax-rates', { headers: { Authorization: `Bearer ${auth.token}` } })
    rates.value = await res.json()
  } finally {
    loading.value = false
  }
}

function openModal(rate) {
  modal.error = ''
  if (rate) {
    Object.assign(modal, {
      open: true, id: rate.id, name: rate.name, country: rate.country,
      state: rate.state || '', rate: rate.rate, inclusive: !!rate.inclusive,
      priority: rate.priority, active: !!rate.active, saving: false
    })
  } else {
    Object.assign(modal, {
      open: true, id: null, name: 'VAT', country: '*', state: '',
      rate: 20, inclusive: false, priority: 0, active: true, saving: false
    })
  }
}

async function saveRate() {
  modal.saving = true
  modal.error = ''
  try {
    const payload = {
      name: modal.name,
      country: modal.country,
      state: modal.state,
      rate: modal.rate,
      inclusive: modal.inclusive ? 1 : 0,
      priority: modal.priority,
      active: modal.active ? 1 : 0,
    }
    const url = modal.id ? `/api/tax-rates/${modal.id}` : '/api/tax-rates'
    const method = modal.id ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save')
    await fetchRates()
    modal.open = false
  } catch (e) {
    modal.error = e.message
  } finally {
    modal.saving = false
  }
}

async function toggleActive(rate) {
  await fetch(`/api/tax-rates/${rate.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: rate.active ? 0 : 1 }),
  })
  rate.active = !rate.active
}

function confirmDelete(rate) {
  deleteTarget.value = rate
}

async function doDelete() {
  await fetch(`/api/tax-rates/${deleteTarget.value.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  rates.value = rates.value.filter(r => r.id !== deleteTarget.value.id)
  deleteTarget.value = null
}

onMounted(fetchRates)
</script>

<style scoped>
.stats-strip {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  border-radius: 1rem;
  margin-bottom: 1.25rem;
}
.stat-chip { display: flex; flex-direction: column; }
.stat-num { font-size: 1.5rem; font-weight: 700; }
.stat-lbl { font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.tips-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
@media (max-width: 600px) { .tips-row { grid-template-columns: 1fr; } }
.tip {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.5;
}
.tip-icon { font-size: 1rem; flex-shrink: 0; margin-top: 0.1rem; }
.glass-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }

.table-wrap { border-radius: 1rem; overflow: hidden; margin-bottom: 1.5rem; }

.country-chip { font-size: 0.88rem; }
.badge { padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.badge-green { background: rgba(34,197,94,0.2); color: #4ade80; }
.badge-red { background: rgba(239,68,68,0.2); color: #f87171; }
.badge-blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
.badge-muted { background: rgba(255,255,255,0.08); color: var(--text-muted); }
.badge-toggle { cursor: pointer; border: none; font-family: inherit; }
.actions-cell { display: flex; gap: 0.4rem; align-items: center; }
.btn-danger { color: var(--accent); }

.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; }
.empty-state h3 { margin-bottom: 0.5rem; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 90%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; border-radius: 1.25rem; }
.modal-sm { max-width: 420px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.1rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }
.form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.form-row-checks { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
.check-label { display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; font-size: 0.875rem; }
.check-label input[type=checkbox] { accent-color: var(--accent); width: 16px; height: 16px; flex-shrink: 0; margin-top: 0.15rem; }
.hint { font-size: 0.75rem; color: var(--text-muted); }
.error-msg { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 0.6rem 1rem; border-radius: 0.6rem; font-size: 0.875rem; margin-bottom: 1rem; }
.muted { color: var(--text-muted); }
.text-muted { color: var(--text-muted); }
</style>
