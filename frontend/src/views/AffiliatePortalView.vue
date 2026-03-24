<template>
  <div class="affiliate-portal">
    <div class="container">

      <!-- Login Screen -->
      <div v-if="!isLoggedIn" class="login-wrap">
        <div class="login-card glass">
          <div class="login-icon">💼</div>
          <h1 class="login-title">Affiliate Portal</h1>
          <p class="login-desc text-muted">Sign in with your email and referral code to access your dashboard.</p>
          <form @submit.prevent="doLogin" class="login-form">
            <div class="field">
              <label class="flabel">Email Address</label>
              <input v-model="loginForm.email" type="email" class="input" placeholder="you@example.com" />
            </div>
            <div class="field">
              <label class="flabel">Referral Code</label>
              <input v-model="loginForm.code" class="input" placeholder="YOURCODE123" style="text-transform:uppercase;letter-spacing:.06em;" />
            </div>
            <p v-if="loginError" class="login-error">{{ loginError }}</p>
            <button type="submit" class="btn btn-primary btn-full" :disabled="loginLoading">
              {{ loginLoading ? 'Signing in…' : 'Sign In' }}
            </button>
          </form>
        </div>
        <div class="join-card glass">
          <h3>Interested in becoming an affiliate?</h3>
          <p class="text-muted">Join our affiliate program and earn commissions for every customer you refer.</p>
          <a href="/contact" class="btn btn-ghost">Contact Us →</a>
        </div>
      </div>

      <!-- Dashboard -->
      <div v-else class="dashboard">
        <!-- Sidebar -->
        <aside class="sidebar glass">
          <div class="aff-profile">
            <div class="aff-avatar">{{ affiliateData?.name?.charAt(0).toUpperCase() }}</div>
            <div>
              <div class="aff-name">{{ affiliateData?.name }}</div>
              <span :class="['status-badge', affiliateData?.status === 'active' ? 'active' : 'inactive']">
                {{ affiliateData?.status }}
              </span>
            </div>
          </div>
          <div class="ref-code-box">
            <div class="ref-code-label">Your Referral Code</div>
            <div class="ref-code">{{ affiliateData?.code }}</div>
          </div>
          <button class="btn btn-ghost signout-btn" @click="signOut">Sign Out</button>
        </aside>

        <!-- Main -->
        <main class="dash-main">
          <!-- Tabs -->
          <div class="tabs">
            <button v-for="tab in tabs" :key="tab.id" :class="['tab', activeTab === tab.id && 'active']" @click="activeTab = tab.id">
              {{ tab.label }}
            </button>
          </div>

          <!-- Dashboard Tab -->
          <div v-if="activeTab === 'dashboard'">
            <div class="stats-grid">
              <div class="stat-card glass">
                <div class="stat-num">{{ affiliateData?.total_referrals || 0 }}</div>
                <div class="stat-lbl">Total Referrals</div>
              </div>
              <div class="stat-card glass">
                <div class="stat-num">{{ fmt(affiliateData?.total_earned || 0) }}</div>
                <div class="stat-lbl">Commission Earned</div>
              </div>
              <div class="stat-card glass">
                <div class="stat-num">{{ fmt(affiliateData?.total_paid || 0) }}</div>
                <div class="stat-lbl">Paid Out</div>
              </div>
              <div class="stat-card glass pending">
                <div class="stat-num">{{ fmt((affiliateData?.total_earned || 0) - (affiliateData?.total_paid || 0)) }}</div>
                <div class="stat-lbl">Pending</div>
              </div>
            </div>

            <div class="glass ref-link-card">
              <h3>Your Referral Link</h3>
              <div class="ref-link-row">
                <input :value="referralLink" class="input" readonly />
                <button class="btn btn-primary" @click="copyLink">{{ copied ? '✅ Copied!' : '📋 Copy' }}</button>
              </div>
              <div class="share-btns">
                <a :href="twitterUrl" target="_blank" rel="noopener" class="btn btn-ghost share-btn">🐦 Share on Twitter</a>
                <a :href="whatsappUrl" target="_blank" rel="noopener" class="btn btn-ghost share-btn">💬 Share on WhatsApp</a>
              </div>
            </div>
          </div>

          <!-- Referrals Tab -->
          <div v-if="activeTab === 'referrals'">
            <div class="glass section">
              <h3 class="section-title">Referrals</h3>
              <div v-if="referralsLoading" class="loading text-muted">Loading…</div>
              <table v-else-if="referrals.length" class="table">
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Order Amount</th>
                    <th>Commission</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in referrals" :key="r.id">
                    <td>{{ r.order_number || '—' }}</td>
                    <td>{{ fmt(r.order_amount) }}</td>
                    <td style="color:var(--accent);font-weight:700;">{{ fmt(r.commission_amount) }}</td>
                    <td class="text-muted">{{ formatDate(r.created_at) }}</td>
                    <td><span :class="['status-pill', r.status]">{{ r.status }}</span></td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="empty text-muted">No referrals yet.</p>
            </div>
          </div>

          <!-- Payouts Tab -->
          <div v-if="activeTab === 'payouts'">
            <div class="glass section">
              <h3 class="section-title">Payouts</h3>
              <div v-if="payoutsLoading" class="loading text-muted">Loading…</div>
              <table v-else-if="payouts.length" class="table">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in payouts" :key="p.id">
                    <td style="font-weight:700;color:#48bb78;">{{ fmt(p.amount) }}</td>
                    <td class="text-muted">{{ formatDate(p.created_at) }}</td>
                    <td><span :class="['status-pill', p.status]">{{ p.status }}</span></td>
                    <td class="text-muted">{{ p.notes || '—' }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="empty text-muted">No payouts yet.</p>
            </div>
          </div>

          <!-- Profile Tab -->
          <div v-if="activeTab === 'profile'">
            <div class="glass section">
              <h3 class="section-title">Profile</h3>
              <div class="form-group">
                <label class="flabel">Name</label>
                <input v-model="profileForm.name" class="input" placeholder="Your name" />
              </div>
              <div class="form-group">
                <label class="flabel">Email</label>
                <input :value="affiliateData?.email" class="input" readonly style="opacity:.6;" />
              </div>
              <div class="form-group">
                <label class="flabel">Payout Info</label>
                <textarea v-model="profileForm.payout_info" class="input" rows="3" placeholder="PayPal email, bank details, etc."></textarea>
              </div>
              <p v-if="profileSaved" class="save-success">✅ Profile saved!</p>
              <button class="btn btn-primary" @click="saveProfile" :disabled="profileSaving">
                {{ profileSaving ? 'Saving…' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </main>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '../api.js'

const TOKEN_KEY = 'affiliateToken'
const DATA_KEY = 'affiliateData'

const isLoggedIn = ref(false)
const affiliateData = ref(null)
const activeTab = ref('dashboard')
const copied = ref(false)

// Login
const loginForm = ref({ email: '', code: '' })
const loginLoading = ref(false)
const loginError = ref('')

// Referrals
const referrals = ref([])
const referralsLoading = ref(false)

// Payouts
const payouts = ref([])
const payoutsLoading = ref(false)

// Profile
const profileForm = ref({ name: '', payout_info: '' })
const profileSaving = ref(false)
const profileSaved = ref(false)

const tabs = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'referrals', label: '📋 Referrals' },
  { id: 'payouts',   label: '💰 Payouts' },
  { id: 'profile',   label: '⚙️ Profile' },
]

const referralLink = computed(() => {
  return `${window.location.origin}?ref=${affiliateData.value?.code}`
})

const twitterUrl = computed(() => {
  const text = encodeURIComponent(`Check this out! Use my link: ${referralLink.value}`)
  return `https://twitter.com/intent/tweet?text=${text}`
})

const whatsappUrl = computed(() => {
  const text = encodeURIComponent(`Check this out! Use my referral link: ${referralLink.value}`)
  return `https://wa.me/?text=${text}`
})

function getToken() { return localStorage.getItem(TOKEN_KEY) }

async function doLogin() {
  loginError.value = ''
  if (!loginForm.value.email || !loginForm.value.code) {
    loginError.value = 'Both email and referral code are required.'
    return
  }
  loginLoading.value = true
  try {
    const { data } = await api.post('/affiliates/portal/login', {
      email: loginForm.value.email.trim().toLowerCase(),
      referral_code: loginForm.value.code.trim().toUpperCase(),
    })
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(DATA_KEY, JSON.stringify(data.affiliate))
    affiliateData.value = data.affiliate
    profileForm.value = { name: data.affiliate.name || '', payout_info: data.affiliate.payout_info || '' }
    isLoggedIn.value = true
    activeTab.value = 'dashboard'
  } catch (e) {
    loginError.value = e.response?.data?.error || 'Invalid credentials. Please try again.'
  } finally {
    loginLoading.value = false
  }
}

function signOut() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(DATA_KEY)
  isLoggedIn.value = false
  affiliateData.value = null
}

async function loadReferrals() {
  if (referrals.value.length) return
  referralsLoading.value = true
  try {
    const { data } = await api.get('/affiliates/portal/referrals', {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
    referrals.value = data.referrals || data
  } catch {} finally { referralsLoading.value = false }
}

async function loadPayouts() {
  if (payouts.value.length) return
  payoutsLoading.value = true
  try {
    const { data } = await api.get('/affiliates/portal/payouts', {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
    payouts.value = data
  } catch {} finally { payoutsLoading.value = false }
}

watch(activeTab, (tab) => {
  if (tab === 'referrals') loadReferrals()
  if (tab === 'payouts') loadPayouts()
})

async function saveProfile() {
  profileSaving.value = true
  try {
    const { data } = await api.put('/affiliates/portal/profile', profileForm.value, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
    affiliateData.value = { ...affiliateData.value, ...data }
    localStorage.setItem(DATA_KEY, JSON.stringify(affiliateData.value))
    profileSaved.value = true
    setTimeout(() => { profileSaved.value = false }, 3000)
  } catch (e) {
    alert(e.response?.data?.error || 'Failed to save profile')
  } finally {
    profileSaving.value = false
  }
}

async function copyLink() {
  await navigator.clipboard.writeText(referralLink.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function fmt(v) {
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0) }
  catch { return `€${Number(v || 0).toFixed(2)}` }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(() => {
  const token = getToken()
  const data = localStorage.getItem(DATA_KEY)
  if (token && data) {
    try {
      affiliateData.value = JSON.parse(data)
      profileForm.value = { name: affiliateData.value.name || '', payout_info: affiliateData.value.payout_info || '' }
      isLoggedIn.value = true
    } catch { signOut() }
  }
})
</script>

<style scoped>
.affiliate-portal { min-height: 100vh; padding: 4rem 0 6rem; }

/* Login */
.login-wrap { max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
.login-card { padding: 2.5rem; border-radius: 1.5rem; text-align: center; }
.login-icon { font-size: 3rem; margin-bottom: .75rem; }
.login-title { font-size: 1.75rem; font-weight: 800; margin: 0 0 .5rem; }
.login-desc { font-size: .92rem; margin: 0 0 2rem; line-height: 1.6; }
.login-form { text-align: left; display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: .3rem; }
.flabel { font-size: .82rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }
.login-error { color: var(--accent); font-size: .85rem; margin: 0; }
.btn-full { width: 100%; }
.join-card { padding: 1.75rem; border-radius: 1.25rem; }
.join-card h3 { margin: 0 0 .5rem; font-size: 1.05rem; }
.join-card p { font-size: .88rem; margin: 0 0 1rem; line-height: 1.5; }

/* Dashboard */
.dashboard { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; align-items: flex-start; }
.sidebar { padding: 1.75rem; border-radius: 1.5rem; }
.aff-profile { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.aff-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--accent); color: white; font-size: 1.4rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.aff-name { font-weight: 700; font-size: 1rem; margin-bottom: .2rem; }
.status-badge { font-size: .72rem; font-weight: 700; padding: .15rem .55rem; border-radius: 99px; text-transform: uppercase; letter-spacing: .04em; }
.status-badge.active { background: rgba(72,187,120,.15); color: #48bb78; }
.status-badge.inactive { background: rgba(255,255,255,.06); color: var(--text-muted); }
.ref-code-box { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; padding: .875rem 1rem; margin-bottom: 1.5rem; }
.ref-code-label { font-size: .72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: .35rem; }
.ref-code { font-family: monospace; font-size: 1.25rem; font-weight: 800; letter-spacing: .08em; color: var(--accent); }
.signout-btn { width: 100%; }

/* Main */
.tabs { display: flex; gap: .5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.tab { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: .5rem 1rem; border-radius: .5rem; font-size: .88rem; font-weight: 600; transition: all .2s; }
.tab.active { background: var(--accent); color: white; }
.tab:hover:not(.active) { background: rgba(255,255,255,.06); color: var(--text); }

.stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { padding: 1.25rem; border-radius: 1rem; text-align: center; }
.stat-card.pending .stat-num { color: #f6ad55; }
.stat-num { font-size: 1.6rem; font-weight: 800; color: var(--accent); }
.stat-lbl { font-size: .78rem; color: var(--text-muted); margin-top: .25rem; text-transform: uppercase; letter-spacing: .06em; }

.ref-link-card { padding: 1.5rem; border-radius: 1rem; margin-bottom: 1rem; }
.ref-link-card h3 { margin: 0 0 1rem; font-size: 1rem; }
.ref-link-row { display: flex; gap: .75rem; margin-bottom: 1rem; }
.ref-link-row .input { flex: 1; font-family: monospace; font-size: .82rem; }
.share-btns { display: flex; gap: .75rem; flex-wrap: wrap; }
.share-btn { font-size: .85rem; padding: .4rem .875rem; }

.section { padding: 1.5rem; border-radius: 1rem; }
.section-title { font-size: .85rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); margin: 0 0 1rem; }

.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: .72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; padding: .5rem .75rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.table td { padding: .7rem .75rem; border-bottom: 1px solid rgba(255,255,255,.05); font-size: .87rem; vertical-align: middle; }

.status-pill { padding: .2rem .55rem; border-radius: 99px; font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: capitalize; }
.status-pill.approved, .status-pill.paid { background: rgba(72,187,120,.15); color: #48bb78; }
.status-pill.pending { background: rgba(246,173,85,.15); color: #f6ad55; }
.status-pill.rejected { background: rgba(245,101,101,.15); color: #f56565; }

.form-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.save-success { color: #48bb78; font-size: .88rem; margin: 0 0 .5rem; }
.loading, .empty { text-align: center; padding: 2rem; color: var(--text-muted); }

@media (max-width: 768px) {
  .dashboard { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
