<template>
  <div class="import-history">
    <div class="page-header">
      <div class="header-left">
        <h1>📥 Import History</h1>
        <p class="subtitle">CSV product import log</p>
      </div>
      <div class="header-right">
        <RouterLink to="/products" class="btn btn-ghost">← Products</RouterLink>
        <button class="btn btn-primary" @click="triggerImport">⬆️ New Import</button>
        <input ref="fileInput" type="file" accept=".csv" style="display:none" @change="handleFile" />
      </div>
    </div>

    <!-- Import result banner -->
    <div v-if="importResult" class="result-banner glass" :class="importResult.ok ? 'success' : 'error'">
      <div v-if="importResult.ok">
        ✅ Import complete: <strong>{{ importResult.report?.created }} created</strong>,
        {{ importResult.report?.updated }} updated,
        {{ importResult.report?.skipped }} skipped
        <span v-if="importResult.report?.errors?.length"> · {{ importResult.report.errors.length }} errors</span>
      </div>
      <div v-else>❌ Import failed: {{ importResult.error }}</div>
      <button class="btn btn-ghost btn-sm" @click="importResult = null" style="margin-left:auto">✕</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-bar"></div>

    <!-- History table -->
    <div class="glass table-wrap" v-if="history.length">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Filename</th>
            <th>Mode</th>
            <th>Created</th>
            <th>Updated</th>
            <th>Skipped</th>
            <th>Errors</th>
            <th>Imported By</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in history" :key="h.id" @click="selected = selected?.id === h.id ? null : h" style="cursor:pointer">
            <td>{{ h.id }}</td>
            <td><code>{{ h.filename }}</code></td>
            <td><span class="badge" :class="h.mode === 'merge' ? 'badge-blue' : 'badge-orange'">{{ h.mode }}</span></td>
            <td class="num-cell success-num">+{{ h.created }}</td>
            <td class="num-cell">~{{ h.updated }}</td>
            <td class="num-cell muted-num">{{ h.skipped }}</td>
            <td>
              <span v-if="h.errors.length" class="badge badge-red">{{ h.errors.length }}</span>
              <span v-else class="badge badge-green">0</span>
            </td>
            <td>{{ h.imported_by_name || '—' }}</td>
            <td class="muted">{{ fmtDate(h.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail panel for selected import -->
    <div v-if="selected" class="detail-panel glass">
      <h3>📋 Import #{{ selected.id }} — {{ selected.filename }}</h3>
      <div class="detail-stats">
        <div class="ds"><span class="ds-val success-num">+{{ selected.created }}</span><span class="ds-label">Created</span></div>
        <div class="ds"><span class="ds-val">{{ selected.updated }}</span><span class="ds-label">Updated</span></div>
        <div class="ds"><span class="ds-val muted-num">{{ selected.skipped }}</span><span class="ds-label">Skipped</span></div>
        <div class="ds"><span class="ds-val" :class="selected.errors.length ? 'error-num' : 'success-num'">{{ selected.errors.length }}</span><span class="ds-label">Errors</span></div>
      </div>
      <div v-if="selected.errors.length" class="error-list">
        <h4>Errors</h4>
        <ul>
          <li v-for="(e, i) in selected.errors" :key="i">{{ e }}</li>
        </ul>
      </div>
    </div>

    <div v-else-if="!loading && !history.length" class="empty-state glass">
      <div style="font-size:2.5rem;margin-bottom:.5rem;">📥</div>
      <p>No import history yet. Upload a CSV file to get started.</p>
      <button class="btn btn-primary" @click="triggerImport">⬆️ Import Products</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const history = ref([])
const loading = ref(false)
const selected = ref(null)
const fileInput = ref(null)
const importResult = ref(null)
const importing = ref(false)

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/products/import/history')
    history.value = data
  } catch {}
  loading.value = false
}

function triggerImport() {
  fileInput.value?.click()
}

async function handleFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  importing.value = true
  importResult.value = null
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', 'merge')
    const { data } = await api.post('/products/import/csv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    importResult.value = { ok: true, ...data }
    await load()
  } catch (err) {
    importResult.value = { ok: false, error: err.response?.data?.error || err.message }
  } finally {
    importing.value = false
    e.target.value = ''
  }
}

function fmtDate(dt) {
  return new Date(dt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(load)
</script>

<style scoped>
.import-history { padding: 2rem; max-width: 1100px; }
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap; }
.header-right { display:flex; gap:.75rem; align-items:center; }
.subtitle { color:var(--text-muted); margin:.25rem 0 0; font-size:.9rem; }
.loading-bar { height:3px; background:linear-gradient(90deg,var(--accent),transparent); animation:pulse 1s infinite; border-radius:2px; margin-bottom:1rem; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

.result-banner { display:flex; align-items:center; gap:.75rem; padding:.75rem 1.25rem; border-radius:1rem; margin-bottom:1.5rem; font-size:.9rem; }
.result-banner.success { border:1px solid hsl(142,50%,30%); }
.result-banner.error { border:1px solid hsl(355,50%,30%); }

.table-wrap { border-radius:1rem; overflow:hidden; margin-bottom:1.5rem; }
.data-table { width:100%; border-collapse:collapse; font-size:.85rem; }
.data-table th { text-align:left; padding:.6rem .75rem; font-size:.75rem; text-transform:uppercase; color:var(--text-muted); border-bottom:1px solid rgba(255,255,255,.1); }
.data-table td { padding:.6rem .75rem; border-bottom:1px solid rgba(255,255,255,.05); }
.data-table tr:hover { background:rgba(255,255,255,.04); }
code { background:rgba(255,255,255,.08); padding:.1rem .4rem; border-radius:.25rem; font-size:.8rem; }
.badge { padding:.2rem .5rem; border-radius:.5rem; font-size:.75rem; font-weight:600; }
.badge-blue { background:rgba(99,162,255,.2); color:#63a2ff; }
.badge-orange { background:rgba(255,186,99,.2); color:#ffba63; }
.badge-red { background:rgba(255,99,99,.2); color:#ff6363; }
.badge-green { background:rgba(99,202,121,.2); color:#63ca79; }
.num-cell { font-weight:600; }
.success-num { color:hsl(142,60%,60%); }
.error-num { color:hsl(355,70%,65%); }
.muted-num { color:var(--text-muted); }
.muted { color:var(--text-muted); font-size:.8rem; }

.detail-panel { padding:1.5rem; border-radius:1rem; margin-bottom:1.5rem; }
.detail-panel h3 { margin:0 0 1rem; }
.detail-stats { display:flex; gap:1.5rem; margin-bottom:1rem; flex-wrap:wrap; }
.ds { display:flex; flex-direction:column; align-items:center; gap:.2rem; }
.ds-val { font-size:1.4rem; font-weight:700; }
.ds-label { font-size:.75rem; color:var(--text-muted); }
.error-list h4 { margin:0 0 .5rem; font-size:.9rem; color:hsl(355,70%,65%); }
.error-list ul { margin:0; padding-left:1.25rem; font-size:.82rem; display:flex; flex-direction:column; gap:.25rem; }

.empty-state { text-align:center; padding:3rem; border-radius:1.5rem; display:flex; flex-direction:column; align-items:center; gap:.75rem; }
</style>
