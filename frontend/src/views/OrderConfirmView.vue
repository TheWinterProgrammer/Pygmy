<template>
  <div class="confirm-page">
    <div class="container">
      <!-- Loading -->
      <div class="confirm-card glass loading-card" v-if="loading">
        <div class="spinner"></div>
        <p class="text-muted">Loading your order…</p>
      </div>

      <!-- Not found -->
      <div class="confirm-card glass" v-else-if="!order">
        <div class="icon">❌</div>
        <h1>Order not found</h1>
        <p class="text-muted">We couldn't find order <strong>{{ route.params.orderNumber }}</strong>.</p>
        <RouterLink to="/" class="btn btn-primary" style="margin-top:1rem;">Go home</RouterLink>
      </div>

      <!-- Success -->
      <div class="confirm-card glass" v-else>
        <div class="icon">🎉</div>
        <h1>Order Confirmed!</h1>
        <p class="thank-you">{{ site.settings.shop_thankyou_message || 'Thank you for your order!' }}</p>

        <div class="order-ref">
          Order number: <strong class="order-num">{{ order.order_number }}</strong>
        </div>

        <!-- Items summary -->
        <div class="items-list">
          <div class="item-row" v-for="item in order.items" :key="item.product_id">
            <div class="item-thumb">
              <img v-if="item.cover_image" :src="item.cover_image" :alt="item.name" />
              <div v-else class="thumb-placeholder">🛍️</div>
            </div>
            <div class="item-name">{{ item.name }}</div>
            <div class="item-qty text-muted">× {{ item.quantity }}</div>
            <div class="item-total">{{ fmt(item.line_total) }}</div>
          </div>
        </div>

        <div class="total-row">
          <span>Total</span>
          <strong style="color:var(--accent);">{{ fmt(order.total) }}</strong>
        </div>

        <div class="confirm-meta text-muted">
          Placed on {{ fmtDate(order.created_at) }}
        </div>

        <!-- Digital downloads notice -->
        <div class="downloads-notice" v-if="order.has_digital">
          <div class="dl-icon">📥</div>
          <div class="dl-text">
            <div class="dl-title">Your downloads are ready!</div>
            <div class="dl-sub">Download links have been sent to your email. You can also access them anytime below.</div>
          </div>
          <RouterLink :to="`/order/downloads?order=${order.order_number}`" class="btn btn-primary btn-sm">View Downloads →</RouterLink>
        </div>

        <div class="confirm-actions">
          <RouterLink to="/shop" class="btn btn-primary">Continue Shopping</RouterLink>
          <RouterLink to="/account" class="btn btn-ghost">👤 My Account</RouterLink>
          <RouterLink to="/order/lookup" class="btn btn-ghost">📦 Track Order</RouterLink>
          <RouterLink to="/" class="btn btn-ghost">← Home</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const route = useRoute()
const site  = useSiteStore()

const order   = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const { data } = await api.get(`/orders/confirm/${route.params.orderNumber}`)
    order.value = data
  } catch {
    order.value = null
  } finally {
    loading.value = false
  }
})

function fmt(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<style scoped>
.confirm-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 5rem 0 3rem;
}

.confirm-card {
  max-width: 600px;
  margin: 0 auto;
  padding: 3rem 2rem;
  border-radius: 1.5rem;
  text-align: center;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(255,255,255,.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.icon { font-size: 4rem; margin-bottom: .5rem; }
h1 { font-size: 2rem; font-weight: 800; margin: 0 0 .5rem; }
.thank-you { color: var(--text-muted); margin: 0 0 1.5rem; font-size: 1rem; }

.order-ref {
  font-size: .95rem;
  color: var(--text-muted);
  margin-bottom: 1.75rem;
}
.order-num { color: var(--accent); font-size: 1.1rem; }

/* Items */
.items-list {
  display: flex;
  flex-direction: column;
  gap: .75rem;
  margin-bottom: 1rem;
  text-align: left;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: .75rem;
  padding: .875rem;
  background: rgba(255,255,255,.03);
}
.item-row {
  display: grid;
  grid-template-columns: 40px 1fr auto auto;
  gap: .625rem;
  align-items: center;
}
.item-thumb {
  width: 40px; height: 40px;
  border-radius: .4rem;
  overflow: hidden;
  background: rgba(255,255,255,.06);
  display: flex; align-items: center; justify-content: center;
}
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { font-size: 1.1rem; }
.item-name { font-size: .88rem; font-weight: 600; text-align: left; }
.item-qty { font-size: .82rem; }
.item-total { font-size: .88rem; font-weight: 600; }

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: .75rem .875rem;
  background: rgba(255,255,255,.04);
  border-radius: .5rem;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.confirm-meta {
  font-size: .82rem;
  margin-bottom: 1.75rem;
}

/* Downloads notice */
.downloads-notice {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  background: rgba(var(--accent-rgb, 213,60,60), 0.08);
  border: 1px solid rgba(var(--accent-rgb, 213,60,60), 0.25);
  border-radius: 0.75rem;
  padding: 1rem 1.125rem;
  margin: 1.25rem 0;
  text-align: left;
}
.dl-icon { font-size: 1.75rem; flex-shrink: 0; }
.dl-text { flex: 1; min-width: 0; }
.dl-title { font-size: 0.92rem; font-weight: 700; margin-bottom: 0.25rem; }
.dl-sub { font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; }

.confirm-actions {
  display: flex;
  gap: .75rem;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
