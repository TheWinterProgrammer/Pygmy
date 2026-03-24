<template>
  <div class="media-layout">
    <!-- Folder sidebar -->
    <aside class="folder-sidebar glass">
      <div class="folder-header">
        <span>Folders</span>
        <button class="btn-icon" title="New folder" @click="showNewFolder = true">+</button>
      </div>
      <div
        class="folder-item"
        :class="{ active: activeFolder === null }"
        @click="setFolder(null)"
      >
        <span class="folder-icon">🗂️</span>
        <span>All media</span>
        <span class="folder-count">{{ totalMedia }}</span>
      </div>
      <div
        v-for="f in folders" :key="f.id"
        class="folder-item"
        :class="{ active: activeFolder === f.id }"
        @contextmenu.prevent="folderCtx = f"
        @click="setFolder(f.id)"
      >
        <span class="folder-icon">📁</span>
        <span class="folder-name">{{ f.name }}</span>
        <span class="folder-count">{{ f.media_count }}</span>
      </div>

      <!-- Inline new folder form -->
      <div v-if="showNewFolder" class="new-folder-form">
        <input
          v-model="newFolderName"
          class="input input-sm"
          placeholder="Folder name"
          @keydown.enter="createFolder"
          @keydown.esc="showNewFolder = false"
          ref="newFolderInput"
          autofocus
        />
        <div class="new-folder-btns">
          <button class="btn btn-primary btn-sm" @click="createFolder">Create</button>
          <button class="btn btn-ghost btn-sm" @click="showNewFolder = false">Cancel</button>
        </div>
      </div>
    </aside>

    <!-- Main area -->
    <div class="media-main">
      <div class="page-header">
        <h1>
          {{ activeFolder === null ? 'All Media' : (folders.find(f=>f.id===activeFolder)?.name || 'Media') }}
        </h1>
        <div class="header-actions">
          <input v-model="searchQ" class="input search-input" placeholder="🔍 Search…" />
          <label class="btn btn-primary">
            📤 Upload
            <input type="file" accept="image/*" multiple hidden @change="uploadFiles" />
          </label>
        </div>
      </div>

      <!-- Upload progress -->
      <div class="upload-progress glass" v-if="uploading">
        <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
        <span>Uploading… {{ uploadProgress }}%</span>
      </div>

      <!-- Grid -->
      <div class="media-grid" v-if="filteredMedia.length">
        <div
          v-for="item in filteredMedia"
          :key="item.id"
          class="media-card glass"
          :class="{ selected: selected?.id === item.id }"
          @click="select(item)"
        >
          <div class="media-thumb">
            <img :src="item.url" :alt="item.alt" loading="lazy" />
          </div>
          <div class="media-info">
            <div class="media-name" :title="item.original">{{ item.original }}</div>
            <div class="media-meta">{{ formatSize(item.size) }}{{ item.width ? ` · ${item.width}×${item.height}` : '' }}</div>
          </div>
        </div>
      </div>

      <div class="empty-state glass" v-else-if="!loading">
        <p>No media {{ activeFolder !== null ? 'in this folder' : 'yet' }}.
          {{ activeFolder !== null ? 'Upload files or move some here.' : 'Upload your first file.' }}
        </p>
      </div>
    </div>

    <!-- Detail sidebar -->
    <div class="detail-overlay" v-if="selected" @click.self="selected = null">
      <div class="detail-panel glass">
        <button class="close-btn" @click="selected = null">✕</button>
        <img :src="selected.url" :alt="selected.alt" class="detail-img" />
        <div class="form-group" style="margin-top:1rem;">
          <label>Alt Text</label>
          <input v-model="editAlt" class="input" placeholder="Describe this image…" />
          <button class="btn btn-ghost btn-sm" style="margin-top:0.4rem;" @click="saveAlt">Save alt</button>
        </div>
        <div class="form-group">
          <label>Move to Folder</label>
          <select v-model="moveToFolder" class="select" @change="moveMedia">
            <option :value="null">— Root (no folder)</option>
            <option v-for="f in folders" :key="f.id" :value="f.id">📁 {{ f.name }}</option>
          </select>
        </div>
        <div class="detail-meta">
          <div><strong>File:</strong> {{ selected.original }}</div>
          <div><strong>Size:</strong> {{ formatSize(selected.size) }}</div>
          <div v-if="selected.width"><strong>Dimensions:</strong> {{ selected.width }}×{{ selected.height }}</div>
          <div><strong>Type:</strong> {{ selected.mime_type }}</div>
          <div style="margin-top:0.5rem;">
            <label style="margin-bottom:0.2rem;display:block;">URL</label>
            <input :value="selected.url" class="input" readonly @click="$event.target.select()" />
          </div>
        </div>
        <div style="margin-top:.75rem;display:flex;gap:.5rem;">
          <button v-if="isImageFile(selected)" class="btn btn-ghost btn-sm" @click="openEditor(selected)" style="flex:1;">
            🖊️ Edit Image
          </button>
          <button class="btn btn-danger" style="flex:1;" @click="remove(selected)">
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Image Editor Modal -->
    <Teleport to="body">
      <div class="modal-backdrop" v-if="editingImage" @click.self="closeEditor">
        <div class="editor-modal glass">
          <div class="editor-header">
            <h3>🖊️ Image Editor</h3>
            <button class="close-btn" @click="closeEditor">✕</button>
          </div>
          <div class="editor-canvas-wrap">
            <canvas ref="editorCanvas" class="editor-canvas"></canvas>
          </div>
          <div class="editor-tools">
            <div class="tool-group">
              <span class="tool-label">Rotate</span>
              <button class="tool-btn" @click="rotate(-90)" title="Rotate left">↺ 90°</button>
              <button class="tool-btn" @click="rotate(90)" title="Rotate right">↻ 90°</button>
            </div>
            <div class="tool-group">
              <span class="tool-label">Flip</span>
              <button class="tool-btn" @click="flip('h')" title="Flip horizontal">↔ H</button>
              <button class="tool-btn" @click="flip('v')" title="Flip vertical">↕ V</button>
            </div>
            <div class="tool-group fg">
              <span class="tool-label">Brightness: {{ editorBrightness }}%</span>
              <input type="range" v-model="editorBrightness" min="0" max="200" step="1" class="range" @input="applyFilters" />
            </div>
            <div class="tool-group fg">
              <span class="tool-label">Contrast: {{ editorContrast }}%</span>
              <input type="range" v-model="editorContrast" min="0" max="200" step="1" class="range" @input="applyFilters" />
            </div>
          </div>
          <div class="editor-footer">
            <button class="btn btn-ghost" @click="resetEditor">Reset</button>
            <button class="btn btn-ghost" @click="closeEditor">Cancel</button>
            <button class="btn btn-primary" @click="saveEdited" :disabled="savingEdited">
              {{ savingEdited ? 'Saving…' : '💾 Save & Replace' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Folder context menu (rename/delete) -->
    <Teleport to="body">
      <div class="ctx-backdrop" v-if="folderCtx" @click="folderCtx = null"></div>
      <div class="ctx-menu glass" v-if="folderCtx">
        <button class="ctx-item" @click="startRenameFolder">✏️ Rename</button>
        <button class="ctx-item danger" @click="deleteFolder">🗑 Delete folder</button>
      </div>
    </Teleport>

    <!-- Rename folder modal -->
    <Teleport to="body">
      <div class="modal-backdrop" v-if="renameFolderTarget" @click.self="renameFolderTarget = null">
        <div class="modal glass">
          <h3>Rename Folder</h3>
          <input v-model="renameFolderName" class="input" placeholder="New name" @keydown.enter="doRenameFolder" />
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="renameFolderTarget = null">Cancel</button>
            <button class="btn btn-primary" @click="doRenameFolder">Rename</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import api from '../api.js'

const media = ref([])
const folders = ref([])
const loading = ref(true)
const selected = ref(null)
const editAlt = ref('')
const moveToFolder = ref(null)

// ── Image Editor ──────────────────────────────────────────────────────────────
const editingImage = ref(null)
const editorCanvas = ref(null)
const editorBrightness = ref(100)
const editorContrast = ref(100)
const savingEdited = ref(false)
let editorImg = null
let editorRotation = 0
let editorFlipH = false
let editorFlipV = false

function isImageFile(item) {
  return item?.mime_type?.startsWith('image/') && !item?.mime_type?.includes('svg')
}

async function openEditor(item) {
  editingImage.value = item
  editorRotation = 0; editorFlipH = false; editorFlipV = false
  editorBrightness.value = 100; editorContrast.value = 100
  await nextTick()
  editorImg = new Image()
  editorImg.crossOrigin = 'anonymous'
  editorImg.onload = () => drawEditor()
  editorImg.src = item.url + '?t=' + Date.now()
}

function closeEditor() { editingImage.value = null; editorImg = null }

function drawEditor() {
  if (!editorCanvas.value || !editorImg) return
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  const isRotated90 = editorRotation % 180 !== 0
  canvas.width  = isRotated90 ? editorImg.height : editorImg.width
  canvas.height = isRotated90 ? editorImg.width  : editorImg.height
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(editorRotation * Math.PI / 180)
  ctx.scale(editorFlipH ? -1 : 1, editorFlipV ? -1 : 1)
  ctx.filter = `brightness(${editorBrightness.value}%) contrast(${editorContrast.value}%)`
  ctx.drawImage(editorImg, -editorImg.width / 2, -editorImg.height / 2)
  ctx.restore()
}

function rotate(deg) { editorRotation = ((editorRotation + deg) % 360 + 360) % 360; drawEditor() }
function flip(axis) {
  if (axis === 'h') editorFlipH = !editorFlipH
  else editorFlipV = !editorFlipV
  drawEditor()
}
function applyFilters() { drawEditor() }
function resetEditor() {
  editorRotation = 0; editorFlipH = false; editorFlipV = false
  editorBrightness.value = 100; editorContrast.value = 100
  drawEditor()
}

async function saveEdited() {
  if (!editorCanvas.value || !editingImage.value) return
  savingEdited.value = true
  editorCanvas.value.toBlob(async blob => {
    try {
      const formData = new FormData()
      const ext = (editingImage.value.mime_type || 'image/jpeg').includes('png') ? 'png' : 'jpg'
      const baseName = (editingImage.value.original || 'image').replace(/\.[^.]+$/, '')
      formData.append('file', blob, `${baseName}-edited.${ext}`)
      const { data } = await api.post('/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      const uploaded = Array.isArray(data) ? data[0] : data
      if (uploaded) {
        // Add to media list and select the new item
        media.value.unshift(uploaded)
        selected.value = { ...uploaded }
        editAlt.value = ''
      }
      closeEditor()
    } catch (e) {
      alert('Failed to save: ' + (e.response?.data?.error || e.message))
    } finally { savingEdited.value = false }
  }, (editingImage.value.mime_type || 'image/jpeg').includes('png') ? 'image/png' : 'image/jpeg', 0.92)
}
const uploading = ref(false)
const uploadProgress = ref(0)
const activeFolder = ref(null) // null = all
const totalMedia = ref(0)
const searchQ = ref('')

const showNewFolder = ref(false)
const newFolderName = ref('')
const newFolderInput = ref(null)
const folderCtx = ref(null)
const renameFolderTarget = ref(null)
const renameFolderName = ref('')

const filteredMedia = computed(() => {
  if (!searchQ.value) return media.value
  const q = searchQ.value.toLowerCase()
  return media.value.filter(m => m.original.toLowerCase().includes(q))
})

onMounted(async () => {
  await loadFolders()
  await loadMedia()
})

async function loadFolders() {
  const { data } = await api.get('/media-folders')
  folders.value = data
}

async function loadMedia() {
  loading.value = true
  const params = { limit: 300 }
  if (activeFolder.value !== null) params.folder_id = activeFolder.value
  const { data } = await api.get('/media', { params })
  media.value = data.media
  if (activeFolder.value === null) totalMedia.value = data.total
  loading.value = false
}

function setFolder(id) {
  activeFolder.value = id
  selected.value = null
  loadMedia()
}

function select(item) {
  selected.value = item
  editAlt.value = item.alt || ''
  moveToFolder.value = item.folder_id ?? null
}

async function saveAlt() {
  await api.put(`/media/${selected.value.id}`, { alt: editAlt.value })
  selected.value.alt = editAlt.value
}

async function moveMedia() {
  await api.put(`/media/${selected.value.id}`, { folder_id: moveToFolder.value })
  selected.value.folder_id = moveToFolder.value
  // Remove from current view if filtered by folder
  if (activeFolder.value !== null) {
    media.value = media.value.filter(m => m.id !== selected.value.id)
    selected.value = null
  }
  await loadFolders()
}

async function remove(item) {
  if (!confirm('Delete this file permanently?')) return
  await api.delete(`/media/${item.id}`)
  media.value = media.value.filter(m => m.id !== item.id)
  selected.value = null
  totalMedia.value--
  await loadFolders()
}

async function uploadFiles(e) {
  const files = Array.from(e.target.files)
  if (!files.length) return
  uploading.value = true
  uploadProgress.value = 0
  for (let i = 0; i < files.length; i++) {
    const fd = new FormData()
    fd.append('file', files[i])
    if (activeFolder.value !== null) fd.append('folder_id', activeFolder.value)
    await api.post('/media', fd)
    uploadProgress.value = Math.round(((i + 1) / files.length) * 100)
  }
  uploading.value = false
  e.target.value = ''
  await loadFolders()
  await loadMedia()
}

async function createFolder() {
  if (!newFolderName.value.trim()) return
  await api.post('/media-folders', { name: newFolderName.value.trim() })
  newFolderName.value = ''
  showNewFolder.value = false
  await loadFolders()
}

function startRenameFolder() {
  renameFolderTarget.value = folderCtx.value
  renameFolderName.value = folderCtx.value.name
  folderCtx.value = null
}

async function doRenameFolder() {
  if (!renameFolderName.value.trim()) return
  await api.put(`/media-folders/${renameFolderTarget.value.id}`, { name: renameFolderName.value.trim() })
  renameFolderTarget.value = null
  await loadFolders()
}

async function deleteFolder() {
  if (!confirm(`Delete folder "${folderCtx.value.name}"? Media inside will be moved to root.`)) {
    folderCtx.value = null
    return
  }
  await api.delete(`/media-folders/${folderCtx.value.id}`)
  if (activeFolder.value === folderCtx.value.id) activeFolder.value = null
  folderCtx.value = null
  await loadFolders()
  await loadMedia()
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}
</script>

<style scoped>
.media-layout {
  display: flex;
  gap: 1rem;
  height: 100%;
  min-height: 0;
}

/* ─── Folder sidebar ────────────────────────────────────────── */
.folder-sidebar {
  width: 200px;
  flex-shrink: 0;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  align-self: flex-start;
  border-radius: var(--radius);
}
.folder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  padding: 0 0.25rem 0.5rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.4rem;
}
.btn-icon {
  background: none; border: none; color: var(--text-muted);
  font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 0;
}
.btn-icon:hover { color: var(--text); }

.folder-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.83rem;
  color: var(--text-muted);
  user-select: none;
  transition: all 0.15s;
}
.folder-item:hover { background: var(--glass-bg); color: var(--text); }
.folder-item.active { background: hsl(355,70%,20%); color: var(--accent); }
.folder-icon { font-size: 0.9rem; flex-shrink: 0; }
.folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-count {
  margin-left: auto;
  font-size: 0.7rem;
  background: var(--surface);
  padding: 1px 5px;
  border-radius: 999px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.new-folder-form { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; }
.new-folder-btns { display: flex; gap: 0.35rem; }
.input-sm { padding: 0.3rem 0.6rem; font-size: 0.82rem; }

/* ─── Main area ─────────────────────────────────────────────── */
.media-main { flex: 1; min-width: 0; }

.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.page-header h1 { font-size: 1.4rem; font-weight: 700; }
.header-actions { display: flex; align-items: center; gap: 0.75rem; }
.search-input { width: 180px; }

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.media-card {
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s;
  border-radius: var(--radius-sm);
}
.media-card:hover { border-color: var(--text-muted); }
.media-card.selected { border-color: var(--accent); }
.media-thumb { aspect-ratio: 1; overflow: hidden; background: var(--surface2); }
.media-thumb img { width: 100%; height: 100%; object-fit: cover; }
.media-info { padding: 0.45rem 0.55rem; }
.media-name { font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.media-meta { font-size: 0.65rem; color: var(--text-muted); margin-top: 0.1rem; }

.upload-progress {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  position: relative;
  overflow: hidden;
  font-size: 0.85rem;
}
.progress-bar {
  position: absolute; top: 0; left: 0; bottom: 0;
  background: hsl(355,70%,20%); transition: width 0.3s; z-index: 0;
}
.upload-progress span { position: relative; z-index: 1; }

.empty-state { padding: 2rem; text-align: center; color: var(--text-muted); }

/* ─── Detail overlay ────────────────────────────────────────── */
.detail-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6); z-index: 1000;
  display: flex; align-items: flex-start; justify-content: flex-end; padding: 1.5rem;
}
.detail-panel {
  width: 320px; max-height: calc(100vh - 3rem); overflow-y: auto; padding: 1.5rem; position: relative;
}
.close-btn {
  position: absolute; top: 0.75rem; right: 0.75rem;
  background: none; border: none; color: var(--text-muted); font-size: 1rem; cursor: pointer;
}
.detail-img { width: 100%; border-radius: var(--radius-sm); max-height: 200px; object-fit: cover; }
.detail-meta { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.83rem; color: var(--text-muted); }
.detail-meta strong { color: var(--text); }
.form-group { margin-bottom: 0.75rem; }
.form-group label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.3rem; }

/* ─── Context menu ──────────────────────────────────────────── */
.ctx-backdrop { position: fixed; inset: 0; z-index: 999; }
.ctx-menu {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  min-width: 160px;
  padding: 0.4rem;
  border-radius: var(--radius-sm);
}
.ctx-item {
  display: block; width: 100%;
  background: none; border: none; color: var(--text);
  padding: 0.55rem 0.85rem; text-align: left;
  font-size: 0.87rem; cursor: pointer; border-radius: 0.3rem;
}
.ctx-item:hover { background: var(--glass-bg); }
.ctx-item.danger { color: var(--accent); }

/* ─── Image Editor Modal ────────────────────────────────────── */
.editor-modal {
  border-radius: 1.5rem; width: 100%; max-width: 700px; max-height: 92vh;
  display: flex; flex-direction: column;
  border: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(16px);
}
.editor-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.editor-header h3 { margin: 0; font-size: 1rem; }
.editor-canvas-wrap { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 1rem; min-height: 200px; background: rgba(0,0,0,.3); }
.editor-canvas { max-width: 100%; max-height: 380px; border-radius: .5rem; box-shadow: 0 4px 24px rgba(0,0,0,.4); }
.editor-tools { display: flex; flex-wrap: wrap; gap: .75rem; padding: .75rem 1.25rem; border-top: 1px solid rgba(255,255,255,.08); align-items: center; }
.tool-group { display: flex; align-items: center; gap: .4rem; }
.tool-group.fg { flex: 1 1 180px; flex-direction: column; align-items: flex-start; gap: .2rem; }
.tool-label { font-size: .75rem; color: var(--text-muted, #aaa); white-space: nowrap; }
.tool-btn { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); color: inherit; border-radius: .5rem; padding: .35rem .7rem; font-size: .8rem; cursor: pointer; transition: background .15s; }
.tool-btn:hover { background: rgba(255,255,255,.16); }
.range { width: 100%; accent-color: var(--accent); }
.editor-footer { display: flex; justify-content: flex-end; gap: .5rem; padding: .75rem 1.25rem; border-top: 1px solid rgba(255,255,255,.08); }
</style>
