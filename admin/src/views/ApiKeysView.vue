<template>
  <div class="api-keys-view">
    <div class="view-header">
      <div>
        <h1>🔑 API Keys</h1>
        <p class="subtitle">Create API keys for headless CMS integrations. Keys are shown only once — store them securely.</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ New Key</button>
    </div>

    <!-- Keys table -->
    <div class="glass section">
      <div v-if="loading" class="empty-state">Loading…</div>
      <div v-else-if="!keys.length" class="empty-state">
        No API keys yet. Create one to integrate with external apps.
      </div>
      <table v-else class="keys-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Key prefix</th>
            <th>Scopes</th>
            <th>Created by</th>
            <th>Last used</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="k in keys" :key="k.id" :class="{ inactive: !k.active }">
            <td class="key-name">{{ k.name }}</td>
            <td><code class="prefix">{{ k.key_prefix }}…</code></td>
            <td>
              <span v-for="s in k.scopes" :key="s" :class="['scope-badge', s]">{{ s }}</span>
            </td>
            <td class="muted">{{ k.created_by_name || '—' }}</td>
            <td class="muted">{{ k.last_used_at ? timeAgo(k.last_used_at) : 'Never' }}</td>
            <td>
              <button
                class="status-pill"
                :class="k.active ? 'active' : 'inactive'"
                @click="toggleActive(k)"
                :title="k.active ? 'Click to revoke' : 'Click to reactivate'"
              >
                {{ k.active ? 'Active' : 'Revoked' }}
              </button>
            </td>
            <td class="actions">
              <button class="btn btn-ghost btn-sm" @click="openRotate(k)" title="Rotate key">🔄</button>
              <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(k)" title="Delete key">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Info -->
    <div class="glass section info-section">
      <h2>ℹ️ Using API Keys</h2>
      <div class="info-grid">
        <div>
          <h3>Authentication</h3>
          <p>Include your API key as a header:</p>
          <pre class="code-block">X-Api-Key: pgk_your_key_here</pre>
        </div>
        <div>
          <h3>Scopes</h3>
          <ul class="scope-list">
            <li><span class="scope-badge read">read</span> — GET requests (list, fetch)</li>
            <li><span class="scope-badge write">write</span> — POST, PUT, DELETE mutations</li>
          </ul>
        </div>
        <div>
          <h3>Rate limits</h3>
          <p>API key requests bypass public rate limits. Auth-guarded admin endpoints require the associated user to have appropriate role.</p>
        </div>
        <div>
          <h3>Security</h3>
          <p>Keys are hashed with SHA-256 before storage. The raw key is shown only once — rotate immediately if compromised.</p>
        </div>
      </div>
    </div>

    <!-- ── Create modal ──────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="modal.create" class="modal-backdrop" @click.self="modal.create = false">
        <div class="modal glass">
          <h2>Create API Key</h2>
          <div class="form-group">
            <label>Name <span class="req">*</span></label>
            <input v-model="form.name" class="input" placeholder="e.g. Mobile App, Zapier, CI Bot" @keyup.enter="createKey" />
          </div>
          <div class="form-group">
            <label>Scopes</label>
            <div class="scope-checkboxes">
              <label class="check-row">
                <input type="checkbox" v-model="form.scopes" value="read" /> read
                <span class="check-hint">— list/fetch content via GET</span>
              </label>
              <label class="check-row">
                <input type="checkbox" v-model="form.scopes" value="write" /> write
                <span class="check-hint">— create/update/delete via POST/PUT/DELETE</span>
              </label>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="modal.create = false">Cancel</button>
            <button class="btn btn-primary" @click="createKey" :disabled="creating || !form.name.trim()">
              {{ creating ? 'Generating…' : 'Generate Key' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── New key reveal ───────────────────────────────────────────────────── -->
      <div v-if="modal.reveal" class="modal-backdrop">
        <div class="modal glass reveal-modal">
          <div class="reveal-icon">🎉</div>
          <h2>API Key Created</h2>
          <p class="reveal-warning">⚠️ Copy this key now — it will not be shown again.</p>
          <div class="key-display" @click="copyKey(newKeyValue)">
            <code>{{ newKeyValue }}</code>
            <span class="copy-hint">{{ copied ? '✓ Copied!' : 'Click to copy' }}</span>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:1rem" @click="modal.reveal = false">
            I've saved the key
          </button>
        </div>
      </div>

      <!-- ── Rotate confirm ────────────────────────────────────────────────────── -->
      <div v-if="modal.rotate" class="modal-backdrop" @click.self="modal.rotate = false">
        <div class="modal glass">
          <h2>Rotate Key — {{ rotatingKey?.name }}</h2>
          <p>This generates a new random key and <strong>invalidates the current one immediately</strong>. Any integrations using the current key will stop working.</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="modal.rotate = false">Cancel</button>
            <button class="btn btn-primary" @click="rotateKey" :disabled="rotating">
              {{ rotating ? 'Rotating…' : 'Rotate Key' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Delete confirm ────────────────────────────────────────────────────── -->
      <div v-if="modal.delete" class="modal-backdrop" @click.self="modal.delete = false">
        <div class="modal glass">
          <h2>Delete API Key</h2>
          <p>Delete <strong>{{ deletingKey?.name }}</strong>? This action cannot be undone and will immediately break any integrations using it.</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="modal.delete = false">Cancel</button>
            <button class="btn btn-danger" @click="deleteKey">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'

const auth  = useAuthStore()
const toast = useToastStore()
const BASE  = 'http://localhost:3200'

const keys    = ref([])
const loading = ref(true)

const modal = reactive({ create: false, reveal: false, rotate: false, delete: false })
const form  = reactive({ name: '', scopes: ['read'] })
const creating   = ref(false)
const rotating   = ref(false)
const copied     = ref(false)
const newKeyValue  = ref('')
const rotatingKey  = ref(null)
const deletingKey  = ref(null)

// ── Helpers ───────────────────────────────────────────────────────────────────
const headers = () => ({ Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' })

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

async function copyKey(val) {
  await navigator.clipboard.writeText(val)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const res = await fetch(`${BASE}/api/api-keys`, { headers: headers() })
    keys.value = await res.json()
  } catch (e) {
    toast.error('Failed to load API keys')
  } finally {
    loading.value = false
  }
}

// ── Create ────────────────────────────────────────────────────────────────────
function openCreate() {
  form.name = ''
  form.scopes = ['read']
  modal.create = true
}

async function createKey() {
  if (!form.name.trim()) return
  creating.value = true
  try {
    const res = await fetch(`${BASE}/api/api-keys`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: form.name.trim(), scopes: form.scopes }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    modal.create = false
    newKeyValue.value = data.key
    modal.reveal = true
    copied.value = false
    toast.success('API key created!')
    load()
  } catch (e) {
    toast.error(e.message || 'Failed to create key')
  } finally {
    creating.value = false
  }
}

// ── Toggle active ─────────────────────────────────────────────────────────────
async function toggleActive(k) {
  try {
    const res = await fetch(`${BASE}/api/api-keys/${k.id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ active: !k.active }),
    })
    if (!res.ok) throw new Error('Failed')
    k.active = !k.active
    toast.success(k.active ? 'Key reactivated' : 'Key revoked')
  } catch {
    toast.error('Failed to update key')
  }
}

// ── Rotate ────────────────────────────────────────────────────────────────────
function openRotate(k) {
  rotatingKey.value = k
  modal.rotate = true
}

async function rotateKey() {
  rotating.value = true
  try {
    const res = await fetch(`${BASE}/api/api-keys/${rotatingKey.value.id}/rotate`, {
      method: 'POST', headers: headers(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    modal.rotate = false
    newKeyValue.value = data.key
    modal.reveal = true
    copied.value = false
    toast.success('Key rotated! Copy the new key.')
    load()
  } catch (e) {
    toast.error(e.message || 'Failed to rotate key')
  } finally {
    rotating.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
function confirmDelete(k) {
  deletingKey.value = k
  modal.delete = true
}

async function deleteKey() {
  try {
    const res = await fetch(`${BASE}/api/api-keys/${deletingKey.value.id}`, {
      method: 'DELETE', headers: headers(),
    })
    if (!res.ok) throw new Error('Failed')
    modal.delete = false
    toast.success('API key deleted')
    load()
  } catch {
    toast.error('Failed to delete key')
  }
}

onMounted(load)
</script>

<style scoped>
.api-keys-view { padding: 2rem; max-width: 900px; }

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}
.view-header h1 { margin: 0 0 0.2rem; font-size: 1.6rem; }
.subtitle { margin: 0; color: var(--muted); font-size: 0.85rem; }

.section { border-radius: 1.2rem; padding: 1.5rem; margin-bottom: 1rem; }
.section h2 { margin: 0 0 1rem; font-size: 1.05rem; }

.empty-state { text-align: center; padding: 3rem; color: var(--muted); }

/* Table */
.keys-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.keys-table th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0 0.75rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.keys-table td {
  padding: 0.85rem 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  vertical-align: middle;
}
.keys-table tr.inactive td { opacity: 0.5; }
.key-name { font-weight: 600; }
.muted { color: var(--muted); }

.prefix {
  background: rgba(255,255,255,0.06);
  border-radius: 0.3rem;
  padding: 0.15rem 0.45rem;
  font-size: 0.82rem;
  color: var(--accent);
  font-family: monospace;
}

.scope-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 600;
  margin-right: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.scope-badge.read  { background: rgba(60,180,120,0.18); color: hsl(150,60%,55%); }
.scope-badge.write { background: rgba(200,100,50,0.18); color: hsl(25,75%,60%); }

.status-pill {
  border: none;
  border-radius: 99px;
  padding: 0.2rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.status-pill:hover { opacity: 0.75; }
.status-pill.active   { background: rgba(60,180,120,0.2); color: hsl(150,60%,55%); }
.status-pill.inactive { background: rgba(255,255,255,0.06); color: var(--muted); }

.actions { display: flex; gap: 0.25rem; }
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; }
.danger:hover { color: hsl(0,70%,60%); }

/* Info section */
.info-section { background: rgba(255,255,255,0.03); }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.info-grid h3 { margin: 0 0 0.4rem; font-size: 0.9rem; font-weight: 600; }
.info-grid p, .info-grid li { color: var(--muted); font-size: 0.82rem; line-height: 1.6; margin: 0; }
.code-block {
  background: rgba(255,255,255,0.06);
  border-radius: 0.4rem;
  padding: 0.5rem 0.75rem;
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--accent);
  margin-top: 0.35rem;
  display: block;
  word-break: break-all;
}
.scope-list { padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }

/* Modals */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal {
  background: var(--surface);
  border-radius: 1.2rem;
  padding: 2rem;
  width: 100%;
  max-width: 480px;
  border: 1px solid rgba(255,255,255,0.1);
}
.modal h2 { margin: 0 0 1.25rem; font-size: 1.1rem; }
.modal p { color: var(--muted); font-size: 0.88rem; line-height: 1.6; margin: 0 0 0.75rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 0.35rem; }
.req { color: var(--accent); }
.input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.5rem;
  color: var(--text);
  padding: 0.55rem 0.75rem;
  font-size: 0.9rem;
  font-family: inherit;
}

.scope-checkboxes { display: flex; flex-direction: column; gap: 0.5rem; }
.check-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  cursor: pointer;
}
.check-hint { color: var(--muted); font-size: 0.78rem; }

/* Reveal modal */
.reveal-modal { text-align: center; }
.reveal-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.reveal-warning {
  background: rgba(240,180,50,0.1);
  border: 1px solid rgba(240,180,50,0.3);
  border-radius: 0.5rem;
  padding: 0.6rem 1rem;
  color: hsl(40,85%,65%);
  font-size: 0.85rem;
  margin: 0.75rem 0 1rem;
}
.key-display {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.6rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
  word-break: break-all;
}
.key-display:hover { background: rgba(255,255,255,0.09); }
.key-display code { font-family: monospace; font-size: 0.85rem; color: var(--accent); display: block; margin-bottom: 0.4rem; }
.copy-hint { font-size: 0.75rem; color: var(--muted); }

.btn-danger {
  background: hsl(0,65%,48%);
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 600;
}
.btn-danger:hover { background: hsl(0,65%,42%); }
</style>
