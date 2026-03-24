<template>
  <div class="loyalty-rewards-view">
    <div class="page-header">
      <div>
        <h1>🎁 Loyalty Rewards</h1>
        <p class="subtitle">Create rewards customers can redeem with their loyalty points</p>
      </div>
      <button class="btn-accent" @click="openCreate">+ Add Reward</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Rewards</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_redemptions }}</div>
        <div class="stat-label">Redemptions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.points_redeemed?.toLocaleString() }}</div>
        <div class="stat-label">Points Redeemed</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button :class="{ active: tab === 'rewards' }" @click="tab = 'rewards'">🎁 Rewards</button>
      <button :class="{ active: tab === 'redemptions' }" @click="tab = 'redemptions'; loadRedemptions()">📜 Redemption History</button>
    </div>

    <!-- Rewards Tab -->
    <div v-if="tab === 'rewards'">
      <div v-if="loading" class="loading">Loading…</div>
      <div v-else-if="rewards.length === 0" class="empty-state">
        <p>No rewards yet. Create one to let customers redeem their points!</p>
      </div>
      <div v-else class="rewards-grid">
        <div v-for="r in rewards" :key="r.id" class="reward-card glass-card">
          <div class="reward-image" :style="r.image ? `background-image:url(${r.image})` : ''">
            <span v-if="!r.image" class="reward-emoji">{{ typeEmoji(r.type) }}</span>
          </div>
          <div class="reward-body">
            <div class="reward-top">
              <span class="type-badge" :class="r.type">{{ typeLabel(r.type) }}</span>
              <span :class="r.active ? 'status-pill active' : 'status-pill inactive'">{{ r.active ? 'Active' : 'Inactive' }}</span>
            </div>
            <h3>{{ r.name }}</h3>
            <p class="reward-desc">{{ r.description }}</p>
            <div class="reward-meta">
              <span class="points-cost">🏆 {{ r.points_cost }} pts</span>
              <span v-if="r.value" class="reward-value">{{ rewardValueLabel(r) }}</span>
              <span v-if="r.stock >= 0" class="stock-pill">{{ r.stock - r.redeemed_count }} left</span>
              <span v-else class="stock-pill unlimited">∞ unlimited</span>
            </div>
            <div class="card-actions">
              <button class="btn-sm" @click="openEdit(r)">✏️ Edit</button>
              <button class="btn-sm" @click="toggleActive(r)">{{ r.active ? '⏸ Disable' : '▶ Enable' }}</button>
              <button class="btn-sm danger" @click="confirmDelete(r)">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Redemptions Tab -->
    <div v-if="tab === 'redemptions'">
      <div class="filter-bar">
        <input v-model="redQ" placeholder="Search customer…" @input="loadRedemptions" class="search-input" />
        <select v-model="redRewardId" @change="loadRedemptions" class="filter-select">
          <option value="">All Rewards</option>
          <option v-for="r in allRewards" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
      <div v-if="redemptionsLoading" class="loading">Loading…</div>
      <table v-else-if="redemptions.length" class="data-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Reward</th>
            <th>Points</th>
            <th>Coupon</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="red in redemptions" :key="red.id">
            <td>
              <div class="name-email">
                <strong>{{ red.customer_name }}</strong>
                <small>{{ red.customer_email }}</small>
              </div>
            </td>
            <td>
              <span class="type-badge" :class="red.reward_type">{{ red.reward_name }}</span>
            </td>
            <td><span class="points-cost">{{ red.points_used }}</span></td>
            <td><code v-if="red.coupon_code" class="coupon-code">{{ red.coupon_code }}</code><span v-else>—</span></td>
            <td><span class="status-pill" :class="red.status">{{ red.status }}</span></td>
            <td>{{ fmtDate(red.redeemed_at) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">No redemptions yet.</div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal glass-card">
        <div class="modal-header">
          <h2>{{ editing ? 'Edit Reward' : 'New Reward' }}</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full">
              <label>Name *</label>
              <input v-model="form.name" placeholder="e.g. 10% Off Coupon" class="form-input" />
            </div>
            <div class="form-group full">
              <label>Description</label>
              <textarea v-model="form.description" rows="2" placeholder="What does this reward give the customer?" class="form-input"></textarea>
            </div>
            <div class="form-group">
              <label>Type *</label>
              <select v-model="form.type" class="form-input">
                <option value="coupon">🎟️ % Off Coupon</option>
                <option value="credit">💳 Store Credit</option>
                <option value="free_shipping">📦 Free Shipping</option>
                <option value="product">🎁 Free Product</option>
              </select>
            </div>
            <div class="form-group">
              <label>Points Cost *</label>
              <input v-model.number="form.points_cost" type="number" min="1" class="form-input" />
            </div>
            <div class="form-group" v-if="form.type === 'coupon' || form.type === 'credit'">
              <label>{{ form.type === 'coupon' ? 'Discount %' : 'Credit Amount (€)' }}</label>
              <input v-model.number="form.value" type="number" min="0" step="0.01" class="form-input" />
            </div>
            <div class="form-group">
              <label>Stock (-1 = unlimited)</label>
              <input v-model.number="form.stock" type="number" min="-1" class="form-input" />
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input v-model.number="form.sort_order" type="number" min="0" class="form-input" />
            </div>
            <div class="form-group full">
              <label>Image URL (optional)</label>
              <input v-model="form.image" placeholder="https://…" class="form-input" />
            </div>
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" v-model="form.active" />
                Active
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn-secondary">Cancel</button>
          <button @click="saveReward" class="btn-accent" :disabled="saving">{{ saving ? 'Saving…' : 'Save Reward' }}</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal confirm-modal glass-card">
        <h3>Delete "{{ deleteTarget.name }}"?</h3>
        <p>This will permanently remove the reward. Existing redemptions are preserved.</p>
        <div class="modal-footer">
          <button @click="deleteTarget = null" class="btn-secondary">Cancel</button>
          <button @click="deleteReward" class="btn-danger">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const tab = ref('rewards')
const loading = ref(false)
const rewards = ref([])
const allRewards = ref([])
const stats = ref(null)
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const deleteTarget = ref(null)
const redemptions = ref([])
const redemptionsLoading = ref(false)
const redQ = ref('')
const redRewardId = ref('')

const emptyForm = () => ({
  name: '', description: '', type: 'coupon', points_cost: 100,
  value: 10, image: '', stock: -1, active: true, sort_order: 0
})
const form = ref(emptyForm())

onMounted(async () => {
  await loadAll()
})

async function loadAll() {
  loading.value = true
  try {
    const [rRes, sRes] = await Promise.all([
      api.get('/loyalty-rewards?all=1'),
      api.get('/loyalty-rewards/stats/summary')
    ])
    rewards.value = rRes.data
    allRewards.value = rRes.data
    stats.value = sRes.data
  } finally {
    loading.value = false
  }
}

async function loadRedemptions() {
  redemptionsLoading.value = true
  try {
    const res = await api.get('/loyalty-rewards/admin/redemptions', {
      params: { q: redQ.value, reward_id: redRewardId.value }
    })
    redemptions.value = res.data
  } finally {
    redemptionsLoading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = emptyForm()
  showModal.value = true
}

function openEdit(r) {
  editing.value = r
  form.value = { ...r, active: !!r.active }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editing.value = null
}

async function saveReward() {
  if (!form.value.name) return alert('Name is required')
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/loyalty-rewards/${editing.value.id}`, form.value)
    } else {
      await api.post('/loyalty-rewards', form.value)
    }
    closeModal()
    await loadAll()
  } finally {
    saving.value = false
  }
}

async function toggleActive(r) {
  await api.put(`/loyalty-rewards/${r.id}`, { active: r.active ? 0 : 1 })
  await loadAll()
}

function confirmDelete(r) {
  deleteTarget.value = r
}

async function deleteReward() {
  await api.delete(`/loyalty-rewards/${deleteTarget.value.id}`)
  deleteTarget.value = null
  await loadAll()
}

function typeEmoji(t) {
  return { coupon: '🎟️', credit: '💳', free_shipping: '📦', product: '🎁' }[t] || '🎁'
}
function typeLabel(t) {
  return { coupon: '% Coupon', credit: 'Store Credit', free_shipping: 'Free Shipping', product: 'Free Product' }[t] || t
}
function rewardValueLabel(r) {
  if (r.type === 'coupon') return `${r.value}% off`
  if (r.type === 'credit') return `€${r.value}`
  return ''
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : '—'
}
</script>

<style scoped>
.loyalty-rewards-view { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.page-header h1 { margin: 0 0 .25rem; }
.subtitle { color: var(--text-muted, #aaa); margin: 0; }
.stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
.stat-card { background: var(--surface, hsl(228,4%,15%)); padding: 1.25rem; border-radius: 1rem; text-align: center; }
.stat-value { font-size: 1.75rem; font-weight: 700; color: var(--accent, hsl(355,70%,58%)); }
.stat-label { font-size: .75rem; color: #aaa; margin-top: .25rem; }
.tab-bar { display: flex; gap: .5rem; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,.1); padding-bottom: .5rem; }
.tab-bar button { padding: .5rem 1rem; border: none; background: none; color: #aaa; cursor: pointer; border-radius: .5rem; font-size: .9rem; }
.tab-bar button.active { background: var(--accent, hsl(355,70%,58%)); color: #fff; }
.rewards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
.reward-card { border-radius: 1.25rem; overflow: hidden; display: flex; flex-direction: column; }
.reward-image { height: 120px; background: rgba(255,255,255,.05) center/cover no-repeat; display: flex; align-items: center; justify-content: center; }
.reward-emoji { font-size: 3rem; }
.reward-body { padding: 1rem; display: flex; flex-direction: column; gap: .5rem; flex: 1; }
.reward-top { display: flex; justify-content: space-between; align-items: center; }
.reward-body h3 { margin: 0; font-size: 1rem; }
.reward-desc { font-size: .82rem; color: #aaa; margin: 0; flex: 1; }
.reward-meta { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
.points-cost { font-weight: 700; color: var(--accent, hsl(355,70%,58%)); font-size: .9rem; }
.reward-value { font-size: .82rem; background: rgba(255,255,255,.08); padding: .2rem .5rem; border-radius: .5rem; }
.stock-pill { font-size: .75rem; background: rgba(255,255,255,.06); padding: .2rem .5rem; border-radius: .5rem; }
.stock-pill.unlimited { color: #aaa; }
.card-actions { display: flex; gap: .5rem; margin-top: .5rem; }
.type-badge { font-size: .72rem; padding: .2rem .5rem; border-radius: .4rem; background: rgba(255,255,255,.08); }
.type-badge.coupon { background: rgba(90,200,120,.2); color: #5ac878; }
.type-badge.credit { background: rgba(100,150,255,.2); color: #6496ff; }
.type-badge.free_shipping { background: rgba(255,200,50,.2); color: #ffc832; }
.type-badge.product { background: rgba(200,80,255,.2); color: #c850ff; }
.status-pill { font-size: .72rem; padding: .2rem .5rem; border-radius: .4rem; }
.status-pill.active, .status-pill.fulfilled { background: rgba(90,200,120,.2); color: #5ac878; }
.status-pill.inactive, .status-pill.pending { background: rgba(255,255,255,.08); color: #aaa; }
.filter-bar { display: flex; gap: .75rem; margin-bottom: 1rem; }
.search-input, .filter-select { padding: .5rem .75rem; background: var(--surface); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; color: inherit; font-size: .9rem; }
.search-input { flex: 1; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: .75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,.06); font-size: .88rem; }
.data-table th { color: #aaa; font-weight: 600; }
.name-email { display: flex; flex-direction: column; gap: .1rem; }
.name-email small { color: #aaa; font-size: .78rem; }
.coupon-code { font-family: monospace; background: rgba(255,255,255,.08); padding: .1rem .4rem; border-radius: .3rem; font-size: .82rem; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 520px; max-height: 90vh; overflow-y: auto; border-radius: 1.5rem; padding: 0; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 1.5rem 0; }
.modal-header h2 { margin: 0; }
.close-btn { background: none; border: none; font-size: 1.2rem; color: #aaa; cursor: pointer; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: .75rem; border-top: 1px solid rgba(255,255,255,.08); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: .4rem; }
.form-group.full { grid-column: 1 / -1; }
.form-group label { font-size: .85rem; color: #aaa; }
.form-input { padding: .55rem .75rem; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .6rem; color: inherit; font-size: .9rem; width: 100%; box-sizing: border-box; }
.toggle-label { display: flex; gap: .5rem; align-items: center; cursor: pointer; }
.confirm-modal { padding: 2rem; max-width: 400px; }
.confirm-modal h3 { margin: 0 0 .5rem; }
.confirm-modal p { color: #aaa; margin-bottom: 1.5rem; }
.btn-accent { padding: .55rem 1.25rem; background: var(--accent, hsl(355,70%,58%)); border: none; border-radius: .6rem; color: #fff; cursor: pointer; font-size: .9rem; }
.btn-secondary { padding: .55rem 1.25rem; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: .6rem; color: inherit; cursor: pointer; font-size: .9rem; }
.btn-danger { padding: .55rem 1.25rem; background: rgba(220,53,69,.8); border: none; border-radius: .6rem; color: #fff; cursor: pointer; font-size: .9rem; }
.btn-sm { padding: .3rem .7rem; font-size: .78rem; border-radius: .4rem; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: inherit; cursor: pointer; }
.btn-sm.danger { border-color: rgba(220,53,69,.4); color: #dc3545; }
.loading, .empty-state { text-align: center; color: #aaa; padding: 3rem; }
.glass-card { background: var(--surface, hsl(228,4%,15%)); border: 1px solid rgba(255,255,255,.1); }
@media(max-width: 600px) { .stats-strip { grid-template-columns: 1fr 1fr; } .form-grid { grid-template-columns: 1fr; } }
</style>
