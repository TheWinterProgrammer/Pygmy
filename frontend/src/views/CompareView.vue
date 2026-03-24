<template>
  <div class="compare-page">
    <SiteNav />
    <div class="compare-container">
      <div class="compare-header">
        <h1>⚖️ Product Comparison</h1>
        <p class="subtitle">Compare up to 4 products side by side</p>
        <button v-if="compare.count > 0" @click="compare.clear()" class="clear-all-btn">Clear All</button>
      </div>

      <div v-if="compare.count === 0" class="empty-state">
        <div class="empty-icon">⚖️</div>
        <h2>Nothing to compare yet</h2>
        <p>Browse the shop and click the ⚖️ Compare button on products.</p>
        <RouterLink to="/shop" class="shop-btn">Browse Shop</RouterLink>
      </div>

      <div v-else class="compare-table-wrapper">
        <div class="compare-grid" :style="{ gridTemplateColumns: `200px repeat(${totalCols}, 1fr)` }">
          <!-- Header row -->
          <div class="row-label"></div>
          <div v-for="(product, idx) in allSlots" :key="product?.id || 'empty-' + idx" class="product-col header-col">
            <template v-if="product">
              <button @click="compare.remove(product.id)" class="remove-product-btn">✕ Remove</button>
              <img v-if="product.cover_image" :src="product.cover_image" :alt="product.name" class="product-img" />
              <div v-else class="product-img-placeholder">📦</div>
              <h3 class="product-name">{{ product.name }}</h3>
              <RouterLink :to="'/shop/' + product.slug" class="view-link">View Product →</RouterLink>
              <button @click="addToCart(product)" class="add-cart-btn">🛒 Add to Cart</button>
            </template>
            <template v-else>
              <div class="empty-product-slot">
                <RouterLink to="/shop" class="add-product-link">
                  <span>+</span>
                  <small>Add Product</small>
                </RouterLink>
              </div>
            </template>
          </div>

          <!-- Price row -->
          <div class="row-label">Price</div>
          <div v-for="(product, idx) in allSlots" :key="'price-' + idx" class="compare-cell" :class="{ highlight: isDiff('price') && product }">
            <template v-if="product">
              <span v-if="product.sale_price" class="sale-price">€{{ product.sale_price }}</span>
              <span v-else class="regular-price">€{{ product.price }}</span>
              <span v-if="product.sale_price" class="original-price">€{{ product.price }}</span>
            </template>
            <span v-else class="empty-cell">—</span>
          </div>

          <!-- Category row -->
          <div class="row-label">Category</div>
          <div v-for="(product, idx) in allSlots" :key="'cat-' + idx" class="compare-cell" :class="{ highlight: isDiff('category') && product }">
            <span v-if="product">{{ product.category_name || product.category || '—' }}</span>
            <span v-else class="empty-cell">—</span>
          </div>

          <!-- SKU row -->
          <div class="row-label">SKU</div>
          <div v-for="(product, idx) in allSlots" :key="'sku-' + idx" class="compare-cell">
            <span v-if="product">{{ product.sku || '—' }}</span>
            <span v-else class="empty-cell">—</span>
          </div>

          <!-- Stock row -->
          <div class="row-label">Availability</div>
          <div v-for="(product, idx) in allSlots" :key="'stock-' + idx" class="compare-cell" :class="{ highlight: isDiff('stock') && product }">
            <template v-if="product">
              <span v-if="!product.track_stock || product.stock_quantity > 0" class="in-stock">✅ In Stock</span>
              <span v-else class="out-stock">❌ Out of Stock</span>
            </template>
            <span v-else class="empty-cell">—</span>
          </div>

          <!-- Tags row -->
          <div class="row-label">Tags</div>
          <div v-for="(product, idx) in allSlots" :key="'tags-' + idx" class="compare-cell">
            <template v-if="product">
              <span v-for="tag in parseTags(product.tags)" :key="tag" class="tag-pill">{{ tag }}</span>
              <span v-if="!parseTags(product.tags).length">—</span>
            </template>
            <span v-else class="empty-cell">—</span>
          </div>

          <!-- Description row -->
          <div class="row-label">Description</div>
          <div v-for="(product, idx) in allSlots" :key="'desc-' + idx" class="compare-cell description-cell">
            <span v-if="product">{{ product.excerpt || stripHtml(product.description)?.substring(0, 120) + '...' || '—' }}</span>
            <span v-else class="empty-cell">—</span>
          </div>
        </div>
      </div>
    </div>
    <SiteFooter />
    <CompareDrawer />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'
import CompareDrawer from '../components/CompareDrawer.vue'
import { useCompareStore } from '../stores/compare.js'
import { useCartStore } from '../stores/cart.js'

const compare = useCompareStore()
const cart = useCartStore()

const totalCols = 4
const allSlots = computed(() => {
  const slots = [...compare.items]
  while (slots.length < totalCols) slots.push(null)
  return slots
})

function parseTags(t) {
  try { return JSON.parse(t || '[]') } catch { return [] }
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function getVal(product, field) {
  if (field === 'price') return product.sale_price || product.price
  if (field === 'category') return product.category_name || product.category || ''
  if (field === 'stock') return (!product.track_stock || product.stock_quantity > 0) ? 'in' : 'out'
  return product[field]
}

function isDiff(field) {
  const vals = compare.items.map(p => getVal(p, field))
  return new Set(vals).size > 1
}

function addToCart(product) {
  cart.addItem({ id: product.id, name: product.name, price: product.sale_price || product.price, cover_image: product.cover_image, slug: product.slug })
}
</script>

<style scoped>
.compare-page { min-height: 100vh; background: var(--bg); padding-top: 5rem; }
.compare-container { max-width: 1300px; margin: 0 auto; padding: 2rem 1.5rem 6rem; }
.compare-header { text-align: center; margin-bottom: 2rem; }
.compare-header h1 { font-size: 2rem; font-weight: 700; color: #fff; margin: 0; }
.subtitle { color: rgba(255,255,255,.5); margin: .5rem 0 1rem; }
.clear-all-btn { background: rgba(239,68,68,.15); color: #f87171; border: 1px solid #f87171; border-radius: .5rem; padding: .5rem 1rem; cursor: pointer; font-family: Poppins, sans-serif; }
.empty-state { text-align: center; padding: 4rem 2rem; }
.empty-icon { font-size: 4rem; margin-bottom: 1rem; }
.empty-state h2 { color: #fff; margin: 0 0 .5rem; }
.empty-state p { color: rgba(255,255,255,.5); }
.shop-btn { display: inline-block; margin-top: 1rem; background: var(--accent); color: #fff; text-decoration: none; padding: .7rem 1.5rem; border-radius: .5rem; font-weight: 600; }
.compare-table-wrapper { overflow-x: auto; }
.compare-grid { display: grid; gap: 0; }
.row-label { padding: 1rem; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.4); font-weight: 600; background: rgba(255,255,255,.03); border-right: 1px solid rgba(255,255,255,.06); border-bottom: 1px solid rgba(255,255,255,.06); display: flex; align-items: center; }
.product-col { padding: 1.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,.06); border-right: 1px solid rgba(255,255,255,.06); text-align: center; background: rgba(255,255,255,.02); }
.header-col { display: flex; flex-direction: column; align-items: center; gap: .5rem; }
.remove-product-btn { background: rgba(239,68,68,.1); color: #f87171; border: 1px solid #f87171; border-radius: .4rem; padding: .25rem .6rem; font-size: .75rem; cursor: pointer; font-family: Poppins, sans-serif; }
.product-img { width: 120px; height: 120px; object-fit: cover; border-radius: .75rem; }
.product-img-placeholder { width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.05); border-radius: .75rem; font-size: 3rem; }
.product-name { font-size: .95rem; font-weight: 600; color: #fff; margin: 0; }
.view-link { font-size: .8rem; color: var(--accent); text-decoration: none; }
.add-cart-btn { background: var(--accent); color: #fff; border: none; border-radius: .5rem; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; font-family: Poppins, sans-serif; white-space: nowrap; }
.empty-product-slot { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; }
.add-product-link { display: flex; flex-direction: column; align-items: center; gap: .5rem; text-decoration: none; color: rgba(255,255,255,.3); border: 2px dashed rgba(255,255,255,.15); border-radius: 1rem; padding: 2rem; transition: all .2s; }
.add-product-link:hover { color: var(--accent); border-color: var(--accent); }
.add-product-link span { font-size: 2rem; }
.compare-cell { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,.06); border-right: 1px solid rgba(255,255,255,.06); text-align: center; color: rgba(255,255,255,.8); font-size: .9rem; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: .25rem; }
.compare-cell.highlight { background: rgba(var(--accent-rgb),.08); }
.description-cell { text-align: left; justify-content: flex-start; font-size: .85rem; color: rgba(255,255,255,.6); }
.sale-price { color: var(--accent); font-weight: 700; font-size: 1.1rem; }
.regular-price { font-weight: 700; font-size: 1.1rem; }
.original-price { color: rgba(255,255,255,.35); text-decoration: line-through; font-size: .85rem; margin-left: .25rem; }
.in-stock { color: #4ade80; font-size: .85rem; }
.out-stock { color: #f87171; font-size: .85rem; }
.tag-pill { background: rgba(255,255,255,.08); border-radius: 2rem; padding: .15rem .5rem; font-size: .75rem; }
.empty-cell { color: rgba(255,255,255,.2); }
</style>
