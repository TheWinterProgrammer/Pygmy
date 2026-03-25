<template>
  <div class="nt-view">
    <div class="page-header">
      <div class="header-left">
        <h1>📧 Newsletter Templates</h1>
        <p class="subtitle">Reusable email templates for newsletter campaigns</p>
      </div>
      <button class="btn-primary" @click="openNew">+ New Template</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="templates.length > 0">
      <div class="stat-card">
        <div class="stat-value">{{ templates.length }}</div>
        <div class="stat-label">Templates</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ templates.filter(t=>t.active).length }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div v-for="cat in categories" :key="cat" class="stat-card">
        <div class="stat-value">{{ templates.filter(t=>t.category===cat).length }}</div>
        <div class="stat-label">{{ cat }}</div>
      </div>
    </div>

    <!-- Filter -->
    <div class="toolbar">
      <input v-model="q" class="input search-input" placeholder="Search templates…" />
      <select v-model="filterCat" class="input">
        <option value="">All categories</option>
        <option value="general">General</option>
        <option value="promotional">Promotional</option>
        <option value="welcome">Welcome</option>
        <option value="digest">Digest</option>
        <option value="transactional">Transactional</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">Loading…</div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="empty-state glass">
      <div class="empty-icon">📧</div>
      <h3>No templates yet</h3>
      <p>Create your first email template to reuse across campaigns.</p>
      <button class="btn-primary" @click="openNew">+ New Template</button>
    </div>

    <!-- Template Grid -->
    <div v-else class="template-grid">
      <div v-for="t in filtered" :key="t.id" class="template-card glass">
        <div class="card-header">
          <span class="cat-badge" :class="`cat-${t.category}`">{{ t.category }}</span>
          <span v-if="!t.active" class="inactive-badge">Inactive</span>
        </div>
        <h3 class="card-name">{{ t.name }}</h3>
        <p class="card-subject" v-if="t.subject">📨 {{ t.subject }}</p>
        <p class="card-blocks">{{ t.html_blocks?.length || 0 }} blocks</p>
        <p class="card-date">Updated {{ timeAgo(t.updated_at) }}</p>
        <div class="card-actions">
          <button class="btn-sm" @click="openEdit(t)">✏️ Edit</button>
          <button class="btn-sm" @click="previewTemplate(t)">👁️ Preview</button>
          <button class="btn-sm" @click="duplicateTemplate(t)">📋 Duplicate</button>
          <button class="btn-sm btn-ghost" @click="useInNewsletter(t)">📤 Use</button>
          <button class="btn-sm btn-danger" @click="confirmDelete(t)">🗑️</button>
        </div>
      </div>
    </div>

    <!-- ── Editor Modal ─────────────────────────────────────── -->
    <div v-if="editing" class="modal-overlay" @click.self="closeEditor">
      <div class="modal modal-xl glass">
        <div class="modal-header">
          <h2>{{ editing.id ? 'Edit Template' : 'New Template' }}</h2>
          <button class="btn-icon" @click="closeEditor">✕</button>
        </div>
        <div class="modal-body editor-layout">
          <!-- Left: Meta + block list -->
          <div class="editor-left">
            <div class="form-group">
              <label>Template Name</label>
              <input v-model="editing.name" class="input" placeholder="E.g. Monthly Newsletter" />
            </div>
            <div class="form-group">
              <label>Email Subject</label>
              <input v-model="editing.subject" class="input" placeholder="Subject line…" />
            </div>
            <div class="form-group">
              <label>Preview Text</label>
              <input v-model="editing.preview_text" class="input" placeholder="Short preview shown in inbox…" />
            </div>
            <div class="form-group">
              <label>Category</label>
              <select v-model="editing.category" class="input">
                <option value="general">General</option>
                <option value="promotional">Promotional</option>
                <option value="welcome">Welcome</option>
                <option value="digest">Digest</option>
                <option value="transactional">Transactional</option>
              </select>
            </div>
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" v-model="editing.active" />
                Active
              </label>
            </div>

            <div class="blocks-section">
              <div class="blocks-header">
                <h3>Content Blocks</h3>
                <div class="add-block-menu">
                  <button class="btn-sm" @click="showBlockPicker = !showBlockPicker">+ Add Block</button>
                  <div v-if="showBlockPicker" class="block-picker glass">
                    <button v-for="bt in blockTypes" :key="bt.type" @click="addBlock(bt.type)">
                      {{ bt.icon }} {{ bt.label }}
                    </button>
                  </div>
                </div>
              </div>
              <div class="block-list">
                <div v-if="editing.html_blocks?.length === 0" class="no-blocks">
                  No blocks yet. Add some above.
                </div>
                <div
                  v-for="(block, idx) in editing.html_blocks"
                  :key="block._id"
                  class="block-row glass"
                  :class="{ 'block-active': selectedBlock === idx }"
                  @click="selectedBlock = idx"
                >
                  <span class="block-icon">{{ blockIcon(block.type) }}</span>
                  <span class="block-type">{{ block.type }}</span>
                  <span class="block-preview">{{ blockPreview(block) }}</span>
                  <div class="block-row-actions">
                    <button @click.stop="moveBlock(idx, -1)" :disabled="idx === 0">↑</button>
                    <button @click.stop="moveBlock(idx, 1)" :disabled="idx === editing.html_blocks.length-1">↓</button>
                    <button @click.stop="deleteBlock(idx)" class="danger">✕</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Block settings + preview -->
          <div class="editor-right">
            <div v-if="selectedBlock !== null && editing.html_blocks[selectedBlock]" class="block-settings glass">
              <h3>{{ blockIcon(editing.html_blocks[selectedBlock].type) }} {{ editing.html_blocks[selectedBlock].type }} settings</h3>
              <BlockSettingsEditor
                :block="editing.html_blocks[selectedBlock]"
                @update="updateBlock(selectedBlock, $event)"
              />
            </div>
            <div v-else class="select-block-hint">
              <p>👈 Select a block to edit its settings</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="closeEditor">Cancel</button>
          <button class="btn-secondary" @click="saveAndPreview">👁️ Save & Preview</button>
          <button class="btn-primary" @click="saveTemplate" :disabled="saving">
            {{ saving ? 'Saving…' : '💾 Save Template' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Preview Modal ──────────────────────────────────── -->
    <div v-if="previewHtml" class="modal-overlay" @click.self="previewHtml = null">
      <div class="modal modal-xl glass">
        <div class="modal-header">
          <h2>📧 Template Preview — {{ previewName }}</h2>
          <button class="btn-icon" @click="previewHtml = null">✕</button>
        </div>
        <div class="preview-iframe-wrap">
          <iframe :srcdoc="previewHtml" class="preview-iframe"></iframe>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="previewHtml = null">Close</button>
          <button class="btn-primary" @click="copyHtml">📋 Copy HTML</button>
        </div>
      </div>
    </div>

    <!-- ── Delete Confirm ─────────────────────────────────── -->
    <div v-if="deleting" class="modal-overlay" @click.self="deleting = null">
      <div class="modal modal-sm glass">
        <div class="modal-header"><h2>🗑️ Delete Template</h2></div>
        <div class="modal-body">
          <p>Delete "{{ deleting.name }}"? This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="deleting = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineComponent, h } from 'vue'
import api from '../api.js'

// ─── Block Settings Editor (inline) ─────────────────────────────────────────
const BlockSettingsEditor = defineComponent({
  name: 'BlockSettingsEditor',
  props: { block: Object },
  emits: ['update'],
  setup(props, { emit }) {
    function upd(key, val) {
      emit('update', { ...props.block.settings, [key]: val })
    }
    function field(label, key, type = 'text', placeholder = '') {
      return h('div', { class: 'form-group' }, [
        h('label', label),
        h('input', {
          type, value: props.block.settings?.[key] ?? '',
          placeholder,
          class: 'input',
          onInput: e => upd(key, e.target.value)
        })
      ])
    }
    function textarea(label, key) {
      return h('div', { class: 'form-group' }, [
        h('label', label),
        h('textarea', {
          value: props.block.settings?.[key] ?? '',
          class: 'input',
          rows: 4,
          onInput: e => upd(key, e.target.value)
        })
      ])
    }
    function colorField(label, key, def = '#ffffff') {
      return h('div', { class: 'form-group color-row' }, [
        h('label', label),
        h('input', {
          type: 'color',
          value: props.block.settings?.[key] ?? def,
          onInput: e => upd(key, e.target.value)
        }),
        h('input', {
          type: 'text',
          value: props.block.settings?.[key] ?? def,
          class: 'input color-text',
          onInput: e => upd(key, e.target.value)
        })
      ])
    }
    function selectField(label, key, options) {
      return h('div', { class: 'form-group' }, [
        h('label', label),
        h('select', {
          value: props.block.settings?.[key] ?? options[0].value,
          class: 'input',
          onChange: e => upd(key, e.target.value)
        }, options.map(o => h('option', { value: o.value }, o.label)))
      ])
    }
    return () => {
      const t = props.block?.type
      if (!t) return null
      const fields = []
      if (t === 'header') {
        fields.push(field('Title', 'title', 'text', 'Newsletter Header'))
        fields.push(field('Subtitle', 'subtitle', 'text', 'Optional subtitle'))
        fields.push(field('Logo URL', 'logo_url', 'url'))
        fields.push(colorField('Background', 'bg_color', 'hsl(355,70%,58%)'))
        fields.push(colorField('Text color', 'text_color', '#ffffff'))
        fields.push(selectField('Align', 'align', [{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}]))
      } else if (t === 'text') {
        fields.push(textarea('Content (HTML allowed)', 'content'))
        fields.push(colorField('Text color', 'text_color', '#374151'))
        fields.push(selectField('Align', 'align', [{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}]))
        fields.push(field('Padding', 'padding', 'text', '2rem'))
        fields.push(field('Font size', 'font_size', 'text', '1rem'))
      } else if (t === 'image') {
        fields.push(field('Image URL', 'src', 'url', 'https://…'))
        fields.push(field('Alt text', 'alt', 'text'))
        fields.push(field('Link URL', 'link', 'url', 'https://…'))
        fields.push(field('Caption', 'caption', 'text'))
        fields.push(selectField('Align', 'align', [{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}]))
        fields.push(field('Border radius', 'radius', 'text', '0'))
      } else if (t === 'button') {
        fields.push(field('Button label', 'label', 'text', 'Click here'))
        fields.push(field('URL', 'url', 'url', 'https://…'))
        fields.push(colorField('Background', 'bg_color', 'hsl(355,70%,58%)'))
        fields.push(colorField('Text color', 'text_color', '#ffffff'))
        fields.push(selectField('Align', 'align', [{value:'left',label:'Left'},{value:'center',label:'Center'},{value:'right',label:'Right'}]))
        fields.push(field('Border radius', 'radius', 'text', '8px'))
        fields.push(field('Font size', 'font_size', 'text', '1rem'))
      } else if (t === 'divider') {
        fields.push(field('Border style', 'style', 'text', '1px solid #e5e7eb'))
        fields.push(field('Padding', 'padding', 'text', '.5rem 2rem'))
      } else if (t === 'spacer') {
        fields.push(field('Height', 'height', 'text', '2rem'))
      }
      return h('div', { class: 'block-settings-fields' }, fields)
    }
  }
})

// ─── State ────────────────────────────────────────────────────────────────────
const templates = ref([])
const loading = ref(true)
const q = ref('')
const filterCat = ref('')
const editing = ref(null)
const selectedBlock = ref(null)
const showBlockPicker = ref(false)
const saving = ref(false)
const previewHtml = ref(null)
const previewName = ref('')
const deleting = ref(null)

const blockTypes = [
  { type: 'header', icon: '🏷️', label: 'Header' },
  { type: 'text',   icon: '📝', label: 'Text' },
  { type: 'image',  icon: '🖼️', label: 'Image' },
  { type: 'button', icon: '🔘', label: 'Button' },
  { type: 'divider',icon: '➖', label: 'Divider' },
  { type: 'spacer', icon: '⬜', label: 'Spacer' },
  { type: 'columns',icon: '📋', label: 'Columns' },
  { type: 'social', icon: '📱', label: 'Social Links' },
]

const categories = computed(() => [...new Set(templates.value.map(t => t.category))].sort())

const filtered = computed(() => {
  let r = templates.value
  if (q.value) r = r.filter(t => t.name.toLowerCase().includes(q.value.toLowerCase()) || t.subject?.toLowerCase().includes(q.value.toLowerCase()))
  if (filterCat.value) r = r.filter(t => t.category === filterCat.value)
  return r
})

async function load() {
  loading.value = true
  try { templates.value = (await api.get('/newsletter-templates')).data } catch {}
  loading.value = false
}

onMounted(load)

// ─── Actions ──────────────────────────────────────────────────────────────────
function openNew() {
  editing.value = { name: 'New Template', subject: '', preview_text: '', category: 'general', active: true, html_blocks: [] }
  selectedBlock.value = null
}

function openEdit(t) {
  editing.value = JSON.parse(JSON.stringify(t))
  // Add _id to each block for keying
  editing.value.html_blocks = (editing.value.html_blocks || []).map((b, i) => ({ ...b, _id: i }))
  selectedBlock.value = null
}

function closeEditor() { editing.value = null; selectedBlock.value = null }

let _bid = 1000
function addBlock(type) {
  if (!editing.value.html_blocks) editing.value.html_blocks = []
  editing.value.html_blocks.push({ type, settings: {}, _id: _bid++ })
  selectedBlock.value = editing.value.html_blocks.length - 1
  showBlockPicker.value = false
}

function deleteBlock(idx) {
  editing.value.html_blocks.splice(idx, 1)
  selectedBlock.value = null
}

function moveBlock(idx, dir) {
  const blocks = editing.value.html_blocks
  const target = idx + dir
  if (target < 0 || target >= blocks.length) return
  ;[blocks[idx], blocks[target]] = [blocks[target], blocks[idx]]
  selectedBlock.value = target
}

function updateBlock(idx, newSettings) {
  editing.value.html_blocks[idx] = { ...editing.value.html_blocks[idx], settings: newSettings }
}

async function saveTemplate() {
  if (!editing.value.name) return
  saving.value = true
  try {
    // Clean _id from blocks before saving
    const payload = { ...editing.value, html_blocks: (editing.value.html_blocks || []).map(({ _id, ...b }) => b) }
    if (editing.value.id) {
      const { data } = await api.put(`/newsletter-templates/${editing.value.id}`, payload)
      const idx = templates.value.findIndex(t => t.id === editing.value.id)
      if (idx > -1) templates.value[idx] = data
    } else {
      const { data } = await api.post('/newsletter-templates', payload)
      templates.value.unshift(data)
    }
    closeEditor()
  } catch {}
  saving.value = false
}

async function saveAndPreview() {
  await saveTemplate()
  if (editing.value) return // save failed
  // Get the last saved template
  await load()
  // Preview the most recently updated
}

async function previewTemplate(t) {
  try {
    const { data } = await api.post(`/newsletter-templates/${t.id}/render`)
    previewHtml.value = data.html
    previewName.value = t.name
  } catch { alert('Preview failed') }
}

async function duplicateTemplate(t) {
  try {
    const { data } = await api.post(`/newsletter-templates/${t.id}/duplicate`)
    templates.value.unshift(data)
  } catch {}
}

function useInNewsletter(t) {
  // Navigate to newsletter with template pre-selected
  window.location.href = `/newsletter?template_id=${t.id}`
}

function confirmDelete(t) { deleting.value = t }
async function doDelete() {
  if (!deleting.value) return
  await api.delete(`/newsletter-templates/${deleting.value.id}`)
  templates.value = templates.value.filter(t => t.id !== deleting.value.id)
  deleting.value = null
}

function copyHtml() {
  if (previewHtml.value) {
    navigator.clipboard.writeText(previewHtml.value)
  }
}

function blockIcon(type) {
  return blockTypes.find(b => b.type === type)?.icon || '📦'
}
function blockPreview(block) {
  const s = block.settings || {}
  return s.title || s.content?.replace(/<[^>]+>/g, '').slice(0, 40) || s.label || s.src || ''
}

function timeAgo(d) {
  if (!d) return ''
  const diff = (Date.now() - new Date(d)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}
</script>

<style scoped>
.nt-view { padding: 1.5rem; }
.page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem; }
.header-left h1 { margin:0;font-size:1.6rem; }
.subtitle { color:var(--muted,rgba(255,255,255,.5));margin:.25rem 0 0;font-size:.9rem; }
.stats-strip { display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap; }
.stat-card { background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:1rem;padding:1rem 1.5rem;min-width:100px;text-align:center; }
.stat-card.accent { border-color:var(--accent,hsl(355,70%,58%));color:var(--accent,hsl(355,70%,58%)); }
.stat-value { font-size:1.6rem;font-weight:700; }
.stat-label { font-size:.75rem;color:var(--muted,rgba(255,255,255,.5));margin-top:.25rem; }
.toolbar { display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap; }
.search-input { flex:1;min-width:200px; }
.input { background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:.75rem;padding:.6rem .9rem;font-size:.9rem;font-family:inherit; }
.loading { text-align:center;padding:3rem;color:rgba(255,255,255,.4); }
.glass { background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(16px); }
.empty-state { border-radius:1.5rem;padding:3rem;text-align:center; }
.empty-icon { font-size:3rem;margin-bottom:.75rem; }
.empty-state h3 { margin:0 0 .5rem; }
.empty-state p { color:rgba(255,255,255,.5);margin:0 0 1.5rem; }
.template-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.25rem; }
.template-card { border-radius:1.25rem;padding:1.25rem;display:flex;flex-direction:column;gap:.5rem; }
.card-header { display:flex;gap:.5rem;align-items:center; }
.cat-badge { font-size:.7rem;font-weight:700;text-transform:uppercase;padding:.2rem .5rem;border-radius:.4rem;background:rgba(255,255,255,.1); }
.cat-promotional { background:rgba(250,174,64,.2);color:#fbbf24; }
.cat-welcome { background:rgba(74,222,128,.2);color:#4ade80; }
.cat-digest { background:rgba(99,179,237,.2);color:#63b3ed; }
.cat-transactional { background:rgba(167,139,250,.2);color:#a78bfa; }
.inactive-badge { font-size:.7rem;color:rgba(255,255,255,.4);margin-left:auto; }
.card-name { margin:0;font-size:1rem;font-weight:700; }
.card-subject, .card-blocks, .card-date { margin:0;font-size:.8rem;color:rgba(255,255,255,.5); }
.card-actions { display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem; }
.btn-primary { background:var(--accent,hsl(355,70%,58%));color:#fff;border:none;border-radius:.75rem;padding:.6rem 1.2rem;cursor:pointer;font-weight:600;font-size:.9rem; }
.btn-secondary { background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:.75rem;padding:.6rem 1.2rem;cursor:pointer;font-size:.9rem; }
.btn-ghost { background:transparent;color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.15);border-radius:.75rem;padding:.6rem 1.2rem;cursor:pointer;font-size:.9rem; }
.btn-danger { background:rgba(248,113,113,.15);color:#f87171;border:1px solid rgba(248,113,113,.3);border-radius:.75rem;padding:.6rem 1.2rem;cursor:pointer;font-size:.9rem; }
.btn-sm { background:rgba(255,255,255,.08);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.1);border-radius:.5rem;padding:.35rem .65rem;cursor:pointer;font-size:.75rem; }
.btn-sm.btn-danger { background:rgba(248,113,113,.1);color:#f87171;border-color:rgba(248,113,113,.2); }
.btn-sm.btn-ghost { background:transparent;color:rgba(255,255,255,.5);border-color:rgba(255,255,255,.08); }
.btn-icon { background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:1.2rem;padding:.25rem; }
/* Modal */
.modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem; }
.modal { border-radius:1.5rem;width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden; }
.modal-sm { max-width:440px; }
.modal-xl { max-width:1100px; }
.modal-header { display:flex;justify-content:space-between;align-items:center;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.08); }
.modal-header h2 { margin:0;font-size:1.2rem; }
.modal-body { flex:1;overflow-y:auto;padding:1.5rem; }
.modal-footer { display:flex;gap:.75rem;justify-content:flex-end;padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.08); }
/* Editor layout */
.editor-layout { display:grid;grid-template-columns:340px 1fr;gap:1.5rem;min-height:400px; }
.editor-left { display:flex;flex-direction:column;gap:1rem;overflow-y:auto; }
.form-group { display:flex;flex-direction:column;gap:.4rem; }
.form-group label { font-size:.8rem;color:rgba(255,255,255,.6); }
.toggle-label { display:flex;gap:.5rem;align-items:center;cursor:pointer;font-size:.9rem; }
.blocks-section { flex:1; }
.blocks-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem; }
.blocks-header h3 { margin:0;font-size:.95rem; }
.add-block-menu { position:relative; }
.block-picker { position:absolute;top:100%;right:0;z-index:10;border-radius:.75rem;padding:.5rem;display:flex;flex-direction:column;gap:.25rem;min-width:160px; }
.block-picker button { background:none;border:none;color:rgba(255,255,255,.8);cursor:pointer;padding:.4rem .75rem;text-align:left;border-radius:.4rem;font-size:.85rem; }
.block-picker button:hover { background:rgba(255,255,255,.08); }
.block-list { display:flex;flex-direction:column;gap:.4rem;max-height:300px;overflow-y:auto; }
.no-blocks { text-align:center;color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem; }
.block-row { display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:.6rem;cursor:pointer;transition:background .15s; }
.block-row:hover { background:rgba(255,255,255,.08); }
.block-active { border-color:var(--accent,hsl(355,70%,58%)) !important; }
.block-icon { flex-shrink:0; }
.block-type { font-size:.75rem;font-weight:600;text-transform:uppercase;opacity:.7;width:60px;flex-shrink:0; }
.block-preview { font-size:.8rem;color:rgba(255,255,255,.5);flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis; }
.block-row-actions { display:flex;gap:.3rem;flex-shrink:0; }
.block-row-actions button { background:none;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5);border-radius:.3rem;padding:.1rem .4rem;cursor:pointer;font-size:.75rem; }
.block-row-actions button.danger { color:#f87171;border-color:rgba(248,113,113,.3); }
.block-row-actions button:disabled { opacity:.3;cursor:not-allowed; }
.editor-right { overflow-y:auto; }
.block-settings { border-radius:1rem;padding:1.25rem; }
.block-settings h3 { margin:0 0 1rem;font-size:.95rem; }
.block-settings-fields { display:flex;flex-direction:column;gap:.75rem; }
.select-block-hint { text-align:center;padding:3rem;color:rgba(255,255,255,.3); }
.color-row { flex-direction:row;align-items:center;gap:.5rem; }
.color-row label { min-width:80px; }
.color-row input[type=color] { width:40px;height:36px;border-radius:.5rem;border:none;cursor:pointer; }
.color-text { flex:1; }
/* Preview */
.preview-iframe-wrap { flex:1;padding:1rem;overflow:hidden; }
.preview-iframe { width:100%;height:500px;border:none;border-radius:.75rem;background:#fff; }
@media (max-width:700px) { .editor-layout { grid-template-columns:1fr; } }
</style>
