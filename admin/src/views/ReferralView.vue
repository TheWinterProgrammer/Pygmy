<template>
  <div class="referral-view">
    <div class="view-header">
      <h1>🔗 Referral Program</h1>
      <p class="subtitle">Track customer referrals and reward credits issued</p>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_codes }}</div>
        <div class="stat-label">Active Referrers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_events }}</div>
        <div class="stat-label">Total Referrals</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.rewarded }}</div>
        <div class="stat-label">Rewarded</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmt(stats.total_credit_issued) }}</div>
        <div class="stat-label">Credit Issued</div>
      </div>
    </div>

    <!-- Enable toggle notice -->
    <div v-if="stats && !stats.enabled" class="notice-banner">
      ⚠️ Referral program is currently <strong>disabled</strong>. Enable it in
      <router-link to="/settings">Settings → 🔗 Referral Program</router-link>.
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="['tab', { active: tab === 'codes' }]" @click="tab = 'codes'">Referral Codes</button>
      <button :class="['tab', { active: tab === 'events' }]" @click="tab = 'events'">Referral Events</button>
    </div>

    <!-- Codes tab -->
    <div v-if="tab === 'codes'">
      <div class="toolbar">
        <input v-model="q" class="search-input" placeholder="Search by name, email or code…" @input="loadCodes" />
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th>Code</th>
              <th>Uses</th>
              <th>Credit Earned</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="codesLoading"><td colspan="5" class="center">Loading…</td></tr>
            <tr v-else-if="!codes.length"><td colspan="5" class="center empty">No referral codes yet. Customers generate them from their account.</td></tr>
            <tr v-for="c in codes" :key="c.id">
              <td>{{ c.first_name }} {{ c.last_name }}</td>
              <td>{{ c.customer_email }}</td>
              <td><span class="code-badge">{{ c.code }}</span></td>
              <td>{{ c.times_used }}</td>
              <td>{{ fmt(c.credit_earned) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Events tab -->
    <div v-if="tab === 'events'">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Referrer</th>
              <th>Referred Email</th>
              <th>Order</th>
              <th>Reward</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="eventsLoading"><td colspan="6" class="center">Loading…</td></tr>
            <tr v-else-if="!events.length"><td colspan="6" class="center empty">No referral events yet.</td></tr>
            <tr v-for="e in events" :key="e.id">
              <td>{{ fmtDate(e.created_at) }}</td>
              <td>{{ e.referrer_name }}</td>
              <td>{{ e.referred_email }}</td>
              <td>{{ e.order_number || '—' }}</td>
              <td>{{ e.reward_amount ? fmt(e.reward_amount) : '—' }}</td>
              <td>
                <span :class="['status-badge', e.reward_given ? 'rewarded' : 'pending']">
                  {{ e.reward_given ? '✓ Rewarded' : '⏳ Pending' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
const headers = () => ({ Authorization: `Bearer ${auth.token}` })

const tab = ref('codes')
const q = ref('')
const stats = ref(null)
const currencySymbol = ref('€')
const codes = ref([])
const codesLoading = ref(true)
const events = ref([])
const eventsLoading = ref(true)

async function loadStats() {
  const res = await fetch(`${API}/api/referral/stats`, { headers: headers() })
  stats.value = await res.json()
}

async function loadCodes() {
  codesLoading.value = true
  const res = await fetch(`${API}/api/referral?q=${encodeURIComponent(q.value)}`, { headers: headers() })
  codes.value = await res.json()
  codesLoading.value = false
}

async function loadEvents() {
  eventsLoading.value = true
  const res = await fetch(`${API}/api/referral/events?limit=100`, { headers: headers() })
  const d = await res.json()
  events.value = d.rows || []
  eventsLoading.value = false
}

function fmt(v) { return `${currencySymbol.value}${parseFloat(v || 0).toFixed(2)}` }

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

watch(tab, (t) => {
  if (t === 'events' && !events.value.length) loadEvents()
})

onMounted(async () => {
  const s = await fetch(`${API}/api/settings`, { headers: headers() }).then(r => r.json())
  currencySymbol.value = s.shop_currency_symbol || '€'
  loadStats()
  loadCodes()
})
</script>

<style scoped>
.referral-view { padding: 2rem; max-width: 1100px; margin: 0 auto; }
.view-header h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 0.25rem; }
.subtitle { color: #aaa; margin-bottom: 1.5rem; }
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: hsl(228,4%,15%); border-radius: 1rem; padding: 1rem 1.5rem; flex: 1; min-width: 130px; }
.stat-value { font-size: 1.4rem; font-weight: 700; color: hsl(355,70%,58%); }
.stat-label { font-size: 0.8rem; color: #aaa; margin-top: 0.25rem; }
.notice-banner { background: hsl(40,70%,20%); color: hsl(40,70%,75%); padding: 0.75rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1.5rem; }
.notice-banner a { color: hsl(355,70%,65%); }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.tab { background: hsl(228,4%,15%); border: none; color: #ccc; padding: 0.5rem 1.2rem; border-radius: 0.75rem; cursor: pointer; font-size: 0.9rem; }
.tab.active { background: hsl(355,70%,58%); color: #fff; font-weight: 600; }
.toolbar { margin-bottom: 1rem; }
.search-input { width: 100%; max-width: 400px; padding: 0.6rem 1rem; background: hsl(228,4%,15%); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; color: #fff; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
th { font-size: 0.8rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; }
.center { text-align: center; }
.empty { color: #666; padding: 2rem; }
.code-badge { background: hsl(228,4%,25%); color: #e0e0e0; padding: 0.2rem 0.7rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.9rem; font-weight: 600; letter-spacing: 0.05em; }
.status-badge { padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.8rem; font-weight: 600; }
.status-badge.rewarded { background: hsl(120,50%,20%); color: hsl(120,50%,70%); }
.status-badge.pending { background: hsl(40,60%,20%); color: hsl(40,60%,75%); }
</style>
