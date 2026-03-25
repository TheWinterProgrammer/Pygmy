<template>
  <div class="dispute-view">
    <SiteNav />

    <main class="main-content">
      <div class="container">
        <!-- Header -->
        <div class="page-hero">
          <h1>⚖️ Order Disputes</h1>
          <p>Have an issue with your order? Open a dispute and our team will review it within 3 business days.</p>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button :class="['tab', tab === 'open' && 'active']" @click="tab = 'open'">Open a Dispute</button>
          <button :class="['tab', tab === 'track' && 'active']" @click="tab = 'track'">Track Dispute</button>
        </div>

        <!-- Open Dispute Form -->
        <div v-if="tab === 'open'" class="glass card-section">
          <h2 class="section-title">📋 Open a New Dispute</h2>

          <div v-if="submitted" class="success-state">
            <div class="success-icon">✅</div>
            <h3>Dispute Submitted</h3>
            <p>Your dispute reference is: <strong class="ref-code">{{ submitResult.reference }}</strong></p>
            <p>We'll review your case and respond within 3 business days. You can track the status using the reference above.</p>
            <button class="btn btn-ghost" @click="resetForm">Open Another Dispute</button>
            <button class="btn btn-primary" @click="lookupRef(submitResult.reference)">Track This Dispute →</button>
          </div>

          <form v-else @submit.prevent="submitDispute" class="dispute-form">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Order Number <span class="required">*</span></label>
                <input v-model="form.order_number" type="text" class="form-input" placeholder="ORD-250101-XXXX" required />
              </div>
              <div class="form-group">
                <label class="form-label">Email Address <span class="required">*</span></label>
                <input v-model="form.customer_email" type="email" class="form-input" placeholder="your@email.com" required />
              </div>
              <div class="form-group">
                <label class="form-label">Your Name</label>
                <input v-model="form.customer_name" type="text" class="form-input" placeholder="Full name" />
              </div>
              <div class="form-group">
                <label class="form-label">Reason <span class="required">*</span></label>
                <select v-model="form.reason" class="form-input" required>
                  <option value="">Select a reason…</option>
                  <option value="item_not_received">Item Not Received</option>
                  <option value="item_damaged">Item Arrived Damaged</option>
                  <option value="item_not_as_described">Item Not as Described</option>
                  <option value="wrong_item">Wrong Item Received</option>
                  <option value="quality_issue">Quality Issue</option>
                  <option value="refund_not_received">Refund Not Received</option>
                  <option value="duplicate_charge">Duplicate Charge</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description <span class="required">*</span></label>
              <textarea
                v-model="form.description"
                class="form-input"
                rows="5"
                placeholder="Please describe the issue in detail. Include any relevant information such as dates, quantities, or photos."
                required
              ></textarea>
              <span class="char-count">{{ form.description.length }} / 2000</span>
            </div>

            <div class="form-group">
              <label class="form-label">Evidence Links (optional)</label>
              <div class="evidence-list">
                <div v-for="(url, i) in form.evidence_urls" :key="i" class="evidence-item">
                  <input v-model="form.evidence_urls[i]" type="url" class="form-input" placeholder="https://..." />
                  <button type="button" class="btn-remove" @click="removeEvidence(i)">✕</button>
                </div>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" @click="addEvidence" v-if="form.evidence_urls.length < 5">
                + Add Link
              </button>
              <p class="hint">Add links to photos, screenshots, or other evidence (e.g. Google Drive, Dropbox).</p>
            </div>

            <div v-if="error" class="error-banner">{{ error }}</div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" :disabled="submitting">
                {{ submitting ? '⏳ Submitting…' : '⚖️ Submit Dispute' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Track Dispute -->
        <div v-if="tab === 'track'" class="glass card-section">
          <h2 class="section-title">🔍 Track Your Dispute</h2>

          <form @submit.prevent="lookupDispute" class="lookup-form">
            <div class="lookup-fields">
              <input v-model="lookup.order_number" type="text" class="form-input" placeholder="Order Number (ORD-XXXX)" required />
              <input v-model="lookup.email" type="email" class="form-input" placeholder="Email address" required />
              <button type="submit" class="btn btn-primary" :disabled="looking">
                {{ looking ? 'Looking…' : 'Track →' }}
              </button>
            </div>
            <div v-if="lookupError" class="error-banner mt-1">{{ lookupError }}</div>
          </form>

          <div v-if="foundDispute" class="dispute-result">
            <div class="dispute-card glass">
              <div class="dispute-header">
                <div>
                  <div class="dispute-ref">{{ foundDispute.reference }}</div>
                  <div class="dispute-order">Order: {{ foundDispute.order_number }}</div>
                </div>
                <span :class="['status-badge', `status-${foundDispute.status}`]">
                  {{ statusLabel(foundDispute.status) }}
                </span>
              </div>

              <div class="dispute-body">
                <div class="info-row">
                  <span class="info-label">Reason:</span>
                  <span>{{ reasonLabel(foundDispute.reason) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Submitted:</span>
                  <span>{{ formatDate(foundDispute.created_at) }}</span>
                </div>
                <div class="info-row" v-if="foundDispute.updated_at !== foundDispute.created_at">
                  <span class="info-label">Last Updated:</span>
                  <span>{{ formatDate(foundDispute.updated_at) }}</span>
                </div>
                <div class="info-row" v-if="foundDispute.description">
                  <span class="info-label">Description:</span>
                  <span class="description-text">{{ foundDispute.description }}</span>
                </div>
                <div class="resolution-box" v-if="foundDispute.resolution">
                  <h4>📩 Resolution from our team:</h4>
                  <p>{{ foundDispute.resolution }}</p>
                </div>
              </div>

              <div class="dispute-timeline">
                <div class="timeline-item">
                  <div class="tl-dot filled"></div>
                  <div class="tl-content">
                    <strong>Dispute Opened</strong>
                    <span>{{ formatDate(foundDispute.created_at) }}</span>
                  </div>
                </div>
                <div :class="['timeline-item', foundDispute.status === 'open' && 'inactive']">
                  <div :class="['tl-dot', foundDispute.status !== 'open' && 'filled']"></div>
                  <div class="tl-content">
                    <strong>Under Review</strong>
                    <span>Our team is reviewing your case</span>
                  </div>
                </div>
                <div :class="['timeline-item', !['resolved','rejected','closed'].includes(foundDispute.status) && 'inactive']">
                  <div :class="['tl-dot', ['resolved','rejected','closed'].includes(foundDispute.status) && 'filled']"></div>
                  <div class="tl-content">
                    <strong>{{ foundDispute.status === 'rejected' ? 'Dispute Rejected' : 'Resolved' }}</strong>
                    <span>{{ foundDispute.status === 'resolved' ? 'Case closed in your favor' : foundDispute.status === 'rejected' ? 'Dispute was not upheld' : 'Awaiting resolution' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- FAQ -->
        <div class="glass card-section faq-section">
          <h2 class="section-title">❓ Frequently Asked Questions</h2>
          <div class="faq-list">
            <details class="faq-item" v-for="(item, i) in faqs" :key="i">
              <summary class="faq-q">{{ item.q }}</summary>
              <p class="faq-a">{{ item.a }}</p>
            </details>
          </div>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'
import api from '../api.js'

const tab = ref('open')

// Open dispute form
const form = reactive({
  order_number: '',
  customer_email: '',
  customer_name: '',
  reason: '',
  description: '',
  evidence_urls: []
})
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')
const submitResult = ref(null)

function addEvidence () { form.evidence_urls.push('') }
function removeEvidence (i) { form.evidence_urls.splice(i, 1) }

async function submitDispute () {
  error.value = ''
  submitting.value = true
  try {
    const payload = { ...form, evidence_urls: form.evidence_urls.filter(u => u.trim()) }
    const { data } = await api.post('/disputes', payload)
    submitResult.value = data
    submitted.value = true
  } catch (e) {
    error.value = e.response?.data?.error || 'Failed to submit dispute. Please try again.'
  } finally {
    submitting.value = false
  }
}

function resetForm () {
  Object.assign(form, { order_number: '', customer_email: '', customer_name: '', reason: '', description: '', evidence_urls: [] })
  submitted.value = false
  submitResult.value = null
  error.value = ''
}

// Track dispute
const lookup = reactive({ order_number: '', email: '' })
const looking = ref(false)
const lookupError = ref('')
const foundDispute = ref(null)

async function lookupDispute () {
  lookupError.value = ''
  foundDispute.value = null
  looking.value = true
  try {
    const { data } = await api.get('/disputes/lookup', { params: { order_number: lookup.order_number, email: lookup.email } })
    foundDispute.value = data
  } catch (e) {
    lookupError.value = e.response?.data?.error || 'No dispute found for this order and email combination.'
  } finally {
    looking.value = false
  }
}

function lookupRef (ref) {
  tab.value = 'track'
  lookup.order_number = form.order_number || ''
  lookup.email = form.customer_email || ''
  foundDispute.value = submitResult.value
}

// Helpers
function statusLabel (s) {
  const map = { open: 'Open', under_review: 'Under Review', resolved: 'Resolved', rejected: 'Rejected', closed: 'Closed' }
  return map[s] || s
}
function reasonLabel (r) {
  const map = {
    item_not_received: 'Item Not Received',
    item_damaged: 'Item Arrived Damaged',
    item_not_as_described: 'Item Not as Described',
    wrong_item: 'Wrong Item Received',
    quality_issue: 'Quality Issue',
    refund_not_received: 'Refund Not Received',
    duplicate_charge: 'Duplicate Charge',
    other: 'Other'
  }
  return map[r] || r
}
function formatDate (d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const faqs = [
  { q: 'How long does it take to resolve a dispute?', a: 'Our team reviews all disputes within 3 business days. Complex cases may take up to 7 business days.' },
  { q: 'What evidence should I provide?', a: 'Photos of damaged or wrong items, screenshots of any relevant conversations, and tracking information if available.' },
  { q: 'Can I open a dispute for any order?', a: 'Yes, disputes can be opened for any order. However, disputes for orders older than 90 days may have limited options.' },
  { q: 'What happens after my dispute is resolved?', a: 'If resolved in your favor, refunds are typically processed within 5-10 business days depending on your payment method.' },
  { q: 'Can I have multiple disputes open at once?', a: 'Only one dispute per order can be open at a time.' }
]
</script>

<style scoped>
.dispute-view { min-height: 100vh; display: flex; flex-direction: column; }
.main-content { flex: 1; padding: 2rem 0; }
.container { max-width: 800px; margin: 0 auto; padding: 0 1.5rem; }

.page-hero {
  text-align: center;
  padding: 3rem 0 2rem;
}
.page-hero h1 { font-size: 2.4rem; margin-bottom: 0.75rem; }
.page-hero p { color: rgba(255,255,255,0.6); font-size: 1.1rem; }

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}
.tab {
  padding: 0.6rem 1.5rem;
  border: 1px solid rgba(255,255,255,0.15);
  background: transparent;
  color: rgba(255,255,255,0.6);
  border-radius: 2rem;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
}
.tab.active, .tab:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.card-section {
  padding: 2rem;
  margin-bottom: 1.5rem;
  border-radius: 1.5rem;
}

.section-title { font-size: 1.25rem; margin-bottom: 1.5rem; }

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
@media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }

.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-label { font-size: 0.9rem; color: rgba(255,255,255,0.7); font-weight: 500; }
.required { color: var(--accent); }
.form-input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  color: #fff;
  padding: 0.6rem 0.9rem;
  border-radius: 0.6rem;
  font-size: 0.95rem;
  width: 100%;
}
.form-input:focus { outline: none; border-color: var(--accent); }
textarea.form-input { resize: vertical; }
select.form-input { cursor: pointer; }
.char-count { font-size: 0.75rem; color: rgba(255,255,255,0.4); text-align: right; }

.evidence-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }
.evidence-item { display: flex; gap: 0.5rem; align-items: center; }
.btn-remove {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  padding: 0.4rem 0.6rem;
  border-radius: 0.4rem;
  cursor: pointer;
  white-space: nowrap;
}
.hint { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin: 0.25rem 0 0; }

.btn { padding: 0.7rem 1.5rem; border-radius: 0.75rem; border: none; cursor: pointer; font-size: 0.95rem; font-weight: 600; transition: all 0.2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-ghost { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); }
.btn-ghost:hover { background: rgba(255,255,255,0.12); }
.btn-sm { padding: 0.4rem 0.9rem; font-size: 0.85rem; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.form-actions { margin-top: 1.5rem; }

.error-banner {
  background: rgba(239,68,68,0.15);
  border: 1px solid rgba(239,68,68,0.3);
  color: #f87171;
  padding: 0.75rem 1rem;
  border-radius: 0.6rem;
  margin-top: 0.5rem;
}

.success-state {
  text-align: center;
  padding: 2rem 0;
}
.success-icon { font-size: 3rem; margin-bottom: 1rem; }
.success-state h3 { font-size: 1.5rem; margin-bottom: 0.5rem; }
.success-state p { color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; }
.ref-code {
  background: rgba(255,255,255,0.1);
  padding: 0.2rem 0.6rem;
  border-radius: 0.4rem;
  font-family: monospace;
  color: var(--accent);
}
.success-state .btn { margin: 0.5rem; }

/* Track */
.lookup-form { margin-bottom: 2rem; }
.lookup-fields { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.lookup-fields .form-input { flex: 1; min-width: 180px; }
.mt-1 { margin-top: 0.5rem; }

.dispute-card {
  border-radius: 1rem;
  padding: 1.5rem;
  margin-top: 1rem;
}
.dispute-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; }
.dispute-ref { font-family: monospace; font-size: 1.2rem; font-weight: 700; color: var(--accent); }
.dispute-order { font-size: 0.85rem; color: rgba(255,255,255,0.5); margin-top: 0.2rem; }

.status-badge { padding: 0.3rem 0.8rem; border-radius: 1rem; font-size: 0.8rem; font-weight: 600; }
.status-open { background: rgba(59,130,246,0.2); color: #93c5fd; }
.status-under_review { background: rgba(234,179,8,0.2); color: #fde047; }
.status-resolved { background: rgba(34,197,94,0.2); color: #86efac; }
.status-rejected { background: rgba(239,68,68,0.2); color: #fca5a5; }
.status-closed { background: rgba(156,163,175,0.2); color: #d1d5db; }

.dispute-body { margin-bottom: 1.5rem; }
.info-row { display: flex; gap: 0.75rem; margin-bottom: 0.5rem; font-size: 0.9rem; }
.info-label { color: rgba(255,255,255,0.5); min-width: 100px; }
.description-text { color: rgba(255,255,255,0.75); }
.resolution-box {
  background: rgba(34,197,94,0.1);
  border: 1px solid rgba(34,197,94,0.2);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-top: 1rem;
}
.resolution-box h4 { margin: 0 0 0.5rem; font-size: 0.95rem; }
.resolution-box p { margin: 0; font-size: 0.9rem; color: rgba(255,255,255,0.8); }

.dispute-timeline { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
.timeline-item { display: flex; align-items: flex-start; gap: 0.75rem; }
.timeline-item.inactive { opacity: 0.4; }
.tl-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); margin-top: 3px; flex-shrink: 0; }
.tl-dot.filled { background: var(--accent); border-color: var(--accent); }
.tl-content { display: flex; flex-direction: column; gap: 0.15rem; }
.tl-content strong { font-size: 0.9rem; }
.tl-content span { font-size: 0.8rem; color: rgba(255,255,255,0.5); }

/* FAQ */
.faq-section { padding: 2rem; }
.faq-list { display: flex; flex-direction: column; gap: 0; }
.faq-item { border-bottom: 1px solid rgba(255,255,255,0.07); }
.faq-item:last-child { border-bottom: none; }
.faq-q { padding: 1rem 0; cursor: pointer; font-size: 0.95rem; font-weight: 500; list-style: none; display: flex; justify-content: space-between; align-items: center; }
.faq-q::after { content: '+'; color: var(--accent); font-size: 1.2rem; }
details[open] .faq-q::after { content: '−'; }
.faq-a { padding: 0 0 1rem; color: rgba(255,255,255,0.6); font-size: 0.9rem; line-height: 1.6; margin: 0; }
</style>
