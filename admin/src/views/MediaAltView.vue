<template>
  <div class="media-alt-view">
    <div class="page-header">
      <div>
        <h1>🖼️ Media Alt Text</h1>
        <p class="page-desc">Bulk edit alt text for all images. Good alt text improves accessibility and SEO.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" @click="filterMissing = !filterMissing; load()">
          {{ filterMissing ? '👁️ Show All' : '⚠️ Missing Only' }}
        </button>
        <button class="btn btn-primary" @click="bulkSave" :disabled="pendingCount === 0 || saving">
          {{ saving ? 'Saving…' : `💾 Save All (${pendingCount})` }}
        </button>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="stats" class="stats-bar glass">
      <div class="stat">
        <span class="stat-n">{{ stats.total_images }}</span>
        <span class="stat-l">Total Images</span>
      </div>
      <div class="stat ok">
        <span class="stat-n">{{ stats.with_alt }}</span>
        <span class="stat-l">Have Alt Text</span>
      </div>
      <div class="stat warn">
        <span class="stat-n">{{ stats.missing_alt }}</span>
        <span class="stat-l">Missing Alt Text</span>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill" :style="`width:${coveragePct}%`"></div>
        </div>
        <span class="progress-label">{{ coveragePct }}% covered</span>
      </div>
    </div>

    <!-- Search -->
    <div class="filter-row">
      <input v-model="q" class="input" placeholder="🔍 Search by filename or alt text…" @input="debouncedLoad" />
    </div>

    <!-- Grid -->
    <div v-if="items.length" class="alt-grid">
      <div v-for="img in items" :key="img.id" class="alt-card glass" :class="{ saved: savedIds.has(img.id), missing: !img.alt }">
        <div class="card-img-wrap">
          <img :src="`http://localhost:3200${img.url}`" :alt="img.alt || img.original" class="card-img" loading="lazy" />
          <span v-if="!img.alt && !localAlts[img.id]" class="missing-badge">⚠ Missing</span>
          <span v-if="savedIds.has(img.id)" class="saved-badge">✓ Saved</span>
        </div>
        <div class="card-body">
          <div class="card-filename" :title="img.original">{{ img.original }}</div>
          <div class="card-meta">{{ fmtSize(img.size) }} · {{ img.width && img.height ? `${img.width}×${img.height}` : '' }}</div>
          <textarea
            v-model="localAlts[img.id]"
            class="alt-textarea"
            :placeholder="`Describe this image for screen readers and search engines…`"
            rows="2"
            @input="onAltInput(img.id)"
          ></textarea>
          <div class="card-footer">
            <span class="char-count" :class="localAlts[img.id]?.length > 125 ? 'warn' : ''">
              {{ (localAlts[img.id] || '').length }} chars
            </span>
            <button class="btn btn-primary btn-xs" @click="saveSingle(img.id)" :disabled="!localAlts[img.id]?.trim() || savedIds.has(img.id)">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading placeholder -->
    <div v-else-if="loading" class="loading-grid">
      <div v-for="i in 12" :key="i" class="skeleton-card"></div>
    </div>

    <div v-else class="empty-state glass">
      <span>🎉</span>
      <p v-if="filterMissing">All images have alt text!</p>
      <p v-else>No images found.</p>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <button class="btn btn-ghost btn-sm" :disabled="offset === 0" @click="prev">← Prev</button>
      <span class="page-info">{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <button class="btn btn-ghost btn-sm" :disabled="offset + limit >= total" @click="next">Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const items = ref([])
const stats = ref(null)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const q = ref('')
const filterMissing = ref(false)
const limit = 24
const offset = ref(0)
const localAlts = ref({})    // id → current input value
const dirtyIds = ref(new Set()) // ids with unsaved changes
const savedIds = ref(new Set()) // ids successfully saved this session

const coveragePct = computed(() => {
  if (!stats.value || !stats.value.total_images) return 100
  return Math.round(stats.value.with_alt / stats.value.total_images * 100)
})

const pendingCount = computed(() => dirtyIds.value.size)

let debTimer = null
function debouncedLoad() {
  clearTimeout(debTimer)
  debTimer = setTimeout(() => { offset.value = 0; load() }, 350)
}

async function load() {
  loading.value = true
  const params = { limit, offset: offset.value }
  if (q.value) params.q = q.value
  if (filterMissing.value) params.missing_only = '1'
  const { data } = await api.get('/media-alt', { params })
  items.value = data.rows
  stats.value = data.stats
  total.value = data.total
  // Seed localAlts from current values
  for (const img of data.rows) {
    if (localAlts.value[img.id] === undefined) {
      localAlts.value[img.id] = img.alt || ''
    }
  }
  loading.value = false
}

function onAltInput(id) {
  dirtyIds.value.add(id)
  savedIds.value.delete(id)
}

async function saveSingle(id) {
  const alt = localAlts.value[id]
  await api.put(`/media-alt/${id}`, { alt })
  savedIds.value.add(id)
  dirtyIds.value.delete(id)
  // Update item in-place
  const item = items.value.find(i => i.id === id)
  if (item) item.alt = alt
  // Refresh stats
  const { data } = await api.get('/media-alt', { params: { limit: 1, offset: 0 } })
  stats.value = data.stats
}

async function bulkSave() {
  if (dirtyIds.value.size === 0) return
  saving.value = true
  const updates = [...dirtyIds.value].map(id => ({ id, alt: localAlts.value[id] || '' }))
  await api.post('/media-alt/bulk', { updates })
  for (const { id } of updates) {
    savedIds.value.add(id)
    dirtyIds.value.delete(id)
    const item = items.value.find(i => i.id === id)
    if (item) item.alt = localAlts.value[id]
  }
  saving.value = false
  // Refresh stats
  const { data } = await api.get('/media-alt', { params: { limit: 1, offset: 0 } })
  stats.value = data.stats
}

function prev() { offset.value = Math.max(0, offset.value - limit); load() }
function next() { offset.value += limit; load() }
function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(0)}KB`
  return `${(bytes/1024/1024).toFixed(1)}MB`
}

onMounted(load)
</script>

<style scoped>
.media-alt-view { max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-desc { color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-top: 0.25rem; }
.header-actions { display: flex; gap: 0.75rem; align-items: center; flex-shrink: 0; }

.stats-bar { display: flex; gap: 2rem; align-items: center; padding: 1rem 1.5rem; border-radius: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.stat { display: flex; flex-direction: column; align-items: center; }
.stat-n { font-size: 1.5rem; font-weight: 700; line-height: 1; }
.stat-l { font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-top: 0.2rem; }
.stat.ok .stat-n { color: #4ade80; }
.stat.warn .stat-n { color: hsl(38,90%,55%); }
.progress-wrap { flex: 1; min-width: 150px; }
.progress-bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 0.4rem; }
.progress-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.4s; }
.progress-label { font-size: 0.75rem; color: rgba(255,255,255,0.6); }

.filter-row { margin-bottom: 1.25rem; }
.filter-row .input { width: 100%; max-width: 400px; }

.alt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.alt-card { border-radius: 1rem; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); transition: border-color 0.2s; }
.alt-card.missing { border-color: rgba(249,115,22,0.3); }
.alt-card.saved { border-color: rgba(74,222,128,0.3); }
.card-img-wrap { position: relative; height: 160px; overflow: hidden; background: rgba(0,0,0,0.3); }
.card-img { width: 100%; height: 100%; object-fit: cover; }
.missing-badge { position: absolute; top: 0.5rem; left: 0.5rem; background: rgba(249,115,22,0.85); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 0.5rem; }
.saved-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(74,222,128,0.85); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 0.5rem; }
.card-body { padding: 0.875rem; }
.card-filename { font-size: 0.78rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 0.2rem; }
.card-meta { font-size: 0.7rem; color: rgba(255,255,255,0.4); margin-bottom: 0.65rem; }
.alt-textarea { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 0.5rem 0.65rem; color: rgba(255,255,255,0.9); font-family: inherit; font-size: 0.8rem; resize: vertical; min-height: 52px; }
.alt-textarea:focus { outline: none; border-color: var(--accent); }
.alt-textarea::placeholder { color: rgba(255,255,255,0.3); }
.card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
.char-count { font-size: 0.7rem; color: rgba(255,255,255,0.4); }
.char-count.warn { color: hsl(38,90%,55%); }
.btn-xs { padding: 0.3rem 0.75rem; font-size: 0.75rem; }

.loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.skeleton-card { height: 280px; border-radius: 1rem; background: rgba(255,255,255,0.05); animation: pulse 1.5s infinite; }
@keyframes pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }

.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; }
.empty-state span { font-size: 3rem; display: block; margin-bottom: 1rem; }
.empty-state p { color: rgba(255,255,255,0.5); }

.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; padding: 1rem 0; }
.page-info { font-size: 0.85rem; color: rgba(255,255,255,0.5); }
</style>
