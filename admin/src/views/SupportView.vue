<template>
  <div class="support-wrap">
    <div class="page-header">
      <h1>🎫 Support Tickets</h1>
      <button class="btn btn-primary" @click="openCreate">+ New Ticket</button>
    </div>

    <!-- Stats strip -->
    <div class="support-stats" v-if="stats">
      <div class="sstat glass" :class="{ accent: stats.unread > 0 }">
        <div class="sstat-num">{{ stats.unread }}</div>
        <div class="sstat-label">Unread</div>
      </div>
      <div class="sstat glass" :class="{ accent: stats.open > 0 }">
        <div class="sstat-num">{{ stats.open }}</div>
        <div class="sstat-label">Open</div>
      </div>
      <div class="sstat glass">
        <div class="sstat-num">{{ stats.in_progress }}</div>
        <div class="sstat-label">In Progress</div>
      </div>
      <div class="sstat glass">
        <div class="sstat-num">{{ stats.waiting }}</div>
        <div class="sstat-label">Waiting</div>
      </div>
      <div class="sstat glass">
        <div class="sstat-num">{{ stats.resolved }}</div>
        <div class="sstat-label">Resolved</div>
      </div>
      <div class="sstat glass" :class="{ accent: stats.urgent > 0 }">
        <div class="sstat-num">{{ stats.urgent }}</div>
        <div class="sstat-label">🚨 Urgent</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass">
      <input v-model="filters.q" placeholder="Search tickets…" class="filter-input" @input="loadTickets" />
      <select v-model="filters.status" class="filter-select" @change="loadTickets">
        <option value="">All Status</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="waiting">Waiting</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>
      <select v-model="filters.priority" class="filter-select" @change="loadTickets">
        <option value="">All Priority</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>
    </div>

    <!-- Tickets table -->
    <div class="tickets-table glass" v-if="tickets.length">
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Customer</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Messages</th>
            <th>Last Reply</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="t in tickets"
            :key="t.id"
            :class="{ unread: !t.is_read }"
            @click="openTicket(t)"
          >
            <td>
              <span class="ticket-num">{{ t.ticket_number }}</span>
              <span v-if="!t.is_read" class="unread-dot" title="Unread">●</span>
            </td>
            <td>
              <div class="customer-cell">
                <span class="customer-name">{{ t.customer_name }}</span>
                <span class="customer-email">{{ t.customer_email }}</span>
              </div>
            </td>
            <td class="subject-cell">{{ t.subject }}</td>
            <td>
              <span class="status-pill" :class="`status-${t.status}`">
                {{ statusLabel(t.status) }}
              </span>
            </td>
            <td>
              <span class="priority-pill" :class="`priority-${t.priority}`">
                {{ t.priority }}
              </span>
            </td>
            <td class="center">{{ t.message_count }}</td>
            <td class="date-cell">{{ fmtDate(t.last_reply_at) }}</td>
            <td class="actions-cell" @click.stop>
              <button class="btn-icon" title="View" @click="openTicket(t)">💬</button>
              <button class="btn-icon danger" title="Delete" @click="deleteTicket(t)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="pagination" v-if="total > pageSize">
        <button :disabled="page === 0" @click="page--; loadTickets()">‹</button>
        <span>{{ page + 1 }} / {{ Math.ceil(total / pageSize) }}</span>
        <button :disabled="(page + 1) * pageSize >= total" @click="page++; loadTickets()">›</button>
      </div>
    </div>
    <div class="empty-state glass" v-else-if="!loading">
      <div class="empty-icon">🎫</div>
      <p>No tickets found</p>
    </div>

    <!-- Ticket detail modal -->
    <div class="modal-backdrop" v-if="activeTicket" @click.self="closeTicket">
      <div class="ticket-modal glass">
        <div class="modal-header">
          <div class="modal-title-row">
            <span class="ticket-num">{{ activeTicket.ticket_number }}</span>
            <h2>{{ activeTicket.subject }}</h2>
          </div>
          <div class="modal-meta">
            <select v-model="activeTicket.status" class="status-select" @change="updateTicket('status', activeTicket.status)">
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting">Waiting on customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select v-model="activeTicket.priority" class="priority-select" @change="updateTicket('priority', activeTicket.priority)">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <button class="modal-close" @click="closeTicket">✕</button>
          </div>
        </div>

        <div class="modal-customer-bar">
          <span>👤 {{ activeTicket.customer_name }}</span>
          <span>✉️ {{ activeTicket.customer_email }}</span>
          <span v-if="activeTicket.order_number">📦 {{ activeTicket.order_number }}</span>
          <span>🕐 {{ fmtDate(activeTicket.created_at) }}</span>
        </div>

        <!-- Messages thread -->
        <div class="messages-thread" ref="threadRef">
          <div
            v-for="msg in activeMessages"
            :key="msg.id"
            class="message-bubble"
            :class="[`msg-${msg.sender}`, { internal: msg.is_internal }]"
          >
            <div class="msg-header">
              <strong>{{ msg.sender_name }}</strong>
              <span class="msg-badge" v-if="msg.sender === 'agent'">
                {{ msg.is_internal ? '🔒 Internal Note' : '💼 Agent' }}
              </span>
              <span class="msg-time">{{ fmtDatetime(msg.created_at) }}</span>
            </div>
            <div class="msg-body" v-html="nl2br(msg.message)"></div>
          </div>
        </div>

        <!-- Reply form -->
        <div class="reply-form">
          <div class="reply-type-toggle">
            <button :class="{ active: replyType === 'reply' }" @click="replyType = 'reply'">💬 Reply to Customer</button>
            <button :class="{ active: replyType === 'note' }" @click="replyType = 'note'">🔒 Internal Note</button>
          </div>
          <textarea
            v-model="replyText"
            :placeholder="replyType === 'reply' ? 'Type your reply to the customer…' : 'Internal note (not visible to customer)…'"
            class="reply-textarea"
            rows="4"
          ></textarea>
          <div class="reply-actions">
            <button class="btn btn-primary" :disabled="!replyText.trim() || sending" @click="sendReply">
              {{ sending ? 'Sending…' : (replyType === 'reply' ? '↩️ Send Reply' : '📝 Save Note') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create ticket modal -->
    <div class="modal-backdrop" v-if="showCreate" @click.self="showCreate = false">
      <div class="create-modal glass">
        <div class="modal-header">
          <h2>+ New Ticket</h2>
          <button class="modal-close" @click="showCreate = false">✕</button>
        </div>
        <div class="form-grid">
          <label>Customer Name *
            <input v-model="newTicket.customer_name" placeholder="Full name" />
          </label>
          <label>Customer Email *
            <input v-model="newTicket.customer_email" type="email" placeholder="email@example.com" />
          </label>
          <label class="span2">Subject *
            <input v-model="newTicket.subject" placeholder="Brief description of the issue" />
          </label>
          <label>Priority
            <select v-model="newTicket.priority">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>Order Number
            <input v-model="newTicket.order_number" placeholder="ORD-YYYYMMDD-XXXX" />
          </label>
          <label class="span2">Message *
            <textarea v-model="newTicket.message" rows="4" placeholder="Describe the issue…"></textarea>
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreate = false">Cancel</button>
          <button class="btn btn-primary" :disabled="!newTicket.subject || !newTicket.customer_email || !newTicket.message || creating" @click="createTicket">
            {{ creating ? 'Creating…' : 'Create Ticket' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue'

const API = 'http://localhost:3200/api'
const token = () => localStorage.getItem('pygmy_token')

const tickets = ref([])
const total = ref(0)
const loading = ref(false)
const page = ref(0)
const pageSize = 25
const stats = ref(null)
const filters = reactive({ q: '', status: '', priority: '' })

const activeTicket = ref(null)
const activeMessages = ref([])
const replyText = ref('')
const replyType = ref('reply')
const sending = ref(false)
const threadRef = ref(null)

const showCreate = ref(false)
const creating = ref(false)
const newTicket = reactive({ customer_name: '', customer_email: '', subject: '', message: '', priority: 'normal', order_number: '' })

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  return res.json()
}

async function loadStats() {
  stats.value = await api('/support/stats')
}

async function loadTickets() {
  loading.value = true
  const params = new URLSearchParams({ limit: pageSize, offset: page.value * pageSize })
  if (filters.q) params.set('q', filters.q)
  if (filters.status) params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  const data = await api(`/support?${params}`)
  tickets.value = data.tickets || []
  total.value = data.total || 0
  loading.value = false
}

async function openTicket(t) {
  const data = await api(`/support/${t.id}`)
  activeTicket.value = data.ticket
  activeMessages.value = data.messages || []
  replyText.value = ''
  replyType.value = 'reply'
  await nextTick()
  if (threadRef.value) threadRef.value.scrollTop = threadRef.value.scrollHeight
  // refresh stats (unread count changes)
  loadStats()
  // mark read in local list
  const idx = tickets.value.findIndex(x => x.id === t.id)
  if (idx >= 0) tickets.value[idx].is_read = 1
}

function closeTicket() {
  activeTicket.value = null
  activeMessages.value = []
  loadTickets()
}

async function updateTicket(field, value) {
  const body = {}
  body[field] = value
  await api(`/support/${activeTicket.value.id}`, { method: 'PUT', body: JSON.stringify(body) })
}

async function sendReply() {
  if (!replyText.value.trim() || sending.value) return
  sending.value = true
  await api(`/support/${activeTicket.value.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message: replyText.value, is_internal: replyType.value === 'note' }),
  })
  replyText.value = ''
  // Reload messages
  const data = await api(`/support/${activeTicket.value.id}`)
  activeTicket.value = data.ticket
  activeMessages.value = data.messages || []
  sending.value = false
  await nextTick()
  if (threadRef.value) threadRef.value.scrollTop = threadRef.value.scrollHeight
}

function openCreate() {
  Object.assign(newTicket, { customer_name: '', customer_email: '', subject: '', message: '', priority: 'normal', order_number: '' })
  showCreate.value = true
}

async function createTicket() {
  if (!newTicket.subject || !newTicket.customer_email || !newTicket.message) return
  creating.value = true
  await api('/support', { method: 'POST', body: JSON.stringify({ ...newTicket, channel: 'manual' }) })
  creating.value = false
  showCreate.value = false
  loadTickets()
  loadStats()
}

async function deleteTicket(t) {
  if (!confirm(`Delete ticket ${t.ticket_number}?`)) return
  await api(`/support/${t.id}`, { method: 'DELETE' })
  loadTickets()
  loadStats()
}

function statusLabel(s) {
  return { open: 'Open', in_progress: 'In Progress', waiting: 'Waiting', resolved: 'Resolved', closed: 'Closed' }[s] || s
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDatetime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function nl2br(s) {
  return (s || '').replace(/\n/g, '<br>')
}

loadTickets()
loadStats()
</script>

<style scoped>
.support-wrap { padding: 1.5rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.page-header h1 { margin: 0; font-size: 1.5rem; }

.support-stats { display: flex; gap: .75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.sstat { padding: .75rem 1.25rem; border-radius: 1rem; text-align: center; min-width: 90px; transition: border-color .2s; }
.sstat.accent { border-color: var(--accent) !important; }
.sstat-num { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.sstat-label { font-size: .7rem; color: #888; text-transform: uppercase; letter-spacing: .05em; }

.filter-bar { display: flex; gap: .75rem; padding: 1rem 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.filter-input { flex: 1; min-width: 180px; padding: .5rem .75rem; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; color: #e2e2e8; font-family: inherit; }
.filter-select { padding: .5rem .75rem; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; color: #e2e2e8; font-family: inherit; }

.tickets-table { border-radius: 1rem; overflow: hidden; margin-bottom: 1.5rem; }
table { width: 100%; border-collapse: collapse; }
thead tr { background: rgba(255,255,255,.06); }
th { padding: .75rem 1rem; text-align: left; font-size: .75rem; color: #888; text-transform: uppercase; letter-spacing: .05em; }
tbody tr { border-bottom: 1px solid rgba(255,255,255,.06); cursor: pointer; transition: background .15s; }
tbody tr:hover { background: rgba(255,255,255,.04); }
tbody tr.unread { background: rgba(176,48,58,.07); }
td { padding: .75rem 1rem; font-size: .88rem; }
.ticket-num { font-family: monospace; font-size: .8rem; color: var(--accent); }
.unread-dot { color: var(--accent); font-size: .6rem; vertical-align: super; margin-left: .3rem; }
.customer-cell { display: flex; flex-direction: column; gap: .1rem; }
.customer-name { font-weight: 500; }
.customer-email { font-size: .76rem; color: #888; }
.subject-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.center { text-align: center; }
.date-cell { font-size: .78rem; color: #888; }
.actions-cell { display: flex; gap: .4rem; }

.status-pill, .priority-pill { display: inline-block; padding: .2rem .6rem; border-radius: .5rem; font-size: .72rem; font-weight: 600; text-transform: capitalize; }
.status-open { background: rgba(52,199,89,.15); color: #34c759; }
.status-in_progress { background: rgba(255,159,10,.15); color: #ff9f0a; }
.status-waiting { background: rgba(90,200,250,.15); color: #5ac8fa; }
.status-resolved { background: rgba(99,99,102,.15); color: #8e8e93; }
.status-closed { background: rgba(99,99,102,.1); color: #636366; }
.priority-urgent { background: rgba(255,59,48,.15); color: #ff3b30; }
.priority-high { background: rgba(255,149,0,.15); color: #ff9500; }
.priority-normal { background: rgba(255,255,255,.08); color: #aeaeb2; }
.priority-low { background: rgba(99,99,102,.1); color: #636366; }

.btn-icon { background: none; border: 1px solid rgba(255,255,255,.12); border-radius: .4rem; padding: .25rem .5rem; cursor: pointer; font-size: .85rem; transition: background .15s; }
.btn-icon:hover { background: rgba(255,255,255,.08); }
.btn-icon.danger:hover { background: rgba(255,59,48,.15); }

.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; padding: .75rem; font-size: .85rem; color: #888; }
.pagination button { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: .4rem; padding: .25rem .6rem; cursor: pointer; color: #e2e2e8; }
.pagination button:disabled { opacity: .4; cursor: default; }

.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.empty-state p { color: #888; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.ticket-modal { width: 100%; max-width: 720px; max-height: 90vh; display: flex; flex-direction: column; border-radius: 1.5rem; overflow: hidden; }
.modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem 1.5rem; background: rgba(255,255,255,.04); flex-shrink: 0; }
.modal-title-row { display: flex; flex-direction: column; gap: .25rem; }
.modal-title-row h2 { margin: 0; font-size: 1.1rem; }
.modal-meta { display: flex; align-items: center; gap: .5rem; }
.status-select, .priority-select { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; color: #e2e2e8; padding: .3rem .6rem; font-size: .8rem; }
.modal-close { background: none; border: none; color: #888; font-size: 1.2rem; cursor: pointer; padding: .25rem .5rem; border-radius: .3rem; transition: background .15s; }
.modal-close:hover { background: rgba(255,255,255,.08); }

.modal-customer-bar { display: flex; gap: 1.5rem; padding: .75rem 1.5rem; font-size: .8rem; color: #888; background: rgba(255,255,255,.02); border-bottom: 1px solid rgba(255,255,255,.06); flex-shrink: 0; flex-wrap: wrap; }

.messages-thread { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.message-bubble { border-radius: 1rem; padding: 1rem; }
.msg-customer { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
.msg-agent { background: rgba(176,48,58,.12); border: 1px solid rgba(176,48,58,.25); }
.message-bubble.internal { background: rgba(255,204,0,.08); border-color: rgba(255,204,0,.2); }
.msg-header { display: flex; align-items: center; gap: .5rem; margin-bottom: .5rem; font-size: .8rem; }
.msg-badge { padding: .1rem .5rem; border-radius: .3rem; background: rgba(255,255,255,.1); font-size: .7rem; }
.msg-time { color: #888; margin-left: auto; }
.msg-body { font-size: .88rem; line-height: 1.5; color: #d0d0d8; }

.reply-form { padding: 1rem 1.5rem; background: rgba(255,255,255,.02); border-top: 1px solid rgba(255,255,255,.08); flex-shrink: 0; }
.reply-type-toggle { display: flex; gap: .5rem; margin-bottom: .75rem; }
.reply-type-toggle button { padding: .35rem .75rem; border-radius: .5rem; border: 1px solid rgba(255,255,255,.12); background: transparent; color: #888; cursor: pointer; font-size: .82rem; transition: all .15s; }
.reply-type-toggle button.active { background: rgba(176,48,58,.2); border-color: var(--accent); color: #e2e2e8; }
.reply-textarea { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; color: #e2e2e8; padding: .75rem 1rem; font-family: inherit; font-size: .88rem; resize: vertical; box-sizing: border-box; }
.reply-actions { display: flex; justify-content: flex-end; margin-top: .75rem; }

/* Create modal */
.create-modal { width: 100%; max-width: 580px; border-radius: 1.5rem; padding: 1.5rem; }
.create-modal .modal-header { padding: 0 0 1rem 0; background: none; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.create-modal .modal-header h2 { margin: 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-grid label { display: flex; flex-direction: column; gap: .35rem; font-size: .82rem; color: #888; }
.form-grid input, .form-grid select, .form-grid textarea { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; color: #e2e2e8; padding: .5rem .75rem; font-family: inherit; font-size: .88rem; }
.form-grid textarea { resize: vertical; }
.span2 { grid-column: span 2; }
.modal-footer { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.25rem; }

.btn { padding: .5rem 1.25rem; border-radius: .6rem; cursor: pointer; font-weight: 600; font-size: .88rem; border: none; transition: all .2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { opacity: .85; }
.btn-primary:disabled { opacity: .5; cursor: default; }
.btn-secondary { background: rgba(255,255,255,.1); color: #e2e2e8; }
.btn-secondary:hover { background: rgba(255,255,255,.15); }

.glass { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); }
</style>
