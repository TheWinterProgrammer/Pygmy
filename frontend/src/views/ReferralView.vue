<template>
  <div class="referral-page">
    <!-- Hero -->
    <section class="referral-hero">
      <div class="hero-content glass">
        <div class="hero-icon">🤝</div>
        <h1>Refer a Friend, Earn Rewards</h1>
        <p>Share your unique link and earn store credit when friends make a purchase.</p>
        <div v-if="!isLoggedIn" class="hero-cta">
          <RouterLink to="/account/login" class="btn-primary">Sign in to get your link</RouterLink>
          <span class="hero-or">or</span>
          <RouterLink to="/account/login?register=1" class="btn-outline">Create an account</RouterLink>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="how-it-works">
      <h2>How it works</h2>
      <div class="steps-grid">
        <div class="step-card glass">
          <div class="step-num">1</div>
          <div class="step-icon">🔗</div>
          <h3>Get your link</h3>
          <p>Sign in and grab your unique referral link from your dashboard below.</p>
        </div>
        <div class="step-card glass">
          <div class="step-num">2</div>
          <div class="step-icon">📤</div>
          <h3>Share it</h3>
          <p>Send your link to friends via email, social media, or wherever you like.</p>
        </div>
        <div class="step-card glass">
          <div class="step-num">3</div>
          <div class="step-icon">💰</div>
          <h3>Earn rewards</h3>
          <p>When they place their first order, you both get {{ formatCurrency(settings.referral_reward_amount) }} in store credit.</p>
        </div>
      </div>
    </section>

    <!-- Referral dashboard (logged in) -->
    <section v-if="isLoggedIn" class="referral-dashboard">
      <h2>Your Referral Dashboard</h2>

      <div v-if="loadingRef" class="loading-state">
        <div class="spinner"></div>
      </div>

      <div v-else-if="refData" class="dashboard-grid">
        <!-- Stats -->
        <div class="stat-card glass">
          <div class="stat-value">{{ refData.times_used }}</div>
          <div class="stat-label">Friends referred</div>
        </div>
        <div class="stat-card glass">
          <div class="stat-value">{{ formatCurrency(refData.credit_earned) }}</div>
          <div class="stat-label">Total credit earned</div>
        </div>
        <div class="stat-card glass">
          <div class="stat-value">{{ formatCurrency(refData.reward_amount) }}</div>
          <div class="stat-label">Reward per referral</div>
        </div>

        <!-- Referral link -->
        <div class="link-card glass">
          <h3>Your unique referral link</h3>
          <div class="link-row">
            <input
              type="text"
              readonly
              :value="referralUrl"
              class="link-input"
              ref="linkInputEl"
              @click="copyLink"
            />
            <button class="btn-primary copy-btn" @click="copyLink">
              {{ copied ? '✓ Copied!' : '📋 Copy' }}
            </button>
          </div>
          <div class="share-buttons">
            <button class="share-btn" @click="shareTwitter">𝕏 Share on X</button>
            <button class="share-btn" @click="shareWhatsApp">💬 WhatsApp</button>
            <button class="share-btn" @click="shareEmail">✉️ Email</button>
          </div>
        </div>

        <!-- Recent referrals -->
        <div v-if="refData.events?.length" class="events-card glass">
          <h3>Recent referrals</h3>
          <table class="events-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ev in refData.events" :key="ev.id">
                <td>{{ formatDate(ev.created_at) }}</td>
                <td>{{ eventLabel(ev.event_type) }}</td>
                <td class="credit-cell">+{{ formatCurrency(ev.credit_amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="no-events glass">
          <p>No referrals yet — share your link to start earning!</p>
        </div>
      </div>

      <div v-else-if="refError" class="error-msg">{{ refError }}</div>
    </section>

    <!-- Not logged in reminder -->
    <section v-else class="login-prompt glass">
      <div class="prompt-icon">🔐</div>
      <h2>Sign in to access your referral dashboard</h2>
      <p>Create an account or sign in to get your personal referral link and track your earnings.</p>
      <div class="prompt-actions">
        <RouterLink to="/account/login" class="btn-primary">Sign In</RouterLink>
        <RouterLink to="/account/login?register=1" class="btn-outline">Create Account</RouterLink>
      </div>
    </section>

    <!-- Terms -->
    <section class="terms-section">
      <div class="terms-card glass">
        <h3>📋 Referral Terms</h3>
        <ul>
          <li>Referral rewards are issued as store credit after the referred friend's first qualifying order.</li>
          <li v-if="settings.referral_min_order">Minimum order amount: {{ formatCurrency(settings.referral_min_order) }}</li>
          <li>Store credit will be added to your account automatically.</li>
          <li>Self-referrals are not eligible for rewards.</li>
          <li>Rewards may not be combined with other promotions unless stated otherwise.</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'
import { useCustomerStore } from '../stores/customer.js'
import { useSiteStore } from '../stores/site.js'

const customer = useCustomerStore()
const site = useSiteStore()

const isLoggedIn = computed(() => customer.isLoggedIn)
const loadingRef = ref(false)
const refData = ref(null)
const refError = ref('')
const copied = ref(false)
const linkInputEl = ref(null)

const settings = computed(() => ({
  referral_reward_amount: site.settings?.referral_reward_amount || '10',
  referral_min_order: site.settings?.referral_min_order || '0',
}))

const siteUrl = computed(() => site.settings?.site_url || window.location.origin)
const referralUrl = computed(() =>
  refData.value ? `${siteUrl.value}/?ref=${refData.value.code}` : ''
)

const currencySymbol = computed(() => site.settings?.shop_currency_symbol || '€')

function formatCurrency(val) {
  const n = parseFloat(val || 0)
  return `${currencySymbol.value}${n.toFixed(2)}`
}

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function eventLabel(type) {
  const labels = {
    signup: 'Friend signed up',
    order: 'Friend placed an order',
    reward: 'Reward issued',
  }
  return labels[type] || type
}

async function copyLink() {
  if (!referralUrl.value) return
  try {
    await navigator.clipboard.writeText(referralUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    linkInputEl.value?.select()
  }
}

function shareTwitter() {
  const text = encodeURIComponent(`Check out this store! Use my referral link and we both get a reward: ${referralUrl.value}`)
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
}
function shareWhatsApp() {
  const text = encodeURIComponent(`Hey! Use my referral link to get a discount: ${referralUrl.value}`)
  window.open(`https://wa.me/?text=${text}`, '_blank')
}
function shareEmail() {
  const subject = encodeURIComponent('I thought you might like this store!')
  const body = encodeURIComponent(`Hey!\n\nI've been shopping here and thought you might like it too.\n\nUse my referral link and we both get a reward:\n${referralUrl.value}\n\nEnjoy!`)
  window.open(`mailto:?subject=${subject}&body=${body}`)
}

onMounted(async () => {
  if (!isLoggedIn.value) return
  loadingRef.value = true
  try {
    const { data } = await api.get('/referral/my-code', {
      headers: { Authorization: `Bearer ${customer.token}` },
    })
    refData.value = data
  } catch (e) {
    refError.value = e?.response?.data?.error || 'Failed to load referral data.'
  } finally {
    loadingRef.value = false
  }
})
</script>

<style scoped>
.referral-page {
  min-height: 100vh;
  padding-bottom: 4rem;
}

/* Hero */
.referral-hero {
  padding: 4rem 1rem 2rem;
  display: flex;
  justify-content: center;
}
.hero-content {
  max-width: 600px;
  text-align: center;
  padding: 3rem 2.5rem;
  border-radius: 1.5rem;
}
.hero-icon { font-size: 3rem; margin-bottom: 1rem; }
.hero-content h1 { margin: 0 0 0.75rem; font-size: 2rem; }
.hero-content > p { color: var(--muted); margin: 0 0 2rem; line-height: 1.6; font-size: 1.05rem; }
.hero-cta { display: flex; align-items: center; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.hero-or { color: var(--muted); font-size: 0.9rem; }

/* How it works */
.how-it-works {
  max-width: 1000px;
  margin: 3rem auto;
  padding: 0 1rem;
}
.how-it-works h2,
.referral-dashboard h2 {
  font-size: 1.5rem;
  margin: 0 0 1.5rem;
}
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}
.step-card {
  padding: 2rem 1.5rem;
  border-radius: 1.25rem;
  text-align: center;
  position: relative;
}
.step-num {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 26px; height: 26px;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.step-card h3 { margin: 0 0 0.5rem; font-size: 1rem; }
.step-card p { color: var(--muted); font-size: 0.9rem; margin: 0; line-height: 1.5; }

/* Dashboard */
.referral-dashboard {
  max-width: 900px;
  margin: 3rem auto;
  padding: 0 1rem;
}
.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
.stat-card {
  padding: 1.5rem;
  border-radius: 1.25rem;
  text-align: center;
}
.stat-value { font-size: 2rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.8rem; color: var(--muted); margin-top: 0.25rem; }

.link-card {
  grid-column: 1 / -1;
  padding: 1.75rem;
  border-radius: 1.25rem;
}
.link-card h3 { margin: 0 0 1rem; font-size: 1rem; }
.link-row { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
.link-input {
  flex: 1;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  color: var(--text);
  font-size: 0.9rem;
  cursor: pointer;
}
.copy-btn { white-space: nowrap; }
.share-buttons { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.share-btn {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.75rem;
  padding: 0.6rem 1.1rem;
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
}
.share-btn:hover { background: rgba(255,255,255,0.12); }

.events-card,
.no-events {
  grid-column: 1 / -1;
  padding: 1.75rem;
  border-radius: 1.25rem;
}
.events-card h3 { margin: 0 0 1rem; font-size: 1rem; }
.events-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.events-table th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.events-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
.credit-cell { color: hsl(145, 55%, 55%); font-weight: 600; }
.no-events { text-align: center; }
.no-events p { color: var(--muted); margin: 0; padding: 1rem; }

/* Login prompt */
.login-prompt {
  max-width: 500px;
  margin: 3rem auto;
  padding: 3rem;
  border-radius: 1.5rem;
  text-align: center;
}
.prompt-icon { font-size: 2.5rem; margin-bottom: 1rem; }
.login-prompt h2 { margin: 0 0 0.75rem; font-size: 1.3rem; }
.login-prompt p { color: var(--muted); margin: 0 0 1.75rem; line-height: 1.6; }
.prompt-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

/* Terms */
.terms-section {
  max-width: 700px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.terms-card {
  padding: 1.75rem;
  border-radius: 1.25rem;
}
.terms-card h3 { margin: 0 0 1rem; font-size: 1rem; }
.terms-card ul {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 2;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 0.75rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.15s;
}
.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  color: var(--text);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 0.75rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s;
}
.btn-outline:hover { background: rgba(255,255,255,0.07); }

.error-msg {
  background: rgba(220, 60, 80, 0.15);
  border: 1px solid rgba(220, 60, 80, 0.4);
  color: hsl(355, 80%, 70%);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .steps-grid { grid-template-columns: 1fr; }
  .dashboard-grid { grid-template-columns: 1fr; }
  .stat-card { padding: 1rem; }
  .link-row { flex-direction: column; }
}
</style>
