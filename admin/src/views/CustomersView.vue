<template>
  <div class="customers-view">
    <div class="view-header">
      <h1>👤 Customers</h1>
      <div class="header-right">
        <span class="stat-label">{{ total }} total</span>
        <button class="btn btn-ghost btn-sm" @click="exportCsv" title="Export customers as CSV">⬇️ Export CSV</button>
        <button class="btn btn-ghost btn-sm" @click="$refs.csvInput.click()" title="Import customers from CSV">⬆️ Import CSV</button>
        <input ref="csvInput" type="file" accept=".csv" style="display:none" @change="importCsv" />
      </div>
    </div>
    <div v-if="importResult" class="import-banner glass">
      {{ importResult }}
      <button style="margin-left:1rem;opacity:.6;cursor:pointer;background:none;border:none;color:inherit" @click="importResult = ''">✕</button>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <input v-model="q" type="search" placeholder="Search by name or email…" class="input" @input="debouncedFetch" />
    </div>

    <!-- Table -->
    <div class="glass table-card">
      <div v-if="loading" class="loading-state">Loading customers…</div>
      <div v-else-if="customers.length === 0" class="empty-state">No customers found.</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Email</th>
            <th>Orders</th>
            <th>Total Spent</th>
            <th>🏆 Pts</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id" @click="openDetail(c)" style="cursor:pointer">
            <td>
              <div class="customer-name">{{ c.first_name }} {{ c.last_name }}</div>
            </td>
            <td>{{ c.email }}</td>
            <td>{{ c.order_count }}</td>
            <td>{{ currency }}{{ Number(c.total_spent).toFixed(2) }}</td>
            <td>
              <span v-if="c.points_balance > 0" class="badge badge-gold">🏆 {{ c.points_balance }}</span>
              <span v-else class="muted-pts">—</span>
            </td>
            <td>
              <span :class="['badge', c.active ? 'badge-green' : 'badge-red']">
                {{ c.active ? 'Active' : 'Disabled' }}
              </span>
            </td>
            <td>{{ formatDate(c.created_at) }}</td>
            <td @click.stop>
              <button class="btn btn-sm btn-ghost" @click="openDetail(c)">View</button>
              <button :class="['btn btn-sm', c.active ? 'btn-ghost' : 'btn-accent']" @click="toggleActive(c)">
                {{ c.active ? 'Disable' : 'Enable' }}
              </button>
              <button class="btn btn-sm btn-ghost btn-danger" @click="confirmDelete(c)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div v-if="detailCustomer" class="modal-overlay" @click.self="detailCustomer = null">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ detailCustomer.first_name }} {{ detailCustomer.last_name }}</h2>
          <button class="modal-close" @click="detailCustomer = null">✕</button>
        </div>
        <div class="modal-body" v-if="detailData">
          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Email</span><span>{{ detailData.email }}</span></div>
            <div class="detail-item"><span class="detail-label">Phone</span><span>{{ detailData.phone || '—' }}</span></div>
            <div class="detail-item"><span class="detail-label">Joined</span><span>{{ formatDate(detailData.created_at) }}</span></div>
            <div class="detail-item"><span class="detail-label">Status</span>
              <span :class="['badge', detailData.active ? 'badge-green' : 'badge-red']">{{ detailData.active ? 'Active' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- Addresses -->
          <h3 style="margin-top:1.5rem;">Saved Addresses</h3>
          <div v-if="detailData.addresses?.length === 0" class="muted">No saved addresses.</div>
          <div v-for="addr in detailData.addresses" :key="addr.id" class="address-card glass-sm">
            <div class="addr-label">{{ addr.label }} <span v-if="addr.is_default" class="badge badge-accent">Default</span></div>
            <div>{{ addr.first_name }} {{ addr.last_name }}</div>
            <div>{{ addr.address1 }}{{ addr.address2 ? ', ' + addr.address2 : '' }}</div>
            <div>{{ addr.city }}{{ addr.state ? ', ' + addr.state : '' }} {{ addr.zip }}</div>
            <div>{{ addr.country }}</div>
          </div>

          <!-- Orders -->
          <h3 style="margin-top:1.5rem;">Orders</h3>
          <div v-if="detailData.orders?.length === 0" class="muted">No orders yet.</div>
          <table v-else class="data-table mini-table">
            <thead><tr><th>Order #</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>
              <tr v-for="o in detailData.orders" :key="o.id">
                <td>{{ o.order_number }}</td>
                <td><span :class="['badge', statusClass(o.status)]">{{ o.status }}</span></td>
                <td>{{ currency }}{{ Number(o.total).toFixed(2) }}</td>
                <td>{{ formatDate(o.created_at) }}</td>
              </tr>
            </tbody>
          </table>

          <!-- Loyalty Points -->
          <h3 style="margin-top:1.5rem;">🏆 Loyalty Points</h3>
          <div class="loyalty-balance-card">
            <span class="loyalty-pts">{{ detailData.points_balance ?? 0 }}</span>
            <span class="loyalty-lbl">points</span>
          </div>

          <!-- Loyalty Transaction History -->
          <div v-if="loyaltyTxns.length > 0" style="margin-top:0.75rem;">
            <table class="data-table mini-table">
              <thead><tr><th>Type</th><th>Points</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>
                <tr v-for="tx in loyaltyTxns" :key="tx.id">
                  <td><span :class="['badge', tx.points > 0 ? 'badge-green' : 'badge-red']">{{ tx.type }}</span></td>
                  <td :style="{ color: tx.points > 0 ? '#4ade80' : '#f87171' }">
                    {{ tx.points > 0 ? '+' : '' }}{{ tx.points }}
                  </td>
                  <td class="muted">{{ tx.note || (tx.order_number ? `Order ${tx.order_number}` : '—') }}</td>
                  <td class="muted">{{ formatDate(tx.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="muted" style="font-size:.85rem;margin-top:.5rem;">No loyalty transactions yet.</div>

          <!-- Manual Adjustment -->
          <div class="loyalty-adjust glass-sm" style="margin-top:1rem;">
            <div style="font-size:.82rem;font-weight:600;margin-bottom:.5rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Manual Adjustment</div>
            <div style="display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap;">
              <div style="display:flex;flex-direction:column;gap:.3rem;">
                <label style="font-size:.75rem;color:var(--muted);">Points (+ to add, − to remove)</label>
                <input v-model.number="adjustPoints" type="number" class="input" style="width:120px;" placeholder="e.g. 50" />
              </div>
              <div style="display:flex;flex-direction:column;gap:.3rem;flex:1;min-width:160px;">
                <label style="font-size:.75rem;color:var(--muted);">Note</label>
                <input v-model="adjustNote" class="input" placeholder="Reason for adjustment" />
              </div>
              <button class="btn btn-primary btn-sm" @click="doAdjust" :disabled="adjusting">
                {{ adjusting ? '…' : 'Apply' }}
              </button>
            </div>
            <div v-if="adjustError" class="muted" style="color:#f87171;font-size:.8rem;margin-top:.4rem;">{{ adjustError }}</div>
            <div v-if="adjustSuccess" class="muted" style="color:#4ade80;font-size:.8rem;margin-top:.4rem;">{{ adjustSuccess }}</div>
          </div>

          <!-- CRM Notes -->
          <h3 style="margin-top:1.5rem;">📋 CRM Notes</h3>
          <div class="crm-notes-list">
            <div v-if="crmNotes.length === 0" class="muted" style="font-size:.85rem;">No notes yet.</div>
            <div
              v-for="n in crmNotes" :key="n.id"
              class="crm-note-card glass-sm"
              :class="{ 'crm-note-pinned': n.pinned }"
            >
              <div class="crm-note-header">
                <span class="crm-note-type">{{ crmNoteTypeIcon(n.type) }} {{ n.type }}</span>
                <span class="muted" style="font-size:.75rem;">{{ formatDate(n.created_at) }} · {{ n.admin_name }}</span>
                <div class="crm-note-actions">
                  <button class="btn btn-ghost btn-xs" @click="togglePinNote(n)" :title="n.pinned ? 'Unpin' : 'Pin'">{{ n.pinned ? '📌' : '📍' }}</button>
                  <button class="btn btn-ghost btn-xs btn-danger" @click="deleteNote(n.id)" title="Delete">✕</button>
                </div>
              </div>
              <div class="crm-note-body">{{ n.note }}</div>
            </div>
          </div>
          <!-- Add Note -->
          <div class="crm-add-note glass-sm" style="margin-top:.75rem;">
            <div style="font-size:.82rem;font-weight:600;margin-bottom:.5rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Add Note</div>
            <div style="display:flex;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap;">
              <select v-model="newNoteType" class="input" style="width:130px;font-size:.85rem;">
                <option value="note">📝 Note</option>
                <option value="call">📞 Call</option>
                <option value="email">📧 Email</option>
                <option value="meeting">🤝 Meeting</option>
                <option value="flag">🚩 Flag</option>
              </select>
              <label style="display:flex;align-items:center;gap:.35rem;font-size:.82rem;cursor:pointer;">
                <input type="checkbox" v-model="newNotePinned" style="accent-color:var(--accent);"> Pin
              </label>
            </div>
            <textarea v-model="newNoteText" class="input" rows="2" style="width:100%;resize:vertical;font-size:.85rem;" placeholder="Write a note about this customer…"></textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:.5rem;">
              <button class="btn btn-primary btn-sm" @click="addNote" :disabled="!newNoteText.trim() || addingNote">
                {{ addingNote ? '…' : 'Add Note' }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="loading-state">Loading…</div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal glass modal-sm">
        <div class="modal-header">
          <h2>Delete Customer</h2>
          <button class="modal-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete <strong>{{ deleteTarget.email }}</strong>? Their orders will be kept but unlinked.</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import api from '../api.js'

const auth = useAuthStore()
const customers = ref([])
const total = ref(0)
const importResult = ref('')

async function exportCsv() {
  const token = localStorage.getItem('pygmy_token')
  const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3200/api') + '/customers/export/csv', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `customers-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function importCsv(evt) {
  const file = evt.target.files[0]
  if (!file) return
  evt.target.value = ''
  const fd = new FormData()
  fd.append('file', file)
  try {
    const { data } = await api.post('/customer-import?mode=merge', fd)
    importResult.value = `✅ Import complete — ${data.created} created, ${data.updated} updated, ${data.skipped} skipped${data.errors?.length ? `, ${data.errors.length} errors` : ''}`
    fetchCustomers()
  } catch (e) {
    importResult.value = `❌ Import failed: ${e.response?.data?.error || e.message}`
  }
}
const loading = ref(false)
const q = ref('')
const detailCustomer = ref(null)
const detailData = ref(null)
const deleteTarget = ref(null)
const currency = ref('€')

// Loyalty state
const loyaltyTxns = ref([])
const adjustPoints = ref(0)
const adjustNote = ref('')
const adjusting = ref(false)
const adjustError = ref('')
const adjustSuccess = ref('')

// CRM Notes state
const crmNotes = ref([])
const newNoteText = ref('')
const newNoteType = ref('note')
const newNotePinned = ref(false)
const addingNote = ref(false)

let debounceTimer = null
function debouncedFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchCustomers, 300)
}

async function fetchCustomers() {
  loading.value = true
  try {
    const params = new URLSearchParams({ q: q.value, limit: 100, offset: 0 })
    const res = await fetch(`/api/customers?${params}`, { headers: { Authorization: `Bearer ${auth.token}` } })
    const d = await res.json()
    customers.value = d.customers || []
    total.value = d.total || 0
  } finally {
    loading.value = false
  }
}

async function fetchSettings() {
  const res = await fetch('/api/settings')
  const d = await res.json()
  currency.value = d.shop_currency_symbol || '€'
}

async function openDetail(c) {
  detailCustomer.value = c
  detailData.value = null
  loyaltyTxns.value = []
  crmNotes.value = []
  newNoteText.value = ''
  newNoteType.value = 'note'
  newNotePinned.value = false
  adjustPoints.value = 0
  adjustNote.value = ''
  adjustError.value = ''
  adjustSuccess.value = ''
  const res = await fetch(`/api/customers/${c.id}`, { headers: { Authorization: `Bearer ${auth.token}` } })
  detailData.value = await res.json()
  // Load loyalty transactions
  try {
    const txRes = await fetch(`/api/loyalty/admin/transactions/${c.id}`, { headers: { Authorization: `Bearer ${auth.token}` } })
    if (txRes.ok) loyaltyTxns.value = await txRes.json()
  } catch {}
  // Load CRM notes
  fetchCrmNotes(c.id)
}

async function fetchCrmNotes(customerId) {
  try {
    const res = await fetch(`/api/customer-notes/${customerId}`, { headers: { Authorization: `Bearer ${auth.token}` } })
    if (res.ok) crmNotes.value = await res.json()
  } catch {}
}

async function addNote() {
  if (!newNoteText.value.trim() || !detailCustomer.value) return
  addingNote.value = true
  try {
    const res = await fetch('/api/customer-notes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: detailCustomer.value.id,
        note: newNoteText.value.trim(),
        type: newNoteType.value,
        pinned: newNotePinned.value ? 1 : 0,
      })
    })
    if (res.ok) {
      const note = await res.json()
      // Re-sort: pinned first
      crmNotes.value = [note, ...crmNotes.value].sort((a, b) => b.pinned - a.pinned)
      newNoteText.value = ''
      newNotePinned.value = false
    }
  } finally {
    addingNote.value = false
  }
}

async function togglePinNote(n) {
  const res = await fetch(`/api/customer-notes/${n.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned: n.pinned ? 0 : 1 })
  })
  if (res.ok) {
    n.pinned = n.pinned ? 0 : 1
    // Re-sort
    crmNotes.value = [...crmNotes.value].sort((a, b) => b.pinned - a.pinned)
  }
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return
  const res = await fetch(`/api/customer-notes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } })
  if (res.ok) crmNotes.value = crmNotes.value.filter(n => n.id !== id)
}

function crmNoteTypeIcon(type) {
  return { note: '📝', call: '📞', email: '📧', meeting: '🤝', flag: '🚩' }[type] || '📝'
}

async function doAdjust() {
  adjustError.value = ''
  adjustSuccess.value = ''
  if (!adjustPoints.value || adjustPoints.value === 0) {
    adjustError.value = 'Enter a non-zero points value.'
    return
  }
  adjusting.value = true
  try {
    const res = await fetch('/api/loyalty/admin/adjust', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: detailCustomer.value.id, points: adjustPoints.value, note: adjustNote.value })
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || 'Failed')
    adjustSuccess.value = `Done! New balance: ${d.new_balance} pts`
    if (detailData.value) detailData.value.points_balance = d.new_balance
    // Update customer list
    const listCust = customers.value.find(c => c.id === detailCustomer.value.id)
    if (listCust) listCust.points_balance = d.new_balance
    adjustPoints.value = 0
    adjustNote.value = ''
    // Refresh transactions
    const txRes = await fetch(`/api/loyalty/admin/transactions/${detailCustomer.value.id}`, { headers: { Authorization: `Bearer ${auth.token}` } })
    if (txRes.ok) loyaltyTxns.value = await txRes.json()
  } catch (e) {
    adjustError.value = e.message
  } finally {
    adjusting.value = false
  }
}

async function toggleActive(c) {
  await fetch(`/api/customers/${c.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: !c.active })
  })
  c.active = !c.active
  if (detailData.value?.id === c.id) detailData.value.active = c.active
}

function confirmDelete(c) {
  deleteTarget.value = c
}

async function doDelete() {
  await fetch(`/api/customers/${deleteTarget.value.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  customers.value = customers.value.filter(c => c.id !== deleteTarget.value.id)
  total.value--
  deleteTarget.value = null
  if (detailCustomer.value?.id === deleteTarget.value?.id) detailCustomer.value = null
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusClass(s) {
  return { pending: 'badge-yellow', processing: 'badge-blue', shipped: 'badge-purple', completed: 'badge-green', cancelled: 'badge-red', refunded: 'badge-red' }[s] || ''
}

onMounted(() => {
  fetchCustomers()
  fetchSettings()
})
</script>

<style scoped>
.customers-view { padding: 2rem; max-width: 1200px; }
.view-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.view-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
.stat-label { font-size: 0.85rem; color: var(--muted); }
.search-bar { margin-bottom: 1rem; }
.search-bar .input { width: 100%; max-width: 400px; }
.table-card { border-radius: 1rem; overflow: hidden; }
.loading-state, .empty-state { padding: 2rem; text-align: center; color: var(--muted); }
.customer-name { font-weight: 600; }
.badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.badge-green { background: rgba(34,197,94,0.2); color: #4ade80; }
.badge-red { background: rgba(239,68,68,0.2); color: #f87171; }
.badge-yellow { background: rgba(234,179,8,0.2); color: #facc15; }
.badge-blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
.badge-purple { background: rgba(168,85,247,0.2); color: #c084fc; }
.badge-accent { background: rgba(var(--accent-rgb, 220,38,38), 0.2); color: var(--accent); }
.btn-danger { color: var(--accent); }

/* Detail Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 90%; max-width: 680px; max-height: 85vh; display: flex; flex-direction: column; border-radius: 1.25rem; }
.modal-sm { max-width: 420px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
.modal-header h2 { margin: 0; font-size: 1.15rem; }
.modal-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.1rem; padding: 0.25rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
.detail-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

.address-card { border-radius: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 0.75rem; font-size: 0.875rem; line-height: 1.6; }
.addr-label { font-weight: 600; margin-bottom: 0.25rem; }
.glass-sm { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
.muted { color: var(--muted); font-size: 0.875rem; }

.mini-table { font-size: 0.875rem; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }

h3 { font-size: 0.95rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
.badge-gold { background: rgba(234,179,8,0.2); color: #fbbf24; }
.muted-pts { color: var(--muted); font-size: 0.8rem; }
.loyalty-balance-card { display: inline-flex; align-items: baseline; gap: 0.4rem; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 0.75rem; padding: 0.5rem 1rem; }
.loyalty-pts { font-size: 1.5rem; font-weight: 700; color: #fbbf24; }
.loyalty-lbl { font-size: 0.8rem; color: var(--muted); }
.loyalty-adjust { border-radius: 0.75rem; padding: 0.875rem 1rem; margin-top: 0.75rem; }

/* CRM Notes */
.crm-notes-list { display: flex; flex-direction: column; gap: 0.6rem; }
.crm-note-card { border-radius: 0.75rem; padding: 0.75rem 1rem; }
.crm-note-pinned { border-color: rgba(251,191,36,0.4) !important; background: rgba(251,191,36,0.06) !important; }
.crm-note-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; flex-wrap: wrap; }
.crm-note-type { font-size: 0.78rem; font-weight: 600; text-transform: capitalize; color: var(--accent); flex: 1; }
.crm-note-actions { display: flex; gap: 0.25rem; margin-left: auto; }
.crm-note-body { font-size: 0.875rem; line-height: 1.5; white-space: pre-wrap; }
.crm-add-note { border-radius: 0.75rem; padding: 0.875rem 1rem; margin-top: 0.5rem; }
.btn-xs { padding: 0.15rem 0.4rem; font-size: 0.75rem; border-radius: 0.4rem; }
.btn-ghost { background: none; border: 1px solid transparent; color: var(--muted); cursor: pointer; transition: border-color 0.15s; }
.btn-ghost:hover { border-color: var(--border); color: var(--text); }
</style>
