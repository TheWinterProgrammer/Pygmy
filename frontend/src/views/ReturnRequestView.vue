<template>
  <div class="return-page">
    <SiteNav />
    <div class="return-wrap">
      <div class="return-card glass">
        <h1>↩️ Return Request</h1>
        <p class="intro">Submit a return or refund request for a recent order. We'll review it within 2–3 business days.</p>

        <!-- Success state -->
        <div class="success-state" v-if="submitted">
          <div class="success-icon">✅</div>
          <h2>Request Submitted</h2>
          <p>We've received your return request and sent a confirmation to <strong>{{ form.customer_email }}</strong>.</p>
          <p>Return reference: <span class="ref-badge">#{{ returnId }}</span></p>
          <div class="success-actions">
            <button class="btn btn-secondary" @click="reset">Submit Another</button>
            <router-link to="/order/lookup" class="btn btn-primary">Track Order</router-link>
          </div>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="submit">
          <div class="form-row">
            <label>Order Number *</label>
            <input v-model="form.order_number" placeholder="ORD-260101-0001" required />
          </div>
          <div class="form-row">
            <label>Email Address *</label>
            <input v-model="form.customer_email" type="email" placeholder="you@example.com" required />
          </div>
          <div class="form-row">
            <label>Reason for Return *</label>
            <select v-model="form.reason" required>
              <option value="">— Select a reason —</option>
              <option value="Item arrived damaged">Item arrived damaged</option>
              <option value="Wrong item received">Wrong item received</option>
              <option value="Item not as described">Item not as described</option>
              <option value="Changed my mind">Changed my mind</option>
              <option value="Item too large / too small">Item too large / too small</option>
              <option value="Quality not as expected">Quality not as expected</option>
              <option value="Duplicate order">Duplicate order</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-row">
            <label>Additional Notes</label>
            <textarea v-model="form.notes" rows="4" placeholder="Please describe the issue in more detail…"></textarea>
          </div>

          <div class="error-msg" v-if="error">{{ error }}</div>

          <button type="submit" class="btn btn-primary submit-btn" :disabled="loading">
            {{ loading ? 'Submitting…' : '↩️ Submit Return Request' }}
          </button>
        </form>
      </div>

      <!-- Info panels -->
      <div class="info-panels">
        <div class="info-panel glass">
          <div class="info-icon">📋</div>
          <h3>Return Policy</h3>
          <p>Returns are accepted within 30 days of delivery. Items must be in original condition.</p>
        </div>
        <div class="info-panel glass">
          <div class="info-icon">⏱️</div>
          <h3>Review Time</h3>
          <p>We review return requests within 2–3 business days and will contact you by email.</p>
        </div>
        <div class="info-panel glass">
          <div class="info-icon">💸</div>
          <h3>Refund Methods</h3>
          <p>Approved refunds are processed to the original payment method or as store credit.</p>
        </div>
      </div>
    </div>
    <SiteFooter />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../api.js'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const form = ref({
  order_number: '',
  customer_email: '',
  reason: '',
  notes: '',
})

const loading   = ref(false)
const submitted = ref(false)
const error     = ref('')
const returnId  = ref(null)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await api.post('/returns', form.value)
    returnId.value = data.id
    submitted.value = true
  } catch (err) {
    error.value = err.response?.data?.error || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

function reset() {
  form.value = { order_number: '', customer_email: '', reason: '', notes: '' }
  submitted.value = false
  error.value = ''
  returnId.value = null
}
</script>

<style scoped>
.return-page { min-height: 100vh; background: var(--bg); color: var(--text); display: flex; flex-direction: column; }
.return-wrap { flex: 1; max-width: 960px; margin: 2rem auto; padding: 0 1.5rem 4rem; width: 100%; box-sizing: border-box; }
.return-wrap h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: .25rem; }

.return-card { border-radius: 1.5rem; padding: 2.5rem; margin-bottom: 2rem; }
.intro { color: var(--text-muted); margin-bottom: 2rem; }

.form-row { margin-bottom: 1.1rem; }
.form-row label { display: block; font-size: .82rem; color: var(--text-muted); margin-bottom: .35rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.form-row input, .form-row select, .form-row textarea {
  width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  border-radius: .625rem; color: var(--text); padding: .625rem .875rem; font-size: .95rem;
  box-sizing: border-box; transition: border-color .15s;
}
.form-row input:focus, .form-row select:focus, .form-row textarea:focus {
  outline: none; border-color: var(--accent);
}
.form-row textarea { resize: vertical; }

.error-msg { background: hsl(355,70%,18%); color: hsl(355,70%,65%); padding: .6rem 1rem; border-radius: .5rem; font-size: .88rem; margin-bottom: 1rem; }

.submit-btn { width: 100%; padding: .75rem; font-size: 1rem; margin-top: .5rem; }

/* Success */
.success-state { text-align: center; padding: 1rem 0; }
.success-icon { font-size: 3rem; margin-bottom: 1rem; }
.success-state h2 { font-size: 1.5rem; margin-bottom: .5rem; }
.success-state p { color: var(--text-muted); margin-bottom: .5rem; }
.ref-badge { background: rgba(255,255,255,.1); border-radius: .4rem; padding: .15em .5em; font-family: monospace; }
.success-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }

/* Info panels */
.info-panels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.info-panel { border-radius: 1rem; padding: 1.5rem; text-align: center; }
.info-icon { font-size: 2rem; margin-bottom: .75rem; }
.info-panel h3 { margin: 0 0 .5rem; font-size: 1rem; }
.info-panel p { color: var(--text-muted); font-size: .875rem; margin: 0; line-height: 1.5; }

.btn { display: inline-flex; align-items: center; justify-content: center; padding: .55rem 1.5rem; border-radius: .625rem; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; text-decoration: none; transition: opacity .15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:disabled { opacity: .5; cursor: default; }
.btn-secondary { background: rgba(255,255,255,.1); color: var(--text); }

.glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); }

@media (max-width: 640px) {
  .info-panels { grid-template-columns: 1fr; }
  .return-card { padding: 1.5rem; }
}
</style>
