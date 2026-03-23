<template>
  <div>
    <div class="page-header">
      <h1>🗂️ Collections</h1>
      <button class="btn-primary" @click="openCreate">+ New Collection</button>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card glass">
        <div class="stat-num">{{ collections.length }}</div>
        <div class="stat-lbl">Total</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ collections.filter(c=>c.active).length }}</div>
        <div class="stat-lbl">Active</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ collections.reduce((s,c)=>s+c.product_count,0) }}</div>
        <div class="stat-lbl">Products</div>
      </div>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th class="num">Products</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!collections.length">
            <td colspan="5" class="empty">No collections yet.</td>
          </tr>
          <tr v-for="col in collections" :key="col.id">
            <td>
              <strong>{{ col.name }}</strong>
              <div v-if="col.description" class="text-muted" style="font-size:0.82rem">{{ col.description.slice(0,60) }}</div>
            </td>
            <td class="text-muted">/collections/{{ col.slug }}</td>
            <td class="num">{{ col.product_count }}</td>
            <td><span class="badge" :class="col.active ? 'badge-green' : 'badge-grey'">{{ col.active ? 'Active' : 'Inactive' }}</span></td>
            <td>
              <button class="btn-sm" @click="openProducts(col)" title="Manage products">📦 Products</button>
              <button class="btn-sm" @click="openEdit(col)">✏️ Edit</button>
              <button class="btn-sm btn-danger" @click="deleteCol(col)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal=false">
      <div class="modal glass">
        <h2>{{ editing ? 'Edit Collection' : 'New Collection' }}</h2>
        <div class="form-grid">
          <div class="field">
            <label>Name *</label>
            <input v-model="form.name" @input="autoSlug" placeholder="Summer Sale" />
          </div>
          <div class="field">
            <label>Slug *</label>
            <input v-model="form.slug" placeholder="summer-sale" />
          </div>
          <div class="field full">
            <label>Description</label>
            <textarea v-model="form.description" rows="2"></textarea>
          </div>
          <div class="field full">
            <label>Cover Image URL</label>
            <input v-model="form.cover_image" placeholder="https://..." />
          </div>
          <div class="field">
            <label>SEO Title</label>
            <input v-model="form.seo_title" />
          </div>
          <div class="field">
            <label>SEO Description</label>
            <input v-model="form.seo_desc" />
          </div>
          <div class="field">
            <label>Sort Order</label>
            <input v-model.number="form.sort_order" type="number" />
          </div>
          <div class="field" style="display:flex;align-items:center;gap:.5rem;margin-top:1rem">
            <input type="checkbox" v-model="form.active" id="cActive" />
            <label for="cActive">Active (visible on site)</label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showModal=false">Cancel</button>
          <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>

    <!-- Products Modal -->
    <div v-if="showProducts" class="modal-backdrop" @click.self="showProducts=false">
      <div class="modal glass modal-wide">
        <h2>📦 Products in "{{ activeCol?.name }}"</h2>
        <p class="text-muted" style="margin-bottom:1rem">Add products by ID or search and pick. Reorder by changing sort order.</p>

        <div style="display:flex;gap:.5rem;margin-bottom:1rem">
          <input v-model="productSearch" @input="searchProducts" placeholder="Search products to add…" style="flex:1" />
        </div>

        <!-- Search results -->
        <div v-if="searchResults.length" class="search-results glass">
          <div v-for="p in searchResults" :key="p.id" class="search-row" @click="addToCollection(p)">
            <img v-if="p.cover_image" :src="p.cover_image" class="thumb" />
            <span>{{ p.name }}</span>
            <span class="text-muted" style="font-size:0.8rem">€{{ p.price }}</span>
            <button class="btn-sm">+ Add</button>
          </div>
        </div>

        <!-- Current products -->
        <div v-if="colProducts.length" class="col-products">
          <div v-for="(p, idx) in colProducts" :key="p.id" class="col-product-row glass">
            <img v-if="p.cover_image" :src="p.cover_image" class="thumb" />
            <span style="flex:1">{{ p.name }}</span>
            <span class="text-muted" style="font-size:0.8rem">Sort: {{ idx }}</span>
            <button class="btn-sm" @click="moveUp(idx)" :disabled="idx===0">↑</button>
            <button class="btn-sm" @click="moveDown(idx)" :disabled="idx===colProducts.length-1">↓</button>
            <button class="btn-sm btn-danger" @click="removeFromCollection(idx)">✕</button>
          </div>
        </div>
        <div v-else class="text-muted" style="padding:1rem 0">No products in this collection yet.</div>

        <div class="modal-footer">
          <button class="btn-ghost" @click="showProducts=false">Close</button>
          <button class="btn-primary" @click="saveProducts" :disabled="savingProducts">{{ savingProducts ? 'Saving…' : 'Save Order' }}</button>
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

const collections   = ref([])
const showModal     = ref(false)
const showProducts  = ref(false)
const editing       = ref(null)
const saving        = ref(false)
const savingProducts = ref(false)
const activeCol     = ref(null)
const colProducts   = ref([])
const productSearch = ref('')
const searchResults = ref([])

const form = ref({ name:'', slug:'', description:'', cover_image:'', sort_order:0, active:true, seo_title:'', seo_desc:'' })

async function load() {
  const r = await fetch(`${API}/api/collections`, { headers })
  collections.value = await r.json()
}

function openCreate() {
  editing.value = null
  form.value = { name:'', slug:'', description:'', cover_image:'', sort_order:0, active:true, seo_title:'', seo_desc:'' }
  showModal.value = true
}

function openEdit(col) {
  editing.value = col
  form.value = { ...col, active: !!col.active }
  showModal.value = true
}

function autoSlug() {
  if (!editing.value) {
    form.value.slug = form.value.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  }
}

async function save() {
  if (!form.value.name || !form.value.slug) return alert('Name and slug required')
  saving.value = true
  const url  = editing.value ? `${API}/api/collections/${editing.value.id}` : `${API}/api/collections`
  const method = editing.value ? 'PUT' : 'POST'
  await fetch(url, { method, headers, body: JSON.stringify(form.value) })
  saving.value = false
  showModal.value = false
  load()
}

async function deleteCol(col) {
  if (!confirm(`Delete collection "${col.name}"?`)) return
  await fetch(`${API}/api/collections/${col.id}`, { method:'DELETE', headers })
  load()
}

async function openProducts(col) {
  activeCol.value = col
  searchResults.value = []
  productSearch.value = ''
  const r = await fetch(`${API}/api/collections/${col.id}/products`, { headers })
  colProducts.value = await r.json()
  showProducts.value = true
}

async function searchProducts() {
  const q = productSearch.value.trim()
  if (!q) { searchResults.value = []; return }
  const r = await fetch(`${API}/api/products?all=1&q=${encodeURIComponent(q)}&limit=10`, { headers })
  const data = await r.json()
  const existIds = new Set(colProducts.value.map(p => p.id))
  searchResults.value = (data.products || data).filter(p => !existIds.has(p.id)).slice(0, 8)
}

function addToCollection(p) {
  if (colProducts.value.find(x => x.id === p.id)) return
  colProducts.value.push({ id: p.id, name: p.name, cover_image: p.cover_image, price: p.price })
  searchResults.value = searchResults.value.filter(x => x.id !== p.id)
}

function removeFromCollection(idx) { colProducts.value.splice(idx, 1) }
function moveUp(idx) { if (idx > 0) { const a = colProducts.value.splice(idx,1)[0]; colProducts.value.splice(idx-1,0,a) } }
function moveDown(idx) { if (idx < colProducts.value.length-1) { const a = colProducts.value.splice(idx,1)[0]; colProducts.value.splice(idx+1,0,a) } }

async function saveProducts() {
  savingProducts.value = true
  await fetch(`${API}/api/collections/${activeCol.value.id}/products`, {
    method: 'PUT', headers,
    body: JSON.stringify({ product_ids: colProducts.value.map(p=>p.id) })
  })
  savingProducts.value = false
  showProducts.value = false
  load()
}

onMounted(load)
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem }
.stats-row { display:flex; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap }
.stat-card { padding:1rem 1.5rem; border-radius:1rem; min-width:120px }
.stat-num { font-size:2rem; font-weight:700 }
.stat-lbl { font-size:0.8rem; opacity:.6; margin-top:2px }
.table-wrap { border-radius:1rem; overflow:hidden }
table { width:100%; border-collapse:collapse }
thead th { padding:.75rem 1rem; text-align:left; font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; opacity:.5; border-bottom:1px solid rgba(255,255,255,.06) }
th.num, td.num { text-align:right }
tbody tr:hover { background:rgba(255,255,255,.03) }
tbody td { padding:.75rem 1rem; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle }
.empty { text-align:center; padding:2rem; opacity:.4 }
.badge { padding:2px 10px; border-radius:99px; font-size:.75rem; font-weight:600 }
.badge-green { background:rgba(34,197,94,.15); color:#4ade80 }
.badge-grey { background:rgba(255,255,255,.08); color:#999 }
.btn-sm { padding:4px 10px; border-radius:.5rem; font-size:.78rem; cursor:pointer; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.07); color:inherit; margin-right:4px }
.btn-sm:hover { background:rgba(255,255,255,.15) }
.btn-danger { border-color:rgba(239,68,68,.4); color:#f87171 }
.btn-danger:hover { background:rgba(239,68,68,.15) }
.btn-primary { padding:.5rem 1.2rem; border-radius:.75rem; background:hsl(355,70%,58%); color:#fff; border:none; font-weight:600; cursor:pointer; font-size:.9rem }
.btn-primary:hover { filter:brightness(1.1) }
.btn-primary:disabled { opacity:.5 }
.btn-ghost { padding:.5rem 1.2rem; border-radius:.75rem; background:transparent; color:inherit; border:1px solid rgba(255,255,255,.2); cursor:pointer }
.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:100 }
.modal { padding:2rem; border-radius:1.5rem; width:560px; max-width:95vw; max-height:90vh; overflow-y:auto }
.modal-wide { width:720px }
.modal h2 { margin-bottom:1.2rem }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem }
.form-grid .full { grid-column:1/-1 }
.field { display:flex; flex-direction:column; gap:.35rem }
.field label { font-size:.8rem; opacity:.6 }
.field input, .field textarea { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); border-radius:.6rem; padding:.5rem .75rem; color:inherit; font-size:.9rem }
.field textarea { resize:vertical }
.modal-footer { display:flex; justify-content:flex-end; gap:.75rem; margin-top:1.5rem }
.search-results { border-radius:.75rem; margin-bottom:.75rem; overflow:hidden }
.search-row { display:flex; align-items:center; gap:.75rem; padding:.6rem 1rem; cursor:pointer; border-bottom:1px solid rgba(255,255,255,.06) }
.search-row:hover { background:rgba(255,255,255,.07) }
.col-products { display:flex; flex-direction:column; gap:.5rem }
.col-product-row { display:flex; align-items:center; gap:.75rem; padding:.6rem 1rem; border-radius:.75rem }
.thumb { width:40px; height:40px; object-fit:cover; border-radius:.5rem }
.text-muted { color:#888 }
</style>
