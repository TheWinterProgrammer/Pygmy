<template>
  <div class="announcements-view">
    <div class="view-header">
      <div>
        <h1>📢 Announcement Bars</h1>
        <p class="subtitle">Sticky header/footer banners to broadcast messages to visitors</p>
      </div>
      <button class="btn-accent" @click="openCreate">+ New Bar</button>
    </div>

    <div class="glass-card table-card">
      <div v-if="loading" class="empty-state">Loading…</div>
      <div v-else-if="!bars.length" class="empty-state">
        <div class="empty-icon">📢</div>
        <p>No announcement bars yet.</p>
        <button class="btn-accent" @click="openCreate">Create your first bar</button>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Preview</th>
            <th>Position</th>
            <th>Schedule</th>
            <th>Options</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="bar in bars" :key="bar.id">
            <td>
              <div class="bar-preview" :style="{ background: bar.bg_color, color: bar.text_color }">
                {{ bar.message }}
                <a v-if="bar.link_url" class="bar-link" :style="{ color: bar.text_color }">{{ bar.link_label || 'Learn more →' }}</a>
              </div>
            </td>
            <td><span class="badge">{{ bar.position }}</span></td>
            <td>
              <div class="schedule-info" v-if="bar.starts_at || bar.ends_at">
                <div v-if="bar.starts_at">▶ {{ formatDt(bar.starts_at) }}</div>
                <div v-if="bar.ends_at">⏹ {{ formatDt(bar.ends_at) }}</div>
              </div>
              <span v-else class="text-muted">Always</span>
            </td>
            <td>
              <div class="options-badges">
                <span v-if="bar.dismissable" class="badge sm">Dismissable</span>
              </div>
            </td>
            <td>
              <span class="status-pill" :class="bar.is_live ? 'live' : 'off'">
                {{ bar.is_live ? '🟢 Live' : '⚫ Off' }}
              </span>
            </td>
            <td class="actions-cell">
              <button v-if="!bar.is_live && bar.active" class="btn-icon" title="Activate this bar (deactivates others)" @click="activate(bar)">✅</button>
              <button class="btn-icon" title="Edit" @click="openEdit(bar)">✏️</button>
              <button class="btn-icon danger" title="Delete" @click="confirmDelete(bar)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-glass">
        <div class="modal-header">
          <h2>{{ editing ? 'Edit Bar' : 'New Announcement Bar' }}</h2>
          <button class="btn-icon" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <!-- Live Preview -->
          <div class="preview-label">Preview</div>
          <div class="live-preview" :style="{ background: form.bg_color, color: form.text_color }">
            <span>{{ form.message || 'Your announcement text here…' }}</span>
            <a v-if="form.link_label" :style="{ color: form.text_color, marginLeft: '1rem', fontWeight: 700 }">
              {{ form.link_label }}
            </a>
          </div>

          <div class="form-grid" style="margin-top:1.5rem">
            <div class="field full">
              <label>Message *</label>
              <input v-model="form.message" placeholder="🚚 Free shipping on orders over €50!" />
            </div>
            <div class="field">
              <label>Link URL</label>
              <input v-model="form.link_url" placeholder="https://…" />
            </div>
            <div class="field">
              <label>Link Label</label>
              <input v-model="form.link_label" placeholder="Shop now →" />
            </div>
            <div class="field">
              <label>Background Color</label>
              <div class="color-row">
                <input type="color" v-model="form.bg_color" />
                <input v-model="form.bg_color" placeholder="#c0392b" style="flex:1" />
              </div>
            </div>
            <div class="field">
              <label>Text Color</label>
              <div class="color-row">
                <input type="color" v-model="form.text_color" />
                <input v-model="form.text_color" placeholder="#ffffff" style="flex:1" />
              </div>
            </div>
            <div class="field">
              <label>Position</label>
              <select v-model="form.position">
                <option value="top">Top (below nav)</option>
                <option value="bottom">Bottom of page</option>
              </select>
            </div>
            <div class="field">
              <label>Dismissable</label>
              <label class="toggle">
                <input type="checkbox" v-model="form.dismissable" />
                <span class="slider"></span>
                Allow users to close
              </label>
            </div>
            <div class="field">
              <label>Active</label>
              <label class="toggle">
                <input type="checkbox" v-model="form.active" />
                <span class="slider"></span>
                Show on site
              </label>
            </div>
            <div class="field">
              <label>Starts At</label>
              <input type="datetime-local" v-model="form.starts_at" />
            </div>
            <div class="field">
              <label>Ends At</label>
              <input type="datetime-local" v-model="form.ends_at" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">Cancel</button>
          <button class="btn-accent" @click="save" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-glass small">
        <div class="modal-header"><h2>Delete Bar</h2><button class="btn-icon" @click="deleteTarget = null">✕</button></div>
        <div class="modal-body"><p>Delete this announcement bar? This cannot be undone.</p></div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="deleteTarget = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const bars = ref([])
const loading = ref(true)
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const deleteTarget = ref(null)

const emptyForm = () => ({
  message: '', link_url: '', link_label: '',
  bg_color: '#c0392b', text_color: '#ffffff',
  dismissable: true, active: false,
  starts_at: '', ends_at: '', position: 'top'
})
const form = ref(emptyForm())

async function load() {
  loading.value = true
  try {
    const r = await api.get('/announcement-bars')
    bars.value = r.data
  } finally { loading.value = false }
}

onMounted(load)

function openCreate() {
  editing.value = null; form.value = emptyForm(); showModal.value = true
}

function openEdit(bar) {
  editing.value = bar
  form.value = {
    message: bar.message, link_url: bar.link_url || '',
    link_label: bar.link_label || '',
    bg_color: bar.bg_color || '#c0392b', text_color: bar.text_color || '#ffffff',
    dismissable: !!bar.dismissable, active: !!bar.active,
    starts_at: bar.starts_at ? bar.starts_at.slice(0, 16) : '',
    ends_at: bar.ends_at ? bar.ends_at.slice(0, 16) : '',
    position: bar.position || 'top'
  }
  showModal.value = true
}

function closeModal() { showModal.value = false; editing.value = null }

async function save() {
  if (!form.value.message) return alert('Message is required')
  saving.value = true
  try {
    const payload = {
      ...form.value,
      starts_at: form.value.starts_at || null,
      ends_at: form.value.ends_at || null
    }
    if (editing.value) {
      await api.put(`/announcement-bars/${editing.value.id}`, payload)
    } else {
      await api.post('/announcement-bars', payload)
    }
    closeModal(); load()
  } catch (err) {
    alert(err.response?.data?.error || 'Save failed')
  } finally { saving.value = false }
}

async function activate(bar) {
  await api.put(`/announcement-bars/${bar.id}/activate`)
  load()
}

function confirmDelete(bar) { deleteTarget.value = bar }
async function doDelete() {
  await api.delete(`/announcement-bars/${deleteTarget.value.id}`)
  deleteTarget.value = null; load()
}

function formatDt(dt) {
  return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<style scoped>
.announcements-view { padding: 2rem; max-width: 1100px; margin: 0 auto; }
.view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.view-header h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
.subtitle { color: #888; margin: 0; font-size: .9rem; }
.glass-card { background: hsl(228,4%,15%); border-radius: 1.5rem; border: 1px solid rgba(255,255,255,.06); }
.table-card { padding: 0; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { padding: .75rem 1rem; text-align: left; font-size: .75rem; text-transform: uppercase; color: #666; border-bottom: 1px solid rgba(255,255,255,.06); }
.data-table td { padding: .75rem 1rem; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.bar-preview { padding: .4rem .75rem; border-radius: .5rem; font-size: .85rem; max-width: 360px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-link { margin-left: .75rem; font-weight: 700; text-decoration: underline; }
.badge { display: inline-block; padding: .2rem .5rem; border-radius: .4rem; background: rgba(255,255,255,.08); font-size: .78rem; color: #aaa; }
.badge.sm { font-size: .72rem; }
.options-badges { display: flex; gap: .3rem; flex-wrap: wrap; }
.schedule-info { font-size: .78rem; line-height: 1.6; color: #aaa; }
.text-muted { color: #555; }
.status-pill { display: inline-block; padding: .2rem .6rem; border-radius: .5rem; font-size: .78rem; font-weight: 600; }
.status-pill.live { background: hsl(140,50%,18%); color: hsl(140,60%,65%); }
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
.modal-glass { background: hsl(228,4%,13%); border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; width: 90%; max-width: 620px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
.modal-glass.small { max-width: 420px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.06); }
.modal-header h2 { margin: 0; font-size: 1.2rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.06); display: flex; gap: .75rem; justify-content: flex-end; }
.preview-label { font-size: .75rem; text-transform: uppercase; color: #666; margin-bottom: .4rem; }
.live-preview { padding: .6rem 1rem; border-radius: .5rem; font-size: .9rem; font-weight: 500; text-align: center; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: .4rem; }
.field.full { grid-column: 1/-1; }
.field label { font-size: .8rem; color: #aaa; font-weight: 600; }
.field input, .field select { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .6rem; padding: .55rem .75rem; color: #fff; font-size: .9rem; font-family: inherit; }
.color-row { display: flex; gap: .5rem; align-items: center; }
.color-row input[type="color"] { width: 40px; height: 34px; border: none; border-radius: .4rem; cursor: pointer; padding: 2px; background: none; }
.toggle { display: flex; align-items: center; gap: .75rem; cursor: pointer; font-size: .85rem; color: #ccc; }
.toggle input { display: none; }
.slider { width: 36px; height: 20px; background: rgba(255,255,255,.12); border-radius: 10px; position: relative; transition: background .2s; flex-shrink: 0; }
.slider::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; top: 3px; left: 3px; transition: transform .2s; }
.toggle input:checked ~ .slider { background: var(--accent,#e05260); }
.toggle input:checked ~ .slider::after { transform: translateX(16px); }
</style>
