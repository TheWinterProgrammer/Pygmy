<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-box glass">
      <div class="modal-header">
        <h2>🕓 Revision History</h2>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div v-if="loading" class="loading-state">Loading revisions…</div>
        <div v-else-if="revisions.length === 0" class="empty-state">
          <p>No saved revisions yet.</p>
          <small>A revision is saved every time you update this content.</small>
        </div>
        <div v-else class="revisions-list">
          <div
            v-for="rev in revisions"
            :key="rev.id"
            class="revision-row"
            :class="{ 'selected': selected?.id === rev.id }"
            @click="select(rev)"
          >
            <div class="rev-icon">📄</div>
            <div class="rev-info">
              <div class="rev-title">{{ formatDate(rev.created_at) }}</div>
              <div class="rev-meta">
                <span v-if="rev.user_name" class="rev-user">by {{ rev.user_name }}</span>
                <span class="rev-ago">{{ timeAgo(rev.created_at) }}</span>
              </div>
            </div>
            <button
              v-if="selected?.id === rev.id"
              class="btn btn-primary btn-sm restore-btn"
              @click.stop="restore"
            >Restore</button>
          </div>
        </div>

        <!-- Preview panel -->
        <div v-if="preview" class="preview-panel glass">
          <div class="preview-header">
            <h3>Preview — {{ formatDate(selected?.created_at) }}</h3>
          </div>
          <div class="preview-fields">
            <div v-for="(val, key) in previewFields" :key="key" class="preview-field">
              <div class="field-key">{{ key }}</div>
              <div class="field-val">
                <span v-if="isLong(val)" class="long-val" v-html="truncate(val)"></span>
                <span v-else>{{ val ?? '—' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <span class="rev-count" v-if="revisions.length">{{ revisions.length }} revision{{ revisions.length !== 1 ? 's' : '' }} saved (max 20)</span>
        <button class="btn btn-ghost" @click="$emit('close')">Close</button>
        <button
          v-if="selected"
          class="btn btn-primary"
          @click="restore"
        >⏮ Restore this revision</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const props = defineProps({
  entityType: { type: String, required: true }, // 'post' | 'page'
  entityId:   { type: [Number, String], required: true },
})

const emit = defineEmits(['close', 'restore'])

const auth = useAuthStore()
const revisions = ref([])
const selected = ref(null)
const preview = ref(null)
const loading = ref(true)

const SKIP_KEYS = new Set(['content', 'id', 'created_at', 'updated_at'])

const previewFields = computed(() => {
  if (!preview.value) return {}
  const out = {}
  for (const [k, v] of Object.entries(preview.value)) {
    if (SKIP_KEYS.has(k)) continue
    out[k] = Array.isArray(v) ? v.join(', ') : v
  }
  return out
})

function isLong(val) {
  return typeof val === 'string' && val.length > 120
}

function truncate(val) {
  return val?.slice(0, 200) + (val?.length > 200 ? '…' : '')
}

async function load() {
  loading.value = true
  const res = await fetch(
    `http://localhost:3200/api/revisions?entity_type=${props.entityType}&entity_id=${props.entityId}`,
    { headers: { Authorization: `Bearer ${auth.token}` } }
  )
  revisions.value = await res.json()
  loading.value = false
}

async function select(rev) {
  if (selected.value?.id === rev.id) {
    selected.value = null
    preview.value = null
    return
  }
  selected.value = rev
  // Fetch full snapshot
  const res = await fetch(`http://localhost:3200/api/revisions/${rev.id}`, {
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  const data = await res.json()
  preview.value = data.snapshot
}

function restore() {
  if (!preview.value) return
  emit('restore', preview.value)
  emit('close')
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

onMounted(load)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 1rem;
}

.modal-box {
  width: 100%;
  max-width: 720px;
  max-height: 85vh;
  border-radius: 1.25rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  transition: color 0.2s;
}
.close-btn:hover { color: var(--text); }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--muted);
}
.empty-state small { display: block; margin-top: 0.5rem; font-size: 0.8rem; }

.revisions-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.revision-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.revision-row:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.12);
}
.revision-row.selected {
  background: rgba(var(--accent-rgb, 205, 57, 70), 0.1);
  border-color: var(--accent);
}

.rev-icon { font-size: 1.2rem; flex-shrink: 0; }
.rev-info { flex: 1; min-width: 0; }
.rev-title { font-size: 0.9rem; font-weight: 500; }
.rev-meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: var(--muted); margin-top: 0.2rem; }

.restore-btn { flex-shrink: 0; }

/* Preview */
.preview-panel {
  border-radius: 1rem;
  padding: 1rem 1.25rem;
}
.preview-header h3 { margin: 0 0 0.75rem; font-size: 0.9rem; color: var(--muted); }
.preview-fields { display: flex; flex-direction: column; gap: 0.5rem; }
.preview-field {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 0.5rem;
  font-size: 0.82rem;
}
.field-key { color: var(--muted); font-weight: 500; padding-top: 0.1rem; }
.field-val { word-break: break-word; }
.long-val { color: var(--muted); font-style: italic; }

.modal-footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.rev-count { flex: 1; font-size: 0.8rem; color: var(--muted); }
</style>
