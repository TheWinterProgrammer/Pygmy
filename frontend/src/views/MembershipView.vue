<template>
  <div class="membership-view">
    <div class="membership-hero">
      <h1>{{ settings.members_page_title || 'Become a Member' }}</h1>
      <p class="hero-intro">{{ settings.members_page_intro || 'Get exclusive access to premium content.' }}</p>
    </div>

    <!-- Current subscription status -->
    <div v-if="customer && subscription" class="glass current-sub-card">
      <div class="sub-status-icon">✅</div>
      <div class="sub-status-body">
        <h3>You're on the {{ subscription.plan_name }} plan</h3>
        <p>
          Status: <span class="badge" :class="subStatusClass(subscription.status)">{{ subscription.status }}</span>
          <span v-if="subscription.cancel_at_end" class="badge badge-warning ml">Cancels at period end</span>
        </p>
        <p v-if="subscription.current_period_end" class="sub-period">
          Next renewal: {{ fmtDate(subscription.current_period_end) }}
        </p>
      </div>
      <div class="sub-actions">
        <button v-if="!subscription.cancel_at_end" class="btn btn-ghost btn-sm" @click="cancelSubscription">Cancel</button>
        <button v-else class="btn btn-ghost btn-sm" @click="reactivate">Reactivate</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loadingPlans" class="loading-plans">
      <div class="spinner"></div>
    </div>

    <!-- Plans grid -->
    <div v-else-if="plans.length" class="plans-grid">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="plan-card glass"
        :class="{ 'current-plan': subscription?.plan_id === plan.id }"
      >
        <div v-if="subscription?.plan_id === plan.id" class="current-badge">Current Plan</div>
        <h2 class="plan-name">{{ plan.name }}</h2>
        <p class="plan-desc" v-if="plan.description">{{ plan.description }}</p>
        <div class="plan-price">
          <span class="price">€{{ plan.price.toFixed(2) }}</span>
          <span class="per"> / {{ plan.interval === 'month' ? 'month' : 'year' }}</span>
        </div>
        <div v-if="plan.trial_days" class="trial-badge">{{ plan.trial_days }}-day free trial</div>
        <ul class="features-list" v-if="plan.features?.length">
          <li v-for="(f, i) in plan.features" :key="i">
            <span class="check">✓</span> {{ f }}
          </li>
        </ul>
        <RouterLink
          v-if="!customer"
          to="/account/login"
          class="btn btn-accent plan-cta"
        >Get Started →</RouterLink>
        <button
          v-else-if="subscription?.plan_id !== plan.id"
          class="btn btn-accent plan-cta"
          @click="contactForUpgrade(plan)"
        >Subscribe →</button>
        <div v-else class="plan-cta-current">Your current plan</div>
      </div>
    </div>

    <div v-else-if="!loadingPlans" class="no-plans glass">
      <p>No membership plans are currently available. Check back soon!</p>
    </div>

    <!-- FAQ / info -->
    <div class="glass faq-section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item">
        <h4>How do I access member content?</h4>
        <p>After subscribing, log into your account and all member-only content will be available automatically.</p>
      </div>
      <div class="faq-item">
        <h4>Can I cancel anytime?</h4>
        <p>Yes — you can cancel your subscription at any time from your account page. You'll retain access until the end of your current billing period.</p>
      </div>
      <div class="faq-item">
        <h4>What payment methods are accepted?</h4>
        <p>Subscriptions are managed by the site administrator. Contact us if you have billing questions.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCustomerStore } from '../stores/customer.js'

const customer = ref(null)
const plans = ref([])
const subscription = ref(null)
const settings = ref({})
const loadingPlans = ref(true)

const API = 'http://localhost:3200/api'

try {
  const cStore = useCustomerStore()
  customer.value = cStore.customer
} catch {}

async function loadPlans() {
  const r = await fetch(`${API}/subscriptions/plans`)
  plans.value = await r.json()
  loadingPlans.value = false
}

async function loadSettings() {
  const r = await fetch(`${API}/settings`)
  settings.value = await r.json()
}

async function loadMySubscription() {
  if (!customer.value) return
  try {
    const token = localStorage.getItem('pygmy_customer_token') || ''
    const r = await fetch(`${API}/subscriptions/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const d = await r.json()
    subscription.value = d.subscription
  } catch {}
}

async function cancelSubscription() {
  if (!confirm('Cancel your subscription? You will keep access until the end of the current period.')) return
  const token = localStorage.getItem('pygmy_customer_token') || ''
  const r = await fetch(`${API}/subscriptions/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  const d = await r.json()
  if (d.ok) { alert(d.message); await loadMySubscription() }
}

async function reactivate() {
  const token = localStorage.getItem('pygmy_customer_token') || ''
  const r = await fetch(`${API}/subscriptions/reactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  const d = await r.json()
  if (d.ok) { alert(d.message); await loadMySubscription() }
}

function contactForUpgrade(plan) {
  alert(`To subscribe to "${plan.name}", please contact the site administrator or complete checkout.`)
}

function subStatusClass(status) {
  const map = { active: 'badge-active', trialing: 'badge-info', cancelled: 'badge-cancelled' }
  return map[status] || ''
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  await Promise.all([loadPlans(), loadSettings(), loadMySubscription()])
})
</script>

<style scoped>
.membership-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}
.membership-hero {
  text-align: center;
  padding: 3rem 1rem 2.5rem;
}
.membership-hero h1 {
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  margin-bottom: .75rem;
  background: linear-gradient(135deg, var(--text), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-intro { color: var(--text-muted); font-size: 1.05rem; max-width: 500px; margin: 0 auto; }

.current-sub-card {
  display: flex; align-items: center; gap: 1.5rem;
  padding: 1.25rem 1.5rem; border-radius: 1.25rem;
  margin-bottom: 2.5rem; flex-wrap: wrap;
  border-color: #4ade80 !important;
}
.sub-status-icon { font-size: 2rem; }
.sub-status-body { flex: 1; }
.sub-status-body h3 { margin: 0 0 .25rem; font-size: 1rem; }
.sub-period { font-size: .85rem; color: var(--text-muted); margin: .25rem 0 0; }
.sub-actions { display: flex; gap: .5rem; }
.badge-active { background: rgba(74,222,128,.2); color: #4ade80; }
.badge-cancelled { background: rgba(239,68,68,.2); color: #fca5a5; }
.badge-info { background: rgba(59,130,246,.2); color: #93c5fd; }
.badge-warning { background: rgba(251,191,36,.2); color: #fde68a; }
.ml { margin-left: .4rem; }

.loading-plans {
  display: flex; justify-content: center; padding: 3rem;
}
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(255,255,255,.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.plan-card {
  padding: 2rem 1.75rem;
  border-radius: 1.5rem;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: transform .2s, box-shadow .2s;
}
.plan-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(0,0,0,.25);
}
.plan-card.current-plan {
  border-color: var(--accent) !important;
}
.current-badge {
  position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
  background: var(--accent); color: white;
  font-size: .7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
  padding: .25rem .75rem; border-radius: 0 0 .6rem .6rem;
}
.plan-name { font-size: 1.25rem; margin: 0 0 .5rem; }
.plan-desc { color: var(--text-muted); font-size: .88rem; margin: 0 0 1rem; }
.plan-price { margin-bottom: .75rem; }
.price { font-size: 2.2rem; font-weight: 700; color: var(--accent); }
.per { color: var(--text-muted); font-size: .95rem; }
.trial-badge {
  background: rgba(74,222,128,.1); color: #4ade80;
  border-radius: 1rem; font-size: .78rem; padding: .25rem .75rem;
  display: inline-block; margin-bottom: .75rem;
}
.features-list {
  list-style: none; padding: 0; margin: 0 0 1.5rem; flex: 1;
}
.features-list li { padding: .35rem 0; font-size: .88rem; color: var(--text-muted); display: flex; gap: .5rem; }
.check { color: var(--accent); font-weight: 700; }
.plan-cta { width: 100%; text-align: center; padding: .75rem; margin-top: auto; }
.plan-cta-current { text-align: center; padding: .75rem; color: var(--text-muted); font-size: .9rem; }

.no-plans { padding: 2rem; text-align: center; border-radius: 1.25rem; color: var(--text-muted); }

.faq-section {
  padding: 2rem; border-radius: 1.25rem;
}
.faq-section h2 { margin: 0 0 1.5rem; }
.faq-item { margin-bottom: 1.25rem; }
.faq-item h4 { margin: 0 0 .35rem; font-size: .95rem; }
.faq-item p { color: var(--text-muted); font-size: .88rem; margin: 0; }
</style>
