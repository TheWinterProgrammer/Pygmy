<template>
  <div class="inbox-view">
    <div class="inbox-layout">
      <!-- Sidebar -->
      <div class="inbox-sidebar glass">
        <div class="sidebar-header">
          <h1>📬 Inbox</h1>
          <span v-if="counts.total > 0" class="unread-badge">{{ counts.total }}</span>
        </div>

        <div class="sidebar-filters">
          <button
            v-for="f in filters"
            :key="f.value"
            :class="['filter-btn', { active: activeFilter === f.value }]"
            @click="setFilter(f.value)"
          >
            {{ f.icon }} {{ f.label }}
            <span v-if="f.count > 0" class="filter-count">{{ f.count }}</span>
          </button>
        </div>

        <div class="sidebar-search">
          <input class="search-input" placeholder="Search…" v-model="q" @input="debouncedLoad" />
        </div>

        <div class="thread-list" v-if="!loading">
          <div
            v-for="item in items"
            :key="`${item.source}-${item.id}`"
            :class="['thread-item', { active: selectedItem?.id === item.id && selectedItem?.source === item.source, unread: item.unread > 0 }]"
            @click="openThread(item)"
          >
            <div class="thread-source-icon">{{ sourceIcon(item.source) }}</div>
            <div class="thread-body">
              <div class="thread-name">{{ item.sender_name || 'Anonymous' }}</div>
              <div class="thread-subject">{{ item.subject }}</div>
              <div class="thread-meta">
                <span :class="['status-pill', `status-${item.status}`]">{{ item.status }}</span>
                <span class="thread-time">{{ timeAgo(item.updated_at) }}</span>
              </div>
            </div>
            <div v-if="item.unread > 0" class="unread-dot"></div>
          </div>
          <div v-if="!items.length" class="empty-inbox">
            <div class="empty-icon">📭</div>
            <div>No messages</div>
          </div>
        </div>
        <div v-else class="loading-state">Loading…</div>
      </div>

      <!-- Main Thread Panel -->
      <div class="inbox-main glass" v-if="selectedItem">
        <div class="thread-header">
          <div class="thread-header-left">
            <div class="source-badge" :class="`source-${selectedItem.source}`">
              {{ sourceIcon(selectedItem.source) }} {{ sourceLabel(selectedItem.source) }}
            </div>
            <div>
              <h2 class="thread-title">{{ selectedItem.subject }}</h2>
              <div class="thread-sender">
                From: <strong>{{ selectedItem.sender_name }}</strong>
                <span v-if="selectedItem.sender_email"> &lt;{{ selectedItem.sender_email }}&gt;</span>
              </div>
            </div>
          </div>
          <div class="thread-header-right">
            <select class="form-input sm" v-model="statusUpdate" @change="updateStatus">
              <option value="">Change Status…</option>
              <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
            </select>
            <button class="btn btn-ghost btn-sm" @click="selectedItem = null">✕ Close</button>
          </div>
        </div>

        <div class="messages-area" ref="messagesArea">
          <div v-if="loadingThread" class="loading-state">Loading thread…</div>
          <template v-else>
            <div
              v-for="(msg, i) in currentThread.messages"
              :key="i"
              :class="['message-bubble', msg.sender === 'admin' ? 'outgoing' : 'incoming']"
            >
              <div class="bubble-meta">
                <span class="bubble-sender">{{ msg.sender === 'admin' ? 'You' : (currentThread.entity?.customer_name || currentThread.entity?.name || 'Customer') }}</span>
                <span v-if="msg.is_internal" class="internal-note">🔒 Internal Note</span>
                <span class="bubble-time">{{ timeAgo(msg.created_at) }}</span>
              </div>
              <div class="bubble-content">{{ msg.content }}</div>
            </div>
          </template>
        </div>

        <!-- Reply area (only for support tickets) -->
        <div v-if="selectedItem.source === 'support'" class="reply-area">
          <div class="reply-toolbar">
            <label class="toggle-label">
              <input type="checkbox" v-model="isInternal" />
              🔒 Internal Note
            </label>
          </div>
          <textarea
            class="reply-textarea"
            :placeholder="isInternal ? 'Internal note (not visible to customer)…' : 'Reply to customer…'"
            v-model="replyText"
            rows="4"
          ></textarea>
          <div class="reply-footer">
            <button class="btn btn-accent" @click="sendReply" :disabled="!replyText.trim() || sending">
              {{ sending ? 'Sending…' : (isInternal ? '🔒 Add Note' : '📤 Send Reply') }}
            </button>
          </div>
        </div>

        <div v-else-if="selectedItem.source === 'contact'" class="reply-area contact-reply">
          <div class="contact-reply-note">
            <p>📧 To reply to this contact form submission, use your email client:</p>
            <a :href="`mailto:${selectedItem.sender_email}?subject=Re: ${encodeURIComponent(selectedItem.subject)}`" class="mailto-link">
              → Compose Email to {{ selectedItem.sender_email }}
            </a>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div class="inbox-main glass empty-main" v-else>
        <div class="empty-state">
          <div class="empty-icon-lg">📬</div>
          <h3>Select a message to view</h3>
          <p>Choose a conversation from the sidebar to view and reply</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import api from '../api.js'

const q = ref('')
const activeFilter = ref('')
const items = ref([])
const selectedItem = ref(null)
const currentThread = ref({ messages: [], entity: null })
const loading = ref(false)
const loadingThread = ref(false)
const sending = ref(false)
const replyText = ref('')
const isInternal = ref(false)
const statusUpdate = ref('')
const messagesArea = ref(null)
const counts = ref({ total: 0, support: 0, contact: 0 })

const filters = computed(() => [
  { value: '', icon: '📥', label: 'All', count: counts.value.total },
  { value: 'support', icon: '🎫', label: 'Support', count: counts.value.support },
  { value: 'contact', icon: '✉️', label: 'Contact', count: counts.value.contact },
  { value: 'order', icon: '📦', label: 'Orders', count: 0 }
])

const statusOptions = computed(() => {
  if (selectedItem.value?.source === 'support') return ['open', 'in_progress', 'resolved', 'closed']
  if (selectedItem.value?.source === 'contact') return ['unread', 'read', 'archived']
  return []
})

function sourceIcon(src) {
  return { support: '🎫', contact: '✉️', order: '📦' }[src] || '💬'
}

function sourceLabel(src) {
  return { support: 'Support Ticket', contact: 'Contact Form', order: 'Order Message' }[src] || src
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadItems, 300)
}

async function loadCounts() {
  const { data } = await api.get('/unified-inbox/counts')
  counts.value = data
}

function setFilter(val) {
  activeFilter.value = val
  loadItems()
}

async function loadItems() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit: 100 })
    if (q.value) params.set('q', q.value)
    if (activeFilter.value) params.set('type', activeFilter.value)
    const { data } = await api.get(`/unified-inbox?${params}`)
    items.value = data.items || []
  } finally {
    loading.value = false
  }
}

async function openThread(item) {
  selectedItem.value = item
  replyText.value = ''
  statusUpdate.value = ''
  loadingThread.value = true
  try {
    const { data } = await api.get(`/unified-inbox/thread/${item.source}/${item.id}`)
    currentThread.value = data
  } finally {
    loadingThread.value = false
    await nextTick()
    if (messagesArea.value) messagesArea.value.scrollTop = messagesArea.value.scrollHeight
  }
}

async function sendReply() {
  if (!replyText.value.trim() || !selectedItem.value) return
  sending.value = true
  try {
    await api.post(`/unified-inbox/reply/${selectedItem.value.source}/${selectedItem.value.id}`, {
      message: replyText.value,
      is_internal: isInternal.value
    })
    currentThread.value.messages.push({
      sender: 'admin',
      content: replyText.value,
      is_internal: isInternal.value,
      created_at: new Date().toISOString()
    })
    replyText.value = ''
    await nextTick()
    if (messagesArea.value) messagesArea.value.scrollTop = messagesArea.value.scrollHeight
  } finally {
    sending.value = false
  }
}

async function updateStatus() {
  if (!statusUpdate.value || !selectedItem.value) return
  await api.put(`/unified-inbox/status/${selectedItem.value.source}/${selectedItem.value.id}`, {
    status: statusUpdate.value
  })
  selectedItem.value.status = statusUpdate.value
  const idx = items.value.findIndex(i => i.id === selectedItem.value.id && i.source === selectedItem.value.source)
  if (idx >= 0) items.value[idx].status = statusUpdate.value
}

onMounted(async () => {
  await Promise.all([loadCounts(), loadItems()])
})
</script>

<style scoped>
.inbox-view { height: calc(100vh - 60px); padding: 1.5rem; }
.inbox-layout { display: flex; gap: 1rem; height: 100%; }
.glass { background: rgba(255,255,255,.04); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); border-radius: 1rem; }

/* Sidebar */
.inbox-sidebar { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; overflow: hidden; }
.sidebar-header { display: flex; align-items: center; gap: .75rem; padding: 1.25rem 1.25rem .75rem; }
.sidebar-header h1 { font-size: 1.2rem; font-weight: 700; margin: 0; }
.unread-badge { background: var(--accent, #e05469); color: white; border-radius: 9999px; font-size: .7rem; font-weight: 700; padding: 2px 7px; }

.sidebar-filters { display: flex; flex-wrap: wrap; gap: .4rem; padding: 0 1rem .75rem; }
.filter-btn { display: flex; align-items: center; gap: .3rem; padding: .3rem .7rem; border: 1px solid rgba(255,255,255,.1); border-radius: 9999px; background: none; color: rgba(255,255,255,.7); cursor: pointer; font-size: .8rem; transition: all .2s; }
.filter-btn.active { background: var(--accent, #e05469); border-color: var(--accent, #e05469); color: white; }
.filter-btn:hover:not(.active) { border-color: rgba(255,255,255,.3); color: white; }
.filter-count { background: rgba(255,255,255,.15); border-radius: 9999px; font-size: .65rem; padding: 1px 5px; }

.sidebar-search { padding: 0 1rem .75rem; }
.search-input { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; color: white; padding: .5rem .75rem; font-size: .85rem; }

.thread-list { flex: 1; overflow-y: auto; }
.thread-item { display: flex; gap: .75rem; padding: .75rem 1rem; cursor: pointer; transition: background .15s; position: relative; }
.thread-item:hover { background: rgba(255,255,255,.04); }
.thread-item.active { background: rgba(var(--accent-rgb, 224, 84, 105), .1); border-right: 2px solid var(--accent, #e05469); }
.thread-item.unread .thread-name { font-weight: 700; }
.thread-source-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: .1rem; }
.thread-body { flex: 1; min-width: 0; }
.thread-name { font-size: .85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.thread-subject { font-size: .8rem; color: rgba(255,255,255,.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: .1rem; }
.thread-meta { display: flex; align-items: center; gap: .5rem; margin-top: .25rem; }
.status-pill { font-size: .65rem; padding: 2px 6px; border-radius: 9999px; text-transform: capitalize; }
.status-open { background: rgba(52, 152, 219, .15); color: #3498db; }
.status-in_progress { background: rgba(243, 156, 18, .15); color: #f39c12; }
.status-resolved, .status-read { background: rgba(46, 204, 113, .15); color: #2ecc71; }
.status-closed, .status-archived { background: rgba(255,255,255,.08); color: rgba(255,255,255,.4); }
.status-unread { background: rgba(var(--accent-rgb, 224, 84, 105), .15); color: var(--accent, #e05469); }
.thread-time { font-size: .7rem; color: rgba(255,255,255,.4); margin-left: auto; }
.unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent, #e05469); flex-shrink: 0; margin-top: .3rem; }

/* Main */
.inbox-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.thread-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.08); gap: 1rem; }
.thread-header-left { display: flex; gap: .75rem; align-items: flex-start; }
.source-badge { font-size: .75rem; padding: .25rem .6rem; border-radius: .4rem; white-space: nowrap; }
.source-support { background: rgba(52, 152, 219, .15); color: #3498db; }
.source-contact { background: rgba(46, 204, 113, .15); color: #2ecc71; }
.source-order { background: rgba(243, 156, 18, .15); color: #f39c12; }
.thread-title { font-size: 1rem; font-weight: 700; margin: 0 0 .2rem; }
.thread-sender { font-size: .8rem; color: rgba(255,255,255,.6); }
.thread-header-right { display: flex; gap: .5rem; align-items: center; flex-shrink: 0; }

.messages-area { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.message-bubble { max-width: 75%; display: flex; flex-direction: column; gap: .25rem; }
.message-bubble.outgoing { align-self: flex-end; }
.message-bubble.incoming { align-self: flex-start; }
.bubble-meta { display: flex; align-items: center; gap: .5rem; font-size: .75rem; color: rgba(255,255,255,.5); }
.bubble-sender { font-weight: 600; }
.internal-note { background: rgba(243, 156, 18, .15); color: #f39c12; padding: 1px 5px; border-radius: 4px; }
.bubble-time { margin-left: auto; }
.bubble-content { background: rgba(255,255,255,.07); border-radius: .75rem; padding: .75rem 1rem; font-size: .9rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.message-bubble.outgoing .bubble-content { background: rgba(var(--accent-rgb, 224, 84, 105), .15); border: 1px solid rgba(var(--accent-rgb, 224, 84, 105), .25); }

.reply-area { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,.08); }
.reply-toolbar { display: flex; align-items: center; gap: 1rem; margin-bottom: .5rem; }
.toggle-label { display: flex; align-items: center; gap: .4rem; font-size: .8rem; color: rgba(255,255,255,.7); cursor: pointer; }
.toggle-label input { cursor: pointer; accent-color: var(--accent, #e05469); }
.reply-textarea { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; color: white; padding: .75rem 1rem; font-size: .9rem; resize: none; font-family: inherit; }
.reply-textarea:focus { outline: none; border-color: var(--accent, #e05469); }
.reply-footer { display: flex; justify-content: flex-end; margin-top: .75rem; }

.contact-reply { }
.contact-reply-note { background: rgba(255,255,255,.04); border-radius: .75rem; padding: 1rem 1.25rem; font-size: .9rem; color: rgba(255,255,255,.7); }
.mailto-link { display: inline-block; margin-top: .5rem; color: var(--accent, #e05469); text-decoration: none; font-weight: 600; }
.mailto-link:hover { text-decoration: underline; }

.empty-main { display: flex; align-items: center; justify-content: center; }
.empty-state { text-align: center; color: rgba(255,255,255,.4); }
.empty-icon-lg { font-size: 3rem; margin-bottom: 1rem; }
.empty-state h3 { font-size: 1.1rem; margin-bottom: .5rem; }
.empty-state p { font-size: .85rem; }

.empty-inbox { text-align: center; padding: 2rem; color: rgba(255,255,255,.4); }
.empty-icon { font-size: 2rem; margin-bottom: .5rem; }
.loading-state { text-align: center; padding: 2rem; color: rgba(255,255,255,.4); }

.form-input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; color: white; padding: .5rem .75rem; font-size: .875rem; }
.form-input.sm { padding: .35rem .6rem; font-size: .8rem; }
.btn { padding: .5rem 1rem; border-radius: .5rem; cursor: pointer; font-size: .875rem; border: none; transition: all .2s; font-family: inherit; }
.btn-accent { background: var(--accent, #e05469); color: white; }
.btn-ghost { background: rgba(255,255,255,.06); color: white; border: 1px solid rgba(255,255,255,.12); }
.btn-sm { padding: .35rem .7rem; font-size: .8rem; }
</style>
