<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-panel glass">
        <div class="modal-header">
          <h3>Pick from Media Library</h3>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <!-- Upload strip -->
        <div class="upload-strip">
          <label class="btn btn-ghost btn-sm">
            📤 Upload new
            <input type="file" accept="image/*" multiple hidden @change="uploadFiles" />
          </label>
          <input
            v-model="search"
            class="input search-input"
            placeholder="Search…"
          />
        </div>

        <!-- Progress -->
        <div class="progress-wrap" v-if="uploading">
          <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
        </div>

        <!-- Grid -->
        <div class="media-grid" v-if="filtered.length">
          <div
            v-for="item in filtered"
            :key="item.id"
            class="media-card"
            :class="{ selected: picked?.id === item.id }"
            @click="picked = item"
            @dblclick="confirm"
          >
            <img :src="item.url" :alt="item.alt" loading="lazy" />
            <div class="media-name">{{ item.original }}</div>
          </div>
        </div>
        <div class="empty" v-else-if="!loading">
          No media yet. Upload something above.
        </div>
        <div class="loading" v-else>Loading…</div>

        <!-- Footer -->
        <div class="modal-footer">
          <span v-if="picked" class="picked-url">{{ picked.url }}</span>
          <div class="footer-btns">
            <button class="btn btn-ghost" @click="$emit('close')">Cancel</button>
            <button class="btn btn-primary" :disabled="!picked" @click="confirm">Insert</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const emit = defineEmits(['select', 'close'])

const media = ref([])
const loading = ref(true)
const search = ref('')
const picked = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)

const filtered = computed(() => {
  if (!search.value.trim()) return media.value
  const q = search.value.toLowerCase()
  return media.value.filter(m => m.original.toLowerCase().includes(q) || (m.alt || '').toLowerCase().includes(q))
})

onMounted(async () => {
  try {
    const { data } = await api.get('/media')
    media.value = data
  } finally {
    loading.value = false
  }
})

async function uploadFiles(e) {
  const files = Array.from(e.target.files)
  if (!files.length) return
  uploading.value = true
  uploadProgress.value = 0
  const total = files.length
  let done = 0
  for (const file of files) {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/media', fd)
    media.value.unshift(data)
    done++
    uploadProgress.value = Math.round((done / total) * 100)
  }
  uploading.value = false
  e.target.value = ''
}

function confirm() {
  if (!picked.value) return
  emit('select', picked.value.url)
  emit('close')
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-panel {
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.08);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.modal-header h3 { margin: 0; font-size: 1rem; }

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem;
  line-height: 1;
  transition: color 0.2s;
}
.close-btn:hover { color: var(--text); }

.upload-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.search-input {
  flex: 1;
  height: 2rem;
  font-size: 0.85rem;
  padding: 0 0.75rem;
}

.progress-wrap {
  height: 3px;
  background: rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.media-card {
  cursor: pointer;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.1s;
  background: rgba(255,255,255,0.04);
}
.media-card:hover { border-color: rgba(255,255,255,0.2); transform: scale(1.02); }
.media-card.selected { border-color: var(--accent); }
.media-card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}
.media-name {
  font-size: 0.7rem;
  color: var(--text-muted);
  padding: 0.25rem 0.4rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty, .loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  padding: 2rem;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.picked-url {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.footer-btns { display: flex; gap: 0.5rem; flex-shrink: 0; }
</style>
