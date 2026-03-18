<template>
  <div class="view-users">
    <div class="view-header">
      <div>
        <h1 class="view-title">Users</h1>
        <p class="view-sub">Manage admin accounts and editor access</p>
      </div>
      <button class="btn btn-accent" @click="openCreate">+ Invite User</button>
    </div>

    <!-- Table -->
    <div class="glass table-card">
      <div v-if="loading" class="loading-rows">
        <div v-for="n in 3" :key="n" class="skeleton skeleton-row" />
      </div>

      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>
              <div class="user-cell">
                <div class="user-avatar">{{ user.name?.[0] ?? '?' }}</div>
                <span>{{ user.name }}</span>
                <span v-if="user.id === currentUser?.id" class="badge badge-muted">you</span>
              </div>
            </td>
            <td class="text-muted">{{ user.email }}</td>
            <td>
              <span :class="['badge', user.role === 'admin' ? 'badge-accent' : 'badge-muted']">
                {{ user.role }}
              </span>
            </td>
            <td class="text-muted text-sm">{{ formatDate(user.created_at) }}</td>
            <td class="actions-cell">
              <button class="btn btn-sm btn-ghost" @click="openEdit(user)">Edit</button>
              <button
                class="btn btn-sm btn-danger"
                :disabled="user.id === currentUser?.id"
                @click="confirmDelete(user)"
              >Delete</button>
            </td>
          </tr>
          <tr v-if="!users.length">
            <td colspan="5" class="empty-row">No users found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card glass">
          <h2 class="modal-title">{{ modal.mode === 'create' ? 'Invite User' : 'Edit User' }}</h2>

          <div class="form-grid">
            <label class="form-label">
              Name
              <input v-model="form.name" class="input" placeholder="Display name" />
            </label>
            <label class="form-label">
              Email
              <input v-model="form.email" type="email" class="input" placeholder="user@example.com" />
            </label>
            <label class="form-label">
              Password
              <input
                v-model="form.password"
                type="password"
                class="input"
                :placeholder="modal.mode === 'edit' ? 'Leave blank to keep current' : 'Set a password'"
              />
            </label>
            <label class="form-label">
              Role
              <select v-model="form.role" class="input">
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>

          <p class="role-hint">
            <strong>Admin</strong> — full access including users & settings.<br>
            <strong>Editor</strong> — can manage content (pages, posts, products, media) but not users or settings.
          </p>

          <p v-if="modal.error" class="form-error">{{ modal.error }}</p>

          <div class="modal-actions">
            <button class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button class="btn btn-accent" :disabled="modal.saving" @click="saveUser">
              {{ modal.saving ? 'Saving…' : modal.mode === 'create' ? 'Create User' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal-card glass modal-sm">
          <h2 class="modal-title">Delete User</h2>
          <p class="text-muted">
            Remove <strong>{{ deleteTarget.name }}</strong> ({{ deleteTarget.email }})? This cannot be undone.
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import api from '../api.js'

const auth = useAuthStore()
const currentUser = auth.user

const users = ref([])
const loading = ref(true)
const deleteTarget = ref(null)

const modal = reactive({
  open: false,
  mode: 'create',
  editId: null,
  saving: false,
  error: '',
})

const form = reactive({ name: '', email: '', password: '', role: 'editor' })

async function load() {
  loading.value = true
  try {
    const res = await api.get('/users')
    users.value = res.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, { name: '', email: '', password: '', role: 'editor' })
  Object.assign(modal, { open: true, mode: 'create', editId: null, error: '' })
}

function openEdit(user) {
  Object.assign(form, { name: user.name, email: user.email, password: '', role: user.role })
  Object.assign(modal, { open: true, mode: 'edit', editId: user.id, error: '' })
}

function closeModal() {
  modal.open = false
}

async function saveUser() {
  modal.error = ''
  if (!form.name || !form.email) { modal.error = 'Name and email are required.'; return }
  if (modal.mode === 'create' && !form.password) { modal.error = 'Password is required for new users.'; return }

  modal.saving = true
  try {
    if (modal.mode === 'create') {
      await api.post('/users', form)
    } else {
      const payload = { name: form.name, email: form.email, role: form.role }
      if (form.password) payload.password = form.password
      await api.put(`/users/${modal.editId}`, payload)
    }
    closeModal()
    await load()
  } catch (err) {
    modal.error = err.response?.data?.error || 'Failed to save user.'
  } finally {
    modal.saving = false
  }
}

function confirmDelete(user) {
  deleteTarget.value = user
}

async function doDelete() {
  try {
    await api.delete(`/users/${deleteTarget.value.id}`)
    deleteTarget.value = null
    await load()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to delete user.')
  }
}

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.view-users { display: flex; flex-direction: column; gap: 1.5rem; }

.view-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
}
.view-title { font-size: 1.6rem; font-weight: 700; margin: 0; }
.view-sub   { color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0 0; }

.table-card { border-radius: var(--radius); overflow: hidden; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  text-align: left; padding: 0.8rem 1rem; font-size: 0.75rem;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.data-table td { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: rgba(255,255,255,0.02); }

.user-cell { display: flex; align-items: center; gap: 0.6rem; }
.user-avatar {
  width: 30px; height: 30px; border-radius: 50%; background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.85rem; color: #fff; flex-shrink: 0;
}

.actions-cell { display: flex; gap: 0.4rem; justify-content: flex-end; }
.empty-row { text-align: center; color: var(--text-muted); padding: 2.5rem !important; }

.text-muted { color: var(--text-muted); }
.text-sm    { font-size: 0.8rem; }

.badge { display: inline-flex; align-items: center; padding: 0.15rem 0.55rem; border-radius: 2rem; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.badge-accent { background: hsl(355,70%,20%); color: var(--accent); }
.badge-muted  { background: var(--glass-bg); color: var(--text-muted); }

.btn-danger { background: hsl(355,70%,20%); color: hsl(355,70%,65%); }
.btn-danger:hover:not(:disabled) { background: hsl(355,70%,25%); }
.btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

.skeleton-row { height: 52px; margin: 0.25rem; border-radius: var(--radius-sm); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 1rem;
}
.modal-card {
  width: 100%; max-width: 480px; padding: 2rem; border-radius: var(--radius); display: flex; flex-direction: column; gap: 1.25rem;
}
.modal-sm { max-width: 380px; }
.modal-title { font-size: 1.1rem; font-weight: 700; margin: 0; }
.modal-actions { display: flex; gap: 0.6rem; justify-content: flex-end; }

.form-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.form-label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.83rem; color: var(--text-muted); font-weight: 500; }
.form-error { color: hsl(355,70%,65%); font-size: 0.83rem; }

.role-hint {
  font-size: 0.78rem; color: var(--text-muted);
  background: var(--glass-bg); border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem; line-height: 1.6;
  border: 1px solid var(--border);
}
.role-hint strong { color: var(--text); }

.loading-rows { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }
</style>
