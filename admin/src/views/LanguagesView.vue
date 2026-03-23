<template>
  <div>
    <div class="page-header">
      <h1>🌐 Languages</h1>
      <button class="btn btn-primary" @click="openCreate">+ Add Language</button>
    </div>

    <!-- Stats strip -->
    <div class="lang-stats" v-if="languages.length">
      <div class="lstat glass">
        <div class="lstat-num">{{ languages.length }}</div>
        <div class="lstat-label">Languages</div>
      </div>
      <div class="lstat glass">
        <div class="lstat-num">{{ languages.filter(l => l.active).length }}</div>
        <div class="lstat-label">Active</div>
      </div>
      <div class="lstat glass">
        <div class="lstat-num">{{ languages.find(l => l.is_default)?.name || '—' }}</div>
        <div class="lstat-label">Default</div>
      </div>
    </div>

    <!-- Languages Table -->
    <div class="glass table-wrap">
      <div class="loading-bar" v-if="loading"></div>
      <table class="data-table" v-if="languages.length">
        <thead>
          <tr>
            <th style="width:50px">Flag</th>
            <th>Language</th>
            <th>Code</th>
            <th>Native Name</th>
            <th>Status</th>
            <th>Default</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lang in languages" :key="lang.id">
            <td style="font-size:1.5rem;text-align:center">{{ lang.flag || '🌐' }}</td>
            <td><strong>{{ lang.name }}</strong></td>
            <td><code class="code-badge">{{ lang.code }}</code></td>
            <td class="text-muted">{{ lang.native_name || '—' }}</td>
            <td>
              <span class="badge" :class="lang.active ? 'badge-green' : 'badge-gray'">
                {{ lang.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <span v-if="lang.is_default" class="badge badge-accent">⭐ Default</span>
              <button v-else class="btn btn-ghost btn-sm" @click="setDefault(lang)" :disabled="!lang.active">
                Set Default
              </button>
            </td>
            <td>
              <button class="btn btn-ghost btn-sm" @click="openEdit(lang)">✏️ Edit</button>
              <button class="btn btn-ghost btn-sm" @click="toggleActive(lang)">
                {{ lang.active ? '⏸ Disable' : '▶ Enable' }}
              </button>
              <button class="btn btn-ghost btn-sm btn-danger"
                v-if="!lang.is_default" @click="confirmDelete(lang)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="!loading" class="empty-state">
        <div class="empty-icon">🌐</div>
        <h3>No languages yet</h3>
        <p>Add languages to enable multilingual content on your site.</p>
        <button class="btn btn-primary" @click="openCreate">+ Add Language</button>
      </div>
    </div>

    <!-- Translation Progress -->
    <div class="glass" style="padding:20px;margin-top:20px" v-if="languages.length > 0">
      <h3 style="margin:0 0 16px">Translation Progress</h3>
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <label>Entity type:</label>
        <select v-model="progressType" @change="loadProgress" class="select-sm">
          <option value="post">Posts</option>
          <option value="page">Pages</option>
          <option value="product">Products</option>
        </select>
      </div>
      <div v-if="progress.length" class="progress-grid">
        <div v-for="p in progress" :key="p.code" class="progress-card glass">
          <div class="prog-header">
            <span class="prog-flag">{{ p.flag || '🌐' }}</span>
            <span class="prog-name">{{ p.name }}</span>
            <span class="prog-code text-muted">{{ p.code }}</span>
          </div>
          <div class="prog-bar-wrap">
            <div class="prog-bar" :style="{ width: p.percent + '%' }"></div>
          </div>
          <div class="prog-stats">
            <span>{{ p.translated }} / {{ p.total }} {{ progressType }}s translated</span>
            <span class="prog-pct">{{ p.percent }}%</span>
          </div>
        </div>
      </div>
      <div v-else class="text-muted">No progress data yet.</div>
    </div>

    <!-- Quick Start Presets -->
    <div class="glass" style="padding:20px;margin-top:20px">
      <h3 style="margin:0 0 12px">Quick Add Popular Languages</h3>
      <div class="preset-grid">
        <button v-for="preset in presets.filter(p => !languages.find(l => l.code === p.code))"
          :key="preset.code" class="preset-btn glass" @click="addPreset(preset)">
          <span class="preset-flag">{{ preset.flag }}</span>
          <span class="preset-name">{{ preset.name }}</span>
          <span class="preset-code text-muted">{{ preset.code }}</span>
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal glass">
        <h2>{{ editingLang ? 'Edit Language' : 'Add Language' }}</h2>
        <form @submit.prevent="saveLang">
          <div class="form-grid">
            <div class="form-group">
              <label>Language Code *</label>
              <input v-model="form.code" placeholder="e.g. de, fr, es" :disabled="!!editingLang"
                class="input" required pattern="[a-z]{2,5}" />
              <div class="form-hint">2-5 lowercase letters (ISO 639-1)</div>
            </div>
            <div class="form-group">
              <label>English Name *</label>
              <input v-model="form.name" placeholder="e.g. German" class="input" required />
            </div>
            <div class="form-group">
              <label>Native Name</label>
              <input v-model="form.native_name" placeholder="e.g. Deutsch" class="input" />
            </div>
            <div class="form-group">
              <label>Flag Emoji</label>
              <input v-model="form.flag" placeholder="e.g. 🇩🇪" class="input" />
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input type="number" v-model.number="form.sort_order" class="input" min="0" />
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" v-model="form.active" />
                Active
              </label>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="showModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : (editingLang ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass" style="max-width:420px">
        <h2>Delete Language</h2>
        <p>Are you sure you want to delete <strong>{{ deleteTarget.name }}</strong>?
          All translations in this language will be permanently removed.</p>
        <div class="modal-actions">
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

const languages = ref([])
const progress = ref([])
const progressType = ref('post')
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editingLang = ref(null)
const deleteTarget = ref(null)

const form = ref({
  code: '', name: '', native_name: '', flag: '', sort_order: 0, active: true
})

const presets = [
  { code: 'de', name: 'German', native_name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', native_name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', native_name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italian', native_name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Dutch', native_name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', native_name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Russian', native_name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', native_name: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', flag: '🇸🇦' },
  { code: 'ko', name: 'Korean', native_name: '한국어', flag: '🇰🇷' },
  { code: 'tr', name: 'Turkish', native_name: 'Türkçe', flag: '🇹🇷' },
  { code: 'sv', name: 'Swedish', native_name: 'Svenska', flag: '🇸🇪' },
  { code: 'da', name: 'Danish', native_name: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', native_name: 'Suomi', flag: '🇫🇮' },
]

async function loadLanguages() {
  loading.value = true
  try {
    const { data } = await api.get('/languages')
    languages.value = data
  } finally {
    loading.value = false
  }
}

async function loadProgress() {
  const { data } = await api.get(`/languages/progress?entity_type=${progressType.value}`)
  progress.value = data
}

onMounted(() => { loadLanguages(); loadProgress() })

function openCreate() {
  editingLang.value = null
  form.value = { code: '', name: '', native_name: '', flag: '', sort_order: 0, active: true }
  showModal.value = true
}

function openEdit(lang) {
  editingLang.value = lang
  form.value = { ...lang }
  showModal.value = true
}

async function saveLang() {
  saving.value = true
  try {
    if (editingLang.value) {
      await api.put(`/languages/${editingLang.value.id}`, form.value)
    } else {
      await api.post('/languages', form.value)
    }
    showModal.value = false
    await loadLanguages()
    await loadProgress()
  } catch (err) {
    alert(err.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

async function addPreset(preset) {
  try {
    await api.post('/languages', { ...preset, active: 1, sort_order: 0 })
    await loadLanguages()
    await loadProgress()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to add preset')
  }
}

async function toggleActive(lang) {
  await api.put(`/languages/${lang.id}`, { active: lang.active ? 0 : 1 })
  await loadLanguages()
}

async function setDefault(lang) {
  await api.put(`/languages/${lang.id}`, { is_default: 1 })
  await loadLanguages()
}

function confirmDelete(lang) {
  deleteTarget.value = lang
}

async function doDelete() {
  await api.delete(`/languages/${deleteTarget.value.id}`)
  deleteTarget.value = null
  await loadLanguages()
  await loadProgress()
}
</script>

<style scoped>
.lang-stats { display: flex; gap: 12px; margin-bottom: 20px; }
.lstat { padding: 16px 24px; text-align: center; }
.lstat-num { font-size: 1.8rem; font-weight: 700; color: var(--accent); }
.lstat-label { font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; }

.code-badge { background: rgba(255,255,255,0.07); padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 0.85rem; }

.progress-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.progress-card { padding: 14px; }
.prog-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.prog-flag { font-size: 1.3rem; }
.prog-name { font-weight: 600; font-size: 0.9rem; }
.prog-code { font-size: 0.78rem; }
.prog-bar-wrap { background: rgba(255,255,255,0.07); border-radius: 99px; height: 6px; overflow: hidden; margin-bottom: 6px; }
.prog-bar { height: 100%; background: var(--accent); border-radius: 99px; transition: width 0.4s; }
.prog-stats { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); }
.prog-pct { font-weight: 700; color: var(--text); }

.preset-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.preset-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: none; cursor: pointer; font-family: inherit; font-size: 0.85rem; transition: all 0.2s; color: var(--text); }
.preset-btn:hover { border-color: var(--accent); }
.preset-flag { font-size: 1.1rem; }
.preset-name { font-weight: 500; }
.preset-code { font-size: 0.75rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.checkbox-group { display: flex; align-items: center; }
.checkbox-group label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.select-sm { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; font-size: 0.85rem; }
.form-hint { font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; }
.badge-accent { background: rgba(224,82,82,0.15); color: var(--accent); border: 1px solid rgba(224,82,82,0.3); }
</style>
