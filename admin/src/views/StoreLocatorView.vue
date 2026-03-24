<template>
  <div>
    <div class="page-header">
      <h1>📍 Store Locator</h1>
      <button class="btn btn-primary" @click="openCreate">+ Add Location</button>
    </div>

    <!-- Stats -->
    <div class="stat-strip" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.total }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card glass" v-for="t in stats.byType" :key="t.type">
        <div class="stat-num">{{ t.n }}</div>
        <div class="stat-label">{{ capitalize(t.type) }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input v-model="q" @input="debounce(load, 400)" placeholder="Search by name, city, address…" class="filter-input" />
      <select v-model="filterType" @change="load" class="filter-select">
        <option value="">All Types</option>
        <option value="store">Store</option>
        <option value="warehouse">Warehouse</option>
        <option value="showroom">Showroom</option>
        <option value="popup">Pop-Up</option>
        <option value="partner">Partner</option>
      </select>
      <select v-model="filterActive" @change="load" class="filter-select">
        <option value="1">Active</option>
        <option value="0">Inactive</option>
        <option value="all">All</option>
      </select>
      <span class="meta">{{ total }} locations</span>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Locations Grid -->
    <div class="locations-grid" v-if="locations.length">
      <div v-for="loc in locations" :key="loc.id" class="location-card glass">
        <div class="loc-header">
          <div class="loc-img" v-if="loc.cover_image">
            <img :src="loc.cover_image" :alt="loc.name" />
          </div>
          <div class="loc-img loc-img-ph" v-else>
            <span>{{ typeEmoji(loc.type) }}</span>
          </div>
          <div class="loc-badges">
            <span class="badge" :class="typeColor(loc.type)">{{ capitalize(loc.type) }}</span>
            <span class="badge badge-gold" v-if="loc.featured">⭐ Featured</span>
            <span class="badge" :class="loc.active ? 'badge-green' : 'badge-red'">
              {{ loc.active ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
        <div class="loc-body">
          <h3 class="loc-name">{{ loc.name }}</h3>
          <p class="loc-addr" v-if="loc.address || loc.city">
            📍 {{ [loc.address, loc.city, loc.country].filter(Boolean).join(', ') }}
          </p>
          <p class="loc-phone" v-if="loc.phone">📞 {{ loc.phone }}</p>
          <p class="loc-email" v-if="loc.email">✉️ {{ loc.email }}</p>
          <div class="loc-hours" v-if="hasHours(loc)">
            <strong>Hours:</strong>
            <span v-for="(val, day) in loc.hours" :key="day" class="hour-pill">
              {{ day }}: {{ val }}
            </span>
          </div>
        </div>
        <div class="loc-actions">
          <button class="btn btn-sm btn-ghost" @click="openEdit(loc)">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" @click="confirmDelete(loc)">🗑️</button>
        </div>
      </div>
    </div>

    <div class="empty-state glass" v-else-if="!loading">
      <p>No store locations yet. Add your first location!</p>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
      <div class="modal-panel glass">
        <div class="modal-header">
          <h2>{{ editing ? 'Edit Location' : 'Add Location' }}</h2>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Name *</label>
              <input v-model="form.name" class="input" placeholder="Store name" />
            </div>
            <div class="form-group">
              <label>Type</label>
              <select v-model="form.type" class="input">
                <option value="store">Store</option>
                <option value="warehouse">Warehouse</option>
                <option value="showroom">Showroom</option>
                <option value="popup">Pop-Up</option>
                <option value="partner">Partner</option>
              </select>
            </div>
            <div class="form-group fg-full">
              <label>Address</label>
              <input v-model="form.address" class="input" placeholder="Street address" />
            </div>
            <div class="form-group">
              <label>City</label>
              <input v-model="form.city" class="input" placeholder="City" />
            </div>
            <div class="form-group">
              <label>State / Region</label>
              <input v-model="form.state" class="input" placeholder="State" />
            </div>
            <div class="form-group">
              <label>ZIP / Postal</label>
              <input v-model="form.zip" class="input" placeholder="ZIP" />
            </div>
            <div class="form-group">
              <label>Country</label>
              <input v-model="form.country" class="input" placeholder="DE" maxlength="2" />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input v-model="form.phone" class="input" placeholder="+49 …" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input v-model="form.email" class="input" placeholder="store@example.com" type="email" />
            </div>
            <div class="form-group">
              <label>Website</label>
              <input v-model="form.website" class="input" placeholder="https://…" />
            </div>
            <div class="form-group">
              <label>Latitude</label>
              <input v-model="form.latitude" class="input" placeholder="48.1351" type="number" step="0.0001" />
            </div>
            <div class="form-group">
              <label>Longitude</label>
              <input v-model="form.longitude" class="input" placeholder="11.5820" type="number" step="0.0001" />
            </div>
            <div class="form-group fg-full">
              <label>Cover Image URL</label>
              <input v-model="form.cover_image" class="input" placeholder="https://…" />
            </div>
            <div class="form-group fg-full">
              <label>Map Embed HTML (optional iframe)</label>
              <textarea v-model="form.map_embed" class="input textarea" rows="3" placeholder='&lt;iframe src="https://maps.google.com/…"&gt;&lt;/iframe&gt;'></textarea>
            </div>
            <div class="form-group fg-full">
              <label>Description</label>
              <textarea v-model="form.description" class="input textarea" rows="2" placeholder="Short description…"></textarea>
            </div>
            <div class="form-group fg-full">
              <label>Opening Hours <span class="meta">(one per line: "Mon-Fri: 9:00–18:00")</span></label>
              <textarea v-model="hoursText" class="input textarea" rows="5" placeholder="Mon-Fri: 9:00–18:00&#10;Sat: 10:00–16:00&#10;Sun: Closed"></textarea>
            </div>
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" v-model="form.featured" />
                <span>Featured</span>
              </label>
            </div>
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" v-model="form.active" />
                <span>Active</span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="closeModal">Cancel</button>
          <button class="btn btn-primary" @click="save" :disabled="saving">
            {{ saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Location') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal-panel modal-sm glass">
        <div class="modal-header">
          <h2>Delete Location</h2>
          <button class="modal-close" @click="deleteTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <p>Delete <strong>{{ deleteTarget.name }}</strong>? This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const locations = ref([])
const total = ref(0)
const stats = ref(null)
const loading = ref(false)
const q = ref('')
const filterType = ref('')
const filterActive = ref('1')
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const deleteTarget = ref(null)
const hoursText = ref('')

const defaultForm = () => ({
  name: '', address: '', city: '', state: '', zip: '', country: 'DE',
  phone: '', email: '', website: '', latitude: null, longitude: null,
  map_embed: '', description: '', cover_image: '',
  type: 'store', featured: false, active: true, sort_order: 0
})
const form = ref(defaultForm())

let debounceTimer = null
function debounce(fn, ms) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fn, ms)
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/store-locator', {
      params: { q: q.value, type: filterType.value || undefined, active: filterActive.value, limit: 200 }
    })
    locations.value = data.locations
    total.value = data.total
  } finally { loading.value = false }
}

async function loadStats() {
  const { data } = await api.get('/store-locator/stats')
  stats.value = data
}

function typeEmoji(t) {
  const m = { store: '🏪', warehouse: '🏭', showroom: '🖼️', popup: '⛺', partner: '🤝' }
  return m[t] || '📍'
}
function typeColor(t) {
  const m = { store: 'badge-blue', warehouse: 'badge-orange', showroom: 'badge-purple', popup: 'badge-teal', partner: 'badge-gray' }
  return m[t] || 'badge-gray'
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s }
function hasHours(loc) { return loc.hours && Object.keys(loc.hours).length > 0 }

function hoursToText(hours) {
  if (!hours || typeof hours !== 'object') return ''
  return Object.entries(hours).map(([k, v]) => `${k}: ${v}`).join('\n')
}
function textToHours(text) {
  const h = {}
  for (const line of text.split('\n')) {
    const [key, ...rest] = line.split(':')
    if (key && rest.length) h[key.trim()] = rest.join(':').trim()
  }
  return h
}

function openCreate() {
  editing.value = null
  form.value = defaultForm()
  hoursText.value = ''
  showModal.value = true
}
function openEdit(loc) {
  editing.value = loc
  form.value = {
    name: loc.name, address: loc.address || '', city: loc.city || '',
    state: loc.state || '', zip: loc.zip || '', country: loc.country || 'DE',
    phone: loc.phone || '', email: loc.email || '', website: loc.website || '',
    latitude: loc.latitude, longitude: loc.longitude,
    map_embed: loc.map_embed || '', description: loc.description || '',
    cover_image: loc.cover_image || '', type: loc.type || 'store',
    featured: !!loc.featured, active: !!loc.active, sort_order: loc.sort_order || 0
  }
  hoursText.value = hoursToText(loc.hours)
  showModal.value = true
}
function closeModal() { showModal.value = false; editing.value = null }

async function save() {
  if (!form.value.name) return alert('Name is required')
  saving.value = true
  try {
    const payload = { ...form.value, hours: textToHours(hoursText.value) }
    if (editing.value) {
      await api.put(`/store-locator/${editing.value.id}`, payload)
    } else {
      await api.post('/store-locator', payload)
    }
    closeModal()
    await Promise.all([load(), loadStats()])
  } catch (e) {
    alert(e.response?.data?.error || 'Save failed')
  } finally { saving.value = false }
}

function confirmDelete(loc) { deleteTarget.value = loc }
async function doDelete() {
  await api.delete(`/store-locator/${deleteTarget.value.id}`)
  deleteTarget.value = null
  await Promise.all([load(), loadStats()])
}

onMounted(() => { load(); loadStats() })
</script>

<style scoped>
.stat-strip { display: flex; gap: .75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { padding: 1rem 1.5rem; border-radius: 1rem; text-align: center; min-width: 90px; }
.stat-num { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: .75rem; color: var(--text-muted, #aaa); margin-top: .25rem; }

.filter-bar { display: flex; gap: .75rem; align-items: center; padding: .75rem 1rem; border-radius: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.filter-input { flex: 1 1 200px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .5rem .75rem; color: inherit; }
.filter-select { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .5rem .75rem; color: inherit; }
.meta { font-size: .8rem; color: var(--text-muted, #aaa); }

.loading-bar { height: 2px; background: var(--accent); border-radius: 1px; margin-bottom: 1rem; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }

.locations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.location-card { border-radius: 1.25rem; overflow: hidden; display: flex; flex-direction: column; }
.loc-header { position: relative; }
.loc-img { height: 140px; background: rgba(255,255,255,.04); overflow: hidden; }
.loc-img img { width: 100%; height: 100%; object-fit: cover; }
.loc-img-ph { display: flex; align-items: center; justify-content: center; font-size: 2.5rem; }
.loc-badges { position: absolute; top: .5rem; left: .5rem; display: flex; gap: .35rem; flex-wrap: wrap; }
.badge { font-size: .65rem; padding: .2rem .5rem; border-radius: .3rem; font-weight: 600; }
.badge-blue { background: #1e3a5f; color: #93c5fd; }
.badge-orange { background: #451a03; color: #fb923c; }
.badge-purple { background: #2e1065; color: #c4b5fd; }
.badge-teal { background: #042f2e; color: #5eead4; }
.badge-gray { background: rgba(255,255,255,.1); color: #999; }
.badge-green { background: #052e16; color: #4ade80; }
.badge-red { background: #450a0a; color: #f87171; }
.badge-gold { background: #422006; color: #fbbf24; }

.loc-body { padding: .85rem 1rem; flex: 1; }
.loc-name { font-size: 1rem; font-weight: 600; margin: 0 0 .4rem; }
.loc-addr, .loc-phone, .loc-email { font-size: .8rem; color: var(--text-muted, #aaa); margin: .15rem 0; }
.loc-hours { margin-top: .5rem; font-size: .75rem; }
.hour-pill { background: rgba(255,255,255,.06); padding: .15rem .4rem; border-radius: .3rem; margin: .15rem .15rem 0 0; display: inline-block; }

.loc-actions { display: flex; gap: .5rem; padding: .75rem 1rem; border-top: 1px solid rgba(255,255,255,.06); }
.btn-sm { font-size: .8rem; padding: .35rem .75rem; }
.btn-danger { background: rgba(239,68,68,.15); color: #f87171; border: 1px solid rgba(239,68,68,.3); }
.btn-danger:hover { background: rgba(239,68,68,.25); }

.empty-state { text-align: center; padding: 3rem; border-radius: 1.5rem; color: var(--text-muted, #aaa); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-panel { border-radius: 1.5rem; width: 100%; max-width: 720px; max-height: 90vh; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(16px); }
.modal-sm { max-width: 440px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-close { background: none; border: none; color: inherit; font-size: 1.1rem; cursor: pointer; opacity: .6; }
.modal-close:hover { opacity: 1; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.08); }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .85rem; }
.fg-full { grid-column: 1 / -1; }
.form-group label { display: block; font-size: .8rem; color: var(--text-muted, #aaa); margin-bottom: .3rem; }
.input { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; padding: .5rem .75rem; color: inherit; font-family: inherit; font-size: .9rem; box-sizing: border-box; }
.input:focus { outline: none; border-color: var(--accent); }
.textarea { resize: vertical; min-height: 60px; }
.toggle-label { display: flex; align-items: center; gap: .5rem; cursor: pointer; font-size: .9rem; }
.toggle-label input[type=checkbox] { accent-color: var(--accent); width: 1rem; height: 1rem; }
</style>
