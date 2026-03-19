<template>
  <div class="webhooks-view">
    <div class="page-header">
      <h1>🔗 Webhooks</h1>
      <button class="btn btn-primary" @click="openNew">+ Add Webhook</button>
    </div>

    <p class="page-desc">
      Webhooks let Pygmy notify external services whenever content events occur (post published, form submitted, etc.).
      Each delivery is signed with HMAC-SHA256 if you provide a secret.
    </p>

    <!-- List -->
    <div v-if="loading" class="loading">Loading…</div>

    <div v-else-if="!hooks.length" class="empty-state glass">
      <div class="empty-icon">🔗</div>
      <h3>No webhooks yet</h3>
      <p>Add a webhook to push events to Zapier, Make, n8n, Slack, or your own endpoint.</p>
      <button class="btn btn-primary" @click="openNew">+ Add Webhook</button>
    </div>

    <div v-else class="hooks-list">
      <div v-for="hook in hooks" :key="hook.id" class="hook-card glass" :class="{ inactive: !hook.active }">
        <div class="hook-top">
          <div class="hook-info">
            <div class="hook-name">
              <span class="active-dot" :class="hook.active ? 'on' : 'off'"></span>
              {{ hook.name }}
            </div>
            <div class="hook-url">{{ hook.url }}</div>
          </div>
          <div class="hook-actions">
            <button class="btn btn-ghost btn-sm" @click="testHook(hook)" :disabled="testing === hook.id" title="Send a test delivery">
              {{ testing === hook.id ? '…' : '🧪 Test' }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="openEdit(hook)">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(hook)">🗑</button>
          </div>
        </div>

        <div class="hook-events">
          <span v-for="ev in hook.events" :key="ev" class="event-badge">{{ ev }}</span>
          <span v-if="!hook.events.length" class="muted-sm">No events selected</span>
        </div>

        <div class="hook-status" v-if="hook.last_triggered_at">
          <span class="status-label">Last delivery:</span>
          {{ fmtDate(hook.last_triggered_at) }}
          <span v-if="hook.last_status" class="status-code" :class="hook.last_status < 300 ? 'ok' : 'err'">
            HTTP {{ hook.last_status }}
          </span>
          <span v-if="hook.last_error" class="status-error" :title="hook.last_error">⚠ Error</span>
        </div>
      </div>
    </div>

    <!-- Modal: add/edit -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal glass">
        <h2>{{ editing ? 'Edit Webhook' : 'New Webhook' }}</h2>

        <div class="form-group">
          <label>Name <span class="req">*</span></label>
          <input v-model="form.name" class="input" placeholder="e.g. Notify Slack on publish" />
        </div>

        <div class="form-group">
          <label>Endpoint URL <span class="req">*</span></label>
          <input v-model="form.url" class="input" placeholder="https://hooks.slack.com/…" />
        </div>

        <div class="form-group">
          <label>Events to send</label>
          <div class="events-grid">
            <label v-for="ev in allEvents" :key="ev.value" class="event-check">
              <input type="checkbox" :value="ev.value" v-model="form.events" />
              {{ ev.label }}
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Secret (optional)</label>
          <input v-model="form.secret" class="input" placeholder="Used to sign X-Pygmy-Signature header" />
          <small class="hint">Leave blank if you don't need signature verification.</small>
        </div>

        <div class="form-group toggle-row">
          <label>Active</label>
          <button class="toggle-btn" :class="{ on: form.active }" @click="form.active = !form.active">
            {{ form.active ? 'Enabled' : 'Disabled' }}
          </button>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="closeModal">Cancel</button>
          <button class="btn btn-primary" @click="saveHook" :disabled="saving">
            {{ saving ? 'Saving…' : (editing ? 'Save changes' : 'Create webhook') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal glass confirm-modal">
        <h2>Delete webhook?</h2>
        <p>This will permanently remove <strong>{{ deleteTarget.name }}</strong> and stop all future deliveries.</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteHook">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast   = useToastStore()
const hooks   = ref([])
const loading = ref(true)
const saving  = ref(false)
const testing = ref(null)
const showModal   = ref(false)
const editing     = ref(null)
const deleteTarget = ref(null)
const allEvents   = ref([])

const defaultForm = () => ({
  name: '', url: '', events: [], secret: '', active: true
})
const form = ref(defaultForm())

async function load() {
  loading.value = true
  try {
    const [{ data: h }, { data: ev }] = await Promise.all([
      api.get('/webhooks'),
      api.get('/webhooks/events'),
    ])
    hooks.value = h
    allEvents.value = ev
  } finally {
    loading.value = false
  }
}

function openNew() {
  editing.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEdit(hook) {
  editing.value = hook
  form.value = {
    name:   hook.name,
    url:    hook.url,
    events: [...hook.events],
    secret: hook.secret,
    active: hook.active,
  }
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function saveHook() {
  if (!form.value.name.trim() || !form.value.url.trim()) {
    toast.error('Name and URL are required')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/webhooks/${editing.value.id}`, form.value)
      toast.success('Webhook updated')
    } else {
      await api.post('/webhooks', form.value)
      toast.success('Webhook created')
    }
    closeModal()
    await load()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

function confirmDelete(hook) { deleteTarget.value = hook }

async function deleteHook() {
  try {
    await api.delete(`/webhooks/${deleteTarget.value.id}`)
    toast.success('Webhook deleted')
    deleteTarget.value = null
    await load()
  } catch { toast.error('Delete failed') }
}

async function testHook(hook) {
  testing.value = hook.id
  try {
    await api.post(`/webhooks/${hook.id}/test`)
    toast.success('Test delivery sent ✓')
    await load()
  } catch (e) {
    toast.error(e.response?.data?.error || 'Test delivery failed')
  } finally {
    testing.value = null
  }
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'Z').toLocaleString()
}

onMounted(load)
</script>

<style scoped>
.webhooks-view { padding: 2rem; max-width: 900px; }
.page-desc { color: var(--muted); margin-bottom: 1.5rem; font-size: 0.88rem; line-height: 1.6; }

/* ── Empty ── */
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  border-radius: 1.2rem;
}
.empty-icon { font-size: 3rem; margin-bottom: 0.75rem; }
.empty-state h3 { margin: 0 0 0.5rem; }
.empty-state p { color: var(--muted); margin-bottom: 1.5rem; font-size: 0.88rem; }

/* ── Hook cards ── */
.hooks-list { display: flex; flex-direction: column; gap: 1rem; }
.hook-card {
  border-radius: 1.1rem;
  padding: 1.25rem 1.5rem;
}
.hook-card.inactive { opacity: 0.6; }

.hook-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}
.hook-name {
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.active-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.active-dot.on  { background: #4ade80; }
.active-dot.off { background: var(--muted); }

.hook-url { font-size: 0.78rem; color: var(--muted); margin-top: 0.2rem; word-break: break-all; }

.hook-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }

.hook-events {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.6rem;
}
.event-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  background: rgba(255,255,255,0.08);
  color: var(--text);
  font-family: monospace;
}
.muted-sm { font-size: 0.75rem; color: var(--muted); }

.hook-status { font-size: 0.75rem; color: var(--muted); display: flex; align-items: center; gap: 0.5rem; }
.status-label { }
.status-code { font-weight: 600; }
.status-code.ok  { color: #4ade80; }
.status-code.err { color: var(--accent); }
.status-error { color: #facc15; cursor: default; }

/* ── Modal ── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
  padding: 1rem;
}
.modal {
  width: 100%; max-width: 560px;
  border-radius: 1.25rem;
  padding: 2rem;
  max-height: 90vh;
  overflow-y: auto;
}
.modal h2 { margin: 0 0 1.5rem; font-size: 1.2rem; }

.events-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}
.event-check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.25rem 0;
}
.event-check input { cursor: pointer; accent-color: var(--accent); }

.hint { font-size: 0.75rem; color: var(--muted); display: block; margin-top: 0.3rem; }

.toggle-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.toggle-btn {
  padding: 0.35rem 1rem;
  border-radius: 99px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06);
  color: var(--muted);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.82rem;
  transition: all 0.2s;
}
.toggle-btn.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

/* ── Danger ── */
.danger { color: var(--accent); }
.confirm-modal { max-width: 420px; }
.confirm-modal p { color: var(--muted); margin-bottom: 1rem; font-size: 0.88rem; }
.btn-danger {
  background: var(--accent);
  color: #fff;
  border: none;
}

.loading { color: var(--muted); padding: 2rem; }
</style>
