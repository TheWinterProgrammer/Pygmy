<template>
  <div class="si-view">
    <div class="page-header">
      <div class="header-left">
        <h1>📥 Stock CSV Import</h1>
        <p class="subtitle">Bulk-update product stock quantities via CSV upload</p>
      </div>
      <a :href="templateUrl" class="btn-ghost" download>⬇️ Download Template</a>
    </div>

    <!-- Upload Card -->
    <div class="upload-card glass">
      <div class="upload-header">
        <h2>Upload Stock CSV</h2>
        <p class="upload-hint">CSV must have columns: <code>sku</code>, <code>stock_quantity</code>. Optional: <code>low_stock_threshold</code></p>
      </div>

      <div
        class="drop-zone"
        :class="{ dragging, 'has-file': selectedFile }"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <input ref="fileInput" type="file" accept=".csv,text/csv" style="display:none" @change="onFileChange" />
        <template v-if="selectedFile">
          <div class="file-icon">📄</div>
          <div class="file-name">{{ selectedFile.name }}</div>
          <div class="file-size">{{ formatSize(selectedFile.size) }}</div>
          <button class="btn-sm btn-ghost mt" @click.stop="clearFile">✕ Clear</button>
        </template>
        <template v-else>
          <div class="drop-icon">📥</div>
          <div class="drop-label">Drop CSV file here or <span class="link">browse</span></div>
          <div class="drop-hint">Max 5 MB</div>
        </template>
      </div>

      <div class="upload-actions">
        <button class="btn-primary" :disabled="!selectedFile || importing" @click="doImport">
          <span v-if="importing">⟳ Importing…</span>
          <span v-else>📤 Import Stock</span>
        </button>
      </div>

      <!-- Result Banner -->
      <div v-if="result" class="result-banner" :class="result.errors?.length ? 'warn' : 'success'">
        <div class="result-stats">
          <span class="stat">✅ Updated: <strong>{{ result.updated }}</strong></span>
          <span class="stat">⏭️ Skipped: <strong>{{ result.skipped }}</strong></span>
          <span class="stat">📦 Total rows: <strong>{{ result.total }}</strong></span>
        </div>
        <div v-if="result.errors?.length" class="error-list">
          <div class="error-heading">⚠️ {{ result.errors.length }} row(s) had issues:</div>
          <div v-for="(e, i) in result.errors" :key="i" class="error-row">{{ e }}</div>
        </div>
      </div>
    </div>

    <!-- Format Guide -->
    <div class="format-guide glass">
      <h3>📋 CSV Format</h3>
      <div class="format-columns">
        <div class="format-col">
          <h4>Required Columns</h4>
          <table class="format-table">
            <thead>
              <tr><th>Column</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>sku</code></td><td>text</td><td>Product SKU (must match exactly)</td></tr>
              <tr><td><code>stock_quantity</code></td><td>integer ≥ 0</td><td>New stock level</td></tr>
            </tbody>
          </table>
        </div>
        <div class="format-col">
          <h4>Optional Columns</h4>
          <table class="format-table">
            <thead>
              <tr><th>Column</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>low_stock_threshold</code></td><td>integer</td><td>Alert threshold (if blank, unchanged)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="format-example">
        <h4>Example</h4>
        <pre>sku,stock_quantity,low_stock_threshold
SHIRT-RED-M,24,5
SHIRT-BLUE-L,0,5
MUG-CERAMIC-01,150,10</pre>
      </div>
    </div>

    <!-- Import History -->
    <div class="history-section">
      <div class="section-header">
        <h2>Import History</h2>
        <button class="btn-ghost btn-sm" @click="loadHistory">🔄 Refresh</button>
      </div>
      <div v-if="loadingHistory" class="loading">Loading…</div>
      <div v-else-if="history.length === 0" class="empty-state glass">
        <div class="empty-icon">📋</div>
        <p>No imports yet. Upload your first CSV to get started.</p>
      </div>
      <div v-else class="history-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Total Rows</th>
              <th>Updated</th>
              <th>Skipped</th>
              <th>Errors</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in history" :key="h.id" @click="selectedHistory = h" :class="{ active: selectedHistory?.id === h.id }">
              <td class="filename-cell">{{ h.filename }}</td>
              <td class="num-cell">{{ h.total }}</td>
              <td class="num-cell success-cell">{{ h.updated }}</td>
              <td class="num-cell">{{ h.skipped }}</td>
              <td class="num-cell" :class="h.errors?.length ? 'error-cell' : ''">{{ h.errors?.length || 0 }}</td>
              <td class="date-cell">{{ timeAgo(h.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- History Detail -->
      <div v-if="selectedHistory?.errors?.length" class="history-detail glass">
        <h4>⚠️ Errors from "{{ selectedHistory.filename }}"</h4>
        <div v-for="(e, i) in selectedHistory.errors" :key="i" class="error-row">{{ e }}</div>
        <button class="btn-ghost btn-sm mt" @click="selectedHistory = null">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const fileInput = ref(null)
const selectedFile = ref(null)
const dragging = ref(false)
const importing = ref(false)
const result = ref(null)
const history = ref([])
const loadingHistory = ref(false)
const selectedHistory = ref(null)

const templateUrl = '/api/stock-import/template'

function onDrop(e) {
  dragging.value = false
  const f = e.dataTransfer.files[0]
  if (f) { selectedFile.value = f; result.value = null }
}

function onFileChange(e) {
  const f = e.target.files[0]
  if (f) { selectedFile.value = f; result.value = null }
}

function clearFile() {
  selectedFile.value = null
  result.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1024/1024).toFixed(1)} MB`
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return d.toLocaleDateString()
}

async function doImport() {
  if (!selectedFile.value || importing.value) return
  importing.value = true
  result.value = null
  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    const { data } = await api.post('/stock-import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    result.value = data
    clearFile()
    loadHistory()
  } catch (err) {
    result.value = { error: err.response?.data?.error || 'Import failed', updated: 0, skipped: 0, total: 0, errors: [] }
  } finally {
    importing.value = false
  }
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    const { data } = await api.get('/stock-import/history')
    history.value = data
  } catch { history.value = [] }
  finally { loadingHistory.value = false }
}

onMounted(loadHistory)
</script>

<style scoped>
.si-view { padding: 0 0 3rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.header-left h1 { margin: 0 0 .25rem; }
.subtitle { color: var(--text-muted, #aaa); margin: 0; font-size: .9rem; }

/* Upload card */
.upload-card { padding: 2rem; margin-bottom: 2rem; border-radius: 1rem; }
.upload-header { margin-bottom: 1.5rem; }
.upload-header h2 { margin: 0 0 .5rem; }
.upload-hint { color: var(--text-muted, #aaa); font-size: .9rem; margin: 0; }
.upload-hint code { background: rgba(255,255,255,.08); padding: .1rem .3rem; border-radius: .25rem; font-size: .85rem; }

.drop-zone {
  border: 2px dashed rgba(255,255,255,.2);
  border-radius: 1rem;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all .2s;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .5rem;
}
.drop-zone:hover, .drop-zone.dragging { border-color: var(--accent); background: rgba(var(--accent-rgb, 200,60,60), .05); }
.drop-zone.has-file { border-style: solid; border-color: var(--accent); }
.drop-icon, .file-icon { font-size: 3rem; }
.drop-label { font-size: 1rem; color: #ccc; }
.drop-label .link { color: var(--accent); text-decoration: underline; }
.drop-hint { font-size: .8rem; color: var(--text-muted, #aaa); }
.file-name { font-weight: 600; font-size: 1.1rem; }
.file-size { font-size: .85rem; color: var(--text-muted, #aaa); }
.mt { margin-top: .5rem; }

.upload-actions { margin-top: 1.5rem; display: flex; justify-content: flex-end; }

.result-banner { margin-top: 1.5rem; padding: 1.25rem 1.5rem; border-radius: .75rem; }
.result-banner.success { background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.3); }
.result-banner.warn { background: rgba(234,179,8,.12); border: 1px solid rgba(234,179,8,.3); }
.result-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: .5rem; }
.stat { font-size: .9rem; }
.error-heading { font-weight: 600; font-size: .9rem; margin: .5rem 0 .25rem; color: #f59e0b; }
.error-row { font-size: .82rem; color: #f87171; padding: .15rem 0; border-bottom: 1px solid rgba(255,255,255,.05); }

/* Format guide */
.format-guide { padding: 1.75rem; border-radius: 1rem; margin-bottom: 2rem; }
.format-guide h3 { margin: 0 0 1.25rem; }
.format-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1.5rem; }
@media (max-width: 700px) { .format-columns { grid-template-columns: 1fr; } }
.format-col h4 { margin: 0 0 .75rem; font-size: .95rem; color: #ddd; }
.format-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.format-table th { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid rgba(255,255,255,.1); color: var(--text-muted, #aaa); font-weight: 500; }
.format-table td { padding: .4rem .5rem; border-bottom: 1px solid rgba(255,255,255,.05); }
.format-table td:first-child { font-family: monospace; color: #93c5fd; }
.format-example h4 { margin: 0 0 .5rem; font-size: .95rem; color: #ddd; }
.format-example pre { background: rgba(0,0,0,.3); border-radius: .5rem; padding: 1rem; font-size: .82rem; overflow-x: auto; color: #a3e635; }

/* History */
.history-section { }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.section-header h2 { margin: 0; }
.loading { text-align: center; color: var(--text-muted, #aaa); padding: 2rem; }
.empty-state { padding: 2.5rem; text-align: center; border-radius: 1rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }
.empty-state p { color: var(--text-muted, #aaa); margin: 0; }
.history-table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.data-table th { text-align: left; padding: .65rem .75rem; border-bottom: 1px solid rgba(255,255,255,.1); color: var(--text-muted, #aaa); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
.data-table td { padding: .65rem .75rem; border-bottom: 1px solid rgba(255,255,255,.06); }
.data-table tr:hover { background: rgba(255,255,255,.04); cursor: pointer; }
.data-table tr.active { background: rgba(var(--accent-rgb,200,60,60),.08); }
.filename-cell { font-family: monospace; font-size: .85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.num-cell { text-align: center; }
.success-cell { color: #4ade80; font-weight: 600; }
.error-cell { color: #f87171; font-weight: 600; }
.date-cell { white-space: nowrap; color: var(--text-muted, #aaa); }

.history-detail { padding: 1.25rem; border-radius: .75rem; margin-top: 1rem; }
.history-detail h4 { margin: 0 0 .75rem; color: #f59e0b; }
</style>
