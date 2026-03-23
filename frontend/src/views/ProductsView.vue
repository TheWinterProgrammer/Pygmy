<template>
  <div class="products-page">
    <div class="products-hero container">
      <h1>Shop</h1>
      <p class="subtitle">Browse our collection</p>
    </div>

    <!-- Flash Sale Banner -->
    <div class="container" style="padding-bottom:0">
      <FlashSaleBanner />
    </div>

    <!-- Category filters -->
    <div class="filters container" v-if="categories.length">
      <button
        class="filter-btn"
        :class="{ active: !activeCategory }"
        @click="setCategory(null)"
      >All</button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="filter-btn"
        :class="{ active: activeCategory === cat.slug }"
        @click="setCategory(cat.slug)"
      >{{ cat.name }}</button>
    </div>

    <!-- Tag badge -->
    <div class="container" v-if="activeTag" style="padding:0 1.5rem 1.5rem">
      <span class="tag-filter-badge">
        #{{ activeTag }}
        <button @click="activeTag = null; load()" class="tag-clear">✕</button>
      </span>
    </div>

    <!-- Product grid -->
    <div class="container products-grid" v-if="products.length">
      <RouterLink
        v-for="p in products"
        :key="p.id"
        :to="`/shop/${p.slug}`"
        class="product-card glass"
        @mouseenter="hoverProduct = p.id"
        @mouseleave="hoverProduct = null"
      >
        <div class="card-img" v-if="p.cover_image">
          <img :src="p.cover_image" :alt="p.name" loading="lazy" />
          <div class="sale-badge" v-if="p.sale_price">Sale</div>
          <div class="featured-badge" v-if="p.featured">★ Featured</div>
          <div class="oos-badge" v-if="p.track_stock && !p.in_stock">Out of Stock</div>
        </div>
        <div class="card-img card-img-placeholder" v-else>🛍️</div>

        <div class="card-body">
          <div class="card-meta">
            <span class="cat-tag" v-if="p.category_name">{{ p.category_name }}</span>
          </div>
          <h2 class="card-title">{{ p.name }}</h2>
          <p class="card-excerpt" v-if="p.excerpt">{{ p.excerpt }}</p>

          <div class="card-footer">
            <div class="price-block">
              <span v-if="p.sale_price" class="price-sale">{{ fmt(p.sale_price) }}</span>
              <span :class="p.sale_price ? 'price-orig' : 'price-normal'" v-if="p.price !== null">{{ fmt(p.price) }}</span>
              <span class="price-free" v-else-if="p.price === null">Free</span>
            </div>
            <div class="tags-row" v-if="p.tags?.length">
              <button
                v-for="tag in p.tags.slice(0,3)"
                :key="tag"
                class="pill"
                @click.prevent="filterTag(tag)"
              >#{{ tag }}</button>
            </div>
            <!-- Wishlist heart -->
            <button
              class="quick-wish"
              @click.prevent="wishlist.toggle(p)"
              :class="{ wished: wishlist.isWishlisted(p.id) }"
              :title="wishlist.isWishlisted(p.id) ? 'Remove from wishlist' : 'Add to wishlist'"
            >
              {{ wishlist.isWishlisted(p.id) ? '♥' : '♡' }}
            </button>
            <!-- Quick Add to Cart -->
            <button
              v-if="p.price !== null && (p.in_stock || !p.track_stock)"
              class="quick-atc"
              @click.prevent="quickAdd(p)"
              :class="{ added: addedIds.has(p.id) }"
              :title="addedIds.has(p.id) ? 'Added!' : 'Add to cart'"
            >
              {{ addedIds.has(p.id) ? '✓' : '🛒' }}
            </button>
            <!-- Quick View -->
            <button
              class="quick-view"
              @click.prevent="openQuickView(p)"
              title="Quick view"
            >👁️</button>
            <!-- Compare -->
            <button
              class="quick-compare"
              @click.prevent="compare.toggle(p)"
              :class="{ comparing: compare.isAdded(p.id) }"
              :title="compare.isAdded(p.id) ? 'Remove from compare' : 'Add to compare'"
            >⚖️</button>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Loading skeleton -->
    <div class="container products-grid" v-else-if="loading">
      <div class="skeleton glass" v-for="i in 6" :key="i" style="height:340px"></div>
    </div>

    <!-- Empty -->
    <div class="container empty-state" v-else>
      <div class="glass empty-card">
        <p>No products found.</p>
        <button v-if="activeCategory || activeTag" class="btn btn-outline" @click="clearFilters">
          Clear filters
        </button>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination container" v-if="total > limit">
      <button
        class="btn btn-ghost"
        :disabled="offset === 0"
        @click="prev"
      >← Prev</button>
      <span class="page-info">{{ Math.floor(offset / limit) + 1 }} / {{ Math.ceil(total / limit) }}</span>
      <button
        class="btn btn-ghost"
        :disabled="offset + limit >= total"
        @click="next"
      >Next →</button>
    </div>
  </div>

  <!-- Quick View Modal -->
  <Teleport to="body">
    <Transition name="qv-fade">
      <div class="qv-overlay" v-if="quickViewProduct" @click.self="closeQuickView" role="dialog" aria-modal="true">
        <Transition name="qv-slide">
          <div class="qv-panel glass" v-if="quickViewProduct">
            <button class="qv-close" @click="closeQuickView" aria-label="Close">✕</button>

            <!-- Loading -->
            <div class="qv-loading" v-if="qvLoading">
              <div class="qv-skeleton"></div>
            </div>

            <!-- Content -->
            <template v-else-if="qvDetail">
              <div class="qv-img-col">
                <!-- Gallery -->
                <div class="qv-main-img" v-if="qvActiveImg">
                  <img :src="qvActiveImg" :alt="qvDetail.name" />
                  <div class="qv-sale-badge" v-if="qvDetail.sale_price">Sale</div>
                </div>
                <div class="qv-main-img qv-placeholder" v-else>🛍️</div>

                <div class="qv-thumbs" v-if="qvGallery.length > 1">
                  <button
                    v-for="(img, i) in qvGallery"
                    :key="i"
                    class="qv-thumb"
                    :class="{ active: qvActiveImg === img }"
                    @click="qvActiveImg = img"
                  >
                    <img :src="img" :alt="`${qvDetail.name} ${i+1}`" loading="lazy" />
                  </button>
                </div>
              </div>

              <div class="qv-info-col">
                <div class="qv-cat" v-if="qvDetail.category_name">{{ qvDetail.category_name }}</div>
                <h2 class="qv-title">{{ qvDetail.name }}</h2>

                <!-- Price -->
                <div class="qv-price">
                  <span v-if="qvDetail.sale_price" class="price-sale">{{ fmt(qvDetail.sale_price) }}</span>
                  <span :class="qvDetail.sale_price ? 'price-orig' : 'price-normal'" v-if="qvDetail.price !== null">{{ fmt(qvDetail.price) }}</span>
                </div>

                <!-- Excerpt -->
                <p class="qv-excerpt" v-if="qvDetail.excerpt">{{ qvDetail.excerpt }}</p>

                <!-- Variants -->
                <div class="qv-variants" v-if="qvVariants.length">
                  <div v-for="group in qvVariants" :key="group.id" class="qv-variant-group">
                    <div class="qv-variant-label">{{ group.name }}</div>
                    <div class="qv-variant-pills">
                      <button
                        v-for="opt in group.options"
                        :key="opt.id"
                        class="qv-variant-pill"
                        :class="{
                          active:    qvSelectedVariants[group.name] === opt.label,
                          disabled:  opt.stock !== undefined && opt.stock !== -1 && opt.stock <= 0
                        }"
                        :disabled="opt.stock !== undefined && opt.stock !== -1 && opt.stock <= 0"
                        @click="selectVariantOption(group.name, opt)"
                      >
                        {{ opt.label }}
                        <span v-if="opt.price_adj > 0" class="pill-adj">+{{ fmt(opt.price_adj) }}</span>
                        <span v-else-if="opt.price_adj < 0" class="pill-adj">{{ fmt(opt.price_adj) }}</span>
                      </button>
                    </div>
                  </div>
                  <div class="qv-variant-error" v-if="qvVariantError">{{ qvVariantError }}</div>
                </div>

                <!-- Stock info -->
                <div class="qv-stock" v-if="qvDetail.track_stock">
                  <span v-if="qvDetail.in_stock" class="stock-ok">✓ In stock</span>
                  <span v-else-if="qvDetail.allow_backorder" class="stock-backorder">Ships when available</span>
                  <span v-else class="stock-oos">Out of stock</span>
                </div>

                <!-- Quantity + ATC -->
                <div class="qv-atc-row" v-if="qvDetail.price !== null && (qvDetail.in_stock || !qvDetail.track_stock || qvDetail.allow_backorder)">
                  <div class="qty-stepper">
                    <button @click="qvQty = Math.max(1, qvQty - 1)">−</button>
                    <input type="number" v-model.number="qvQty" min="1" max="99" />
                    <button @click="qvQty = Math.min(99, qvQty + 1)">+</button>
                  </div>
                  <button class="btn btn-primary qv-atc-btn" @click="qvAddToCart" :class="{ added: qvAdded }">
                    {{ qvAdded ? '✓ Added!' : '🛒 Add to Cart' }}
                  </button>
                </div>

                <!-- Tags -->
                <div class="qv-tags" v-if="qvDetail.tags?.length">
                  <button
                    v-for="tag in qvDetail.tags"
                    :key="tag"
                    class="pill"
                    @click="closeQuickView(); filterTag(tag)"
                  >#{{ tag }}</button>
                </div>

                <!-- View full page -->
                <RouterLink :to="`/shop/${qvDetail.slug}`" class="qv-full-link" @click="closeQuickView">
                  View full product page →
                </RouterLink>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api.js'
import { useCartStore } from '../stores/cart.js'
import { useWishlistStore } from '../stores/wishlist.js'
import { useCompareStore } from '../stores/compare.js'
import FlashSaleBanner from '../components/FlashSaleBanner.vue'

const route    = useRoute()
const router   = useRouter()
const cart     = useCartStore()
const wishlist = useWishlistStore()
const compare  = useCompareStore()

const products       = ref([])
const categories     = ref([])
const loading        = ref(true)
const total          = ref(0)
const limit          = 12
const offset         = ref(0)
const activeCategory = ref(route.query.category || null)
const activeTag      = ref(route.query.tag || null)
const addedIds       = ref(new Set())
const hoverProduct   = ref(null)

// Advanced filters
const filterInStock   = ref(route.query.in_stock === '1')
const filterMinPrice  = ref(route.query.min_price ? Number(route.query.min_price) : '')
const filterMaxPrice  = ref(route.query.max_price ? Number(route.query.max_price) : '')
const filterSort      = ref(route.query.sort || 'newest')
const showFilters     = ref(false)

// ── Quick View ──────────────────────────────────────────────────────────────
const quickViewProduct   = ref(null)
const qvDetail           = ref(null)
const qvVariants         = ref([])
const qvLoading          = ref(false)
const qvActiveImg        = ref(null)
const qvGallery          = ref([])
const qvQty              = ref(1)
const qvAdded            = ref(false)
const qvSelectedVariants = ref({}) // { "Color": "Red", "Size": "L" }
const qvVariantError     = ref('')

async function openQuickView(product) {
  quickViewProduct.value = product
  qvDetail.value = null
  qvVariants.value = []
  qvLoading.value = true
  qvQty.value = 1
  qvAdded.value = false
  qvSelectedVariants.value = {}
  qvVariantError.value = ''
  document.body.style.overflow = 'hidden'

  try {
    const [detailRes, variantsRes] = await Promise.all([
      api.get(`/products/${product.slug}`),
      api.get(`/variants?product_id=${product.id}`).catch(() => ({ data: [] })),
    ])
    qvDetail.value = detailRes.data
    qvVariants.value = variantsRes.data || []

    // Build gallery
    const gallery = []
    if (qvDetail.value.cover_image) gallery.push(qvDetail.value.cover_image)
    if (qvDetail.value.gallery) {
      try {
        const extra = JSON.parse(qvDetail.value.gallery)
        gallery.push(...extra)
      } catch {}
    }
    qvGallery.value = gallery
    qvActiveImg.value = gallery[0] || null
  } catch {
    closeQuickView()
  } finally {
    qvLoading.value = false
  }
}

function closeQuickView() {
  quickViewProduct.value = null
  qvDetail.value = null
  document.body.style.overflow = ''
}

function selectVariantOption(groupName, option) {
  qvSelectedVariants.value = { ...qvSelectedVariants.value, [groupName]: option.label }
  qvVariantError.value = ''
}

function qvAddToCart() {
  // Validate all variant groups are selected
  if (qvVariants.value.length) {
    for (const group of qvVariants.value) {
      if (!qvSelectedVariants.value[group.name]) {
        qvVariantError.value = `Please select a ${group.name}.`
        return
      }
    }
  }

  let variantInfo = null
  if (qvVariants.value.length) {
    const parts = Object.entries(qvSelectedVariants.value).map(([k, v]) => `${k}:${v}`)
    const label = Object.entries(qvSelectedVariants.value).map(([k, v]) => `${k}: ${v}`).join(', ')
    // Find total price adjustment
    let priceAdj = 0
    for (const group of qvVariants.value) {
      const selectedLabel = qvSelectedVariants.value[group.name]
      if (selectedLabel) {
        const opt = group.options.find(o => o.label === selectedLabel)
        if (opt?.price_adj) priceAdj += Number(opt.price_adj)
      }
    }
    variantInfo = { key: parts.join('|'), label, price_adj: priceAdj }
  }

  cart.addItem(qvDetail.value, qvQty.value, variantInfo)
  qvAdded.value = true
  setTimeout(() => {
    qvAdded.value = false
  }, 2000)
}

// Close on Escape
function onKeyDown(e) {
  if (e.key === 'Escape' && quickViewProduct.value) closeQuickView()
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.body.style.overflow = ''
})

function quickAdd(product) {
  cart.addItem(product, 1)
  cart.open()
  addedIds.value = new Set([...addedIds.value, product.id])
  setTimeout(() => {
    addedIds.value.delete(product.id)
    addedIds.value = new Set(addedIds.value)
  }, 2000)
}

onMounted(async () => {
  const { data } = await api.get('/products/categories')
  categories.value = data
  await load()
})

watch([activeCategory, activeTag], () => {
  offset.value = 0
  load()
})

async function load() {
  loading.value = true
  const params = { limit, offset: offset.value }
  if (activeCategory.value) params.category = activeCategory.value
  if (activeTag.value) params.tag = activeTag.value
  if (filterInStock.value) params.in_stock = '1'
  if (filterMinPrice.value !== '') params.min_price = filterMinPrice.value
  if (filterMaxPrice.value !== '') params.max_price = filterMaxPrice.value
  if (filterSort.value && filterSort.value !== 'newest') params.sort = filterSort.value

  const { data } = await api.get('/products', { params })
  products.value = data.products
  total.value = data.total
  loading.value = false
}

function applyFilters() {
  offset.value = 0
  router.replace({ query: {
    ...route.query,
    category: activeCategory.value || undefined,
    tag: activeTag.value || undefined,
    in_stock: filterInStock.value ? '1' : undefined,
    min_price: filterMinPrice.value !== '' ? filterMinPrice.value : undefined,
    max_price: filterMaxPrice.value !== '' ? filterMaxPrice.value : undefined,
    sort: filterSort.value !== 'newest' ? filterSort.value : undefined,
  }})
  load()
}

function resetFilters() {
  filterInStock.value = false
  filterMinPrice.value = ''
  filterMaxPrice.value = ''
  filterSort.value = 'newest'
  applyFilters()
}

function setCategory(slug) {
  activeCategory.value = slug
  router.replace({ query: { ...route.query, category: slug || undefined } })
}

function filterTag(tag) {
  activeTag.value = tag
  router.replace({ query: { ...route.query, tag } })
}

function clearFilters() {
  activeCategory.value = null
  activeTag.value = null
  filterInStock.value = false
  filterMinPrice.value = ''
  filterMaxPrice.value = ''
  filterSort.value = 'newest'
  router.replace({ query: {} })
}

function prev() { offset.value = Math.max(0, offset.value - limit); load() }
function next() { offset.value += limit; load() }

function fmt(n) {
  if (n === null || n === undefined) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
</script>

<style scoped>
.products-page { padding-bottom: 4rem; }

.products-hero {
  padding: 4rem 1.5rem 2.5rem;
  text-align: center;
}
.products-hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; margin-bottom: 0.5rem; }
.subtitle { color: var(--text-muted); font-size: 1.05rem; }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0 1.5rem 1.5rem;
}
.filter-btn {
  padding: 0.35rem 1rem;
  border: 1px solid var(--border);
  border-radius: 2rem;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.filter-btn:hover, .filter-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.tag-filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: hsl(355,70%,20%);
  color: var(--accent);
  padding: 0.25rem 0.75rem;
  border-radius: 2rem;
  font-size: 0.82rem;
}
.tag-clear { background: none; border: none; color: inherit; cursor: pointer; font-size: 0.75rem; }

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 0 1.5rem 2rem;
}

.product-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: var(--text);
}
.product-card:hover { transform: translateY(-4px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }

.card-img {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: var(--glass-bg);
}
.card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.product-card:hover .card-img img { transform: scale(1.04); }
.card-img-placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem; background: var(--glass-bg);
}

.sale-badge, .featured-badge {
  position: absolute;
  top: 0.6rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.sale-badge { left: 0.6rem; background: var(--accent); color: #fff; }
.featured-badge { right: 0.6rem; background: gold; color: #000; }
.oos-badge { left: 0; right: 0; bottom: 0; top: auto; border-radius: 0; background: rgba(0,0,0,.75); color: rgba(255,255,255,.8); font-size: .75rem; text-align: center; }

.card-body { padding: 1rem 1.25rem 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
.card-meta { display: flex; gap: 0.5rem; align-items: center; }
.cat-tag {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--accent);
  font-weight: 600;
}
.card-title { font-size: 1.05rem; font-weight: 700; margin: 0; }
.card-excerpt { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; flex: 1; }

.card-footer { margin-top: auto; padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }

.price-block { display: flex; align-items: baseline; gap: 0.5rem; }
.price-sale { color: var(--accent); font-weight: 700; font-size: 1.1rem; }
.price-orig { text-decoration: line-through; color: var(--text-muted); font-size: 0.85rem; }
.price-normal { font-weight: 700; font-size: 1.1rem; }
.price-free { font-weight: 700; color: #4caf50; font-size: 1rem; }

.tags-row { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.pill {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 2rem;
  background: var(--glass-bg);
  color: var(--text-muted);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}
.pill:hover { color: var(--accent); border-color: var(--accent); }

/* Wishlist heart button */
.quick-wish {
  align-self: flex-end;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: .5rem;
  padding: .3rem .6rem;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: all .2s;
}
.quick-wish:hover { border-color: var(--accent); color: var(--accent); background: rgba(255,60,60,.08); }
.quick-wish.wished { border-color: var(--accent); color: var(--accent); background: rgba(255,60,60,.12); }

/* Quick Add to Cart button */
.quick-atc {
  align-self: flex-end;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: .5rem;
  padding: .3rem .65rem;
  font-size: .85rem;
  cursor: pointer;
  transition: all .2s;
}
.quick-atc:hover { border-color: var(--accent); color: var(--accent); background: rgba(var(--accent-rgb),.1); }
.quick-atc.added { border-color: #4caf50; color: #4caf50; background: rgba(76,175,80,.12); }

/* Quick View button */
.quick-view {
  align-self: flex-end;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: .5rem;
  padding: .3rem .6rem;
  font-size: .85rem;
  cursor: pointer;
  transition: all .2s;
}
.quick-view:hover { border-color: var(--accent); color: var(--accent); background: rgba(var(--accent-rgb),.1); }

/* Compare button */
.quick-compare {
  align-self: flex-end;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: .5rem;
  padding: .3rem .6rem;
  font-size: .85rem;
  cursor: pointer;
  transition: all .2s;
}
.quick-compare:hover { border-color: hsl(40,80%,50%); color: hsl(40,80%,60%); background: rgba(251,191,36,.1); }
.quick-compare.comparing { border-color: hsl(40,80%,50%); color: hsl(40,80%,60%); background: rgba(251,191,36,.15); }

/* ── Quick View Modal ──────────────────────────────────────────────────── */
.qv-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.7);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.qv-panel {
  display: flex;
  gap: 2rem;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 1.5rem;
  padding: 2rem;
  position: relative;
  scrollbar-width: thin;
}

.qv-close {
  position: absolute; top: 1rem; right: 1rem;
  background: rgba(255,255,255,.08); border: 1px solid var(--border);
  color: var(--text-muted); border-radius: .5rem;
  padding: .3rem .6rem; cursor: pointer; font-size: .9rem; z-index: 1;
  transition: all .15s;
}
.qv-close:hover { background: rgba(255,255,255,.15); color: var(--text); }

/* Image column */
.qv-img-col {
  flex: 0 0 300px;
  display: flex; flex-direction: column; gap: .75rem;
}
.qv-main-img {
  position: relative;
  aspect-ratio: 1;
  border-radius: 1rem; overflow: hidden;
  background: var(--glass-bg);
}
.qv-main-img img { width: 100%; height: 100%; object-fit: cover; }
.qv-placeholder { display: flex; align-items: center; justify-content: center; font-size: 3rem; }
.qv-sale-badge {
  position: absolute; top: .6rem; left: .6rem;
  background: var(--accent); color: #fff;
  padding: .2rem .6rem; border-radius: .4rem;
  font-size: .72rem; font-weight: 700; text-transform: uppercase;
}
.qv-thumbs { display: flex; gap: .4rem; flex-wrap: wrap; }
.qv-thumb {
  width: 56px; height: 56px; border-radius: .5rem; overflow: hidden;
  border: 2px solid transparent; cursor: pointer; padding: 0;
  background: var(--glass-bg); transition: border-color .15s;
}
.qv-thumb.active { border-color: var(--accent); }
.qv-thumb img { width: 100%; height: 100%; object-fit: cover; }

/* Info column */
.qv-info-col {
  flex: 1; display: flex; flex-direction: column; gap: .75rem;
  min-width: 0;
}
.qv-cat { font-size: .72rem; text-transform: uppercase; letter-spacing: .07em; color: var(--accent); font-weight: 600; }
.qv-title { font-size: 1.4rem; font-weight: 800; margin: 0; }
.qv-price { display: flex; align-items: baseline; gap: .5rem; }
.qv-excerpt { font-size: .88rem; color: var(--text-muted); line-height: 1.6; }

/* Variants */
.qv-variants { display: flex; flex-direction: column; gap: .75rem; }
.qv-variant-group { display: flex; flex-direction: column; gap: .4rem; }
.qv-variant-label { font-size: .8rem; font-weight: 600; color: var(--text-muted); }
.qv-variant-pills { display: flex; gap: .4rem; flex-wrap: wrap; }
.qv-variant-pill {
  padding: .3rem .8rem; border-radius: .5rem;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--text); font-size: .85rem; cursor: pointer; transition: all .15s;
}
.qv-variant-pill:hover:not(.disabled) { border-color: var(--accent); color: var(--accent); }
.qv-variant-pill.active { border-color: var(--accent); background: rgba(var(--accent-rgb),.12); color: var(--accent); font-weight: 600; }
.qv-variant-pill.disabled { opacity: .4; cursor: not-allowed; text-decoration: line-through; }
.pill-adj { font-size: .75rem; opacity: .8; }
.qv-variant-error { color: var(--accent); font-size: .82rem; }

/* Stock */
.qv-stock { font-size: .85rem; }
.stock-ok { color: hsl(140,60%,60%); }
.stock-oos { color: var(--accent); }
.stock-backorder { color: hsl(45,80%,65%); }

/* ATC row */
.qv-atc-row { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
.qty-stepper {
  display: flex; align-items: center;
  border: 1px solid var(--border); border-radius: .75rem; overflow: hidden;
}
.qty-stepper button {
  background: rgba(255,255,255,.06); border: none; color: var(--text);
  padding: .4rem .75rem; font-size: 1.1rem; cursor: pointer; transition: background .15s;
}
.qty-stepper button:hover { background: rgba(255,255,255,.12); }
.qty-stepper input {
  width: 44px; text-align: center; background: transparent; border: none;
  color: var(--text); font-size: .95rem; padding: .4rem 0; outline: none;
}

.qv-atc-btn { flex: 1; min-width: 140px; }
.qv-atc-btn.added { background: hsl(140,60%,30%) !important; }

/* Tags */
.qv-tags { display: flex; gap: .35rem; flex-wrap: wrap; }

/* Full link */
.qv-full-link {
  display: inline-block; margin-top: .25rem;
  font-size: .82rem; color: var(--accent); text-decoration: none;
  opacity: .8; transition: opacity .15s;
}
.qv-full-link:hover { opacity: 1; text-decoration: underline; }

/* Loading */
.qv-loading { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 300px; }
.qv-skeleton { width: 100%; height: 300px; border-radius: 1rem; background: rgba(255,255,255,.04); animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }

/* Transitions */
.qv-fade-enter-active, .qv-fade-leave-active { transition: opacity .25s; }
.qv-fade-enter-from, .qv-fade-leave-to { opacity: 0; }
.qv-slide-enter-active, .qv-slide-leave-active { transition: transform .25s, opacity .25s; }
.qv-slide-enter-from, .qv-slide-leave-to { transform: scale(.95); opacity: 0; }

@media (max-width: 640px) {
  .qv-panel { flex-direction: column; gap: 1rem; }
  .qv-img-col { flex: none; }
}

.empty-state { display: flex; justify-content: center; padding: 3rem 1.5rem; }
.empty-card { padding: 2rem 3rem; text-align: center; border-radius: var(--radius); }
.empty-card p { color: var(--text-muted); margin-bottom: 1rem; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
}
.page-info { color: var(--text-muted); font-size: 0.85rem; }
</style>
