<template>
  <div class="form-edit-view">
    <div class="view-header">
      <div class="header-left">
        <RouterLink to="/forms" class="back-link">← Forms</RouterLink>
        <h1>{{ isNew ? 'New Form' : 'Edit Form' }}</h1>
      </div>
      <div class="header-actions">
        <button @click="save('inactive')" class="btn-ghost" :disabled="saving">Save Draft</button>
        <button @click="save('active')" class="btn-accent" :disabled="saving">
          {{ saving ? 'Saving…' : isNew ? 'Create Form' : 'Save & Activate' }}
        </button>
      </div>
    </div>

    <div class="edit-layout">
      <!-- Main form settings -->
      <div class="main-col">
        <div class="glass section">
          <h2>Form Details</h2>
          <div class="form-group">
            <label>Form Name *</label>
            <input v-model="form.name" @input="autoSlug" placeholder="Contact Us" class="glass-input" />
          </div>
          <div class="form-group">
            <label>Slug *</label>
            <div class="slug-row">
              <span class="slug-prefix">/forms/</span>
              <input v-model="form.slug" placeholder="contact-us" class="glass-input" />
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <input v-model="form.description" placeholder="A short description of this form" class="glass-input" />
          </div>
          <div class="form-group">
            <label>Success Message</label>
            <textarea v-model="form.success_message" rows="2" class="glass-input" placeholder="Thank you! Your message has been sent." />
          </div>
          <div class="form-group">
            <label>Email Notifications</label>
            <input v-model="form.email_notify" placeholder="you@example.com (optional)" class="glass-input" type="email" />
            <small class="hint">Send an email when someone submits this form (requires SMTP in Settings).</small>
          </div>
        </div>

        <!-- Field builder -->
        <div class="glass section">
          <div class="section-header">
            <h2>Form Fields</h2>
            <button @click="addField" class="btn-accent-sm">+ Add Field</button>
          </div>

          <div v-if="form.fields.length === 0" class="empty-fields">
            <p>No fields yet. Add your first field to get started.</p>
          </div>

          <div class="fields-list">
            <div
              v-for="(field, idx) in form.fields"
              :key="field._key"
              class="field-card glass-inner"
            >
              <div class="field-card-header">
                <div class="field-type-badge">{{ fieldTypeLabel(field.type) }}</div>
                <div class="field-card-controls">
                  <button @click="moveField(idx, -1)" :disabled="idx === 0" class="ctrl-btn" title="Move up">↑</button>
                  <button @click="moveField(idx, 1)" :disabled="idx === form.fields.length - 1" class="ctrl-btn" title="Move down">↓</button>
                  <button @click="removeField(idx)" class="ctrl-btn danger" title="Remove field">✕</button>
                </div>
              </div>

              <div class="field-row">
                <div class="form-group">
                  <label>Type</label>
                  <select v-model="field.type" class="glass-select">
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="number">Number</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Dropdown</option>
                    <option value="radio">Radio Buttons</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="date">Date</option>
                    <option value="file">File Upload</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Label *</label>
                  <input v-model="field.label" @input="autoFieldName(field)" placeholder="Your Name" class="glass-input" />
                </div>
                <div class="form-group">
                  <label>Field Name</label>
                  <input v-model="field.name" placeholder="your_name" class="glass-input" />
                </div>
              </div>

              <div class="field-row">
                <div class="form-group" v-if="!['checkbox', 'select', 'radio'].includes(field.type)">
                  <label>Placeholder</label>
                  <input v-model="field.placeholder" placeholder="e.g. John Doe" class="glass-input" />
                </div>
                <div class="form-group" v-if="['select', 'radio'].includes(field.type)">
                  <label>Options (one per line)</label>
                  <textarea
                    :value="optionsToText(field.options)"
                    @input="field.options = textToOptions($event.target.value)"
                    rows="3"
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    class="glass-input"
                  />
                </div>
                <div class="form-group" v-if="field.type === 'textarea'">
                  <label>Rows</label>
                  <input v-model.number="field.rows" type="number" min="2" max="20" placeholder="4" class="glass-input" style="max-width:80px" />
                </div>
                <div class="form-group toggle-group">
                  <label class="toggle-label">
                    <input v-model="field.required" type="checkbox" />
                    <span>Required</span>
                  </label>
                </div>
              </div>

              <div class="field-row" v-if="field.type === 'checkbox'">
                <div class="form-group">
                  <label>Checkbox text</label>
                  <input v-model="field.checkboxLabel" placeholder="I agree to the terms" class="glass-input" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="sidebar-col">
        <div class="glass section">
          <h2>Status</h2>
          <select v-model="form.status" class="glass-select">
            <option value="active">Active (public)</option>
            <option value="inactive">Inactive (hidden)</option>
          </select>
        </div>

        <!-- Field type guide -->
        <div class="glass section guide-section">
          <h2>Field Types</h2>
          <ul class="type-guide">
            <li v-for="t in fieldTypes" :key="t.value">
              <span class="type-icon">{{ t.icon }}</span>
              <div>
                <strong>{{ t.label }}</strong>
                <p>{{ t.desc }}</p>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="!isNew" class="glass section">
          <h2>Submissions</h2>
          <p class="muted-text">View and manage responses to this form.</p>
          <RouterLink :to="`/forms/${route.params.id}/submissions`" class="btn-ghost-full">
            📥 View Submissions
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToastStore } from '../stores/toast.js'
import api from '../api.js'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const saving = ref(false)

const isNew = computed(() => route.params.id === 'new' || !route.params.id)

const form = ref({
  name: '',
  slug: '',
  description: '',
  fields: [],
  success_message: 'Thank you! Your message has been sent.',
  email_notify: '',
  status: 'active',
})

let _keyCounter = 0
const newKey = () => ++_keyCounter + '-' + Date.now()

const fieldTypes = [
  { value: 'text',     icon: '🔤', label: 'Text',      desc: 'Single-line text input' },
  { value: 'email',    icon: '📧', label: 'Email',     desc: 'Email address with validation' },
  { value: 'tel',      icon: '📞', label: 'Phone',     desc: 'Telephone number' },
  { value: 'number',   icon: '🔢', label: 'Number',    desc: 'Numeric input' },
  { value: 'textarea', icon: '📝', label: 'Textarea',  desc: 'Multi-line text' },
  { value: 'select',   icon: '📋', label: 'Dropdown',  desc: 'Select from a list' },
  { value: 'radio',    icon: '🔘', label: 'Radio',     desc: 'Choose one option' },
  { value: 'checkbox', icon: '✅', label: 'Checkbox',  desc: 'Single tick/agreement' },
  { value: 'date',     icon: '📅', label: 'Date',      desc: 'Date picker' },
  { value: 'file',     icon: '📎', label: 'File',      desc: 'File upload field' },
]
function fieldTypeLabel (type) { return fieldTypes.find(t => t.value === type)?.label || type }

function addField () {
  form.value.fields.push({
    _key: newKey(),
    type: 'text',
    label: '',
    name: '',
    placeholder: '',
    required: false,
    options: [],
    rows: 4,
    checkboxLabel: '',
  })
}

function removeField (idx) { form.value.fields.splice(idx, 1) }

function moveField (idx, dir) {
  const arr = form.value.fields
  const target = idx + dir
  if (target < 0 || target >= arr.length) return
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
}

function autoSlug () {
  if (isNew.value) {
    form.value.slug = form.value.name
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }
}

function autoFieldName (field) {
  if (!field._nameDirty) {
    field.name = field.label
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  }
}

function optionsToText (opts) { return (opts || []).join('\n') }
function textToOptions (text) { return text.split('\n').map(s => s.trim()).filter(Boolean) }

async function load () {
  if (isNew.value) return
  try {
    const res = await api.get(`/forms?all=1`)
    const found = res.data.find(f => f.id === parseInt(route.params.id))
    if (!found) return router.replace('/forms')
    const fields = JSON.parse(found.fields || '[]').map(f => ({ ...f, _key: newKey(), _nameDirty: true }))
    form.value = { ...found, fields }
  } catch { toast.error('Failed to load form') }
}

async function save (statusOverride) {
  if (!form.value.name) return toast.error('Form name is required')
  if (!form.value.slug) return toast.error('Slug is required')
  saving.value = true
  try {
    // Strip internal _key/_nameDirty before saving
    const cleanFields = form.value.fields.map(({ _key, _nameDirty, ...f }) => f)
    const payload = { ...form.value, fields: JSON.stringify(cleanFields), status: statusOverride ?? form.value.status }

    if (isNew.value) {
      const res = await api.post('/forms', payload)
      toast.success('Form created')
      router.replace(`/forms/${res.data.id}`)
    } else {
      await api.put(`/forms/${route.params.id}`, payload)
      toast.success('Form saved')
    }
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.view-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
.header-left { display:flex; flex-direction:column; gap:.25rem; }
.header-left h1 { margin:0; }
.back-link { color:var(--muted); text-decoration:none; font-size:.85rem; }
.back-link:hover { color:var(--text); }
.header-actions { display:flex; gap:.75rem; align-items:center; }
.btn-accent { background:var(--accent); color:#fff; border:none; padding:.55rem 1.2rem; border-radius:.6rem; cursor:pointer; font-weight:600; font-size:.9rem; }
.btn-accent:disabled { opacity:.6; cursor:not-allowed; }
.btn-ghost { background:transparent; border:1px solid rgba(255,255,255,.15); color:var(--muted); padding:.5rem 1.1rem; border-radius:.6rem; cursor:pointer; }
.btn-accent-sm { background:var(--accent); color:#fff; border:none; padding:.35rem .9rem; border-radius:.5rem; cursor:pointer; font-size:.82rem; font-weight:600; }

.edit-layout { display:grid; grid-template-columns:1fr 280px; gap:1.2rem; }
@media (max-width:900px) { .edit-layout { grid-template-columns:1fr; } }

.section { padding:1.4rem; border-radius:1.2rem; margin-bottom:1.2rem; }
.section h2 { margin:0 0 1rem; font-size:1rem; }
.section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
.section-header h2 { margin:0; }

.form-group { display:flex; flex-direction:column; gap:.4rem; margin-bottom:.9rem; }
.form-group label { font-size:.8rem; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.glass-input { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.55rem .8rem; border-radius:.6rem; font-size:.9rem; font-family:inherit; outline:none; width:100%; box-sizing:border-box; }
.glass-input:focus { border-color:var(--accent); }
.glass-select { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.55rem .8rem; border-radius:.6rem; font-size:.9rem; font-family:inherit; outline:none; width:100%; cursor:pointer; }

.slug-row { display:flex; align-items:center; gap:0; }
.slug-prefix { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-right:none; padding:.55rem .8rem; border-radius:.6rem 0 0 .6rem; color:var(--muted); font-size:.85rem; white-space:nowrap; }
.slug-row .glass-input { border-radius:0 .6rem .6rem 0; }

.hint { font-size:.78rem; color:var(--muted); margin-top:.2rem; }

/* Fields */
.empty-fields { text-align:center; padding:2rem; color:var(--muted); }
.fields-list { display:flex; flex-direction:column; gap:.8rem; }
.field-card { padding:1.1rem; border-radius:1rem; border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.03); }
.field-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:.8rem; }
.field-type-badge { font-size:.72rem; font-weight:700; text-transform:uppercase; color:var(--accent); background:rgba(239,68,68,.1); padding:.2rem .6rem; border-radius:.4rem; letter-spacing:.05em; }
.field-card-controls { display:flex; gap:.3rem; }
.ctrl-btn { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); color:var(--text); width:28px; height:28px; border-radius:.4rem; cursor:pointer; font-size:.85rem; display:flex; align-items:center; justify-content:center; }
.ctrl-btn:disabled { opacity:.3; cursor:not-allowed; }
.ctrl-btn.danger:hover { background:rgba(239,68,68,.2); color:#f87171; }
.field-row { display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:.8rem; }
.toggle-group { justify-content:flex-end; padding-top:1.4rem; }
.toggle-label { display:flex; align-items:center; gap:.5rem; cursor:pointer; font-size:.9rem; color:var(--text); }
.toggle-label input[type="checkbox"] { accent-color:var(--accent); width:16px; height:16px; }

/* Sidebar */
.sidebar-col .section { margin-bottom:1rem; }
.guide-section ul.type-guide { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.6rem; }
.type-guide li { display:flex; gap:.6rem; align-items:flex-start; }
.type-icon { font-size:1rem; min-width:1.4rem; }
.type-guide strong { font-size:.8rem; display:block; }
.type-guide p { margin:0; font-size:.72rem; color:var(--muted); }
.muted-text { color:var(--muted); font-size:.85rem; margin:0 0 .8rem; }
.btn-ghost-full { display:block; text-align:center; background:transparent; border:1px solid rgba(255,255,255,.15); color:var(--text); padding:.55rem; border-radius:.6rem; text-decoration:none; font-size:.85rem; }
.btn-ghost-full:hover { background:rgba(255,255,255,.06); }
</style>
