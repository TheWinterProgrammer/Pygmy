<template>
  <div class="barcodes-view">
    <div class="page-header">
      <div>
        <h1>🏷️ Product QR Codes & Labels</h1>
        <p class="subtitle">Generate printable QR code labels for your products</p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-accent"
          @click="printSelected"
          :disabled="selected.size === 0"
        >
          🖨️ Print Selected ({{ selected.size }})
        </button>
        <button class="btn btn-ghost" @click="printAll" :disabled="loading">
          🖨️ Print All
        </button>
      </div>
    </div>

    <!-- Controls -->
    <div class="glass controls-bar">
      <input class="form-input" placeholder="Search products…" v-model="q" @input="debouncedLoad" style="width:220px" />
      <select class="form-input" v-model="filterCategory" @change="loadProducts" style="width:160px">
        <option value="">All Categories</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <div class="copies-control">
        <label>Copies per label:</label>
        <input type="number" class="form-input" v-model.number="copies" min="1" max="20" style="width:70px" />
      </div>
      <label class="toggle-label">
        <input type="checkbox" v-model="selectAll" @change="toggleAll" />
        Select All
      </label>
    </div>

    <!-- Products Grid -->
    <div class="products-grid" v-if="!loading">
      <div
        v-for="product in filteredProducts"
        :key="product.id"
        :class="['product-label-card glass', { selected: selected.has(product.id) }]"
        @click="toggleSelect(product.id)"
      >
        <div class="card-check">
          <div :class="['check-box', { checked: selected.has(product.id) }]">
            <span v-if="selected.has(product.id)">✓</span>
          </div>
        </div>

        <div class="card-image">
          <img v-if="product.cover_image" :src="product.cover_image" :alt="product.name" />
          <div v-else class="img-placeholder">📦</div>
        </div>

        <div class="card-info">
          <div class="product-name">{{ product.name }}</div>
          <div class="product-sku" v-if="product.sku">SKU: {{ product.sku }}</div>
          <div class="product-price">
            <span v-if="product.sale_price && product.sale_price < product.price" class="sale-price">€{{ Number(product.sale_price).toFixed(2) }}</span>
            <span :class="product.sale_price && product.sale_price < product.price ? 'original-price' : 'regular-price'">€{{ Number(product.price).toFixed(2) }}</span>
          </div>
        </div>

        <div class="card-actions" @click.stop>
          <a :href="`/api/barcodes/print/${product.id}`" target="_blank" class="btn btn-xs btn-ghost">
            🖨️ Single Label
          </a>
        </div>
      </div>

      <div v-if="!filteredProducts.length" class="empty-state">
        <div>📦 No products found</div>
      </div>
    </div>
    <div v-else class="loading-state">Loading products…</div>

    <!-- Preview Panel -->
    <div v-if="selected.size > 0" class="preview-panel glass">
      <h3>🏷️ Label Preview</h3>
      <p class="preview-note">
        {{ selected.size }} product(s) × {{ copies }} cop{{ copies === 1 ? 'y' : 'ies' }} = {{ selected.size * copies }} labels total
      </p>
      <div class="preview-label">
        <div class="preview-qr">
          <svg viewBox="0 0 100 100" width="80" height="80">
            <!-- Simplified QR placeholder art -->
            <rect x="0" y="0" width="40" height="40" fill="none" stroke="#ccc" stroke-width="3"/>
            <rect x="10" y="10" width="20" height="20" fill="#ccc"/>
            <rect x="60" y="0" width="40" height="40" fill="none" stroke="#ccc" stroke-width="3"/>
            <rect x="70" y="10" width="20" height="20" fill="#ccc"/>
            <rect x="0" y="60" width="40" height="40" fill="none" stroke="#ccc" stroke-width="3"/>
            <rect x="10" y="70" width="20" height="20" fill="#ccc"/>
            <rect x="50" y="50" width="10" height="10" fill="#ccc"/>
            <rect x="65" y="55" width="10" height="10" fill="#ccc"/>
            <rect x="80" y="65" width="10" height="10" fill="#ccc"/>
            <rect x="55" y="80" width="10" height="10" fill="#ccc"/>
          </svg>
          <div class="preview-label-text">QR → Product URL</div>
        </div>
        <div class="preview-details">
          <div class="preview-name">Product Name</div>
          <div class="preview-sku">SKU: PRODUCT-001</div>
          <div class="preview-price">€0.00</div>
          <div class="preview-site">Your Site Name</div>
        </div>
      </div>
      <p class="preview-hint">Actual QR codes are generated at print time via JavaScript</p>
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
const selected = ref(new Set())
const selectAll = ref(false)
const copies = ref(1)
const loading = ref(false)

const filteredProducts = computed(() => {
  if (!q.value) return products.value
  const s = q.value.toLowerCase()
  return products.value.filter(p =>
    p.name?.toLowerCase().includes(s) ||
    p.sku?.toLowerCase().includes(s)
  )
})

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadProducts, 300)
}

function toggleSelect(id) {
  if (selected.value.has(id)) {
    selected.value.delete(id)
  } else {
    selected.value.add(id)
  }
  selected.value = new Set(selected.value) // trigger reactivity
}

function toggleAll() {
  if (selectAll.value) {
    selected.value = new Set(filteredProducts.value.map(p => p.id))
  } else {
    selected.value = new Set()
  }
}

function printSelected() {
  const ids = [...selected.value].join(',')
  window.open(`/api/barcodes/sheet?ids=${ids}&copies=${copies.value}`, '_blank')
}

function printAll() {
  const ids = products.value.map(p => p.id).join(',')
  window.open(`/api/barcodes/sheet?ids=${ids}&copies=${copies.value}`, '_blank')
}

async function loadProducts() {
  loading.value = true
  try {
    const params = new URLSearchParams({ all: '1', limit: '200' })
    if (filterCategory.value) params.set('category', filterCategory.value)
    const { data } = await api.get(`/products?${params}`)
    products.value = Array.isArray(data) ? data : (data?.items || [])
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  const { data } = await api.get('/products/categories')
  categories.value = data || []
}

onMounted(async () => {
  await Promise.all([loadProducts(), loadCategories()])
})
</script>

<style scoped>
.barcodes-view { padding: 2rem; max-width: 1400px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }
.subtitle { color: var(--text-muted, #aaa); font-size: .875rem; margin-top: .2rem; }
.header-actions { display: flex; gap: .75rem; flex-wrap: wrap; }

.glass { background: rgba(255,255,255,.04); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1rem; }
.controls-bar { display: flex; gap: .75rem; align-items: center; padding: 1rem 1.25rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.copies-control { display: flex; align-items: center; gap: .5rem; font-size: .85rem; }
.toggle-label { display: flex; align-items: center; gap: .4rem; font-size: .85rem; cursor: pointer; }
.toggle-label input { cursor: pointer; accent-color: var(--accent, #e05469); }

.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.product-label-card { position: relative; border-radius: 1rem; overflow: hidden; cursor: pointer; transition: all .2s; }
.product-label-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.2); }
.product-label-card.selected { border-color: var(--accent, #e05469); background: rgba(var(--accent-rgb, 224, 84, 105), .06); }
.card-check { position: absolute; top: .6rem; left: .6rem; z-index: 1; }
.check-box { width: 20px; height: 20px; border-radius: .35rem; border: 2px solid rgba(255,255,255,.3); display: flex; align-items: center; justify-content: center; font-size: .75rem; background: rgba(0,0,0,.3); color: white; transition: all .15s; }
.check-box.checked { background: var(--accent, #e05469); border-color: var(--accent, #e05469); }
.card-image { height: 120px; overflow: hidden; }
.card-image img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; background: rgba(255,255,255,.04); }
.card-info { padding: .75rem; }
.product-name { font-size: .875rem; font-weight: 600; margin-bottom: .25rem; }
.product-sku { font-size: .75rem; color: rgba(255,255,255,.5); font-family: monospace; margin-bottom: .25rem; }
.product-price { font-size: .875rem; font-weight: 700; }
.sale-price { color: var(--accent, #e05469); margin-right: .4rem; }
.original-price { color: rgba(255,255,255,.4); text-decoration: line-through; font-size: .8rem; }
.regular-price { color: white; }
.card-actions { padding: .5rem .75rem .75rem; border-top: 1px solid rgba(255,255,255,.06); }

.empty-state { grid-column: 1/-1; text-align: center; padding: 4rem; color: rgba(255,255,255,.4); font-size: 1.1rem; }
.loading-state { text-align: center; padding: 3rem; color: rgba(255,255,255,.4); }

.preview-panel { padding: 1.5rem; margin-top: 1rem; }
.preview-panel h3 { font-size: 1rem; font-weight: 700; margin-bottom: .5rem; }
.preview-note { font-size: .9rem; color: rgba(255,255,255,.6); margin-bottom: 1rem; }
.preview-label { display: flex; gap: 1.5rem; align-items: center; background: rgba(255,255,255,.04); border-radius: .75rem; padding: 1rem; width: fit-content; }
.preview-qr { text-align: center; }
.preview-label-text { font-size: .7rem; color: rgba(255,255,255,.4); margin-top: .25rem; }
.preview-details { }
.preview-name { font-size: .85rem; font-weight: 700; margin-bottom: .2rem; }
.preview-sku { font-size: .7rem; color: rgba(255,255,255,.5); font-family: monospace; margin-bottom: .2rem; }
.preview-price { font-size: 1rem; font-weight: 900; color: var(--accent, #e05469); margin-bottom: .2rem; }
.preview-site { font-size: .7rem; color: rgba(255,255,255,.4); }
.preview-hint { font-size: .75rem; color: rgba(255,255,255,.35); margin-top: .75rem; }

.form-input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; color: white; padding: .5rem .75rem; font-size: .875rem; }
.btn { padding: .5rem 1rem; border-radius: .5rem; cursor: pointer; font-size: .875rem; border: none; transition: all .2s; font-family: inherit; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-accent { background: var(--accent, #e05469); color: white; }
.btn-ghost { background: rgba(255,255,255,.06); color: white; border: 1px solid rgba(255,255,255,.12); }
.btn-ghost:hover { background: rgba(255,255,255,.1); }
.btn-xs { padding: .3rem .6rem; font-size: .75rem; }
</style>
