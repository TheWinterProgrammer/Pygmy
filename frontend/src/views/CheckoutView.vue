<template>
  <div class="checkout-page">
    <div class="container">
      <!-- Empty cart -->
      <div class="empty-cart glass" v-if="!cart.items.length && !submitted">
        <div style="font-size:3rem;margin-bottom:.75rem;">🛒</div>
        <h2>Your cart is empty</h2>
        <p class="text-muted">Add some products before checking out.</p>
        <RouterLink to="/shop" class="btn btn-primary" style="margin-top:1rem;">Browse Shop</RouterLink>
      </div>

      <!-- Checkout layout -->
      <div class="checkout-layout" v-else-if="!submitted">
        <!-- Left: wizard -->
        <div class="checkout-left">
          <!-- Step progress -->
          <div class="step-progress glass">
            <div
              v-for="(s, i) in steps" :key="i"
              class="step-item"
              :class="{ active: step === i, done: step > i }"
              @click="step > i && (step = i)"
            >
              <div class="step-circle">
                <span v-if="step > i">✓</span>
                <span v-else>{{ i + 1 }}</span>
              </div>
              <span class="step-label">{{ s }}</span>
              <div class="step-line" v-if="i < steps.length - 1"></div>
            </div>
          </div>

          <!-- STEP 0: Contact -->
          <div class="step-card glass" v-if="step === 0">
            <h2 class="step-title">👤 Your Details</h2>
            <p class="step-intro text-muted" v-if="site.settings.shop_checkout_intro">{{ site.settings.shop_checkout_intro }}</p>
            <div class="field-row-2">
              <div class="field">
                <label class="label">Full name <span class="req">*</span></label>
                <input class="input" type="text" v-model="form.customer_name" placeholder="Jane Doe" @blur="touchName" />
                <span class="field-error" v-if="errors.customer_name">{{ errors.customer_name }}</span>
              </div>
              <div class="field">
                <label class="label">Email <span class="req">*</span></label>
                <input class="input" type="email" v-model="form.customer_email" placeholder="jane@example.com"
                  @blur="() => { touchEmail(); cart.updateContactInfo(form.customer_email, form.customer_name) }" />
                <span class="field-error" v-if="errors.customer_email">{{ errors.customer_email }}</span>
              </div>
            </div>
            <div class="field">
              <label class="label">Phone</label>
              <input class="input" type="tel" v-model="form.customer_phone" placeholder="+49 123 456 7890" />
            </div>
            <div class="step-actions">
              <button class="btn btn-primary btn-lg" @click="goToStep(1)">Continue to Shipping →</button>
            </div>
          </div>

          <!-- STEP 1: Shipping -->
          <div class="step-card glass" v-if="step === 1">
            <h2 class="step-title">📦 Shipping Address</h2>
            <div class="field">
              <label class="label">Address line 1 <span class="req">*</span></label>
              <input class="input" v-model="form.address1" placeholder="Street and number" />
              <span class="field-error" v-if="errors.address1">{{ errors.address1 }}</span>
            </div>
            <div class="field">
              <label class="label">Address line 2</label>
              <input class="input" v-model="form.address2" placeholder="Apartment, suite, unit…" />
            </div>
            <div class="field-row-3">
              <div class="field">
                <label class="label">City <span class="req">*</span></label>
                <input class="input" v-model="form.city" placeholder="Berlin" />
                <span class="field-error" v-if="errors.city">{{ errors.city }}</span>
              </div>
              <div class="field">
                <label class="label">Postal code</label>
                <input class="input" v-model="form.postal_code" placeholder="10115" />
              </div>
              <div class="field">
                <label class="label">State / Region</label>
                <input class="input" v-model="form.state" placeholder="Optional" />
              </div>
            </div>
            <div class="field">
              <label class="label">Country <span class="req">*</span></label>
              <select class="input" v-model="shippingCountry" @change="calculateShipping">
                <option value="">— Select country —</option>
                <option v-for="c in countryList" :key="c.code" :value="c.code">{{ c.name }}</option>
              </select>
              <span class="field-error" v-if="errors.country">{{ errors.country }}</span>
            </div>

            <!-- Shipping rates -->
            <div v-if="shippingCountry">
              <h3 class="sub-section">🚚 Shipping Method</h3>
              <div v-if="loadingRates" class="text-muted" style="font-size:.85rem;margin-bottom:1rem;">Calculating…</div>
              <div v-else-if="shippingRates.length" class="shipping-rates">
                <label v-for="rate in shippingRates" :key="rate.id"
                  class="shipping-option"
                  :class="{ selected: selectedRate?.id === rate.id }"
                >
                  <input type="radio" name="shipping_rate" :value="rate.id"
                    @change="selectedRate = rate" :checked="selectedRate?.id === rate.id" />
                  <span class="rate-name">{{ rate.name }}</span>
                  <span class="rate-cost" v-if="rate.free" style="color:hsl(140,60%,60%);">Free</span>
                  <span class="rate-cost" v-else>{{ fmt(rate.cost) }}</span>
                </label>
              </div>
              <div v-else class="text-muted shipping-note" style="font-size:.85rem;margin-bottom:1rem;">
                No shipping rates available for this country. Please contact us.
              </div>
            </div>

            <div class="field">
              <label class="label">Order notes</label>
              <textarea class="input" rows="2" v-model="form.notes" placeholder="Special instructions, delivery notes…"></textarea>
            </div>

            <div class="step-actions">
              <button class="btn btn-ghost" @click="step = 0">← Back</button>
              <button class="btn btn-primary btn-lg" @click="goToStep(2)">Continue to Billing →</button>
            </div>
          </div>

          <!-- STEP 2: Billing -->
          <div class="step-card glass" v-if="step === 2">
            <h2 class="step-title">🏦 Billing Address</h2>

            <label class="same-toggle" @click="billingSame = !billingSame">
              <div class="toggle-checkbox" :class="{ checked: billingSame }">
                <div class="toggle-dot"></div>
              </div>
              <span>Same as shipping address</span>
            </label>

            <div v-if="!billingSame" class="billing-fields">
              <div class="field">
                <label class="label">Billing name <span class="req">*</span></label>
                <input class="input" v-model="billing.name" :placeholder="form.customer_name || 'Jane Doe'" />
              </div>
              <div class="field">
                <label class="label">Address line 1 <span class="req">*</span></label>
                <input class="input" v-model="billing.address1" placeholder="Street and number" />
                <span class="field-error" v-if="errors.billing_address1">{{ errors.billing_address1 }}</span>
              </div>
              <div class="field">
                <label class="label">Address line 2</label>
                <input class="input" v-model="billing.address2" placeholder="Apartment, suite, unit…" />
              </div>
              <div class="field-row-3">
                <div class="field">
                  <label class="label">City <span class="req">*</span></label>
                  <input class="input" v-model="billing.city" placeholder="Berlin" />
                  <span class="field-error" v-if="errors.billing_city">{{ errors.billing_city }}</span>
                </div>
                <div class="field">
                  <label class="label">Postal code</label>
                  <input class="input" v-model="billing.postal_code" placeholder="10115" />
                </div>
                <div class="field">
                  <label class="label">State / Region</label>
                  <input class="input" v-model="billing.state" placeholder="Optional" />
                </div>
              </div>
              <div class="field">
                <label class="label">Country <span class="req">*</span></label>
                <select class="input" v-model="billing.country">
                  <option value="">— Select country —</option>
                  <option v-for="c in countryList" :key="c.code" :value="c.code">{{ c.name }}</option>
                </select>
                <span class="field-error" v-if="errors.billing_country">{{ errors.billing_country }}</span>
              </div>
            </div>

            <div v-else class="billing-same-preview glass-sm">
              <div style="font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem;">Using shipping address</div>
              <div>{{ formatShippingAddress() }}</div>
            </div>

            <div class="step-actions">
              <button class="btn btn-ghost" @click="step = 1">← Back</button>
              <button class="btn btn-primary btn-lg" @click="goToStep(3)">Review Order →</button>
            </div>
          </div>

          <!-- STEP 3: Review & Pay -->
          <div class="step-card glass" v-if="step === 3">
            <h2 class="step-title">✅ Review & Place Order</h2>

            <!-- Review sections -->
            <div class="review-grid">
              <div class="review-section glass-sm">
                <div class="review-section-header">
                  👤 Contact
                  <button class="btn-edit" @click="step = 0">Edit</button>
                </div>
                <div class="review-line">{{ form.customer_name }}</div>
                <div class="review-line text-muted">{{ form.customer_email }}</div>
                <div class="review-line text-muted" v-if="form.customer_phone">{{ form.customer_phone }}</div>
              </div>
              <div class="review-section glass-sm">
                <div class="review-section-header">
                  📦 Shipping
                  <button class="btn-edit" @click="step = 1">Edit</button>
                </div>
                <div class="review-line" style="white-space:pre-line;">{{ formatShippingAddress() }}</div>
                <div class="review-line text-muted" v-if="selectedRate">
                  {{ selectedRate.name }} · {{ selectedRate.free ? 'Free' : fmt(selectedRate.cost) }}
                </div>
              </div>
              <div class="review-section glass-sm">
                <div class="review-section-header">
                  🏦 Billing
                  <button class="btn-edit" @click="step = 2">Edit</button>
                </div>
                <div v-if="billingSame" class="review-line text-muted">Same as shipping</div>
                <div v-else class="review-line" style="white-space:pre-line;">{{ formatBillingAddress() }}</div>
              </div>
              <div class="review-section glass-sm" v-if="form.notes">
                <div class="review-section-header">📝 Notes</div>
                <div class="review-line text-muted" style="white-space:pre-line;">{{ form.notes }}</div>
              </div>
            </div>

            <!-- Coupons / Gift Cards / Loyalty -->
            <div class="discounts-section">
              <!-- Coupon -->
              <h3 class="sub-section">🎟️ Coupon Code</h3>
              <div class="coupon-row">
                <input class="input coupon-input" type="text" v-model="couponInput"
                  placeholder="Enter coupon code" :disabled="!!appliedCoupon"
                  @keydown.enter.prevent="applyCoupon" style="text-transform:uppercase;" />
                <button type="button" class="btn btn-ghost" :disabled="applyingCoupon || !!appliedCoupon" @click="applyCoupon">
                  {{ applyingCoupon ? '…' : (appliedCoupon ? '✓ Applied' : 'Apply') }}
                </button>
                <button v-if="appliedCoupon" type="button" class="btn btn-ghost btn-sm" @click="removeCoupon" title="Remove">✕</button>
              </div>
              <div class="coupon-success" v-if="appliedCoupon">
                🎉 <strong>{{ appliedCoupon.code }}</strong> —
                {{ appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% off` : `${fmt(appliedCoupon.discount)} off` }}
              </div>
              <div class="coupon-error" v-if="couponError">{{ couponError }}</div>

              <!-- Gift Card -->
              <template v-if="giftCardsEnabled">
                <h3 class="sub-section" style="margin-top:1.25rem;">🎁 Gift Card</h3>
                <div v-if="!appliedGiftCard" class="coupon-row">
                  <input class="input coupon-input" type="text" v-model="giftCardInput"
                    placeholder="Enter gift card code" @keyup.enter="applyGiftCard" />
                  <button type="button" class="btn btn-ghost" @click="applyGiftCard" :disabled="applyingGC">
                    {{ applyingGC ? '…' : 'Apply' }}
                  </button>
                </div>
                <div v-else class="coupon-success">
                  🎁 <strong>{{ appliedGiftCard.code }}</strong> — {{ fmt(giftCardDiscount) }} off
                  <button type="button" class="btn btn-ghost btn-sm" @click="removeGiftCard" style="margin-left:.5rem;">✕</button>
                </div>
                <div class="coupon-error" v-if="gcError">{{ gcError }}</div>
              </template>

              <!-- Loyalty -->
              <template v-if="loyaltyEnabled && customer.isLoggedIn && loyaltyBalance >= loyaltyMinRedeem">
                <h3 class="sub-section" style="margin-top:1.25rem;">🏆 Loyalty Points</h3>
                <div class="loyalty-balance-info">
                  You have <strong>{{ loyaltyBalance }}</strong> points (worth {{ fmt(loyaltyBalance / loyaltyRedemptionRate) }})
                </div>
                <div v-if="!loyaltyApplied" class="coupon-row">
                  <input class="input coupon-input" type="number" v-model.number="loyaltyPointsInput"
                    :placeholder="`Enter points (max ${loyaltyBalance})`" :max="loyaltyBalance" min="0" />
                  <button type="button" class="btn btn-ghost" @click="applyLoyaltyPoints">Apply</button>
                </div>
                <div v-else class="coupon-success">
                  🏆 <strong>{{ parseInt(loyaltyPointsInput) }} points</strong> — {{ fmt(loyaltyDiscount) }} off
                  <button type="button" class="btn btn-ghost btn-sm" @click="removeLoyaltyPoints" style="margin-left:.5rem;">✕</button>
                </div>
                <div class="coupon-error" v-if="loyaltyError">{{ loyaltyError }}</div>
              </template>

              <!-- Store Credit -->
              <template v-if="storeCreditEnabled && customer.isLoggedIn && storeCreditBalance > 0">
                <h3 class="sub-section" style="margin-top:1.25rem;">💳 Store Credit</h3>
                <div class="loyalty-balance-info">
                  You have <strong>{{ fmt(storeCreditBalance) }}</strong> available store credit
                </div>
                <div v-if="!storeCreditApplied" class="coupon-row">
                  <input class="input coupon-input" type="number" step="0.01"
                    v-model.number="storeCreditInput" :placeholder="`Max ${fmt(storeCreditBalance)}`"
                    :max="storeCreditBalance" min="0" />
                  <button type="button" class="btn btn-ghost" @click="applyStoreCredit">Apply</button>
                </div>
                <div v-else class="coupon-success">
                  💳 Store credit: −{{ fmt(storeCreditApplied) }}
                  <button type="button" class="btn btn-ghost btn-sm" @click="removeStoreCredit" style="margin-left:.5rem;">✕</button>
                </div>
              </template>

              <!-- Gift Wrap -->
              <template v-if="giftWrapEnabled">
                <h3 class="sub-section" style="margin-top:1.25rem;">🎀 Gift Wrap</h3>
                <label class="gift-wrap-toggle">
                  <input type="checkbox" v-model="giftWrap" />
                  <span>Add gift wrapping (+{{ fmt(giftWrapPrice) }})</span>
                </label>
                <div v-if="giftWrap" style="margin-top:.75rem;">
                  <input class="input" type="text" v-model="giftMessage" placeholder="Gift message (optional)" maxlength="200" />
                </div>
              </template>
            </div>

            <!-- Charity Donation -->
            <div class="charity-section" v-if="charityCampaign">
              <h3 class="sub-section" style="margin-top:1.25rem;">💝 Donate to {{ charityCampaign.name }}</h3>
              <p class="charity-desc" v-if="charityCampaign.description">{{ charityCampaign.description }}</p>
              <!-- Roundup mode -->
              <div v-if="charityCampaign.mode === 'roundup'" class="charity-roundup">
                <label class="gift-wrap-toggle">
                  <input type="checkbox" v-model="donateRoundup" @change="updateDonationRoundup" />
                  <span>Round up my order to <strong>{{ fmt(roundupTarget) }}</strong> (+{{ fmt(roundupAmount) }})</span>
                </label>
              </div>
              <!-- Fixed mode -->
              <div v-else-if="charityCampaign.mode === 'fixed'" class="charity-fixed">
                <div class="charity-amounts">
                  <button v-for="amt in charityCampaign.fixed_amounts" :key="amt"
                    class="charity-amt-btn"
                    :class="{ active: donationAmount === amt }"
                    @click="donationAmount = donationAmount === amt ? 0 : amt">
                    {{ fmt(amt) }}
                  </button>
                  <button class="charity-amt-btn" :class="{ active: donationAmount === 0 }" @click="donationAmount = 0">
                    None
                  </button>
                </div>
              </div>
              <!-- Custom mode -->
              <div v-else-if="charityCampaign.mode === 'custom'" class="charity-custom">
                <div class="input-with-prefix">
                  <span class="prefix">{{ currency }}</span>
                  <input type="number" v-model.number="donationAmount" min="0" step="0.5" class="input" placeholder="0.00" />
                </div>
              </div>
            </div>

            <!-- Order Bumps -->
            <div class="order-bumps-section" v-if="orderBumps.length">
              <h3 class="sub-section">🎁 Special Add-On Offers</h3>
              <div class="order-bump-card glass-sm" v-for="bump in orderBumps" :key="bump.id">
                <label class="bump-label">
                  <input type="checkbox" v-model="selectedBumps[bump.id]" @change="onBumpChange(bump)" />
                  <img v-if="bump.cover_image" :src="API_URL + bump.cover_image" class="bump-img" />
                  <div class="bump-info">
                    <div class="bump-headline">{{ bump.headline }}</div>
                    <div class="bump-sub" v-if="bump.subtext">{{ bump.subtext }}</div>
                    <div class="bump-product">{{ bump.product_name }}</div>
                  </div>
                  <div class="bump-price">
                    <span class="bump-new-price">{{ bump.currency_symbol }}{{ bump.price.toFixed(2) }}</span>
                    <span class="bump-old-price" v-if="bump.discount_pct > 0">{{ bump.currency_symbol }}{{ bump.original_price.toFixed(2) }}</span>
                    <span class="bump-badge" v-if="bump.discount_pct > 0">{{ bump.discount_pct }}% off</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="field-error global-error" v-if="submitError">{{ submitError }}</div>

            <div class="step-actions">
              <button class="btn btn-ghost" @click="step = 2">← Back</button>
              <button class="btn btn-primary btn-xl place-btn" @click="placeOrder" :disabled="placing">
                <span v-if="placing">Placing order…</span>
                <span v-else>Place Order · {{ fmt(orderTotal) }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Right: sticky order summary -->
        <div class="order-summary">
          <div class="glass summary-card">
            <h2 class="summary-title">Order Summary</h2>
            <div class="summary-items">
              <div class="summary-item" v-for="item in cart.items" :key="item.cart_key || item.product_id">
                <div class="summary-item-img">
                  <img v-if="item.cover_image" :src="item.cover_image" :alt="item.name" />
                  <div v-else class="img-placeholder">🛍️</div>
                </div>
                <div class="summary-item-info">
                  <span class="summary-item-name">{{ item.name }}</span>
                  <span class="summary-item-meta text-muted" v-if="item.variant_label">{{ item.variant_label }}</span>
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
            <div class="summary-row discount-row" v-if="loyaltyApplied && loyaltyDiscount > 0">
              <span class="text-muted">🏆 Points</span>
              <span style="color:hsl(140,60%,60%);">−{{ fmt(loyaltyDiscount) }}</span>
            </div>
            <div class="summary-row discount-row" v-if="appliedGiftCard && giftCardDiscount > 0">
              <span class="text-muted">🎁 {{ appliedGiftCard.code }}</span>
              <span style="color:hsl(140,60%,60%);">−{{ fmt(giftCardDiscount) }}</span>
            </div>
            <div class="summary-row discount-row" v-if="storeCreditApplied > 0">
              <span class="text-muted">💳 Store Credit</span>
              <span style="color:hsl(140,60%,60%);">−{{ fmt(storeCreditApplied) }}</span>
            </div>
            <div class="summary-row discount-row" v-if="autoDiscountTotal > 0">
              <span class="text-muted">⚡ Auto Discount
                <span v-if="autoDiscountApplied.length" class="auto-disc-labels">({{ autoDiscountApplied.map(a => a.name).join(', ') }})</span>
              </span>
              <span style="color:hsl(140,60%,60%);">−{{ fmt(autoDiscountTotal) }}</span>
            </div>
            <div class="summary-row" v-if="giftWrap && giftWrapPrice > 0">
              <span class="text-muted">🎀 Gift Wrap</span>
              <span>+{{ fmt(giftWrapPrice) }}</span>
            </div>
            <div class="summary-row" v-if="donationAmount > 0 && charityCampaign">
              <span class="text-muted">💝 {{ charityCampaign.name }}</span>
              <span style="color:hsl(340,70%,70%);">+{{ fmt(donationAmount) }}</span>
            </div>
            <div class="summary-row">
              <span class="text-muted">Shipping</span>
              <span v-if="selectedRate">
                <span v-if="selectedRate.free" style="color:hsl(140,60%,60%);">Free</span>
                <span v-else>{{ fmt(selectedRate.cost) }}</span>
              </span>
              <span class="text-muted" v-else>—</span>
            </div>
            <div class="summary-row" v-if="taxAmount > 0">
              <span class="text-muted">{{ taxRateName || 'Tax' }} ({{ taxRate }}%)</span>
              <span>{{ fmt(taxAmount) }}</span>
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { trackFunnelEvent } from '../composables/useTracking.js'
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

const steps = ['Contact', 'Shipping', 'Billing', 'Review & Pay']
const step  = ref(0)
const submitted = ref(false)
const placing   = ref(false)
const submitError = ref('')

// ── Contact form ──────────────────────────────────────────────────────────────
const form = reactive({
  customer_name:  '',
  customer_email: '',
  customer_phone: '',
  address1:       '',
  address2:       '',
  city:           '',
  postal_code:    '',
  state:          '',
  notes:          '',
})

// ── Billing address ───────────────────────────────────────────────────────────
const billingSame = ref(true)
const billing = reactive({
  name:        '',
  address1:    '',
  address2:    '',
  city:        '',
  postal_code: '',
  state:       '',
  country:     '',
})

// ── Errors ────────────────────────────────────────────────────────────────────
const errors = reactive({})

function touchName() {
  errors.customer_name = form.customer_name.trim() ? '' : 'Name is required.'
}
function touchEmail() {
  errors.customer_email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())
    ? '' : 'A valid email is required.'
}

function validateStep(n) {
  if (n === 0) {
    touchName(); touchEmail()
    return !errors.customer_name && !errors.customer_email
  }
  if (n === 1) {
    errors.address1 = form.address1.trim() ? '' : 'Address is required.'
    errors.city     = form.city.trim()     ? '' : 'City is required.'
    errors.country  = shippingCountry.value ? '' : 'Please select a country.'
    return !errors.address1 && !errors.city && !errors.country
  }
  if (n === 2 && !billingSame.value) {
    errors.billing_address1 = billing.address1.trim() ? '' : 'Billing address is required.'
    errors.billing_city     = billing.city.trim()     ? '' : 'Billing city is required.'
    errors.billing_country  = billing.country          ? '' : 'Please select a billing country.'
    return !errors.billing_address1 && !errors.billing_city && !errors.billing_country
  }
  return true
}

function goToStep(n) {
  if (validateStep(step.value)) step.value = n
}

// ── Shipping ──────────────────────────────────────────────────────────────────
const shippingCountry = ref('')
const shippingRates   = ref([])
const selectedRate    = ref(null)
const loadingRates    = ref(false)

// ── Tax ───────────────────────────────────────────────────────────────────────
const taxAmount   = ref(0)
const taxRateName = ref('')
const taxRate     = ref(0)

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
  await calculateTax()
}

async function calculateTax() {
  taxAmount.value = 0; taxRateName.value = ''; taxRate.value = 0
  if (!shippingCountry.value) return
  try {
    const { data } = await api.post('/tax-rates/calculate', {
      country: shippingCountry.value,
      subtotal: cart.subtotal - (appliedCoupon.value?.discount || 0),
    })
    taxAmount.value = data.tax_amount || 0
    taxRateName.value = data.name || ''
    taxRate.value = data.rate || 0
  } catch {}
}

const shippingCost = computed(() => (selectedRate.value && !selectedRate.value.free) ? selectedRate.value.cost : 0)

// ── Coupons ───────────────────────────────────────────────────────────────────
const couponInput    = ref('')
const applyingCoupon = ref(false)
const couponError    = ref('')
const appliedCoupon  = ref(null)

async function applyCoupon() {
  couponError.value = ''
  const code = couponInput.value.trim()
  if (!code) return
  applyingCoupon.value = true
  try {
    const { data } = await api.post('/coupons/validate', { code, subtotal: cart.subtotal })
    appliedCoupon.value = data
  } catch (err) {
    couponError.value = err.response?.data?.error || 'Invalid coupon code.'
    appliedCoupon.value = null
  } finally {
    applyingCoupon.value = false
  }
}
function removeCoupon() { appliedCoupon.value = null; couponInput.value = ''; couponError.value = '' }

// ── Gift Cards ────────────────────────────────────────────────────────────────
const giftCardsEnabled = ref(false)
const giftCardInput    = ref('')
const applyingGC       = ref(false)
const gcError          = ref('')
const appliedGiftCard  = ref(null)
const giftCardDiscount = ref(0)

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
function removeGiftCard() { appliedGiftCard.value = null; giftCardDiscount.value = 0; gcError.value = '' }

// ── Loyalty ───────────────────────────────────────────────────────────────────
const loyaltyBalance        = ref(0)
const loyaltyEnabled        = ref(false)
const loyaltyMinRedeem      = ref(100)
const loyaltyRedemptionRate = ref(100)
const loyaltyPointsInput    = ref(0)
const loyaltyDiscount       = ref(0)
const loyaltyError          = ref('')
const loyaltyApplied        = ref(false)

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
  loyaltyDiscount.value = 0; loyaltyApplied.value = false
  loyaltyPointsInput.value = 0; loyaltyError.value = ''
}

// ── Store Credit ──────────────────────────────────────────────────────────────
const storeCreditEnabled = ref(false)
const storeCreditBalance = ref(0)
const storeCreditInput   = ref(0)
const storeCreditApplied = ref(0)

function applyStoreCredit() {
  const amt = Math.min(Math.max(0, parseFloat(storeCreditInput.value) || 0), storeCreditBalance.value)
  if (amt <= 0) return
  storeCreditApplied.value = amt
}
function removeStoreCredit() { storeCreditApplied.value = 0; storeCreditInput.value = 0 }

// ── Gift Wrap ─────────────────────────────────────────────────────────────────
const giftWrapEnabled = ref(false)
const giftWrapPrice   = ref(5)
const giftWrap        = ref(false)

// Charity donation
const charityCampaign = ref(null)
const donationAmount  = ref(0)
const donateRoundup   = ref(false)
const currency        = ref('€')
const giftMessage     = ref('')

// ── Auto Discounts (BOGO / Buy X Get Y) ──────────────────────────────────────
const autoDiscountApplied  = ref([])
const autoDiscountTotal    = ref(0)
const autoDiscountLoading  = ref(false)

async function evaluateAutoDiscounts () {
  if (!cart.items?.length) { autoDiscountApplied.value = []; autoDiscountTotal.value = 0; return }
  autoDiscountLoading.value = true
  try {
    const res = await fetch('/api/auto-discounts/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price || i.price })),
        subtotal: cart.subtotal
      })
    })
    const data = await res.json()
    autoDiscountApplied.value = data.applied || []
    autoDiscountTotal.value   = data.total_discount || 0
  } catch { /* silent */ }
  autoDiscountLoading.value = false
}

// ── Total ─────────────────────────────────────────────────────────────────────
const baseOrderTotal = computed(() =>
  Math.max(0, cart.subtotal - (appliedCoupon.value?.discount || 0) - loyaltyDiscount.value - giftCardDiscount.value - storeCreditApplied.value - autoDiscountTotal.value + shippingCost.value + taxAmount.value + (giftWrap.value ? giftWrapPrice.value : 0))
)
const roundupTarget = computed(() => Math.ceil(baseOrderTotal.value))
const roundupAmount = computed(() => Math.max(0, roundupTarget.value - baseOrderTotal.value))
const orderTotal = computed(() => baseOrderTotal.value + (donationAmount.value || 0))

function updateDonationRoundup() {
  donationAmount.value = donateRoundup.value ? roundupAmount.value : 0
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v) {
  const sym      = site.settings?.shop_currency_symbol || '€'
  const currency = site.settings?.shop_currency || 'EUR'
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(v || 0)
  } catch {
    return `${sym}${Number(v || 0).toFixed(2)}`
  }
}

function formatShippingAddress() {
  const parts = [
    form.address1,
    form.address2,
    [form.city, form.state, form.postal_code].filter(Boolean).join(' '),
    countryList.find(c => c.code === shippingCountry.value)?.name || shippingCountry.value,
  ].filter(Boolean)
  return parts.join('\n')
}

function formatBillingAddress() {
  const parts = [
    billing.name,
    billing.address1,
    billing.address2,
    [billing.city, billing.state, billing.postal_code].filter(Boolean).join(' '),
    countryList.find(c => c.code === billing.country)?.name || billing.country,
  ].filter(Boolean)
  return parts.join('\n')
}

function buildShippingAddressString() {
  const parts = [form.address1, form.address2, form.city, form.state, form.postal_code,
    countryList.find(c => c.code === shippingCountry.value)?.name || shippingCountry.value]
  return parts.filter(Boolean).join(', ')
}

function buildBillingAddressString() {
  if (billingSame.value) return null
  const parts = [billing.name, billing.address1, billing.address2, billing.city, billing.state, billing.postal_code,
    countryList.find(c => c.code === billing.country)?.name || billing.country]
  return parts.filter(Boolean).join(', ')
}

// ── Mount ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Track funnel: checkout_start
  trackFunnelEvent('checkout_start')
  try {
    const { data } = await api.get('/settings')
    giftCardsEnabled.value    = data.gift_cards_enabled === '1'
    storeCreditEnabled.value  = data.store_credit_enabled === '1'
    giftWrapEnabled.value     = data.gift_wrap_enabled === '1'
    giftWrapPrice.value       = parseFloat(data.gift_wrap_price || '5')
    currency.value            = data.shop_currency_symbol || '€'
  } catch {}
  // Load charity campaign
  try {
    const { data: cc } = await api.get('/charity/active')
    charityCampaign.value = cc
  } catch {}
  // Evaluate auto discounts on load
  evaluateAutoDiscounts()

  if (customer.isLoggedIn && customer.customer) {
    const c = customer.customer
    if (!form.customer_name) form.customer_name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
    if (!form.customer_email) form.customer_email = c.email || ''
    if (!form.customer_phone) form.customer_phone = c.phone || ''
    // Load default saved address
    try {
      const res = await api.get('/customers/me/addresses', { headers: { Authorization: `Bearer ${customer.token}` } })
      const defaultAddr = (res.data || []).find(a => a.is_default) || res.data?.[0]
      if (defaultAddr && !form.address1) {
        form.address1    = defaultAddr.address1 || ''
        form.address2    = defaultAddr.address2 || ''
        form.city        = defaultAddr.city || ''
        form.state       = defaultAddr.state || ''
        form.postal_code = defaultAddr.zip || ''
        if (defaultAddr.country) shippingCountry.value = defaultAddr.country
      }
    } catch {}
    // Load loyalty balance
    try {
      const res = await api.get('/loyalty/balance', { headers: { Authorization: `Bearer ${customer.token}` } })
      loyaltyBalance.value  = res.data.balance || 0
      loyaltyEnabled.value  = res.data.loyalty_enabled || false
      loyaltyMinRedeem.value = res.data.min_redeem || 100
      loyaltyRedemptionRate.value = res.data.redemption_rate || 100
    } catch {}
    // Load store credit balance
    if (storeCreditEnabled.value) {
      try {
        const res = await fetch('/api/store-credit/me', { headers: { Authorization: `Bearer ${customer.token}` } })
        if (res.ok) { const d = await res.json(); storeCreditBalance.value = d.balance || 0 }
      } catch {}
    }
  }
})

// ── Place Order ───────────────────────────────────────────────────────────────
// ── Order Bumps ───────────────────────────────────────────────────────────────
const orderBumps   = ref([])
const selectedBumps = ref({})
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3200'

async function loadOrderBumps() {
  try {
    const { data } = await api.get('/order-bumps/active')
    orderBumps.value = data || []
  } catch { orderBumps.value = [] }
}

function onBumpChange(bump) {
  if (selectedBumps.value[bump.id]) {
    // Track conversion
    api.post(`/order-bumps/${bump.id}/convert`).catch(() => {})
  }
}

// Load bumps when user reaches step 3
watch(() => step.value, (s) => {
  if (s === 3 && !orderBumps.value.length) loadOrderBumps()
})

watch(() => cart.items, () => evaluateAutoDiscounts(), { deep: true })

async function placeOrder() {
  submitError.value = ''
  placing.value = true
  try {
    const shippingAddressStr = buildShippingAddressString()
    const billingAddressStr  = buildBillingAddressString()

    // Include selected bumps as additional items
    const bumpItems = orderBumps.value
      .filter(b => selectedBumps.value[b.id])
      .map(b => ({ product_id: b.product_id, quantity: 1, unit_price: b.price, name: b.product_name }))

    const allItems = [...cart.items, ...bumpItems]
    const bumpSubtotal = bumpItems.reduce((s, i) => s + i.unit_price, 0)

    const payload = {
      customer_name:          form.customer_name.trim(),
      customer_email:         form.customer_email.trim().toLowerCase(),
      customer_phone:         form.customer_phone.trim(),
      shipping_address:       shippingAddressStr,
      billing_address:        billingAddressStr,
      billing_same_as_shipping: billingSame.value ? 1 : 0,
      notes:                  form.notes.trim(),
      items: allItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      subtotal:               cart.subtotal + bumpSubtotal,
      total:                  orderTotal.value + bumpSubtotal,
      coupon_code:            appliedCoupon.value?.code || '',
      shipping_country:       shippingCountry.value || '',
      shipping_rate_name:     selectedRate.value?.name || '',
      shipping_cost:          shippingCost.value,
      tax_amount:             taxAmount.value,
      tax_rate_name:          taxRateName.value,
      redeem_points:          loyaltyApplied.value ? (parseInt(loyaltyPointsInput.value) || 0) : 0,
      gift_card_code:         appliedGiftCard.value?.code || '',
      affiliate_code:         getActiveCode() || '',
      store_credit_amount:    storeCreditApplied.value || 0,
      gift_wrap:              giftWrap.value ? 1 : 0,
      gift_message:           giftMessage.value.trim(),
      auto_discount_amount:   autoDiscountTotal.value || 0,
      donation_amount:        donationAmount.value || 0,
      donation_campaign_id:   charityCampaign.value?.id || null,
    }

    const headers = customer.isLoggedIn ? { Authorization: `Bearer ${customer.token}` } : {}
    const { data } = await api.post('/orders', payload, { headers })
    // Record auto-discount uses
    if (autoDiscountApplied.value.length) {
      fetch('/api/auto-discounts/record-use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_ids: autoDiscountApplied.value.map(a => a.rule_id) })
      }).catch(() => {})
    }
    cart.markRecovered()
    cart.clear()
    clearReferral()
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
.checkout-page .container { max-width: 1060px; }

.empty-cart {
  text-align: center; padding: 3rem; border-radius: 1.25rem;
  max-width: 480px; margin: 5rem auto;
}

/* Layout */
.checkout-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 2rem;
  align-items: start;
}
@media (max-width: 768px) {
  .checkout-layout { grid-template-columns: 1fr; }
  .order-summary { order: -1; }
}

/* Step Progress */
.step-progress {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  border-radius: 1rem;
  margin-bottom: 1.25rem;
  gap: 0;
}
.step-item {
  display: flex;
  align-items: center;
  gap: .5rem;
  flex: 1;
  cursor: default;
  min-width: 0;
}
.step-item.done { cursor: pointer; }
.step-circle {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: .75rem; font-weight: 700; flex-shrink: 0;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.15);
  color: var(--muted);
  transition: all .2s;
}
.step-item.active .step-circle {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.step-item.done .step-circle {
  background: hsl(140,60%,25%);
  border-color: hsl(140,60%,40%);
  color: hsl(140,60%,70%);
}
.step-label {
  font-size: .8rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.step-item.active .step-label { color: var(--text); }
.step-item.done .step-label { color: hsl(140,60%,65%); }
.step-line {
  flex: 1; height: 1px;
  background: rgba(255,255,255,.1);
  margin: 0 .5rem;
}

/* Step Card */
.step-card {
  padding: 2rem;
  border-radius: 1.25rem;
}
.step-title {
  font-size: 1.35rem; font-weight: 700; margin: 0 0 1.25rem;
}
.step-intro { margin: -.75rem 0 1.25rem; font-size: .9rem; }
.step-actions {
  display: flex; gap: .75rem; justify-content: flex-end;
  margin-top: 1.5rem;
}

/* Fields */
.field-row-2 {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;
}
.field-row-3 {
  display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;
}
@media (max-width: 500px) {
  .field-row-2, .field-row-3 { grid-template-columns: 1fr; }
}
.field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.req { color: var(--accent); }
.field-error { color: var(--accent); font-size: .8rem; }
.global-error {
  background: rgba(var(--accent-rgb),.12); border: 1px solid rgba(var(--accent-rgb),.3);
  border-radius: .5rem; padding: .65rem .875rem; margin-bottom: 1rem;
}
.sub-section {
  font-size: .9rem; font-weight: 700; color: var(--accent); margin: 0 0 .75rem;
}

/* Billing same toggle */
.same-toggle {
  display: flex; align-items: center; gap: .75rem;
  cursor: pointer; margin-bottom: 1.25rem;
  font-size: .92rem;
}
.toggle-checkbox {
  width: 40px; height: 22px; border-radius: 99px;
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.15);
  position: relative; transition: background .2s;
  flex-shrink: 0;
}
.toggle-checkbox.checked {
  background: var(--accent);
  border-color: var(--accent);
}
.toggle-dot {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
.toggle-checkbox.checked .toggle-dot { transform: translateX(18px); }
.billing-fields { margin-top: .25rem; }
.billing-same-preview {
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  border-radius: .75rem; padding: .875rem 1rem; font-size: .875rem;
  line-height: 1.7; margin-bottom: 1.25rem; white-space: pre-line;
}

/* Review grid */
.review-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: .75rem; margin-bottom: 1.5rem;
}
@media (max-width: 540px) { .review-grid { grid-template-columns: 1fr; } }
.review-section {
  border-radius: .75rem; padding: .875rem 1rem; font-size: .875rem;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
}
.review-section-header {
  font-size: .8rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: var(--muted); margin-bottom: .5rem;
  display: flex; align-items: center; justify-content: space-between;
}
.btn-edit {
  background: none; border: none; color: var(--accent);
  font-size: .75rem; cursor: pointer; padding: 0;
  text-decoration: underline;
}
.review-line { margin-bottom: .15rem; line-height: 1.5; }

/* Discounts section */
.discounts-section { margin-top: 1.25rem; }
.coupon-row { display: flex; gap: .5rem; align-items: center; margin-bottom: .5rem; }
.coupon-input { flex: 1; text-transform: uppercase; letter-spacing: .06em; }
.coupon-success {
  font-size: .85rem; color: hsl(140,60%,60%);
  background: hsl(140,60%,8%); border: 1px solid hsl(140,60%,18%);
  border-radius: .5rem; padding: .45rem .75rem; margin-bottom: .75rem;
}
.coupon-error { font-size: .82rem; color: var(--accent); margin-bottom: .75rem; }
.loyalty-balance-info {
  font-size: .85rem; color: var(--text-muted); margin-bottom: .75rem;
  padding: .4rem .75rem;
  background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.25); border-radius: .5rem;
}

.gift-wrap-toggle {
  display: flex; align-items: center; gap: .6rem; cursor: pointer;
  font-size: .9rem; color: var(--text);
}
.gift-wrap-toggle input[type="checkbox"] { width: 1.1rem; height: 1.1rem; accent-color: var(--accent); }

/* Place button */
.place-btn { font-size: 1rem; min-width: 220px; }
.btn-xl { padding: .9rem 2rem; font-size: 1rem; }

/* Shipping */
.shipping-rates { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
.shipping-option {
  display: flex; align-items: center; gap: .75rem;
  padding: .7rem 1rem; border-radius: .625rem;
  border: 1px solid rgba(255,255,255,.1);
  cursor: pointer; transition: border-color .2s, background .2s;
}
.shipping-option:hover { border-color: rgba(255,255,255,.2); }
.shipping-option.selected { border-color: var(--accent); background: rgba(var(--accent-rgb),.08); }
.shipping-option input[type="radio"] { accent-color: var(--accent); width: 16px; height: 16px; }
.rate-name { flex: 1; font-size: .92rem; }
.rate-cost { font-weight: 700; font-size: .92rem; }
.shipping-note { margin-bottom: 1rem; }

/* Summary */
.summary-card {
  padding: 1.5rem; border-radius: 1.25rem;
  position: sticky; top: 5rem;
}
.summary-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.25rem; }
.summary-items { display: flex; flex-direction: column; gap: .75rem; margin-bottom: .75rem; }
.summary-item {
  display: grid; grid-template-columns: 40px 1fr auto; gap: .625rem; align-items: center;
}
.summary-item-img {
  width: 40px; height: 40px; border-radius: .4rem; overflow: hidden;
  background: rgba(255,255,255,.06); display:flex;align-items:center;justify-content:center;
}
.summary-item-img img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder { font-size: 1.2rem; }
.summary-item-info { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
.summary-item-name { font-size: .88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.summary-item-meta { font-size: .78rem; }
.summary-item-total { font-size: .88rem; font-weight: 600; white-space: nowrap; }
.summary-divider { height: 1px; background: rgba(255,255,255,.08); margin: .875rem 0; }
.summary-row {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: .5rem; font-size: .9rem; margin-bottom: .4rem;
}
.summary-total { font-size: 1rem; margin-bottom: 0; }
.discount-row span:last-child { font-weight: 600; }

/* Charity */
.charity-section { margin-top: 1.25rem; }
.charity-desc { font-size: .85rem; color: #aaa; margin: .25rem 0 .75rem; }
.charity-amounts { display: flex; gap: .5rem; flex-wrap: wrap; }
.charity-amt-btn { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); border-radius: .6rem; padding: .4rem .9rem; color: white; cursor: pointer; font-size: .9rem; }
.charity-amt-btn.active { background: var(--accent); border-color: var(--accent); }
.charity-custom { display: flex; max-width: 160px; }
.input-with-prefix { display: flex; align-items: center; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; overflow: hidden; }
.prefix { padding: .65rem .75rem; color: #888; font-size: .9rem; }

/* Order Bumps */
.order-bumps-section { margin: 1.5rem 0 0; }
.order-bump-card { border-radius: 12px; margin-bottom: .75rem; padding: 1rem 1.25rem; border: 1px solid rgba(255,255,255,0.12); transition: border-color .2s; }
.order-bump-card:has(input:checked) { border-color: var(--accent); background: rgba(176,48,58,0.08); }
.bump-label { display: flex; align-items: center; gap: 1rem; cursor: pointer; width: 100%; }
.bump-label input[type="checkbox"] { width: 18px; height: 18px; flex-shrink: 0; accent-color: var(--accent); cursor: pointer; }
.bump-img { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
.bump-info { flex: 1; min-width: 0; }
.bump-headline { font-size: .95rem; font-weight: 700; color: #e2e2e8; }
.bump-sub { font-size: .82rem; color: #999; margin-top: .15rem; }
.bump-product { font-size: .8rem; color: #888; margin-top: .2rem; }
.bump-price { text-align: right; flex-shrink: 0; }
.bump-new-price { display: block; font-size: 1.1rem; font-weight: 700; color: #e2e2e8; }
.bump-old-price { display: block; font-size: .82rem; color: #888; text-decoration: line-through; }
.bump-badge { display: inline-block; background: rgba(76,175,80,0.2); color: #4caf50; border-radius: 20px; font-size: .75rem; font-weight: 700; padding: .1rem .5rem; margin-top: .2rem; }
</style>
