<template>
  <div class="recs-view">
    <div class="page-header">
      <div>
        <h1>🔗 Product Recommendations</h1>
        <p class="subtitle">Manually curate cross-sell, upsell, and related products per product</p>
      </div>
    </div>

    <!-- Product Search -->
    <div class="glass search-card">
      <label class="field-label">Select a product to manage its recommendations</label>
      <div class="product-search-row">
        <input
          v-model="productQuery"
          @input="searchProducts"
          type="text"
          class="form-input"
          placeholder="Search products by name…"
        />
      </div>
      <!-- Dropdown -->
      <div v-if="productResults.length && !selectedProduct" class="product-dropdown">
        <div
          v-for="p in productResults"
          :key="p.id"
          class="product-option"
          @click="selectProduct(p)"
        >
          <img v-if="p.cover_image" :src="p.cover_image" class="opt-thumb" />
          <div class="opt-thumb opt-thumb-placeholder" v-else>🛍️</div>
          <div>
            <div class="opt-name">{{ p.name }}</div>
            <div class="opt-meta text-muted">{{ p.status }} · €{{ Number(p.price).toFixed(2) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected Product Panel -->
    <div v-if="selectedProduct" class="glass selected-product-card">
      <div class="selected-header">
        <img v-if="selectedProduct.cover_image" :src="selectedProduct.cover_image" class="sel-thumb" />
        <div class="sel-thumb sel-thumb-placeholder" v-else>🛍️</div>
        <div class="sel-info">
          <div class="sel-name">{{ selectedProduct.name }}</div>
          <div class="text-muted">{{ selectedProduct.status }} · €{{ Number(selectedProduct.price).toFixed(2) }}</div>
        </div>
        <button class="btn-ghost btn-sm" @click="clearSelection">✕ Change product</button>
      </div>

      <!-- Tabs for recommendation types -->
      <div class="rec-tabs">
        <button
          v-for="tab in recTypes" :key="tab.value"
          class="tab-btn" :class="{ active: activeType === tab.value }"
          @click="activeType = tab.value; loadRecs()"
        >
          {{ tab.icon }} {{ tab.label }}
          <span class="tab-count" v-if="recs[tab.value]">{{ recs[tab.value].length }}</span>
        </button>
      </div>

      <!-- Current recommendations -->
      <div class="recs-section">
        <div class="loading-bar" v-if="loadingRecs"></div>
        <div v-if="!loadingRecs && currentRecs.length === 0" class="empty-state-sm text-muted">
          No {{ activeTypeName }} set for this product. Add one below.
        </div>
        <div class="recs-list" v-if="currentRecs.length">
          <div v-for="(rec, idx) in currentRecs" :key="rec.id" class="rec-row">
            <img v-if="rec.cover_image" :src="rec.cover_image" class="rec-thumb" />
            <div class="rec-thumb rec-thumb-ph" v-else>🛍️</div>
            <div class="rec-details">
              <div class="rec-name">{{ rec.name }}</div>
              <div class="text-muted rec-meta">€{{ Number(rec.price).toFixed(2) }} · {{ rec.status }}</div>
            </div>
            <div class="rec-order">
              <button class="btn-ghost btn-xs" @click="moveRec(idx, -1)" :disabled="idx === 0">↑</button>
              <button class="btn-ghost btn-xs" @click="moveRec(idx, 1)" :disabled="idx === currentRecs.length - 1">↓</button>
            </div>
            <button class="btn-ghost btn-xs danger" @click="removeRec(rec)">✕</button>
          </div>
        </div>

        <!-- Add recommended product -->
        <div class="add-rec-section">
          <div class="add-rec-label">+ Add {{ activeTypeName }} product</div>
          <div class="product-search-row">
            <input
              v-model="addQuery"
              @input="searchAdd"
              type="text"
              class="form-input form-input-sm"
              placeholder="Search to add…"
            />
          </div>
          <div v-if="addResults.length" class="product-dropdown">
            <div
              v-for="p in addResults"
              :key="p.id"
              class="product-option"
              @click="addRec(p)"
            >
              <img v-if="p.cover_image" :src="p.cover_image" class="opt-thumb" />
              <div class="opt-thumb opt-thumb-placeholder" v-else>🛍️</div>
              <div>
                <div class="opt-name">{{ p.name }}</div>
                <div class="opt-meta text-muted">{{ p.status }} · €{{ Number(p.price).toFixed(2) }}</div>
              </div>
              <span v-if="isAlreadyRec(p.id)" class="already-added">✓ added</span>
            </div>
          </div>
          <p class="help-text text-muted" style="font-size:.8rem;margin-top:.5rem;">
            {{ activeTypeDesc }}
          </p>
        </div>
      </div>
    </div>

    <!-- How-it-works section -->
    <div class="glass how-it-works" v-if="!selectedProduct">
      <h3 style="margin:0 0 1rem">How recommendations work</h3>
      <div class="hiw-grid">
        <div class="hiw-card">
          <div class="hiw-icon">🔄</div>
          <div class="hiw-title">Related</div>
          <p class="hiw-desc">Products shown in the "You may also like" section on the product page. Great for items in the same category.</p>
        </div>
        <div class="hiw-card">
          <div class="hiw-icon">⬆️</div>
          <div class="hiw-title">Upsell</div>
          <p class="hiw-desc">Premium alternatives shown near the Add to Cart button. Encourage customers to buy a higher-value item.</p>
        </div>
        <div class="hiw-card">
          <div class="hiw-icon">🛒</div>
          <div class="hiw-title">Cross-sell</div>
          <p class="hiw-desc">Complementary items shown on the product page and in the cart. "Customers also bought…"</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import api from '../api.js'

const productQuery   = ref('')
const productResults = ref([])
const selectedProduct = ref(null)
const activeType     = ref('related')
const recs           = ref({ related: [], upsell: [], crosssell: [] })
const loadingRecs    = ref(false)
const addQuery       = ref('')
const addResults     = ref([])

let productSearchTimer = null
let addSearchTimer = null

const recTypes = [
  { value: 'related',   label: 'Related',    icon: '🔄' },
  { value: 'upsell',    label: 'Upsell',     icon: '⬆️' },
  { value: 'crosssell', label: 'Cross-sell', icon: '🛒' },
]

const activeTypeName = computed(() => recTypes.find(t => t.value === activeType.value)?.label || '')
const activeTypeDesc = computed(() => {
  const descs = {
    related:   'Products shown in the "You may also like" section. Usually items in the same category.',
    upsell:    'Premium alternatives shown near the Add to Cart button.',
    crosssell: 'Complementary products. Shown as "Customers also bought…" on the product page and in the cart.',
  }
  return descs[activeType.value] || ''
})

const currentRecs = computed(() => recs.value[activeType.value] || [])

function searchProducts() {
  clearTimeout(productSearchTimer)
  if (productQuery.value.length < 2) { productResults.value = []; return }
  productSearchTimer = setTimeout(async () => {
    const { data } = await api.get('/products', { params: { q: productQuery.value, all: 1, limit: 8 } })
    productResults.value = data.products || data || []
  }, 200)
}

function selectProduct(p) {
  selectedProduct.value = p
  productResults.value = []
  productQuery.value = p.name
  recs.value = { related: [], upsell: [], crosssell: [] }
  loadRecs()
}

function clearSelection() {
  selectedProduct.value = null
  productQuery.value = ''
  productResults.value = []
  recs.value = { related: [], upsell: [], crosssell: [] }
  addQuery.value = ''
  addResults.value = []
}

async function loadRecs() {
  if (!selectedProduct.value) return
  loadingRecs.value = true
  try {
    const { data } = await api.get('/recommendations', {
      params: { product_id: selectedProduct.value.id }
    })
    recs.value = { related: [], upsell: [], crosssell: [] }
    for (const rec of data) {
      const key = rec.type === 'cross-sell' ? 'crosssell' : rec.type
      if (!recs.value[key]) recs.value[key] = []
      recs.value[key].push(rec)
    }
  } finally {
    loadingRecs.value = false
  }
}

function searchAdd() {
  clearTimeout(addSearchTimer)
  if (addQuery.value.length < 2) { addResults.value = []; return }
  addSearchTimer = setTimeout(async () => {
    const { data } = await api.get('/products', { params: { q: addQuery.value, all: 1, limit: 8 } })
    const products = data.products || data || []
    addResults.value = products.filter(p => p.id !== selectedProduct.value?.id)
  }, 200)
}

function isAlreadyRec(id) {
  return currentRecs.value.some(r => r.recommended_id === id || r.id === id)
}

async function addRec(product) {
  if (isAlreadyRec(product.id)) return
  const typeMap = { related: 'related', upsell: 'upsell', crosssell: 'cross-sell' }
  await api.post('/recommendations', {
    product_id: selectedProduct.value.id,
    recommended_id: product.id,
    type: typeMap[activeType.value],
    sort_order: currentRecs.value.length,
  })
  addQuery.value = ''
  addResults.value = []
  await loadRecs()
}

async function removeRec(rec) {
  await api.delete(`/recommendations/${rec.id}`)
  await loadRecs()
}

async function moveRec(idx, dir) {
  const list = [...currentRecs.value]
  const swapIdx = idx + dir
  if (swapIdx < 0 || swapIdx >= list.length) return
  ;[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]]

  const typeMap = { related: 'related', upsell: 'upsell', crosssell: 'cross-sell' }
  await Promise.all(list.map((r, i) =>
    api.put(`/recommendations/${r.id}`, { sort_order: i })
  ))
  await loadRecs()
}
</script>

<style scoped>
.recs-view { max-width: 820px; }

.search-card { padding: 1.5rem; margin-bottom: 1.5rem; position: relative; }
.field-label { display: block; margin-bottom: .5rem; font-size: .85rem; color: var(--text-muted, #aaa); }

.product-dropdown {
  position: absolute;
  top: calc(100% - .5rem);
  left: 1.5rem; right: 1.5rem;
  background: hsl(228, 4%, 18%);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: .75rem;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
  overflow: hidden;
}

.product-option {
  display: flex; align-items: center; gap: .75rem;
  padding: .6rem 1rem;
  cursor: pointer;
  transition: background .15s;
}
.product-option:hover { background: rgba(255,255,255,.06); }

.opt-thumb { width: 36px; height: 36px; border-radius: .4rem; object-fit: cover; flex-shrink: 0; }
.opt-thumb-placeholder { width: 36px; height: 36px; border-radius: .4rem; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
.opt-name { font-size: .9rem; font-weight: 600; }
.opt-meta { font-size: .75rem; }

.selected-product-card { padding: 1.5rem; margin-bottom: 1.5rem; }
.selected-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.sel-thumb { width: 56px; height: 56px; border-radius: .5rem; object-fit: cover; }
.sel-thumb-placeholder { width: 56px; height: 56px; border-radius: .5rem; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.sel-name { font-size: 1.1rem; font-weight: 700; margin-bottom: .2rem; }
.sel-info { flex: 1; }

.rec-tabs { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
.tab-btn {
  padding: .5rem 1rem; border-radius: .5rem; border: 1px solid transparent;
  background: rgba(255,255,255,.05); color: inherit; cursor: pointer; font-size: .85rem;
  display: flex; align-items: center; gap: .4rem; transition: all .15s;
}
.tab-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.tab-count {
  background: rgba(255,255,255,.2); border-radius: 100px;
  padding: 0 .4rem; font-size: .7rem; line-height: 1.6;
}

.recs-list { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
.rec-row {
  display: flex; align-items: center; gap: .75rem;
  padding: .6rem; border-radius: .5rem; background: rgba(255,255,255,.04);
}
.rec-thumb { width: 40px; height: 40px; border-radius: .4rem; object-fit: cover; flex-shrink: 0; }
.rec-thumb-ph { width: 40px; height: 40px; border-radius: .4rem; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
.rec-details { flex: 1; }
.rec-name { font-size: .9rem; font-weight: 600; }
.rec-meta { font-size: .75rem; }
.rec-order { display: flex; gap: .25rem; }

.add-rec-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,.07); position: relative; }
.add-rec-label { font-size: .85rem; font-weight: 600; margin-bottom: .5rem; }

.already-added { margin-left: auto; font-size: .75rem; color: var(--accent); }

.how-it-works { padding: 1.5rem; }
.hiw-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; }
.hiw-card { background: rgba(255,255,255,.04); border-radius: .75rem; padding: 1rem; }
.hiw-icon { font-size: 1.5rem; margin-bottom: .5rem; }
.hiw-title { font-weight: 700; margin-bottom: .4rem; }
.hiw-desc { font-size: .82rem; color: var(--text-muted, #aaa); line-height: 1.5; }

.btn-xs { padding: .2rem .5rem; font-size: .75rem; }
.form-input-sm { height: 36px; font-size: .85rem; }
.empty-state-sm { padding: 1rem; text-align: center; }

@media (max-width: 600px) {
  .hiw-grid { grid-template-columns: 1fr; }
}
</style>
