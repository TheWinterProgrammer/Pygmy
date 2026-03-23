<template>
  <div class="store-credit-view">
    <div class="view-header">
      <h1>💳 Store Credit</h1>
      <p class="subtitle">Manage customer store credit balances and issue manual adjustments</p>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ fmt(stats.outstanding) }}</div>
        <div class="stat-label">Outstanding Credit</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.customers_with_credit }}</div>
        <div class="stat-label">Customers with Credit</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmt(stats.total_issued) }}</div>
        <div class="stat-label">Total Issued</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ fmt(stats.total_redeemed) }}</div>
        <div class="stat-label">Total Redeemed</div>
      </div>
    </div>

    <!-- Search + actions -->
    <div class="toolbar">
      <input v-model="q" class="search-input" placeholder="Search by name or email…" @input="load" />
      <button class="btn-primary" @click="openAdjust(null)">+ Issue Credit</button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Email</th>
            <th>Balance</th>
            <th>Transactions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="5" class="center">Loading…</td></tr>
          <tr v-else-if="!rows.length"><td colspan="5" class="center empty">No customers with store credit found.</td></tr>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.first_name }} {{ row.last_name }}</td>
            <td>{{ row.email }}</td>
            <td><span class="credit-badge">{{ fmt(row.store_credit_balance) }}</span></td>
            <td>{{ row.tx_count }}</td>
            <td>
              <button class="btn-sm" @click="openHistory(row)">📋 History</button>
              <button class="btn-sm" @click="openAdjust(row)">✏️ Adjust</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Adjust Modal -->
    <div v-if="adjustModal.open" class="modal-overlay" @click.self="adjustModal.open = false">
      <div class="modal-card">
        <h2>{{ adjustModal.customer ? 'Adjust Credit' : 'Issue Store Credit' }}</h2>
        <p v-if="adjustModal.customer" class="modal-sub">
          {{ adjustModal.customer.first_name }} {{ adjustModal.customer.last_name }} — current balance:
          <strong>{{ fmt(adjustModal.customer.store_credit_balance) }}</strong>
        </p>

        <div v-if="!adjustModal.customer" class="form-group">
          <label>Customer Email</label>
          <input v-model="adjustModal.email" class="form-input" placeholder="customer@example.com" />
        </div>
        <div class="form-group">
          <label>Amount (positive = add credit, negative = deduct)</label>
          <input v-model.number="adjustModal.amount" type="number" step="0.01" class="form-input" placeholder="e.g. 10.00" />
        </div>
        <div class="form-group">
          <label>Note (optional)</label>
          <input v-model="adjustModal.note" class="form-input" placeholder="Reason for adjustment" />
        </div>
        <p v-if="adjustModal.error" class="error-text">{{ adjustModal.error }}</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="adjustModal.open = false">Cancel</button>
          <button class="btn-primary" :disabled="adjustModal.saving" @click="saveAdjust">
            {{ adjustModal.saving ? 'Saving…' : 'Apply' }}
          </button>
        </div>
      </div>
    </div>

    <!-- History Modal -->
    <div v-if="historyModal.open" class="modal-overlay" @click.self="historyModal.open = false">
      <div class="modal-card wide">
        <h2>Transaction History</h2>
        <p class="modal-sub">
          {{ historyModal.customer?.first_name }} {{ historyModal.customer?.last_name }} —
          {{ historyModal.customer?.email }}
        </p>
        <p class="balance-display">Balance: <strong>{{ fmt(historyModal.customer?.store_credit_balance) }}</strong></p>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!historyModal.transactions.length">
                <td colspan="4" class="center empty">No transactions.</td>
              </tr>
              <tr v-for="tx in historyModal.transactions" :key="tx.id">
                <td>{{ fmtDate(tx.created_at) }}</td>
                <td><span :class="['type-badge', tx.type]">{{ tx.type }}</span></td>
                <td :class="tx.amount > 0 ? 'positive' : 'negative'">
                  {{ tx.amount > 0 ? '+' : '' }}{{ fmt(tx.amount) }}
                </td>
                <td>{{ tx.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="historyModal.open = false">Close</button>
          <button class="btn-primary" @click="openAdjust(historyModal.customer)">✏️ Adjust Balance</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
const headers = () => ({ Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' })

const currencySymbol = ref('€')
const rows = ref([])
const loading = ref(true)
const q = ref('')
const stats = ref(null)

const adjustModal = ref({ open: false, customer: null, email: '', amount: 0, note: '', saving: false, error: '' })
const historyModal = ref({ open: false, customer: null, transactions: [] })

async function load() {
  loading.value = true
  const res = await fetch(`${API}/api/store-credit?q=${encodeURIComponent(q.value)}&limit=100`, { headers: headers() })
  rows.value = await res.json()
  loading.value = false
}

async function loadStats() {
  const res = await fetch(`${API}/api/store-credit/stats`, { headers: headers() })
  stats.value = await res.json()
}

async function openHistory(row) {
  const res = await fetch(`${API}/api/store-credit/customer/${row.id}`, { headers: headers() })
  const data = await res.json()
  historyModal.value = { open: true, customer: data.customer, transactions: data.transactions }
}

function openAdjust(customer) {
  adjustModal.value = { open: true, customer, email: '', amount: 0, note: '', saving: false, error: '' }
  if (historyModal.value.open) historyModal.value.open = false
}

async function saveAdjust() {
  const m = adjustModal.value
  if (!m.amount) { m.error = 'Amount is required'; return }

  let customerId = m.customer?.id
  if (!customerId && m.email) {
    // look up customer by email
    const res = await fetch(`${API}/api/customers?q=${encodeURIComponent(m.email)}&limit=1`, { headers: headers() })
    const data = await res.json()
    const found = Array.isArray(data) ? data[0] : (data.rows || [])[0]
    if (!found) { m.error = 'Customer not found'; return }
    customerId = found.id
  }
  if (!customerId) { m.error = 'Customer not found'; return }

  m.saving = true
  m.error = ''
  const res = await fetch(`${API}/api/store-credit/adjust`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ customer_id: customerId, amount: m.amount, note: m.note }),
  })
  if (res.ok) {
    m.open = false
    load()
    loadStats()
  } else {
    const d = await res.json()
    m.error = d.error || 'Failed to adjust'
  }
  m.saving = false
}

function fmt(v) { return `${currencySymbol.value}${parseFloat(v || 0).toFixed(2)}` }

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  const s = await fetch(`${API}/api/settings`, { headers: headers() }).then(r => r.json())
  currencySymbol.value = s.shop_currency_symbol || '€'
  load()
  loadStats()
})
</script>

<style scoped>
.store-credit-view { padding: 2rem; max-width: 1100px; margin: 0 auto; }
.view-header h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 0.25rem; }
.subtitle { color: #aaa; margin-bottom: 1.5rem; }
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { background: hsl(228,4%,15%); border-radius: 1rem; padding: 1rem 1.5rem; flex: 1; min-width: 140px; }
.stat-value { font-size: 1.4rem; font-weight: 700; color: hsl(355,70%,58%); }
.stat-label { font-size: 0.8rem; color: #aaa; margin-top: 0.25rem; }
.toolbar { display: flex; gap: 1rem; margin-bottom: 1rem; }
.search-input { flex: 1; padding: 0.6rem 1rem; background: hsl(228,4%,15%); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; color: #fff; }
.btn-primary { background: hsl(355,70%,58%); color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 0.75rem; cursor: pointer; font-weight: 600; }
.btn-secondary { background: hsl(228,4%,20%); color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 0.75rem; cursor: pointer; }
.btn-sm { background: hsl(228,4%,20%); color: #fff; border: none; padding: 0.3rem 0.7rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.8rem; margin-right: 0.4rem; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
th { font-size: 0.8rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; }
.center { text-align: center; }
.empty { color: #666; padding: 2rem; }
.credit-badge { background: hsl(355,70%,20%); color: hsl(355,70%,70%); padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.85rem; font-weight: 600; }
.type-badge { padding: 0.15rem 0.5rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
.type-badge.manual { background: hsl(228,4%,25%); color: #ccc; }
.type-badge.referral { background: hsl(120,50%,20%); color: hsl(120,50%,70%); }
.type-badge.refund { background: hsl(200,60%,20%); color: hsl(200,60%,70%); }
.type-badge.redemption { background: hsl(355,60%,20%); color: hsl(355,60%,70%); }
.positive { color: hsl(120,50%,60%); font-weight: 600; }
.negative { color: hsl(355,70%,58%); font-weight: 600; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal-card { background: hsl(228,4%,15%); border-radius: 1.5rem; padding: 2rem; width: 100%; max-width: 500px; }
.modal-card.wide { max-width: 700px; max-height: 80vh; overflow-y: auto; }
.modal-card h2 { margin-bottom: 0.5rem; }
.modal-sub { color: #aaa; margin-bottom: 1rem; }
.balance-display { margin-bottom: 1rem; color: #ccc; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.4rem; font-size: 0.85rem; color: #aaa; }
.form-input { width: 100%; padding: 0.6rem 1rem; background: hsl(228,4%,10%); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; color: #fff; box-sizing: border-box; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }
.error-text { color: hsl(355,70%,58%); margin-bottom: 0.5rem; }
</style>
