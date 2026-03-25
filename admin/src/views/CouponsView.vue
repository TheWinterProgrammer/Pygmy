<template>
  <div>
    <div class="page-header">
      <h1>🎟️ Coupons</h1>
      <div style="display:flex;gap:.75rem;align-items:center">
        <RouterLink to="/coupon-analytics" class="btn btn-ghost">📊 Analytics</RouterLink>
        <button class="btn btn-primary" @click="openCreate">+ New Coupon</button>
      </div>
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
      <div class="cstat glass">
        <div class="cstat-num">{{ coupons.filter(c => c.type === 'free_shipping').length }}</div>
        <div class="cstat-label">Free Shipping</div>
      </div>
      <div class="cstat glass">
        <div class="cstat-num">{{ coupons.filter(c => c.type === 'bogo').length }}</div>
        <div class="cstat-label">BOGO</div>
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
            <th>Value / Condition</th>
            <th>Min. Order</th>
            <th>Uses</th>
            <th>Expires</th>
            <th>Status</th>
            <th style="width:130px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in coupons" :key="c.id">
            <td>
              <code class="coupon-code">{{ c.code }}</code>
              <div v-if="c.product_ids?.length || c.category_ids?.length" class="text-muted" style="font-size:11px;margin-top:2px;">
                {{ c.product_ids?.length ? `${c.product_ids.length} products` : '' }}
                {{ c.category_ids?.length ? `${c.category_ids.length} categories` : '' }}
              </div>
            </td>
            <td>
              <span class="badge" :class="typeBadgeClass(c.type)">
                {{ typeLabel(c.type) }}
              </span>
            </td>
            <td>
              <strong v-if="c.type === 'percentage'">{{ c.value }}%</strong>
              <strong v-else-if="c.type === 'fixed'">€{{ Number(c.value).toFixed(2) }} off</strong>
              <strong v-else-if="c.type === 'free_shipping'">Free shipping</strong>
              <strong v-else-if="c.type === 'bogo'">Buy {{ c.bogo_buy_qty }} Get {{ c.bogo_get_qty }} Free</strong>
              <div v-if="c.max_uses_per_customer" class="text-muted" style="font-size:11px;">
                Max {{ c.max_uses_per_customer }}x per customer
              </div>
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
              <button class="btn btn-ghost btn-sm" @click="openUsage(c)">Usage</button>
              <button class="btn btn-ghost btn-sm" @click="openEdit(c)">Edit</button>
              <button class="btn btn-ghost btn-sm btn-danger" @click="confirmDelete(c)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" v-else-if="!loading">
        <p>No coupons yet.</p>
        <button class="btn btn-primary" @click="openCreate">Create first coupon</button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal glass" style="max-width:600px;max-height:90vh;overflow-y:auto;">
        <div class="modal-header">
          <h2>{{ editId ? 'Edit Coupon' : 'New Coupon' }}</h2>
          <button class="modal-close" @click="showModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>Coupon Code *</label>
              <input v-model="form.code" class="form-input" placeholder="SUMMER20" style="text-transform:uppercase;" />
            </div>
            <div class="form-group">
              <label>Type *</label>
              <select v-model="form.type" class="form-select">
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
                <option value="free_shipping">Free shipping</option>
                <option value="bogo">Buy X Get Y (BOGO)</option>
              </select>
            </div>
          </div>

          <!-- Value (not for free_shipping) -->
          <div class="form-group" v-if="!['free_shipping', 'bogo'].includes(form.type)">
            <label>{{ form.type === 'percentage' ? 'Discount %' : 'Discount Amount (€)' }} *</label>
            <input v-model.number="form.value" type="number" min="0.01" :max="form.type === 'percentage' ? 100 : undefined" step="0.01" class="form-input" />
          </div>

          <!-- BOGO fields -->
          <div v-if="form.type === 'bogo'" class="form-row">
            <div class="form-group">
              <label>Buy Qty (X)</label>
              <input v-model.number="form.bogo_buy_qty" type="number" min="1" class="form-input" />
            </div>
            <div class="form-group">
              <label>Get Qty Free (Y)</label>
              <input v-model.number="form.bogo_get_qty" type="number" min="1" class="form-input" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Min. Order Amount (€)</label>
              <input v-model.number="form.min_order_amount" type="number" min="0" step="0.01" class="form-input" />
            </div>
            <div class="form-group">
              <label>Max Uses (0 = unlimited)</label>
              <input v-model.number="form.max_uses" type="number" min="0" class="form-input" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Max Uses Per Customer (0 = unlimited)</label>
              <input v-model.number="form.max_uses_per_customer" type="number" min="0" class="form-input" />
            </div>
            <div class="form-group">
              <label>Expiry Date (optional)</label>
              <input v-model="form.expires_at" type="date" class="form-input" />
            </div>
          </div>

          <!-- Product restrictions -->
          <div class="form-group">
            <label>Restrict to Product IDs (comma-separated, leave blank for all)</label>
            <input v-model="productIdsInput" class="form-input" placeholder="e.g. 1,5,12" />
            <div class="form-hint">Leave empty to apply to all products</div>
          </div>

          <div class="form-group">
            <label>Status</label>
            <label class="toggle-label">
              <input type="checkbox" v-model="form.active" />
              <span>Active</span>
            </label>
          </div>

          <div v-if="error" class="alert-error">{{ error }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveCoupon" :disabled="saving">
            {{ saving ? 'Saving…' : (editId ? 'Update Coupon' : 'Create Coupon') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Usage History Modal -->
    <div class="modal-overlay" v-if="showUsageModal" @click.self="showUsageModal = false">
      <div class="modal glass" style="max-width:600px;max-height:80vh;overflow-y:auto;">
        <div class="modal-header">
          <h2>📊 Usage: <code>{{ usageCoupon?.code }}</code></h2>
          <button class="modal-close" @click="showUsageModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="usageData.length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer Email</th>
                  <th>Discount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in usageData" :key="u.id">
                  <td><code>{{ u.order_number }}</code></td>
                  <td>{{ u.customer_email || '—' }}</td>
                  <td>€{{ Number(u.discount_amount).toFixed(2) }}</td>
                  <td class="text-muted">{{ formatDate(u.used_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state"><p>No usage recorded yet.</p></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showUsageModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass modal-sm">
        <div class="modal-header">
          <h2>Delete Coupon</h2>
          <button class="modal-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Delete coupon <code>{{ deleteTarget.code }}</code>? This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteCoupon">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const API = 'http://localhost:3200/api'
const token = localStorage.getItem('pygmy_token')

const coupons = ref([])
const loading = ref(false)
const showModal = ref(false)
const saving = ref(false)
const error = ref('')
const editId = ref(null)
const deleteTarget = ref(null)
const showUsageModal = ref(false)
const usageCoupon = ref(null)
const usageData = ref([])
const productIdsInput = ref('')

const defaultForm = () => ({
  code: '', type: 'percentage', value: 10, min_order_amount: 0,
  max_uses: 0, max_uses_per_customer: 0, expires_at: '',
  product_ids: [], category_ids: [], bogo_buy_qty: 1, bogo_get_qty: 1, active: true,
})
const form = ref(defaultForm())

function typeLabel(type) {
  return { percentage: '% Off', fixed: '€ Fixed', free_shipping: '🚚 Free Ship', bogo: 'BOGO' }[type] || type
}
function typeBadgeClass(type) {
  return { percentage: 'badge-blue', fixed: 'badge-orange', free_shipping: 'badge-green', bogo: 'badge-purple' }[type] || 'badge-blue'
}
function isExpired(d) { return d && new Date(d) < new Date() }
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load() {
  loading.value = true
  const res = await fetch(`${API}/coupons`, { headers: { Authorization: `Bearer ${token}` } })
  coupons.value = await res.json()
  loading.value = false
}

function openCreate() {
  editId.value = null
  form.value = defaultForm()
  productIdsInput.value = ''
  error.value = ''
  showModal.value = true
}

function openEdit(c) {
  editId.value = c.id
  form.value = {
    code: c.code, type: c.type, value: c.value,
    min_order_amount: c.min_order_amount, max_uses: c.max_uses,
    max_uses_per_customer: c.max_uses_per_customer || 0,
    expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '',
    product_ids: c.product_ids || [], category_ids: c.category_ids || [],
    bogo_buy_qty: c.bogo_buy_qty || 1, bogo_get_qty: c.bogo_get_qty || 1,
    active: !!c.active,
  }
  productIdsInput.value = (c.product_ids || []).join(',')
  error.value = ''
  showModal.value = true
}

async function openUsage(c) {
  usageCoupon.value = c
  usageData.value = []
  showUsageModal.value = true
  try {
    const res = await fetch(`${API}/coupons/${c.id}/usage`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    usageData.value = data.usage || []
  } catch {}
}

async function saveCoupon() {
  error.value = ''
  saving.value = true
  try {
    // Parse product IDs from comma-separated input
    const productIds = productIdsInput.value
      ? productIdsInput.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : []

    const body = {
      ...form.value,
      code: form.value.code.toUpperCase(),
      product_ids: productIds,
      expires_at: form.value.expires_at || null,
    }

    const url = editId.value ? `${API}/coupons/${editId.value}` : `${API}/coupons`
    const method = editId.value ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { error.value = data.error || 'Save failed'; return }
    showModal.value = false
    load()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

function confirmDelete(c) { deleteTarget.value = c }
async function deleteCoupon() {
  await fetch(`${API}/coupons/${deleteTarget.value.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  deleteTarget.value = null
  load()
}

onMounted(load)
</script>

<style scoped>
.coupon-stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.cstat { padding: 16px 24px; text-align: center; border-radius: 12px; min-width: 80px; }
.cstat-num { font-size: 26px; font-weight: 700; color: var(--accent); }
.cstat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
code.coupon-code { background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 6px; font-size: 13px; letter-spacing: 1px; }
.badge-purple { background: rgba(168,85,247,0.2); color: #d8b4fe; border: 1px solid rgba(168,85,247,0.3); }
.text-warning { color: #fbbf24; }
.form-hint { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
</style>
