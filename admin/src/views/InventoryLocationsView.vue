<template>
  <div>
    <div v-if="feedback" :class="['feedback-toast', feedback.type]">{{ feedback.msg }}</div>
    <div class="page-header">
      <h1>🏬 Inventory Locations</h1>
      <p class="subtitle">Manage stock across multiple warehouses or storage locations</p>
      <button class="btn btn-primary" @click="openCreate">+ Add Location</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="summary">
      <div class="stat-card">
        <div class="stat-value">{{ summary.total || 0 }}</div>
        <div class="stat-label">Locations</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ summary.active || 0 }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.total_stock || 0 }}</div>
        <div class="stat-label">Total Stock Units</div>
      </div>
      <div class="stat-card">
        <div class="stat-value accent-text">{{ summary.low_stock || 0 }}</div>
        <div class="stat-label">Low Stock</div>
      </div>
      <div class="stat-card">
        <div class="stat-value danger-text">{{ summary.out_of_stock || 0 }}</div>
        <div class="stat-label">Out of Stock</div>
      </div>
    </div>

    <!-- Multi-location toggle -->
    <div class="info-card glass" style="margin-bottom:1.5rem">
      <label class="toggle-label">
        <input type="checkbox" v-model="multiLocationEnabled" @change="toggleMultiLocation" />
        <strong>Enable multi-location inventory</strong>
        <small style="color:#888;font-size:.85rem;margin-left:.5rem">— When enabled, product stock_quantity is automatically synced to the sum across all locations</small>
      </label>
    </div>

    <!-- Locations grid -->
    <div class="locations-grid" v-if="locations.length">
      <div v-for="loc in locations" :key="loc.id" class="location-card glass">
        <div class="location-header">
          <div class="location-title">
            <span class="location-icon">{{ loc.is_default ? '⭐' : '🏬' }}</span>
            <div>
              <div class="loc-name">{{ loc.name }}</div>
              <div class="loc-code">{{ loc.code }}</div>
            </div>
          </div>
          <div class="location-actions">
            <span class="pill" :class="loc.active ? 'pill-green' : 'pill-gray'">
              {{ loc.active ? 'Active' : 'Inactive' }}
            </span>
            <button class="btn btn-sm btn-ghost" @click="openEdit(loc)">✏️</button>
            <button class="btn btn-sm btn-ghost" @click="viewStock(loc)">📦 Stock</button>
            <button v-if="!loc.is_default" class="btn btn-sm btn-ghost danger" @click="confirmDelete(loc)">🗑️</button>
          </div>
        </div>

        <div class="location-stats">
          <div class="loc-stat">
            <span class="loc-stat-num">{{ loc.product_count || 0 }}</span>
            <span class="loc-stat-label">Products</span>
          </div>
          <div class="loc-stat">
            <span class="loc-stat-num">{{ loc.total_stock || 0 }}</span>
            <span class="loc-stat-label">Total Units</span>
          </div>
        </div>

        <div v-if="loc.address" class="location-address">
          📍 {{ loc.address }}
        </div>
      </div>
    </div>
    <div v-else class="glass section empty-state">
      <p>No locations yet. Add your first warehouse or storage location.</p>
    </div>

    <!-- Location Stock Modal -->
    <div class="modal-overlay" v-if="stockModal.show" @click.self="stockModal.show = false">
      <div class="modal modal-lg glass">
        <div class="modal-header">
          <h2>📦 Stock at {{ stockModal.location?.name }}</h2>
          <button class="btn btn-ghost" @click="stockModal.show = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="filter-bar" style="margin-bottom:1rem">
            <input v-model="stockSearch" placeholder="Filter products…" style="flex:1" />
          </div>
          <table class="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Low Threshold</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredStockItems" :key="item.id">
                <td>
                  <div style="display:flex;align-items:center;gap:.6rem">
                    <img v-if="item.cover_image" :src="API + item.cover_image" style="width:32px;height:32px;object-fit:cover;border-radius:6px" />
                    <span>{{ item.name }}</span>
                  </div>
                </td>
                <td style="font-size:.85rem;color:#888">{{ item.sku || '—' }}</td>
                <td>
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="0"
                    style="width:70px;padding:.4rem .6rem;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#e2e2e8"
                    @change="updateStock(item)"
                  />
                </td>
                <td style="color:#888">{{ item.reserved }}</td>
                <td>
                  <span :class="item.quantity - item.reserved < 0 ? 'danger-text' : item.quantity - item.reserved <= item.low_threshold ? 'warn-text' : 'ok-text'">
                    {{ Math.max(0, item.quantity - item.reserved) }}
                  </span>
                </td>
                <td>
                  <input
                    v-model.number="item.low_threshold"
                    type="number"
                    min="0"
                    style="width:60px;padding:.4rem .6rem;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#e2e2e8"
                    @change="updateStock(item)"
                  />
                </td>
                <td>
                  <button class="btn btn-sm btn-ghost" @click="updateStock(item)">💾 Save</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!filteredStockItems.length" class="empty-state">No products found.</div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Location Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ editingLoc ? 'Edit Location' : 'Add Location' }}</h2>
          <button class="btn btn-ghost" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Name *</label>
            <input v-model="form.name" placeholder="e.g. Main Warehouse, East Storage" />
          </div>
          <div class="form-group">
            <label>Code * (unique identifier)</label>
            <input v-model="form.code" placeholder="e.g. MAIN, EAST, WH2" style="text-transform:uppercase" />
          </div>
          <div class="form-group">
            <label>Address (optional)</label>
            <input v-model="form.address" placeholder="Street, City, Country" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" v-model="form.active" />
                Active
              </label>
            </div>
            <div class="form-group" v-if="editingLoc && !editingLoc.is_default">
              <label class="toggle-label">
                <input type="checkbox" v-model="form.is_default" />
                Set as Default
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="closeModal">Cancel</button>
          <button class="btn btn-primary" @click="saveLocation" :disabled="saving">
            {{ saving ? 'Saving…' : (editingLoc ? 'Update' : 'Create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div class="modal-overlay" v-if="deletingLoc" @click.self="deletingLoc = null">
      <div class="modal modal-sm glass">
        <div class="modal-header"><h2>Delete Location</h2></div>
        <div class="modal-body">
          <p>Delete <strong>{{ deletingLoc.name }}</strong>? All stock records for this location will be removed.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deletingLoc = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteLoc">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const feedback = ref(null)
const toast = {
  success: (msg) => { feedback.value = { type: 'success', msg }; setTimeout(() => { feedback.value = null }, 3000) },
  error: (msg) => { feedback.value = { type: 'error', msg }; setTimeout(() => { feedback.value = null }, 4000) },
}
const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'

const locations    = ref([])
const summary      = ref(null)
const showModal    = ref(false)
const editingLoc   = ref(null)
const deletingLoc  = ref(null)
const saving       = ref(false)
const stockSearch  = ref('')
const multiLocationEnabled = ref(false)

const stockModal = ref({ show: false, location: null, items: [] })

const form = ref({ name: '', code: '', address: '', active: true, is_default: false })

const filteredStockItems = computed(() => {
  if (!stockSearch.value) return stockModal.value.items
  const q = stockSearch.value.toLowerCase()
  return stockModal.value.items.filter(i => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q))
})

async function load() {
  const [{ data: locs }, { data: sum }] = await Promise.all([
    api.get('/inventory-locations'),
    api.get('/inventory-locations/summary'),
  ])
  locations.value = locs
  summary.value = sum
}

async function loadConfig() {
  const { data } = await api.get('/settings')
  multiLocationEnabled.value = data.multi_location_enabled === '1'
}

async function toggleMultiLocation() {
  await api.put('/settings', { multi_location_enabled: multiLocationEnabled.value ? '1' : '0' })
  toast.success('Setting saved')
}

async function viewStock(loc) {
  stockModal.value.location = loc
  stockModal.value.show = true
  stockModal.value.items = []
  const { data } = await api.get('/inventory-locations/stock', { params: { location_id: loc.id } })
  stockModal.value.items = data
}

async function updateStock(item) {
  try {
    await api.put(`/inventory-locations/stock/${item.id}`, {
      location_id:   stockModal.value.location.id,
      quantity:      item.quantity,
      reserved:      item.reserved,
      low_threshold: item.low_threshold,
    })
    toast.success(`Stock updated for ${item.name}`)
    load()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Update failed')
  }
}

function openCreate() {
  editingLoc.value = null
  form.value = { name: '', code: '', address: '', active: true, is_default: false }
  showModal.value = true
}

function openEdit(loc) {
  editingLoc.value = loc
  form.value = { name: loc.name, code: loc.code, address: loc.address || '', active: !!loc.active, is_default: !!loc.is_default }
  showModal.value = true
}

function closeModal() { showModal.value = false; editingLoc.value = null }

async function saveLocation() {
  if (!form.value.name || !form.value.code) return toast.error('Name and code are required')
  saving.value = true
  try {
    if (editingLoc.value) {
      await api.put(`/inventory-locations/${editingLoc.value.id}`, form.value)
      toast.success('Location updated')
    } else {
      await api.post('/inventory-locations', form.value)
      toast.success('Location created')
    }
    closeModal()
    load()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

function confirmDelete(loc) { deletingLoc.value = loc }
async function deleteLoc() {
  try {
    await api.delete(`/inventory-locations/${deletingLoc.value.id}`)
    toast.success('Location deleted')
  } catch (e) {
    toast.error(e.response?.data?.error || 'Delete failed')
  }
  deletingLoc.value = null
  load()
}

onMounted(() => { load(); loadConfig() })
</script>

<style scoped>
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1rem 1.5rem; min-width: 120px; }
.stat-card.accent { border-color: var(--accent); }
.stat-value { font-size: 1.6rem; font-weight: 700; color: #e2e2e8; }
.stat-label { font-size: .8rem; color: #888; margin-top: .2rem; }
.info-card { padding: 1rem 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; }
.toggle-label { display: flex; align-items: center; gap: .6rem; cursor: pointer; color: #e2e2e8; }
.locations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
.location-card { border-radius: 16px; padding: 1.5rem; }
.location-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.location-title { display: flex; align-items: center; gap: .75rem; }
.location-icon { font-size: 1.8rem; }
.loc-name { font-size: 1rem; font-weight: 600; color: #e2e2e8; }
.loc-code { font-size: .8rem; color: #888; font-family: monospace; }
.location-actions { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
.location-stats { display: flex; gap: 1.5rem; margin-bottom: .75rem; }
.loc-stat { text-align: center; }
.loc-stat-num { display: block; font-size: 1.2rem; font-weight: 700; color: #e2e2e8; }
.loc-stat-label { font-size: .75rem; color: #888; }
.location-address { font-size: .82rem; color: #888; margin-top: .5rem; }
.section { padding: 1.5rem; border-radius: 16px; }
.empty-state { text-align: center; padding: 3rem; color: #666; }
.pill { display: inline-block; padding: .2rem .6rem; border-radius: 20px; font-size: .78rem; font-weight: 600; background: rgba(255,255,255,0.08); color: #aaa; }
.pill-green { background: rgba(76,175,80,0.2); color: #4caf50; }
.pill-gray { background: rgba(255,255,255,0.06); color: #666; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 520px; max-height: 90vh; overflow-y: auto; border-radius: 1.5rem; padding: 0; }
.modal-lg { width: 860px; }
.modal-sm { width: 380px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: flex-end; gap: .75rem; }
.form-group { margin-bottom: 1.2rem; }
.form-group label { display: block; margin-bottom: .4rem; font-size: .85rem; color: #aaa; }
.form-group input { width: 100%; padding: .65rem .9rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #e2e2e8; font-size: .9rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th { text-align: left; padding: .75rem; color: #888; font-size: .8rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
.admin-table td { padding: .75rem; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: middle; }
.filter-bar { display: flex; gap: .75rem; }
.filter-bar input { padding: .6rem .9rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #e2e2e8; }
.btn-sm { padding: .3rem .6rem; font-size: .8rem; }
.btn-danger { background: var(--accent); color: #fff; border: none; cursor: pointer; padding: .6rem 1.2rem; border-radius: 8px; }
.danger { color: var(--accent); }
.accent-text { color: #ffc107; }
.danger-text { color: var(--accent); }
.warn-text { color: #ffc107; }
.ok-text { color: #4caf50; }
.feedback-toast { position: fixed; top: 1rem; right: 1rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; z-index: 9999; }
.feedback-toast.success { background: hsl(140,50%,18%); color: hsl(140,60%,65%); border: 1px solid hsl(140,50%,30%); }
.feedback-toast.error { background: hsl(355,70%,18%); color: hsl(355,70%,65%); border: 1px solid hsl(355,70%,30%); }
</style>
