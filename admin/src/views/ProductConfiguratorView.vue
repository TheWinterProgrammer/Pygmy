<template>
  <div class="configurator-view">
    <div class="page-header">
      <div>
        <h1>🔧 Product Configurator</h1>
        <p class="subtitle">Build multi-step product configuration flows with price adjustments</p>
      </div>
      <button class="btn-primary" @click="openCreate">+ New Configurator</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-value">{{ stats.products_covered }}</div>
        <div class="stat-label">Products Covered</div>
      </div>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Configurator List -->
    <div class="glass table-wrap" v-if="configs.length">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Configurator Name</th>
            <th>Steps</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in configs" :key="c.id">
            <td>
              <div class="product-name">{{ c.product_name || '—' }}</div>
              <div class="product-slug" v-if="c.product_slug">
                <a :href="`/shop/${c.product_slug}`" target="_blank" class="slug-link">/shop/{{ c.product_slug }}</a>
              </div>
            </td>
            <td>{{ c.name }}</td>
            <td>
              <span class="badge badge-blue">{{ c.steps?.length || 0 }} steps</span>
            </td>
            <td>
              <span class="pill" :class="c.active ? 'pill-green' : 'pill-gray'">
                {{ c.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>{{ fmtDate(c.created_at) }}</td>
            <td class="actions">
              <button class="btn-ghost" @click="editConfig(c)">✏️ Edit</button>
              <button class="btn-ghost" @click="editSteps(c)">📋 Steps</button>
              <button class="btn-ghost btn-danger" @click="confirmDelete(c)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="empty-state glass">
      <div class="empty-icon">🔧</div>
      <p>No product configurators yet. Create one to offer guided product customization.</p>
      <button class="btn-primary" @click="openCreate">+ Create Configurator</button>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ editingId ? 'Edit' : 'New' }} Configurator</h2>
          <button class="btn-close" @click="showModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Product</label>
            <select v-model="form.product_id" class="form-input">
              <option value="">— Select a product —</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Configurator Name</label>
            <input v-model="form.name" class="form-input" placeholder="e.g. Custom PC Builder" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="form.description" class="form-input" rows="2"
              placeholder="Brief description shown to customers"></textarea>
          </div>
          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="form.active" />
              Active (visible on product page)
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showModal = false">Cancel</button>
          <button class="btn-primary" @click="saveConfig" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Steps Editor Modal -->
    <div class="modal-overlay wide" v-if="showStepsModal" @click.self="showStepsModal = false">
      <div class="modal glass wide">
        <div class="modal-header">
          <h2>📋 Configure Steps — {{ currentConfig?.name }}</h2>
          <button class="btn-close" @click="showStepsModal = false">✕</button>
        </div>
        <div class="modal-body">
          <p class="hint">Steps are presented sequentially. Each step can have multiple choices, each with an optional price adjustment.</p>

          <div v-for="(step, si) in steps" :key="si" class="step-card glass-inner">
            <div class="step-header">
              <span class="step-num">Step {{ si + 1 }}</span>
              <div class="step-controls">
                <button class="btn-xs" @click="moveStep(si, -1)" :disabled="si === 0">↑</button>
                <button class="btn-xs" @click="moveStep(si, 1)" :disabled="si === steps.length - 1">↓</button>
                <button class="btn-xs btn-danger" @click="removeStep(si)">✕</button>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Step Label</label>
                <input v-model="step.label" class="form-input" placeholder="e.g. Choose Color" />
              </div>
              <div class="form-group" style="width:140px">
                <label>Type</label>
                <select v-model="step.type" class="form-input">
                  <option value="select">Dropdown</option>
                  <option value="radio">Radio Pills</option>
                  <option value="checkbox">Checkboxes</option>
                  <option value="text">Text Input</option>
                  <option value="color">Color Picker</option>
                </select>
              </div>
              <div class="form-group" style="width:120px">
                <label>Required</label>
                <select v-model="step.required" class="form-input">
                  <option :value="true">Yes</option>
                  <option :value="false">No</option>
                </select>
              </div>
            </div>

            <!-- Choices (for select/radio/checkbox) -->
            <div v-if="['select','radio','checkbox'].includes(step.type)">
              <label style="font-size:0.82rem;opacity:0.7;margin-bottom:6px;display:block">Choices</label>
              <div v-for="(choice, ci) in step.choices" :key="ci" class="choice-row">
                <input v-model="choice.label" class="form-input" placeholder="Choice label" style="flex:2" />
                <input v-model.number="choice.price_adj" class="form-input" type="number" step="0.01"
                  placeholder="+/- price" style="width:110px" />
                <input v-model="choice.sku_suffix" class="form-input" placeholder="SKU suffix" style="width:110px" />
                <button class="btn-xs btn-danger" @click="removeChoice(si, ci)">✕</button>
              </div>
              <button class="btn-ghost btn-sm" @click="addChoice(si)">+ Add Choice</button>
            </div>

            <!-- Hint text for text/color -->
            <div v-else class="form-group">
              <label>Placeholder / Hint</label>
              <input v-model="step.placeholder" class="form-input" placeholder="e.g. Enter your name" />
            </div>
          </div>

          <button class="btn-ghost" @click="addStep" style="margin-top:12px">+ Add Step</button>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showStepsModal = false">Cancel</button>
          <button class="btn-primary" @click="saveSteps" :disabled="savingSteps">
            {{ savingSteps ? 'Saving…' : '💾 Save Steps' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div class="modal-overlay" v-if="showDeleteModal" @click.self="showDeleteModal = false">
      <div class="modal glass" style="max-width:400px">
        <div class="modal-header">
          <h2>Delete Configurator?</h2>
        </div>
        <div class="modal-body">
          <p>This will permanently delete <strong>{{ deleteTarget?.name }}</strong> and all its steps.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../api.js'

const configs   = ref([])
const products  = ref([])
const stats     = ref(null)
const loading   = ref(false)
const saving    = ref(false)
const savingSteps = ref(false)

const showModal       = ref(false)
const showStepsModal  = ref(false)
const showDeleteModal = ref(false)
const editingId       = ref(null)
const currentConfig   = ref(null)
const deleteTarget    = ref(null)

const steps = ref([])

const form = reactive({
  product_id: '',
  name: '',
  description: '',
  active: true,
})

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

async function load() {
  loading.value = true
  try {
    const [confRes, prodRes] = await Promise.all([
      api.get('/product-configurator'),
      api.get('/products?all=1&limit=500'),
    ])
    configs.value = confRes.data
    products.value = prodRes.data.products || prodRes.data || []

    // Compute stats locally
    const total = configs.value.length
    const active = configs.value.filter(c => c.active).length
    const products_covered = new Set(configs.value.map(c => c.product_id)).size
    stats.value = { total, active, products_covered }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.product_id = ''
  form.name = ''
  form.description = ''
  form.active = true
  showModal.value = true
}

function editConfig(c) {
  editingId.value = c.id
  form.product_id = c.product_id
  form.name = c.name
  form.description = c.description || ''
  form.active = !!c.active
  showModal.value = true
}

async function saveConfig() {
  if (!form.product_id || !form.name) return
  saving.value = true
  try {
    if (editingId.value) {
      await api.put(`/product-configurator/${editingId.value}`, form)
    } else {
      await api.post('/product-configurator', form)
    }
    showModal.value = false
    await load()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

function editSteps(c) {
  currentConfig.value = c
  // Deep clone steps
  steps.value = (c.steps || []).map(s => ({
    ...s,
    choices: (s.choices || []).map(ch => ({ ...ch })),
  }))
  showStepsModal.value = true
}

function addStep() {
  steps.value.push({
    label: '',
    type: 'radio',
    required: true,
    placeholder: '',
    choices: [],
  })
}

function removeStep(i) {
  steps.value.splice(i, 1)
}

function moveStep(i, dir) {
  const arr = steps.value
  const ni = i + dir
  if (ni < 0 || ni >= arr.length) return
  ;[arr[i], arr[ni]] = [arr[ni], arr[i]]
}

function addChoice(si) {
  if (!steps.value[si].choices) steps.value[si].choices = []
  steps.value[si].choices.push({ label: '', price_adj: 0, sku_suffix: '' })
}

function removeChoice(si, ci) {
  steps.value[si].choices.splice(ci, 1)
}

async function saveSteps() {
  if (!currentConfig.value) return
  savingSteps.value = true
  try {
    await api.put(`/product-configurator/${currentConfig.value.id}`, {
      ...currentConfig.value,
      steps: steps.value,
    })
    showStepsModal.value = false
    await load()
  } catch (e) {
    console.error(e)
  } finally {
    savingSteps.value = false
  }
}

function confirmDelete(c) {
  deleteTarget.value = c
  showDeleteModal.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  try {
    await api.delete(`/product-configurator/${deleteTarget.value.id}`)
    showDeleteModal.value = false
    await load()
  } catch (e) {
    console.error(e)
  }
}

onMounted(load)
</script>

<style scoped>
.configurator-view { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-header h1 { margin: 0; font-size: 1.5rem; }
.subtitle { opacity: 0.6; font-size: 0.85rem; margin-top: 0.25rem; }
.stats-strip { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.stat-card { padding: 1rem 1.5rem; border-radius: 1rem; }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.78rem; opacity: 0.6; margin-top: 0.25rem; }
.table-wrap { border-radius: 1rem; overflow: hidden; margin-bottom: 1.5rem; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
.data-table th { font-size: 0.78rem; text-transform: uppercase; opacity: 0.5; }
.actions { display: flex; gap: 0.5rem; }
.product-name { font-weight: 500; }
.product-slug { font-size: 0.78rem; opacity: 0.5; }
.slug-link { color: var(--accent); }
.badge-blue { background: rgba(99,179,237,0.2); color: #63b3ed; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; }
.pill { padding: 2px 10px; border-radius: 99px; font-size: 0.75rem; }
.pill-green { background: rgba(72,187,120,0.2); color: #68d391; }
.pill-gray  { background: rgba(160,160,160,0.1); color: #aaa; }
.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-overlay.wide { align-items: flex-start; padding-top: 5vh; overflow-y: auto; }
.modal { border-radius: 1.5rem; width: 90%; max-width: 560px; overflow: hidden; }
.modal.wide { max-width: 800px; max-height: 80vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-body { padding: 1.5rem; }
.modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.82rem; opacity: 0.7; margin-bottom: 0.35rem; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; }
.form-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 0.75rem; color: inherit; font-family: inherit; font-size: 0.9rem; }
.form-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.flex-1 { flex: 1; }

/* Steps */
.step-card { padding: 1rem; border-radius: 0.75rem; margin-bottom: 0.75rem; }
.step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.step-num { font-weight: 600; font-size: 0.85rem; opacity: 0.7; }
.step-controls { display: flex; gap: 0.4rem; }
.btn-xs { padding: 2px 8px; font-size: 0.75rem; background: rgba(255,255,255,0.08); border: none; border-radius: 4px; cursor: pointer; color: inherit; }
.btn-xs:hover { background: rgba(255,255,255,0.15); }
.btn-sm { padding: 0.3rem 0.75rem; font-size: 0.82rem; }
.choice-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; }
.hint { font-size: 0.82rem; opacity: 0.6; margin-bottom: 1rem; }

/* Buttons */
.btn-primary { background: var(--accent); color: #fff; border: none; border-radius: 0.5rem; padding: 0.5rem 1.2rem; cursor: pointer; font-weight: 500; }
.btn-ghost { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.4rem 0.9rem; cursor: pointer; color: inherit; font-size: 0.85rem; }
.btn-ghost:hover { background: rgba(255,255,255,0.12); }
.btn-danger { background: rgba(220,53,69,0.2); color: #ff6b7a; border: 1px solid rgba(220,53,69,0.3); border-radius: 0.5rem; padding: 0.4rem 0.9rem; cursor: pointer; font-size: 0.85rem; }
.btn-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.6; color: inherit; }
.glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(16px); }
.glass-inner { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
.loading-bar { height: 3px; background: var(--accent); border-radius: 2px; margin-bottom: 1rem; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
</style>
