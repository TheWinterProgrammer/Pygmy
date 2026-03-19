<template>
  <div class="forms-view">
    <div class="view-header">
      <h1>📋 Forms</h1>
      <RouterLink to="/forms/new" class="btn-accent">+ New Form</RouterLink>
    </div>

    <div v-if="loading" class="loading">Loading forms…</div>
    <div v-else-if="forms.length === 0" class="empty-state glass">
      <div class="empty-icon">📋</div>
      <p>No forms yet. Create your first custom form!</p>
      <RouterLink to="/forms/new" class="btn-accent">+ New Form</RouterLink>
    </div>

    <div v-else class="forms-grid">
      <div
        v-for="form in forms"
        :key="form.id"
        class="form-card glass"
      >
        <div class="form-card-header">
          <div class="form-meta">
            <h3>{{ form.name }}</h3>
            <span class="slug-badge">/forms/{{ form.slug }}</span>
          </div>
          <span :class="['status-badge', form.status]">{{ form.status }}</span>
        </div>

        <p v-if="form.description" class="form-desc">{{ form.description }}</p>

        <div class="form-stats">
          <span class="stat">
            <strong>{{ form.total_submissions }}</strong> submission{{ form.total_submissions !== 1 ? 's' : '' }}
            <span v-if="form.unread_count > 0" class="unread-badge">{{ form.unread_count }} new</span>
          </span>
          <span class="stat">{{ fieldCount(form) }} field{{ fieldCount(form) !== 1 ? 's' : '' }}</span>
        </div>

        <div class="form-actions">
          <RouterLink :to="`/forms/${form.id}`" class="btn-sm">✏️ Edit</RouterLink>
          <RouterLink :to="`/forms/${form.id}/submissions`" class="btn-sm">
            📥 Submissions
            <span v-if="form.unread_count > 0" class="badge-count">{{ form.unread_count }}</span>
          </RouterLink>
          <button @click="copyEmbedCode(form)" class="btn-sm">🔗 Embed</button>
          <button @click="confirmDelete(form)" class="btn-sm danger">🗑️</button>
        </div>
      </div>
    </div>

    <!-- Embed code modal -->
    <Teleport to="body">
      <div v-if="embedForm" class="modal-backdrop" @click.self="embedForm = null">
        <div class="modal glass">
          <div class="modal-header">
            <h2>🔗 Embed "{{ embedForm.name }}"</h2>
            <button @click="embedForm = null" class="close-btn">✕</button>
          </div>
          <div class="modal-body">
            <p class="hint">Add this form to any page using the frontend URL or by embedding the iframe:</p>
            <label>Direct URL</label>
            <div class="embed-row">
              <input :value="`http://localhost:5174/forms/${embedForm.slug}`" readonly class="embed-input" />
              <button @click="copy(`http://localhost:5174/forms/${embedForm.slug}`)" class="btn-sm">Copy</button>
            </div>
            <label>Iframe embed</label>
            <div class="embed-row">
              <textarea :value="iframeCode(embedForm)" readonly class="embed-textarea" rows="3"></textarea>
              <button @click="copy(iframeCode(embedForm))" class="btn-sm">Copy</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm modal -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
        <div class="modal glass">
          <div class="modal-header">
            <h2>Delete Form</h2>
            <button @click="deleteTarget = null" class="close-btn">✕</button>
          </div>
          <div class="modal-body">
            <p>Delete <strong>{{ deleteTarget.name }}</strong>? All submissions will also be deleted. This cannot be undone.</p>
            <div class="modal-footer">
              <button @click="deleteTarget = null" class="btn-ghost">Cancel</button>
              <button @click="doDelete" class="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useToastStore } from '../stores/toast.js'
import api from '../api.js'

const forms = ref([])
const loading = ref(true)
const deleteTarget = ref(null)
const embedForm = ref(null)
const toast = useToastStore()

async function load () {
  loading.value = true
  try {
    const res = await api.get('/forms?all=1')
    forms.value = res.data
  } catch { toast.error('Failed to load forms') }
  finally { loading.value = false }
}

function fieldCount (form) {
  try { return JSON.parse(form.fields || '[]').length } catch { return 0 }
}

function confirmDelete (form) { deleteTarget.value = form }
async function doDelete () {
  try {
    await api.delete(`/forms/${deleteTarget.value.id}`)
    toast.success('Form deleted')
    deleteTarget.value = null
    load()
  } catch { toast.error('Delete failed') }
}

function copyEmbedCode (form) { embedForm.value = form }
function iframeCode (form) {
  return `<iframe src="http://localhost:5174/forms/${form.slug}" width="100%" height="600" frameborder="0" style="border:none"></iframe>`
}
async function copy (text) {
  await navigator.clipboard.writeText(text)
  toast.success('Copied!')
}

onMounted(load)
</script>

<style scoped>
.view-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; }
.view-header h1 { margin:0; }
.btn-accent { background:var(--accent); color:#fff; border:none; padding:.55rem 1.2rem; border-radius:.6rem; cursor:pointer; text-decoration:none; font-weight:600; font-size:.9rem; }
.loading { color:var(--muted); text-align:center; padding:3rem; }
.empty-state { text-align:center; padding:3rem; border-radius:1.5rem; }
.empty-icon { font-size:3rem; margin-bottom:1rem; }
.empty-state p { color:var(--muted); margin-bottom:1.5rem; }

.forms-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:1.2rem; }
.form-card { padding:1.4rem; border-radius:1.2rem; display:flex; flex-direction:column; gap:.8rem; }
.form-card-header { display:flex; justify-content:space-between; align-items:flex-start; }
.form-meta h3 { margin:0 0 .25rem; font-size:1.05rem; }
.slug-badge { font-size:.72rem; color:var(--muted); font-family:monospace; background:rgba(255,255,255,.06); padding:.15rem .5rem; border-radius:.4rem; }
.status-badge { font-size:.7rem; font-weight:700; text-transform:uppercase; padding:.2rem .6rem; border-radius:.4rem; }
.status-badge.active { background:rgba(34,197,94,.15); color:#22c55e; }
.status-badge.inactive { background:rgba(255,255,255,.08); color:var(--muted); }
.form-desc { color:var(--muted); font-size:.875rem; margin:0; }
.form-stats { display:flex; gap:1.5rem; font-size:.8rem; color:var(--muted); }
.form-stats strong { color:var(--text); }
.unread-badge { background:var(--accent); color:#fff; font-size:.65rem; font-weight:700; padding:.1rem .4rem; border-radius:.4rem; margin-left:.4rem; }
.form-actions { display:flex; gap:.5rem; flex-wrap:wrap; }
.btn-sm { background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.35rem .75rem; border-radius:.5rem; cursor:pointer; font-size:.8rem; text-decoration:none; display:inline-flex; align-items:center; gap:.3rem; transition:.15s; }
.btn-sm:hover { background:rgba(255,255,255,.14); }
.btn-sm.danger:hover { background:rgba(239,68,68,.2); border-color:rgba(239,68,68,.4); color:#f87171; }
.badge-count { background:var(--accent); color:#fff; font-size:.6rem; padding:.1rem .4rem; border-radius:.4rem; font-weight:700; }

/* Modals */
.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:100; display:flex; align-items:center; justify-content:center; }
.modal { width:min(520px,95vw); border-radius:1.5rem; padding:0; overflow:hidden; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:1.2rem 1.5rem; border-bottom:1px solid rgba(255,255,255,.08); }
.modal-header h2 { margin:0; font-size:1.1rem; }
.close-btn { background:none; border:none; color:var(--muted); font-size:1.2rem; cursor:pointer; }
.modal-body { padding:1.5rem; display:flex; flex-direction:column; gap:1rem; }
.modal-body p { margin:0; color:var(--muted); }
.modal-body label { font-size:.85rem; color:var(--muted); font-weight:600; }
.hint { font-size:.85rem; }
.embed-row { display:flex; gap:.5rem; align-items:flex-start; }
.embed-input { flex:1; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.5rem .75rem; border-radius:.5rem; font-size:.8rem; font-family:monospace; }
.embed-textarea { flex:1; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.5rem .75rem; border-radius:.5rem; font-size:.75rem; font-family:monospace; resize:vertical; }
.modal-footer { display:flex; justify-content:flex-end; gap:.75rem; margin-top:.5rem; }
.btn-ghost { background:transparent; border:1px solid rgba(255,255,255,.15); color:var(--muted); padding:.5rem 1.1rem; border-radius:.6rem; cursor:pointer; }
.btn-danger { background:hsl(0,70%,50%); border:none; color:#fff; padding:.5rem 1.1rem; border-radius:.6rem; cursor:pointer; font-weight:600; }
</style>
