<template>
  <div>
    <div class="page-header">
      <div>
        <RouterLink to="/bundles" class="back-link">← Bundles</RouterLink>
        <h1>{{ isNew ? 'New Bundle' : 'Edit Bundle' }}</h1>
      </div>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap">
        <button class="btn btn-ghost" @click="router.push('/bundles')">Cancel</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : '💾 Save Bundle' }}</button>
      </div>
    </div>

    <div v-if="loadingBundle" class="glass section"><div class="loading-bar"></div></div>

    <div v-else class="edit-layout">
      <!-- Main column -->
      <div class="main-col">
        <!-- Basic info -->
        <div class="glass section">
          <div class="form-group">
            <label>Bundle Name *</label>
            <input v-model="form.name" class="input" placeholder="e.g. Summer Starter Pack" required />
          </div>
          <div class="form-group">
            <label>Slug</label>
            <input v-model="form.slug" class="input" placeholder="auto-generated from name" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="form.description" class="input" rows="4" placeholder="Describe what's in this bundle…"></textarea>
          </div>
        </div>

        <!-- Products in bundle -->
        <div class="glass section">
          <div class="section-header">
            <h2>Bundle Items</h2>
            <small class="hint">Minimum 2 products required</small>
          </div>

          <div v-if="form.items.length" class="bundle-items">
            <div v-for="(item, idx) in form.items" :key="idx" class="bundle-item">
              <div class="item-info">
                <img v-if="item.cover_image" :src="backendUrl + item.cover_image" class="item-thumb" alt="" />
                <div v-else class="item-thumb-placeholder">📦</div>
                <div>
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-price">{{ currency }}{{ (item.price).toFixed(2) }}</div>
                </div>
              </div>
              <div class="item-controls">
                <label class="qty-label">Qty</label>
                <input type="number" v-model.number="item.quantity" min="1" class="input qty-input" />
                <button class="btn btn-ghost btn-sm danger" @click="removeItem(idx)">✕</button>
              </div>
            </div>
          </div>

          <div v-else class="empty-items">No products added yet. Search below to add products.</div>

          <!-- Product search -->
          <div class="product-search-row">
            <input
              v-model="productSearch"
              class="input"
              placeholder="Search products to add…"
              @input="searchProducts"
            />
          </div>
          <div v-if="searchResults.length" class="search-results glass">
            <div
              v-for="p in searchResults"
              :key="p.id"
              class="search-result-row"
              @click="addProduct(p)"
            >
              <img v-if="p.cover_image" :src="backendUrl + p.cover_image" class="sr-thumb" alt="" />
              <div v-else class="sr-thumb-ph">📦</div>
              <div class="sr-info">
                <div class="sr-name">{{ p.name }}</div>
                <div class="sr-price">{{ currency }}{{ p.price.toFixed(2) }}</div>
              </div>
              <span class="sr-add">＋ Add</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="side-col">
        <!-- Discount settings -->
        <div class="glass section">
          <h2>Discount</h2>
          <div class="form-group">
            <label>Discount Type</label>
            <select v-model="form.discount_type" class="input">
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed Amount ({{ currency }})</option>
            </select>
          </div>
          <div class="form-group">
            <label>Discount Value</label>
            <input v-model.number="form.discount_value" class="input" type="number" min="0" step="0.01" />
          </div>

          <!-- Price preview -->
          <div v-if="form.items.length" class="price-preview">
            <div class="price-row">
              <span>Original Total:</span>
              <span class="text-muted">{{ currency }}{{ originalTotal.toFixed(2) }}</span>
            </div>
            <div class="price-row">
              <span>Savings:</span>
              <span style="color:rgb(74,222,128)">−{{ currency }}{{ savings.toFixed(2) }}</span>
            </div>
            <div class="price-row total-row">
              <span>Bundle Price:</span>
              <span class="accent">{{ currency }}{{ bundlePrice.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Status -->
        <div class="glass section">
          <h2>Status</h2>
          <select v-model="form.status" class="input">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <!-- Cover image -->
        <div class="glass section">
          <h2>Cover Image</h2>
          <input v-model="form.cover_image" class="input" placeholder="Image URL or media path" />
          <img v-if="form.cover_image" :src="backendUrl + form.cover_image" class="cover-preview" alt="Cover preview" />
        </div>

        <!-- Error -->
        <div v-if="saveError" class="error-box glass">{{ saveError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api.js'

const router = useRouter()
const route = useRoute()

const isNew = computed(() => route.params.id === 'new')
const loadingBundle = ref(true)
const saving = ref(false)
const saveError = ref('')
const currency = ref('€')

const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3200'

const form = ref({
  name: '',
  slug: '',
  description: '',
  discount_type: 'percent',
  discount_value: 10,
  cover_image: '',
  status: 'draft',
  items: [],
})

const productSearch = ref('')
const searchResults = ref([])
let searchTimer = null

const originalTotal = computed(() => {
  return form.value.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
})

const savings = computed(() => {
  if (form.value.discount_type === 'percent') {
    return originalTotal.value * (form.value.discount_value / 100)
  }
  return Math.min(form.value.discount_value, originalTotal.value)
})

const bundlePrice = computed(() => Math.max(0, originalTotal.value - savings.value))

function addProduct(p) {
  const already = form.value.items.find(i => i.product_id === p.id)
  if (already) { already.quantity++; return }
  form.value.items.push({ product_id: p.id, name: p.name, price: p.price, cover_image: p.cover_image, quantity: 1 })
  searchResults.value = []
  productSearch.value = ''
}

function removeItem(idx) { form.value.items.splice(idx, 1) }

function searchProducts() {
  clearTimeout(searchTimer)
  if (!productSearch.value.trim()) { searchResults.value = []; return }
  searchTimer = setTimeout(async () => {
    const { data } = await api.get('/products?all=1&limit=10', { params: { q: productSearch.value } })
    const existing = new Set(form.value.items.map(i => i.product_id))
    searchResults.value = (data.products || data || []).filter(p => !existing.has(p.id)).slice(0, 8)
  }, 300)
}

async function save() {
  saving.value = true
  saveError.value = ''
  const payload = {
    ...form.value,
    items: form.value.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
  }
  try {
    if (isNew.value) {
      const { data } = await api.post('/bundles', payload)
      router.replace(`/bundles/${data.id}`)
    } else {
      await api.put(`/bundles/${route.params.id}`, payload)
    }
  } catch (e) {
    saveError.value = e.response?.data?.error || 'Save failed'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const settingsRes = await api.get('/settings')
  currency.value = settingsRes.data.shop_currency_symbol || '€'

  if (!isNew.value) {
    try {
      const { data } = await api.get(`/bundles/${route.params.id}`)
      // data is returned by slug — need to handle ID-based fetch
      // Fallback: list all bundles and find by id
      const allRes = await api.get('/bundles?all=1')
      const bundle = allRes.data.find(b => b.id === parseInt(route.params.id))
      if (bundle) {
        form.value = {
          name: bundle.name,
          slug: bundle.slug,
          description: bundle.description,
          discount_type: bundle.discount_type,
          discount_value: bundle.discount_value,
          cover_image: bundle.cover_image,
          status: bundle.status,
          items: (bundle.items || []).map(i => ({
            product_id: i.product_id,
            name: i.name,
            price: i.price,
            cover_image: i.cover_image,
            quantity: i.quantity,
          })),
        }
      }
    } catch {}
  }
  loadingBundle.value = false
})
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem; }
.back-link { font-size: 0.85rem; color: var(--text-muted); text-decoration: none; display: block; margin-bottom: 0.25rem; }
.back-link:hover { color: var(--accent); }
h1 { font-size: 1.4rem; font-weight: 800; margin: 0; }
h2 { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; }

.edit-layout { display: grid; grid-template-columns: 1fr 340px; gap: 1.25rem; align-items: start; }
@media (max-width: 900px) { .edit-layout { grid-template-columns: 1fr; } }

.main-col, .side-col { display: flex; flex-direction: column; gap: 1.25rem; }
.section { padding: 1.5rem; border-radius: 1.25rem; }
.section-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }
.hint { font-size: 0.78rem; color: var(--text-muted); }

.bundle-items { display: flex; flex-direction: column; gap: 0.625rem; margin-bottom: 1rem; }
.bundle-item { display: flex; align-items: center; justify-content: space-between; gap: 0.875rem; padding: 0.75rem 1rem; background: rgba(255,255,255,.04); border-radius: 0.75rem; border: 1px solid rgba(255,255,255,.07); }
.item-info { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
.item-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 0.5rem; flex-shrink: 0; }
.item-thumb-placeholder { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.06); border-radius: 0.5rem; font-size: 1.25rem; flex-shrink: 0; }
.item-name { font-weight: 600; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-price { font-size: 0.78rem; color: var(--text-muted); }
.item-controls { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.qty-label { font-size: 0.78rem; color: var(--text-muted); }
.qty-input { width: 60px; text-align: center; }
.empty-items { text-align: center; color: var(--text-muted); padding: 1.5rem; font-size: 0.88rem; }

.product-search-row { margin-top: 0.875rem; }
.search-results { border-radius: 0.75rem; margin-top: 0.5rem; overflow: hidden; }
.search-result-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 1rem; cursor: pointer; transition: background .15s; }
.search-result-row:hover { background: rgba(255,255,255,.05); }
.sr-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 0.375rem; flex-shrink: 0; }
.sr-thumb-ph { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.06); border-radius: 0.375rem; font-size: 1rem; flex-shrink: 0; }
.sr-info { flex: 1; min-width: 0; }
.sr-name { font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sr-price { font-size: 0.75rem; color: var(--text-muted); }
.sr-add { font-size: 0.82rem; color: var(--accent); font-weight: 600; flex-shrink: 0; }

.price-preview { background: rgba(255,255,255,.04); border-radius: 0.75rem; padding: 0.875rem 1rem; margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.375rem; }
.price-row { display: flex; justify-content: space-between; font-size: 0.88rem; }
.total-row { padding-top: 0.375rem; border-top: 1px solid rgba(255,255,255,.08); font-weight: 700; font-size: 1rem; }
.accent { color: var(--accent); }
.text-muted { color: var(--text-muted); }

.cover-preview { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 0.625rem; margin-top: 0.75rem; }
.error-box { padding: 0.875rem 1rem; border-radius: 0.875rem; color: hsl(355,70%,65%); font-size: 0.88rem; }
.danger { color: hsl(355,70%,60%); }
</style>
