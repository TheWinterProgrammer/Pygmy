<template>
  <div class="glass section digital-section">
    <div class="section-header">
      <h3>📥 Digital Downloads</h3>
      <label class="toggle-row compact">
        <input type="checkbox" :checked="isDigital" @change="$emit('update:isDigital', $event.target.checked)" />
        <span>This is a digital product</span>
      </label>
    </div>

    <template v-if="isDigital">
      <p class="hint">
        Upload files customers will receive automatically upon purchase.
        Download links are emailed with the order confirmation.
      </p>

      <!-- File list -->
      <div class="file-list" v-if="files.length">
        <div class="file-row" v-for="f in files" :key="f.id">
          <div class="file-icon">{{ iconFor(f.mime_type) }}</div>
          <div class="file-info">
            <div class="file-label">
              <input class="input input-sm" v-model="f._label" @blur="updateFile(f)" :placeholder="f.original_name" />
            </div>
            <div class="file-meta">
              {{ f.size_human || f.original_name }}
              <span class="dot">·</span>
              <span class="muted">{{ f.original_name }}</span>
              <span v-if="f.expires_days > 0" class="dot">·</span>
              <span v-if="f.expires_days > 0" class="pill">Expires in {{ f.expires_days }}d</span>
              <span v-if="f.download_limit > 0" class="dot">·</span>
              <span v-if="f.download_limit > 0" class="pill">{{ f.download_limit }} dl max</span>
            </div>
          </div>
          <div class="file-actions">
            <button class="btn btn-ghost btn-xs" @click="openLimitsModal(f)" title="Set limits">⚙️</button>
            <button class="btn btn-ghost btn-xs danger" @click="deleteFile(f)" title="Delete">🗑</button>
          </div>
        </div>
      </div>
      <p class="empty-hint" v-else-if="!uploading">No files yet. Upload your first download below.</p>

      <!-- Upload zone -->
      <div
        class="upload-zone"
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="handleDrop"
        @click="$refs.fileInput.click()"
      >
        <div v-if="uploading" class="upload-progress">
          <div class="progress-bar"><div class="progress-fill" :style="{ width: progress + '%' }"></div></div>
          <span>Uploading… {{ progress }}%</span>
        </div>
        <template v-else>
          <div class="upload-icon">⬆️</div>
          <div class="upload-text">Drop a file here or click to browse</div>
          <div class="upload-subtext">PDF, ZIP, MP3, MP4, and more — up to 500 MB</div>
        </template>
        <input ref="fileInput" type="file" style="display:none" @change="handleFileInput" />
      </div>
    </template>

    <!-- Limits modal -->
    <div v-if="limitsModal" class="modal-overlay" @click.self="limitsModal = null">
      <div class="modal-box glass">
        <h3>⚙️ Download Limits</h3>
        <p class="muted" style="font-size:.85rem">Configure access restrictions for: <strong>{{ limitsModal._label || limitsModal.original_name }}</strong></p>

        <div class="form-group">
          <label>Download Limit <small>(0 = unlimited)</small></label>
          <input class="input" v-model.number="limitsForm.download_limit" type="number" min="0" placeholder="0" />
          <small class="hint-text">How many times this link can be used. 0 = no limit.</small>
        </div>
        <div class="form-group">
          <label>Link Expiry <small>(days, 0 = never)</small></label>
          <input class="input" v-model.number="limitsForm.expires_days" type="number" min="0" placeholder="0" />
          <small class="hint-text">Number of days after purchase before the link expires. 0 = never.</small>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="limitsModal = null">Cancel</button>
          <button class="btn btn-primary" @click="saveLimits">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const props = defineProps({
  productId: { type: Number, default: null },
  isDigital: { type: Boolean, default: false },
})
const emit = defineEmits(['update:isDigital'])

const toast = useToastStore()
const files = ref([])
const uploading = ref(false)
const progress = ref(0)
const dragging = ref(false)
const limitsModal = ref(null)
const limitsForm = ref({ download_limit: 0, expires_days: 0 })

async function loadFiles() {
  if (!props.productId) return
  try {
    const { data } = await api.get(`/digital-downloads/files?product_id=${props.productId}`)
    files.value = data.map(f => ({ ...f, _label: f.label }))
  } catch {}
}

onMounted(loadFiles)
watch(() => props.productId, loadFiles)

function iconFor(mime) {
  if (!mime) return '📄'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.startsWith('video/')) return '🎬'
  if (mime === 'application/pdf') return '📕'
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return '🗜️'
  if (mime.startsWith('text/')) return '📝'
  return '📦'
}

async function uploadFile(file) {
  if (!props.productId) {
    toast.error('Save the product first before uploading files.')
    return
  }
  uploading.value = true
  progress.value = 0

  const formData = new FormData()
  formData.append('file', file)
  formData.append('product_id', props.productId)
  formData.append('label', file.name)

  try {
    const { data } = await api.post('/digital-downloads/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        progress.value = Math.round((e.loaded / e.total) * 100)
      },
    })
    files.value.push({ ...data, _label: data.label })
    toast.success('File uploaded!')
  } catch (e) {
    toast.error('Upload failed: ' + (e.response?.data?.error || e.message))
  } finally {
    uploading.value = false
    progress.value = 0
  }
}

function handleFileInput(e) {
  const file = e.target.files[0]
  if (file) uploadFile(file)
  e.target.value = ''
}

function handleDrop(e) {
  dragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) uploadFile(file)
}

async function updateFile(f) {
  try {
    await api.put(`/digital-downloads/files/${f.id}`, { label: f._label })
  } catch {}
}

async function deleteFile(f) {
  if (!confirm(`Delete "${f._label || f.original_name}"? This cannot be undone.`)) return
  try {
    await api.delete(`/digital-downloads/files/${f.id}`)
    files.value = files.value.filter(x => x.id !== f.id)
    toast.success('File deleted.')
  } catch {
    toast.error('Delete failed.')
  }
}

function openLimitsModal(f) {
  limitsModal.value = f
  limitsForm.value = { download_limit: f.download_limit, expires_days: f.expires_days }
}

async function saveLimits() {
  const f = limitsModal.value
  try {
    await api.put(`/digital-downloads/files/${f.id}`, limitsForm.value)
    Object.assign(f, limitsForm.value)
    toast.success('Limits saved.')
    limitsModal.value = null
  } catch {
    toast.error('Failed to save limits.')
  }
}
</script>

<style scoped>
.digital-section { padding: 1.25rem; margin-bottom: 1rem; }

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.section-header h3 { margin: 0; font-size: 1rem; }

.toggle-row.compact { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer; }
.toggle-row.compact input { accent-color: var(--accent); }

.hint { font-size: 0.82rem; color: var(--text-muted); margin: 0 0 1rem; line-height: 1.5; }

/* File list */
.file-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.file-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 0.6rem;
}
.file-icon { font-size: 1.2rem; flex-shrink: 0; }
.file-info { flex: 1; min-width: 0; }
.file-label { margin-bottom: 0.2rem; }
.input-sm { font-size: 0.85rem; padding: 0.3rem 0.5rem; height: auto; }
.file-meta { font-size: 0.75rem; color: var(--text-muted); display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; }
.dot { opacity: 0.4; }
.muted { color: var(--text-muted); }
.pill {
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
  padding: 0 0.45rem;
  font-size: 0.7rem;
  line-height: 1.5;
}
.file-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.btn-xs { padding: 0.2rem 0.45rem; font-size: 0.78rem; }
.danger:hover { color: var(--accent); }

.empty-hint { font-size: 0.82rem; color: var(--text-muted); text-align: center; margin: 0.5rem 0 1rem; }

/* Upload zone */
.upload-zone {
  border: 2px dashed rgba(255,255,255,0.12);
  border-radius: 0.75rem;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.upload-zone:hover, .upload-zone.dragging {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb, 213,60,60), 0.05);
}
.upload-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
.upload-text { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.25rem; }
.upload-subtext { font-size: 0.78rem; color: var(--text-muted); }

/* Upload progress */
.upload-progress { display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
.progress-bar { width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); transition: width 0.2s; border-radius: 999px; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}
.modal-box {
  width: 420px;
  max-width: 95vw;
  padding: 1.75rem;
  border-radius: 1.25rem;
}
.modal-box h3 { margin: 0 0 0.5rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; }
.hint-text { font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.25rem; }
</style>
