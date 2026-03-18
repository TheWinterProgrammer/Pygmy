<template>
  <div>
    <div class="page-header">
      <h1>🔀 Redirects</h1>
      <button class="btn btn-primary" @click="openAdd">+ Add Redirect</button>
    </div>

    <div class="glass section">
      <p class="help-text">
        Manage 301/302 redirects for your site. Useful for SEO when you rename pages or move content.
        <br>The <strong>From path</strong> is matched against the requested URL path (e.g. <code>/old-page</code>).
      </p>

      <div v-if="loading" class="loading-row">Loading…</div>
      <div v-else-if="redirects.length === 0" class="empty-state">
        No redirects yet. Add your first one above.
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>From Path</th>
            <th>To Path</th>
            <th>Type</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in redirects" :key="r.id">
            <td class="mono">{{ r.from_path }}</td>
            <td class="mono to-path">
              <span v-if="r.to_path.startsWith('http')">
                <a :href="r.to_path" target="_blank" class="ext-link">{{ r.to_path }}</a>
              </span>
              <span v-else>{{ r.to_path }}</span>
            </td>
            <td>
              <span class="badge" :class="r.type === '301' ? 'badge-301' : 'badge-302'">
                {{ r.type }} {{ r.type === '301' ? 'Permanent' : 'Temporary' }}
              </span>
            </td>
            <td class="text-muted">{{ formatDate(r.created_at) }}</td>
            <td class="actions">
              <button class="btn btn-ghost btn-sm" @click="openEdit(r)">Edit</button>
              <button class="btn btn-danger btn-sm" @click="confirmDelete(r)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <div class="modal-overlay" v-if="modal.open" @click.self="modal.open = false">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ modal.editing ? 'Edit Redirect' : 'Add Redirect' }}</h2>
          <button class="btn-close" @click="modal.open = false">✕</button>
        </div>

        <form @submit.prevent="saveRedirect">
          <div class="form-group">
            <label>From Path <span class="required">*</span></label>
            <input
              v-model="modal.form.from_path"
              class="input"
              placeholder="/old-page-slug"
              required
            />
            <small class="field-hint">Must start with <code>/</code> — e.g. <code>/old-about</code></small>
          </div>

          <div class="form-group">
            <label>To Path / URL <span class="required">*</span></label>
            <input
              v-model="modal.form.to_path"
              class="input"
              placeholder="/new-page-slug or https://example.com"
              required
            />
            <small class="field-hint">Can be a relative path or a full external URL.</small>
          </div>

          <div class="form-group">
            <label>Redirect Type</label>
            <select v-model="modal.form.type" class="input">
              <option value="301">301 — Permanent (recommended for SEO)</option>
              <option value="302">302 — Temporary</option>
            </select>
          </div>

          <div v-if="modal.error" class="error-msg">{{ modal.error }}</div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="modal.open = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="modal.saving">
              {{ modal.saving ? 'Saving…' : (modal.editing ? 'Update' : 'Add Redirect') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass confirm-modal">
        <h2>Delete Redirect?</h2>
        <p>Are you sure you want to delete the redirect from <code>{{ deleteTarget.from_path }}</code>?</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete" :disabled="deleting">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const redirects = ref([])
const loading = ref(true)
const deleteTarget = ref(null)
const deleting = ref(false)

const modal = reactive({
  open: false,
  editing: null,
  saving: false,
  error: '',
  form: { from_path: '', to_path: '', type: '301' }
})

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/redirects')
    redirects.value = data
  } catch {
    toast.error('Failed to load redirects')
  }
  loading.value = false
}

function openAdd() {
  modal.editing = null
  modal.form = { from_path: '', to_path: '', type: '301' }
  modal.error = ''
  modal.open = true
}

function openEdit(r) {
  modal.editing = r
  modal.form = { from_path: r.from_path, to_path: r.to_path, type: r.type }
  modal.error = ''
  modal.open = true
}

async function saveRedirect() {
  modal.saving = true
  modal.error = ''
  try {
    if (modal.editing) {
      await api.put(`/redirects/${modal.editing.id}`, modal.form)
      toast.success('Redirect updated')
    } else {
      await api.post('/redirects', modal.form)
      toast.success('Redirect added')
    }
    modal.open = false
    await load()
  } catch (err) {
    modal.error = err.response?.data?.error || 'Failed to save redirect'
  }
  modal.saving = false
}

function confirmDelete(r) {
  deleteTarget.value = r
}

async function doDelete() {
  deleting.value = true
  try {
    await api.delete(`/redirects/${deleteTarget.value.id}`)
    toast.success('Redirect deleted')
    deleteTarget.value = null
    await load()
  } catch {
    toast.error('Failed to delete redirect')
  }
  deleting.value = false
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }

.help-text {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-bottom: 1.25rem;
  line-height: 1.6;
}
.help-text code {
  background: rgba(255,255,255,0.08);
  border-radius: 0.25rem;
  padding: 0.1em 0.35em;
  font-size: 0.9em;
}

.section { padding: 1.5rem; }

.mono { font-family: 'Courier New', monospace; font-size: 0.85rem; }
.to-path { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ext-link { color: var(--accent); text-decoration: none; }
.ext-link:hover { text-decoration: underline; }
.text-muted { color: var(--text-muted); font-size: 0.82rem; }

.badge-301 { background: hsl(142,50%,20%); color: hsl(142,70%,60%); }
.badge-302 { background: hsl(220,50%,20%); color: hsl(220,70%,70%); }

.actions { display: flex; gap: 0.4rem; justify-content: flex-end; white-space: nowrap; }

.loading-row { color: var(--text-muted); padding: 1rem 0; }
.empty-state  { color: var(--text-muted); padding: 1rem 0; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal {
  width: 500px; max-width: 95vw;
  border-radius: 1.25rem;
  padding: 2rem;
}
.confirm-modal { max-width: 400px; }

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.5rem;
}
.modal-header h2 { margin: 0; font-size: 1.2rem; }
.btn-close {
  background: none; border: none; color: var(--text-muted);
  font-size: 1rem; cursor: pointer;
}
.btn-close:hover { color: var(--text); }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.85rem; margin-bottom: 0.4rem; }
.required { color: var(--accent); }
.field-hint { display: block; margin-top: 0.3rem; font-size: 0.75rem; color: var(--text-muted); }
.field-hint code { background: rgba(255,255,255,0.08); border-radius: 0.2rem; padding: 0.1em 0.3em; }

.error-msg { color: var(--accent); font-size: 0.85rem; margin: 0.75rem 0; }

.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.modal-footer p { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; }
.confirm-modal p code {
  background: rgba(255,255,255,0.08);
  border-radius: 0.2rem;
  padding: 0.1em 0.35em;
  font-size: 0.9em;
  color: var(--accent);
}
</style>
