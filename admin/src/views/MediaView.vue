<template>
  <div>
    <div class="page-header">
      <h1>Media Library</h1>
      <label class="btn btn-primary">
        📤 Upload
        <input type="file" accept="image/*" multiple hidden @change="uploadFiles" />
      </label>
    </div>

    <!-- Upload progress -->
    <div class="upload-progress glass" v-if="uploading">
      <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
      <span>Uploading… {{ uploadProgress }}%</span>
    </div>

    <!-- Grid -->
    <div class="media-grid" v-if="media.length">
      <div
        v-for="item in media"
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
          <div class="media-meta">{{ formatSize(item.size) }} {{ item.width ? `· ${item.width}×${item.height}` : '' }}</div>
        </div>
      </div>
    </div>

    <div class="empty-state glass" v-else-if="!loading">
      <p>No media yet. Upload your first file.</p>
    </div>

    <!-- Sidebar detail -->
    <div class="detail-overlay" v-if="selected" @click.self="selected = null">
      <div class="detail-panel glass">
        <button class="close-btn" @click="selected = null">✕</button>
        <img :src="selected.url" :alt="selected.alt" class="detail-img" />
        <div class="form-group" style="margin-top:1rem;">
          <label>Alt Text</label>
          <input v-model="editAlt" class="input" placeholder="Describe this image…" />
          <button class="btn btn-ghost btn-sm" style="margin-top:0.4rem;" @click="saveAlt">Save alt</button>
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
        <button class="btn btn-danger" style="margin-top:1rem;width:100%;justify-content:center;" @click="remove(selected)">
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const media = ref([])
const loading = ref(true)
const selected = ref(null)
const editAlt = ref('')
const uploading = ref(false)
const uploadProgress = ref(0)

onMounted(load)

async function load() {
  loading.value = true
  const { data } = await api.get('/media?limit=200')
  media.value = data.media
  loading.value = false
}

function select(item) {
  selected.value = item
  editAlt.value = item.alt || ''
}

async function saveAlt() {
  await api.put(`/media/${selected.value.id}`, { alt: editAlt.value })
  selected.value.alt = editAlt.value
  toast.success('Alt text saved')
}

async function remove(item) {
  if (!confirm('Delete this file permanently?')) return
  await api.delete(`/media/${item.id}`)
  media.value = media.value.filter(m => m.id !== item.id)
  selected.value = null
  toast.success('File deleted')
}

async function uploadFiles(e) {
  const files = Array.from(e.target.files)
  if (!files.length) return
  uploading.value = true
  uploadProgress.value = 0

  for (let i = 0; i < files.length; i++) {
    const fd = new FormData()
    fd.append('file', files[i])
    await api.post('/media', fd)
    uploadProgress.value = Math.round(((i + 1) / files.length) * 100)
  }

  uploading.value = false
  e.target.value = ''
  toast.success(`${files.length} file(s) uploaded`)
  await load()
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}
</script>

<style scoped>
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
.media-info { padding: 0.5rem 0.6rem; }
.media-name { font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.media-meta { font-size: 0.68rem; color: var(--text-muted); margin-top: 0.1rem; }

.upload-progress {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  position: relative;
  overflow: hidden;
  font-size: 0.85rem;
}
.progress-bar {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  background: hsl(355,70%,20%);
  transition: width 0.3s;
  z-index: 0;
}
.upload-progress span { position: relative; z-index: 1; }

.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 1.5rem;
}
.detail-panel {
  width: 320px;
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
  padding: 1.5rem;
  position: relative;
}
.close-btn {
  position: absolute;
  top: 0.75rem; right: 0.75rem;
  background: none; border: none;
  color: var(--text-muted); font-size: 1rem; cursor: pointer;
}
.detail-img { width: 100%; border-radius: var(--radius-sm); max-height: 200px; object-fit: cover; }
.detail-meta { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.83rem; color: var(--text-muted); }
.detail-meta strong { color: var(--text); }
.empty-state { padding: 2rem; text-align: center; color: var(--text-muted); }
</style>
