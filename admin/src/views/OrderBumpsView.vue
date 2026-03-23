<template>
  <div>
    <div class="page-header">
      <h1>🛍️ Checkout Order Bumps</h1>
      <p class="subtitle">Add-on product offers shown at checkout — one click to add</p>
      <button class="btn btn-primary" @click="openCreate">+ New Bump</button>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">Total Bumps</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ stats.active || 0 }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_impressions || 0 }}</div>
        <div class="stat-label">Impressions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_conversions || 0 }}</div>
        <div class="stat-label">Conversions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.ctr || '0.0' }}%</div>
        <div class="stat-label">Conversion Rate</div>
      </div>
    </div>

    <!-- How It Works -->
    <div class="info-card glass" style="margin-bottom:1.5rem">
      <strong>💡 How Order Bumps Work</strong>
      <p style="margin:.5rem 0 0;color:#a0a0b0;font-size:.9rem">
        Order bumps appear on the checkout page as a checkbox offer — "Add [product] for just €X!" Customers check the box to add it to their order. You can offer a discount to make it irresistible. Up to 3 active bumps are shown at checkout.
      </p>
    </div>

    <!-- Bumps Table -->
    <div class="glass section">
      <table class="admin-table" v-if="bumps.length">
        <thead>
          <tr>
            <th>Product</th>
            <th>Headline</th>
            <th>Discount</th>
            <th>Impressions</th>
            <th>Conversions</th>
            <th>CTR</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in bumps" :key="b.id">
            <td>
              <div class="product-cell">
                <img v-if="b.cover_image" :src="API + b.cover_image" class="product-thumb" />
                <div class="product-thumb-empty" v-else>📦</div>
                <span>{{ b.product_name }}</span>
              </div>
            </td>
            <td><span class="bump-headline">{{ b.headline }}</span></td>
            <td>
              <span class="pill pill-green" v-if="b.discount_pct > 0">{{ b.discount_pct }}% off</span>
              <span class="pill" v-else>No discount</span>
            </td>
            <td>{{ b.impressions }}</td>
            <td>{{ b.conversions }}</td>
            <td>{{ b.impressions > 0 ? ((b.conversions / b.impressions) * 100).toFixed(1) + '%' : '—' }}</td>
            <td>
              <span class="pill" :class="b.active ? 'pill-green' : 'pill-gray'">
                {{ b.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <button class="btn btn-sm btn-ghost" @click="openEdit(b)">✏️ Edit</button>
              <button class="btn btn-sm btn-ghost" @click="toggleActive(b)" :title="b.active ? 'Deactivate' : 'Activate'">
                {{ b.active ? '⏸' : '▶️' }}
              </button>
              <button class="btn btn-sm btn-ghost danger" @click="confirmDelete(b)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <p>No order bumps yet. Create your first one!</p>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ editingBump ? 'Edit Order Bump' : 'Create Order Bump' }}</h2>
          <button class="btn btn-ghost" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Internal Name *</label>
            <input v-model="form.name" placeholder="e.g. Upsell — Premium Case" />
          </div>

          <div class="form-group">
            <label>Product *</label>
            <div class="product-search-wrap">
              <input v-model="productSearch" @input="searchProducts" placeholder="Search product by name…" />
              <div class="product-results" v-if="productResults.length">
                <div
                  v-for="p in productResults" :key="p.id"
                  class="product-result-item"
                  @click="selectProduct(p)"
                >
                  <img v-if="p.cover_image" :src="API + p.cover_image" class="product-thumb" />
                  <span>{{ p.name }} — {{ currSymbol }}{{ p.sale_price || p.price }}</span>
                </div>
              </div>
            </div>
            <div class="selected-product" v-if="form.product_id">
              ✅ Selected: <strong>{{ form.product_name }}</strong>
              <button class="btn btn-sm btn-ghost" @click="clearProduct">✕</button>
            </div>
          </div>

          <div class="form-group">
            <label>Offer Headline *</label>
            <input v-model="form.headline" placeholder="Special One-Time Offer!" />
          </div>

          <div class="form-group">
            <label>Subtext (optional)</label>
            <input v-model="form.subtext" placeholder="Add this to your order and save!" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Discount %</label>
              <input v-model.number="form.discount_pct" type="number" min="0" max="100" placeholder="0" />
              <small>0 = no discount (full price)</small>
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input v-model.number="form.sort_order" type="number" min="0" placeholder="0" />
              <small>Lower number = shown first</small>
            </div>
          </div>

          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="form.active" />
              Active (shown at checkout)
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="closeModal">Cancel</button>
          <button class="btn btn-primary" @click="saveBump" :disabled="saving">
            {{ saving ? 'Saving…' : (editingBump ? 'Update' : 'Create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div class="modal-overlay" v-if="deletingBump" @click.self="deletingBump = null">
      <div class="modal modal-sm glass">
        <div class="modal-header">
          <h2>Delete Order Bump</h2>
        </div>
        <div class="modal-body">
          <p>Delete <strong>{{ deletingBump.name }}</strong>? This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deletingBump = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteBump">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const _feedback = ref(null)
const toast = {
  success: (msg) => { _feedback.value = { t: 's', msg }; setTimeout(() => { _feedback.value = null }, 3000) },
  error:   (msg) => { _feedback.value = { t: 'e', msg }; setTimeout(() => { _feedback.value = null }, 4000) },
}
const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'

const bumps         = ref([])
const stats         = ref(null)
const showModal     = ref(false)
const editingBump   = ref(null)
const deletingBump  = ref(null)
const saving        = ref(false)
const productSearch = ref('')
const productResults = ref([])
const currSymbol    = ref('€')

const form = ref({
  name: '', product_id: null, product_name: '', headline: 'Special One-Time Offer!',
  subtext: '', discount_pct: 0, active: true, sort_order: 0
})

async function load() {
  const [{ data: b }, { data: s }] = await Promise.all([
    api.get('/order-bumps'),
    api.get('/order-bumps/stats'),
  ])
  bumps.value = b
  stats.value = s
  const { data: settings } = await api.get('/settings')
  currSymbol.value = settings.shop_currency_symbol || '€'
}

async function searchProducts() {
  if (productSearch.value.length < 2) { productResults.value = []; return }
  const { data } = await api.get('/products', { params: { all: 1, q: productSearch.value, limit: 8 } })
  productResults.value = data.products || data || []
}

function selectProduct(p) {
  form.value.product_id = p.id
  form.value.product_name = p.name
  productSearch.value = ''
  productResults.value = []
}

function clearProduct() {
  form.value.product_id = null
  form.value.product_name = ''
}

function openCreate() {
  editingBump.value = null
  form.value = { name: '', product_id: null, product_name: '', headline: 'Special One-Time Offer!', subtext: '', discount_pct: 0, active: true, sort_order: 0 }
  showModal.value = true
}

function openEdit(b) {
  editingBump.value = b
  form.value = {
    name: b.name, product_id: b.product_id, product_name: b.product_name,
    headline: b.headline, subtext: b.subtext || '',
    discount_pct: b.discount_pct, active: !!b.active, sort_order: b.sort_order
  }
  showModal.value = true
}

function closeModal() { showModal.value = false; editingBump.value = null }

async function saveBump() {
  if (!form.value.name) return toast.error('Name is required')
  if (!form.value.product_id) return toast.error('Please select a product')
  saving.value = true
  try {
    if (editingBump.value) {
      await api.put(`/order-bumps/${editingBump.value.id}`, form.value)
      toast.success('Bump updated')
    } else {
      await api.post('/order-bumps', form.value)
      toast.success('Bump created')
    }
    closeModal()
    load()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

async function toggleActive(b) {
  await api.put(`/order-bumps/${b.id}`, { active: !b.active })
  await load()
  toast.success(b.active ? 'Bump deactivated' : 'Bump activated')
}

function confirmDelete(b) { deletingBump.value = b }
async function deleteBump() {
  await api.delete(`/order-bumps/${deletingBump.value.id}`)
  toast.success('Bump deleted')
  deletingBump.value = null
  load()
}

onMounted(load)
</script>

<style scoped>
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1rem 1.5rem; min-width: 120px; }
.stat-card.accent { border-color: var(--accent); }
.stat-value { font-size: 1.6rem; font-weight: 700; color: #e2e2e8; }
.stat-label { font-size: .8rem; color: #888; margin-top: .2rem; }
.info-card { padding: 1rem 1.5rem; border-radius: 12px; }
.section { padding: 1.5rem; border-radius: 16px; }
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th { text-align: left; padding: .75rem; color: #888; font-size: .8rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
.admin-table td { padding: .75rem; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: middle; }
.product-cell { display: flex; align-items: center; gap: .75rem; }
.product-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; }
.product-thumb-empty { width: 36px; height: 36px; background: rgba(255,255,255,0.05); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.bump-headline { font-size: .9rem; color: #e2e2e8; }
.pill { display: inline-block; padding: .2rem .6rem; border-radius: 20px; font-size: .78rem; font-weight: 600; background: rgba(255,255,255,0.08); color: #aaa; }
.pill-green { background: rgba(76,175,80,0.2); color: #4caf50; }
.pill-gray { background: rgba(255,255,255,0.06); color: #666; }
.empty-state { text-align: center; padding: 3rem; color: #666; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 540px; max-height: 90vh; overflow-y: auto; border-radius: 1.5rem; padding: 0; }
.modal-sm { width: 380px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: flex-end; gap: .75rem; }
.form-group { margin-bottom: 1.2rem; }
.form-group label { display: block; margin-bottom: .4rem; font-size: .85rem; color: #aaa; }
.form-group input, .form-group textarea, .form-group select { width: 100%; padding: .65rem .9rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #e2e2e8; font-size: .9rem; }
.form-group small { display: block; margin-top: .3rem; color: #666; font-size: .8rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.toggle-label { display: flex; align-items: center; gap: .6rem; cursor: pointer; }
.product-search-wrap { position: relative; }
.product-results { position: absolute; top: 100%; left: 0; right: 0; background: hsl(228,4%,18%); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; z-index: 100; max-height: 220px; overflow-y: auto; }
.product-result-item { padding: .75rem 1rem; cursor: pointer; display: flex; align-items: center; gap: .75rem; font-size: .9rem; }
.product-result-item:hover { background: rgba(255,255,255,0.08); }
.selected-product { margin-top: .5rem; font-size: .85rem; color: #aaa; display: flex; align-items: center; gap: .5rem; }
.btn-sm { padding: .3rem .6rem; font-size: .8rem; }
.btn-danger { background: var(--accent); color: #fff; border: none; cursor: pointer; padding: .6rem 1.2rem; border-radius: 8px; }
.danger { color: var(--accent); }
</style>
