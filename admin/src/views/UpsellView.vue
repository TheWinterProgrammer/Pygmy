<template>
  <div>
    <div class="page-header">
      <h1>🎯 Post-Purchase Upsell</h1>
      <button class="btn-primary" @click="openCreate">+ New Offer</button>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.total }}</div>
        <div class="stat-lbl">Total Offers</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.active }}</div>
        <div class="stat-lbl">Active</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.conversions }}</div>
        <div class="stat-lbl">Conversions</div>
      </div>
      <div class="stat-card glass accent">
        <div class="stat-num">€{{ (stats.revenue||0).toFixed(2) }}</div>
        <div class="stat-lbl">Upsell Revenue</div>
      </div>
    </div>

    <!-- Enable toggle notice -->
    <div class="notice glass" v-if="!upsellEnabled">
      <span>⚠️ Upsell is currently <strong>disabled</strong>. Enable it in</span>
      <button class="btn-sm" @click="enableUpsell">Enable Now</button>
    </div>

    <!-- Offers table -->
    <div class="glass table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Headline</th>
            <th>Trigger</th>
            <th>Discount</th>
            <th class="num">Conv.</th>
            <th class="num">Revenue</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!offers.length"><td colspan="8" class="empty">No upsell offers yet.</td></tr>
          <tr v-for="o in offers" :key="o.id">
            <td>
              <div style="display:flex;align-items:center;gap:.5rem">
                <img v-if="o.cover_image" :src="o.cover_image" class="thumb" />
                <span>{{ o.product_name }}</span>
              </div>
            </td>
            <td>{{ o.headline }}</td>
            <td><span class="badge badge-blue">{{ o.trigger_type }}</span></td>
            <td>{{ o.discount_pct > 0 ? o.discount_pct + '%' : '—' }}</td>
            <td class="num">{{ o.conversions }}</td>
            <td class="num">€{{ parseFloat(o.revenue||0).toFixed(2) }}</td>
            <td><span class="badge" :class="o.active ? 'badge-green' : 'badge-grey'">{{ o.active ? 'Active' : 'Off' }}</span></td>
            <td>
              <button class="btn-sm" @click="openEdit(o)">✏️ Edit</button>
              <button class="btn-sm btn-danger" @click="deleteOffer(o)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal=false">
      <div class="modal glass">
        <h2>{{ editing ? 'Edit Offer' : 'New Upsell Offer' }}</h2>

        <div class="fields">
          <div class="field full">
            <label>Product to Upsell *</label>
            <div style="display:flex;gap:.5rem">
              <input v-model="productSearch" @input="searchProducts" placeholder="Search product…" style="flex:1" />
            </div>
            <div v-if="productResults.length" class="search-results glass">
              <div v-for="p in productResults" :key="p.id" class="search-row" @click="selectProduct(p)">
                <img v-if="p.cover_image" :src="p.cover_image" class="thumb" />
                {{ p.name }} — €{{ p.price }}
              </div>
            </div>
            <div v-if="form.product_id" class="selected-product glass">
              ✅ <strong>{{ form._product_name }}</strong> selected (ID {{ form.product_id }})
            </div>
          </div>

          <div class="field full">
            <label>Headline</label>
            <input v-model="form.headline" placeholder="Special One-Time Offer!" />
          </div>
          <div class="field full">
            <label>Subtext</label>
            <input v-model="form.subtext" placeholder="Only available right now…" />
          </div>
          <div class="field">
            <label>Discount %</label>
            <input v-model.number="form.discount_pct" type="number" min="0" max="100" />
          </div>
          <div class="field">
            <label>Trigger Type</label>
            <select v-model="form.trigger_type">
              <option value="any">Any order</option>
              <option value="product">Specific product in order</option>
            </select>
          </div>
          <div class="field" v-if="form.trigger_type==='product'">
            <label>Trigger Product ID</label>
            <input v-model="form.trigger_value" placeholder="Product ID" />
          </div>
          <div class="field">
            <label>Sort Order</label>
            <input v-model.number="form.sort_order" type="number" />
          </div>
          <div class="field" style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem">
            <input type="checkbox" v-model="form.active" id="uActive" />
            <label for="uActive">Active</label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" @click="showModal=false">Cancel</button>
          <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
const token = localStorage.getItem('pygmy_token')
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

const offers        = ref([])
const stats         = ref({ total:0, active:0, conversions:0, revenue:0 })
const upsellEnabled = ref(false)
const showModal     = ref(false)
const editing       = ref(null)
const saving        = ref(false)
const productSearch = ref('')
const productResults = ref([])

const form = ref({
  product_id:0, _product_name:'', trigger_type:'any', trigger_value:'',
  headline:'Special One-Time Offer!', subtext:'', discount_pct:0, active:true, sort_order:0
})

async function load() {
  const [r1, r2, r3] = await Promise.all([
    fetch(`${API}/api/upsell`, { headers }),
    fetch(`${API}/api/upsell/stats`, { headers }),
    fetch(`${API}/api/settings`)
  ])
  offers.value = await r1.json()
  stats.value  = await r2.json()
  const settings = await r3.json()
  upsellEnabled.value = settings.upsell_enabled === '1'
}

async function enableUpsell() {
  await fetch(`${API}/api/settings`, { method:'PUT', headers, body: JSON.stringify({ upsell_enabled: '1' }) })
  upsellEnabled.value = true
}

function openCreate() {
  editing.value = null
  form.value = { product_id:0, _product_name:'', trigger_type:'any', trigger_value:'', headline:'Special One-Time Offer!', subtext:'', discount_pct:0, active:true, sort_order:0 }
  productSearch.value = ''
  productResults.value = []
  showModal.value = true
}

function openEdit(o) {
  editing.value = o
  form.value = { ...o, _product_name: o.product_name, active: !!o.active }
  productSearch.value = ''
  productResults.value = []
  showModal.value = true
}

async function searchProducts() {
  const q = productSearch.value.trim()
  if (!q) { productResults.value = []; return }
  const r = await fetch(`${API}/api/products?all=1&q=${encodeURIComponent(q)}&limit=8`, { headers })
  const data = await r.json()
  productResults.value = data.products || data
}

function selectProduct(p) {
  form.value.product_id = p.id
  form.value._product_name = p.name
  productResults.value = []
  productSearch.value = ''
}

async function save() {
  if (!form.value.product_id) return alert('Please select a product')
  saving.value = true
  const url    = editing.value ? `${API}/api/upsell/${editing.value.id}` : `${API}/api/upsell`
  const method = editing.value ? 'PUT' : 'POST'
  const { _product_name, ...payload } = form.value
  await fetch(url, { method, headers, body: JSON.stringify(payload) })
  saving.value = false
  showModal.value = false
  load()
}

async function deleteOffer(o) {
  if (!confirm(`Delete upsell offer for "${o.product_name}"?`)) return
  await fetch(`${API}/api/upsell/${o.id}`, { method:'DELETE', headers })
  load()
}

onMounted(load)
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem }
.stats-row { display:flex; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap }
.stat-card { padding:1rem 1.5rem; border-radius:1rem; min-width:120px }
.stat-card.accent .stat-num { color:hsl(355,70%,65%) }
.stat-num { font-size:2rem; font-weight:700 }
.stat-lbl { font-size:0.8rem; opacity:.6 }
.notice { display:flex; align-items:center; gap:.75rem; padding:1rem 1.2rem; border-radius:1rem; margin-bottom:1.5rem; border:1px solid rgba(234,179,8,.3); background:rgba(234,179,8,.06) }
.table-wrap { border-radius:1rem; overflow:hidden }
table { width:100%; border-collapse:collapse }
thead th { padding:.75rem 1rem; text-align:left; font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; opacity:.5; border-bottom:1px solid rgba(255,255,255,.06) }
th.num, td.num { text-align:right }
tbody tr:hover { background:rgba(255,255,255,.03) }
tbody td { padding:.75rem 1rem; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle }
.empty { text-align:center; padding:2rem; opacity:.4 }
.thumb { width:36px; height:36px; object-fit:cover; border-radius:.4rem }
.badge { padding:2px 10px; border-radius:99px; font-size:.75rem; font-weight:600 }
.badge-green { background:rgba(34,197,94,.15); color:#4ade80 }
.badge-blue  { background:rgba(59,130,246,.15); color:#93c5fd }
.badge-grey  { background:rgba(255,255,255,.08); color:#999 }
.btn-sm { padding:4px 10px; border-radius:.5rem; font-size:.78rem; cursor:pointer; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.07); color:inherit; margin-right:4px }
.btn-sm:hover { background:rgba(255,255,255,.15) }
.btn-danger { border-color:rgba(239,68,68,.4); color:#f87171 }
.btn-danger:hover { background:rgba(239,68,68,.15) }
.btn-primary { padding:.5rem 1.2rem; border-radius:.75rem; background:hsl(355,70%,58%); color:#fff; border:none; font-weight:600; cursor:pointer }
.btn-primary:hover { filter:brightness(1.1) }
.btn-primary:disabled { opacity:.5 }
.btn-ghost { padding:.5rem 1.2rem; border-radius:.75rem; background:transparent; color:inherit; border:1px solid rgba(255,255,255,.2); cursor:pointer }
.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:100 }
.modal { padding:2rem; border-radius:1.5rem; width:540px; max-width:95vw; max-height:90vh; overflow-y:auto }
.modal h2 { margin-bottom:1.2rem }
.fields { display:grid; grid-template-columns:1fr 1fr; gap:1rem }
.field { display:flex; flex-direction:column; gap:.35rem }
.field.full { grid-column:1/-1 }
.field label { font-size:.8rem; opacity:.6 }
.field input, .field select { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); border-radius:.6rem; padding:.5rem .75rem; color:inherit; font-size:.9rem }
.modal-footer { display:flex; justify-content:flex-end; gap:.75rem; margin-top:1.5rem }
.search-results { border-radius:.75rem; margin-top:.35rem; overflow:hidden }
.search-row { display:flex; align-items:center; gap:.75rem; padding:.5rem 1rem; cursor:pointer; border-bottom:1px solid rgba(255,255,255,.06) }
.search-row:hover { background:rgba(255,255,255,.07) }
.selected-product { padding:.5rem .75rem; border-radius:.6rem; margin-top:.35rem; font-size:.88rem }
</style>
