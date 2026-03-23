<template>
  <div class="translation-editor">
    <div class="te-header">
      <h3>🌐 Translations</h3>
      <div class="lang-tabs">
        <button
          v-for="lang in languages"
          :key="lang.code"
          class="lang-tab"
          :class="{ active: activeLang === lang.code }"
          @click="selectLang(lang.code)"
        >
          {{ lang.flag || '🌐' }} {{ lang.code.toUpperCase() }}
          <span v-if="hasTranslation(lang.code)" class="translated-dot" title="Has translation">✓</span>
        </button>
      </div>
    </div>

    <div v-if="!languages.length" class="no-langs">
      No additional languages configured.
      <router-link to="/languages">Set up languages →</router-link>
    </div>

    <div v-else-if="activeLang" class="te-body">
      <div class="te-info">
        <span class="lang-badge">
          {{ currentLang?.flag }} {{ currentLang?.name }} ({{ currentLang?.native_name }})
        </span>
        <div class="te-actions">
          <button class="btn btn-ghost btn-sm" @click="copyFromDefault" title="Copy values from the default language to start translating">
            📋 Copy from default
          </button>
          <button class="btn btn-ghost btn-sm btn-danger" @click="clearTranslation"
            v-if="hasTranslation(activeLang)">
            🗑️ Clear
          </button>
        </div>
      </div>

      <div class="te-fields">
        <div class="form-group" v-for="field in translatableFields" :key="field.key">
          <label>{{ field.label }}</label>
          <component
            :is="field.type === 'textarea' ? 'textarea' : 'input'"
            v-model="translations[activeLang][field.key]"
            :placeholder="defaultValues[field.key] || field.placeholder"
            :rows="field.rows || undefined"
            class="input"
            @blur="saveTranslation"
          />
        </div>
      </div>

      <div class="te-save-row">
        <button class="btn btn-primary btn-sm" @click="saveTranslation" :disabled="saving">
          {{ saving ? 'Saving…' : '💾 Save Translation' }}
        </button>
        <span v-if="savedAt" class="save-ok">✓ Saved {{ savedAt }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'

const props = defineProps({
  entityType: { type: String, required: true }, // 'post' | 'page' | 'product'
  entityId: { type: Number, required: true },
  defaultValues: { type: Object, default: () => ({}) }, // { title, excerpt, content, meta_title, meta_description }
})

const translatableFields = computed(() => {
  const base = [
    { key: 'title', label: 'Title', type: 'input', placeholder: 'Translated title…' },
    { key: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 2, placeholder: 'Translated excerpt…' },
    { key: 'meta_title', label: 'SEO Title', type: 'input', placeholder: 'Translated SEO title…' },
    { key: 'meta_description', label: 'SEO Description', type: 'textarea', rows: 2, placeholder: 'Translated meta description…' },
  ]
  if (props.entityType !== 'navigation') {
    base.splice(1, 0, { key: 'content', label: 'Content (HTML)', type: 'textarea', rows: 6, placeholder: 'Translated content (HTML)…' })
  }
  return base
})

const languages = ref([]) // Non-default active languages
const activeLang = ref(null)
const translations = ref({}) // { code: { title, content, ... } }
const saving = ref(false)
const savedAt = ref(null)

const currentLang = computed(() => languages.value.find(l => l.code === activeLang.value))

function hasTranslation(code) {
  const t = translations.value[code]
  return t && Object.values(t).some(v => v && v.trim())
}

async function loadLanguages() {
  const { data } = await api.get('/languages/active')
  // Exclude default language (user edits that in the main form)
  languages.value = data.filter(l => !l.is_default)
  if (languages.value.length && !activeLang.value) {
    activeLang.value = languages.value[0].code
  }
}

async function loadTranslations() {
  if (!props.entityId) return
  const { data } = await api.get(`/languages/translations?entity_type=${props.entityType}&entity_id=${props.entityId}`)
  translations.value = data
  // Ensure each language has an object
  for (const lang of languages.value) {
    if (!translations.value[lang.code]) {
      translations.value[lang.code] = {}
    }
  }
}

function selectLang(code) {
  activeLang.value = code
  if (!translations.value[code]) translations.value[code] = {}
}

function copyFromDefault() {
  if (!activeLang.value) return
  const copy = {}
  for (const field of translatableFields.value) {
    copy[field.key] = props.defaultValues[field.key] || ''
  }
  translations.value[activeLang.value] = copy
}

async function clearTranslation() {
  if (!activeLang.value || !confirm('Remove all translations for this language?')) return
  await api.delete('/languages/translations', {
    data: { entity_type: props.entityType, entity_id: props.entityId, language_code: activeLang.value }
  })
  translations.value[activeLang.value] = {}
  savedAt.value = null
}

async function saveTranslation() {
  if (!activeLang.value || !props.entityId) return
  const fields = translations.value[activeLang.value] || {}
  if (!Object.values(fields).some(v => v && v.trim())) return // nothing to save

  saving.value = true
  try {
    await api.put('/languages/translations', {
      entity_type: props.entityType,
      entity_id: props.entityId,
      language_code: activeLang.value,
      fields,
    })
    savedAt.value = new Date().toLocaleTimeString()
    setTimeout(() => (savedAt.value = null), 3000)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadLanguages()
  if (props.entityId) await loadTranslations()
})

watch(() => props.entityId, async (id) => {
  if (id) await loadTranslations()
})
</script>

<style scoped>
.translation-editor {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.te-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(0,0,0,0.15);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.te-header h3 { margin: 0; font-size: 0.95rem; flex-shrink: 0; }

.lang-tabs { display: flex; gap: 6px; flex-wrap: wrap; }

.lang-tab {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}
.lang-tab:hover { border-color: var(--accent); color: var(--text); }
.lang-tab.active { background: hsl(355,70%,18%); border-color: var(--accent); color: var(--accent); }
.translated-dot { color: #4ade80; font-size: 0.65rem; }

.no-langs { padding: 16px; color: var(--text-muted); font-size: 0.9rem; }
.no-langs a { color: var(--accent); }

.te-body { padding: 16px; }

.te-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}

.lang-badge { font-size: 0.85rem; color: var(--text-muted); }

.te-actions { display: flex; gap: 6px; }

.te-fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px; }

.te-save-row { display: flex; align-items: center; gap: 12px; }
.save-ok { font-size: 0.82rem; color: #4ade80; }
</style>
