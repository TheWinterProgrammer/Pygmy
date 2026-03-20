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
                <input class="input" type="email" v-model="form.customer_email" placeholder="jane@example.com" required />
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
              <span class="text-muted">Calculated on confirmation</span>
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
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '../stores/cart.js'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const cart = useCartStore()
const site = useSiteStore()
const router = useRouter()

const submitted = ref(false)
const placing   = ref(false)
const submitError = ref('')

// Coupon state
const couponInput    = ref('')
const applyingCoupon = ref(false)
const couponError    = ref('')
const appliedCoupon  = ref(null) // { code, type, value, discount }

const orderTotal = computed(() =>
  Math.max(0, cart.subtotal - (appliedCoupon.value?.discount || 0))
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
    }

    const { data } = await api.post('/orders', payload)
    cart.clear()
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
</style>
