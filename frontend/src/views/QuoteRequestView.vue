<template>
  <div class="quote-request-page">
    <SiteNav />
    <main class="page-content">
      <div class="hero-section">
        <h1>{{ settings.quote_intro_title || 'Request a Quote' }}</h1>
        <p class="hero-sub">{{ settings.quote_intro_text || 'Get custom pricing for bulk orders or special requests.' }}</p>
      </div>

      <!-- Success state -->
      <div v-if="submitted" class="glass-card success-card">
        <div class="success-icon">✅</div>
        <h2>Quote Request Submitted!</h2>
        <p>Your reference number is <strong class="ref-pill">{{ submittedRef }}</strong></p>
        <p>We'll review your request and get back to you at <strong>{{ form.email }}</strong> within 1–2 business days.</p>
        <div class="success-actions">
          <button class="btn btn-outline" @click="checkStatus">Check Status</button>
          <router-link to="/shop" class="btn btn-ghost">Continue Shopping →</router-link>
        </div>
      </div>

      <!-- Status check -->
      <div v-else-if="statusResult" class="glass-card status-card">
        <div class="status-header">
          <h2>Quote {{ statusResult.reference }}</h2>
          <span class="status-pill" :class="statusResult.status">{{ statusResult.status }}</span>
        </div>
        <div v-if="statusResult.status === 'quoted'" class="quoted-info">
          <p>🎉 Your quote is ready!</p>
          <div class="amount-display">€{{ parseFloat(statusResult.quoted_amount || 0).toFixed(2) }}</div>
          <p v-if="statusResult.valid_until">Valid until: {{ formatDate(statusResult.valid_until) }}</p>
          <p v-if="statusResult.admin_notes" class="notes">{{ statusResult.admin_notes }}</p>
        </div>
        <div v-else-if="statusResult.status === 'rejected'" class="rejected-info">
          <p>Unfortunately we are unable to fulfill this request at this time.</p>
          <p v-if="statusResult.admin_notes" class="notes">{{ statusResult.admin_notes }}</p>
        </div>
        <div v-else class="pending-info">
          <p>Your request is currently <strong>{{ statusResult.status }}</strong>. We'll notify you when it's ready.</p>
        </div>
        <button class="btn btn-ghost" @click="statusResult = null; submitted = false">← Back to form</button>
      </div>

      <!-- Request Form -->
      <div v-else class="form-layout">
        <div class="glass-card quote-form">
          <h2>Your Details</h2>
          <div class="form-grid">
            <div class="form-group">
              <label>Name *</label>
              <input v-model="form.name" class="form-input" placeholder="Your full name" />
              <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
            </div>
            <div class="form-group">
              <label>Email *</label>
              <input v-model="form.email" type="email" class="form-input" placeholder="your@email.com" />
              <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input v-model="form.phone" class="form-input" placeholder="+1 234 567 890" />
            </div>
            <div class="form-group">
              <label>Company Name</label>
              <input v-model="form.company" class="form-input" placeholder="Your company (optional)" />
            </div>
          </div>

          <h2>Items Requested</h2>
          <p class="section-hint">Add the products you'd like to receive a quote for.</p>

          <div class="items-list">
            <div v-for="(item, i) in form.items" :key="i" class="item-row glass-row">
              <div class="item-fields">
                <input v-model="item.product_name" class="form-input" placeholder="Product name or description *" />
                <input v-model.number="item.qty" type="number" min="1" class="form-input qty-input" placeholder="Qty" />
                <input v-model="item.notes" class="form-input" placeholder="Notes (size, color, SKU...)" />
              </div>
              <button class="btn-remove" @click="removeItem(i)" v-if="form.items.length > 1">✕</button>
            </div>
          </div>
          <span v-if="errors.items" class="field-error">{{ errors.items }}</span>

          <button class="btn btn-outline add-item-btn" @click="addItem">+ Add Another Item</button>

          <div class="form-group mt">
            <label>Additional Notes</label>
            <textarea v-model="form.notes" class="form-input" rows="3" placeholder="Delivery requirements, budget range, timeline, special instructions..."></textarea>
          </div>

          <button class="btn btn-primary submit-btn" @click="submitForm" :disabled="submitting">
            {{ submitting ? 'Submitting...' : '📋 Submit Quote Request' }}
          </button>
          <p v-if="submitError" class="field-error submit-error">{{ submitError }}</p>
        </div>

        <!-- Status Check Sidebar -->
        <div class="glass-card status-check-card">
          <h3>Check Existing Quote</h3>
          <p class="status-hint">Already submitted a request? Check its status here.</p>
          <div class="form-group">
            <label>Reference Number</label>
            <input v-model="statusRef" class="form-input" placeholder="QTE-XXXXXXXX" />
          </div>
          <div class="form-group">
            <label>Your Email</label>
            <input v-model="statusEmail" type="email" class="form-input" placeholder="your@email.com" />
          </div>
          <button class="btn btn-outline" @click="checkStatus" :disabled="checkingStatus">
            {{ checkingStatus ? 'Checking...' : '🔍 Check Status' }}
          </button>
          <p v-if="statusError" class="field-error">{{ statusError }}</p>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useSiteStore } from '../stores/site.js'

const siteStore = useSiteStore()
const settings = ref({})

const submitted = ref(false)
const submittedRef = ref('')
const submitting = ref(false)
const submitError = ref('')

const statusRef = ref('')
const statusEmail = ref('')
const statusResult = ref(null)
const statusError = ref('')
const checkingStatus = ref(false)

const form = reactive({
  name: '', email: '', phone: '', company: '',
  notes: '',
  items: [{ product_name: '', qty: 1, notes: '' }]
})

const errors = reactive({})

function addItem () {
  form.items.push({ product_name: '', qty: 1, notes: '' })
}

function removeItem (i) {
  form.items.splice(i, 1)
}

function validate () {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.name.trim()) errors.name = 'Name is required'
  if (!form.email.trim()) errors.email = 'Email is required'
  const validItems = form.items.filter(i => i.product_name.trim())
  if (!validItems.length) errors.items = 'At least one item is required'
  return Object.keys(errors).length === 0
}

async function submitForm () {
  if (!validate()) return
  submitting.value = true
  submitError.value = ''
  try {
    const items = form.items.filter(i => i.product_name.trim()).map(i => ({
      product_name: i.product_name.trim(),
      qty: i.qty || 1,
      notes: i.notes
    }))
    const res = await fetch('/api/quote-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        company_name: form.company,
        notes: form.notes,
        items
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Submission failed')
    submittedRef.value = data.reference
    submitted.value = true
  } catch (e) {
    submitError.value = e.message
  } finally {
    submitting.value = false
  }
}

async function checkStatus () {
  const ref = statusRef.value.trim() || submittedRef.value
  const email = statusEmail.value.trim() || form.email
  if (!ref || !email) { statusError.value = 'Please enter your reference number and email'; return }
  checkingStatus.value = true
  statusError.value = ''
  try {
    const res = await fetch('/api/quote-requests/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: ref, email })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Not found')
    data.items = Array.isArray(data.items) ? data.items : JSON.parse(data.items || '[]')
    statusResult.value = data
    submitted.value = false
  } catch (e) {
    statusError.value = e.message
  } finally {
    checkingStatus.value = false
  }
}

function formatDate (d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

onMounted(async () => {
  await siteStore.ensureLoaded()
  settings.value = siteStore.settings || {}
})
</script>

<style scoped>
.quote-request-page { min-height: 100vh; background: var(--bg, hsl(228,4%,10%)); color: #fff; }
.page-content { max-width: 960px; margin: 0 auto; padding: 7rem 1.5rem 4rem; }

.hero-section { text-align: center; margin-bottom: 3rem; }
.hero-section h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: .75rem; }
.hero-sub { color: #aaa; font-size: 1.1rem; }

.glass-card { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; padding: 2rem; }

.form-layout { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; align-items: start; }
@media (max-width: 768px) { .form-layout { grid-template-columns: 1fr; } }

.quote-form h2 { font-size: 1.1rem; margin: 1.5rem 0 1rem; }
.quote-form h2:first-child { margin-top: 0; }
.section-hint { color: #888; font-size: .9rem; margin: -.5rem 0 1rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }

.form-group { margin-bottom: 1rem; }
.form-group.mt { margin-top: 1.5rem; }
.form-group label { display: block; font-size: .85rem; color: #aaa; margin-bottom: .35rem; }
.form-input { width: 100%; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; padding: .65rem 1rem; color: #fff; box-sizing: border-box; font-family: inherit; font-size: .95rem; }
.form-input:focus { outline: none; border-color: var(--accent, hsl(355,70%,58%)); }
textarea.form-input { resize: vertical; min-height: 80px; }
.field-error { display: block; color: #f87171; font-size: .8rem; margin-top: .35rem; }
.submit-error { margin-top: 1rem; font-size: .9rem; }

.items-list { display: flex; flex-direction: column; gap: .75rem; margin-bottom: 1rem; }
.item-row { display: flex; gap: .75rem; align-items: center; padding: 1rem; }
.glass-row { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 1rem; }
.item-fields { display: grid; grid-template-columns: 1fr 80px 1fr; gap: .75rem; flex: 1; }
@media (max-width: 600px) { .item-fields { grid-template-columns: 1fr; } }
.qty-input { text-align: center; }
.btn-remove { background: none; border: 1px solid rgba(239,68,68,.3); border-radius: .5rem; padding: .4rem .6rem; color: #f87171; cursor: pointer; white-space: nowrap; }

.add-item-btn { margin-bottom: 1rem; width: 100%; }

.btn { padding: .75rem 1.5rem; border-radius: .75rem; border: none; cursor: pointer; font-weight: 600; font-size: 1rem; text-decoration: none; display: inline-flex; align-items: center; gap: .5rem; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { background: var(--accent, hsl(355,70%,58%)); color: #fff; }
.btn-outline { background: transparent; border: 1px solid rgba(255,255,255,.2); color: #fff; }
.btn-ghost { background: transparent; color: #aaa; }
.submit-btn { width: 100%; justify-content: center; margin-top: .5rem; }

.status-check-card h3 { font-size: 1rem; margin-bottom: .5rem; }
.status-hint { color: #888; font-size: .85rem; margin-bottom: 1.25rem; }

/* Success & Status */
.success-card, .status-card { text-align: center; max-width: 550px; margin: 0 auto; }
.success-icon { font-size: 4rem; margin-bottom: 1rem; }
.success-card h2, .status-card h2 { font-size: 1.5rem; margin-bottom: .75rem; }
.ref-pill { background: rgba(255,255,255,.1); padding: .2rem .75rem; border-radius: 2rem; font-family: monospace; font-size: 1.1rem; }
.success-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }

.status-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.status-pill { padding: .25rem .75rem; border-radius: 2rem; font-size: .85rem; font-weight: 600; text-transform: capitalize; }
.status-pill.pending  { background: rgba(234,179,8,.15); color: #eab308; }
.status-pill.reviewing{ background: rgba(59,130,246,.15); color: #60a5fa; }
.status-pill.quoted   { background: rgba(168,85,247,.15); color: #c084fc; }
.status-pill.accepted { background: rgba(34,197,94,.15); color: #4ade80; }
.status-pill.rejected { background: rgba(239,68,68,.15); color: #f87171; }

.amount-display { font-size: 3rem; font-weight: 700; color: var(--accent); margin: 1rem 0; }
.notes { color: #aaa; font-style: italic; margin-top: .75rem; }
</style>
