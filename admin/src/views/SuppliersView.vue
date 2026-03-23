<template>
  <div>
    <div class="page-header">
      <h1>🏭 Suppliers</h1>
      <div style="display:flex;gap:.5rem">
        <button class="btn-ghost" @click="showPOs=true">📋 All Purchase Orders</button>
        <button class="btn-primary" @click="openCreate">+ New Supplier</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card glass">
        <div class="stat-num">{{ suppliers.length }}</div>
        <div class="stat-lbl">Suppliers</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ suppliers.filter(s=>s.active).length }}</div>
        <div class="stat-lbl">Active</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ allPoCount }}</div>
        <div class="stat-lbl">Purchase Orders</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ suppliers.reduce((s,x)=>s+x.product_count,0) }}</div>
        <div class="stat-lbl">Linked Products</div>
      </div>
    </div>

    <!-- Supplier table -->
    <div class="glass table-wrap">
      <div class="table-header">
        <input v-model="search" placeholder="Search suppliers…" class="search-input" />
      </div>
      <table>
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Contact</th>
            <th class="num">Products</th>
            <th class="num">POs</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!filtered.length"><td colspan="6" class="empty">No suppliers found.</td></tr>
          <tr v-for="s in filtered" :key="s.id">
            <td>
              <strong>{{ s.name }}</strong>
              <div v-if="s.website" class="text-muted" style="font-size:.8rem"><a :href="s.website" target="_blank">{{ s.website }}</a></div>
            </td>
            <td>
              <div>{{ s.contact_name }}</div>
              <div class="text-muted" style="font-size:.8rem">{{ s.email }}</div>
            </td>
            <td class="num">{{ s.product_count }}</td>
            <td class="num">{{ s.po_count }}</td>
            <td><span class="badge" :class="s.active ? 'badge-green' : 'badge-grey'">{{ s.active ? 'Active' : 'Inactive' }}</span></td>
            <td>
              <button class="btn-sm" @click="openPOList(s)">📋 POs</button>
              <button class="btn-sm" @click="openEdit(s)">✏️ Edit</button>
              <button class="btn-sm btn-danger" @click="deleteSupplier(s)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Supplier Create/Edit Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal=false">
      <div class="modal glass">
        <h2>{{ editing ? 'Edit Supplier' : 'New Supplier' }}</h2>
        <div class="form-grid">
          <div class="field full"><label>Name *</label><input v-model="form.name" placeholder="Acme Goods Ltd." /></div>
          <div class="field"><label>Contact Name</label><input v-model="form.contact_name" /></div>
          <div class="field"><label>Email</label><input v-model="form.email" type="email" /></div>
          <div class="field"><label>Phone</label><input v-model="form.phone" /></div>
          <div class="field"><label>Website</label><input v-model="form.website" placeholder="https://..." /></div>
          <div class="field full"><label>Address</label><textarea v-model="form.address" rows="2"></textarea></div>
          <div class="field full"><label>Notes</label><textarea v-model="form.notes" rows="2"></textarea></div>
          <div class="field" style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem">
            <input type="checkbox" v-model="form.active" id="sActive" />
            <label for="sActive">Active</label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showModal=false">Cancel</button>
          <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>

    <!-- Purchase Orders Modal (per supplier or all) -->
    <div v-if="showPOModal" class="modal-backdrop" @click.self="showPOModal=false">
      <div class="modal glass modal-wide">
        <h2>📋 Purchase Orders{{ activeSupplier ? ` — ${activeSupplier.name}` : '' }}</h2>
        <div style="display:flex;justify-content:flex-end;margin-bottom:1rem">
          <button class="btn-primary" @click="openNewPO">+ New PO</button>
        </div>
        <div class="glass table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO #</th>
                <th v-if="!activeSupplier">Supplier</th>
                <th>Status</th>
                <th class="num">Total</th>
                <th>Expected</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!poList.length"><td colspan="6" class="empty">No purchase orders.</td></tr>
              <tr v-for="po in poList" :key="po.id">
                <td><strong>{{ po.po_number }}</strong></td>
                <td v-if="!activeSupplier">{{ po.supplier_name }}</td>
                <td><span class="badge" :class="poBadge(po.status)">{{ po.status }}</span></td>
                <td class="num">€{{ parseFloat(po.total_cost||0).toFixed(2) }}</td>
                <td>{{ po.expected_at ? new Date(po.expected_at).toLocaleDateString() : '—' }}</td>
                <td>
                  <button class="btn-sm" @click="openEditPO(po)">✏️ Edit</button>
                  <button class="btn-sm btn-danger" @click="deletePO(po)">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showPOModal=false">Close</button>
        </div>
      </div>
    </div>

    <!-- PO Create/Edit Modal -->
    <div v-if="showPOEdit" class="modal-backdrop" @click.self="showPOEdit=false">
      <div class="modal glass modal-wide">
        <h2>{{ editingPO ? `Edit ${editingPO.po_number}` : 'New Purchase Order' }}</h2>

        <div class="form-grid" style="margin-bottom:1rem">
          <div class="field" v-if="!activeSupplier">
            <label>Supplier *</label>
            <select v-model="poForm.supplier_id">
              <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>Status</label>
            <select v-model="poForm.status">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="received">Received (updates stock)</option>
              <option value="partial">Partial</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="field">
            <label>Expected Date</label>
            <input type="date" v-model="poForm.expected_at" />
          </div>
          <div class="field" v-if="poForm.status==='received'">
            <label>Received Date</label>
            <input type="date" v-model="poForm.received_at" />
          </div>
          <div class="field full">
            <label>Notes</label>
            <textarea v-model="poForm.notes" rows="2"></textarea>
          </div>
        </div>

        <!-- Line items -->
        <h3 style="margin-bottom:.5rem">Line Items</h3>
        <div v-for="(item, i) in poForm.items" :key="i" class="po-item glass">
          <input v-model="item.name" placeholder="Product name" style="flex:2" />
          <input v-model.number="item.qty" type="number" min="1" placeholder="Qty" style="flex:.5" />
          <input v-model.number="item.unit_cost" type="number" step="0.01" placeholder="Unit cost" style="flex:.75" />
          <span>€{{ ((item.qty||0)*(item.unit_cost||0)).toFixed(2) }}</span>
          <button class="btn-sm btn-danger" @click="poForm.items.splice(i,1)">✕</button>
        </div>
        <button class="btn-sm" style="margin-top:.5rem" @click="poForm.items.push({name:'',qty:1,unit_cost:0,product_id:null})">+ Add Item</button>

        <div style="text-align:right;margin-top:.75rem;font-weight:700">
          Total: €{{ poTotal.toFixed(2) }}
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" @click="showPOEdit=false">Cancel</button>
          <button class="btn-primary" @click="savePO" :disabled="savingPO">{{ savingPO ? 'Saving…' : 'Save PO' }}</button>
        </div>
      </div>
    </div>

    <!-- All POs modal (from top button) -->
    <div v-if="showPOs" class="modal-backdrop" @click.self="showPOs=false">
      <div class="modal glass modal-wide">
        <h2>📋 All Purchase Orders</h2>
        <div style="display:flex;gap:.5rem;margin-bottom:1rem">
          <input v-model="poSearch" placeholder="Search PO or supplier…" @input="loadAllPOs" style="flex:1" />
          <select v-model="poStatusFilter" @change="loadAllPOs" style="width:140px">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
            <option value="partial">Partial</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div class="glass table-wrap">
          <table>
            <thead>
              <tr><th>PO #</th><th>Supplier</th><th>Status</th><th class="num">Total</th><th>Expected</th><th>Created</th></tr>
            </thead>
            <tbody>
              <tr v-if="!allPOs.length"><td colspan="6" class="empty">No purchase orders.</td></tr>
              <tr v-for="po in allPOs" :key="po.id">
                <td><strong>{{ po.po_number }}</strong></td>
                <td>{{ po.supplier_name }}</td>
                <td><span class="badge" :class="poBadge(po.status)">{{ po.status }}</span></td>
                <td class="num">€{{ parseFloat(po.total_cost||0).toFixed(2) }}</td>
                <td>{{ po.expected_at ? new Date(po.expected_at).toLocaleDateString() : '—' }}</td>
                <td>{{ new Date(po.created_at).toLocaleDateString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showPOs=false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
const token = localStorage.getItem('pygmy_token')
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

const suppliers     = ref([])
const search        = ref('')
const showModal     = ref(false)
const showPOModal   = ref(false)
const showPOEdit    = ref(false)
const showPOs       = ref(false)
const editing       = ref(null)
const editingPO     = ref(null)
const saving        = ref(false)
const savingPO      = ref(false)
const activeSupplier = ref(null)
const poList        = ref([])
const allPOs        = ref([])
const poSearch      = ref('')
const poStatusFilter = ref('')

const allPoCount = computed(() => suppliers.value.reduce((s,x)=>s+x.po_count,0))
const filtered   = computed(() => {
  const q = search.value.toLowerCase()
  return q ? suppliers.value.filter(s => s.name.toLowerCase().includes(q) || (s.email||'').toLowerCase().includes(q)) : suppliers.value
})
const poTotal = computed(() => poForm.value.items.reduce((s,i)=>(s+(i.qty||0)*(i.unit_cost||0)),0))

const form = ref({ name:'', contact_name:'', email:'', phone:'', website:'', address:'', notes:'', active:true })
const poForm = ref({ supplier_id:null, status:'draft', items:[], notes:'', expected_at:'', received_at:'', total_cost:0 })

async function load() {
  const r = await fetch(`${API}/api/suppliers`, { headers })
  suppliers.value = await r.json()
}

function openCreate() {
  editing.value = null
  form.value = { name:'', contact_name:'', email:'', phone:'', website:'', address:'', notes:'', active:true }
  showModal.value = true
}
function openEdit(s) {
  editing.value = s
  form.value = { ...s, active: !!s.active }
  showModal.value = true
}

async function save() {
  if (!form.value.name) return alert('Name required')
  saving.value = true
  const url    = editing.value ? `${API}/api/suppliers/${editing.value.id}` : `${API}/api/suppliers`
  const method = editing.value ? 'PUT' : 'POST'
  await fetch(url, { method, headers, body: JSON.stringify(form.value) })
  saving.value = false; showModal.value = false; load()
}

async function deleteSupplier(s) {
  if (!confirm(`Delete supplier "${s.name}"? Products will be unlinked.`)) return
  await fetch(`${API}/api/suppliers/${s.id}`, { method:'DELETE', headers })
  load()
}

async function openPOList(s) {
  activeSupplier.value = s
  const r = await fetch(`${API}/api/suppliers/${s.id}/purchase-orders`, { headers })
  poList.value = await r.json()
  showPOModal.value = true
}

function openNewPO() {
  editingPO.value = null
  poForm.value = { supplier_id: activeSupplier.value?.id || null, status:'draft', items:[], notes:'', expected_at:'', received_at:'' }
  showPOEdit.value = true
}

function openEditPO(po) {
  editingPO.value = po
  poForm.value = { ...po, items: JSON.parse(po.items || '[]') }
  showPOEdit.value = true
}

async function savePO() {
  const suppId = activeSupplier.value?.id || poForm.value.supplier_id
  if (!suppId) return alert('Select a supplier')
  savingPO.value = true
  const payload = { ...poForm.value, items: poForm.value.items, total_cost: poTotal.value }
  if (editingPO.value) {
    await fetch(`${API}/api/suppliers/purchase-orders/${editingPO.value.id}`, { method:'PUT', headers, body: JSON.stringify(payload) })
  } else {
    await fetch(`${API}/api/suppliers/${suppId}/purchase-orders`, { method:'POST', headers, body: JSON.stringify(payload) })
  }
  savingPO.value = false; showPOEdit.value = false
  if (activeSupplier.value) { const r = await fetch(`${API}/api/suppliers/${activeSupplier.value.id}/purchase-orders`, { headers }); poList.value = await r.json() }
  load()
}

async function deletePO(po) {
  if (!confirm(`Delete ${po.po_number}?`)) return
  await fetch(`${API}/api/suppliers/purchase-orders/${po.id}`, { method:'DELETE', headers })
  poList.value = poList.value.filter(p => p.id !== po.id)
  load()
}

async function loadAllPOs() {
  const q = poSearch.value
  const st = poStatusFilter.value
  const r = await fetch(`${API}/api/suppliers/purchase-orders/all?q=${encodeURIComponent(q)}&status=${st}`, { headers })
  allPOs.value = await r.json()
}

function poBadge(status) {
  return { draft:'badge-grey', sent:'badge-blue', received:'badge-green', partial:'badge-orange', cancelled:'badge-red' }[status] || 'badge-grey'
}

onMounted(() => { load(); loadAllPOs() })
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem }
.stats-row { display:flex; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap }
.stat-card { padding:1rem 1.5rem; border-radius:1rem; min-width:120px }
.stat-num { font-size:2rem; font-weight:700 }
.stat-lbl { font-size:0.8rem; opacity:.6 }
.table-wrap { border-radius:1rem; overflow:hidden }
.table-header { padding:.75rem 1rem; border-bottom:1px solid rgba(255,255,255,.06) }
.search-input { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); border-radius:.6rem; padding:.4rem .75rem; color:inherit; width:280px }
table { width:100%; border-collapse:collapse }
thead th { padding:.75rem 1rem; text-align:left; font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; opacity:.5; border-bottom:1px solid rgba(255,255,255,.06) }
th.num, td.num { text-align:right }
tbody tr:hover { background:rgba(255,255,255,.03) }
tbody td { padding:.75rem 1rem; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle }
.empty { text-align:center; padding:2rem; opacity:.4 }
.badge { padding:2px 10px; border-radius:99px; font-size:.75rem; font-weight:600; text-transform:capitalize }
.badge-green  { background:rgba(34,197,94,.15); color:#4ade80 }
.badge-blue   { background:rgba(59,130,246,.15); color:#93c5fd }
.badge-orange { background:rgba(249,115,22,.15); color:#fb923c }
.badge-red    { background:rgba(239,68,68,.15); color:#f87171 }
.badge-grey   { background:rgba(255,255,255,.08); color:#999 }
.btn-sm { padding:4px 10px; border-radius:.5rem; font-size:.78rem; cursor:pointer; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.07); color:inherit; margin-right:4px }
.btn-sm:hover { background:rgba(255,255,255,.15) }
.btn-danger { border-color:rgba(239,68,68,.4); color:#f87171 }
.btn-danger:hover { background:rgba(239,68,68,.15) }
.btn-primary { padding:.5rem 1.2rem; border-radius:.75rem; background:hsl(355,70%,58%); color:#fff; border:none; font-weight:600; cursor:pointer }
.btn-primary:hover { filter:brightness(1.1) }
.btn-primary:disabled { opacity:.5 }
.btn-ghost { padding:.5rem 1.2rem; border-radius:.75rem; background:transparent; color:inherit; border:1px solid rgba(255,255,255,.2); cursor:pointer }
.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:100 }
.modal { padding:2rem; border-radius:1.5rem; width:560px; max-width:95vw; max-height:90vh; overflow-y:auto }
.modal-wide { width:800px }
.modal h2 { margin-bottom:1.2rem }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem }
.form-grid .full { grid-column:1/-1 }
.field { display:flex; flex-direction:column; gap:.35rem }
.field label { font-size:.8rem; opacity:.6 }
.field input, .field select, .field textarea { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); border-radius:.6rem; padding:.5rem .75rem; color:inherit; font-size:.9rem }
.field textarea { resize:vertical }
.modal-footer { display:flex; justify-content:flex-end; gap:.75rem; margin-top:1.5rem }
.po-item { display:flex; align-items:center; gap:.5rem; padding:.6rem .8rem; border-radius:.6rem; margin-bottom:.4rem }
.po-item input { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); border-radius:.4rem; padding:.35rem .5rem; color:inherit; min-width:60px }
.text-muted { color:#888 }
.text-muted a { color:#888 }
</style>
