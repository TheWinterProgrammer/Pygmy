<template>
  <div>
    <div class="page-header">
      <h1>🎟️ Coupons</h1>
      <button class="btn btn-primary" @click="openCreate">+ New Coupon</button>
    </div>

    <!-- Stats strip -->
    <div class="coupon-stats" v-if="coupons.length">
      <div class="cstat glass">
        <div class="cstat-num">{{ coupons.length }}</div>
        <div class="cstat-label">Total</div>
      </div>
      <div class="cstat glass">
        <div class="cstat-num">{{ coupons.filter(c => c.active).length }}</div>
        <div class="cstat-label">Active</div>
      </div>
      <div class="cstat glass">
        <div class="cstat-num">{{ coupons.reduce((s, c) => s + (c.used_count || 0), 0) }}</div>
        <div class="cstat-label">Total Uses</div>
      </div>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <div class="loading-bar" v-if="loading"></div>
      <table class="data-table" v-if="coupons.length">
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Value</th>
            <th>Min. Order</th>
            <th>Uses</th>
            <th>Expires</th>
            <th>Status</th>
            <th style="width:100px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in coupons" :key="c.id">
            <td>
              <code class="coupon-code">{{ c.code }}</code>
            </td>
            <td>
              <span class="badge" :class="c.type === 'percentage' ? 'badge-blue' : 'badge-orange'">
                {{ c.type === 'percentage' ? '%' : '€ Fixed' }}
              </span>
            </td>
            <td>
              <strong>{{ c.type === 'percentage' ? `${c.value}%` : `€${Number(c.value).toFixed(2)}` }}</strong>
            </td>
            <td>{{ c.min_order_amount > 0 ? `€${Number(c.min_order_amount).toFixed(2)}` : '—' }}</td>
            <td>
              <span :class="{ 'text-warning': c.max_uses > 0 && c.used_count >= c.max_uses }">
                {{ c.used_count }}
                <span class="text-muted" v-if="c.max_uses > 0"> / {{ c.max_uses }}</span>
                <span class="text-muted" v-else> / ∞</span>
              </span>
            </td>
            <td>
              <span v-if="c.expires_at" :class="{ 'text-warning': isExpired(c.expires_at) }">
                {{ formatDate(c.expires_at) }}
                <span v-if="isExpired(c.expires_at)"> (expired)</span>
              </span>
              <span v-else class="text-muted">Never</span>
            </td>
            <td>
              <span class="status-pill" :class="c.active ? 'pill-green' : 'pill-grey'">
                {{ c.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="row-actions">
              <button class="btn btn-ghost btn-sm" @click="openEdit(c)">Edit</button>
              <button class="btn btn-ghost btn-sm btn-danger" @click="confirmDelete(c)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" v-else-if="!loading">
        <div style="font-size:2.5rem;margin-bottom:.5rem">🎟️</div>
        <p>No coupons yet. Create one to offer discounts to customers.</p>
        <button class="btn btn-primary" @click="openCreate">Create Coupon</button>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ editing ? 'Edit Coupon' : 'New Coupon' }}</h2>
          <button class="btn-close" @click="showModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Coupon Code <span class="req">*</span></label>
            <div style="display:flex;gap:.5rem;align-items:center;">
              <input v-model="form.code" class="input" placeholder="SUMMER20" style="text-transform:uppercase;flex:1;" />
              <button type="button" class="btn btn-ghost btn-sm" @click="generateCode" title="Generate random code">🎲</button>
            </div>
            <small class="hint">Codes are case-insensitive. Will be stored as uppercase.</small>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Discount Type <span class="req">*</span></label>
              <select v-model="form.type" class="select">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (€)</option>
              </select>
            </div>
            <div class="form-group">
              <label>
                {{ form.type === 'percentage' ? 'Percentage Off (%)' : 'Amount Off (€)' }}
                <span class="req">*</span>
              </label>
              <input v-model.number="form.value" class="input" type="number" min="0.01" step="0.01"
                :max="form.type === 'percentage' ? 100 : undefined"
                :placeholder="form.type === 'percentage' ? '20' : '10.00'" />
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Minimum Order Amount (€)</label>
              <input v-model.number="form.min_order_amount" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
              <small class="hint">0 = no minimum</small>
            </div>
            <div class="form-group">
              <label>Maximum Uses</label>
              <input v-model.number="form.max_uses" class="input" type="number" min="0" step="1" placeholder="0" />
              <small class="hint">0 = unlimited</small>
            </div>
          </div>

          <div class="form-group">
            <label>Expires At</label>
            <input v-model="form.expires_at" class="input" type="datetime-local" />
            <small class="hint">Leave blank for no expiry.</small>
          </div>

          <label class="checkbox-row" style="margin-top:.5rem;">
            <input type="checkbox" v-model="form.active" />
            <span>Active (customers can use this coupon)</span>
          </label>

          <div class="form-error" v-if="formError">{{ formError }}</div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveCoupon" :disabled="saving">
            {{ saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Coupon') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass" style="max-width:400px;">
        <div class="modal-header">
          <h2>Delete Coupon</h2>
          <button class="btn-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Delete coupon <strong>{{ deleteTarget.code }}</strong>? This cannot be undone.</p>
          <p class="text-muted" style="font-size:.85rem;" v-if="deleteTarget.used_count > 0">
            ⚠️ This coupon has been used {{ deleteTarget.used_count }} time{{ deleteTarget.used_count !== 1 ? 's' : '' }}.
            Existing orders will not be affected.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-primary btn-danger" @click="deleteCoupon" :disabled="saving">
            {{ saving ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast   = useToastStore()
const coupons = ref([])
const loading = ref(false)
const saving  = ref(false)
const showModal   = ref(false)
const deleteTarget = ref(null)
const editing      = ref(null)
const formError    = ref('')

const defaultForm = () => ({
  code: '', type: 'percentage', value: null,
  min_order_amount: 0, max_uses: 0,
  expires_at: '', active: true,
})
const form = ref(defaultForm())

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/coupons')
    coupons.value = data
  } catch {
    toast.error('Failed to load coupons')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  editing.value = null
  form.value = defaultForm()
  formError.value = ''
  showModal.value = true
}

function openEdit(c) {
  editing.value = c
  form.value = {
    code: c.code,
    type: c.type,
    value: c.value,
    min_order_amount: c.min_order_amount,
    max_uses: c.max_uses,
    expires_at: c.expires_at ? c.expires_at.slice(0, 16) : '',
    active: Boolean(c.active),
  }
  formError.value = ''
  showModal.value = true
}

function confirmDelete(c) {
  deleteTarget.value = c
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  form.value.code = code
}

function isExpired(dt) {
  return dt && new Date(dt) < new Date()
}

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function saveCoupon() {
  formError.value = ''
  if (!form.value.code?.trim()) { formError.value = 'Coupon code is required.'; return }
  if (!form.value.value || form.value.value <= 0) { formError.value = 'Discount value must be greater than 0.'; return }
  if (form.value.type === 'percentage' && form.value.value > 100) { formError.value = 'Percentage cannot exceed 100.'; return }

  saving.value = true
  try {
    const payload = {
      ...form.value,
      expires_at: form.value.expires_at || null,
    }
    if (editing.value) {
      const { data } = await api.put(`/coupons/${editing.value.id}`, payload)
      const idx = coupons.value.findIndex(c => c.id === editing.value.id)
      if (idx !== -1) coupons.value[idx] = data
      toast.success('Coupon updated')
    } else {
      const { data } = await api.post('/coupons', payload)
      coupons.value.unshift(data)
      toast.success('Coupon created')
    }
    showModal.value = false
  } catch (e) {
    formError.value = e.response?.data?.error || 'Save failed.'
  } finally {
    saving.value = false
  }
}

async function deleteCoupon() {
  if (!deleteTarget.value) return
  saving.value = true
  try {
    await api.delete(`/coupons/${deleteTarget.value.id}`)
    coupons.value = coupons.value.filter(c => c.id !== deleteTarget.value.id)
    toast.success('Coupon deleted')
    deleteTarget.value = null
  } catch {
    toast.error('Delete failed')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.coupon-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.cstat {
  padding: .875rem 1.25rem;
  border-radius: 1rem;
  min-width: 110px;
  text-align: center;
}
.cstat-num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.cstat-label { font-size: .75rem; color: var(--text-muted); margin-top: .2rem; }

.coupon-code {
  font-family: 'JetBrains Mono', monospace;
  background: rgba(255,255,255,.06);
  padding: .2em .5em;
  border-radius: .3em;
  font-size: .88rem;
  letter-spacing: .05em;
}

.badge {
  display: inline-flex; align-items: center;
  padding: .25em .6em; border-radius: 999px;
  font-size: .75rem; font-weight: 600;
}
.badge-blue { background: hsl(220,70%,22%); color: hsl(220,70%,70%); }
.badge-orange { background: hsl(30,70%,22%); color: hsl(30,80%,70%); }

.status-pill {
  display: inline-flex; align-items: center;
  padding: .2em .7em; border-radius: 999px;
  font-size: .75rem; font-weight: 600;
}
.pill-green { background: hsl(140,60%,15%); color: hsl(140,60%,60%); }
.pill-grey  { background: rgba(255,255,255,.07); color: var(--text-muted); }

.text-warning { color: hsl(45, 90%, 60%); }
.text-muted { color: var(--text-muted); }

.row-actions { display: flex; gap: .4rem; }
.btn-danger { color: var(--accent) !important; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal {
  width: 100%; max-width: 540px;
  border-radius: 1.25rem;
  overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.btn-close {
  background: none; border: none;
  color: var(--text-muted); font-size: 1rem;
  cursor: pointer; padding: .25rem .5rem; border-radius: .4rem;
}
.btn-close:hover { background: rgba(255,255,255,.08); color: var(--text); }
.modal-body { padding: 1.5rem; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: .75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
}

.form-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.form-group label { font-size: .85rem; font-weight: 600; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 480px) { .form-row-2 { grid-template-columns: 1fr; } }

.hint { font-size: .75rem; color: var(--text-muted); }
.req { color: var(--accent); }
.form-error {
  color: var(--accent); font-size: .85rem;
  background: rgba(var(--accent-rgb), .1);
  border: 1px solid rgba(var(--accent-rgb), .25);
  border-radius: .5rem; padding: .5rem .75rem;
  margin-top: .5rem;
}

.checkbox-row {
  display: flex; align-items: center; gap: .5rem;
  cursor: pointer; font-size: .88rem;
}
.checkbox-row input { accent-color: var(--accent); width: 16px; height: 16px; }

.table-wrap { border-radius: 1rem; overflow: hidden; position: relative; }
.empty-state { padding: 3rem; text-align: center; color: var(--text-muted); }
</style>
