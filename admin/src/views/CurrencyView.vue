<template>
  <div>
    <div class="page-header">
      <h1>💱 Multi-Currency</h1>
      <button class="btn btn-primary" @click="openCreate">+ Add Currency</button>
    </div>

    <!-- Info banner when disabled -->
    <div v-if="!enabled" class="notice glass">
      <span>💡 Multi-currency is currently <strong>disabled</strong>. Enable it in <RouterLink to="/settings" style="color:var(--accent)">Settings → E-Commerce</RouterLink>.</span>
    </div>

    <!-- Stats strip -->
    <div class="stats-row" v-if="rates.length">
      <div class="stat-card glass">
        <div class="stat-label">Base Currency</div>
        <div class="stat-value">{{ baseCurrency }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Total Currencies</div>
        <div class="stat-value">{{ rates.length }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Active</div>
        <div class="stat-value accent">{{ rates.filter(r => r.active).length }}</div>
      </div>
    </div>

    <!-- Sync button -->
    <div class="action-row">
      <button class="btn btn-ghost" :disabled="syncing" @click="syncRates">
        {{ syncing ? '⏳ Syncing…' : '🔄 Sync from open.er-api.com' }}
      </button>
      <span v-if="syncMsg" class="sync-msg">{{ syncMsg }}</span>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <div v-if="loading" class="loading-bar"></div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Symbol</th>
            <th>Exchange Rate (vs {{ baseCurrency }})</th>
            <th>Active</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rates.length">
            <td colspan="6" class="empty">No currencies yet. Add one above.</td>
          </tr>
          <tr v-for="r in rates" :key="r.id">
            <td><strong>{{ r.code }}</strong></td>
            <td>{{ r.symbol || '—' }}</td>
            <td>{{ r.rate }}</td>
            <td>
              <label class="toggle-label">
                <input type="checkbox" :checked="r.active" @change="toggleActive(r, $event.target.checked)" />
                <span class="toggle-pill"></span>
              </label>
            </td>
            <td class="text-muted small">{{ fmtDate(r.updated_at) }}</td>
            <td>
              <button class="btn btn-ghost btn-sm" @click="openEdit(r)">✏️</button>
              <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(r)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal glass">
        <h2>{{ editingId ? 'Edit Currency' : 'Add Currency' }}</h2>
        <form @submit.prevent="save">
          <div class="form-group">
            <label>Currency Code *</label>
            <input v-model="form.code" class="input" placeholder="USD" maxlength="3" style="text-transform:uppercase" :disabled="!!editingId" required />
            <small class="hint">3-letter ISO code (e.g. USD, GBP, JPY)</small>
          </div>
          <div class="form-group">
            <label>Symbol</label>
            <input v-model="form.symbol" class="input" placeholder="$" />
          </div>
          <div class="form-group">
            <label>Exchange Rate (1 {{ baseCurrency }} = X {{ form.code || '???' }}) *</label>
            <input v-model.number="form.rate" class="input" type="number" step="0.0001" min="0.0001" required />
          </div>
          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="form.active" />
              <span>Active</span>
            </label>
          </div>
          <div v-if="modalError" class="modal-error">{{ modalError }}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal glass">
        <h2>Delete Currency?</h2>
        <p>Remove <strong>{{ deleteTarget.code }}</strong> from the system?</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const rates = ref([])
const baseCurrency = ref('EUR')
const enabled = ref(false)
const loading = ref(true)
const syncing = ref(false)
const syncMsg = ref('')
const showModal = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const deleteTarget = ref(null)

const form = ref({ code: '', symbol: '', rate: 1, active: true })

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/currency?all=1')
    rates.value = data.rates || []
    baseCurrency.value = data.base || 'EUR'
    enabled.value = data.enabled || false
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = { code: '', symbol: '', rate: 1, active: true }
  modalError.value = ''
  showModal.value = true
}

function openEdit(r) {
  editingId.value = r.id
  form.value = { code: r.code, symbol: r.symbol, rate: r.rate, active: !!r.active }
  modalError.value = ''
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function save() {
  saving.value = true
  modalError.value = ''
  try {
    if (editingId.value) {
      await api.put(`/currency/${editingId.value}`, form.value)
    } else {
      await api.post('/currency', { ...form.value, code: form.value.code.toUpperCase() })
    }
    closeModal()
    await load()
  } catch (e) {
    modalError.value = e.response?.data?.error || 'Save failed'
  } finally {
    saving.value = false
  }
}

async function toggleActive(r, val) {
  await api.put(`/currency/${r.id}`, { active: val })
  r.active = val ? 1 : 0
}

function confirmDelete(r) { deleteTarget.value = r }
async function doDelete() {
  await api.delete(`/currency/${deleteTarget.value.id}`)
  deleteTarget.value = null
  await load()
}

async function syncRates() {
  syncing.value = true
  syncMsg.value = ''
  try {
    const { data } = await api.post('/currency/sync')
    syncMsg.value = `✅ Updated ${data.updated} rate(s). Last updated: ${data.timestamp}`
    await load()
  } catch (e) {
    syncMsg.value = `❌ Sync failed: ${e.response?.data?.error || e.message}`
  } finally {
    syncing.value = false
    setTimeout(() => (syncMsg.value = ''), 6000)
  }
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
h1 { font-size: 1.4rem; font-weight: 800; margin: 0; }
.notice { padding: 0.875rem 1.25rem; border-radius: 0.875rem; margin-bottom: 1.25rem; font-size: 0.88rem; color: var(--text-muted); }
.stats-row { display: flex; gap: 0.875rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.stat-card { padding: 1rem 1.25rem; border-radius: 0.875rem; min-width: 120px; }
.stat-label { font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.25rem; }
.stat-value { font-size: 1.3rem; font-weight: 800; }
.accent { color: var(--accent); }
.action-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.sync-msg { font-size: 0.85rem; color: var(--text-muted); }
.table-wrap { border-radius: 1rem; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; font-size: 0.87rem; }
.table th { padding: 0.625rem 1rem; text-align: left; color: var(--text-muted); font-size: 0.78rem; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.06); }
.table td { padding: 0.625rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
.table tr:last-child td { border-bottom: none; }
.empty { text-align: center; color: var(--text-muted); padding: 2rem; }
.text-muted { color: var(--text-muted); }
.small { font-size: 0.78rem; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none; }
.toggle-pill { width: 36px; height: 20px; border-radius: 999px; background: rgba(255,255,255,.1); position: relative; transition: background .2s; }
input[type=checkbox]:checked ~ .toggle-pill { background: var(--accent); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { padding: 2rem; border-radius: 1.25rem; width: min(440px, 95vw); }
.modal h2 { margin: 0 0 1.5rem; font-size: 1.15rem; font-weight: 700; }
.form-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }
.hint { font-size: 0.75rem; color: var(--text-muted); }
.modal-error { background: rgba(213,60,60,.12); border: 1px solid rgba(213,60,60,.3); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.85rem; color: hsl(355,70%,65%); margin-top: 0.5rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.danger { color: hsl(355,70%,60%); }
.btn-danger { background: hsl(355,70%,35%); color: #fff; padding: 0.55rem 1.25rem; border-radius: 0.625rem; border: none; cursor: pointer; font-weight: 600; }
</style>
