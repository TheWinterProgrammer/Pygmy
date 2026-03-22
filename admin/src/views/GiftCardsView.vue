<template>
  <div>
    <div class="page-header">
      <h1>🎁 Gift Cards</h1>
      <button class="btn btn-primary" @click="openCreate">＋ Issue Gift Card</button>
    </div>

    <!-- Stats strip -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-label">Total Issued</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Active</div>
        <div class="stat-value accent">{{ stats.active }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Total Value Issued</div>
        <div class="stat-value">{{ fmt(stats.totalIssued) }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Remaining Balance</div>
        <div class="stat-value">{{ fmt(stats.totalBalance) }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Total Redeemed</div>
        <div class="stat-value">{{ fmt(stats.totalRedeemed) }}</div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar glass">
      <input v-model="q" @input="fetchCards" placeholder="Search by code, name, or email…" class="input filter-input" />
      <select v-model="statusFilter" @change="fetchCards" class="input filter-select">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="used">Used</option>
        <option value="disabled">Disabled</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <div v-if="loading" class="loading-bar"></div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Recipient</th>
            <th>Balance</th>
            <th>Initial</th>
            <th>Status</th>
            <th>Expires</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!cards.length">
            <td colspan="8" class="empty">No gift cards found.</td>
          </tr>
          <tr v-for="card in cards" :key="card.id" class="clickable" @click="openDetail(card)">
            <td><code class="code-pill">{{ card.code }}</code></td>
            <td>
              <div class="cell-stack">
                <span>{{ card.recipient_name || '—' }}</span>
                <span class="text-muted small">{{ card.recipient_email || '' }}</span>
              </div>
            </td>
            <td><strong>{{ fmt(card.balance) }}</strong></td>
            <td class="text-muted">{{ fmt(card.initial_value) }}</td>
            <td><span :class="['status-pill', card.status]">{{ card.status }}</span></td>
            <td class="text-muted small">{{ card.expires_at ? fmtDate(card.expires_at) : '—' }}</td>
            <td class="text-muted small">{{ fmtDate(card.created_at) }}</td>
            <td @click.stop>
              <button class="btn btn-ghost btn-sm" @click="openAdjust(card)" title="Adjust balance">±</button>
              <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(card)" title="Delete">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="total > perPage">
      <button class="btn btn-ghost btn-sm" :disabled="offset === 0" @click="prev">← Prev</button>
      <span class="pag-info">{{ offset + 1 }}–{{ Math.min(offset + perPage, total) }} of {{ total }}</span>
      <button class="btn btn-ghost btn-sm" :disabled="offset + perPage >= total" @click="next">Next →</button>
    </div>

    <!-- ── Create Modal ─────────────────────────────────────────── -->
    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
      <div class="modal glass">
        <h2>🎁 Issue Gift Card</h2>
        <div class="form-group">
          <label>Value ({{ currency }})*</label>
          <input v-model.number="form.value" type="number" min="0.01" step="0.01" class="input" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Recipient Name</label>
            <input v-model="form.recipient_name" class="input" />
          </div>
          <div class="form-group">
            <label>Recipient Email</label>
            <input v-model="form.recipient_email" type="email" class="input" />
          </div>
        </div>
        <div class="form-group">
          <label>Sender Name</label>
          <input v-model="form.sender_name" class="input" />
        </div>
        <div class="form-group">
          <label>Message / Note</label>
          <textarea v-model="form.message" class="input" rows="2"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Expiry Date (optional)</label>
            <input v-model="form.expires_at" type="date" class="input" />
          </div>
          <div class="form-group">
            <label>Custom Code (optional)</label>
            <input v-model="form.custom_code" class="input" placeholder="Leave blank to auto-generate" />
          </div>
        </div>
        <div v-if="createError" class="error-msg">{{ createError }}</div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showCreate = false">Cancel</button>
          <button class="btn btn-primary" :disabled="saving" @click="createCard">
            {{ saving ? 'Issuing…' : '🎁 Issue Card' }}
          </button>
        </div>
        <!-- Success code reveal -->
        <div v-if="createdCode" class="code-reveal">
          <p>Gift card issued! Share this code with the recipient:</p>
          <div class="code-display">{{ createdCode }}</div>
          <button class="btn btn-ghost btn-sm" @click="copyCode(createdCode)">{{ copied ? '✓ Copied!' : '📋 Copy' }}</button>
        </div>
      </div>
    </div>

    <!-- ── Detail Modal ─────────────────────────────────────────── -->
    <div v-if="detail" class="modal-backdrop" @click.self="detail = null">
      <div class="modal glass large">
        <h2>🎁 {{ detail.card.code }}</h2>
        <div class="detail-grid">
          <div><span class="dlabel">Status</span><span :class="['status-pill', detail.card.status]">{{ detail.card.status }}</span></div>
          <div><span class="dlabel">Balance</span><strong>{{ fmt(detail.card.balance) }}</strong></div>
          <div><span class="dlabel">Initial Value</span>{{ fmt(detail.card.initial_value) }}</div>
          <div><span class="dlabel">Currency</span>{{ detail.card.currency }}</div>
          <div><span class="dlabel">Recipient</span>{{ detail.card.recipient_name || '—' }}</div>
          <div><span class="dlabel">Email</span>{{ detail.card.recipient_email || '—' }}</div>
          <div><span class="dlabel">Sender</span>{{ detail.card.sender_name || '—' }}</div>
          <div><span class="dlabel">Expires</span>{{ detail.card.expires_at ? fmtDate(detail.card.expires_at) : 'Never' }}</div>
          <div v-if="detail.card.message" style="grid-column:1/-1"><span class="dlabel">Message</span>{{ detail.card.message }}</div>
          <div><span class="dlabel">Created By</span>{{ detail.card.created_by_name || 'System' }}</div>
          <div><span class="dlabel">Created</span>{{ fmtDate(detail.card.created_at) }}</div>
        </div>

        <div class="detail-section-header">Status</div>
        <div class="form-row">
          <select v-model="detail.card.status" class="input" @change="saveStatus">
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="used">Used</option>
          </select>
          <button class="btn btn-ghost btn-sm" @click="saveStatus">Save Status</button>
        </div>

        <div class="detail-section-header">Transaction History</div>
        <div v-if="!detail.transactions.length" class="text-muted small">No transactions yet.</div>
        <table v-else class="table compact">
          <thead><tr><th>Type</th><th>Amount</th><th>Balance After</th><th>Order</th><th>Note</th><th>Date</th></tr></thead>
          <tbody>
            <tr v-for="t in detail.transactions" :key="t.id">
              <td><span :class="['tx-type', t.type]">{{ t.type }}</span></td>
              <td :class="t.amount < 0 ? 'negative' : 'positive'">{{ t.amount > 0 ? '+' : '' }}{{ fmt(t.amount) }}</td>
              <td>{{ fmt(t.balance_after) }}</td>
              <td class="text-muted small">{{ t.order_number || '—' }}</td>
              <td class="text-muted small">{{ t.note || '—' }}</td>
              <td class="text-muted small">{{ fmtDate(t.created_at) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="detail = null">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Adjust Modal ─────────────────────────────────────────── -->
    <div v-if="adjusting" class="modal-backdrop" @click.self="adjusting = null">
      <div class="modal glass small">
        <h2>± Adjust Balance</h2>
        <p class="text-muted small">Card: <strong>{{ adjusting.code }}</strong> · Current: <strong>{{ fmt(adjusting.balance) }}</strong></p>
        <div class="form-group">
          <label>Amount (positive = add, negative = deduct)</label>
          <input v-model.number="adjustAmount" type="number" step="0.01" class="input" placeholder="e.g. 10 or -5" />
        </div>
        <div class="form-group">
          <label>Note (optional)</label>
          <input v-model="adjustNote" class="input" />
        </div>
        <div v-if="adjustError" class="error-msg">{{ adjustError }}</div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="adjusting = null">Cancel</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveAdjust">{{ saving ? 'Saving…' : 'Apply' }}</button>
        </div>
      </div>
    </div>

    <!-- ── Delete Confirm ───────────────────────────────────────── -->
    <div v-if="deleting" class="modal-backdrop" @click.self="deleting = null">
      <div class="modal glass small">
        <h2>Delete Gift Card?</h2>
        <p class="text-muted">This will permanently delete <strong>{{ deleting.code }}</strong> and all its transaction history. This cannot be undone.</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleting = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteCard">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const cards = ref([])
const total = ref(0)
const loading = ref(false)
const q = ref('')
const statusFilter = ref('')
const offset = ref(0)
const perPage = 30
const stats = ref(null)
const currency = ref('€')

const showCreate = ref(false)
const saving = ref(false)
const createError = ref('')
const createdCode = ref('')
const copied = ref(false)
const form = ref(defaultForm())

const detail = ref(null)
const adjusting = ref(null)
const adjustAmount = ref(0)
const adjustNote = ref('')
const adjustError = ref('')
const deleting = ref(null)

function defaultForm() {
  return { value: '', recipient_name: '', recipient_email: '', sender_name: '', message: '', expires_at: '', custom_code: '' }
}

function fmt(v) {
  return `${currency.value}${Number(v || 0).toFixed(2)}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function fetchCards() {
  loading.value = true
  try {
    const { data } = await api.get('/gift-cards', { params: { q: q.value, status: statusFilter.value, limit: perPage, offset: offset.value } })
    cards.value = data.cards
    total.value = data.total
  } finally { loading.value = false }
}

async function fetchStats() {
  const { data } = await api.get('/gift-cards/admin/stats')
  stats.value = data
}

async function fetchCurrency() {
  try {
    const { data } = await api.get('/settings')
    currency.value = data.shop_currency_symbol || '€'
  } catch {}
}

function prev() { offset.value = Math.max(0, offset.value - perPage); fetchCards() }
function next() { offset.value += perPage; fetchCards() }

function openCreate() {
  form.value = defaultForm()
  createError.value = ''
  createdCode.value = ''
  showCreate.value = true
}

async function createCard() {
  if (!form.value.value || form.value.value <= 0) { createError.value = 'Value is required'; return }
  saving.value = true
  createError.value = ''
  try {
    const { data } = await api.post('/gift-cards', form.value)
    createdCode.value = data.code
    fetchCards()
    fetchStats()
  } catch (e) {
    createError.value = e.response?.data?.error || 'Failed to issue gift card'
  } finally { saving.value = false }
}

async function openDetail(card) {
  const { data } = await api.get(`/gift-cards/${card.id}`)
  detail.value = data
}

async function saveStatus() {
  await api.put(`/gift-cards/${detail.value.card.id}`, { status: detail.value.card.status })
  fetchCards()
}

function openAdjust(card) {
  adjusting.value = card
  adjustAmount.value = 0
  adjustNote.value = ''
  adjustError.value = ''
}

async function saveAdjust() {
  if (!adjustAmount.value) { adjustError.value = 'Enter an amount'; return }
  saving.value = true
  try {
    await api.post(`/gift-cards/${adjusting.value.id}/adjust`, { amount: adjustAmount.value, note: adjustNote.value })
    adjusting.value = null
    fetchCards()
    fetchStats()
  } catch (e) {
    adjustError.value = e.response?.data?.error || 'Failed to adjust'
  } finally { saving.value = false }
}

function confirmDelete(card) { deleting.value = card }

async function deleteCard() {
  await api.delete(`/gift-cards/${deleting.value.id}`)
  deleting.value = null
  fetchCards()
  fetchStats()
}

function copyCode(code) {
  navigator.clipboard.writeText(code)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

onMounted(() => {
  fetchCards()
  fetchStats()
  fetchCurrency()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }

.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
.stat-card { padding: 0.9rem 1rem; border-radius: var(--radius); }
.stat-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.3rem; }
.stat-value { font-size: 1.4rem; font-weight: 700; }
.stat-value.accent { color: var(--accent); }

.filter-bar { display: flex; gap: 0.75rem; padding: 0.85rem 1rem; margin-bottom: 1rem; border-radius: var(--radius); }
.filter-input { flex: 1; }
.filter-select { min-width: 140px; }

.table-wrap { border-radius: var(--radius); overflow: hidden; margin-bottom: 1rem; }
.table { width: 100%; border-collapse: collapse; }
.table th { padding: 0.6rem 0.85rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); text-align: left; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border); }
.table td { padding: 0.7rem 0.85rem; border-bottom: 1px solid var(--border); font-size: 0.875rem; vertical-align: middle; }
.table tr:last-child td { border-bottom: none; }
.table.compact td, .table.compact th { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
.clickable { cursor: pointer; transition: background 0.15s; }
.clickable:hover { background: rgba(255,255,255,0.04); }
.empty { text-align: center; color: var(--text-muted); padding: 2rem !important; }

.code-pill { background: rgba(255,255,255,0.08); padding: 0.2rem 0.5rem; border-radius: 4px; font-family: monospace; font-size: 0.8rem; letter-spacing: 0.05em; white-space: nowrap; }
.cell-stack { display: flex; flex-direction: column; gap: 0.1rem; }
.small { font-size: 0.78rem; }
.text-muted { color: var(--text-muted); }
.positive { color: #4ade80; }
.negative { color: var(--accent); }

.status-pill { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
.status-pill.active { background: rgba(74,222,128,0.15); color: #4ade80; }
.status-pill.used { background: rgba(148,163,184,0.15); color: #94a3b8; }
.status-pill.disabled { background: rgba(239,68,68,0.15); color: #ef4444; }

.tx-type { display: inline-block; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
.tx-type.earn { background: rgba(74,222,128,0.15); color: #4ade80; }
.tx-type.redeem { background: rgba(239,68,68,0.15); color: #ef4444; }
.tx-type.adjust { background: rgba(251,191,36,0.15); color: #fbbf24; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 0.5rem; }
.pag-info { font-size: 0.85rem; color: var(--text-muted); }

.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem; }
.modal { padding: 1.75rem; border-radius: var(--radius-lg); width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
.modal.large { max-width: 700px; }
.modal.small { max-width: 420px; }
.modal h2 { margin-bottom: 1.25rem; font-size: 1.2rem; font-weight: 700; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.55rem 0.75rem; color: var(--text); font-size: 0.875rem; font-family: inherit; }
.input:focus { outline: none; border-color: var(--accent); }
.modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }
.error-msg { color: var(--accent); font-size: 0.82rem; margin-top: 0.5rem; }
.btn-danger { background: var(--accent); color: #fff; border: none; }

.detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.6rem; margin-bottom: 1.25rem; }
.detail-grid > div { display: flex; flex-direction: column; gap: 0.2rem; }
.dlabel { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
.detail-section-header { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; margin: 1rem 0 0.75rem; }

.code-reveal { margin-top: 1.25rem; padding: 1rem; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.3); border-radius: var(--radius); text-align: center; }
.code-reveal p { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
.code-display { font-family: monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.1em; color: #4ade80; margin-bottom: 0.5rem; }
</style>
