<template>
  <div class="gift-cards-page">
    <!-- Hero -->
    <section class="gc-hero glass">
      <div class="gc-hero-inner">
        <div class="gc-icon">🎁</div>
        <h1>Gift Cards</h1>
        <p class="gc-subtitle">Give the gift of choice. Send a gift card instantly — no wrapping required.</p>
      </div>
    </section>

    <!-- Unavailable state -->
    <div v-if="!enabled && !loading" class="gc-unavailable glass">
      <p>Gift cards are not currently available. Check back soon!</p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="gc-loading glass">
      <div class="loading-bar"></div>
    </div>

    <template v-else>
      <!-- Denomination picker -->
      <section class="gc-section">
        <h2>Select an Amount</h2>
        <div class="denom-grid">
          <button
            v-for="d in denominations"
            :key="d"
            :class="['denom-btn glass', { selected: selectedAmount === d }]"
            @click="selectAmount(d)"
          >
            {{ currencySymbol }}{{ d }}
          </button>
          <button
            :class="['denom-btn glass', { selected: customActive }]"
            @click="customActive = true; selectedAmount = null"
          >
            Custom
          </button>
        </div>

        <div v-if="customActive" class="custom-amount-row">
          <label>Custom amount ({{ currencySymbol }})</label>
          <input
            v-model.number="customAmount"
            type="number"
            min="1"
            step="0.01"
            class="input"
            placeholder="Enter amount"
            style="max-width:200px"
          />
        </div>
      </section>

      <!-- Recipient details -->
      <section class="gc-section glass gc-form-card">
        <h2>Recipient Details <span class="optional">(optional)</span></h2>

        <div class="form-row">
          <div class="form-group">
            <label>Recipient Name</label>
            <input v-model="form.recipient_name" class="input" placeholder="Jane Doe" />
          </div>
          <div class="form-group">
            <label>Recipient Email</label>
            <input v-model="form.recipient_email" class="input" type="email" placeholder="jane@example.com" />
            <small class="hint">If provided, they'll receive an email with the gift card code.</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>From (Your Name)</label>
            <input v-model="form.sender_name" class="input" placeholder="Your name" />
          </div>
          <div class="form-group">
            <label>Your Email <span style="color:var(--accent)">*</span></label>
            <input v-model="form.purchaser_email" class="input" type="email" placeholder="you@example.com" required />
            <small class="hint">We'll send your copy of the gift card code here.</small>
          </div>
        </div>

        <div class="form-group">
          <label>Personal Message <span class="optional">(optional)</span></label>
          <textarea
            v-model="form.message"
            class="input"
            rows="3"
            placeholder="Write a personal note…"
          ></textarea>
        </div>

        <div v-if="error" class="gc-error">{{ error }}</div>

        <div class="gc-checkout-row">
          <div class="gc-total" v-if="effectiveAmount">
            <span class="gc-total-label">Total:</span>
            <span class="gc-total-value accent">{{ currencySymbol }}{{ effectiveAmount.toFixed(2) }}</span>
          </div>
          <button
            class="btn btn-primary gc-buy-btn"
            :disabled="!canSubmit || submitting"
            @click="purchase"
          >
            {{ submitting ? 'Processing…' : '🎁 Purchase Gift Card' }}
          </button>
        </div>
      </section>

      <!-- Success state -->
      <div v-if="result" class="gc-success glass">
        <div class="gc-success-icon">🎉</div>
        <h2>Gift Card Purchased!</h2>
        <p>Your gift card has been created. Keep this code safe.</p>
        <div class="code-display">
          <span class="code-text">{{ result.code }}</span>
          <button class="btn btn-ghost btn-sm" @click="copyCode">{{ copied ? '✓ Copied' : 'Copy' }}</button>
        </div>
        <div class="gc-value">Value: <strong>{{ result.currency_symbol }}{{ result.value.toFixed(2) }}</strong></div>
        <p class="hint">Enter this code at checkout to redeem. A confirmation email has been sent.</p>
        <div class="gc-actions">
          <RouterLink to="/shop" class="btn btn-primary">Continue Shopping</RouterLink>
          <button class="btn btn-ghost" @click="reset">Buy Another</button>
        </div>
      </div>

      <!-- How it works -->
      <section class="gc-how glass">
        <h2>How It Works</h2>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-num">1</div>
            <div class="step-title">Choose an Amount</div>
            <div class="step-desc">Pick from our preset amounts or enter a custom value.</div>
          </div>
          <div class="step-card">
            <div class="step-num">2</div>
            <div class="step-title">Send Instantly</div>
            <div class="step-desc">The recipient gets an email with the code right away.</div>
          </div>
          <div class="step-card">
            <div class="step-num">3</div>
            <div class="step-title">Redeem at Checkout</div>
            <div class="step-desc">Enter the code during checkout to apply the discount.</div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const loading = ref(true)
const enabled = ref(false)
const denominations = ref([25, 50, 100])
const currencySymbol = ref('€')
const currency = ref('EUR')

const selectedAmount = ref(null)
const customActive = ref(false)
const customAmount = ref(null)

const form = ref({
  recipient_name: '',
  recipient_email: '',
  sender_name: '',
  purchaser_email: '',
  message: '',
})

const submitting = ref(false)
const error = ref('')
const result = ref(null)
const copied = ref(false)

const effectiveAmount = computed(() => {
  if (customActive.value) return customAmount.value || null
  return selectedAmount.value
})

const canSubmit = computed(() => {
  return effectiveAmount.value && effectiveAmount.value > 0 && form.value.purchaser_email?.includes('@')
})

function selectAmount(d) {
  selectedAmount.value = d
  customActive.value = false
  customAmount.value = null
}

async function purchase() {
  if (!canSubmit.value) return
  error.value = ''
  submitting.value = true

  try {
    const payload = {
      value: effectiveAmount.value,
      ...form.value,
    }
    const { data } = await api.post('/gift-cards/purchase', payload)
    result.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'Failed to purchase gift card. Please try again.'
  } finally {
    submitting.value = false
  }
}

async function copyCode() {
  if (!result.value?.code) return
  try {
    await navigator.clipboard.writeText(result.value.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {}
}

function reset() {
  result.value = null
  selectedAmount.value = null
  customActive.value = false
  customAmount.value = null
  form.value = { recipient_name: '', recipient_email: '', sender_name: '', purchaser_email: '', message: '' }
  error.value = ''
}

onMounted(async () => {
  try {
    const { data } = await api.get('/gift-cards/denominations')
    enabled.value = data.enabled ?? false
    denominations.value = data.denominations || [25, 50, 100]
    currencySymbol.value = data.currency_symbol || '€'
    currency.value = data.currency || 'EUR'
  } catch {
    enabled.value = false
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.gift-cards-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Hero */
.gc-hero {
  border-radius: 1.5rem;
  padding: 3rem 2rem;
  text-align: center;
}
.gc-hero-inner { max-width: 480px; margin: 0 auto; }
.gc-icon { font-size: 3rem; margin-bottom: 1rem; }
.gc-hero h1 { font-size: 2.25rem; font-weight: 800; margin: 0 0 0.75rem; }
.gc-subtitle { color: var(--text-muted); font-size: 1.05rem; line-height: 1.6; margin: 0; }

/* Sections */
.gc-section h2 { font-size: 1.15rem; font-weight: 700; margin: 0 0 1.25rem; }

/* Denominations */
.denom-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.denom-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 0.875rem;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: var(--text);
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.denom-btn:hover { background: rgba(255,255,255,0.1); }
.denom-btn.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.custom-amount-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.custom-amount-row label { font-size: 0.9rem; color: var(--text-muted); white-space: nowrap; }

/* Form card */
.gc-form-card { padding: 2rem; border-radius: 1.25rem; }
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
@media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }
.hint { font-size: 0.78rem; color: var(--text-muted); }
.optional { font-size: 0.78rem; color: var(--text-muted); font-weight: 400; }

.gc-error {
  background: rgba(213,60,60,0.12);
  border: 1px solid rgba(213,60,60,0.3);
  border-radius: 0.625rem;
  padding: 0.75rem 1rem;
  color: hsl(355,70%,65%);
  font-size: 0.88rem;
  margin-top: 0.5rem;
}

.gc-checkout-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.25rem;
  margin-top: 1.25rem;
  flex-wrap: wrap;
}
.gc-total-label { font-size: 0.9rem; color: var(--text-muted); margin-right: 0.4rem; }
.gc-total-value { font-size: 1.4rem; font-weight: 800; }
.accent { color: var(--accent); }
.gc-buy-btn { padding: 0.75rem 2rem; font-size: 1rem; }

/* Success */
.gc-success {
  border-radius: 1.5rem;
  padding: 2.5rem 2rem;
  text-align: center;
}
.gc-success-icon { font-size: 3rem; margin-bottom: 1rem; }
.gc-success h2 { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.5rem; }
.gc-success p { color: var(--text-muted); margin: 0 0 1.5rem; }
.code-display {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.875rem;
  padding: 0.875rem 1.25rem;
  margin-bottom: 0.75rem;
}
.code-text {
  font-family: monospace;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--accent);
}
.gc-value { font-size: 1rem; color: var(--text-muted); margin-bottom: 0.5rem; }
.gc-actions { display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }

/* How it works */
.gc-how { padding: 2rem; border-radius: 1.25rem; }
.gc-how h2 { font-size: 1.15rem; font-weight: 700; margin: 0 0 1.5rem; text-align: center; }
.steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
@media (max-width: 600px) { .steps-grid { grid-template-columns: 1fr; } }
.step-card { text-align: center; padding: 1.25rem; }
.step-num {
  width: 2.25rem; height: 2.25rem;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 0.75rem;
}
.step-title { font-weight: 700; margin-bottom: 0.4rem; }
.step-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.55; }

/* Unavailable / loading */
.gc-unavailable, .gc-loading { padding: 3rem; text-align: center; border-radius: 1.25rem; color: var(--text-muted); }
</style>
