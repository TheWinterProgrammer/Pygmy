<template>
  <div>
    <div class="page-header">
      <h1>✉️ Email Templates</h1>
      <button class="btn btn-primary" @click="openCreate">+ New Template</button>
    </div>

    <p class="intro-text">
      Customize the transactional emails Pygmy sends. System templates are built-in and can be edited but not deleted.
      Use <code>{{variable}}</code> tokens in subject and body.
    </p>

    <!-- Template cards -->
    <div class="tpl-grid" v-if="templates.length">
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="tpl-card glass"
        :class="{ inactive: !tpl.active }"
      >
        <div class="tpl-card-header">
          <div class="tpl-meta">
            <div class="tpl-name">{{ tpl.name }}</div>
            <div class="tpl-slug mono">{{ tpl.slug }}</div>
          </div>
          <div class="tpl-badges">
            <span class="badge badge-system" v-if="tpl.is_system">system</span>
            <span class="badge badge-active" v-if="tpl.active">active</span>
            <span class="badge badge-off" v-else>off</span>
          </div>
        </div>
        <div class="tpl-subject">📧 {{ tpl.subject }}</div>
        <div class="tpl-vars" v-if="tpl.variables && tpl.variables.length">
          <span v-for="v in tpl.variables.slice(0, 4)" :key="v.key" class="var-pill">{{ fmtVar(v.key) }}</span>
          <span class="var-more" v-if="tpl.variables.length > 4">+{{ tpl.variables.length - 4 }} more</span>
        </div>
        <div class="tpl-actions">
          <button class="btn-sm btn-primary" @click="openEdit(tpl)">✏️ Edit</button>
          <button class="btn-sm btn-secondary" @click="openPreview(tpl)">👁 Preview</button>
          <button class="btn-sm btn-secondary" @click="openTest(tpl)">📤 Test</button>
          <button class="btn-sm btn-danger" @click="deleteTpl(tpl)" v-if="!tpl.is_system">🗑</button>
        </div>
      </div>
    </div>
    <div v-else class="empty-state glass">No email templates found.</div>

    <!-- Edit / Create Modal -->
    <div class="modal-overlay" v-if="editModal.open" @click.self="editModal.open = false">
      <div class="modal glass-modal wide">
        <div class="modal-header">
          <h2>{{ editModal.id ? 'Edit Template' : 'New Template' }}</h2>
          <button class="modal-close" @click="editModal.open = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-two-col">
            <div class="form-row">
              <label>Template Name *</label>
              <input v-model="editModal.form.name" placeholder="e.g. Order Confirmation" />
            </div>
            <div class="form-row" v-if="!editModal.id">
              <label>Slug * (unique identifier)</label>
              <input v-model="editModal.form.slug" placeholder="order_confirmation" />
            </div>
            <div class="form-row full">
              <label>Subject Line</label>
              <input v-model="editModal.form.subject" placeholder="Your order has been received — #{{order_number}}" />
            </div>
          </div>

          <div class="form-row" style="margin-top:1rem">
            <label>HTML Body</label>
            <textarea v-model="editModal.form.html_body" rows="10" class="code-area" placeholder="<h2>Hi {{customer_name}},</h2>..."></textarea>
            <div class="field-hint">Supports HTML. Use <code>{{variable}}</code> tokens.</div>
          </div>
          <div class="form-row">
            <label>Plain Text Body</label>
            <textarea v-model="editModal.form.text_body" rows="5" class="code-area" placeholder="Hi {{customer_name}}, ..."></textarea>
          </div>

          <div class="form-row toggle-row">
            <label class="toggle-label">
              <input type="checkbox" v-model="editModal.form.active" />
              <span class="toggle"></span>
              Active (send this template when triggered)
            </label>
          </div>

          <!-- Variables reference -->
          <div class="vars-ref" v-if="editModal.form.variables && editModal.form.variables.length">
            <div class="vars-ref-title">📋 Available Variables</div>
            <div class="vars-ref-grid">
              <div v-for="v in editModal.form.variables" :key="v.key" class="var-ref-item">
                <code>{{ fmtVar(v.key) }}</code>
                <span>{{ v.description }}</span>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" @click="editModal.open = false">Cancel</button>
            <button class="btn btn-primary" @click="saveTpl" :disabled="editModal.saving">
              {{ editModal.saving ? 'Saving…' : 'Save Template' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <div class="modal-overlay" v-if="previewModal.open" @click.self="previewModal.open = false">
      <div class="modal glass-modal wide">
        <div class="modal-header">
          <h2>Preview: {{ previewModal.name }}</h2>
          <button class="modal-close" @click="previewModal.open = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="preview-subject">📧 Subject: <strong>{{ previewModal.subject }}</strong></div>
          <div class="preview-tabs">
            <button :class="{ active: previewModal.tab === 'html' }" @click="previewModal.tab = 'html'">HTML</button>
            <button :class="{ active: previewModal.tab === 'text' }" @click="previewModal.tab = 'text'">Plain Text</button>
          </div>
          <div v-if="previewModal.tab === 'html'" class="preview-html-wrap">
            <iframe :srcdoc="previewModal.html" class="preview-iframe"></iframe>
          </div>
          <div v-else class="preview-text-wrap">
            <pre>{{ previewModal.text }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Test Send Modal -->
    <div class="modal-overlay" v-if="testModal.open" @click.self="testModal.open = false">
      <div class="modal glass-modal small">
        <div class="modal-header">
          <h2>Send Test Email</h2>
          <button class="modal-close" @click="testModal.open = false">✕</button>
        </div>
        <div class="modal-body">
          <p style="color:#b0b0c0;font-size:.9rem">Send a test of <strong>{{ testModal.name }}</strong> with sample data filled in.</p>
          <div class="form-row">
            <label>Send to (email address)</label>
            <input v-model="testModal.to" type="email" placeholder="you@example.com" />
          </div>
          <div class="test-notice" v-if="testModal.sent">✅ Test email sent!</div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="testModal.open = false">Cancel</button>
            <button class="btn btn-primary" @click="sendTest" :disabled="testModal.sending">
              {{ testModal.sending ? 'Sending…' : '📤 Send Test' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

function fmtVar(key) { return '{{' + key + '}}' }

const templates = ref([])

async function fetchTemplates() {
  const { data } = await api.get('/email-templates')
  templates.value = data
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const editModal = ref({ open: false, id: null, saving: false, form: {} })

function openCreate() {
  editModal.value = {
    open: true, id: null, saving: false,
    form: { name: '', slug: '', subject: '', html_body: '', text_body: '', active: true, variables: [] }
  }
}

function openEdit(tpl) {
  editModal.value = {
    open: true, id: tpl.id, saving: false,
    form: {
      name:      tpl.name,
      slug:      tpl.slug,
      subject:   tpl.subject,
      html_body: tpl.html_body,
      text_body: tpl.text_body,
      active:    !!tpl.active,
      variables: tpl.variables || [],
    }
  }
}

async function saveTpl() {
  editModal.value.saving = true
  try {
    if (editModal.value.id) {
      await api.put(`/email-templates/${editModal.value.id}`, editModal.value.form)
    } else {
      await api.post('/email-templates', editModal.value.form)
    }
    editModal.value.open = false
    await fetchTemplates()
  } finally {
    editModal.value.saving = false
  }
}

async function deleteTpl(tpl) {
  if (!confirm(`Delete template "${tpl.name}"?`)) return
  await api.delete(`/email-templates/${tpl.id}`)
  await fetchTemplates()
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
const previewModal = ref({ open: false, name: '', subject: '', html: '', text: '', tab: 'html' })

async function openPreview(tpl) {
  const { data } = await api.post(`/email-templates/${tpl.id}/preview`, { vars: {} })
  previewModal.value = { open: true, name: tpl.name, subject: data.subject, html: data.html, text: data.text, tab: 'html' }
}

// ─── Test Modal ───────────────────────────────────────────────────────────────
const testModal = ref({ open: false, id: null, name: '', to: '', sending: false, sent: false })

function openTest(tpl) {
  testModal.value = { open: true, id: tpl.id, name: tpl.name, to: '', sending: false, sent: false }
}

async function sendTest() {
  testModal.value.sending = true
  try {
    await api.post(`/email-templates/${testModal.value.id}/test`, { to: testModal.value.to })
    testModal.value.sent = true
  } finally {
    testModal.value.sending = false
  }
}

onMounted(fetchTemplates)
</script>

<style scoped>
.intro-text { color: #888; font-size: .88rem; margin-bottom: 1.5rem; }
.intro-text code { background: rgba(255,255,255,.08); padding: .1em .4em; border-radius: .3rem; font-size: .85em; }

.tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
.tpl-card { border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; gap: .75rem; }
.tpl-card.inactive { opacity: .6; }
.tpl-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: .5rem; }
.tpl-meta .tpl-name { font-weight: 700; color: #e2e2e8; }
.tpl-meta .tpl-slug { font-size: .75rem; color: #666; font-family: monospace; }
.tpl-badges { display: flex; gap: .35rem; flex-wrap: wrap; flex-shrink: 0; }
.badge { display: inline-block; padding: .2em .55em; border-radius: 999px; font-size: .72rem; font-weight: 600; }
.badge-system { background: hsl(210,50%,18%); color: hsl(210,70%,60%); }
.badge-active { background: hsl(140,50%,16%); color: hsl(140,60%,55%); }
.badge-off    { background: rgba(255,255,255,.06); color: #666; }
.tpl-subject { font-size: .85rem; color: #b0b0c0; border-left: 3px solid rgba(255,255,255,.1); padding-left: .75rem; }
.tpl-vars { display: flex; flex-wrap: wrap; gap: .35rem; }
.var-pill { background: rgba(255,255,255,.07); border-radius: .3rem; padding: .15em .5em; font-family: monospace; font-size: .72rem; color: #aaa; }
.var-more { font-size: .72rem; color: #666; padding: .15em .25em; }
.tpl-actions { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: auto; }
.btn-sm { padding: .25rem .6rem; border-radius: .35rem; border: none; cursor: pointer; font-size: .8rem; }
.btn-sm.btn-primary   { background: var(--accent); color: #fff; }
.btn-sm.btn-secondary { background: rgba(255,255,255,.08); color: #ccc; }
.btn-sm.btn-danger    { background: hsl(355,70%,22%); color: hsl(355,70%,65%); }
.empty-state { padding: 3rem; text-align: center; color: #555; border-radius: 1rem; }

/* Modal base */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.glass-modal { background: hsl(228,4%,14%); border: 1px solid rgba(255,255,255,.1); border-radius: 1.25rem; max-height: 90vh; display: flex; flex-direction: column; }
.glass-modal.wide  { width: 100%; max-width: 760px; }
.glass-modal.small { width: 100%; max-width: 440px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.07); flex-shrink: 0; }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-close { background: none; border: none; color: #888; font-size: 1.2rem; cursor: pointer; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.modal-actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1.25rem; }

.form-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.form-two-col .form-row.full { grid-column: 1 / -1; }
.form-row { margin-bottom: .9rem; }
.form-row label { display: block; font-size: .8rem; color: #888; margin-bottom: .3rem; }
.form-row input, .form-row select, .form-row textarea {
  width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  border-radius: .5rem; color: #e2e2e8; padding: .45rem .75rem; font-size: .9rem; box-sizing: border-box;
}
.code-area { font-family: monospace; font-size: .82rem; resize: vertical; }
.field-hint { font-size: .75rem; color: #666; margin-top: .25rem; }
.field-hint code { background: rgba(255,255,255,.07); padding: .1em .3em; border-radius: .2rem; }

.toggle-row { margin-top: .5rem; }
.toggle-label { display: flex; align-items: center; gap: .6rem; cursor: pointer; font-size: .88rem; color: #ccc; }
.toggle-label input[type="checkbox"] { width: auto; accent-color: var(--accent); transform: scale(1.2); }

.vars-ref { background: rgba(255,255,255,.04); border-radius: .75rem; padding: 1rem; margin-top: 1rem; }
.vars-ref-title { font-size: .8rem; color: #888; font-weight: 600; margin-bottom: .6rem; }
.vars-ref-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .4rem; }
.var-ref-item { display: flex; flex-direction: column; gap: .1rem; }
.var-ref-item code { font-size: .75rem; background: rgba(255,255,255,.07); padding: .1em .4em; border-radius: .3rem; display: inline-block; }
.var-ref-item span { font-size: .72rem; color: #666; }

.preview-subject { font-size: .88rem; color: #b0b0c0; margin-bottom: 1rem; }
.preview-tabs { display: flex; gap: .5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,.07); padding-bottom: .5rem; }
.preview-tabs button { background: none; border: none; color: #888; cursor: pointer; font-size: .85rem; padding: .25rem .6rem; border-radius: .4rem; }
.preview-tabs button.active { background: rgba(255,255,255,.1); color: #e2e2e8; }
.preview-iframe { width: 100%; height: 400px; border: 1px solid rgba(255,255,255,.08); border-radius: .5rem; background: #fff; }
.preview-text-wrap pre { background: rgba(255,255,255,.04); padding: 1rem; border-radius: .5rem; font-size: .82rem; color: #ccc; white-space: pre-wrap; }

.test-notice { background: hsl(140,50%,16%); color: hsl(140,60%,55%); padding: .6rem 1rem; border-radius: .5rem; font-size: .85rem; margin-top: .5rem; }

.btn { padding: .45rem 1.1rem; border-radius: .5rem; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; }
.btn-primary   { background: var(--accent); color: #fff; }
.btn-primary:disabled { opacity: .5; cursor: default; }
.btn-secondary { background: rgba(255,255,255,.08); color: #ccc; }
.mono { font-family: monospace; }

@media (max-width: 600px) {
  .form-two-col { grid-template-columns: 1fr; }
  .form-two-col .form-row.full { grid-column: 1; }
  .tpl-grid { grid-template-columns: 1fr; }
}
</style>
