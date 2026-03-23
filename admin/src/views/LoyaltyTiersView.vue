<template>
  <div>
    <div class="page-header">
      <h1>🏆 Loyalty Tiers</h1>
      <p class="subtitle">Define tier levels with earn multipliers and perks. Customers auto-upgrade as they accumulate points.</p>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="recalculate" :disabled="recalculating">
          {{ recalculating ? '⏳ Recalculating…' : '🔄 Recalculate All Tiers' }}
        </button>
        <button class="btn btn-primary" @click="openCreate">+ New Tier</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="tiers.length">
      <div class="stat-card">
        <div class="stat-value">{{ tiers.length }}</div>
        <div class="stat-label">Total Tiers</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ tiers.filter(t => t.active).length }}</div>
        <div class="stat-label">Active Tiers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ tiers.reduce((s, t) => s + (t.member_count || 0), 0) }}</div>
        <div class="stat-label">Assigned Customers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ Math.max(...tiers.map(t => t.earn_multiplier)).toFixed(1) }}×</div>
        <div class="stat-label">Top Multiplier</div>
      </div>
    </div>

    <!-- Tiers Grid -->
    <div class="tiers-grid" v-if="tiers.length">
      <div class="tier-card glass" v-for="tier in tiers" :key="tier.id"
           :style="{ '--tier-color': tier.color }">
        <div class="tier-header">
          <div class="tier-icon-badge" :style="{ background: tier.color + '22', border: `2px solid ${tier.color}` }">
            <span class="tier-icon">{{ tier.icon }}</span>
          </div>
          <div class="tier-title">
            <h3 :style="{ color: tier.color }">{{ tier.name }}</h3>
            <div class="tier-slug">/{{ tier.slug }}</div>
          </div>
          <div class="tier-status">
            <span class="pill" :class="tier.active ? 'pill-green' : 'pill-gray'">
              {{ tier.active ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>

        <div class="tier-stats">
          <div class="tier-stat">
            <div class="tier-stat-label">Min Points</div>
            <div class="tier-stat-value">{{ tier.min_points.toLocaleString() }}</div>
          </div>
          <div class="tier-stat">
            <div class="tier-stat-label">Earn Rate</div>
            <div class="tier-stat-value" :style="{ color: tier.color }">{{ tier.earn_multiplier }}×</div>
          </div>
          <div class="tier-stat">
            <div class="tier-stat-label">Members</div>
            <div class="tier-stat-value">{{ tier.member_count || 0 }}</div>
          </div>
        </div>

        <div class="tier-perks" v-if="tier.perks && tier.perks.length">
          <div class="perks-label">Perks</div>
          <ul class="perks-list">
            <li v-for="(perk, i) in tier.perks" :key="i">✓ {{ perk }}</li>
          </ul>
        </div>

        <div class="tier-actions">
          <button class="btn btn-sm btn-secondary" @click="openEdit(tier)">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" @click="confirmDelete(tier)">🗑️</button>
        </div>
      </div>
    </div>

    <div class="empty-state glass" v-else-if="!loading">
      <div class="empty-icon">🏆</div>
      <p>No loyalty tiers configured yet.</p>
      <button class="btn btn-primary" @click="openCreate">Create First Tier</button>
    </div>

    <!-- Progress Visualization -->
    <div class="progress-viz glass" v-if="tiers.length > 1">
      <h3>Tier Progression</h3>
      <div class="progress-track">
        <template v-for="(tier, i) in sortedActiveTiers" :key="tier.id">
          <div class="progress-node" :style="{ '--tc': tier.color }">
            <div class="progress-dot" :style="{ background: tier.color }">{{ tier.icon }}</div>
            <div class="progress-name" :style="{ color: tier.color }">{{ tier.name }}</div>
            <div class="progress-pts">{{ tier.min_points.toLocaleString() }} pts</div>
            <div class="progress-mult">{{ tier.earn_multiplier }}× earn</div>
          </div>
          <div class="progress-line" v-if="i < sortedActiveTiers.length - 1"
               :style="{ background: `linear-gradient(to right, ${tier.color}, ${sortedActiveTiers[i+1].color})` }"></div>
        </template>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
      <div class="modal glass">
        <h2>{{ editingTier ? 'Edit Tier' : 'New Loyalty Tier' }}</h2>
        <form @submit.prevent="saveTier" class="tier-form">
          <div class="form-row">
            <div class="form-group">
              <label>Tier Name *</label>
              <input v-model="form.name" placeholder="e.g. Gold" required />
            </div>
            <div class="form-group">
              <label>Slug *</label>
              <input v-model="form.slug" placeholder="e.g. gold" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Minimum Points</label>
              <input type="number" v-model.number="form.min_points" min="0" />
            </div>
            <div class="form-group">
              <label>Earn Multiplier</label>
              <input type="number" v-model.number="form.earn_multiplier" min="0.5" max="10" step="0.1" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Icon (emoji)</label>
              <input v-model="form.icon" placeholder="🥉" maxlength="4" />
            </div>
            <div class="form-group">
              <label>Color</label>
              <div class="color-input-row">
                <input type="color" v-model="form.color" class="color-picker" />
                <input v-model="form.color" placeholder="#ffd700" />
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Sort Order</label>
            <input type="number" v-model.number="form.sort_order" min="0" />
          </div>
          <div class="form-group">
            <label>Perks <span class="hint">(one per line)</span></label>
            <textarea v-model="perksText" rows="5" placeholder="Free shipping on all orders&#10;Birthday bonus points&#10;Early access to new products"></textarea>
          </div>
          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="form.active" />
              Active
            </label>
          </div>
          <!-- Live Preview -->
          <div class="tier-preview" :style="{ '--tc': form.color }">
            <span class="preview-icon">{{ form.icon || '⭐' }}</span>
            <span class="preview-name" :style="{ color: form.color }">{{ form.name || 'Tier Name' }}</span>
            <span class="preview-mult">{{ form.earn_multiplier }}× earn</span>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : (editingTier ? 'Save Changes' : 'Create Tier') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass modal-sm">
        <h2>Delete Tier?</h2>
        <p>Delete <strong>{{ deleteTarget.name }}</strong>? This will unassign {{ deleteTarget.member_count || 0 }} customers from this tier.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteTier">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const tiers = ref([])
const loading = ref(true)
const showModal = ref(false)
const editingTier = ref(null)
const deleteTarget = ref(null)
const saving = ref(false)
const recalculating = ref(false)
const perksText = ref('')

const defaultForm = () => ({
  name: '', slug: '', min_points: 0, earn_multiplier: 1.0,
  color: '#888888', icon: '⭐', sort_order: 0, active: true,
})
const form = ref(defaultForm())

const sortedActiveTiers = computed(() =>
  [...tiers.value].filter(t => t.active).sort((a, b) => a.min_points - b.min_points)
)

async function loadTiers() {
  loading.value = true
  try {
    const { data } = await api.get('/loyalty-tiers')
    tiers.value = data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingTier.value = null
  form.value = defaultForm()
  perksText.value = ''
  showModal.value = true
}

function openEdit(tier) {
  editingTier.value = tier
  form.value = {
    name: tier.name, slug: tier.slug, min_points: tier.min_points,
    earn_multiplier: tier.earn_multiplier, color: tier.color,
    icon: tier.icon, sort_order: tier.sort_order, active: !!tier.active,
  }
  perksText.value = (tier.perks || []).join('\n')
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingTier.value = null
}

async function saveTier() {
  saving.value = true
  try {
    const perks = perksText.value.split('\n').map(s => s.trim()).filter(Boolean)
    const payload = { ...form.value, perks }
    if (editingTier.value) {
      await api.put(`/loyalty-tiers/${editingTier.value.id}`, payload)
    } else {
      await api.post('/loyalty-tiers', payload)
    }
    closeModal()
    loadTiers()
  } catch (e) {
    alert(e.response?.data?.error || 'Error saving tier')
  } finally {
    saving.value = false
  }
}

function confirmDelete(tier) {
  deleteTarget.value = tier
}

async function deleteTier() {
  try {
    await api.delete(`/loyalty-tiers/${deleteTarget.value.id}`)
    deleteTarget.value = null
    loadTiers()
  } catch (e) {
    alert(e.response?.data?.error || 'Error deleting tier')
  }
}

async function recalculate() {
  recalculating.value = true
  try {
    const { data } = await api.post('/loyalty-tiers/recalculate')
    alert(`✅ Tiers recalculated. ${data.updated} customers updated.`)
    loadTiers()
  } catch (e) {
    alert(e.response?.data?.error || 'Error recalculating tiers')
  } finally {
    recalculating.value = false
  }
}

onMounted(loadTiers)
</script>

<style scoped>
.page-header { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 2rem; }
.page-header h1 { margin: 0; }
.subtitle { color: var(--text-muted); margin: 0; font-size: 0.9rem; }
.header-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-top: 0.5rem; }

.stats-strip { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
.stat-card { background: var(--surface); border-radius: var(--radius); padding: 1rem 1.5rem; min-width: 120px; }
.stat-card.accent { border-left: 3px solid var(--accent); }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-top: 0.2rem; }

.tiers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
.tier-card { padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 1rem; }
.tier-header { display: flex; align-items: center; gap: 1rem; }
.tier-icon-badge { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.tier-icon { font-size: 1.8rem; }
.tier-title h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
.tier-slug { font-size: 0.75rem; color: var(--text-muted); }
.tier-status { margin-left: auto; }

.tier-stats { display: flex; gap: 1rem; }
.tier-stat { flex: 1; text-align: center; background: rgba(255,255,255,0.04); border-radius: 0.5rem; padding: 0.5rem; }
.tier-stat-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; }
.tier-stat-value { font-size: 1.1rem; font-weight: 700; margin-top: 0.15rem; }

.tier-perks { background: rgba(255,255,255,0.04); border-radius: 0.5rem; padding: 0.75rem; }
.perks-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 0.5rem; }
.perks-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.perks-list li { font-size: 0.82rem; color: var(--text-muted); }

.tier-actions { display: flex; gap: 0.5rem; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06); }

.pill { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.72rem; font-weight: 600; }
.pill-green { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.pill-gray { background: rgba(255,255,255,0.1); color: var(--text-muted); }

.progress-viz { padding: 1.5rem 2rem; border-radius: var(--radius-lg); margin-top: 1rem; }
.progress-viz h3 { margin: 0 0 1.5rem; font-size: 1rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.progress-track { display: flex; align-items: center; gap: 0; overflow-x: auto; padding-bottom: 0.5rem; }
.progress-node { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex-shrink: 0; min-width: 100px; }
.progress-dot { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: 0 0 16px color-mix(in srgb, var(--tc) 40%, transparent); }
.progress-name { font-weight: 700; font-size: 0.9rem; }
.progress-pts { font-size: 0.75rem; color: var(--text-muted); }
.progress-mult { font-size: 0.72rem; font-weight: 600; color: var(--tc); }
.progress-line { flex: 1; height: 4px; min-width: 40px; border-radius: 2px; opacity: 0.6; }

/* Form */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal { background: var(--surface); border-radius: var(--radius-lg); padding: 2rem; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
.modal-sm { max-width: 400px; }
.modal h2 { margin: 0 0 1.5rem; }
.tier-form { display: flex; flex-direction: column; gap: 1rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
.form-group input, .form-group textarea { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.6rem 0.8rem; color: inherit; font-family: inherit; font-size: 0.9rem; }
.form-group textarea { resize: vertical; }
.hint { font-weight: 400; text-transform: none; }
.color-input-row { display: flex; gap: 0.5rem; }
.color-picker { width: 44px; height: 36px; padding: 2px; border-radius: 0.4rem; cursor: pointer; flex-shrink: 0; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; color: var(--text); font-weight: 500; }
.tier-preview { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: rgba(255,255,255,0.04); border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.08); }
.preview-icon { font-size: 1.5rem; }
.preview-name { font-weight: 700; font-size: 1rem; }
.preview-mult { font-size: 0.8rem; color: var(--text-muted); margin-left: auto; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; text-align: center; border-radius: var(--radius-lg); }
.empty-icon { font-size: 3rem; }
.btn { padding: 0.5rem 1rem; border-radius: var(--radius); border: none; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: opacity 0.2s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: rgba(255,255,255,0.1); color: var(--text); }
.btn-danger { background: rgba(239,68,68,0.2); color: #f87171; }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.78rem; }
</style>
