<template>
  <div class="lookup-page">
    <div class="container">
      <div class="lookup-card glass">
        <div class="lookup-icon">📦</div>
        <h1 class="lookup-title">Track Your Order</h1>
        <p class="lookup-desc text-muted">
          Enter your order number and email address to check the status of your order.
        </p>

        <!-- Form -->
        <form v-if="!result" @submit.prevent="lookup" novalidate class="lookup-form">
          <div class="field">
            <label class="label">Order Number <span class="req">*</span></label>
            <input
              class="input"
              type="text"
              v-model="form.order_number"
              placeholder="ORD-260101-0001"
              style="text-transform:uppercase;letter-spacing:.04em;"
            />
            <span class="field-error" v-if="errors.order_number">{{ errors.order_number }}</span>
          </div>
          <div class="field">
            <label class="label">Email Address <span class="req">*</span></label>
            <input
              class="input"
              type="email"
              v-model="form.email"
              placeholder="jane@example.com"
            />
            <span class="field-error" v-if="errors.email">{{ errors.email }}</span>
          </div>
          <div class="field-error global-error" v-if="errors.global">{{ errors.global }}</div>
          <button type="submit" class="btn btn-primary btn-full" :disabled="looking">
            {{ looking ? 'Looking up…' : 'Track Order' }}
          </button>
        </form>

        <!-- Result -->
        <div v-else class="order-result">
          <div class="result-header">
            <span class="order-number-badge">{{ result.order_number }}</span>
            <span class="status-pill" :class="`status-${result.status}`">{{ statusLabel(result.status) }}</span>
          </div>

          <!-- Order Status Timeline -->
          <OrderTimeline :status="result.status" />

          <div class="result-meta">
            <div class="meta-row">
              <span class="meta-label">Customer</span>
              <span>{{ result.customer_name }}</span>
            </div>
            <div class="meta-row" v-if="result.shipping_address">
              <span class="meta-label">Ship to</span>
              <span class="meta-addr">{{ result.shipping_address }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Placed</span>
              <span>{{ formatDate(result.created_at) }}</span>
            </div>
          </div>

          <!-- Items -->
          <div class="result-items" v-if="result.items?.length">
            <h3 class="items-title">Items</h3>
            <div class="item-row" v-for="item in result.items" :key="item.product_id">
              <div class="item-img">
                <img v-if="item.cover_image" :src="item.cover_image" :alt="item.name" />
                <span v-else>🛍️</span>
              </div>
              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-meta text-muted">× {{ item.quantity }}</span>
              </div>
              <span class="item-total">{{ fmt(item.line_total) }}</span>
            </div>
          </div>

          <!-- Totals -->
          <div class="result-totals">
            <div class="total-row" v-if="result.discount_amount > 0">
              <span class="text-muted">Discount</span>
              <span style="color:hsl(140,60%,60%);">−{{ fmt(result.discount_amount) }}</span>
            </div>
            <div class="total-row big">
              <span>Total</span>
              <strong style="color:var(--accent);">{{ fmt(result.total) }}</strong>
            </div>
          </div>

          <!-- Tracking Info -->
          <div class="tracking-card" v-if="result.tracking_number || result.tracking_url">
            <h3 class="items-title">📦 Tracking</h3>
            <div class="result-meta">
              <div class="meta-row" v-if="result.tracking_carrier">
                <span class="meta-label">Carrier</span>
                <span>{{ result.tracking_carrier }}</span>
              </div>
              <div class="meta-row" v-if="result.tracking_number">
                <span class="meta-label">Tracking #</span>
                <span style="font-family:monospace;letter-spacing:.03em;">{{ result.tracking_number }}</span>
              </div>
              <div class="meta-row" v-if="result.shipped_at">
                <span class="meta-label">Shipped</span>
                <span>{{ formatDate(result.shipped_at) }}</span>
              </div>
            </div>
            <a v-if="result.tracking_url" :href="result.tracking_url" target="_blank" rel="noopener"
               class="btn btn-primary" style="margin-top:.75rem;display:inline-block;">
              🔍 Track Package →
            </a>
          </div>

          <!-- Notes -->
          <div class="result-notes" v-if="result.notes">
            <span class="meta-label">Notes:</span> {{ result.notes }}
          </div>

          <!-- Cancel Order section -->
          <div class="cancel-section" v-if="canCancel">
            <div v-if="!showCancelForm">
              <button class="btn btn-cancel btn-full" @click="showCancelForm = true">✕ Cancel This Order</button>
            </div>
            <div v-else class="cancel-form glass">
              <h4>Cancel Order {{ result.order_number }}</h4>
              <p class="cancel-warning">⚠️ This action cannot be undone. Your order will be cancelled.</p>
              <div class="form-group">
                <label>Reason (optional)</label>
                <input v-model="cancelReason" class="lookup-input" placeholder="e.g. Changed my mind…" />
              </div>
              <div v-if="cancelError" class="cancel-error">{{ cancelError }}</div>
              <div class="cancel-actions">
                <button class="btn btn-ghost" @click="showCancelForm = false">Keep Order</button>
                <button class="btn btn-danger" @click="doCancel" :disabled="cancelling">
                  {{ cancelling ? 'Cancelling…' : '✕ Confirm Cancel' }}
                </button>
              </div>
            </div>
            <div class="cancel-success glass" v-if="cancelSuccess">
              ✅ Your order has been cancelled. You'll receive a confirmation shortly.
            </div>
          </div>

          <!-- Add Note Section -->
          <div class="note-section" v-if="!['cancelled','refunded'].includes(result.status)">
            <div v-if="!showNoteForm">
              <button class="btn btn-ghost btn-full" @click="showNoteForm = true" style="margin-top:.75rem;">
                📝 Add a Note to This Order
              </button>
            </div>
            <div v-else class="note-form glass" style="margin-top:1rem;padding:1.25rem;border-radius:1rem;">
              <h4 style="margin:0 0 .75rem;">Add Order Note</h4>
              <textarea v-model="noteText" class="input" rows="3" placeholder="e.g. Please leave at door, special delivery instructions…" style="width:100%;resize:vertical;"></textarea>
              <div v-if="noteError" class="cancel-error" style="margin-top:.5rem;">{{ noteError }}</div>
              <div v-if="noteSuccess" style="color:#4ade80;margin-top:.5rem;">✅ Note added!</div>
              <div style="display:flex;gap:.5rem;margin-top:.75rem;">
                <button class="btn btn-ghost" @click="showNoteForm = false; noteText = ''">Cancel</button>
                <button class="btn btn-primary" @click="addNote" :disabled="noteLoading || !noteText.trim()">
                  {{ noteLoading ? 'Adding…' : 'Add Note' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Order History Timeline -->
          <div class="timeline-section" v-if="orderTimeline.length">
            <h3 class="items-title" style="margin-top:1.5rem;">📋 Order History</h3>
            <div class="timeline">
              <div class="timeline-item" v-for="(evt, idx) in orderTimeline" :key="idx">
                <div class="timeline-icon">{{ timelineIcon(evt.event) }}</div>
                <div class="timeline-body">
                  <div class="timeline-label">{{ formatEventType(evt.event) }}</div>
                  <div class="timeline-desc text-muted" v-if="evt.description || evt.note">{{ evt.description || evt.note }}</div>
                  <div class="timeline-time text-muted">{{ timeAgo(evt.created_at) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Track again -->
          <button class="btn btn-ghost btn-full" style="margin-top:1.25rem;" @click="reset">
            ← Track another order
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import api from '../api.js'
import { useSiteStore } from '../stores/site.js'
import OrderTimeline from '../components/OrderTimeline.vue'

const site = useSiteStore()

const looking = ref(false)
const result  = ref(null)
const form    = reactive({ order_number: '', email: '' })
const errors  = reactive({ order_number: '', email: '', global: '' })
const orderTimeline = ref([])

// Cancel order
const showCancelForm = ref(false)
const cancelReason   = ref('')
const cancelling     = ref(false)
const cancelError    = ref('')
const cancelSuccess  = ref(false)

// Customer note
const showNoteForm = ref(false)
const noteText     = ref('')
const noteLoading  = ref(false)
const noteError    = ref('')
const noteSuccess  = ref(false)

async function addNote() {
  if (!noteText.value.trim()) return
  noteLoading.value = true
  noteError.value = ''
  noteSuccess.value = false
  try {
    await api.post('/orders/customer-note', {
      order_number: result.value.order_number,
      email: form.email || result.value.customer_email,
      note: noteText.value.trim()
    })
    noteSuccess.value = true
    noteText.value = ''
    setTimeout(() => { showNoteForm.value = false; noteSuccess.value = false }, 2500)
  } catch (e) {
    noteError.value = e.response?.data?.error || 'Failed to add note.'
  } finally {
    noteLoading.value = false
  }
}

const canCancel = computed(() => {
  if (!result.value) return false
  const status = result.value.status
  return ['pending', 'processing'].includes(status)
})

async function doCancel() {
  if (!result.value) return
  cancelling.value = true
  cancelError.value = ''
  try {
    await api.post('/orders/cancel', {
      order_number: result.value.order_number,
      email: form.email || result.value.customer_email,
      reason: cancelReason.value
    })
    cancelSuccess.value = true
    showCancelForm.value = false
    result.value = { ...result.value, status: 'cancelled' }
  } catch (e) {
    cancelError.value = e.response?.data?.error || 'Cancellation failed. Please contact support.'
  } finally {
    cancelling.value = false
  }
}

function validate() {
  errors.order_number = form.order_number.trim() ? '' : 'Order number is required.'
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? '' : 'A valid email is required.'
  return !errors.order_number && !errors.email
}

async function lookup() {
  errors.global = ''
  if (!validate()) return
  looking.value = true
  try {
    const { data } = await api.post('/orders/lookup', {
      order_number: form.order_number.trim().toUpperCase(),
      email:        form.email.trim().toLowerCase(),
    })
    data.items = typeof data.items === 'string' ? JSON.parse(data.items || '[]') : (data.items || [])
    result.value = data
    // Fetch order timeline
    try {
      const tl = await api.post('/orders/timeline-lookup', {
        order_number: data.order_number,
        email: form.email.trim().toLowerCase(),
      })
      orderTimeline.value = (tl.data?.timeline || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    } catch {
      orderTimeline.value = []
    }
  } catch (err) {
    errors.global = err.response?.data?.error || 'Order not found. Please check your order number and email.'
  } finally {
    looking.value = false
  }
}

function reset() {
  result.value = null
  form.order_number = ''
  form.email = ''
  errors.global = ''
  orderTimeline.value = []
}

function timelineIcon(event_type) {
  const icons = {
    order_placed: '🛍️',
    status_changed: '🔄',
    note_added: '📝',
    message_sent: '📩',
    tracking_updated: '📦',
    customer_note: '👤',
  }
  return icons[event_type] || 'ℹ️'
}

function formatEventType(event_type) {
  return (event_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(d)
}

function statusLabel(s) {
  return { pending: 'Pending', processing: 'Processing', shipped: 'Shipped', completed: 'Completed', cancelled: 'Cancelled', refunded: 'Refunded' }[s] || s
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
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
</script>

<style scoped>
.lookup-page { min-height: 100vh; display: flex; align-items: center; padding: 5rem 0 4rem; }
.lookup-page .container { max-width: 520px; }

.lookup-card {
  padding: 2.5rem;
  border-radius: 1.5rem;
  text-align: center;
}

.lookup-icon { font-size: 3rem; margin-bottom: .75rem; }
.lookup-title { font-size: 1.65rem; font-weight: 800; margin: 0 0 .5rem; }
.lookup-desc { font-size: .92rem; margin: 0 0 2rem; line-height: 1.6; }

.lookup-form { text-align: left; }
.field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.label { font-size: .85rem; font-weight: 600; }
.req { color: var(--accent); }
.field-error { color: var(--accent); font-size: .8rem; }
.global-error {
  background: rgba(var(--accent-rgb),.12);
  border: 1px solid rgba(var(--accent-rgb),.3);
  border-radius: .5rem;
  padding: .6rem .875rem;
  margin-bottom: .75rem;
  text-align: left;
}
.btn-full { width: 100%; }

/* Result */
.order-result { text-align: left; }
.result-header {
  display: flex;
  align-items: center;
  gap: .75rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}
.order-number-badge {
  font-family: monospace;
  font-size: 1.05rem;
  font-weight: 700;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  padding: .3rem .75rem;
  border-radius: 99px;
  letter-spacing: .04em;
}
.status-pill {
  padding: .25rem .75rem;
  border-radius: 99px;
  font-size: .8rem;
  font-weight: 700;
  letter-spacing: .04em;
}
.status-pending    { background: hsl(44,80%,18%);  color: hsl(44,80%,65%); }
.status-processing { background: hsl(210,70%,18%); color: hsl(210,70%,65%); }
.status-shipped    { background: hsl(180,60%,15%); color: hsl(180,60%,55%); }
.status-completed  { background: hsl(140,60%,12%); color: hsl(140,60%,55%); }
.status-cancelled  { background: hsl(355,60%,18%); color: hsl(355,60%,65%); }
.status-refunded   { background: hsl(270,50%,18%); color: hsl(270,50%,65%); }

.result-meta {
  background: rgba(255,255,255,.03);
  border-radius: .75rem;
  border: 1px solid rgba(255,255,255,.07);
  padding: .875rem 1rem;
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}
.meta-row { display: flex; gap: .75rem; font-size: .88rem; }
.meta-label { min-width: 70px; color: var(--text-muted); font-weight: 600; }
.meta-addr { line-height: 1.5; }

.items-title { font-size: .9rem; font-weight: 700; color: var(--text-muted); margin: 0 0 .625rem; text-transform: uppercase; letter-spacing: .06em; }
.result-items { margin-bottom: 1rem; }
.item-row {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: .625rem;
  align-items: center;
  padding: .5rem 0;
  border-bottom: 1px solid rgba(255,255,255,.05);
}
.item-img { width: 36px; height: 36px; border-radius: .35rem; overflow: hidden; background: rgba(255,255,255,.06); display:flex;align-items:center;justify-content:center;font-size:1rem; }
.item-img img { width:100%;height:100%;object-fit:cover; }
.item-info { display:flex;flex-direction:column;gap:.1rem;min-width:0; }
.item-name { font-size:.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.item-meta { font-size:.78rem; }
.item-total { font-size:.88rem;font-weight:600;white-space:nowrap; }

.result-totals { border-top: 1px solid rgba(255,255,255,.1); padding-top: .875rem; margin-bottom: .25rem; }
.total-row { display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:.4rem; }
.total-row.big { font-size:1rem;font-weight:700; }

.result-notes { font-size: .85rem; color: var(--text-muted); margin-top: .5rem; line-height: 1.5; }
.tracking-card { margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,.04); border-radius: .75rem; border: 1px solid rgba(255,255,255,.08); }

/* Cancel Order */
.cancel-section { margin-top: 1.25rem; display: flex; flex-direction: column; gap: .75rem; }
.btn-cancel { background: rgba(245,101,101,.1); border: 1px solid rgba(245,101,101,.3); color: #f56565; border-radius: .75rem; padding: .65rem 1.25rem; cursor: pointer; font-size: .9rem; font-weight: 500; transition: background .2s; width: 100%; }
.btn-cancel:hover { background: rgba(245,101,101,.18); }
.btn-danger { background: rgba(245,101,101,.2); border: 1px solid rgba(245,101,101,.4); color: #f56565; border-radius: .75rem; padding: .6rem 1.25rem; cursor: pointer; font-size: .9rem; font-weight: 600; transition: background .2s; }
.btn-danger:hover { background: rgba(245,101,101,.3); }
.cancel-form { display: flex; flex-direction: column; gap: .75rem; padding: 1.25rem; border-radius: 1rem; }
.cancel-form h4 { margin: 0; font-size: 1rem; }
.cancel-warning { font-size: .85rem; color: #f6ad55; margin: 0; }
.cancel-actions { display: flex; gap: .5rem; justify-content: flex-end; }
.cancel-error { font-size: .85rem; color: #f56565; background: rgba(245,101,101,.1); padding: .5rem .75rem; border-radius: .5rem; }
.cancel-success { padding: .75rem 1rem; border-radius: .75rem; color: #48bb78; background: rgba(72,187,120,.1); font-size: .9rem; }

/* Timeline */
.timeline { display: flex; flex-direction: column; gap: 0; margin-top: .75rem; }
.timeline-item {
  display: flex;
  gap: .875rem;
  align-items: flex-start;
  position: relative;
  padding-bottom: 1.25rem;
}
.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 1rem;
  top: 2rem;
  bottom: 0;
  width: 2px;
  background: rgba(255,255,255,.08);
}
.timeline-icon {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.timeline-body { flex: 1; min-width: 0; padding-top: .2rem; }
.timeline-label { font-weight: 700; font-size: .88rem; margin-bottom: .2rem; }
.timeline-desc { font-size: .82rem; margin-bottom: .2rem; line-height: 1.4; }
.timeline-time { font-size: .75rem; }
</style>
