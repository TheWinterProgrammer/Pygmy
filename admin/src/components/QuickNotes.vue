<template>
  <div class="quick-notes glass">
    <div class="qn-header">
      <h3>📝 Quick Notes</h3>
      <button class="btn btn-ghost btn-sm" @click="showNew = !showNew">
        {{ showNew ? '✕ Cancel' : '+ New Note' }}
      </button>
    </div>

    <!-- New note form -->
    <div v-if="showNew" class="new-note-form">
      <textarea
        v-model="newContent"
        placeholder="Jot something down…"
        rows="3"
        class="note-input"
        @keydown.ctrl.enter="saveNew"
      ></textarea>
      <div class="color-row">
        <span class="color-label">Color:</span>
        <button
          v-for="c in colors"
          :key="c"
          class="color-btn"
          :class="[c, { active: newColor === c }]"
          @click="newColor = c"
        ></button>
        <button class="btn btn-primary btn-sm" :disabled="!newContent.trim()" @click="saveNew" style="margin-left:auto">
          Save
        </button>
      </div>
    </div>

    <!-- Notes list -->
    <div v-if="notes.length === 0 && !showNew" class="qn-empty">
      No notes yet. Click <em>+ New Note</em> to add one.
    </div>

    <div class="notes-list">
      <div
        v-for="note in notes"
        :key="note.id"
        class="note-card"
        :class="note.color"
      >
        <div v-if="editId !== note.id" class="note-body">
          <p class="note-text">{{ note.content }}</p>
          <div class="note-footer">
            <span class="note-date">{{ relTime(note.updated_at) }}</span>
            <div class="note-actions">
              <button class="icon-btn" :class="{ active: note.pinned }" @click="togglePin(note)" title="Pin">📌</button>
              <button class="icon-btn" @click="startEdit(note)" title="Edit">✏️</button>
              <button class="icon-btn danger" @click="deleteNote(note.id)" title="Delete">🗑️</button>
            </div>
          </div>
        </div>

        <!-- Inline edit -->
        <div v-else class="note-edit">
          <textarea v-model="editContent" rows="3" class="note-input" @keydown.ctrl.enter="saveEdit(note)"></textarea>
          <div class="color-row">
            <button
              v-for="c in colors"
              :key="c"
              class="color-btn"
              :class="[c, { active: editColor === c }]"
              @click="editColor = c"
            ></button>
            <button class="btn btn-primary btn-sm" @click="saveEdit(note)" style="margin-left:auto">Save</button>
            <button class="btn btn-ghost btn-sm" @click="editId = null">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const notes      = ref([])
const showNew    = ref(false)
const newContent = ref('')
const newColor   = ref('yellow')
const editId     = ref(null)
const editContent = ref('')
const editColor   = ref('yellow')

const colors = ['yellow', 'green', 'blue', 'pink', 'purple']

async function load() {
  try {
    const { data } = await api.get('/quick-notes')
    notes.value = data.notes || []
  } catch {}
}

async function saveNew() {
  if (!newContent.value.trim()) return
  try {
    const { data } = await api.post('/quick-notes', { content: newContent.value, color: newColor.value })
    notes.value.unshift(data.note)
    newContent.value = ''
    newColor.value   = 'yellow'
    showNew.value    = false
  } catch {}
}

function startEdit(note) {
  editId.value      = note.id
  editContent.value = note.content
  editColor.value   = note.color
}

async function saveEdit(note) {
  try {
    const { data } = await api.put(`/quick-notes/${note.id}`, { content: editContent.value, color: editColor.value })
    const idx = notes.value.findIndex(n => n.id === note.id)
    if (idx !== -1) notes.value[idx] = data.note
    editId.value = null
  } catch {}
}

async function togglePin(note) {
  try {
    const { data } = await api.put(`/quick-notes/${note.id}`, { pinned: !note.pinned })
    const idx = notes.value.findIndex(n => n.id === note.id)
    if (idx !== -1) notes.value[idx] = data.note
    // Re-sort: pinned first
    notes.value.sort((a, b) => b.pinned - a.pinned)
  } catch {}
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return
  try {
    await api.delete(`/quick-notes/${id}`)
    notes.value = notes.value.filter(n => n.id !== id)
  } catch {}
}

function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

onMounted(load)
</script>

<style scoped>
.quick-notes { padding: 1.25rem; border-radius: 1.25rem; }
.qn-header   { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.qn-header h3 { margin: 0; font-size: 0.95rem; }

.new-note-form { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.note-input {
  width: 100%; background: rgba(255,255,255,0.06); border: 1px solid var(--border);
  color: var(--text); border-radius: 0.5rem; padding: 0.6rem 0.75rem; font-size: 0.88rem;
  resize: vertical; font-family: inherit;
}
.note-input:focus { outline: none; border-color: var(--accent); }

.color-row { display: flex; align-items: center; gap: 0.4rem; }
.color-label { font-size: 0.78rem; color: var(--muted); }
.color-btn {
  width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent; cursor: pointer;
  transition: transform 0.1s;
}
.color-btn.active { border-color: #fff; transform: scale(1.25); }
.color-btn.yellow { background: #f59e0b; }
.color-btn.green  { background: #10b981; }
.color-btn.blue   { background: #4e88e6; }
.color-btn.pink   { background: #ec4899; }
.color-btn.purple { background: #8b5cf6; }

.qn-empty { font-size: 0.85rem; color: var(--muted); padding: 0.5rem 0; }

.notes-list { display: flex; flex-direction: column; gap: 0.6rem; max-height: 400px; overflow-y: auto; }

.note-card {
  border-radius: 0.75rem; padding: 0.75rem; border-left: 3px solid transparent;
}
.note-card.yellow { background: rgba(245,158,11,0.12); border-left-color: #f59e0b; }
.note-card.green  { background: rgba(16,185,129,0.12); border-left-color: #10b981; }
.note-card.blue   { background: rgba(78,136,230,0.12); border-left-color: #4e88e6; }
.note-card.pink   { background: rgba(236,72,153,0.12); border-left-color: #ec4899; }
.note-card.purple { background: rgba(139,92,246,0.12); border-left-color: #8b5cf6; }

.note-text { margin: 0 0 0.5rem; font-size: 0.87rem; white-space: pre-wrap; line-height: 1.5; }

.note-footer { display: flex; align-items: center; justify-content: space-between; }
.note-date   { font-size: 0.72rem; color: var(--muted); }
.note-actions { display: flex; gap: 0.15rem; }

.icon-btn {
  background: none; border: none; cursor: pointer; font-size: 0.85rem;
  padding: 0.2rem 0.3rem; border-radius: 0.25rem; opacity: 0.5;
  transition: opacity 0.15s;
}
.icon-btn:hover { opacity: 1; background: rgba(255,255,255,0.07); }
.icon-btn.active { opacity: 1; }
.icon-btn.danger:hover { background: rgba(var(--accent-rgb, 176,48,58),0.15); }

.btn-sm { padding: 0.25rem 0.6rem; font-size: 0.78rem; }
</style>
