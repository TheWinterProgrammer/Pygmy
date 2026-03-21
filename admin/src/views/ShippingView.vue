<template>
  <div>
    <div class="page-header">
      <h1>🚚 Shipping Zones</h1>
      <button class="btn btn-primary" @click="openCreateZone">+ New Zone</button>
    </div>
    <p class="page-desc text-muted">
      Zones group countries together. Each zone can have multiple shipping rates.
      A zone with no countries assigned acts as a catch-all for the rest of the world.
    </p>

    <div class="loading-bar-full" v-if="loading"></div>

    <div class="zones-list" v-if="zones.length">
      <div class="zone-card glass" v-for="zone in zones" :key="zone.id">
        <div class="zone-header">
          <div class="zone-info">
            <h3 class="zone-name">{{ zone.name }}</h3>
            <div class="zone-countries text-muted">
              <template v-if="zone.countries.length">
                {{ zone.countries.join(', ') }}
              </template>
              <em v-else>🌍 Rest of World (catch-all)</em>
            </div>
          </div>
          <div class="zone-actions">
            <button class="btn btn-ghost btn-sm" @click="openEditZone(zone)">✏️ Edit Zone</button>
            <button class="btn btn-ghost btn-sm danger" @click="confirmDeleteZone(zone)">🗑</button>
          </div>
        </div>

        <!-- Rates for this zone -->
        <div class="rates-section">
          <div class="rates-header">
            <span class="rates-label">Shipping Rates</span>
            <button class="btn btn-ghost btn-xs" @click="openCreateRate(zone)">+ Add Rate</button>
          </div>
          <div class="rate-rows">
            <div class="rate-row" v-for="rate in zone.rates" :key="rate.id">
              <div class="rate-name">{{ rate.name }}</div>
              <div class="rate-type">
                <span class="badge" :class="rateTypeClass(rate.type)">{{ rate.type }}</span>
              </div>
              <div class="rate-cost">
                <template v-if="rate.type === 'free'">Free</template>
                <template v-else-if="rate.type === 'threshold'">
                  Free over {{ sym }}{{ rate.min_order.toFixed(2) }}, else {{ sym }}{{ rate.rate.toFixed(2) }}
                </template>
                <template v-else>{{ sym }}{{ rate.rate.toFixed(2) }}</template>
              </div>
              <div class="rate-status">
                <span class="status-dot" :class="rate.active ? 'active' : 'inactive'"></span>
                {{ rate.active ? 'Active' : 'Inactive' }}
              </div>
              <div class="rate-actions">
                <button class="btn btn-ghost btn-xs" @click="openEditRate(zone, rate)">✏️</button>
                <button class="btn btn-ghost btn-xs danger" @click="deleteRate(zone, rate)">🗑</button>
              </div>
            </div>
            <div class="no-rates text-muted" v-if="!zone.rates.length">
              No rates yet. Add one to enable shipping for this zone.
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="empty-state glass" v-else-if="!loading">
      <div style="font-size:2.5rem;margin-bottom:.75rem;">🚚</div>
      <h3>No Shipping Zones</h3>
      <p class="text-muted">Create zones to configure shipping rates for different regions.</p>
      <button class="btn btn-primary" style="margin-top:1rem;" @click="openCreateZone">+ New Zone</button>
    </div>

    <!-- Zone create/edit modal -->
    <div class="modal-overlay" v-if="zoneModal.open" @click.self="closeZoneModal">
      <div class="modal glass">
        <h3>{{ zoneModal.mode === 'create' ? 'New Shipping Zone' : 'Edit Zone' }}</h3>
        <div class="field">
          <label class="label">Zone Name</label>
          <input class="input" v-model="zoneModal.name" placeholder="Europe, North America, etc." />
        </div>
        <div class="field">
          <label class="label">Countries (ISO codes, comma-separated)</label>
          <input class="input" v-model="zoneModal.countriesStr"
            placeholder="DE, FR, ES, IT — leave empty for rest-of-world catch-all" />
          <small class="field-hint">Use 2-letter ISO country codes (DE, US, GB). Empty = catch-all zone.</small>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="closeZoneModal">Cancel</button>
          <button class="btn btn-primary" @click="saveZone" :disabled="saving">
            {{ saving ? 'Saving…' : (zoneModal.mode === 'create' ? 'Create Zone' : 'Save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Rate create/edit modal -->
    <div class="modal-overlay" v-if="rateModal.open" @click.self="closeRateModal">
      <div class="modal glass">
        <h3>{{ rateModal.mode === 'create' ? 'Add Rate' : 'Edit Rate' }} — {{ rateModal.zone?.name }}</h3>
        <div class="field">
          <label class="label">Rate Name</label>
          <input class="input" v-model="rateModal.name" placeholder="Standard Shipping, Express, etc." />
        </div>
        <div class="field">
          <label class="label">Type</label>
          <select class="input" v-model="rateModal.type">
            <option value="flat">Flat Rate — fixed cost per order</option>
            <option value="free">Free — always free</option>
            <option value="threshold">Threshold — free above a minimum order amount</option>
          </select>
        </div>
        <div class="field" v-if="rateModal.type === 'flat'">
          <label class="label">Rate ({{ sym }})</label>
          <input class="input" type="number" min="0" step="0.01" v-model.number="rateModal.rate" />
        </div>
        <div v-if="rateModal.type === 'threshold'" class="field-row-2">
          <div class="field">
            <label class="label">Min Order for Free ({{ sym }})</label>
            <input class="input" type="number" min="0" step="0.01" v-model.number="rateModal.min_order" />
          </div>
          <div class="field">
            <label class="label">Rate Below Threshold ({{ sym }})</label>
            <input class="input" type="number" min="0" step="0.01" v-model.number="rateModal.rate" />
          </div>
        </div>
        <div class="field">
          <label class="toggle-label">
            <input type="checkbox" v-model="rateModal.active" />
            <span>Rate is active</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="closeRateModal">Cancel</button>
          <button class="btn btn-primary" @click="saveRate" :disabled="saving">
            {{ saving ? 'Saving…' : (rateModal.mode === 'create' ? 'Add Rate' : 'Save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete zone confirm -->
    <div class="modal-overlay" v-if="deleteZoneTarget" @click.self="deleteZoneTarget = null">
      <div class="modal glass">
        <h3>Delete Zone</h3>
        <p class="text-muted">Delete zone <strong>{{ deleteZoneTarget.name }}</strong> and all its rates?</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="deleteZoneTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteZone">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const sym = ref('€')

const zones   = ref([])
const loading = ref(false)
const saving  = ref(false)

// Zone modal
const zoneModal = ref({ open: false, mode: 'create', id: null, name: '', countriesStr: '' })
// Rate modal
const rateModal = ref({ open: false, mode: 'create', zone: null, id: null, name: '', type: 'flat', rate: 0, min_order: 0, active: true })
const deleteZoneTarget = ref(null)

async function loadZones() {
  loading.value = true
  try {
    const { data } = await api.get('/shipping/zones')
    zones.value = data
  } finally {
    loading.value = false
  }
}

// Zone modal
function openCreateZone() {
  zoneModal.value = { open: true, mode: 'create', id: null, name: '', countriesStr: '' }
}
function openEditZone(zone) {
  zoneModal.value = { open: true, mode: 'edit', id: zone.id, name: zone.name, countriesStr: zone.countries.join(', ') }
}
function closeZoneModal() { zoneModal.value.open = false }

async function saveZone() {
  if (!zoneModal.value.name) return
  saving.value = true
  const countries = zoneModal.value.countriesStr
    .split(/[,\s]+/)
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length === 2)
  try {
    if (zoneModal.value.mode === 'create') {
      await api.post('/shipping/zones', { name: zoneModal.value.name, countries })
    } else {
      await api.put(`/shipping/zones/${zoneModal.value.id}`, { name: zoneModal.value.name, countries })
    }
    closeZoneModal()
    await loadZones()
  } finally {
    saving.value = false
  }
}

function confirmDeleteZone(zone) { deleteZoneTarget.value = zone }
async function deleteZone() {
  await api.delete(`/shipping/zones/${deleteZoneTarget.value.id}`)
  deleteZoneTarget.value = null
  await loadZones()
}

// Rate modal
function openCreateRate(zone) {
  rateModal.value = { open: true, mode: 'create', zone, id: null, name: 'Standard Shipping', type: 'flat', rate: 0, min_order: 0, active: true }
}
function openEditRate(zone, rate) {
  rateModal.value = { open: true, mode: 'edit', zone, id: rate.id, name: rate.name, type: rate.type, rate: rate.rate, min_order: rate.min_order, active: !!rate.active }
}
function closeRateModal() { rateModal.value.open = false }

async function saveRate() {
  saving.value = true
  const rm = rateModal.value
  const payload = { name: rm.name, type: rm.type, rate: rm.rate, min_order: rm.min_order, active: rm.active }
  try {
    if (rm.mode === 'create') {
      await api.post(`/shipping/zones/${rm.zone.id}/rates`, payload)
    } else {
      await api.put(`/shipping/zones/${rm.zone.id}/rates/${rm.id}`, payload)
    }
    closeRateModal()
    await loadZones()
  } finally {
    saving.value = false
  }
}

async function deleteRate(zone, rate) {
  if (!confirm(`Delete rate "${rate.name}"?`)) return
  await api.delete(`/shipping/zones/${zone.id}/rates/${rate.id}`)
  await loadZones()
}

function rateTypeClass(type) {
  return { flat: 'badge-blue', free: 'badge-green', threshold: 'badge-orange' }[type] || ''
}

onMounted(async () => {
  try { const { data } = await api.get('/settings'); sym.value = data.shop_currency_symbol || '€' } catch {}
  loadZones()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: .5rem; }
.page-desc { font-size: .88rem; margin-bottom: 1.5rem; }

.loading-bar-full {
  height: 3px;
  background: linear-gradient(90deg, var(--accent), transparent);
  border-radius: 9999px;
  animation: slide 1.2s infinite;
  margin-bottom: 1rem;
}
@keyframes slide { from { transform: translateX(-100%) } to { transform: translateX(100%) } }

.zones-list { display: flex; flex-direction: column; gap: 1.25rem; }

.zone-card { border-radius: 1rem; padding: 1.5rem; }
.zone-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; gap: 1rem; }
.zone-name { font-size: 1.05rem; font-weight: 700; margin-bottom: .25rem; }
.zone-countries { font-size: .85rem; }
.zone-actions { display: flex; gap: .5rem; flex-shrink: 0; }

.rates-section { border-top: 1px solid rgba(255,255,255,.06); padding-top: 1rem; }
.rates-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem; }
.rates-label { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }

.rate-rows { display: flex; flex-direction: column; gap: .5rem; }
.rate-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto auto;
  align-items: center;
  gap: .75rem;
  padding: .5rem .75rem;
  background: rgba(255,255,255,.04);
  border-radius: .5rem;
}
.rate-name { font-size: .88rem; font-weight: 600; }
.rate-cost { font-size: .85rem; color: var(--text-muted); }
.rate-status { font-size: .78rem; display: flex; align-items: center; gap: .3rem; color: var(--text-muted); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; }
.status-dot.active   { background: hsl(142,70%,55%); }
.status-dot.inactive { background: rgba(255,255,255,.2); }
.rate-actions { display: flex; gap: .3rem; }
.no-rates { font-size: .85rem; padding: .5rem 0; }

.badge-blue   { background: hsl(220,50%,20%); color: hsl(220,80%,70%); }
.badge-green  { background: hsl(142,50%,15%); color: hsl(142,70%,60%); }
.badge-orange { background: hsl(30,50%,15%); color: hsl(30,90%,65%); }

.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; }
.danger { color: var(--accent) !important; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { padding: 2rem; border-radius: 1rem; max-width: 500px; width: 92%; }
.modal h3 { margin-bottom: 1.25rem; }
.field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field-hint { color: var(--text-muted); font-size: .78rem; }
.toggle-label { display: flex; align-items: center; gap: .5rem; cursor: pointer; font-size: .9rem; }
.modal-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1.25rem; }
.btn-danger { background: hsl(355,70%,30%); color: hsl(355,70%,80%); }
.btn-danger:hover { background: hsl(355,70%,40%); }

.btn-xs { padding: .25rem .55rem; font-size: .78rem; border-radius: .35rem; }
.btn-sm { padding: .35rem .75rem; font-size: .82rem; }
</style>
