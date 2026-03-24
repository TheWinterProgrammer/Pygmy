<template>
  <div class="order-statuses-view">
    <div class="page-header">
      <div>
        <h1>🔖 Order Statuses</h1>
        <p class="subtitle">Manage built-in and custom order statuses with colors and email notifications</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ New Status</button>
    </div>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-else>
      <!-- Built-in statuses -->
      <div class="section-label">Built-in Statuses</div>
      <div class="glass table-wrap">
        <table class="table">
          <thead>
            <tr><th>Status</th><th>Color</th><th>Description</th><th>Note</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in builtIns" :key="s.id">
              <td>
                <span class="status-pill" :style="{ background: s.color + '22', color: s.color, borderColor: s.color + '55' }">
                  {{ s.name }}
                </span>
              </td>
              <td><div class="color-dot" :style="{ background: s.color }"></div></td>
              <td class="text-muted small">{{ s.description }}</td>
              <td><span class="builtin-badge">built-in</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Custom statuses -->
      <div class="section-label" style="margin-top: 2rem;">
        Custom Statuses
        <span class="count-badge">{{ custom.length }}</span>
      </div>
      <div v-if="!custom.length" class="glass empty-custom">
        <p>No custom statuses yet. Create one to extend the built-in options.</p>
        <p class="text-muted small">Custom statuses can be assigned to orders just like built-in ones. You can also configure automatic customer notifications per status.</p>
      </div>
      <div v-else class="glass table-wrap">
        <table class="table">
          <thead>
            <tr><th>Status</th><th>Slug</th><th>Color</th><th>Notify?</th><th>Description</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in custom" :key="s.id">
              <td>
                <span class="status-pill" :style="{ background: s.color + '22', color: s.color, borderColor: s.color + '55' }">
                  {{ s.name }}
                </span>
              </td>
              <td><code class="slug-code">{{ s.slug }}</code></td>
              <td><div class="color-dot" :style="{ background: s.color }"></div></td>
              <td>
                <span v-if="s.notify_customer" class="notify-yes">✓ Yes</span>
                <span v-else class="text-muted">No</span>
              </td>
              <td class="text-muted small">{{ s.description || '—' }}</td>
              <td>
                <button class="btn btn-ghost btn-sm" @click="openEdit(s)">✏️</button>
                <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(s)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Info box -->
      <div class="glass info-box" style="margin-top: 2rem;">
        <h4>💡 How Custom Statuses Work</h4>
        <ul>
          <li>Custom statuses appear in the Orders admin panel's status dropdown alongside built-in statuses.</li>
          <li>When <strong>Notify Customer</strong> is enabled, an email will be sent automatically when an order is set to this status.</li>
          <li>Customize the notification email subject and body with <code>#{order_number}</code>, <code>#{customer_name}</code>, and <code>#{status_name}</code> placeholders.</li>
          <li>You cannot delete a custom status while orders are using it — reassign those orders first.</li>
        </ul>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal glass">
        <h2>{{ editingStatus ? 'Edit Status' : 'New Custom Status' }}</h2>
        <form @submit.prevent="save">
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Status Name *</label>
              <input v-model="form.name" class="input" required placeholder="e.g. On Hold, Awaiting Payment" @input="autoSlug" />
            </div>
            <div class="form-group">
              <label>Slug * <span class="text-muted small">(URL-safe ID)</span></label>
              <input v-model="form.slug" class="input" required placeholder="on-hold" :readonly="!!editingStatus" />
            </div>
          </div>
          <div class="form-group">
            <label>Color</label>
            <div class="color-row">
              <input type="color" v-model="form.color" class="color-input" />
              <div class="color-presets">
                <div v-for="c in colorPresets" :key="c" class="color-preset" :style="{ background: c }" @click="form.color = c" :class="{ active: form.color === c }"></div>
              </div>
              <span class="status-pill preview-pill" :style="{ background: form.color + '22', color: form.color, borderColor: form.color + '55' }">
                {{ form.name || 'Preview' }}
              </span>
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <input v-model="form.description" class="input" placeholder="What does this status mean?" />
          </div>
          <div class="form-group">
            <label>Sort Order</label>
            <input v-model.number="form.sort_order" type="number" class="input input-sm" min="0" />
          </div>

          <div class="form-group notify-section">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.notify_customer" />
              <span>📧 Send email notification to customer when order is set to this status</span>
            </label>
          </div>

          <div v-if="form.notify_customer" class="notify-fields glass-inner">
            <div class="form-group">
              <label>Email Subject</label>
              <input v-model="form.email_subject" class="input" placeholder="Your order #{order_number} status update" />
              <p class="form-hint">Placeholders: <code>#{order_number}</code> <code>#{customer_name}</code> <code>#{status_name}</code></p>
            </div>
            <div class="form-group">
              <label>Email Body (HTML)</label>
              <textarea v-model="form.email_body" class="input mono" rows="6" placeholder="<p>Dear #{customer_name},</p>&#10;<p>Your order #{order_number} is now <strong>#{status_name}</strong>.</p>" />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save Status' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal glass modal-sm">
        <h3>Delete Status</h3>
        <p>Delete the "<strong>{{ deleting.name }}</strong>" status?</p>
        <p class="text-muted small">This will fail if any orders currently have this status.</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleting = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const loading = ref(true)
const builtIns = ref([])
const custom = ref([])
const showModal = ref(false)
const editingStatus = ref(null)
const saving = ref(false)
const deleting = ref(null)

const colorPresets = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#6b7280', '#f97316', '#ec4899', '#14b8a6', '#6366f1']

const form = ref({
  name: '', slug: '', color: '#6366f1', description: '', sort_order: 0,
  notify_customer: false, email_subject: '', email_body: ''
})

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/order-statuses')
    builtIns.value = data.built_in
    custom.value = data.custom
  } finally { loading.value = false }
}

function autoSlug() {
  if (!editingStatus.value) {
    form.value.slug = form.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
}

function openCreate() {
  editingStatus.value = null
  form.value = { name: '', slug: '', color: '#6366f1', description: '', sort_order: 0, notify_customer: false, email_subject: '', email_body: '' }
  showModal.value = true
}

function openEdit(s) {
  editingStatus.value = s
  form.value = { ...s, notify_customer: !!s.notify_customer }
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function save() {
  saving.value = true
  try {
    if (editingStatus.value) {
      await api.put(`/order-statuses/${editingStatus.value.id}`, form.value)
    } else {
      await api.post('/order-statuses', form.value)
    }
    closeModal()
    load()
  } catch (e) {
    alert(e.response?.data?.error || 'Save failed')
  } finally { saving.value = false }
}

function confirmDelete(s) { deleting.value = s }
async function doDelete() {
  try {
    await api.delete(`/order-statuses/${deleting.value.id}`)
    deleting.value = null
    load()
  } catch (e) {
    alert(e.response?.data?.error || 'Delete failed')
    deleting.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.subtitle { color: var(--text-muted, #9ca3af); margin: 4px 0 0; font-size: 0.9rem; }
.section-label { font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted, #9ca3af); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px; }
.count-badge { background: rgba(255,255,255,0.1); border-radius: 10px; padding: 2px 8px; font-size: 0.75rem; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 0.88rem; vertical-align: middle; }
.table th { font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted, #9ca3af); font-weight: 600; }
.status-pill { display: inline-block; font-size: 0.78rem; font-weight: 700; padding: 3px 10px; border-radius: 12px; border: 1px solid; }
.color-dot { width: 18px; height: 18px; border-radius: 50%; }
.builtin-badge { font-size: 0.72rem; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 8px; color: var(--text-muted, #9ca3af); }
.slug-code { font-family: monospace; font-size: 0.82rem; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; }
.notify-yes { color: #10b981; font-size: 0.85rem; font-weight: 600; }
.empty-custom { padding: 1.5rem 2rem; }
.info-box { padding: 1.5rem; }
.info-box h4 { margin: 0 0 12px; }
.info-box ul { margin: 0; padding-left: 1.4rem; display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; color: var(--text-muted, #9ca3af); }
.info-box code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px; color: #a5b4fc; font-size: 0.82rem; }
.form-row { display: flex; gap: 1rem; }
.flex-1 { flex: 1; }
.color-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.color-input { width: 48px; height: 36px; border: none; background: none; cursor: pointer; padding: 0; }
.color-presets { display: flex; gap: 6px; flex-wrap: wrap; }
.color-preset { width: 22px; height: 22px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: transform 0.1s; }
.color-preset.active, .color-preset:hover { transform: scale(1.3); border-color: rgba(255,255,255,0.5); }
.preview-pill { white-space: nowrap; }
.notify-section { margin-top: 0.5rem; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; }
.notify-fields { padding: 1rem 1.2rem; margin-top: 0.5rem; border-radius: 0.75rem; background: rgba(255,255,255,0.04); }
.form-hint { font-size: 0.78rem; color: var(--text-muted, #9ca3af); margin: 4px 0 0; }
.form-hint code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px; color: #a5b4fc; font-size: 0.78rem; }
.mono { font-family: monospace; font-size: 0.85rem; }
.input-sm { max-width: 120px; }
.modal-sm { width: 420px; max-width: 95vw; }
.btn-danger { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
.btn-danger:hover { background: rgba(239,68,68,0.25); }
.text-muted { color: var(--text-muted, #9ca3af); }
.small { font-size: 0.82rem; }
</style>
