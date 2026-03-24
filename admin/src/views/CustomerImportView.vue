<template>
  <div class="customer-import-view">
    <div class="page-header">
      <div>
        <h1>👥 Customer Import</h1>
        <p class="subtitle">Import customers from a CSV file. Existing customers (matched by email) are updated or skipped based on mode.</p>
      </div>
    </div>

    <!-- Upload card -->
    <div class="glass upload-card">
      <h3 class="card-section-title">📂 Upload CSV</h3>

      <!-- Drop zone -->
      <div
        class="drop-zone"
        :class="{ dragging: dragging, 'has-file': selectedFile }"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
        @click="$refs.fileInput.click()"
      >
        <input ref="fileInput" type="file" accept=".csv" style="display:none" @change="onFileChange" />
        <div v-if="!selectedFile">
          <div class="dz-icon">📋</div>
          <div class="dz-label">Drop CSV here or click to browse</div>
          <div class="dz-hint text-muted">Max 5 MB · UTF-8 encoding recommended</div>
        </div>
        <div v-else class="file-selected">
          <span class="file-icon">📄</span>
          <span class="file-name">{{ selectedFile.name }}</span>
          <span class="file-size text-muted">({{ fmtSize(selectedFile.size) }})</span>
          <button class="btn-ghost btn-sm" @click.stop="clearFile">✕ Remove</button>
        </div>
      </div>

      <!-- Options -->
      <div class="options-row">
        <div class="option-group">
          <label class="option-label">Import Mode</label>
          <div class="radio-group">
            <label class="radio-opt">
              <input type="radio" v-model="mode" value="merge" />
              <span><strong>Merge</strong> — update existing customers, create new ones</span>
            </label>
            <label class="radio-opt">
              <input type="radio" v-model="mode" value="skip" />
              <span><strong>Skip</strong> — only create new customers, skip existing emails</span>
            </label>
          </div>
        </div>
      </div>

      <button
        class="btn-accent"
        :disabled="!selectedFile || importing"
        @click="importNow"
      >
        {{ importing ? '⏳ Importing…' : '⬆️ Import Customers' }}
      </button>
    </div>

    <!-- Result banner -->
    <div v-if="result" class="glass result-card" :class="result.errors?.length ? 'warning' : 'success'">
      <div class="result-stats">
        <div class="r-stat green">
          <div class="r-num">{{ result.created }}</div>
          <div class="r-label">Created</div>
        </div>
        <div class="r-stat blue">
          <div class="r-num">{{ result.updated }}</div>
          <div class="r-label">Updated</div>
        </div>
        <div class="r-stat amber">
          <div class="r-num">{{ result.skipped }}</div>
          <div class="r-label">Skipped</div>
        </div>
        <div class="r-stat red" v-if="result.errors?.length">
          <div class="r-num">{{ result.errors.length }}</div>
          <div class="r-label">Errors</div>
        </div>
      </div>
      <div v-if="result.errors?.length" class="error-list">
        <div class="error-list-title">⚠️ Errors</div>
        <div v-for="(e, i) in result.errors.slice(0, 20)" :key="i" class="error-item">{{ e }}</div>
        <div v-if="result.errors.length > 20" class="text-muted" style="font-size:.8rem">…and {{ result.errors.length - 20 }} more</div>
      </div>
    </div>

    <!-- CSV Format Guide -->
    <div class="glass format-guide">
      <h3 class="card-section-title">📖 CSV Format Guide</h3>
      <p class="text-muted" style="margin-bottom:1rem;font-size:.9rem;">Your CSV file must have a header row. Supported columns:</p>
      <table class="format-table">
        <thead>
          <tr>
            <th>Column</th>
            <th>Aliases</th>
            <th>Required</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>email</code></td>
            <td><code>email_address</code></td>
            <td><span class="badge badge-red">Required</span></td>
            <td>Used as the unique identifier for merge/skip logic</td>
          </tr>
          <tr>
            <td><code>first_name</code></td>
            <td><code>firstname, first</code></td>
            <td><span class="badge badge-gray">Optional</span></td>
            <td></td>
          </tr>
          <tr>
            <td><code>last_name</code></td>
            <td><code>lastname, last</code></td>
            <td><span class="badge badge-gray">Optional</span></td>
            <td></td>
          </tr>
          <tr>
            <td><code>phone</code></td>
            <td><code>phone_number</code></td>
            <td><span class="badge badge-gray">Optional</span></td>
            <td></td>
          </tr>
          <tr>
            <td><code>active</code></td>
            <td></td>
            <td><span class="badge badge-gray">Optional</span></td>
            <td><code>1</code> or <code>0</code>. Defaults to 1 (active)</td>
          </tr>
          <tr>
            <td><code>notes</code></td>
            <td><code>note</code></td>
            <td><span class="badge badge-gray">Optional</span></td>
            <td>Internal notes for this customer</td>
          </tr>
        </tbody>
      </table>

      <div class="sample-section">
        <div class="sample-header">
          <span>Sample CSV</span>
          <button class="btn-ghost btn-sm" @click="downloadSample">⬇️ Download sample</button>
        </div>
        <pre class="sample-csv">email,first_name,last_name,phone,active,notes
jane@example.com,Jane,Doe,+49123456789,1,VIP customer
john@example.com,John,Smith,,1,</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../api.js'

const selectedFile = ref(null)
const dragging = ref(false)
const mode = ref('merge')
const importing = ref(false)
const result = ref(null)
const fileInput = ref(null)

function onFileChange(e) {
  const f = e.target.files[0]
  if (f) { selectedFile.value = f; result.value = null }
}

function onDrop(e) {
  dragging.value = false
  const f = e.dataTransfer.files[0]
  if (f && f.name.endsWith('.csv')) { selectedFile.value = f; result.value = null }
}

function clearFile() {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
  result.value = null
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function importNow() {
  if (!selectedFile.value) return
  importing.value = true
  result.value = null
  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    const { data } = await api.post(`/customer-import?mode=${mode.value}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    result.value = data
  } catch (e) {
    result.value = {
      created: 0, updated: 0, skipped: 0,
      errors: [e.response?.data?.error || 'Import failed. Check CSV format.']
    }
  } finally {
    importing.value = false
  }
}

function downloadSample() {
  const csv = 'email,first_name,last_name,phone,active,notes\njane@example.com,Jane,Doe,+49123456789,1,VIP customer\njohn@example.com,John,Smith,,1,\n'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'pygmy-customers-sample.csv'; a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.customer-import-view { max-width: 760px; }

.upload-card { padding: 1.5rem; margin-bottom: 1.5rem; }
.card-section-title { margin: 0 0 1rem; font-size: 1rem; }

.drop-zone {
  border: 2px dashed rgba(255,255,255,.15);
  border-radius: 1rem;
  padding: 2.5rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: all .2s;
  margin-bottom: 1.5rem;
}
.drop-zone.dragging { border-color: var(--accent); background: rgba(192,67,78,.06); }
.drop-zone.has-file { border-style: solid; border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.03); }

.dz-icon { font-size: 2.5rem; margin-bottom: .5rem; }
.dz-label { font-size: 1rem; font-weight: 600; margin-bottom: .3rem; }
.dz-hint { font-size: .8rem; }

.file-selected { display: flex; align-items: center; gap: .75rem; justify-content: center; flex-wrap: wrap; }
.file-icon { font-size: 1.5rem; }
.file-name { font-weight: 600; }
.file-size { font-size: .85rem; }

.options-row { margin-bottom: 1.5rem; }
.option-label { font-size: .85rem; font-weight: 600; margin-bottom: .5rem; display: block; }
.radio-group { display: flex; flex-direction: column; gap: .5rem; }
.radio-opt { display: flex; align-items: flex-start; gap: .6rem; cursor: pointer; font-size: .9rem; }
.radio-opt input { margin-top: .15rem; }

.result-card { padding: 1.5rem; margin-bottom: 1.5rem; border-left: 3px solid rgba(255,255,255,.1); }
.result-card.success { border-left-color: #22c55e; }
.result-card.warning { border-left-color: #f59e0b; }

.result-stats { display: flex; gap: 1.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.r-stat { text-align: center; }
.r-num { font-size: 1.8rem; font-weight: 800; }
.r-label { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #aaa); }
.r-stat.green .r-num { color: #22c55e; }
.r-stat.blue .r-num { color: #60a5fa; }
.r-stat.amber .r-num { color: #f59e0b; }
.r-stat.red .r-num { color: var(--accent); }

.error-list { margin-top: .5rem; }
.error-list-title { font-weight: 600; margin-bottom: .5rem; font-size: .9rem; }
.error-item { font-size: .82rem; color: #fca5a5; padding: .2rem 0; border-bottom: 1px solid rgba(255,255,255,.05); }

.format-guide { padding: 1.5rem; }
.format-table { width: 100%; border-collapse: collapse; font-size: .85rem; margin-bottom: 1.5rem; }
.format-table th { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid rgba(255,255,255,.1); font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #aaa); }
.format-table td { padding: .5rem .75rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: top; }
.format-table tr:last-child td { border-bottom: none; }
code { background: rgba(255,255,255,.08); padding: .1rem .3rem; border-radius: .3rem; font-size: .8rem; font-family: monospace; }

.badge { padding: .15rem .5rem; border-radius: 100px; font-size: .7rem; font-weight: 700; }
.badge-red { background: rgba(192,67,78,.2); color: var(--accent); }
.badge-gray { background: rgba(255,255,255,.08); color: var(--text-muted, #aaa); }

.sample-section { margin-top: 1rem; }
.sample-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem; font-weight: 600; font-size: .85rem; }
.sample-csv { background: rgba(0,0,0,.3); border-radius: .5rem; padding: 1rem; font-size: .8rem; font-family: monospace; color: #a5f3fc; overflow-x: auto; line-height: 1.5; }

.btn-sm { padding: .3rem .7rem; font-size: .8rem; }
</style>
