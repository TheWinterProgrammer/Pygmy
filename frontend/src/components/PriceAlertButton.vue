<template>
  <div class="price-alert-wrap">
    <!-- Already subscribed state -->
    <div v-if="subscribed" class="price-alert-subscribed">
      <span class="subscribed-icon">🔔</span>
      <span>We'll notify you if the price drops</span>
      <button class="btn-unsubscribe" @click="unsubscribe">Remove alert</button>
    </div>

    <!-- Form -->
    <div v-else-if="formOpen" class="price-alert-form glass">
      <div class="form-title">📉 Get notified of price drops</div>
      <div class="form-fields">
        <input
          v-model="form.email"
          class="input"
          type="email"
          placeholder="your@email.com"
          required
        />
        <input
          v-model="form.name"
          class="input"
          type="text"
          placeholder="Your name (optional)"
        />
        <div class="target-row">
          <label class="label">Notify me when price drops below</label>
          <div class="price-input-row">
            <span class="currency-symbol">{{ currencySymbol }}</span>
            <input
              v-model.number="form.target_price"
              class="input price-input"
              type="number"
              :placeholder="currentPrice.toFixed(2)"
              min="0"
              step="0.01"
            />
          </div>
          <span class="hint">Leave blank to be notified on any price drop</span>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" @click="formOpen = false">Cancel</button>
        <button class="btn-submit" @click="subscribe" :disabled="loading">
          {{ loading ? 'Setting up…' : '🔔 Notify Me' }}
        </button>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </div>

    <!-- Trigger button -->
    <button v-else class="btn-price-alert" @click="formOpen = true">
      📉 Alert me if price drops
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import api from '../api.js'

const props = defineProps({
  productId: { type: Number, required: true },
  currentPrice: { type: Number, default: 0 },
  currencySymbol: { type: String, default: '€' },
})

const formOpen = ref(false)
const subscribed = ref(false)
const loading = ref(false)
const error = ref('')

const form = ref({ email: '', name: '', target_price: null })

async function subscribe() {
  if (!form.value.email) { error.value = 'Email is required'; return }
  loading.value = true; error.value = ''
  try {
    await api.post('/price-alerts/subscribe', {
      product_id: props.productId,
      email: form.value.email,
      name: form.value.name || '',
      target_price: form.value.target_price || null,
    })
    subscribed.value = true
    formOpen.value = false
    // Store email in localStorage to persist the subscribed state
    const stored = JSON.parse(localStorage.getItem('pygmy_price_alerts') || '{}')
    stored[props.productId] = form.value.email
    localStorage.setItem('pygmy_price_alerts', JSON.stringify(stored))
  } catch (e) {
    error.value = e.response?.data?.error || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

async function unsubscribe() {
  const stored = JSON.parse(localStorage.getItem('pygmy_price_alerts') || '{}')
  const email = stored[props.productId]
  if (!email) { subscribed.value = false; return }
  try {
    await api.delete('/price-alerts/unsubscribe', { data: { product_id: props.productId, email } })
    delete stored[props.productId]
    localStorage.setItem('pygmy_price_alerts', JSON.stringify(stored))
    subscribed.value = false
  } catch {}
}

// Check if already subscribed (from localStorage)
const stored = JSON.parse(localStorage.getItem('pygmy_price_alerts') || '{}')
if (stored[props.productId]) {
  subscribed.value = true
}
</script>

<style scoped>
.price-alert-wrap { margin-top: 12px; }

.price-alert-subscribed {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: .82rem;
  color: var(--text-muted);
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 8px;
  padding: 8px 14px;
}
.subscribed-icon { font-size: 1rem; }
.btn-unsubscribe {
  background: none; border: none; color: var(--accent);
  cursor: pointer; font-size: .78rem; padding: 0 4px; text-decoration: underline;
}

.btn-price-alert {
  background: transparent;
  border: 1px solid rgba(255,255,255,.15);
  border-radius: 8px;
  padding: 8px 16px;
  color: var(--text-muted);
  font-size: .82rem;
  cursor: pointer;
  transition: .15s;
  font-family: inherit;
}
.btn-price-alert:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.price-alert-form {
  padding: 16px;
  border-radius: 1rem;
  margin-top: 8px;
  max-width: 400px;
}
.form-title { font-weight: 700; margin-bottom: 12px; }

.form-fields { display: flex; flex-direction: column; gap: 10px; }
.input {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: .5rem;
  padding: 8px 12px;
  color: var(--text);
  font-family: inherit;
  font-size: .85rem;
  width: 100%;
  box-sizing: border-box;
}
.input:focus { outline: none; border-color: var(--accent); }

.target-row { display: flex; flex-direction: column; gap: 4px; }
.label { font-size: .78rem; color: var(--text-muted); font-weight: 600; }
.price-input-row { display: flex; align-items: center; gap: 6px; }
.currency-symbol { color: var(--text-muted); font-weight: 600; }
.price-input { width: 120px; }
.hint { font-size: .72rem; color: var(--text-muted); }

.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
.btn-cancel {
  background: transparent; border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
  padding: 7px 14px; color: var(--text-muted); cursor: pointer; font-family: inherit; font-size: .82rem;
}
.btn-cancel:hover { border-color: rgba(255,255,255,.3); color: var(--text); }
.btn-submit {
  background: var(--accent); border: none; border-radius: 8px;
  padding: 7px 16px; color: #fff; font-weight: 700; cursor: pointer; font-family: inherit; font-size: .82rem;
}
.btn-submit:hover:not(:disabled) { opacity: .85; }
.btn-submit:disabled { opacity: .5; cursor: not-allowed; }
.form-error { color: var(--accent); font-size: .78rem; margin-top: 8px; }

.glass {
  background: var(--surface);
  border: 1px solid rgba(255,255,255,.08);
}
</style>
