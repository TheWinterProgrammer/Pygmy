<template>
  <div class="live-chat-view">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>💬 Live Chat</h1>
        <p class="subtitle">Manage visitor conversations in real time</p>
      </div>
      <div class="header-actions">
        <label class="toggle-pill" :class="{ active: isOnline }">
          <input type="checkbox" v-model="isOnline" @change="toggleOnline" />
          <span class="dot"></span>
          {{ isOnline ? '🟢 Online' : '⚫ Offline' }}
        </label>
        <span v-if="stats.unread > 0" class="badge-pill accent">{{ stats.unread }} unread</span>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">Total Chats</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ stats.open || 0 }}</div>
        <div class="stat-label">Open</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.unread || 0 }}</div>
        <div class="stat-label">Unread</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.closed || 0 }}</div>
        <div class="stat-label">Closed</div>
      </div>
    </div>

    <!-- Enable toggle banner -->
    <div v-if="!chatEnabled" class="notice glass">
      <span>💬 Live Chat is currently <strong>disabled</strong>. Enable it in
        <RouterLink to="/settings" style="color:var(--accent)">Settings → Live Chat</RouterLink>.
      </span>
    </div>

    <!-- Two-column layout: sessions list + active chat -->
    <div class="chat-layout">
      <!-- Sessions Sidebar -->
      <div class="sessions-panel glass">
        <div class="sessions-header">
          <input v-model="q" class="search-input" placeholder="Search by name or email…" @input="load" />
          <select v-model="filterStatus" @change="load" class="select-sm">
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div class="sessions-list">
          <div v-if="loading && !sessions.length" class="empty-state">
            <div class="loading-bar"></div>
          </div>
          <div v-else-if="!sessions.length" class="empty-state small">
            <div class="empty-icon">💬</div>
            <p>No chat sessions yet</p>
          </div>
          <div
            v-for="s in sessions"
            :key="s.id"
            class="session-item"
            :class="{
              active: activeSession?.id === s.id,
              unread: s.unread_admin > 0,
              closed: s.status === 'closed'
            }"
            @click="openSession(s)"
          >
            <div class="session-avatar">
              {{ (s.visitor_name || 'V').charAt(0).toUpperCase() }}
            </div>
            <div class="session-info">
              <div class="session-name">
                {{ s.visitor_name || 'Visitor' }}
                <span v-if="s.unread_admin > 0" class="unread-dot"></span>
              </div>
              <div class="session-preview">{{ s.last_message || 'No messages' }}</div>
              <div class="session-meta">
                <span class="badge-tiny" :class="s.status === 'open' ? 'badge-green' : 'badge-gray'">
                  {{ s.status }}
                </span>
                <span class="time-ago">{{ timeAgo(s.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Thread Panel -->
      <div class="chat-panel glass" v-if="activeSession">
        <!-- Chat Header -->
        <div class="chat-header">
          <div class="chat-visitor-info">
            <div class="visitor-avatar-lg">{{ (activeSession.visitor_name || 'V').charAt(0).toUpperCase() }}</div>
            <div>
              <div class="visitor-name">{{ activeSession.visitor_name || 'Visitor' }}</div>
              <div class="visitor-email text-muted">{{ activeSession.visitor_email || 'No email' }}</div>
              <div class="visitor-page text-muted" v-if="activeSession.page_url">
                📍 {{ activeSession.page_url }}
              </div>
            </div>
          </div>
          <div class="chat-actions">
            <span class="badge" :class="activeSession.status === 'open' ? 'badge-green' : 'badge-gray'">
              {{ activeSession.status }}
            </span>
            <button
              v-if="activeSession.status === 'open'"
              class="btn btn-ghost btn-sm"
              @click="closeSession"
            >✕ Close</button>
            <button
              v-else
              class="btn btn-ghost btn-sm"
              @click="reopenSession"
            >↩ Reopen</button>
          </div>
        </div>

        <!-- Messages -->
        <div class="messages-area" ref="messagesArea">
          <div v-if="loadingMessages" class="loading-bar"></div>
          <div v-else-if="!messages.length" class="empty-state small">
            <p>No messages yet. The visitor hasn't sent anything.</p>
          </div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="message"
            :class="isAdminMsg(msg) ? 'message-admin' : 'message-visitor'"
          >
            <div class="message-bubble">
              <div class="message-body">{{ msg.body }}</div>
              <div class="message-time">
                {{ isAdminMsg(msg) ? getSenderName(msg) : activeSession.visitor_name }}
                · {{ formatTime(msg.created_at) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Reply Box -->
        <div class="reply-box" v-if="activeSession.status === 'open'">
          <textarea
            v-model="replyText"
            class="reply-input"
            placeholder="Type a message… (Ctrl+Enter to send)"
            rows="2"
            @keydown.ctrl.enter="sendReply"
          ></textarea>
          <button class="btn btn-primary" :disabled="!replyText.trim() || sending" @click="sendReply">
            {{ sending ? '⏳' : '📤 Send' }}
          </button>
        </div>
        <div v-else class="reply-closed">
          <span>This conversation is closed.</span>
          <button class="btn btn-ghost btn-sm" @click="reopenSession">↩ Reopen</button>
        </div>
      </div>

      <!-- No session selected -->
      <div class="chat-panel glass empty-panel" v-else>
        <div class="empty-icon">💬</div>
        <h3>Select a conversation</h3>
        <p class="text-muted">Click on a session on the left to view messages.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import api from '../api.js'

const sessions = ref([])
const activeSession = ref(null)
const messages = ref([])
const loading = ref(false)
const loadingMessages = ref(false)
const sending = ref(false)
const replyText = ref('')
const q = ref('')
const filterStatus = ref('open')
const messagesArea = ref(null)
const stats = reactive({ total: 0, open: 0, closed: 0, unread: 0 })
const isOnline = ref(false)
const chatEnabled = ref(true)

let pollInterval = null

async function load() {
  try {
    const { data } = await api.get('/live-chat/sessions', {
      params: { q: q.value, status: filterStatus.value, limit: 50 }
    })
    sessions.value = data.sessions || []
    Object.assign(stats, data.stats || {})
  } catch {}
}

async function loadConfig() {
  try {
    const { data } = await api.get('/live-chat/config')
    chatEnabled.value = data.enabled
    isOnline.value = data.is_online
  } catch {}
}

async function toggleOnline() {
  try {
    await api.put('/live-chat/online', { is_online: isOnline.value })
  } catch { isOnline.value = !isOnline.value }
}

async function openSession(s) {
  activeSession.value = s
  messages.value = []
  loadingMessages.value = true
  try {
    const { data } = await api.get(`/live-chat/sessions/${s.id}`)
    activeSession.value = data
    messages.value = data.messages || []
    // Refresh session in list (clear unread)
    const idx = sessions.value.findIndex(x => x.id === s.id)
    if (idx >= 0) sessions.value[idx] = { ...sessions.value[idx], unread_admin: 0 }
    await nextTick()
    scrollToBottom()
  } catch {}
  loadingMessages.value = false
}

async function sendReply() {
  if (!replyText.value.trim() || !activeSession.value) return
  sending.value = true
  try {
    const { data } = await api.post(`/live-chat/sessions/${activeSession.value.id}/reply`, {
      body: replyText.value.trim()
    })
    messages.value.push(data)
    replyText.value = ''
    await nextTick()
    scrollToBottom()
  } catch {}
  sending.value = false
}

async function closeSession() {
  if (!activeSession.value) return
  try {
    const { data } = await api.put(`/live-chat/sessions/${activeSession.value.id}`, { status: 'closed' })
    activeSession.value = { ...activeSession.value, status: 'closed' }
    const idx = sessions.value.findIndex(x => x.id === data.id)
    if (idx >= 0) sessions.value[idx] = { ...sessions.value[idx], status: 'closed' }
  } catch {}
}

async function reopenSession() {
  if (!activeSession.value) return
  try {
    const { data } = await api.put(`/live-chat/sessions/${activeSession.value.id}`, { status: 'open' })
    activeSession.value = { ...activeSession.value, status: 'open' }
    const idx = sessions.value.findIndex(x => x.id === data.id)
    if (idx >= 0) sessions.value[idx] = { ...sessions.value[idx], status: 'open' }
  } catch {}
}

function isAdminMsg(msg) {
  return msg.sender?.startsWith('admin')
}

function getSenderName(msg) {
  return msg.sender?.replace('admin:', '') || 'Admin'
}

function scrollToBottom() {
  if (messagesArea.value) {
    messagesArea.value.scrollTop = messagesArea.value.scrollHeight
  }
}

function timeAgo(dt) {
  if (!dt) return ''
  const diff = (Date.now() - new Date(dt).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatTime(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Poll for new sessions + messages every 5s
async function poll() {
  // Refresh session list to see new sessions
  await load()
  // If there's an active session, reload messages
  if (activeSession.value) {
    const lastId = messages.value.at(-1)?.id || 0
    try {
      const { data } = await api.get(`/live-chat/poll/${activeSession.value.session_key || ''}`, { params: { since: lastId } })
      if (data.messages?.length) {
        messages.value.push(...data.messages)
        await nextTick()
        scrollToBottom()
      }
    } catch {}
  }
}

onMounted(async () => {
  await loadConfig()
  await load()
  pollInterval = setInterval(poll, 5000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<style scoped>
.chat-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1.5rem;
  height: calc(100vh - 260px);
  min-height: 500px;
}

.sessions-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1rem;
}

.sessions-header {
  display: flex;
  gap: .5rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(255,255,255,.07);
  flex-shrink: 0;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
}

.session-item {
  display: flex;
  gap: .75rem;
  padding: .85rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,.04);
  transition: background .15s;
}
.session-item:hover { background: rgba(255,255,255,.04); }
.session-item.active { background: rgba(var(--accent-rgb, 224,72,88), .1); }
.session-item.unread .session-name { font-weight: 700; }
.session-item.closed { opacity: .55; }

.session-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  font-size: .9rem;
  flex-shrink: 0;
}

.session-info { flex: 1; min-width: 0; }
.session-name { font-size: .9rem; font-weight: 500; display: flex; align-items: center; gap: .4rem; }
.session-preview { font-size: .8rem; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.session-meta { display: flex; gap: .5rem; align-items: center; margin-top: .2rem; }
.time-ago { font-size: .75rem; color: #666; }

.unread-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.badge-tiny {
  font-size: .65rem;
  padding: 1px 5px;
  border-radius: 20px;
}

/* Chat Panel */
.chat-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1rem;
}

.empty-panel {
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1rem;
}
.empty-panel .empty-icon { font-size: 3rem; }

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,.07);
  flex-shrink: 0;
}

.chat-visitor-info { display: flex; gap: .75rem; align-items: flex-start; }
.visitor-avatar-lg {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 1.1rem; flex-shrink: 0;
}
.visitor-name { font-weight: 600; font-size: 1rem; }
.visitor-email, .visitor-page { font-size: .8rem; }

.chat-actions { display: flex; gap: .5rem; align-items: center; }

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.message { display: flex; }
.message-visitor { justify-content: flex-start; }
.message-admin { justify-content: flex-end; }

.message-bubble {
  max-width: 70%;
  padding: .6rem .9rem;
  border-radius: 1rem;
  font-size: .88rem;
}
.message-visitor .message-bubble {
  background: rgba(255,255,255,.07);
  border-bottom-left-radius: .2rem;
}
.message-admin .message-bubble {
  background: rgba(224, 72, 88, .2);
  border-bottom-right-radius: .2rem;
}
.message-body { margin-bottom: .2rem; white-space: pre-wrap; word-break: break-word; }
.message-time { font-size: .72rem; color: #666; }

.reply-box {
  display: flex;
  gap: .75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255,255,255,.07);
  flex-shrink: 0;
  align-items: flex-end;
}
.reply-input {
  flex: 1;
  resize: none;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: .75rem;
  padding: .65rem .9rem;
  color: inherit;
  font-family: inherit;
  font-size: .9rem;
}
.reply-input:focus { outline: none; border-color: var(--accent); }

.reply-closed {
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255,255,255,.07);
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: .9rem;
  color: #888;
  flex-shrink: 0;
}

.notice {
  padding: 1rem 1.25rem;
  border-radius: .75rem;
  margin-bottom: 1.5rem;
  font-size: .9rem;
  border: 1px solid rgba(255,255,255,.1);
}

.toggle-pill {
  display: flex;
  align-items: center;
  gap: .5rem;
  cursor: pointer;
  padding: .4rem .9rem;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,.15);
  font-size: .9rem;
  user-select: none;
}
.toggle-pill input { display: none; }
.toggle-pill .dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #666;
  transition: background .2s;
}
.toggle-pill.active .dot { background: #22c55e; }

.badge-pill {
  padding: .3rem .75rem;
  border-radius: 20px;
  font-size: .8rem;
  font-weight: 700;
}
.badge-pill.accent {
  background: rgba(224,72,88,.2);
  color: var(--accent);
  border: 1px solid var(--accent);
}

.search-input {
  flex: 1;
  padding: .45rem .75rem;
  border-radius: .5rem;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  color: inherit;
  font-size: .85rem;
}
.search-input:focus { outline: none; border-color: var(--accent); }

.select-sm {
  padding: .45rem .65rem;
  border-radius: .5rem;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  color: inherit;
  font-size: .85rem;
}

@media (max-width: 768px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }
  .sessions-panel {
    display: none;
  }
}
</style>
