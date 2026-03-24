<template>
  <div>
    <div class="page-header">
      <h1>💰 Bulk Price Editor</h1>
      <div class="header-actions">
        <button class="btn btn-ghost" @click="selectAll">Select All</button>
        <button class="btn btn-ghost" @click="deselectAll">Deselect All</button>
        <span class="meta">{{ selectedIds.length }} selected</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input v-model="q" @input="debounce(loadProducts, 400)" placeholder="Search products…" class="filter-input" />
      <select v-model="filterCategory" @change="loadProducts" class="filter-select">
        <option value="">All Categories</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <span class="meta">{{ totalProducts }} products</span>
    </div>

    <div class="layout">
      <!-- Left: product list -->
      <div class="product-list glass">
        <div class="loading-bar" v-if="loading"></div>
        <div class="product-item" v-for="p in products" :key="p.id" :class="{ selected: selectedIds.includes(p.id) }" @click="toggleSelect(p.id)">
          <input type="checkbox" :checked="selectedIds.includes(p.id)" @click.stop="toggleSelect(p.id)" class="row-check" />
          <div class="product-info">
            <div class="product-name">{{ p.name }}</div>
            <div class="product-meta">
              <span v-if="p.sku" class="sku">{{ p.sku }}</span>
              <span v-if="p.category_name" class="cat">{{ p.category_name }}</span>
            </div>
          </div>
          <div class="product-prices">
            <div class="price">{{ currency }}{{ p.price.toFixed(2) }}</div>
            <div v-if="p.sale_price" class="sale-price">{{ currency }}{{ p.sale_price.toFixed(2) }}</div>
          </div>
        </div>
        <div class="empty-state" v-if="!loading && !products.length">No products found.</div>
      </div>

      <!-- Right: operation panel -->
      <div class="op-panel">
        <div class="glass op-card">
          <h3>Price Operation</h3>

          <label>Operation</label>
          <select v-model="operation" class="form-select">
            <option value="increase_pct">Increase by %</option>
            <option value="decrease_pct">Decrease by %</option>
            <option value="increase_fixed">Increase by fixed amount</option>
            <option value="decrease_fixed">Decrease by fixed amount</option>
            <option value="set_price">Set to fixed price</option>
            <option value="set_sale">Set sale price</option>
            <option value="clear_sale">Clear sale price</option>
          </select>

          <div v-if="operation !== 'clear_sale'">
            <label>Value {{ valueLabel }}</label>
            <input v-model.number="opValue" type="number" min="0" step="0.01" class="form-input" />
          </div>

          <div v-if="operation !== 'clear_sale' && operation !== 'set_sale'">
            <label>Apply to</label>
            <select v-model="applyTo" class="form-select">
              <option value="price">Regular Price Only</option>
              <option value="sale_price">Sale Price Only</option>
              <option value="both">Both</option>
            </select>
          </div>

          <label>Minimum Price (floor)</label>
          <input v-model.number="minPrice" type="number" min="0" step="0.01" placeholder="0.00" class="form-input" />

          <button class="btn btn-primary wide" @click="generatePreview" :disabled="selectedIds.length === 0 || loadingPreview">
            👁️ Preview Changes ({{ selectedIds.length }})
          </button>
        </div>

        <!-- Preview -->
        <div class="glass op-card preview-card" v-if="preview.length">
          <div class="preview-header">
            <h3>Preview</h3>
            <button class="btn btn-primary" @click="applyChanges" :disabled="applying">
              {{ applying ? 'Applying…' : '✅ Apply Changes' }}
            </button>
          </div>
          <div class="preview-list">
            <div class="preview-item" v-for="p in preview" :key="p.id">
              <div class="preview-name">{{ p.name }}</div>
              <div class="preview-prices">
                <span class="old-val">{{ currency }}{{ p.old_price.toFixed(2) }}</span>
                <span class="arrow">→</span>
                <span class="new-val" :class="{ up: p.new_price > p.old_price, down: p.new_price < p.old_price }">
                  {{ currency }}{{ p.new_price.toFixed(2) }}
                </span>
                <span v-if="p.price_change !== 0" class="delta" :class="{ pos: p.price_change > 0, neg: p.price_change < 0 }">
                  ({{ p.price_change > 0 ? '+' : '' }}{{ p.price_change.toFixed(2) }})
                </span>
              </div>
              <div v-if="p.old_sale_price !== null || p.new_sale_price !== null" class="preview-sale">
                <span class="sale-label">Sale:</span>
                <span class="old-val">{{ p.old_sale_price != null ? currency + p.old_sale_price.toFixed(2) : '—' }}</span>
                <span class="arrow">→</span>
                <span class="new-val">{{ p.new_sale_price != null ? currency + p.new_sale_price.toFixed(2) : '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Success notice -->
        <div class="glass success-notice" v-if="successMsg">
          <span>✅ {{ successMsg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const q = ref('')
const filterCategory = ref('')
const products = ref([])
const categories = ref([])
const totalProducts = ref(0)
const loading = ref(false)
const selectedIds = ref([])
const operation = ref('increase_pct')
const opValue = ref(10)
const applyTo = ref('price')
const minPrice = ref(0)
const preview = ref([])
const loadingPreview = ref(false)
const applying = ref(false)
const successMsg = ref('')
const currency = '€'

const valueLabel = computed(() => {
  if (operation.value.includes('pct')) return '(%)'
  if (operation.value === 'clear_sale') return ''
  return `(${currency})`
})

let debounceTimer = null
function debounce(fn, ms) { clearTimeout(debounceTimer); debounceTimer = setTimeout(fn, ms) }

async function loadProducts() {
  loading.value = true
  const params = new URLSearchParams({ limit: 200 })
  if (q.value) params.set('q', q.value)
  if (filterCategory.value) params.set('category', filterCategory.value)
  const data = await api.get(`/api/bulk-price/products?${params}`)
  products.value = data.products
  totalProducts.value = data.total
  loading.value = false
}

async function loadCategories() {
  categories.value = await api.get('/api/bulk-price/categories')
}

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx === -1) selectedIds.value.push(id)
  else selectedIds.value.splice(idx, 1)
}

function selectAll() { selectedIds.value = products.value.map(p => p.id) }
function deselectAll() { selectedIds.value = [] }

async function generatePreview() {
  if (!selectedIds.value.length) return
  loadingPreview.value = true
  const data = await api.post('/api/bulk-price/preview', {
    product_ids: selectedIds.value,
    operation: operation.value,
    value: opValue.value,
    apply_to: applyTo.value,
    min_price: minPrice.value
  })
  preview.value = data.preview
  loadingPreview.value = false
}

async function applyChanges() {
  if (!preview.value.length) return
  applying.value = true
  const changes = preview.value.map(p => ({
    id: p.id,
    new_price: p.new_price,
    new_sale_price: p.new_sale_price
  }))
  await api.post('/api/bulk-price/apply', { changes })
  successMsg.value = `${changes.length} product${changes.length !== 1 ? 's' : ''} updated successfully!`
  applying.value = false
  preview.value = []
  selectedIds.value = []
  await loadProducts()
  setTimeout(() => { successMsg.value = '' }, 4000)
}

onMounted(() => {
  loadProducts()
  loadCategories()
})
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.filter-bar { display: flex; gap: 10px; padding: 14px 16px; border-radius: 1rem; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.filter-input { flex: 1; min-width: 200px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: inherit; font-size: 13px; }
.filter-select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: inherit; }
.meta { opacity: 0.55; font-size: 12px; }

.layout { display: grid; grid-template-columns: 1fr 380px; gap: 20px; align-items: flex-start; }
@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

.product-list { border-radius: 1rem; overflow-y: auto; max-height: 70vh; }
.product-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.15s; }
.product-item:hover { background: rgba(255,255,255,0.04); }
.product-item.selected { background: rgba(217,79,90,0.1); }
.row-check { cursor: pointer; accent-color: var(--accent); width: 15px; height: 15px; }
.product-info { flex: 1; }
.product-name { font-size: 13px; font-weight: 600; }
.product-meta { display: flex; gap: 6px; margin-top: 2px; }
.sku { font-family: monospace; font-size: 11px; background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; }
.cat { font-size: 11px; opacity: 0.5; }
.product-prices { text-align: right; }
.price { font-size: 13px; font-weight: 700; }
.sale-price { font-size: 11px; color: var(--accent); }

.op-panel { display: flex; flex-direction: column; gap: 16px; }
.op-card { padding: 20px; border-radius: 1rem; }
.op-card h3 { margin-bottom: 16px; font-size: 15px; }
label { display: block; font-size: 12px; opacity: 0.6; margin-top: 14px; margin-bottom: 6px; }
.form-select, .form-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: inherit; font-size: 13px; }
.wide { width: 100%; margin-top: 18px; }

.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.preview-header h3 { font-size: 15px; }
.preview-list { display: flex; flex-direction: column; gap: 10px; max-height: 350px; overflow-y: auto; }
.preview-item { background: rgba(255,255,255,0.04); border-radius: 8px; padding: 10px 12px; }
.preview-name { font-size: 12px; font-weight: 600; margin-bottom: 6px; }
.preview-prices { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.preview-sale { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-top: 4px; opacity: 0.7; }
.sale-label { opacity: 0.6; }
.old-val { opacity: 0.5; text-decoration: line-through; }
.arrow { opacity: 0.4; }
.new-val.up { color: #ef4444; }
.new-val.down { color: #10b981; }
.delta.pos { color: #ef4444; font-size: 11px; }
.delta.neg { color: #10b981; font-size: 11px; }

.success-notice { padding: 14px 18px; border-radius: 1rem; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #10b981; font-weight: 600; }

.loading-bar { height: 3px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: slide 1.2s infinite; }
@keyframes slide { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
.empty-state { padding: 40px; text-align: center; opacity: 0.4; }
.btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-primary { background: var(--accent); color: white; }
.btn-ghost { background: rgba(255,255,255,0.07); color: inherit; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
