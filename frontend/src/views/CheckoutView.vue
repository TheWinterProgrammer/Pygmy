<template>
  <div class="checkout-page">
    <div class="container">
      <!-- Empty cart redirect -->
      <div class="empty-cart glass" v-if="!cart.items.length && !submitted">
        <div style="font-size:3rem;margin-bottom:.75rem;">🛒</div>
        <h2>Your cart is empty</h2>
        <p class="text-muted">Add some products before checking out.</p>
        <RouterLink to="/shop" class="btn btn-primary" style="margin-top:1rem;">Browse Shop</RouterLink>
      </div>

      <!-- Checkout form -->
      <div class="checkout-layout" v-else-if="!submitted">
        <!-- Left: form -->
        <div class="checkout-form glass">
          <h1 class="checkout-title">Checkout</h1>
          <p class="checkout-intro text-muted" v-if="site.settings.shop_checkout_intro">
            {{ site.settings.shop_checkout_intro }}
          </p>

          <form @submit.prevent="placeOrder" novalidate>
            <h3 class="form-section-title">👤 Your Details</h3>

            <div class="field-row-2">
              <div class="field">
                <label class="label">Full name <span class="req">*</span></label>
                <input class="input" type="text" v-model="form.customer_name" placeholder="Jane Doe" required />
                <span class="field-error" v-if="errors.customer_name">{{ errors.customer_name }}</span>
              </div>
              <div class="field">
                <label class="label">Email <span class="req">*</span></label>
                <input class="input" type="email" v-model="form.customer_email" placeholder="jane@example.com" required
                  @blur="cart.updateContactInfo(form.customer_email, form.customer_name)" />
                <span class="field-error" v-if="errors.customer_email">{{ errors.customer_email }}</span>
              </div>
            </div>

            <div class="field">
              <label class="label">Phone</label>
              <input class="input" type="tel" v-model="form.customer_phone" placeholder="+49 123 456 7890" />
            </div>

            <h3 class="form-section-title" style="margin-top:1.5rem;">📦 Shipping Address</h3>
            <div class="field">
              <textarea class="input" rows="4" v-model="form.shipping_address"
                placeholder="Street address, city, postal code, country…"></textarea>
            </div>

            <!-- Shipping -->
            <h3 class="form-section-title" style="margin-top:1.5rem;">🚚 Shipping</h3>
            <div class="field-row-2">
              <div class="field">
                <label class="label">Country</label>
                <select class="input" v-model="shippingCountry" @change="calculateShipping">
                  <option value="">— Select country —</option>
                  <option v-for="c in countryList" :key="c.code" :value="c.code">{{ c.name }}</option>
                </select>
              </div>
            </div>
            <div class="shipping-rates" v-if="shippingRates.length">
              <label v-for="rate in shippingRates" :key="rate.id" class="shipping-option" :class="{ selected: selectedRate?.id === rate.id }">
                <input type="radio" name="shipping_rate" :value="rate.id" @change="selectedRate = rate" :checked="selectedRate?.id === rate.id" />
                <span class="rate-name">{{ rate.name }}</span>
                <span class="rate-cost" v-if="rate.free">Free</span>
                <span class="rate-cost" v-else>{{ fmt(rate.cost) }}</span>
              </label>
            </div>
            <div class="text-muted shipping-note" v-else-if="shippingCountry && !loadingRates" style="font-size:.85rem;margin-bottom:1rem;">
              No shipping rates available for this country. Contact us.
            </div>
            <div class="text-muted shipping-note" v-if="loadingRates" style="font-size:.85rem;margin-bottom:1rem;">Calculating…</div>

            <h3 class="form-section-title" style="margin-top:1.5rem;">📝 Notes</h3>
            <div class="field">
              <textarea class="input" rows="2" v-model="form.notes"
                placeholder="Special instructions, delivery notes…"></textarea>
            </div>

            <!-- Coupon code -->
            <h3 class="form-section-title" style="margin-top:1.5rem;">🎟️ Coupon Code</h3>
            <div class="coupon-row">
              <input class="input coupon-input" type="text" v-model="couponInput"
                placeholder="Enter coupon code"
                :disabled="!!appliedCoupon"
                @keydown.enter.prevent="applyCoupon"
                style="text-transform:uppercase;" />
              <button type="button" class="btn btn-ghost" :disabled="applyingCoupon || !!appliedCoupon" @click="applyCoupon">
                {{ applyingCoupon ? '…' : (appliedCoupon ? '✓ Applied' : 'Apply') }}
              </button>
              <button v-if="appliedCoupon" type="button" class="btn btn-ghost btn-sm" @click="removeCoupon" title="Remove coupon">✕</button>
            </div>
            <div class="coupon-success" v-if="appliedCoupon">
              🎉 Coupon <strong>{{ appliedCoupon.code }}</strong> applied —
              {{ appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% off` : `€${Number(appliedCoupon.discount).toFixed(2)} off` }}
            </div>
            <div class="coupon-error" v-if="couponError">{{ couponError }}</div>

            <!-- Gift Card -->
            <template v-if="giftCardsEnabled">
              <h3 class="form-section-title" style="margin-top:1.5rem;">🎁 Gift Card</h3>
              <div v-if="!appliedGiftCard" class="coupon-row">
                <input class="input coupon-input" type="text" v-model="giftCardInput"
                  placeholder="Enter gift card code" @keyup.enter="applyGiftCard" />
                <button type="button" class="btn btn-ghost" @click="applyGiftCard" :disabled="applyingGC">
                  {{ applyingGC ? '…' : 'Apply' }}
                </button>
              </div>
              <div v-else class="coupon-success">
                🎁 Gift card <strong>{{ appliedGiftCard.code }}</strong> applied — {{ fmt(giftCardDiscount) }} off
                <span class="text-muted small" style="margin-left:.4rem;">(Balance: {{ fmt(appliedGiftCard.balance) }})</span>
                <button type="button" class="btn btn-ghost btn-sm" @click="removeGiftCard" style="margin-left:.5rem;">✕ Remove</button>
              </div>
              <div class="coupon-error" v-if="gcError">{{ gcError }}</div>
            </template>

            <!-- Loyalty Points -->
            <template v-if="loyaltyEnabled && customer.isLoggedIn && loyaltyBalance >= loyaltyMinRedeem">
              <h3 class="form-section-title" style="margin-top:1.5rem;">🏆 Use Loyalty Points</h3>
              <div class="loyalty-balance-info">
                You have <strong>{{ loyaltyBalance }}</strong> points
                (worth {{ fmt(loyaltyBalance / loyaltyRedemptionRate) }})
              </div>
              <div v-if="!loyaltyApplied" class="coupon-row">
                <input
                  class="input coupon-input"
                  type="number"
                  v-model.number="loyaltyPointsInput"
                  :placeholder="`Enter points (max ${loyaltyBalance})`"
                  :max="loyaltyBalance"
                  min="0"
                />
                <button type="button" class="btn btn-ghost" @click="applyLoyaltyPoints">Apply</button>
              </div>
              <div v-else class="coupon-success">
                🏆 <strong>{{ parseInt(loyaltyPointsInput) }} points</strong> applied — {{ fmt(loyaltyDiscount) }} off
                <button type="button" class="btn btn-ghost btn-sm" @click="removeLoyaltyPoints" style="margin-left:.5rem;">✕ Remove</button>
              </div>
              <div class="coupon-error" v-if="loyaltyError">{{ loyaltyError }}</div>
            </template>

            <div class="field-error global-error" v-if="submitError">{{ submitError }}</div>

            <button type="submit" class="btn btn-primary btn-lg submit-btn" :disabled="placing">
              <span v-if="placing">Placing order…</span>
              <span v-else>Place Order · {{ fmt(orderTotal) }}</span>
            </button>
          </form>
        </div>

        <!-- Right: order summary -->
        <div class="order-summary">
          <div class="glass summary-card">
            <h2 class="summary-title">Order Summary</h2>
            <div class="summary-items">
              <div class="summary-item" v-for="item in cart.items" :key="item.product_id">
                <div class="summary-item-img">
                  <img v-if="item.cover_image" :src="item.cover_image" :alt="item.name" />
                  <div v-else class="img-placeholder">🛍️</div>
                </div>
                <div class="summary-item-info">
                  <span class="summary-item-name">{{ item.name }}</span>
                  <span class="summary-item-meta text-muted">× {{ item.quantity }}</span>
                </div>
                <div class="summary-item-total">{{ fmt(item.unit_price * item.quantity) }}</div>
              </div>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-row">
              <span class="text-muted">Subtotal</span>
              <span>{{ fmt(cart.subtotal) }}</span>
            </div>
            <div class="summary-row discount-row" v-if="appliedCoupon">
              <span class="text-muted">🎟️ {{ appliedCoupon.code }}</span>
              <span style="color:hsl(140,60%,60%);">−{{ fmt(appliedCoupon.discount) }}</span>
            </div>
            <div class="summary-row">
              <span class="text-muted">Shipping</span>
              <span v-if="selectedRate">
                <span v-if="selectedRate.free" style="color:hsl(140,60%,60%);">Free</span>
                <span v-else>{{ fmt(selectedRate.cost) }}</span>
              </span>
              <span class="text-muted" v-else>Select country</span>
            </div>
            <div class="summary-row" v-if="taxAmount > 0">
              <span class="text-muted">{{ taxRateName || 'Tax' }} ({{ taxRate }}%)</span>
              <span>{{ fmt(taxAmount) }}</span>
            </div>
            <div class="summary-row discount-row" v-if="loyaltyApplied && loyaltyDiscount > 0">
              <span class="text-muted">🏆 Loyalty discount</span>
              <span style="color:hsl(140,60%,60%);">−{{ fmt(loyaltyDiscount) }}</span>
            </div>
            <div class="summary-row discount-row" v-if="appliedGiftCard && giftCardDiscount > 0">
              <span class="text-muted">🎁 Gift card ({{ appliedGiftCard.code }})</span>
              <span style="color:hsl(140,60%,60%);">−{{ fmt(giftCardDiscount) }}</span>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-row summary-total">
              <span>Total</span>
              <strong style="color:var(--accent);">{{ fmt(orderTotal) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '../stores/cart.js'
import { useSiteStore } from '../stores/site.js'
import { useCustomerStore } from '../stores/customer.js'
import api from '../api.js'
import { useAffiliate } from '../composables/useAffiliate.js'

const { getActiveCode, clearReferral } = useAffiliate()

const cart     = useCartStore()
const site     = useSiteStore()
const customer = useCustomerStore()
const router   = useRouter()

const submitted = ref(false)
const placing   = ref(false)
const submitError = ref('')

// Coupon state
const couponInput    = ref('')
const applyingCoupon = ref(false)
const couponError    = ref('')
const appliedCoupon  = ref(null) // { code, type, value, discount }

// Shipping state
const shippingCountry = ref('')
const shippingRates   = ref([])
const selectedRate    = ref(null)
const loadingRates    = ref(false)

// Tax state
const taxAmount   = ref(0)
const taxRateName = ref('')
const taxRate     = ref(0)
const taxLoading  = ref(false)

// Gift card state
const giftCardsEnabled = ref(false)
const giftCardInput    = ref('')
const applyingGC       = ref(false)
const gcError          = ref('')
const appliedGiftCard  = ref(null) // { code, balance }
const giftCardDiscount = ref(0)

// Loyalty state
const loyaltyBalance  = ref(0)
const loyaltyEnabled  = ref(false)
const loyaltyMinRedeem = ref(100)
const loyaltyRedemptionRate = ref(100)
const loyaltyPointsInput = ref(0)
const loyaltyDiscount = ref(0)
const loyaltyError    = ref('')
const loyaltyApplied  = ref(false)

// Common country list
const countryList = [
  { code: 'AT', name: 'Austria' }, { code: 'BE', name: 'Belgium' }, { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' }, { code: 'CN', name: 'China' }, { code: 'HR', name: 'Croatia' },
  { code: 'CZ', name: 'Czech Republic' }, { code: 'DK', name: 'Denmark' }, { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' }, { code: 'DE', name: 'Germany' }, { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' }, { code: 'IN', name: 'India' }, { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' }, { code: 'IT', name: 'Italy' }, { code: 'JP', name: 'Japan' },
  { code: 'MX', name: 'Mexico' }, { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' }, { code: 'PL', name: 'Poland' }, { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' }, { code: 'RU', name: 'Russia' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'RS', name: 'Serbia' }, { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' },
  { code: 'ZA', name: 'South Africa' }, { code: 'ES', name: 'Spain' }, { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' }, { code: 'TR', name: 'Turkey' }, { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' }, { code: 'VN', name: 'Vietnam' },
].sort((a, b) => a.name.localeCompare(b.name))

async function calculateShipping() {
  selectedRate.value = null
  shippingRates.value = []
  if (!shippingCountry.value) return
  loadingRates.value = true
  try {
    const { data } = await api.post('/shipping/calculate', {
      country_code: shippingCountry.value,
      subtotal: cart.subtotal,
    })
    shippingRates.value = data.rates || []
    if (shippingRates.value.length === 1) selectedRate.value = shippingRates.value[0]
  } catch {
    shippingRates.value = []
  } finally {
    loadingRates.value = false
  }
  // Calculate tax for selected country
  await calculateTax()
}

async function calculateTax() {
  taxAmount.value = 0
  taxRateName.value = ''
  taxRate.value = 0
  if (!shippingCountry.value) return
  taxLoading.value = true
  try {
    const { data } = await api.post('/tax-rates/calculate', {
      country: shippingCountry.value,
      subtotal: cart.subtotal - (appliedCoupon.value?.discount || 0),
    })
    taxAmount.value = data.tax_amount || 0
    taxRateName.value = data.name || ''
    taxRate.value = data.rate || 0
  } catch {
    taxAmount.value = 0
  } finally {
    taxLoading.value = false
  }
}

const shippingCost = computed(() => (selectedRate.value && !selectedRate.value.free) ? selectedRate.value.cost : 0)

const orderTotal = computed(() =>
  Math.max(0, cart.subtotal - (appliedCoupon.value?.discount || 0) - loyaltyDiscount.value - giftCardDiscount.value + shippingCost.value + taxAmount.value)
)

async function applyCoupon() {
  couponError.value = ''
  const code = couponInput.value.trim()
  if (!code) return

  applyingCoupon.value = true
  try {
    const { data } = await api.post('/coupons/validate', {
      code,
      subtotal: cart.subtotal,
    })
    appliedCoupon.value = data
  } catch (err) {
    couponError.value = err.response?.data?.error || 'Invalid coupon code.'
    appliedCoupon.value = null
  } finally {
    applyingCoupon.value = false
  }
}

function removeCoupon() {
  appliedCoupon.value = null
  couponInput.value = ''
  couponError.value = ''
}

const form = reactive({
  customer_name:    '',
  customer_email:   '',
  customer_phone:   '',
  shipping_address: '',
  notes:            '',
})

const errors = reactive({
  customer_name:  '',
  customer_email: '',
})

function validate() {
  errors.customer_name  = form.customer_name.trim()  ? '' : 'Name is required.'
  errors.customer_email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())
    ? '' : 'A valid email is required.'
  return !errors.customer_name && !errors.customer_email
}

function fmt(v) {
  const sym = site.settings?.shop_currency_symbol || '€'
  const currency = site.settings?.shop_currency || 'EUR'
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(v || 0)
  } catch {
    return `${sym}${Number(v || 0).toFixed(2)}`
  }
}

// Auto-fill from customer account if logged in
onMounted(async () => {
  // Load site settings (gift cards, etc.)
  try {
    const { data } = await api.get('/settings')
    giftCardsEnabled.value = data.gift_cards_enabled === '1'
  } catch {}

  if (customer.isLoggedIn && customer.customer) {
    const c = customer.customer
    if (!form.customer_name) form.customer_name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
    if (!form.customer_email) form.customer_email = c.email || ''
    if (!form.customer_phone) form.customer_phone = c.phone || ''
    // Fetch loyalty balance
    try {
      const headers = { Authorization: `Bearer ${customer.token}` }
      const res = await api.get('/loyalty/balance', { headers })
      loyaltyBalance.value = res.data.balance || 0
      loyaltyEnabled.value = res.data.loyalty_enabled || false
      loyaltyMinRedeem.value = res.data.min_redeem || 100
      loyaltyRedemptionRate.value = res.data.redemption_rate || 100
    } catch {}
  }
})

async function applyLoyaltyPoints() {
  loyaltyError.value = ''
  const pts = parseInt(loyaltyPointsInput.value) || 0
  if (pts <= 0) { loyaltyError.value = 'Enter a valid number of points.'; return }
  if (pts < loyaltyMinRedeem.value) { loyaltyError.value = `Minimum redemption is ${loyaltyMinRedeem.value} points.`; return }
  if (pts > loyaltyBalance.value) { loyaltyError.value = `You only have ${loyaltyBalance.value} points.`; return }
  try {
    const headers = { Authorization: `Bearer ${customer.token}` }
    const { data } = await api.post('/loyalty/redeem', { points: pts }, { headers })
    loyaltyDiscount.value = data.discount || 0
    loyaltyApplied.value = true
  } catch (e) {
    loyaltyError.value = e.response?.data?.error || 'Could not apply points.'
  }
}

function removeLoyaltyPoints() {
  loyaltyDiscount.value = 0
  loyaltyApplied.value = false
  loyaltyPointsInput.value = 0
  loyaltyError.value = ''
}

async function applyGiftCard() {
  gcError.value = ''
  const code = giftCardInput.value.trim()
  if (!code) return
  applyingGC.value = true
  try {
    const { data } = await api.post('/gift-cards/validate', { code })
    const discount = Math.min(data.balance, cart.subtotal - (appliedCoupon.value?.discount || 0))
    appliedGiftCard.value = data
    giftCardDiscount.value = discount
    giftCardInput.value = ''
  } catch (e) {
    gcError.value = e.response?.data?.error || 'Invalid gift card code.'
  } finally { applyingGC.value = false }
}

function removeGiftCard() {
  appliedGiftCard.value = null
  giftCardDiscount.value = 0
  gcError.value = ''
}

async function placeOrder() {
  submitError.value = ''
  if (!validate()) return

  placing.value = true
  try {
    const payload = {
      customer_name:    form.customer_name.trim(),
      customer_email:   form.customer_email.trim().toLowerCase(),
      customer_phone:   form.customer_phone.trim(),
      shipping_address: form.shipping_address.trim(),
      notes:            form.notes.trim(),
      items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      subtotal: cart.subtotal,
      total:    orderTotal.value,
      coupon_code: appliedCoupon.value?.code || '',
      shipping_country: shippingCountry.value || '',
      shipping_rate_name: selectedRate.value?.name || '',
      shipping_cost: shippingCost.value,
      tax_amount: taxAmount.value,
      tax_rate_name: taxRateName.value,
      redeem_points: loyaltyApplied.value ? (parseInt(loyaltyPointsInput.value) || 0) : 0,
      gift_card_code: appliedGiftCard.value?.code || '',
      affiliate_code: getActiveCode() || '',
    }

    // Pass customer token so order is linked to their account
    const headers = customer.isLoggedIn ? { Authorization: `Bearer ${customer.token}` } : {}
    const { data } = await api.post('/orders', payload, { headers })
    cart.markRecovered()
    cart.clear()
    clearReferral() // clear affiliate referral after successful order
    submitted.value = true
    router.push(`/order/${data.order_number}`)
  } catch (err) {
    submitError.value = err.response?.data?.error || 'Something went wrong. Please try again.'
  } finally {
    placing.value = false
  }
}
</script>

<style scoped>
.checkout-page {
  padding: 5rem 0 4rem;
  min-height: 100vh;
}
.checkout-page .container { max-width: 1000px; }

.empty-cart {
  text-align: center;
  padding: 3rem;
  border-radius: 1.25rem;
  max-width: 480px;
  margin: 5rem auto;
}

.checkout-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 2rem;
  align-items: start;
}
@media (max-width: 768px) {
  .checkout-layout { grid-template-columns: 1fr; }
  .order-summary { order: -1; }
}

/* Form */
.checkout-form {
  padding: 2rem;
  border-radius: 1.25rem;
}
.checkout-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 .4rem;
}
.checkout-intro { margin: 0 0 1.5rem; font-size: .95rem; }
.form-section-title {
  font-size: .95rem;
  font-weight: 700;
  color: var(--accent);
  margin: 0 0 .875rem;
}
.field-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
@media (max-width: 500px) { .field-row-2 { grid-template-columns: 1fr; } }
.field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.req { color: var(--accent); }
.field-error { color: var(--accent); font-size: .8rem; }
.global-error {
  background: rgba(var(--accent-rgb), .12);
  border: 1px solid rgba(var(--accent-rgb), .3);
  border-radius: .5rem;
  padding: .65rem .875rem;
  margin-bottom: 1rem;
}
.submit-btn { width: 100%; margin-top: .5rem; font-size: 1rem; }

/* Coupon */
.coupon-row { display: flex; gap: .5rem; align-items: center; margin-bottom: .5rem; }
.coupon-input { flex: 1; text-transform: uppercase; letter-spacing: .06em; }
.coupon-success {
  font-size: .85rem;
  color: hsl(140,60%,60%);
  background: hsl(140,60%,8%);
  border: 1px solid hsl(140,60%,18%);
  border-radius: .5rem;
  padding: .45rem .75rem;
  margin-bottom: .75rem;
}
.coupon-error {
  font-size: .82rem;
  color: var(--accent);
  margin-bottom: .75rem;
}
.discount-row span:last-child { font-weight: 600; }

/* Shipping */
.shipping-rates { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
.shipping-option {
  display: flex; align-items: center; gap: .75rem;
  padding: .7rem 1rem;
  border-radius: .625rem;
  border: 1px solid rgba(255,255,255,.1);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.shipping-option:hover { border-color: rgba(255,255,255,.2); }
.shipping-option.selected { border-color: var(--accent); background: rgba(var(--accent-rgb),.08); }
.shipping-option input[type="radio"] { accent-color: var(--accent); width: 16px; height: 16px; }
.rate-name { flex: 1; font-size: .92rem; }
.rate-cost { font-weight: 700; font-size: .92rem; }
.shipping-note { margin-bottom: 1rem; }

/* Summary */
.summary-card {
  padding: 1.5rem;
  border-radius: 1.25rem;
  position: sticky;
  top: 5rem;
}
.summary-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.25rem; }
.summary-items { display: flex; flex-direction: column; gap: .75rem; margin-bottom: .75rem; }
.summary-item {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: .625rem;
  align-items: center;
}
.summary-item-img { width: 40px; height: 40px; border-radius: .4rem; overflow: hidden; background: rgba(255,255,255,.06); display:flex;align-items:center;justify-content:center; }
.summary-item-img img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder { font-size: 1.2rem; }
.summary-item-info { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
.summary-item-name { font-size: .88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.summary-item-meta { font-size: .78rem; }
.summary-item-total { font-size: .88rem; font-weight: 600; white-space: nowrap; }
.summary-divider { height: 1px; background: rgba(255,255,255,.08); margin: .875rem 0; }
.summary-row { display: flex; justify-content: space-between; align-items: baseline; gap: .5rem; font-size: .9rem; margin-bottom: .4rem; }
.summary-total { font-size: 1rem; margin-bottom: 0; }
.loyalty-balance-info { font-size: .85rem; color: var(--text-muted); margin-bottom: .75rem; padding: .4rem .75rem; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.25); border-radius: .5rem; }
</style>
