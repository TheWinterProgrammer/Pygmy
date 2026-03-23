<template>
  <div class="product-page">
    <!-- Loading -->
    <div class="container skeleton-wrap" v-if="loading">
      <div class="skeleton-title"></div>
      <div class="skeleton-body glass"></div>
    </div>

    <!-- 404 -->
    <div class="container not-found" v-else-if="!product">
      <div class="glass not-found-card">
        <h1>404</h1>
        <p>Product not found.</p>
        <RouterLink to="/shop" class="btn btn-primary">← Back to Shop</RouterLink>
      </div>
    </div>

    <!-- Product -->
    <article v-else class="container product-article">
      <FlashSaleBanner />
      <div class="product-layout">
        <!-- Images -->
        <div class="product-images">
          <div class="main-image glass">
            <img
              :src="activeImage || product.cover_image"
              :alt="product.name"
              v-if="activeImage || product.cover_image"
              class="main-img"
            />
            <div class="no-image" v-else>🛍️</div>
          </div>

          <!-- Gallery thumbnails -->
          <div class="gallery-thumbs" v-if="allImages.length > 1">
            <button
              v-for="(img, i) in allImages"
              :key="i"
              class="thumb-btn"
              :class="{ active: (activeImage || product.cover_image) === img }"
              @click="activeImage = img"
            >
              <img :src="img" :alt="`${product.name} image ${i+1}`" />
            </button>
          </div>
        </div>

        <!-- Info -->
        <div class="product-info">
          <div class="info-category" v-if="product.category_name">
            <RouterLink :to="`/shop?category=${product.category_slug || ''}`" class="cat-tag">
              {{ product.category_name }}
            </RouterLink>
          </div>

          <!-- Custom badges -->
          <div class="product-badges" v-if="product.badges?.length">
            <span
              v-for="b in product.badges" :key="b.id"
              class="product-badge"
              :class="`badge-${b.style}`"
            >{{ b.label }}</span>
          </div>

          <h1 class="product-name">{{ product.name }}</h1>
          <p class="product-excerpt" v-if="product.excerpt">{{ product.excerpt }}</p>

          <!-- Price -->
          <div class="price-block" v-if="product.price !== null">
            <span class="price-sale" v-if="product.sale_price">{{ fmt(product.sale_price) }}</span>
            <span :class="product.sale_price ? 'price-orig' : 'price-normal'">{{ fmt(product.price) }}</span>
            <span class="discount-tag" v-if="product.sale_price">
              {{ discountPct }}% off
            </span>
          </div>
          <div class="price-free" v-else>Free</div>

          <!-- Volume Pricing Tiers -->
          <div class="volume-pricing" v-if="volumeTiers.length">
            <div class="volume-title">💰 Volume Discounts</div>
            <table class="volume-table">
              <thead><tr><th>Qty</th><th>Unit Price</th><th>Label</th></tr></thead>
              <tbody>
                <tr v-for="tier in volumeTiers" :key="tier.id" :class="{ 'active-tier': qty >= tier.min_qty }">
                  <td>{{ tier.min_qty }}+</td>
                  <td class="tier-price">{{ fmt(tier.price) }}</td>
                  <td>{{ tier.label || '' }}</td>
                </tr>
              </tbody>
            </table>
            <div class="tier-hint" v-if="activeTier">
              🎉 You qualify for <strong>{{ activeTier.label || ('bulk pricing at ' + fmt(activeTier.price)) }}</strong>
            </div>
          </div>

          <!-- SKU -->
          <div class="sku" v-if="product.sku">
            <span class="sku-label">SKU:</span> {{ product.sku }}
          </div>

          <!-- Tags -->
          <div class="tags-row" v-if="product.tags?.length">
            <RouterLink
              v-for="tag in product.tags"
              :key="tag"
              :to="`/shop?tag=${tag}`"
              class="pill"
            >#{{ tag }}</RouterLink>
          </div>

          <!-- Stock status badge -->
          <div v-if="product.track_stock" class="stock-status">
            <span v-if="product.in_stock && product.low_stock" class="stock-badge stock-low">
              ⚠️ Low stock — {{ product.stock_quantity }} left
            </span>
            <span v-else-if="product.in_stock" class="stock-badge stock-ok">
              ✓ In Stock
            </span>
            <span v-else class="stock-badge stock-out">
              ✕ Out of Stock
            </span>
          </div>

          <!-- Variant Picker -->
          <div class="variants-section" v-if="variants.length">
            <div class="variant-group" v-for="v in variants" :key="v.id">
              <label class="variant-label">{{ v.name }}</label>
              <div class="variant-options">
                <button
                  v-for="opt in v.options"
                  :key="opt.id"
                  class="variant-opt"
                  :class="{ selected: selectedVariants[v.id] === opt.id, oos: opt.stock === 0 }"
                  :disabled="opt.stock === 0"
                  @click="selectVariant(v.id, v.name, opt)"
                  :title="opt.stock === 0 ? 'Out of stock' : undefined"
                >
                  {{ opt.label }}
                  <span class="opt-adj" v-if="opt.price_adj > 0">+{{ fmt(opt.price_adj) }}</span>
                  <span class="opt-adj" v-else-if="opt.price_adj < 0">{{ fmt(opt.price_adj) }}</span>
                </button>
              </div>
            </div>
            <div class="variant-error" v-if="variantError">{{ variantError }}</div>
          </div>

          <!-- Custom Options -->
          <div class="custom-options" v-if="customOptions.length">
            <div class="custom-opt-item" v-for="opt in customOptions" :key="opt.id">
              <label class="custom-opt-label">
                {{ opt.label }}
                <span v-if="opt.required" class="req-star">*</span>
                <span v-if="opt.price_add > 0" class="opt-price-add">+{{ fmt(opt.price_add) }}</span>
              </label>
              <input
                v-if="opt.field_type === 'text'"
                v-model="customOptionValues[opt.id]"
                type="text"
                :placeholder="opt.placeholder || ''"
                class="opt-input"
              />
              <textarea
                v-else-if="opt.field_type === 'textarea'"
                v-model="customOptionValues[opt.id]"
                :placeholder="opt.placeholder || ''"
                class="opt-input"
                rows="3"
              ></textarea>
              <select
                v-else-if="opt.field_type === 'select'"
                v-model="customOptionValues[opt.id]"
                class="opt-input"
              >
                <option value="">{{ opt.placeholder || 'Select…' }}</option>
                <option v-for="o in opt.options" :key="o" :value="o">{{ o }}</option>
              </select>
              <div v-else-if="opt.field_type === 'checkbox'" class="opt-checkboxes">
                <label v-for="o in opt.options" :key="o" class="opt-check-item">
                  <input type="checkbox" :value="o" v-model="customOptionValues[opt.id]" />
                  {{ o }}
                </label>
              </div>
              <input
                v-else-if="opt.field_type === 'color'"
                v-model="customOptionValues[opt.id]"
                type="color"
                class="opt-color"
              />
            </div>
          </div>

          <!-- Back-in-Stock Alert Sign-up -->
          <div class="back-in-stock-form" v-if="product.track_stock && !product.in_stock">
            <p class="bis-intro">Get notified when this product is back in stock:</p>
            <div v-if="!bisSuccess" class="bis-row">
              <input v-model="bisEmail" type="email" placeholder="Your email address" class="bis-input" />
              <input v-model="bisName" type="text" placeholder="Your name (optional)" class="bis-input" />
              <button class="btn btn-primary" @click="subscribeBackInStock" :disabled="bisBusy || !bisEmail">
                {{ bisBusy ? '…' : '🔔 Notify Me' }}
              </button>
            </div>
            <div v-else class="bis-success">✓ {{ bisSuccess }}</div>
            <div v-if="bisError" class="bis-error">{{ bisError }}</div>
          </div>

          <!-- Add to Cart -->
          <div class="atc-row" v-if="product.price !== null">
            <div class="qty-selector" v-if="product.in_stock || !product.track_stock">
              <button @click="qty = Math.max(1, qty - 1)">−</button>
              <input type="number" v-model.number="qty" min="1" :max="product.track_stock && !product.allow_backorder ? product.stock_quantity : 99" />
              <button @click="qty = Math.min(product.track_stock && !product.allow_backorder ? product.stock_quantity : 99, qty + 1)">+</button>
            </div>
            <button class="btn btn-primary btn-lg atc-btn" @click="addToCart"
              :disabled="product.track_stock && !product.in_stock">
              <span v-if="product.track_stock && !product.in_stock">Out of Stock</span>
              <span v-else-if="addedFlash">✓ Added!</span>
              <span v-else>🛒 Add to Cart</span>
            </button>
            <button
              class="wishlist-btn"
              @click="wishlist.toggle(product)"
              :class="{ wished: wishlist.isWishlisted(product.id) }"
              :title="wishlist.isWishlisted(product.id) ? 'Remove from wishlist' : 'Save to wishlist'"
            >
              {{ wishlist.isWishlisted(product.id) ? '♥' : '♡' }}
            </button>
          </div>

          <!-- Social Proof: live viewers -->
          <SocialProof style="margin-bottom:8px;" />

          <!-- Price Drop Alert -->
          <PriceAlertButton
            v-if="product?.id"
            :product-id="product.id"
            :current-price="product.sale_price || product.price"
            :currency-symbol="site.settings?.shop_currency_symbol || '€'"
          />

          <div class="back-link">
            <RouterLink to="/shop" class="btn btn-outline">← Back to Shop</RouterLink>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div class="glass description-body" v-if="product.description">
        <h2>Product Details</h2>
        <div class="prose" v-html="product.description"></div>
      </div>

      <!-- Related Products / Recommendations -->
      <div class="related-section" v-if="recommendations.length">
        <h2 class="related-title">You Might Also Like</h2>
        <div class="related-grid">
          <RouterLink
            v-for="rec in recommendations"
            :key="rec.id"
            :to="`/shop/${rec.slug}`"
            class="related-card glass"
          >
            <img v-if="rec.cover_image" :src="rec.cover_image" class="related-img" />
            <div class="related-img-placeholder" v-else>📦</div>
            <div class="related-info">
              <div class="related-name">{{ rec.name }}</div>
              <div class="related-price">
                <span v-if="rec.sale_price && rec.sale_price < rec.price" class="sale-price">€{{ Number(rec.sale_price).toFixed(2) }}</span>
                <span :class="rec.sale_price && rec.sale_price < rec.price ? 'original-price strikethrough' : 'regular-price'">€{{ Number(rec.price).toFixed(2) }}</span>
              </div>
            </div>
          </RouterLink>
        </div>
      </div>

      <!-- Reviews Section -->
      <div class="reviews-section">
        <h2 class="reviews-title">Customer Reviews</h2>

        <!-- Aggregate stats -->
        <div class="reviews-stats glass" v-if="reviewStats.total > 0">
          <div class="stats-avg">
            <span class="avg-number">{{ reviewStats.avg_rating }}</span>
            <div class="stars-display">
              <span v-for="n in 5" :key="n" class="star" :class="{ filled: n <= Math.round(reviewStats.avg_rating) }">★</span>
            </div>
            <span class="avg-label">{{ reviewStats.total }} {{ reviewStats.total === 1 ? 'review' : 'reviews' }}</span>
          </div>
          <div class="stats-bars">
            <div v-for="n in [5,4,3,2,1]" :key="n" class="bar-row">
              <span class="bar-label">{{ n }} ★</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: reviewStats.total ? ((reviewStats['r'+n] || 0) / reviewStats.total * 100) + '%' : '0%' }"></div>
              </div>
              <span class="bar-count">{{ reviewStats['r'+n] || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- Review list -->
        <div class="reviews-list" v-if="reviews.length">
          <div v-for="r in reviews" :key="r.id" class="review-card glass">
            <div class="review-header">
              <div class="review-meta">
                <span class="review-author">{{ r.author_name }}</span>
                <span class="review-date text-muted">{{ formatDate(r.created_at) }}</span>
              </div>
              <div class="review-stars">
                <span v-for="n in 5" :key="n" class="star sm" :class="{ filled: n <= r.rating }">★</span>
              </div>
            </div>
            <div class="review-title" v-if="r.title">{{ r.title }}</div>
            <p class="review-body text-muted">{{ r.body }}</p>
          </div>
        </div>
        <div class="no-reviews text-muted" v-else-if="!loadingReviews">
          No reviews yet. Be the first!
        </div>

        <!-- Submit review form -->
        <div class="review-form glass" v-if="product">
          <h3 class="review-form-title">Write a Review</h3>
          <div v-if="reviewSubmitted" class="review-success">
            ✅ Thanks for your review! It will appear after approval.
          </div>
          <form v-else @submit.prevent="submitReview" novalidate>
            <div class="field-row-2">
              <div class="field">
                <label class="label">Your Name <span class="req">*</span></label>
                <input class="input" type="text" v-model="reviewForm.author_name" placeholder="Jane Doe" />
                <span class="field-error" v-if="reviewErrors.author_name">{{ reviewErrors.author_name }}</span>
              </div>
              <div class="field">
                <label class="label">Email (not shown)</label>
                <input class="input" type="email" v-model="reviewForm.author_email" placeholder="jane@example.com" />
              </div>
            </div>

            <div class="field">
              <label class="label">Rating <span class="req">*</span></label>
              <div class="star-picker">
                <button
                  v-for="n in 5" :key="n"
                  type="button"
                  class="star-pick" :class="{ active: n <= reviewForm.rating }"
                  @click="reviewForm.rating = n"
                  @mouseover="reviewHover = n"
                  @mouseleave="reviewHover = 0"
                  :style="{ color: n <= (reviewHover || reviewForm.rating) ? 'hsl(44,90%,55%)' : undefined }"
                >★</button>
              </div>
            </div>

            <div class="field">
              <label class="label">Review Title</label>
              <input class="input" type="text" v-model="reviewForm.title" placeholder="Great product!" />
            </div>

            <div class="field">
              <label class="label">Review <span class="req">*</span></label>
              <textarea class="input" rows="4" v-model="reviewForm.body" placeholder="Share your experience…"></textarea>
              <span class="field-error" v-if="reviewErrors.body">{{ reviewErrors.body }}</span>
            </div>

            <div class="field-error" v-if="reviewErrors.global">{{ reviewErrors.global }}</div>

            <button type="submit" class="btn btn-primary" :disabled="submittingReview">
              {{ submittingReview ? 'Submitting…' : 'Submit Review' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Q&A Section -->
      <div class="qa-section">
        <h2 class="qa-title">❓ Questions &amp; Answers</h2>

        <!-- Published Q&As -->
        <div class="qa-list" v-if="qaItems.length">
          <div v-for="qa in qaItems" :key="qa.id" class="qa-card glass" :class="{ 'qa-featured': qa.is_featured }">
            <div class="qa-question">
              <span class="qa-q-icon">Q</span>
              <span>{{ qa.question }}</span>
            </div>
            <div class="qa-answer" v-if="qa.answer">
              <span class="qa-a-icon">A</span>
              <span>{{ qa.answer }}</span>
            </div>
            <div class="qa-meta">Asked by {{ qa.customer_name }} · {{ fmtDate(qa.created_at) }}</div>
          </div>
        </div>
        <div v-else-if="!loadingQa" class="no-qa text-muted">No questions yet. Be the first to ask!</div>

        <!-- Ask a question form -->
        <div class="ask-section glass" v-if="!qaSubmitted">
          <h3 style="margin:0 0 1rem">Ask a Question</h3>
          <div style="display:flex;flex-direction:column;gap:.75rem">
            <input v-model="qaForm.customer_name" class="input" placeholder="Your name (optional)" />
            <textarea v-model="qaForm.question" class="input" rows="3" placeholder="Type your question…" style="resize:vertical"></textarea>
            <div class="field-error" v-if="qaError">{{ qaError }}</div>
            <button class="btn btn-primary" @click="submitQa" :disabled="qaSubmitting" style="align-self:flex-start">
              {{ qaSubmitting ? 'Submitting…' : 'Submit Question' }}
            </button>
          </div>
        </div>
        <div v-else class="qa-thanks glass">
          ✅ Thank you! Your question has been submitted and will appear once answered.
          <button class="btn btn-ghost btn-sm" style="margin-left:1rem" @click="qaSubmitted = false">Ask another</button>
        </div>
      </div>

    </article>

    <!-- Recently Viewed -->
    <RecentlyViewed :exclude-id="product?.id ?? null" />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import FlashSaleBanner from '../components/FlashSaleBanner.vue'
import RecentlyViewed from '../components/RecentlyViewed.vue'
import SocialProof from '../components/SocialProof.vue'
import PriceAlertButton from '../components/PriceAlertButton.vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import api from '../api.js'
import { useSiteStore } from '../stores/site.js'
import { useCartStore } from '../stores/cart.js'
import { useWishlistStore } from '../stores/wishlist.js'

const route   = useRoute()
const site    = useSiteStore()
const cart      = useCartStore()
const wishlist  = useWishlistStore()
const product   = ref(null)
const loading   = ref(true)
const isPreview = ref(false)
const activeImage = ref(null)
const qty        = ref(1)
const addedFlash = ref(false)

// Back-in-Stock
const bisEmail = ref('')
const bisName = ref('')
const bisBusy = ref(false)
const bisSuccess = ref('')
const bisError = ref('')

async function subscribeBackInStock() {
  if (!bisEmail.value || !product.value) return
  bisBusy.value = true
  bisError.value = ''
  try {
    const res = await api.post('/stock-alerts/subscribe', {
      product_id: product.value.id,
      email: bisEmail.value,
      name: bisName.value,
    })
    bisSuccess.value = res.data.message || "You'll be notified when back in stock!"
  } catch (e) {
    bisError.value = e.response?.data?.error || 'Failed to subscribe.'
  }
  bisBusy.value = false
}

// Recommendations
const recommendations = ref([])

// Variants
const variants         = ref([])    // [{ id, name, options: [{ id, label, price_adj, sku_suffix, stock }] }]
const volumeTiers      = ref([])
const customOptions    = ref([])
const customOptionValues = ref({})
const selectedVariants = ref({})    // { variantGroupId: optionId }
const selectedOptMap   = ref({})    // { variantGroupId: option object }
const variantError     = ref('')

function selectVariant(groupId, groupName, opt) {
  selectedVariants.value[groupId] = opt.id
  selectedOptMap.value[groupId] = { ...opt, groupName }
  variantError.value = ''
}

const variantInfo = computed(() => {
  if (!variants.value.length) return null
  const keys = []
  const labels = []
  let priceAdj = 0
  for (const v of variants.value) {
    const opt = selectedOptMap.value[v.id]
    if (opt) {
      keys.push(`${v.name}:${opt.label}`)
      labels.push(`${v.name}: ${opt.label}`)
      priceAdj += opt.price_adj || 0
    }
  }
  if (!keys.length) return null
  return {
    key:       keys.join('|'),
    label:     labels.join(', '),
    price_adj: priceAdj,
  }
})

// Reviews
// Q&A
const qaItems       = ref([])
const loadingQa     = ref(false)
const qaSubmitted   = ref(false)
const qaSubmitting  = ref(false)
const qaError       = ref('')
const qaForm        = reactive({ customer_name: '', question: '' })

async function loadQa(productId) {
  loadingQa.value = true
  try {
    const { data } = await api.get('/product-qa', { params: { product_id: productId } })
    qaItems.value = data.items || []
  } catch { qaItems.value = [] }
  loadingQa.value = false
}

async function submitQa() {
  qaError.value = ''
  if (!qaForm.question.trim()) { qaError.value = 'Please enter your question.'; return }
  qaSubmitting.value = true
  try {
    await api.post('/product-qa', { ...qaForm, product_id: product.value?.id })
    qaSubmitted.value = true
    qaForm.question = ''
    qaForm.customer_name = ''
  } catch (err) {
    qaError.value = err.response?.data?.error || 'Failed to submit question.'
  }
  qaSubmitting.value = false
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : ''
}

const reviews         = ref([])
const reviewStats     = ref({ total: 0, avg_rating: 0 })
const loadingReviews  = ref(false)
const reviewSubmitted = ref(false)
const submittingReview = ref(false)
const reviewHover     = ref(0)
const reviewForm      = reactive({ author_name: '', author_email: '', rating: 5, title: '', body: '' })
const reviewErrors    = reactive({ author_name: '', body: '', global: '' })

async function loadReviews(productId) {
  loadingReviews.value = true
  try {
    const { data } = await api.get('/reviews', { params: { product_id: productId, limit: 20 } })
    reviews.value    = data.reviews || []
    reviewStats.value = data.stats || { total: 0, avg_rating: 0 }
  } catch {
    reviews.value = []
  } finally {
    loadingReviews.value = false
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function submitReview() {
  reviewErrors.author_name = reviewErrors.body = reviewErrors.global = ''
  if (!reviewForm.author_name.trim()) { reviewErrors.author_name = 'Name is required.'; return }
  if (!reviewForm.body.trim()) { reviewErrors.body = 'Review text is required.'; return }
  submittingReview.value = true
  try {
    await api.post('/reviews', {
      product_id:   product.value.id,
      author_name:  reviewForm.author_name.trim(),
      author_email: reviewForm.author_email.trim(),
      rating:       reviewForm.rating,
      title:        reviewForm.title.trim(),
      body:         reviewForm.body.trim(),
    })
    reviewSubmitted.value = true
  } catch (err) {
    reviewErrors.global = err.response?.data?.error || 'Something went wrong. Please try again.'
  } finally {
    submittingReview.value = false
  }
}

function addToCart() {
  if (!product.value) return
  // Validate all variant groups have a selection
  if (variants.value.length) {
    const missing = variants.value.find(v => !selectedVariants.value[v.id])
    if (missing) {
      variantError.value = `Please select a ${missing.name}`
      return
    }
  }
  cart.addItem(product.value, qty.value, variantInfo.value)
  cart.open()
  addedFlash.value = true
  setTimeout(() => { addedFlash.value = false }, 2000)
}

const allImages = computed(() => {
  if (!product.value) return []
  const imgs = []
  if (product.value.cover_image) imgs.push(product.value.cover_image)
  ;(product.value.gallery || []).forEach(u => { if (!imgs.includes(u)) imgs.push(u) })
  return imgs
})

const activeTier = computed(() => {
  if (!volumeTiers.value.length) return null
  // find highest applicable tier (largest min_qty still <= current qty)
  const matching = volumeTiers.value.filter(t => qty.value >= t.min_qty)
  return matching.length ? matching[matching.length - 1] : null
})

const discountPct = computed(() => {
  if (!product.value?.price || !product.value?.sale_price) return 0
  return Math.round((1 - product.value.sale_price / product.value.price) * 100)
})

onMounted(load)
watch(() => route.params.slug, load)

async function load() {
  loading.value = true
  activeImage.value = null
  try {
    const previewToken = route.query.preview_token || ''
    const config = previewToken ? { headers: { Authorization: `Bearer ${previewToken}` } } : {}
    const { data } = await api.get(`/products/${route.params.slug}`, config)
    isPreview.value = !!data._preview
    product.value = data
    // Track page view
    api.post('/analytics/view', {
      entity_type: 'product',
      entity_id: data.id,
      entity_slug: data.slug,
      entity_title: data.name
    }).catch(() => {})
    // Track recently viewed
    try {
      let sid = localStorage.getItem('pygmy_sid')
      if (!sid) { sid = Math.random().toString(36).slice(2); localStorage.setItem('pygmy_sid', sid) }
      api.post('/recently-viewed', { session_id: sid, product_id: data.id }).catch(() => {})
    } catch {}
    // Load reviews + Q&A
    loadReviews(data.id)
    loadQa(data.id)
    // Load recommendations
    api.get(`/recommendations/auto?product_id=${data.id}&limit=4`)
      .then(r => { recommendations.value = r.data || [] })
      .catch(() => { recommendations.value = [] })
    // Load variants
    try {
      const { data: variantData } = await api.get('/variants', { params: { product_id: data.id } })
      variants.value = variantData || []
      selectedVariants.value = {}
      selectedOptMap.value = {}
    } catch {
      variants.value = []
    }
    // Load volume pricing tiers
    try {
      const { data: vols } = await api.get('/volume-pricing', { params: { product_id: data.id } })
      volumeTiers.value = vols || []
    } catch {
      volumeTiers.value = []
    }
    // Load custom options
    try {
      const { data: opts } = await api.get('/product-options', { params: { product_id: data.id } })
      customOptions.value = opts || []
      customOptionValues.value = {}
    } catch {
      customOptions.value = []
    }
  } catch {
    product.value = null
  } finally {
    loading.value = false
  }
}

useHead(computed(() => {
  if (!product.value) return {}
  const siteName = site.settings.site_name || 'Pygmy'
  return {
    title: `${product.value.meta_title || product.value.name} — ${siteName}`,
    meta: [
      { name: 'description', content: product.value.meta_desc || product.value.excerpt || '' },
      { property: 'og:title', content: product.value.meta_title || product.value.name },
      { property: 'og:description', content: product.value.meta_desc || product.value.excerpt || '' },
      { property: 'og:image', content: product.value.cover_image || '' },
      { property: 'og:type', content: 'product' },
    ]
  }
}))

function fmt(n) {
  if (n === null || n === undefined) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
</script>

<style scoped>
.product-page { padding-bottom: 5rem; }

.skeleton-wrap { padding: 3rem 1.5rem; }
.skeleton-title { height: 2.5rem; background: var(--glass-bg); border-radius: 0.5rem; max-width: 500px; margin-bottom: 1.5rem; animation: pulse 1.5s infinite; }
.skeleton-body  { height: 400px; border-radius: var(--radius); animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

.not-found { display: flex; justify-content: center; padding: 5rem 1.5rem; }
.not-found-card { padding: 3rem; text-align: center; border-radius: var(--radius); }
.not-found-card h1 { font-size: 4rem; font-weight: 800; color: var(--accent); margin-bottom: 0.5rem; }
.not-found-card p  { color: var(--text-muted); margin-bottom: 1.5rem; }

/* Layout */
.product-article { padding: 3rem 1.5rem; }
.product-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  margin-bottom: 2.5rem;
  align-items: start;
}
@media (max-width: 700px) { .product-layout { grid-template-columns: 1fr; } }

/* Images */
.main-image {
  border-radius: var(--radius);
  overflow: hidden;
  aspect-ratio: 1;
}
.main-img { width: 100%; height: 100%; object-fit: cover; }
.no-image {
  width: 100%; aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  font-size: 5rem; background: var(--glass-bg);
  border-radius: var(--radius);
}

.gallery-thumbs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}
.thumb-btn {
  width: 64px; height: 64px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.2s;
  background: none;
}
.thumb-btn img { width: 100%; height: 100%; object-fit: cover; }
.thumb-btn.active { border-color: var(--accent); }
.thumb-btn:hover { border-color: var(--border); }

/* Info */
.product-info { display: flex; flex-direction: column; gap: 1rem; }
.cat-tag {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
}
.cat-tag:hover { text-decoration: underline; }

.product-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.product-badge  { padding: 3px 10px; border-radius: 99px; font-size: .75rem; font-weight: 700; letter-spacing: .03em; }
.badge-default  { background: rgba(150,150,150,.2); color: #ccc; }
.badge-red      { background: rgba(220,50,50,.2); color: #ff6b6b; }
.badge-green    { background: rgba(50,200,80,.2); color: #4ce88a; }
.badge-blue     { background: rgba(50,120,220,.2); color: #6fb3f5; }
.badge-orange   { background: rgba(255,140,0,.2); color: #ffa030; }
.badge-purple   { background: rgba(150,80,220,.2); color: #c084fc; }
.badge-gold     { background: rgba(200,160,0,.2); color: #ffd700; }

.product-name { font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 800; line-height: 1.2; margin: 0; }
.product-excerpt { color: var(--text-muted); font-size: 1rem; line-height: 1.6; margin: 0; }

.price-block { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
.price-sale  { font-size: 1.8rem; font-weight: 800; color: var(--accent); }
.price-orig  { font-size: 1.1rem; text-decoration: line-through; color: var(--text-muted); }
.price-normal{ font-size: 1.8rem; font-weight: 800; }
.price-free  { font-size: 1.6rem; font-weight: 800; color: #4caf50; }

.discount-tag {
  font-size: 0.78rem;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  padding: 0.15rem 0.5rem;
  border-radius: 2rem;
  letter-spacing: 0.04em;
}

.sku { font-size: 0.82rem; color: var(--text-muted); }
.sku-label { font-weight: 600; }

/* Stock status */
.stock-status { margin: .5rem 0 .75rem; }
.stock-badge {
  display: inline-flex; align-items: center;
  padding: .3em .75em; border-radius: 999px;
  font-size: .8rem; font-weight: 600;
}
.stock-ok  { background: hsl(140,60%,10%); color: hsl(140,60%,60%); border: 1px solid hsl(140,60%,18%); }
.stock-low { background: hsl(45,90%,10%); color: hsl(45,90%,65%); border: 1px solid hsl(45,90%,20%); }
.stock-out { background: hsl(355,70%,12%); color: hsl(355,70%,65%); border: 1px solid hsl(355,70%,22%); }
.atc-btn:disabled { opacity: .5; cursor: not-allowed; }

.tags-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.pill {
  font-size: 0.8rem;
  padding: 0.2rem 0.65rem;
  border-radius: 2rem;
  background: var(--glass-bg);
  color: var(--text-muted);
  border: 1px solid var(--border);
  text-decoration: none;
  transition: all 0.15s;
}
.pill:hover { color: var(--accent); border-color: var(--accent); }

/* Variants */
.variants-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: .5rem;
}
.variant-group { display: flex; flex-direction: column; gap: .4rem; }
.variant-label { font-size: .8rem; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); font-weight: 600; }
.variant-options { display: flex; flex-wrap: wrap; gap: .5rem; }
.variant-opt {
  padding: .4rem .85rem;
  border-radius: .5rem;
  border: 1.5px solid var(--border);
  background: rgba(255,255,255,.05);
  color: var(--text);
  cursor: pointer;
  font-size: .88rem;
  transition: border-color .15s, background .15s, color .15s;
}
.variant-opt:hover:not(.oos) { border-color: var(--accent); color: var(--accent); }
.variant-opt.selected { border-color: var(--accent); background: rgba(var(--accent-rgb, 229,57,53),.15); color: var(--accent); font-weight: 600; }
.variant-opt.oos { opacity: .4; cursor: not-allowed; text-decoration: line-through; }
.opt-adj { font-size: .78rem; margin-left: .25rem; color: var(--text-muted); }
.variant-error { font-size: .85rem; color: var(--accent); }

/* Wishlist button */
.wishlist-btn {
  background: rgba(255,255,255,.07);
  border: 1.5px solid var(--border);
  color: var(--text-muted);
  border-radius: .5rem;
  padding: .45rem .75rem;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  transition: all .2s;
  flex-shrink: 0;
}
.wishlist-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(255,60,60,.1); }
.wishlist-btn.wished { border-color: var(--accent); color: var(--accent); background: rgba(255,60,60,.15); }

/* Add to cart */
.atc-row {
  display: flex;
  gap: .75rem;
  align-items: center;
  flex-wrap: wrap;
}
.qty-selector {
  display: flex;
  align-items: center;
  gap: .35rem;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
  border-radius: .5rem;
  padding: .3rem .5rem;
}
.qty-selector button {
  background: none;
  border: none;
  color: var(--text);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 .25rem;
  line-height: 1;
}
.qty-selector input {
  width: 2.5rem;
  text-align: center;
  background: none;
  border: none;
  color: var(--text);
  font-size: .95rem;
  font-family: inherit;
}
.qty-selector input::-webkit-inner-spin-button,
.qty-selector input::-webkit-outer-spin-button { -webkit-appearance: none; }
.atc-btn { min-width: 160px; flex: 1; }

.back-link { margin-top: 0.5rem; }
.btn-outline {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  text-decoration: none;
  transition: all 0.2s;
}
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }

/* Description */
.description-body {
  padding: 2rem;
  border-radius: var(--radius);
  margin-top: 0.5rem;
}
.description-body h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: 1.25rem; }

.prose { line-height: 1.8; color: var(--text-muted); }
.prose :deep(h1), .prose :deep(h2), .prose :deep(h3) { color: var(--text); margin: 1.5rem 0 0.75rem; }
.prose :deep(p) { margin-bottom: 1rem; }
.prose :deep(ul), .prose :deep(ol) { padding-left: 1.5rem; margin-bottom: 1rem; }
.prose :deep(a) { color: var(--accent); }
.prose :deep(img) { max-width: 100%; border-radius: var(--radius-sm); }
.prose :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 1rem;
  color: var(--text-muted);
  font-style: italic;
  margin: 1rem 0;
}
.prose :deep(code) {
  background: var(--glass-bg);
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.88em;
}
.prose :deep(pre) {
  background: var(--glass-bg);
  padding: 1rem;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin-bottom: 1rem;
}

/* ── Reviews ─────────────────────────────────────────────────── */
/* Back-in-Stock */
.back-in-stock-form { padding: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; margin: 12px 0; }
.bis-intro { margin: 0 0 10px; font-size: 14px; color: var(--text-muted); }
.bis-row { display: flex; flex-direction: column; gap: 8px; }
.bis-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px 14px; color: #fff; font-size: 14px; outline: none; }
.bis-input:focus { border-color: var(--accent); }
.bis-success { color: #4ade80; font-size: 14px; }
.bis-error { color: #f87171; font-size: 13px; margin-top: 6px; }

/* Related products */
.related-section { margin-top: 2.5rem; }
.related-title { font-size: 1.35rem; font-weight: 700; margin-bottom: 1.25rem; }
.related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
.related-card { text-decoration: none; color: inherit; border-radius: 14px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; display: block; }
.related-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.related-img { width: 100%; aspect-ratio: 1; object-fit: cover; }
.related-img-placeholder { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); font-size: 2rem; }
.related-info { padding: 12px; }
.related-name { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.related-price { font-size: 13px; }
.sale-price { color: var(--accent); font-weight: 700; margin-right: 6px; }
.strikethrough { text-decoration: line-through; color: var(--text-muted); }
.regular-price { font-weight: 600; }

.reviews-section { margin-top: 2.5rem; }

/* Q&A */
.qa-section { margin-top: 3rem; }
.qa-title { font-size: 1.35rem; font-weight: 700; margin-bottom: 1.25rem; }
.qa-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }
.qa-card { padding: 1.25rem; border-radius: .75rem; }
.qa-featured { border: 1px solid rgba(var(--accent-raw), .4); }
.qa-question { display: flex; gap: .75rem; font-weight: 600; margin-bottom: .5rem; }
.qa-answer { display: flex; gap: .75rem; opacity: .85; margin-bottom: .5rem; }
.qa-q-icon, .qa-a-icon {
  width: 1.5rem; height: 1.5rem; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: .75rem; font-weight: 700; flex-shrink: 0;
}
.qa-q-icon { background: var(--accent); color: #fff; }
.qa-a-icon { background: rgba(255,255,255,.15); }
.qa-meta { font-size: .8rem; opacity: .5; margin-top: .25rem; }
.no-qa { font-size: .9rem; margin-bottom: 2rem; }
.ask-section { padding: 1.5rem; border-radius: 1rem; margin-top: 1rem; }
.qa-thanks { padding: 1rem 1.5rem; border-radius: .75rem; border: 1px solid rgba(74,222,128,.3); background: rgba(74,222,128,.05); }
.reviews-title { font-size: 1.35rem; font-weight: 700; margin-bottom: 1.25rem; }

.reviews-stats {
  display: flex;
  gap: 2rem;
  align-items: center;
  padding: 1.5rem;
  border-radius: var(--radius);
  margin-bottom: 1.5rem;
}
@media (max-width: 540px) { .reviews-stats { flex-direction: column; align-items: flex-start; } }

.stats-avg { display: flex; flex-direction: column; align-items: center; gap: .25rem; min-width: 100px; }
.avg-number { font-size: 2.5rem; font-weight: 800; color: var(--text); line-height: 1; }
.avg-label  { font-size: .8rem; color: var(--text-muted); }

.star { color: rgba(255,255,255,.2); font-size: 1rem; }
.star.filled { color: hsl(44,90%,55%); }
.star.sm { font-size: .85rem; }

.stats-bars { flex: 1; display: flex; flex-direction: column; gap: .4rem; }
.bar-row { display: flex; align-items: center; gap: .5rem; font-size: .82rem; }
.bar-label { width: 2.5rem; text-align: right; color: var(--text-muted); white-space: nowrap; }
.bar-track { flex: 1; height: 8px; background: rgba(255,255,255,.08); border-radius: 99px; overflow: hidden; }
.bar-fill { height: 100%; background: hsl(44,90%,55%); border-radius: 99px; transition: width 0.4s; }
.bar-count { width: 1.5rem; color: var(--text-muted); }

.reviews-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }
.review-card { padding: 1.25rem 1.5rem; border-radius: var(--radius); }
.review-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: .5rem; }
.review-meta { display: flex; flex-direction: column; gap: .15rem; }
.review-author { font-weight: 700; font-size: .95rem; }
.review-date { font-size: .78rem; }
.review-stars { display: flex; gap: .1rem; }
.review-title { font-weight: 600; font-size: .92rem; margin-bottom: .35rem; }
.review-body { font-size: .9rem; line-height: 1.65; margin: 0; }

.no-reviews { font-size: .9rem; margin-bottom: 2rem; }

.review-form { padding: 1.75rem; border-radius: var(--radius); margin-top: 1rem; }
.review-form-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.25rem; }
.review-success { color: hsl(140,60%,55%); background: hsl(140,60%,8%); border: 1px solid hsl(140,60%,18%); border-radius: .5rem; padding: .75rem 1rem; font-size: .92rem; }
.field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 540px) { .field-row-2 { grid-template-columns: 1fr; } }
.field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.req { color: var(--accent); }
.field-error { color: var(--accent); font-size: .8rem; }
.label { font-size: .85rem; font-weight: 600; }

.star-picker { display: flex; gap: .2rem; }
.star-pick {
  background: none; border: none; font-size: 1.75rem; cursor: pointer;
  color: rgba(255,255,255,.15); transition: color 0.15s; padding: 0 .1rem;
}
.star-pick.active, .star-pick:hover { color: hsl(44,90%,55%); }
</style>
