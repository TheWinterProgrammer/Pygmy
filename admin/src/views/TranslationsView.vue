<template>
  <div class="translations-view">
    <div class="page-header">
      <div>
        <h1>🌐 Content Translations</h1>
        <p class="subtitle">Manage multilingual content for posts, pages, and products</p>
      </div>
      <div class="header-actions">
        <select v-model="entityType" @change="loadItems" class="form-input" style="width:140px">
          <option value="post">Posts</option>
          <option value="page">Pages</option>
          <option value="product">Products</option>
        </select>
        <select v-model="selectedLang" @change="loadItems" class="form-input" style="width:160px">
          <option value="">All Languages</option>
          <option v-for="l in languages" :key="l.code" :value="l.code">
            {{ l.flag }} {{ l.name }}
          </option>
        </select>
        <button class="btn btn-ghost" @click="loadCoverage">📊 Coverage</button>
      </div>
    </div>

    <!-- Coverage Stats -->
    <div v-if="showCoverage && coverage" class="coverage-grid">
      <div v-for="(data, code) in coverage" :key="code" class="coverage-card glass">
        <div class="cov-lang">{{ data.flag }} {{ data.name }}</div>
        <div class="cov-stats">
          <div v-for="(counts, type) in data.counts" :key="type" class="cov-stat">
            <div class="cov-type">{{ typeLabel(type) }}</div>
            <div class="cov-bar-wrap">
              <div class="cov-bar" :style="{ width: pct(counts.translated, counts.total) + '%' }"></div>
            </div>
            <div class="cov-pct">{{ counts.translated }}/{{ counts.total }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div class="glass table-card">
      <div class="table-toolbar">
        <input class="form-input" placeholder="Search…" v-model="q" @input="debouncedLoad" style="width:220px" />
        <button class="btn btn-ghost btn-sm" @click="loadItems">🔄 Refresh</button>
        <span class="item-count" v-if="items.length">{{ items.length }} items</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th v-for="l in languages" :key="l.code" class="lang-col">
              {{ l.flag }} {{ l.code.toUpperCase() }}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredItems" :key="item.id">
            <td>{{ item.title }}</td>
            <td><code class="slug-badge">{{ item.slug }}</code></td>
            <td v-for="l in languages" :key="l.code" class="lang-cell">
              <span v-if="hasTranslation(item.id, l.code)" class="badge badge-green" title="Translated">✓</span>
              <span v-else class="badge badge-muted" title="Missing">—</span>
            </td>
            <td>
              <div class="row-actions">
                <button class="btn btn-xs btn-accent" @click="openEditor(item)">✏️ Translate</button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredItems.length">
            <td :colspan="3 + languages.length" class="empty-cell">No items found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Translation Editor Modal -->
    <div v-if="editModal.show" class="modal-overlay" @click.self="editModal.show = false">
      <div class="modal-panel lg" style="max-width:900px;width:95vw">
        <div class="modal-header">
          <h2>🌐 Translate: {{ editModal.item?.title }}</h2>
          <button class="btn-close" @click="editModal.show = false">✕</button>
        </div>

        <div class="lang-tabs">
          <button
            v-for="l in languages"
            :key="l.code"
            :class="['lang-tab', { active: editModal.activeLang === l.code }]"
            @click="switchLang(l.code)"
          >
            {{ l.flag }} {{ l.name }}
            <span v-if="hasTranslation(editModal.item?.id, l.code)" class="translated-dot"></span>
          </button>
        </div>

        <div v-if="editModal.activeLang" class="translation-fields">
          <div class="field-group">
            <label class="field-label">Title</label>
            <input class="form-input" v-model="editModal.fields.title" :placeholder="editModal.item?.title" />
          </div>
          <div class="field-group" v-if="entityType !== 'product'">
            <label class="field-label">Excerpt</label>
            <textarea class="form-input" rows="2" v-model="editModal.fields.excerpt" placeholder="Brief summary…"></textarea>
          </div>
          <div class="field-group">
            <label class="field-label">Meta Title</label>
            <input class="form-input" v-model="editModal.fields.meta_title" placeholder="SEO title…" />
          </div>
          <div class="field-group">
            <label class="field-label">Meta Description</label>
            <textarea class="form-input" rows="2" v-model="editModal.fields.meta_description" placeholder="SEO description…"></textarea>
          </div>
          <div class="field-group">
            <label class="field-label">Content</label>
            <textarea class="form-input" rows="10" v-model="editModal.fields.content" placeholder="Full content in the target language…"></textarea>
            <p class="field-hint">Tip: paste translated HTML content here.</p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTranslation" v-if="hasTranslation(editModal.item?.id, editModal.activeLang)">
            🗑️ Remove {{ editModal.activeLang?.toUpperCase() }} Translation
          </button>
          <div style="flex:1"></div>
          <button class="btn btn-ghost" @click="editModal.show = false">Cancel</button>
          <button class="btn btn-accent" @click="saveTranslation" :disabled="saving">
            {{ saving ? 'Saving…' : '💾 Save Translation' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const entityType = ref('post')
const selectedLang = ref('')
const q = ref('')
const items = ref([])
const languages = ref([])
const translationMap = ref({}) // { entityId: { langCode: true/false } }
const coverage = ref(null)
const showCoverage = ref(false)
const saving = ref(false)

const editModal = ref({
  show: false,
  item: null,
  activeLang: null,
  fields: {}
})

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadItems, 300)
}

const filteredItems = computed(() => {
  if (!q.value) return items.value
  const s = q.value.toLowerCase()
  return items.value.filter(i =>
    i.title?.toLowerCase().includes(s) || i.slug?.toLowerCase().includes(s)
  )
})

function pct(n, total) {
  if (!total) return 0
  return Math.round((n / total) * 100)
}

function typeLabel(type) {
  return { post: 'Posts', page: 'Pages', product: 'Products' }[type] || type
}

function hasTranslation(id, lang) {
  return translationMap.value[id]?.[lang] || false
}

async function loadLanguages() {
  const { data } = await api.get('/languages?active=1')
  languages.value = (Array.isArray(data) ? data : []).filter(l => !l.is_default)
}

async function loadItems() {
  const tableMap = { post: 'posts', page: 'pages', product: 'products' }
  const { data } = await api.get(`/${tableMap[entityType.value]}?all=1&limit=200`)
  const list = Array.isArray(data) ? data : (data?.items || [])
  items.value = list

  // Fetch translation coverage per item per language
  translationMap.value = {}
  if (languages.value.length && list.length) {
    for (const lang of languages.value) {
      for (const item of list.slice(0, 50)) {
        // We'll lazy-check when opening editor; for table, derive from coverage
      }
    }
    // Batch: fetch coverage for current type+lang
    if (selectedLang.value) {
      const { data: missing } = await api.get(`/translations/missing/${selectedLang.value}?type=${entityType.value}`)
      const missingIds = new Set((missing || []).map(m => m.id))
      for (const item of list) {
        if (!translationMap.value[item.id]) translationMap.value[item.id] = {}
        translationMap.value[item.id][selectedLang.value] = !missingIds.has(item.id)
      }
    }
  }
}

async function loadCoverage() {
  const { data } = await api.get('/translations/coverage/stats')
  coverage.value = data
  showCoverage.value = !showCoverage.value
}

async function openEditor(item) {
  editModal.value = {
    show: true,
    item,
    activeLang: languages.value[0]?.code || null,
    fields: {}
  }
  if (editModal.value.activeLang) await loadLangFields(editModal.value.activeLang)
}

async function switchLang(code) {
  editModal.value.activeLang = code
  await loadLangFields(code)
}

async function loadLangFields(langCode) {
  if (!editModal.value.item) return
  try {
    const { data } = await api.get(`/translations/${entityType.value}/${editModal.value.item.id}/${langCode}`)
    editModal.value.fields = {
      title: data.title || '',
      excerpt: data.excerpt || '',
      meta_title: data.meta_title || '',
      meta_description: data.meta_description || '',
      content: data.content || ''
    }
    // Update translationMap
    if (!translationMap.value[editModal.value.item.id]) translationMap.value[editModal.value.item.id] = {}
    translationMap.value[editModal.value.item.id][langCode] = !!(data.title || data.content)
  } catch {
    editModal.value.fields = { title: '', excerpt: '', meta_title: '', meta_description: '', content: '' }
  }
}

async function saveTranslation() {
  if (!editModal.value.item || !editModal.value.activeLang) return
  saving.value = true
  try {
    await api.put(`/translations/${entityType.value}/${editModal.value.item.id}/${editModal.value.activeLang}`, editModal.value.fields)
    // Update map
    if (!translationMap.value[editModal.value.item.id]) translationMap.value[editModal.value.item.id] = {}
    translationMap.value[editModal.value.item.id][editModal.value.activeLang] = true
  } finally {
    saving.value = false
  }
}

async function deleteTranslation() {
  if (!confirm('Remove this language translation?')) return
  await api.delete(`/translations/${entityType.value}/${editModal.value.item.id}/${editModal.value.activeLang}`)
  if (translationMap.value[editModal.value.item.id]) {
    delete translationMap.value[editModal.value.item.id][editModal.value.activeLang]
  }
  editModal.value.fields = { title: '', excerpt: '', meta_title: '', meta_description: '', content: '' }
}

onMounted(async () => {
  await loadLanguages()
  await loadItems()
})
</script>

<style scoped>
.translations-view { padding: 2rem; max-width: 1400px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; }
.subtitle { color: var(--text-muted, #aaa); font-size: 0.875rem; margin-top: .2rem; }
.header-actions { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }

.coverage-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.coverage-card { padding: 1.25rem; border-radius: 1rem; }
.cov-lang { font-weight: 700; margin-bottom: .75rem; font-size: 1rem; }
.cov-stat { display: flex; align-items: center; gap: .5rem; margin-bottom: .5rem; }
.cov-type { width: 60px; font-size: 0.75rem; color: var(--text-muted, #aaa); }
.cov-bar-wrap { flex: 1; height: 6px; background: rgba(255,255,255,.1); border-radius: 3px; overflow: hidden; }
.cov-bar { height: 100%; background: var(--accent, #e05469); border-radius: 3px; transition: width .3s; }
.cov-pct { font-size: 0.75rem; width: 40px; text-align: right; color: var(--text-muted, #aaa); }

.glass { background: rgba(255,255,255,.04); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); }
.table-card { border-radius: 1rem; overflow: hidden; }
.table-toolbar { display: flex; align-items: center; gap: .75rem; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); flex-wrap: wrap; }
.item-count { font-size: .8rem; color: var(--text-muted, #aaa); margin-left: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { padding: .75rem 1rem; text-align: left; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #aaa); border-bottom: 1px solid rgba(255,255,255,.08); }
.data-table td { padding: .75rem 1rem; border-bottom: 1px solid rgba(255,255,255,.05); font-size: .875rem; vertical-align: middle; }
.data-table tbody tr:hover { background: rgba(255,255,255,.03); }
.slug-badge { background: rgba(255,255,255,.06); padding: 2px 6px; border-radius: 4px; font-size: .75rem; }
.lang-col { text-align: center; white-space: nowrap; }
.lang-cell { text-align: center; }
.badge { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: .75rem; font-weight: 700; }
.badge-green { background: rgba(46, 204, 113, .15); color: #2ecc71; }
.badge-muted { background: rgba(255,255,255,.06); color: rgba(255,255,255,.3); }
.row-actions { display: flex; gap: .5rem; }
.empty-cell { text-align: center; padding: 3rem; color: var(--text-muted, #aaa); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-panel { background: hsl(228,4%,15%); border: 1px solid rgba(255,255,255,.1); border-radius: 1.25rem; display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }
.modal-panel.lg { min-width: 600px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.modal-header h2 { font-size: 1.1rem; font-weight: 700; }
.btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted, #aaa); padding: .25rem .5rem; }
.btn-close:hover { color: white; }
.modal-footer { display: flex; align-items: center; gap: .75rem; padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.08); }

.lang-tabs { display: flex; gap: .5rem; padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.08); flex-wrap: wrap; }
.lang-tab { position: relative; padding: .4rem .8rem; border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; background: none; color: rgba(255,255,255,.7); cursor: pointer; font-size: .85rem; transition: all .2s; }
.lang-tab.active { background: var(--accent, #e05469); border-color: var(--accent, #e05469); color: white; }
.lang-tab:hover:not(.active) { border-color: rgba(255,255,255,.3); color: white; }
.translated-dot { position: absolute; top: -3px; right: -3px; width: 8px; height: 8px; border-radius: 50%; background: #2ecc71; border: 2px solid hsl(228,4%,15%); }

.translation-fields { padding: 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem; }
.field-group { display: flex; flex-direction: column; gap: .4rem; }
.field-label { font-size: .8rem; font-weight: 600; color: var(--text-muted, #aaa); text-transform: uppercase; letter-spacing: .04em; }
.field-hint { font-size: .75rem; color: var(--text-muted, #aaa); margin-top: .2rem; }
.form-input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; color: white; padding: .6rem .75rem; font-size: .9rem; width: 100%; resize: vertical; font-family: inherit; }
.form-input:focus { outline: none; border-color: var(--accent, #e05469); }
.btn { padding: .5rem 1rem; border-radius: .5rem; cursor: pointer; font-size: .875rem; border: none; transition: all .2s; font-family: inherit; }
.btn-accent { background: var(--accent, #e05469); color: white; }
.btn-ghost { background: rgba(255,255,255,.06); color: white; border: 1px solid rgba(255,255,255,.12); }
.btn-ghost:hover { background: rgba(255,255,255,.1); }
.btn-xs { padding: .3rem .6rem; font-size: .75rem; }
.btn-sm { padding: .4rem .75rem; font-size: .8rem; }
</style>
