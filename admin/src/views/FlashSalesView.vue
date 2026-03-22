<template>
  <div class="flash-sales-view">
    <div class="view-header">
      <div>
        <h1>⚡ Flash Sales</h1>
        <p class="subtitle">Time-limited promotional discounts with countdown timers</p>
      </div>
      <button class="btn-accent" @click="openCreate">+ New Flash Sale</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="sales.length">
      <div class="stat-card">
        <div class="stat-num">{{ sales.length }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ activeSales.length }}</div>
        <div class="stat-label">Currently Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ upcomingSales.length }}</div>
        <div class="stat-label">Upcoming</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ expiredSales.length }}</div>
        <div class="stat-label">Expired</div>
      </div>
    </div>

    <!-- Sales Table -->
    <div class="glass-card table-card">
      <div v-if="loading" class="empty-state">Loading…</div>
      <div v-else-if="!sales.length" class="empty-state">
        <div class="empty-icon">⚡</div>
        <p>No flash sales yet.</p>
        <button class="btn-accent" @click="openCreate">Create your first flash sale</button>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Sale</th>
            <th>Discount</th>
            <th>Applies To</th>
            <th>Schedule</th>
            <th>Uses</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fs in sales" :key="fs.id">
            <td>
              <div class="sale-name">{{ fs.name }}</div>
              <div class="sale-slug">/{{ fs.slug }}</div>
            </td>
            <td>
              <span class="discount-badge" :class="fs.discount_type">
                {{ discountLabel(fs) }}
              </span>
            </td>
            <td>
              <span class="applies-pill">{{ appliesToLabel(fs) }}</span>
            </td>
            <td>
              <div v-if="fs.starts_at || fs.ends_at" class="schedule-info">
                <div v-if="fs.starts_at">▶ {{ formatDt(fs.starts_at) }}</div>
                <div v-if="fs.ends_at">⏹ {{ formatDt(fs.ends_at) }}</div>
                <div v-if="fs.is_active && fs.ends_at" class="time-left">
                  ⏱ {{ timeLeft(fs.ends_at) }} left
                </div>
              </div>
              <span v-else class="text-muted">Always</span>
            </td>
            <td>
              {{ fs.uses_count }}{{ fs.max_uses > 0 ? ` / ${fs.max_uses}` : '' }}
            </td>
            <td>
              <span class="status-pill" :class="statusClass(fs)">{{ statusLabel(fs) }}</span>
            </td>
            <td class="actions-cell">
              <button class="btn-icon" title="Edit" @click="openEdit(fs)">✏️</button>
              <button class="btn-icon danger" title="Delete" @click="confirmDelete(fs)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-glass large">
        <div class="modal-header">
          <h2>{{ editing ? 'Edit Flash Sale' : 'New Flash Sale' }}</h2>
          <button class="btn-icon" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field">
              <label>Sale Name *</label>
              <input v-model="form.name" @input="autoSlug" placeholder="Summer Flash Sale" />
            </div>
            <div class="field">
              <label>Slug *</label>
              <input v-model="form.slug" placeholder="summer-flash-sale" />
            </div>
            <div class="field full">
              <label>Description</label>
              <textarea v-model="form.description" rows="2" placeholder="Optional description shown to customers" />
            </div>
            <div class="field">
              <label>Badge Label</label>
              <input v-model="form.badge_label" placeholder="Flash Sale" />
            </div>
            <div class="field">
              <label>Show Countdown</label>
              <label class="toggle">
                <input type="checkbox" v-model="form.show_countdown" />
                <span class="slider"></span>
                Show countdown timer on storefront
              </label>
            </div>

            <div class="field-section full">
              <h3>💰 Discount</h3>
            </div>
            <div class="field">
              <label>Discount Type</label>
              <select v-model="form.discount_type">
                <option value="percent">Percentage off (%)</option>
                <option value="fixed">Fixed amount off</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
            </div>
            <div class="field" v-if="form.discount_type !== 'free_shipping'">
              <label>Discount Value</label>
              <input type="number" v-model.number="form.discount_value" min="0" step="0.01"
                :placeholder="form.discount_type === 'percent' ? '20 for 20%' : '10 for €10 off'" />
            </div>
            <div class="field">
              <label>Minimum Purchase (0 = none)</label>
              <input type="number" v-model.number="form.min_purchase" min="0" step="0.01" />
            </div>
            <div class="field">
              <label>Max Uses (0 = unlimited)</label>
              <input type="number" v-model.number="form.max_uses" min="0" />
            </div>

            <div class="field-section full">
              <h3>🎯 Applies To</h3>
            </div>
            <div class="field">
              <label>Scope</label>
              <select v-model="form.applies_to">
                <option value="all">All Products</option>
                <option value="category">Specific Categories</option>
                <option value="products">Specific Products</option>
              </select>
            </div>
            <div class="field full" v-if="form.applies_to === 'products'">
              <label>Product IDs (comma-separated)</label>
              <input v-model="appliesIdsText" placeholder="1,5,23" />
            </div>
            <div class="field full" v-if="form.applies_to === 'category'">
              <label>Category Names (comma-separated)</label>
              <input v-model="appliesIdsText" placeholder="Clothing, Electronics" />
            </div>

            <div class="field-section full">
              <h3>📅 Schedule</h3>
            </div>
            <div class="field">
              <label>Starts At (optional)</label>
              <input type="datetime-local" v-model="form.starts_at" />
            </div>
            <div class="field">
              <label>Ends At (optional)</label>
              <input type="datetime-local" v-model="form.ends_at" />
            </div>
            <div class="field">
              <label>Status</label>
              <label class="toggle">
                <input type="checkbox" v-model="form.active" />
                <span class="slider"></span>
                Active
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">Cancel</button>
          <button class="btn-accent" @click="save" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save Flash Sale' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-glass small">
        <div class="modal-header">
          <h2>Delete Flash Sale</h2>
          <button class="btn-icon" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Delete "<strong>{{ deleteTarget.name }}</strong>"? This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="deleteTarget = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const sales = ref([])
const loading = ref(true)
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const deleteTarget = ref(null)
const appliesIdsText = ref('')

const emptyForm = () => ({
  name: '', slug: '', description: '', badge_label: 'Flash Sale',
  discount_type: 'percent', discount_value: 20,
  applies_to: 'all', applies_to_ids: [],
  min_purchase: 0, max_uses: 0,
  starts_at: '', ends_at: '',
  active: true, show_countdown: true
})
const form = ref(emptyForm())

const activeSales = computed(() => sales.value.filter(s => s.is_active))
const upcomingSales = computed(() => sales.value.filter(s => s.active && !s.is_active && s.starts_at && new Date(s.starts_at) > new Date()))
const expiredSales = computed(() => sales.value.filter(s => s.ends_at && new Date(s.ends_at) < new Date()))

async function load() {
  loading.value = true
  try {
    const r = await api.get('/flash-sales')
    sales.value = r.data
  } finally {
    loading.value = false
  }
}

onMounted(load)

function autoSlug() {
  if (!editing.value) {
    form.value.slug = form.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
}

function openCreate() {
  editing.value = null
  form.value = emptyForm()
  appliesIdsText.value = ''
  showModal.value = true
}

function openEdit(fs) {
  editing.value = fs
  form.value = {
    name: fs.name, slug: fs.slug, description: fs.description || '',
    badge_label: fs.badge_label || 'Flash Sale',
    discount_type: fs.discount_type, discount_value: fs.discount_value,
    applies_to: fs.applies_to, applies_to_ids: fs.applies_to_ids || [],
    min_purchase: fs.min_purchase || 0, max_uses: fs.max_uses || 0,
    starts_at: fs.starts_at ? fs.starts_at.slice(0, 16) : '',
    ends_at: fs.ends_at ? fs.ends_at.slice(0, 16) : '',
    active: !!fs.active, show_countdown: !!fs.show_countdown
  }
  appliesIdsText.value = (fs.applies_to_ids || []).join(', ')
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editing.value = null
}

async function save() {
  if (!form.value.name || !form.value.slug) return alert('Name and slug are required')
  saving.value = true
  try {
    const payload = {
      ...form.value,
      applies_to_ids: appliesIdsText.value
        ? appliesIdsText.value.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      starts_at: form.value.starts_at || null,
      ends_at: form.value.ends_at || null,
    }
    if (editing.value) {
      await api.put(`/flash-sales/${editing.value.id}`, payload)
    } else {
      await api.post('/flash-sales', payload)
    }
    closeModal()
    load()
  } catch (err) {
    alert(err.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

function confirmDelete(fs) {
  deleteTarget.value = fs
}

async function doDelete() {
  await api.delete(`/flash-sales/${deleteTarget.value.id}`)
  deleteTarget.value = null
  load()
}

function discountLabel(fs) {
  if (fs.discount_type === 'free_shipping') return '🚚 Free Shipping'
  if (fs.discount_type === 'percent') return `${fs.discount_value}% OFF`
  return `€${fs.discount_value} OFF`
}

function appliesToLabel(fs) {
  if (fs.applies_to === 'all') return 'All Products'
  if (fs.applies_to === 'category') return `Categories (${(fs.applies_to_ids || []).length})`
  return `Products (${(fs.applies_to_ids || []).length})`
}

function statusClass(fs) {
  if (fs.is_active) return 'active'
  if (!fs.active) return 'inactive'
  if (fs.starts_at && new Date(fs.starts_at) > new Date()) return 'scheduled'
  return 'expired'
}

function statusLabel(fs) {
  if (fs.is_active) return '🟢 Active'
  if (!fs.active) return '⚫ Inactive'
  if (fs.starts_at && new Date(fs.starts_at) > new Date()) return '🕐 Scheduled'
  return '⚫ Expired'
}

function formatDt(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

function timeLeft(endsAt) {
  const diff = new Date(endsAt) - new Date()
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h ${m}m`
}
</script>

<style scoped>
.flash-sales-view { padding: 2rem; max-width: 1200px; margin: 0 auto; }
.view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.view-header h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
.subtitle { color: var(--text-muted, #888); margin: 0; font-size: .9rem; }
.stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: hsl(228,4%,15%); border-radius: 1rem; padding: 1.25rem; text-align: center; border: 1px solid rgba(255,255,255,.06); }
.stat-num { font-size: 2rem; font-weight: 700; color: var(--accent, #e05260); }
.stat-label { font-size: .8rem; color: #888; margin-top: .25rem; }
.glass-card { background: hsl(228,4%,15%); border-radius: 1.5rem; padding: 1.5rem; border: 1px solid rgba(255,255,255,.06); }
.table-card { padding: 0; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { padding: .75rem 1rem; text-align: left; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: #666; border-bottom: 1px solid rgba(255,255,255,.06); }
.data-table td { padding: .75rem 1rem; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: rgba(255,255,255,.02); }
.sale-name { font-weight: 600; }
.sale-slug { font-size: .75rem; color: #666; }
.discount-badge { display: inline-block; padding: .25rem .6rem; border-radius: .5rem; font-size: .8rem; font-weight: 700; }
.discount-badge.percent { background: hsl(355,70%,20%); color: hsl(355,70%,70%); }
.discount-badge.fixed { background: hsl(210,70%,20%); color: hsl(210,70%,70%); }
.discount-badge.free_shipping { background: hsl(140,50%,18%); color: hsl(140,60%,65%); }
.applies-pill { display: inline-block; padding: .2rem .5rem; border-radius: .4rem; background: rgba(255,255,255,.06); font-size: .78rem; color: #aaa; }
.schedule-info { font-size: .78rem; line-height: 1.6; color: #aaa; }
.time-left { color: hsl(355,70%,65%); font-weight: 600; }
.status-pill { display: inline-block; padding: .2rem .6rem; border-radius: .5rem; font-size: .78rem; font-weight: 600; }
.status-pill.active { background: hsl(140,50%,18%); color: hsl(140,60%,65%); }
.status-pill.inactive, .status-pill.expired { background: rgba(255,255,255,.06); color: #666; }
.status-pill.scheduled { background: hsl(45,70%,18%); color: hsl(45,70%,65%); }
.actions-cell { display: flex; gap: .5rem; align-items: center; }
.btn-accent { background: var(--accent, #e05260); color: #fff; border: none; padding: .6rem 1.2rem; border-radius: .75rem; cursor: pointer; font-weight: 600; font-size: .9rem; }
.btn-secondary { background: rgba(255,255,255,.08); color: #ccc; border: none; padding: .6rem 1.2rem; border-radius: .75rem; cursor: pointer; font-weight: 600; }
.btn-danger { background: hsl(355,70%,40%); color: #fff; border: none; padding: .6rem 1.2rem; border-radius: .75rem; cursor: pointer; font-weight: 600; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1rem; padding: .25rem .4rem; border-radius: .4rem; }
.btn-icon:hover { background: rgba(255,255,255,.08); }
.btn-icon.danger:hover { background: hsl(355,70%,20%); }
.empty-state { padding: 3rem; text-align: center; color: #666; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-glass { background: hsl(228,4%,13%); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; backdrop-filter: blur(16px); width: 90%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
.modal-glass.large { max-width: 720px; }
.modal-glass.small { max-width: 420px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.06); }
.modal-header h2 { margin: 0; font-size: 1.2rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.06); display: flex; gap: .75rem; justify-content: flex-end; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: .4rem; }
.field.full { grid-column: 1/-1; }
.field label { font-size: .8rem; color: #aaa; font-weight: 600; }
.field input, .field select, .field textarea { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .6rem; padding: .55rem .75rem; color: #fff; font-size: .9rem; font-family: inherit; }
.field textarea { resize: vertical; }
.field-section { border-top: 1px solid rgba(255,255,255,.06); padding-top: 1rem; }
.field-section h3 { margin: 0 0 .5rem; font-size: .9rem; color: #aaa; }
.toggle { display: flex; align-items: center; gap: .75rem; cursor: pointer; font-size: .85rem; color: #ccc; }
.toggle input { display: none; }
.slider { width: 36px; height: 20px; background: rgba(255,255,255,.12); border-radius: 10px; position: relative; transition: background .2s; flex-shrink: 0; }
.slider::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; top: 3px; left: 3px; transition: transform .2s; }
.toggle input:checked ~ .slider { background: var(--accent, #e05260); }
.toggle input:checked ~ .slider::after { transform: translateX(16px); }
.text-muted { color: #555; }
</style>
