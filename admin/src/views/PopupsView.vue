<template>
  <div class="popups-view">
    <div class="view-header">
      <div>
        <h1>💬 Pop-up Builder</h1>
        <p class="subtitle">Timed, exit-intent, and scroll-triggered pop-ups for email capture and promos</p>
      </div>
      <button class="btn-accent" @click="openCreate">+ New Pop-up</button>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="popups.length">
      <div class="stat-card">
        <div class="stat-num">{{ popups.length }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ popups.filter(p => p.active).length }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ totalDisplays }}</div>
        <div class="stat-label">Total Displays</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ totalConversions }}</div>
        <div class="stat-label">Total Conversions</div>
      </div>
    </div>

    <div class="glass-card table-card">
      <div v-if="loading" class="empty-state">Loading…</div>
      <div v-else-if="!popups.length" class="empty-state">
        <div class="empty-icon">💬</div>
        <p>No pop-ups yet.</p>
        <button class="btn-accent" @click="openCreate">Create your first pop-up</button>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Trigger</th>
            <th>Shows On</th>
            <th>Displays</th>
            <th>Conversions</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="popup in popups" :key="popup.id">
            <td>
              <div class="popup-name">{{ popup.name }}</div>
              <div class="popup-title" v-if="popup.title">{{ popup.title }}</div>
            </td>
            <td><span class="type-badge" :class="popup.type">{{ typeLabel(popup.type) }}</span></td>
            <td>
              <div class="trigger-info">
                <span class="badge">{{ triggerLabel(popup.trigger) }}</span>
                <span class="trigger-delay" v-if="popup.trigger === 'timed'">{{ popup.trigger_delay }}s delay</span>
                <span class="trigger-delay" v-else-if="popup.trigger === 'scroll'">{{ popup.trigger_delay }}% scroll</span>
              </div>
            </td>
            <td>
              <span class="badge">{{ showOnLabel(popup) }}</span>
            </td>
            <td>{{ popup.display_count || 0 }}</td>
            <td>
              <span :class="popup.conversion_count > 0 ? 'conversion-count' : 'text-muted'">
                {{ popup.conversion_count || 0 }}
              </span>
              <span class="ctr" v-if="popup.display_count > 0">
                ({{ Math.round((popup.conversion_count || 0) / popup.display_count * 100) }}%)
              </span>
            </td>
            <td>
              <span class="status-pill" :class="popup.active ? 'active' : 'off'">
                {{ popup.active ? '🟢 Active' : '⚫ Off' }}
              </span>
            </td>
            <td class="actions-cell">
              <button class="btn-icon" title="Toggle active" @click="toggleActive(popup)">
                {{ popup.active ? '⏸' : '▶️' }}
              </button>
              <button class="btn-icon" title="Edit" @click="openEdit(popup)">✏️</button>
              <button class="btn-icon danger" title="Delete" @click="confirmDelete(popup)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-glass large">
        <div class="modal-header">
          <h2>{{ editing ? 'Edit Pop-up' : 'New Pop-up' }}</h2>
          <button class="btn-icon" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field">
              <label>Name (internal) *</label>
              <input v-model="form.name" placeholder="Homepage exit newsletter" />
            </div>
            <div class="field">
              <label>Type</label>
              <select v-model="form.type">
                <option value="newsletter">Newsletter / Email Capture</option>
                <option value="promo">Promo / Coupon</option>
                <option value="announcement">Announcement</option>
                <option value="custom">Custom HTML</option>
              </select>
            </div>
            <div class="field">
              <label>Title</label>
              <input v-model="form.title" placeholder="Don't miss out!" />
            </div>
            <div class="field">
              <label>CTA Label</label>
              <input v-model="form.cta_label" placeholder="Subscribe →" />
            </div>
            <div class="field full">
              <label>Body / Message</label>
              <textarea v-model="form.body" rows="3" placeholder="Sign up for exclusive deals and be the first to know about our flash sales." />
            </div>
            <div class="field">
              <label>CTA URL (optional)</label>
              <input v-model="form.cta_url" placeholder="https://…" />
            </div>
            <div class="field">
              <label>Image URL (optional)</label>
              <input v-model="form.image_url" placeholder="https://…" />
            </div>

            <div class="field-section full"><h3>🎯 Trigger</h3></div>
            <div class="field">
              <label>Trigger</label>
              <select v-model="form.trigger">
                <option value="timed">Timed (after N seconds)</option>
                <option value="exit_intent">Exit Intent (mouse leaves)</option>
                <option value="scroll">Scroll Depth (%)</option>
              </select>
            </div>
            <div class="field" v-if="form.trigger !== 'exit_intent'">
              <label>{{ form.trigger === 'scroll' ? 'Scroll % to trigger' : 'Delay (seconds)' }}</label>
              <input type="number" v-model.number="form.trigger_delay" min="0" max="100" />
            </div>
            <div class="field">
              <label>Show Only Once</label>
              <label class="toggle">
                <input type="checkbox" v-model="form.show_once" />
                <span class="slider"></span>
                Once per browser session
              </label>
            </div>
            <div class="field">
              <label>Cookie Duration (days)</label>
              <input type="number" v-model.number="form.cookie_days" min="0" />
            </div>

            <div class="field-section full"><h3>📍 Visibility</h3></div>
            <div class="field">
              <label>Show On</label>
              <select v-model="form.show_on">
                <option value="all">All Pages</option>
                <option value="home">Home Page Only</option>
                <option value="blog">Blog Pages</option>
                <option value="shop">Shop Pages</option>
                <option value="product">Product Pages</option>
                <option value="custom">Custom Paths</option>
              </select>
            </div>
            <div class="field" v-if="form.show_on === 'custom'">
              <label>Path Patterns (comma-separated)</label>
              <input v-model="customPathsText" placeholder="/sale, /events, /shop/new" />
            </div>

            <div class="field-section full"><h3>🎨 Style</h3></div>
            <div class="field">
              <label>Background</label>
              <div class="color-row">
                <input type="color" v-model="bgColorHex" @input="form.bg_color = bgColorHex" />
                <input v-model="form.bg_color" style="flex:1" placeholder="rgba(0,0,0,0.9)" />
              </div>
            </div>
            <div class="field">
              <label>Active</label>
              <label class="toggle">
                <input type="checkbox" v-model="form.active" />
                <span class="slider"></span>
                Show on site
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">Cancel</button>
          <button class="btn-accent" @click="save" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save Pop-up' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-glass small">
        <div class="modal-header"><h2>Delete Pop-up</h2><button class="btn-icon" @click="deleteTarget = null">✕</button></div>
        <div class="modal-body"><p>Delete "<strong>{{ deleteTarget.name }}</strong>"? Stats will be lost.</p></div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="deleteTarget = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const popups = ref([])
const loading = ref(true)
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const deleteTarget = ref(null)
const customPathsText = ref('')
const bgColorHex = ref('#111111')

const totalDisplays = computed(() => popups.value.reduce((s, p) => s + (p.display_count || 0), 0))
const totalConversions = computed(() => popups.value.reduce((s, p) => s + (p.conversion_count || 0), 0))

const emptyForm = () => ({
  name: '', type: 'newsletter',
  title: '', body: '', cta_label: 'Subscribe', cta_url: '', image_url: '',
  trigger: 'timed', trigger_delay: 5,
  show_once: true, cookie_days: 30,
  show_on: 'all', show_on_paths: [],
  bg_color: 'rgba(20,20,30,0.97)', active: false
})
const form = ref(emptyForm())

async function load() {
  loading.value = true
  try {
    const r = await api.get('/popups')
    popups.value = r.data
  } finally { loading.value = false }
}

onMounted(load)

function openCreate() {
  editing.value = null; form.value = emptyForm(); customPathsText.value = ''; showModal.value = true
}

function openEdit(p) {
  editing.value = p
  form.value = {
    name: p.name, type: p.type,
    title: p.title || '', body: p.body || '',
    cta_label: p.cta_label || '', cta_url: p.cta_url || '', image_url: p.image_url || '',
    trigger: p.trigger, trigger_delay: p.trigger_delay,
    show_once: !!p.show_once, cookie_days: p.cookie_days,
    show_on: p.show_on, show_on_paths: p.show_on_paths || [],
    bg_color: p.bg_color || 'rgba(20,20,30,0.97)', active: !!p.active
  }
  customPathsText.value = (p.show_on_paths || []).join(', ')
  showModal.value = true
}

function closeModal() { showModal.value = false; editing.value = null }

async function save() {
  if (!form.value.name) return alert('Name is required')
  saving.value = true
  try {
    const payload = {
      ...form.value,
      show_on_paths: form.value.show_on === 'custom'
        ? customPathsText.value.split(',').map(s => s.trim()).filter(Boolean)
        : []
    }
    if (editing.value) {
      await api.put(`/popups/${editing.value.id}`, payload)
    } else {
      await api.post('/popups', payload)
    }
    closeModal(); load()
  } catch (err) {
    alert(err.response?.data?.error || 'Save failed')
  } finally { saving.value = false }
}

async function toggleActive(p) {
  await api.put(`/popups/${p.id}`, { active: !p.active })
  load()
}

function confirmDelete(p) { deleteTarget.value = p }
async function doDelete() {
  await api.delete(`/popups/${deleteTarget.value.id}`)
  deleteTarget.value = null; load()
}

function typeLabel(t) {
  return { newsletter: '📧 Newsletter', promo: '🎁 Promo', announcement: '📢 Announce', custom: '🔧 Custom' }[t] || t
}
function triggerLabel(t) {
  return { timed: '⏱ Timed', exit_intent: '🚪 Exit Intent', scroll: '📜 Scroll' }[t] || t
}
function showOnLabel(p) {
  if (p.show_on === 'all') return 'All Pages'
  if (p.show_on === 'custom') return `Custom (${(p.show_on_paths || []).length} paths)`
  return p.show_on.charAt(0).toUpperCase() + p.show_on.slice(1)
}
</script>

<style scoped>
.popups-view { padding: 2rem; max-width: 1200px; margin: 0 auto; }
.view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.view-header h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
.subtitle { color: #888; margin: 0; font-size: .9rem; }
.stats-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: hsl(228,4%,15%); border-radius: 1rem; padding: 1.25rem; text-align: center; border: 1px solid rgba(255,255,255,.06); }
.stat-num { font-size: 2rem; font-weight: 700; color: var(--accent,#e05260); }
.stat-label { font-size: .8rem; color: #888; margin-top: .25rem; }
.glass-card { background: hsl(228,4%,15%); border-radius: 1.5rem; border: 1px solid rgba(255,255,255,.06); }
.table-card { padding: 0; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { padding: .75rem 1rem; text-align: left; font-size: .75rem; text-transform: uppercase; color: #666; border-bottom: 1px solid rgba(255,255,255,.06); }
.data-table td { padding: .75rem 1rem; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.popup-name { font-weight: 600; }
.popup-title { font-size: .78rem; color: #888; }
.type-badge { display: inline-block; padding: .2rem .6rem; border-radius: .5rem; font-size: .78rem; font-weight: 600; }
.type-badge.newsletter { background: hsl(210,60%,18%); color: hsl(210,70%,70%); }
.type-badge.promo { background: hsl(355,60%,18%); color: hsl(355,70%,70%); }
.type-badge.announcement { background: hsl(45,60%,18%); color: hsl(45,70%,70%); }
.type-badge.custom { background: rgba(255,255,255,.08); color: #aaa; }
.trigger-info { display: flex; flex-direction: column; gap: .2rem; }
.trigger-delay { font-size: .75rem; color: #777; }
.badge { display: inline-block; padding: .2rem .5rem; border-radius: .4rem; background: rgba(255,255,255,.08); font-size: .78rem; color: #aaa; }
.text-muted { color: #555; }
.conversion-count { color: hsl(140,60%,65%); font-weight: 600; }
.ctr { font-size: .75rem; color: #777; margin-left: .3rem; }
.status-pill { display: inline-block; padding: .2rem .6rem; border-radius: .5rem; font-size: .78rem; font-weight: 600; }
.status-pill.active { background: hsl(140,50%,18%); color: hsl(140,60%,65%); }
.status-pill.off { background: rgba(255,255,255,.06); color: #666; }
.actions-cell { display: flex; gap: .4rem; align-items: center; }
.btn-accent { background: var(--accent,#e05260); color: #fff; border: none; padding: .6rem 1.2rem; border-radius: .75rem; cursor: pointer; font-weight: 600; }
.btn-secondary { background: rgba(255,255,255,.08); color: #ccc; border: none; padding: .6rem 1.2rem; border-radius: .75rem; cursor: pointer; font-weight: 600; }
.btn-danger { background: hsl(355,70%,40%); color: #fff; border: none; padding: .6rem 1.2rem; border-radius: .75rem; cursor: pointer; font-weight: 600; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1rem; padding: .25rem .4rem; border-radius: .4rem; }
.btn-icon:hover { background: rgba(255,255,255,.08); }
.btn-icon.danger:hover { background: hsl(355,70%,20%); }
.empty-state { padding: 3rem; text-align: center; color: #666; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-glass { background: hsl(228,4%,13%); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; width: 90%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
.modal-glass.large { max-width: 720px; }
.modal-glass.small { max-width: 420px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.06); }
.modal-header h2 { margin: 0; font-size: 1.2rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.06); display: flex; gap: .75rem; justify-content: flex-end; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: .4rem; }
.field.full { grid-column: 1/-1; }
.field label { font-size: .8rem; color: #aaa; font-weight: 600; }
.field input, .field select, .field textarea { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .6rem; padding: .55rem .75rem; color: #fff; font-size: .9rem; font-family: inherit; }
.field textarea { resize: vertical; }
.field-section { border-top: 1px solid rgba(255,255,255,.06); padding-top: 1rem; }
.field-section h3 { margin: 0 0 .5rem; font-size: .9rem; color: #aaa; }
.color-row { display: flex; gap: .5rem; align-items: center; }
.color-row input[type="color"] { width: 40px; height: 34px; border: none; border-radius: .4rem; cursor: pointer; padding: 2px; background: none; }
.toggle { display: flex; align-items: center; gap: .75rem; cursor: pointer; font-size: .85rem; color: #ccc; }
.toggle input { display: none; }
.slider { width: 36px; height: 20px; background: rgba(255,255,255,.12); border-radius: 10px; position: relative; transition: background .2s; flex-shrink: 0; }
.slider::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; top: 3px; left: 3px; transition: transform .2s; }
.toggle input:checked ~ .slider { background: var(--accent,#e05260); }
.toggle input:checked ~ .slider::after { transform: translateX(16px); }
</style>
