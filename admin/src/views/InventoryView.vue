<template>
  <div>
    <div class="page-header">
      <h1>📦 Bulk Inventory Editor</h1>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-ghost" @click="loadProducts">🔄 Refresh</button>
        <button class="btn btn-primary" :disabled="!dirty || saving" @click="saveAll">
          {{ saving ? 'Saving…' : `💾 Save Changes (${dirty} edited)` }}
        </button>
      </div>
    </div>

    <!-- Saved banner -->
    <div v-if="savedMsg" class="save-banner glass">✅ {{ savedMsg }}</div>

    <!-- Filter / search row -->
    <div class="filter-row glass">
      <input v-model="q" class="input search-input" placeholder="🔍 Filter by name or SKU…" @input="filterProducts" />
      <select v-model="filterStatus" class="input" style="width:140px" @change="filterProducts">
        <option value="">All status</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
      <select v-model="filterStock" class="input" style="width:160px" @change="filterProducts">
        <option value="">All stock</option>
        <option value="out">Out of stock</option>
        <option value="low">Low stock</option>
        <option value="healthy">Healthy</option>
        <option value="untracked">Not tracked</option>
      </select>
    </div>

    <div v-if="loading" class="glass section"><div class="loading-bar"></div></div>
    <div v-else-if="!filtered.length" class="glass section empty">
      <p>No products match your filters.</p>
    </div>

    <div v-else class="table-wrap glass">
      <table class="inv-table">
        <thead>
          <tr>
            <th>Product</th>
            <th style="width:80px">SKU</th>
            <th style="width:90px">Track</th>
            <th style="width:110px">Stock Qty</th>
            <th style="width:110px">Low Threshold</th>
            <th style="width:80px">Backorder</th>
            <th style="width:90px">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in filtered"
            :key="p.id"
            :class="{ 'row-edited': edits[p.id] }"
          >
            <td>
              <div class="prod-name">{{ p.name }}</div>
              <div class="prod-meta" v-if="p.sku">{{ p.sku }}</div>
            </td>
            <td class="sku-cell text-muted">{{ p.sku || '—' }}</td>
            <td>
              <label class="toggle-mini">
                <input type="checkbox" :checked="getValue(p, 'track_stock')" @change="setEdit(p, 'track_stock', $event.target.checked)" />
                <span class="toggle-bg"></span>
              </label>
            </td>
            <td>
              <input
                v-if="getValue(p, 'track_stock')"
                type="number"
                min="0"
                :value="getValue(p, 'stock_quantity')"
                @input="setEdit(p, 'stock_quantity', parseInt($event.target.value) || 0)"
                class="input num-input"
                :class="stockClass(p)"
              />
              <span v-else class="text-muted" style="font-size:.8rem">—</span>
            </td>
            <td>
              <input
                v-if="getValue(p, 'track_stock')"
                type="number"
                min="1"
                :value="getValue(p, 'low_stock_threshold')"
                @input="setEdit(p, 'low_stock_threshold', parseInt($event.target.value) || 5)"
                class="input num-input"
              />
              <span v-else class="text-muted" style="font-size:.8rem">—</span>
            </td>
            <td>
              <label class="toggle-mini" v-if="getValue(p, 'track_stock')">
                <input type="checkbox" :checked="getValue(p, 'allow_backorder')" @change="setEdit(p, 'allow_backorder', $event.target.checked)" />
                <span class="toggle-bg"></span>
              </label>
              <span v-else class="text-muted" style="font-size:.8rem">—</span>
            </td>
            <td>
              <span class="status-pill" :class="p.status">{{ p.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="table-footer">
        <span class="text-muted" style="font-size:.83rem">
          Showing {{ filtered.length }} of {{ products.length }} products
          <span v-if="dirty"> · <strong class="accent">{{ dirty }} unsaved changes</strong></span>
        </span>
        <button class="btn btn-primary" :disabled="!dirty || saving" @click="saveAll">
          {{ saving ? 'Saving…' : `💾 Save ${dirty} Change(s)` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import api from '../api.js'

const loading = ref(true)
const saving = ref(false)
const savedMsg = ref('')
const products = ref([])
const filtered = ref([])
const edits = reactive({})
const q = ref('')
const filterStatus = ref('')
const filterStock = ref('')

const dirty = computed(() => Object.keys(edits).length)

function getValue(p, field) {
  if (edits[p.id]) {
    const e = edits[p.id]
    if (field in e) return e[field]
  }
  return p[field]
}

function setEdit(p, field, value) {
  if (!edits[p.id]) edits[p.id] = {}
  edits[p.id][field] = value

  // If disabling track_stock, clean up qty/threshold/backorder edits
  if (field === 'track_stock' && !value) {
    delete edits[p.id].stock_quantity
    delete edits[p.id].low_stock_threshold
    delete edits[p.id].allow_backorder
  }

  // Check if edit reverts to original values — if so, remove it
  const keys = Object.keys(edits[p.id])
  const allSame = keys.every(k => edits[p.id][k] === p[k] || (typeof p[k] === 'number' && edits[p.id][k] === p[k]))
  if (allSame) delete edits[p.id]
}

function stockClass(p) {
  const qty = getValue(p, 'stock_quantity')
  if (qty <= 0) return 'input-danger'
  const threshold = getValue(p, 'low_stock_threshold')
  if (qty <= threshold) return 'input-warn'
  return ''
}

function filterProducts() {
  const term = q.value.toLowerCase()
  filtered.value = products.value.filter(p => {
    if (term && !p.name.toLowerCase().includes(term) && !(p.sku || '').toLowerCase().includes(term)) return false
    if (filterStatus.value && p.status !== filterStatus.value) return false
    if (filterStock.value) {
      const tracked = Boolean(getValue(p, 'track_stock'))
      if (filterStock.value === 'untracked') return !tracked
      if (!tracked) return false
      const qty = getValue(p, 'stock_quantity')
      const threshold = getValue(p, 'low_stock_threshold')
      if (filterStock.value === 'out') return qty <= 0 && !getValue(p, 'allow_backorder')
      if (filterStock.value === 'low') return qty > 0 && qty <= threshold
      if (filterStock.value === 'healthy') return qty > threshold
    }
    return true
  })
}

async function loadProducts() {
  loading.value = true
  try {
    const { data } = await api.get('/products?all=1&limit=500')
    products.value = (data.products || data).map(p => ({
      ...p,
      track_stock: Boolean(p.track_stock),
      allow_backorder: Boolean(p.allow_backorder),
    }))
    filterProducts()
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function saveAll() {
  if (!dirty.value || saving.value) return
  saving.value = true
  try {
    const updates = Object.entries(edits).map(([id, changes]) => ({ id: parseInt(id), ...changes }))
    await api.post('/products/inventory/bulk', { updates })
    // Merge edits back into products
    for (const [id, changes] of Object.entries(edits)) {
      const p = products.value.find(x => x.id === parseInt(id))
      if (p) Object.assign(p, changes)
    }
    Object.keys(edits).forEach(k => delete edits[k])
    filterProducts()
    savedMsg.value = `Saved changes for ${updates.length} product(s).`
    setTimeout(() => savedMsg.value = '', 4000)
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

onMounted(loadProducts)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem; }
h1 { font-size: 1.4rem; font-weight: 800; }
.filter-row { display: flex; gap: 0.625rem; padding: 0.875rem 1rem; border-radius: 0.875rem; margin-bottom: 1rem; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 180px; }
.save-banner { padding: 0.75rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1rem; color: #7be07b; background: rgba(123,224,123,.08); border: 1px solid rgba(123,224,123,.2); }

.table-wrap { border-radius: 1rem; overflow: hidden; }
.inv-table { width: 100%; border-collapse: collapse; font-size: 0.87rem; }
.inv-table th { padding: 0.625rem 0.875rem; text-align: left; color: var(--text-muted); font-weight: 600; font-size: 0.78rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
.inv-table td { padding: 0.5rem 0.875rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
.inv-table tr:last-child td { border-bottom: none; }
.inv-table tr:hover td { background: rgba(255,255,255,0.02); }
.row-edited td { background: rgba(var(--accent-rgb, 213,60,60), 0.05) !important; }

.prod-name { font-weight: 600; font-size: 0.88rem; }
.prod-meta { font-size: 0.75rem; color: var(--text-muted); }
.sku-cell { font-size: 0.78rem; }

.num-input { width: 70px; padding: 0.3rem 0.5rem; font-size: 0.82rem; text-align: center; }
.input-danger { border-color: hsl(355,70%,50%) !important; color: hsl(355,70%,65%) !important; }
.input-warn { border-color: hsl(40,80%,55%) !important; color: hsl(40,80%,65%) !important; }

.status-pill { display: inline-block; padding: 0.2em 0.6em; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
.status-pill.published { background: rgba(74,222,128,.12); color: rgb(74,222,128); }
.status-pill.draft { background: rgba(255,255,255,.07); color: #aaa; }

.toggle-mini { position: relative; display: inline-block; width: 36px; height: 20px; cursor: pointer; }
.toggle-mini input { opacity: 0; width: 0; height: 0; position: absolute; }
.toggle-bg { display: block; width: 36px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 999px; transition: background .2s; }
.toggle-mini input:checked ~ .toggle-bg { background: var(--accent); }
.toggle-bg::after { content: ''; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; background: #fff; border-radius: 50%; transition: transform .2s; }
.toggle-mini input:checked ~ .toggle-bg::after { transform: translateX(16px); }

.table-footer { display: flex; justify-content: space-between; align-items: center; padding: 0.875rem 1rem; border-top: 1px solid rgba(255,255,255,0.06); }
.accent { color: var(--accent); }
.text-muted { color: var(--text-muted); }
.section { padding: 1.25rem; border-radius: 1rem; }
.empty { text-align: center; color: var(--text-muted); }
</style>
