<template>
  <div class="customer-groups-view">
    <div class="page-header">
      <div>
        <h1>👥 Customer Groups</h1>
        <p class="subtitle">Segment customers for group pricing and targeted discounts</p>
      </div>
      <button class="btn-primary" @click="openCreate">+ New Group</button>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip">
      <div class="stat-card">
        <span class="stat-value">{{ groups.length }}</span>
        <span class="stat-label">Total Groups</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ groups.filter(g => g.active).length }}</span>
        <span class="stat-label">Active</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ groups.reduce((s, g) => s + (g.member_count || 0), 0) }}</span>
        <span class="stat-label">Total Members</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ groups.reduce((s, g) => s + (g.price_override_count || 0), 0) }}</span>
        <span class="stat-label">Price Overrides</span>
      </div>
    </div>

    <!-- Groups table -->
    <div class="glass-card table-card">
      <div class="table-header">
        <input v-model="search" placeholder="Search groups…" class="search-input" @input="loadGroups" />
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Members</th>
            <th>Discount</th>
            <th>Price Overrides</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!groups.length">
            <td colspan="6" class="empty-row">No customer groups yet. Create one above.</td>
          </tr>
          <tr v-for="g in groups" :key="g.id">
            <td>
              <div class="group-name-cell">
                <span class="group-color-dot" :style="{ background: g.color }"></span>
                <div>
                  <strong>{{ g.name }}</strong>
                  <small class="slug-text">{{ g.slug }}</small>
                </div>
              </div>
            </td>
            <td>
              <span class="badge badge-blue">{{ g.member_count || 0 }} members</span>
            </td>
            <td>
              <span v-if="g.discount_pct > 0" class="badge badge-green">{{ g.discount_pct }}% off</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span v-if="g.price_override_count > 0" class="badge badge-purple">{{ g.price_override_count }} products</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span class="status-pill" :class="g.active ? 'active' : 'inactive'">
                {{ g.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="actions-cell">
              <button class="btn-icon" title="Manage Members" @click="openMembers(g)">👥</button>
              <button class="btn-icon" title="Manage Pricing" @click="openPricing(g)">💰</button>
              <button class="btn-icon" title="Edit" @click="openEdit(g)">✏️</button>
              <button class="btn-icon btn-danger" title="Delete" @click="deleteGroup(g)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal-card">
        <h2>{{ editing ? 'Edit Group' : 'New Customer Group' }}</h2>
        <div class="form-grid">
          <label>Name *
            <input v-model="form.name" placeholder="VIP Customers" @input="autoSlug" />
          </label>
          <label>Slug *
            <input v-model="form.slug" placeholder="vip-customers" />
          </label>
          <label class="full-width">Description
            <textarea v-model="form.description" rows="2" placeholder="Optional description…"></textarea>
          </label>
          <label>Discount % (applied to all products unless overridden)
            <input v-model.number="form.discount_pct" type="number" min="0" max="100" step="0.1" placeholder="0" />
          </label>
          <label>Color
            <div class="color-picker-row">
              <input v-model="form.color" type="color" class="color-input" />
              <span>{{ form.color }}</span>
            </div>
          </label>
          <label class="full-width toggle-label">
            <input v-model="form.active" type="checkbox" />
            Active
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showForm = false">Cancel</button>
          <button class="btn-primary" :disabled="saving" @click="saveGroup">
            {{ saving ? 'Saving…' : 'Save Group' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Members Modal -->
    <div v-if="showMembers" class="modal-overlay" @click.self="showMembers = false">
      <div class="modal-card modal-wide">
        <h2>👥 Members — {{ currentGroup?.name }}</h2>

        <!-- Search customers to add -->
        <div class="member-search-section">
          <input v-model="memberSearch" placeholder="Search customers by email or name…"
            class="search-input" @input="searchCustomers" />
          <ul v-if="customerResults.length" class="customer-dropdown">
            <li v-for="c in customerResults" :key="c.id" @click="addMember(c)">
              <strong>{{ c.first_name }} {{ c.last_name }}</strong>
              <small>{{ c.email }}</small>
            </li>
          </ul>
        </div>

        <table class="data-table" style="margin-top: 1rem">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!groupDetail?.members?.length">
              <td colspan="4" class="empty-row">No members yet. Search above to add customers.</td>
            </tr>
            <tr v-for="m in groupDetail?.members" :key="m.id">
              <td>{{ m.first_name }} {{ m.last_name }}</td>
              <td>{{ m.email }}</td>
              <td>{{ new Date(m.added_at).toLocaleDateString() }}</td>
              <td>
                <button class="btn-icon btn-danger" @click="removeMember(m.id)">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showMembers = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Group Pricing Modal -->
    <div v-if="showPricing" class="modal-overlay" @click.self="showPricing = false">
      <div class="modal-card modal-wide">
        <h2>💰 Price Overrides — {{ currentGroup?.name }}</h2>
        <p class="subtitle">Set specific prices per product for this group. Leave blank to use group discount.</p>

        <!-- Search products to add pricing -->
        <div class="member-search-section">
          <input v-model="productSearch" placeholder="Search products…"
            class="search-input" @input="searchProducts" />
          <ul v-if="productResults.length" class="customer-dropdown">
            <li v-for="p in productResults" :key="p.id" @click="startAddPrice(p)">
              <strong>{{ p.name }}</strong>
              <small>Base: {{ currency }}{{ p.price }}</small>
            </li>
          </ul>
        </div>

        <!-- Add price form -->
        <div v-if="newPriceProduct" class="new-price-form glass-inset">
          <span>Setting price for <strong>{{ newPriceProduct.name }}</strong> (base: {{ currency }}{{ newPriceProduct.price }})</span>
          <div class="price-input-row">
            <label>Group Price
              <input v-model.number="newPrice" type="number" min="0" step="0.01" placeholder="0.00" />
            </label>
            <button class="btn-primary" @click="saveGroupPrice">Set Price</button>
            <button class="btn-secondary" @click="newPriceProduct = null">Cancel</button>
          </div>
        </div>

        <table class="data-table" style="margin-top: 1rem">
          <thead>
            <tr>
              <th>Product</th>
              <th>Base Price</th>
              <th>Group Price</th>
              <th>Savings</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!groupDetail?.prices?.length">
              <td colspan="5" class="empty-row">No price overrides. Search products above to add.</td>
            </tr>
            <tr v-for="p in groupDetail?.prices" :key="p.product_id">
              <td>{{ p.product_name }}</td>
              <td>{{ currency }}{{ p.base_price }}</td>
              <td><strong>{{ currency }}{{ p.price }}</strong></td>
              <td>
                <span v-if="p.base_price > p.price" class="badge badge-green">
                  -{{ Math.round((1 - p.price / p.base_price) * 100) }}%
                </span>
              </td>
              <td>
                <button class="btn-icon btn-danger" @click="removeGroupPrice(p.product_id)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showPricing = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API = 'http://localhost:3200/api'
const token = () => localStorage.getItem('pygmy_token')
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

const groups       = ref([])
const search       = ref('')
const saving       = ref(false)
const showForm     = ref(false)
const showMembers  = ref(false)
const showPricing  = ref(false)
const editing      = ref(null)
const currentGroup = ref(null)
const groupDetail  = ref(null)
const currency     = ref('$')

const form = ref({ name: '', slug: '', description: '', discount_pct: 0, active: true, color: '#6366f1' })

// Members
const memberSearch     = ref('')
const customerResults  = ref([])

// Pricing
const productSearch  = ref('')
const productResults = ref([])
const newPriceProduct = ref(null)
const newPrice        = ref(0)

async function loadGroups() {
  const q = search.value ? `?q=${encodeURIComponent(search.value)}` : ''
  const r = await fetch(`${API}/customer-groups${q}`, { headers: headers() })
  groups.value = await r.json()
}

async function loadSettings() {
  const r = await fetch(`${API}/settings`)
  const s = await r.json()
  currency.value = s.shop_currency_symbol || '$'
}

onMounted(() => { loadGroups(); loadSettings() })

function autoSlug() {
  if (!editing.value) {
    form.value.slug = form.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', slug: '', description: '', discount_pct: 0, active: true, color: '#6366f1' }
  showForm.value = true
}

function openEdit(g) {
  editing.value = g
  form.value = { name: g.name, slug: g.slug, description: g.description || '', discount_pct: g.discount_pct, active: !!g.active, color: g.color || '#6366f1' }
  showForm.value = true
}

async function saveGroup() {
  saving.value = true
  const url = editing.value ? `${API}/customer-groups/${editing.value.id}` : `${API}/customer-groups`
  const method = editing.value ? 'PUT' : 'POST'
  await fetch(url, { method, headers: headers(), body: JSON.stringify(form.value) })
  saving.value = false
  showForm.value = false
  loadGroups()
}

async function deleteGroup(g) {
  if (!confirm(`Delete group "${g.name}"? This will remove all member assignments.`)) return
  await fetch(`${API}/customer-groups/${g.id}`, { method: 'DELETE', headers: headers() })
  loadGroups()
}

// Members
async function openMembers(g) {
  currentGroup.value = g
  showMembers.value = true
  memberSearch.value = ''
  customerResults.value = []
  await loadGroupDetail(g.id)
}

async function loadGroupDetail(id) {
  const r = await fetch(`${API}/customer-groups/${id}`, { headers: headers() })
  groupDetail.value = await r.json()
}

let memberTimer = null
function searchCustomers() {
  clearTimeout(memberTimer)
  if (!memberSearch.value.trim()) { customerResults.value = []; return }
  memberTimer = setTimeout(async () => {
    const r = await fetch(`${API}/customers?q=${encodeURIComponent(memberSearch.value)}&limit=10`, { headers: headers() })
    const data = await r.json()
    customerResults.value = Array.isArray(data) ? data : (data.items || [])
  }, 300)
}

async function addMember(c) {
  await fetch(`${API}/customer-groups/${currentGroup.value.id}/members`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ customer_ids: [c.id] })
  })
  customerResults.value = []
  memberSearch.value = ''
  await loadGroupDetail(currentGroup.value.id)
  loadGroups()
}

async function removeMember(customerId) {
  await fetch(`${API}/customer-groups/${currentGroup.value.id}/members/${customerId}`, {
    method: 'DELETE', headers: headers()
  })
  await loadGroupDetail(currentGroup.value.id)
  loadGroups()
}

// Pricing
async function openPricing(g) {
  currentGroup.value = g
  showPricing.value = true
  productSearch.value = ''
  productResults.value = []
  newPriceProduct.value = null
  await loadGroupDetail(g.id)
}

let productTimer = null
function searchProducts() {
  clearTimeout(productTimer)
  if (!productSearch.value.trim()) { productResults.value = []; return }
  productTimer = setTimeout(async () => {
    const r = await fetch(`${API}/products?all=1&q=${encodeURIComponent(productSearch.value)}&limit=10`, { headers: headers() })
    const data = await r.json()
    productResults.value = Array.isArray(data) ? data : (data.items || [])
  }, 300)
}

function startAddPrice(p) {
  newPriceProduct.value = p
  newPrice.value = p.price
  productResults.value = []
  productSearch.value = ''
}

async function saveGroupPrice() {
  if (!newPriceProduct.value) return
  await fetch(`${API}/customer-groups/${currentGroup.value.id}/pricing/${newPriceProduct.value.id}`, {
    method: 'PUT', headers: headers(),
    body: JSON.stringify({ price: newPrice.value })
  })
  newPriceProduct.value = null
  await loadGroupDetail(currentGroup.value.id)
  loadGroups()
}

async function removeGroupPrice(productId) {
  await fetch(`${API}/customer-groups/${currentGroup.value.id}/pricing/${productId}`, {
    method: 'DELETE', headers: headers()
  })
  await loadGroupDetail(currentGroup.value.id)
  loadGroups()
}
</script>

<style scoped>
.customer-groups-view { padding: 2rem; max-width: 1100px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
h1 { margin: 0; font-size: 1.6rem; }
.subtitle { color: var(--text-muted, #888); font-size: 0.9rem; margin: 0.25rem 0 0; }

.stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 1rem 1.25rem; }
.stat-value { display: block; font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.8rem; color: #888; }

.glass-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; padding: 1.5rem; }
.table-header { margin-bottom: 1rem; }
.search-input { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); color: inherit; border-radius: 0.75rem; padding: 0.5rem 1rem; font-size: 0.9rem; width: 280px; }

.data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: #888; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 500; }
.data-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: middle; }
.empty-row { text-align: center; color: #888; padding: 2rem !important; }

.group-name-cell { display: flex; align-items: center; gap: 0.75rem; }
.group-color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.slug-text { display: block; color: #888; font-size: 0.78rem; }

.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; }
.badge-blue   { background: rgba(99,102,241,0.2); color: #a5b4fc; }
.badge-green  { background: rgba(34,197,94,0.2); color: #86efac; }
.badge-purple { background: rgba(168,85,247,0.2); color: #d8b4fe; }
.text-muted { color: #666; }

.status-pill { display: inline-block; padding: 0.2rem 0.7rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
.status-pill.active   { background: rgba(34,197,94,0.15); color: #86efac; }
.status-pill.inactive { background: rgba(239,68,68,0.15); color: #fca5a5; }

.actions-cell { display: flex; gap: 0.5rem; }
.btn-primary { background: var(--accent, #e54e5d); color: #fff; border: none; border-radius: 0.75rem; padding: 0.6rem 1.25rem; cursor: pointer; font-weight: 600; font-size: 0.9rem; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: rgba(255,255,255,0.08); color: inherit; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.75rem; padding: 0.6rem 1.25rem; cursor: pointer; font-size: 0.9rem; }
.btn-icon { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); color: inherit; border-radius: 0.5rem; padding: 0.3rem 0.5rem; cursor: pointer; font-size: 1rem; line-height: 1; }
.btn-danger { color: #fca5a5; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
.modal-card { background: hsl(228,4%,15%); border: 1px solid rgba(255,255,255,0.15); border-radius: 1.5rem; padding: 2rem; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
.modal-wide { max-width: 760px; }
.modal-card h2 { margin: 0 0 1.25rem; font-size: 1.3rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-grid label { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.88rem; color: #bbb; }
.form-grid input, .form-grid textarea, .form-grid select { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); color: inherit; border-radius: 0.75rem; padding: 0.55rem 0.85rem; font-size: 0.9rem; font-family: inherit; }
.full-width { grid-column: span 2; }
.toggle-label { flex-direction: row !important; align-items: center; gap: 0.5rem !important; cursor: pointer; }
.color-picker-row { display: flex; align-items: center; gap: 0.75rem; }
.color-input { width: 48px; height: 38px; padding: 2px; border-radius: 0.5rem; cursor: pointer; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }

.member-search-section { position: relative; }
.customer-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: hsl(228,4%,18%); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.75rem; list-style: none; margin: 0; padding: 0.5rem 0; z-index: 10; max-height: 220px; overflow-y: auto; }
.customer-dropdown li { padding: 0.6rem 1rem; cursor: pointer; display: flex; justify-content: space-between; }
.customer-dropdown li:hover { background: rgba(255,255,255,0.07); }
.customer-dropdown strong { font-size: 0.9rem; }
.customer-dropdown small { color: #888; font-size: 0.8rem; }

.new-price-form { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 1rem; margin-top: 1rem; }
.glass-inset { background: rgba(0,0,0,0.2); }
.price-input-row { display: flex; gap: 0.75rem; align-items: flex-end; margin-top: 0.75rem; }
.price-input-row label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; }
.price-input-row input { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); color: inherit; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.9rem; width: 120px; }

@media (max-width: 640px) {
  .stats-strip { grid-template-columns: 1fr 1fr; }
  .form-grid { grid-template-columns: 1fr; }
  .full-width { grid-column: span 1; }
}
</style>
