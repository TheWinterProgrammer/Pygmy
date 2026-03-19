<template>
  <div class="form-page">
    <!-- Loading -->
    <div v-if="loading" class="page-loading">
      <div class="spinner"></div>
    </div>

    <!-- Not found -->
    <div v-else-if="!form" class="not-found">
      <h1>Form Not Found</h1>
      <p>This form doesn't exist or is no longer active.</p>
      <RouterLink to="/" class="btn-back">← Back to Home</RouterLink>
    </div>

    <!-- Submitted -->
    <div v-else-if="submitted" class="form-container">
      <div class="glass form-card success-card">
        <div class="success-icon">✅</div>
        <h2>Thank you!</h2>
        <p>{{ form.success_message || 'Your response has been recorded.' }}</p>
        <RouterLink to="/" class="btn-back">← Back to Home</RouterLink>
      </div>
    </div>

    <!-- Form -->
    <div v-else class="form-container">
      <div class="glass form-card">
        <h1>{{ form.name }}</h1>
        <p v-if="form.description" class="form-desc">{{ form.description }}</p>

        <form @submit.prevent="submit" novalidate>
          <div
            v-for="field in parsedFields"
            :key="field.name"
            class="field-wrap"
          >
            <label :for="field.name" class="field-label">
              {{ field.label }}
              <span v-if="field.required" class="required">*</span>
            </label>

            <!-- Text / Email / Tel / Number / Date -->
            <input
              v-if="['text','email','tel','number','date'].includes(field.type)"
              :id="field.name"
              :type="field.type"
              :name="field.name"
              :placeholder="field.placeholder"
              :required="field.required"
              v-model="formData[field.name]"
              class="glass-input"
              :class="{ error: fieldErrors[field.name] }"
            />

            <!-- Textarea -->
            <textarea
              v-else-if="field.type === 'textarea'"
              :id="field.name"
              :name="field.name"
              :placeholder="field.placeholder"
              :required="field.required"
              :rows="field.rows || 4"
              v-model="formData[field.name]"
              class="glass-input"
              :class="{ error: fieldErrors[field.name] }"
            />

            <!-- Select / Dropdown -->
            <select
              v-else-if="field.type === 'select'"
              :id="field.name"
              :name="field.name"
              :required="field.required"
              v-model="formData[field.name]"
              class="glass-select"
              :class="{ error: fieldErrors[field.name] }"
            >
              <option value="">— Select —</option>
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>

            <!-- Radio -->
            <div v-else-if="field.type === 'radio'" class="radio-group">
              <label v-for="opt in field.options" :key="opt" class="radio-label">
                <input type="radio" :name="field.name" :value="opt" v-model="formData[field.name]" />
                <span>{{ opt }}</span>
              </label>
            </div>

            <!-- Checkbox -->
            <label v-else-if="field.type === 'checkbox'" class="checkbox-label">
              <input type="checkbox" :name="field.name" v-model="formData[field.name]" />
              <span>{{ field.checkboxLabel || field.label }}</span>
            </label>

            <!-- File (just shows the field, no actual upload processing here) -->
            <input
              v-else-if="field.type === 'file'"
              :id="field.name"
              type="file"
              :name="field.name"
              :required="field.required"
              @change="handleFile(field.name, $event)"
              class="glass-input file-input"
            />

            <p v-if="fieldErrors[field.name]" class="field-error">{{ fieldErrors[field.name] }}</p>
          </div>

          <div v-if="serverErrors.length > 0" class="server-errors">
            <p v-for="e in serverErrors" :key="e">{{ e }}</p>
          </div>

          <button type="submit" class="btn-submit" :disabled="submitting">
            {{ submitting ? 'Sending…' : 'Send' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteStore } from '../stores/site.js'
import axios from 'axios'

const route = useRoute()
const site = useSiteStore()

const form = ref(null)
const loading = ref(true)
const submitted = ref(false)
const submitting = ref(false)
const formData = ref({})
const fieldErrors = ref({})
const serverErrors = ref([])

const parsedFields = computed(() => {
  try { return JSON.parse(form.value?.fields || '[]') } catch { return [] }
})

async function load () {
  try {
    const res = await axios.get(`http://localhost:3200/api/forms/${route.params.slug}`)
    form.value = res.data
    // Init form data
    const data = {}
    for (const f of JSON.parse(res.data.fields || '[]')) {
      data[f.name] = f.type === 'checkbox' ? false : ''
    }
    formData.value = data
  } catch {
    form.value = null
  } finally {
    loading.value = false
  }
}

function validate () {
  const errs = {}
  for (const field of parsedFields.value) {
    if (!field.required) continue
    const val = formData.value[field.name]
    if (val === undefined || val === null || val === '' || val === false) {
      errs[field.name] = `${field.label || field.name} is required`
    }
  }
  fieldErrors.value = errs
  return Object.keys(errs).length === 0
}

async function submit () {
  serverErrors.value = []
  if (!validate()) return
  submitting.value = true
  try {
    await axios.post(`http://localhost:3200/api/forms/${form.value.slug}/submit`, formData.value)
    submitted.value = true
  } catch (e) {
    if (e.response?.data?.errors) {
      serverErrors.value = e.response.data.errors
    } else {
      serverErrors.value = ['Something went wrong. Please try again.']
    }
  } finally {
    submitting.value = false
  }
}

function handleFile (name, event) {
  formData.value[name] = event.target.files[0]?.name || ''
}

onMounted(load)
</script>

<style scoped>
.form-page { min-height:80vh; display:flex; align-items:flex-start; justify-content:center; padding:4rem 1rem; }
.page-loading { display:flex; align-items:center; justify-content:center; min-height:60vh; }
.spinner { width:40px; height:40px; border:3px solid rgba(255,255,255,.1); border-top-color:var(--accent); border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

.not-found { text-align:center; padding:4rem; }
.not-found h1 { margin-bottom:.5rem; }
.not-found p { color:var(--muted); margin-bottom:2rem; }

.form-container { width:100%; max-width:640px; }
.form-card { padding:2.5rem; border-radius:1.5rem; }
.form-card h1 { margin:0 0 .5rem; font-size:1.6rem; }
.form-desc { color:var(--muted); margin:0 0 2rem; }

.success-card { text-align:center; }
.success-icon { font-size:3rem; margin-bottom:1rem; }
.success-card h2 { margin:0 0 .5rem; }
.success-card p { color:var(--muted); margin:0 0 2rem; }

.field-wrap { margin-bottom:1.2rem; }
.field-label { display:block; font-size:.82rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:.5rem; }
.required { color:var(--accent); margin-left:.2rem; }

.glass-input { width:100%; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.65rem .9rem; border-radius:.7rem; font-size:.95rem; font-family:inherit; outline:none; box-sizing:border-box; }
.glass-input:focus { border-color:var(--accent); }
.glass-input.error { border-color:hsl(0,70%,60%); }
.glass-select { width:100%; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.65rem .9rem; border-radius:.7rem; font-size:.95rem; font-family:inherit; outline:none; cursor:pointer; }
.glass-select.error { border-color:hsl(0,70%,60%); }
textarea.glass-input { resize:vertical; min-height:100px; }

.radio-group { display:flex; flex-direction:column; gap:.5rem; }
.radio-label { display:flex; align-items:center; gap:.6rem; cursor:pointer; font-size:.95rem; }
.radio-label input { accent-color:var(--accent); }

.checkbox-label { display:flex; align-items:flex-start; gap:.6rem; cursor:pointer; font-size:.95rem; }
.checkbox-label input { accent-color:var(--accent); margin-top:.15rem; }

.file-input { padding:.5rem; }

.field-error { color:hsl(0,70%,60%); font-size:.8rem; margin:.3rem 0 0; }

.server-errors { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); border-radius:.7rem; padding:.8rem 1rem; margin-bottom:1rem; }
.server-errors p { color:#f87171; font-size:.85rem; margin:.25rem 0; }

.btn-submit { background:var(--accent); color:#fff; border:none; padding:.8rem 2.5rem; border-radius:.8rem; font-size:1rem; font-weight:600; font-family:inherit; cursor:pointer; transition:.15s; margin-top:.5rem; }
.btn-submit:hover { opacity:.9; }
.btn-submit:disabled { opacity:.6; cursor:not-allowed; }

.btn-back { display:inline-block; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); color:var(--text); padding:.6rem 1.2rem; border-radius:.7rem; text-decoration:none; font-size:.9rem; }
</style>
