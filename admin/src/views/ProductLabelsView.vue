<template>
  <div class="labels-view">
    <div class="page-header">
      <div>
        <h1>🏷️ Product Label Printer</h1>
        <p class="subtitle">Generate printable product labels and barcodes</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" :disabled="selected.size === 0" @click="printLabels">
          🖨️ Print {{ selected.size > 0 ? `(${selected.size})` : '' }} Labels
        </button>
      </div>
    </div>

    <!-- Print Options -->
    <div class="glass section print-options">
      <h3 class="options-title">Label Options</h3>
      <div class="options-row">
        <div class="option-group">
          <label class="label">Template</label>
          <select v-model="template" class="form-input">
            <option value="standard">Standard (90×50mm)</option>
            <option value="compact">Compact (50×30mm)</option>
            <option value="price_tag">Price Tag (60×40mm)</option>
            <option value="shelf">Shelf Label (120×30mm)</option>
          </select>
        </div>
        <div class="option-group">
          <label class="label">Copies per product</label>
          <input v-model.number="copies" type="number" min="1" max="10" class="form-input" style="width:80px" />
        </div>
        <label class="option-toggle">
          <input type="checkbox" v-model="showPrice" />
          Show Price
        </label>
        <label class="option-toggle">
          <input type="checkbox" v-model="showSku" />
          Show SKU
        </label>
        <label class="option-toggle">
          <input type="checkbox" v-model="showBarcode" />
          Show Barcode
        </label>
      </div>
    </div>

    <!-- Product Search & Selection -->
    <div class="glass section">
      <div class="search-row">
        <input v-model="q" @input="debounceLoad" placeholder="Search products…" class="form-input" style="max-width:300px" />
        <div class="select-actions" v-if="products.length">
          <button class="btn-ghost btn-sm" @click="selectAll">Select All</button>
          <button class="btn-ghost btn-sm" @click="selected.clear()">Clear</button>
        </div>
      </div>

      <div class="loading-bar" v-if="loading"></div>

      <div class="products-grid">
        <div
          v-for="p in products" :key="p.id"
          :class="['product-card', { selected: selected.has(p.id) }]"
          @click="toggleSelect(p.id)"
        >
          <div class="product-check">
            <div :class="['checkbox', { checked: selected.has(p.id) }]">{{ selected.has(p.id) ? '✓' : '' }}</div>
          </div>
          <div class="product-img">
            <img v-if="p.cover_image" :src="p.cover_image" :alt="p.name" />
            <div v-else class="img-placeholder">📦</div>
          </div>
          <div class="product-info">
            <div class="product-name">{{ p.name }}</div>
            <div class="product-sku" v-if="p.sku">SKU: {{ p.sku }}</div>
            <div class="product-price">
              <span v-if="p.sale_price" class="orig-price">€{{ p.price.toFixed(2) }}</span>
              <span class="price">€{{ (p.sale_price || p.price).toFixed(2) }}</span>
            </div>
            <div class="stock-badge">Stock: {{ p.stock_quantity }}</div>
          </div>
        </div>
      </div>

      <div v-if="products.length === 0 && !loading" class="empty-state">
        <p>No products found.</p>
      </div>

      <div class="pagination" v-if="total > limit">
        <button @click="page--; load()" :disabled="page <= 1" class="btn-ghost">← Prev</button>
        <span>Page {{ page }} / {{ Math.ceil(total/limit) }}</span>
        <button @click="page++; load()" :disabled="page >= Math.ceil(total/limit)" class="btn-ghost">Next →</button>
      </div>
    </div>

    <!-- Selected summary bar -->
    <div v-if="selected.size > 0" class="selected-bar glass">
      <div class="selected-info">
        <strong>{{ selected.size }}</strong> product{{ selected.size !== 1 ? 's' : '' }} selected
        · Template: <strong>{{ template }}</strong>
        · Copies: <strong>{{ copies }}</strong>
      </div>
      <button class="btn btn-primary" @click="printLabels">🖨️ Print Labels</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../api.js'

const { get } = useApi()

const products = ref([])
const total = ref(0)
const loading = ref(false)
const selected = ref(new Set())
const q = ref('')
const page = ref(1)
const limit = 24

const template = ref('standard')
const copies = ref(1)
const showPrice = ref(true)
const showSku = ref(true)
const showBarcode = ref(true)

let debounce = null

function debounceLoad () {
  clearTimeout(debounce)
  debounce = setTimeout(() => { page.value = 1; load() }, 300)
}

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit, offset: (page.value - 1) * limit })
    if (q.value) params.set('q', q.value)
    const data = await get(`/api/product-labels/products?${params}`)
    products.value = data.products || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

function toggleSelect (id) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

function selectAll () {
  const s = new Set(selected.value)
  for (const p of products.value) s.add(p.id)
  selected.value = s
}

function printLabels () {
  if (selected.value.size === 0) return
  const ids = Array.from(selected.value).join(',')
  const params = new URLSearchParams({
    ids,
    template: template.value,
    copies: copies.value,
    show_price: showPrice.value ? '1' : '0',
    show_sku: showSku.value ? '1' : '0',
    show_barcode: showBarcode.value ? '1' : '0',
  })
  // Get token for auth
  const token = localStorage.getItem('token')
  // Open in new tab with token as query param
  const url = `/api/product-labels/print?${params}&auth_token=${token}`
  window.open(url, '_blank')
}

onMounted(load)
</script>

<style scoped>
.labels-view { max-width: 1100px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.6rem; font-weight: 700; }
.subtitle { color: rgba(255,255,255,.5); font-size: .9rem; margin-top: .2rem; }
.header-actions { display: flex; gap: .75rem; }
.glass { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; }
.section { padding: 1.5rem; margin-bottom: 1.5rem; }
.print-options { margin-bottom: 1.5rem; }
.options-title { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; }
.options-row { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.option-group { display: flex; flex-direction: column; gap: .3rem; }
.option-toggle { display: flex; align-items: center; gap: .4rem; cursor: pointer; font-size: .875rem; color: rgba(255,255,255,.8); }
.option-toggle input { accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer; }
.label { font-size: .8rem; font-weight: 600; color: rgba(255,255,255,.6); }
.search-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.select-actions { display: flex; gap: .5rem; }
.loading-bar { height: 3px; background: var(--accent); border-radius: 2px; animation: loading 1s infinite; margin-bottom: 1rem; }
@keyframes loading { 0%,100%{opacity:.3} 50%{opacity:1} }
.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
.product-card { background: rgba(255,255,255,.04); border: 2px solid rgba(255,255,255,.08); border-radius: 1rem; padding: .8rem; cursor: pointer; transition: all .15s; position: relative; }
.product-card:hover { border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.07); }
.product-card.selected { border-color: var(--accent, hsl(355,70%,58%)); background: rgba(220,50,70,.08); }
.product-check { position: absolute; top: .6rem; right: .6rem; }
.checkbox { width: 20px; height: 20px; border-radius: .35rem; border: 2px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 700; transition: all .15s; }
.checkbox.checked { background: var(--accent, hsl(355,70%,58%)); border-color: var(--accent); color: #fff; }
.product-img { width: 100%; aspect-ratio: 1; border-radius: .6rem; overflow: hidden; margin-bottom: .6rem; background: rgba(255,255,255,.05); display: flex; align-items: center; justify-content: center; }
.product-img img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder { font-size: 2rem; }
.product-name { font-size: .85rem; font-weight: 600; margin-bottom: .2rem; line-height: 1.3; }
.product-sku { font-size: .75rem; color: rgba(255,255,255,.5); }
.product-price { font-size: .9rem; font-weight: 700; margin-top: .3rem; }
.orig-price { font-size: .75rem; color: rgba(255,255,255,.4); text-decoration: line-through; margin-right: .3rem; }
.stock-badge { font-size: .7rem; color: rgba(255,255,255,.4); margin-top: .2rem; }
.empty-state { text-align: center; padding: 2rem; color: rgba(255,255,255,.4); }
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
.selected-bar { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 1.5rem; padding: 1rem 1.5rem; z-index: 100; white-space: nowrap; }
.selected-info { font-size: .875rem; color: rgba(255,255,255,.8); }
.form-input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; padding: .6rem .9rem; color: #fff; font-size: .9rem; }
.btn { padding: .6rem 1.4rem; border-radius: .8rem; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; }
.btn-primary { background: var(--accent, hsl(355,70%,58%)); color: #fff; }
.btn-sm { padding: .35rem .8rem; border-radius: .5rem; border: none; cursor: pointer; font-size: .8rem; font-weight: 600; }
.btn-ghost { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); border: none; border-radius: .5rem; padding: .4rem .9rem; cursor: pointer; font-size: .875rem; font-weight: 600; }
</style>
