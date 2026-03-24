<template>
  <!-- Hidden when chat is disabled -->
  <div v-if="config && config.enabled" class="live-chat-widget">

    <!-- Chat Window -->
    <transition name="chat-slide">
      <div v-if="open" class="chat-window glass-card" :style="accentStyle">
        <!-- Header -->
        <div class="chat-header">
          <div class="header-info">
            <div class="status-dot" :class="{ online: config.is_online }"></div>
            <div>
              <div class="header-title">{{ config.button_label || 'Live Chat' }}</div>
              <div class="header-status">{{ config.is_online ? '🟢 Online' : '⚫ Offline' }}</div>
            </div>
          </div>
          <button @click="open = false" class="close-btn" aria-label="Close chat">✕</button>
        </div>

        <!-- Info form (before session starts) -->
        <div v-if="!sessionId && !startedAsGuest" class="chat-intro">
          <p class="greeting">{{ config.greeting }}</p>
          <div v-if="!config.is_online" class="offline-msg">
            <p>{{ config.offline_message }}</p>
          </div>
          <div class="intro-form">
            <input v-model="visitorName" placeholder="Your name (optional)" class="chat-input" />
            <input v-model="visitorEmail" placeholder="Your email (optional)" class="chat-input" type="email" />
            <button @click="startChat" class="start-btn" :style="btnStyle">
              💬 {{ config.is_online ? 'Start Chat' : 'Leave a Message' }}
            </button>
          </div>
        </div>

        <!-- Message thread -->
        <div v-else class="chat-messages" ref="messagesEl">
          <div v-if="messages.length === 0" class="chat-empty">
            <p>{{ config.greeting }}</p>
            <p v-if="!config.is_online" class="offline-notice">{{ config.offline_message }}</p>
          </div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="chat-msg"
            :class="msg.sender === 'visitor' ? 'outgoing' : 'incoming'"
          >
            <div class="msg-bubble">{{ msg.body }}</div>
            <div class="msg-meta">
              <span v-if="msg.sender !== 'visitor'" class="sender-name">{{ formatSender(msg.sender) }}</span>
              <span class="msg-time">{{ fmtTime(msg.created_at) }}</span>
            </div>
          </div>
          <div v-if="sessionClosed" class="session-closed">
            Chat session ended. <a href="#" @click.prevent="resetChat">Start a new chat →</a>
          </div>
        </div>

        <!-- Composer -->
        <div v-if="sessionId && !sessionClosed" class="chat-composer">
          <textarea
            v-model="draft"
            placeholder="Type a message…"
            class="composer-input"
            @keydown.enter.exact.prevent="send"
            rows="2"
          ></textarea>
          <button @click="send" class="send-btn" :style="btnStyle" :disabled="!draft.trim() || sending">
            {{ sending ? '…' : '➤' }}
          </button>
        </div>
      </div>
    </transition>

    <!-- Launcher bubble -->
    <button
      class="chat-bubble"
      :style="bubbleStyle"
      @click="open = !open"
      :aria-label="open ? 'Close chat' : 'Open chat'"
    >
      <span v-if="!open">{{ config.button_label ? '💬' : '💬' }}</span>
      <span v-else>✕</span>
      <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import api from '../api.js'

const open = ref(false)
const config = ref(null)
const sessionId = ref(null)
const sessionClosed = ref(false)
const messages = ref([])
const draft = ref('')
const sending = ref(false)
const unreadCount = ref(0)
const visitorName = ref('')
const visitorEmail = ref('')
const startedAsGuest = ref(false)
const messagesEl = ref(null)
const lastMsgId = ref(0)
let pollInterval = null

// Stable session key per browser
const sessionKey = (() => {
  let k = localStorage.getItem('pygmy_chat_key')
  if (!k) {
    k = 'chat-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('pygmy_chat_key', k)
  }
  return k
})()

const accentStyle = computed(() => ({
  '--chat-accent': config.value?.color || 'hsl(355,70%,58%)'
}))

const btnStyle = computed(() => ({
  background: config.value?.color || 'hsl(355,70%,58%)'
}))

const bubbleStyle = computed(() => ({
  background: config.value?.color || 'hsl(355,70%,58%)'
}))

onMounted(async () => {
  try {
    const res = await api.get('/live-chat/config')
    config.value = res.data
    if (!config.value.enabled) return

    // Resume existing session if any
    const savedSessionId = localStorage.getItem('pygmy_chat_session_id')
    if (savedSessionId) {
      sessionId.value = parseInt(savedSessionId)
      startedAsGuest.value = true
      await pollMessages()
      startPolling()
    }
  } catch {}
})

onUnmounted(() => {
  stopPolling()
})

async function startChat() {
  startedAsGuest.value = true
  try {
    const res = await api.post('/live-chat/session', {
      session_key: sessionKey,
      visitor_name: visitorName.value || 'Visitor',
      visitor_email: visitorEmail.value || '',
      page_url: window.location.href,
    })
    sessionId.value = res.data.session_id
    localStorage.setItem('pygmy_chat_session_id', sessionId.value)
    await pollMessages()
    startPolling()
    scrollToBottom()
  } catch {}
}

async function send() {
  if (!draft.value.trim() || sending.value) return
  if (!sessionId.value) await startChat()
  sending.value = true
  try {
    await api.post('/live-chat/message', { session_key: sessionKey, body: draft.value.trim() })
    draft.value = ''
    await pollMessages()
    scrollToBottom()
  } finally {
    sending.value = false
  }
}

async function pollMessages() {
  if (!sessionId.value) return
  try {
    const res = await api.get(`/live-chat/poll/${sessionKey}`, { params: { since: lastMsgId.value } })
    const data = res.data

    if (data.status === 'closed') {
      sessionClosed.value = true
      stopPolling()
    }

    if (data.messages?.length) {
      messages.value.push(...data.messages)
      lastMsgId.value = data.messages[data.messages.length - 1].id

      const newAdminMsgs = data.messages.filter(m => m.sender !== 'visitor')
      if (!open.value && newAdminMsgs.length) {
        unreadCount.value += newAdminMsgs.length
      }

      await nextTick()
      scrollToBottom()
    }
  } catch {}
}

function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(pollMessages, 4000)
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

function resetChat() {
  sessionId.value = null
  sessionClosed.value = false
  messages.value = []
  lastMsgId.value = 0
  startedAsGuest.value = false
  localStorage.removeItem('pygmy_chat_session_id')
  localStorage.removeItem('pygmy_chat_key')
}

function formatSender(sender) {
  // Sender format is "admin:Name"
  if (sender.startsWith('admin:')) return sender.split(':')[1] || 'Support'
  return sender
}

function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Clear unread when opened
function handleOpen() {
  open.value = true
  unreadCount.value = 0
}
</script>

<style scoped>
.live-chat-widget {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: .75rem;
}

/* Chat bubble launcher */
.chat-bubble {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,.4);
  transition: transform .2s, box-shadow .2s;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,0,0,.5); }
.unread-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #fff;
  color: var(--chat-accent, hsl(355,70%,58%));
  border-radius: 50%;
  width: 1.2rem;
  height: 1.2rem;
  font-size: .7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Chat window */
.chat-window {
  width: 340px;
  height: 480px;
  border-radius: 1.25rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,.5);
  background: hsl(228,4%,13%);
  border: 1px solid rgba(255,255,255,.1);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .9rem 1rem;
  background: var(--chat-accent, hsl(355,70%,58%));
}
.header-info { display: flex; gap: .6rem; align-items: center; }
.status-dot { width: .6rem; height: .6rem; border-radius: 50%; background: rgba(255,255,255,.4); flex-shrink: 0; }
.status-dot.online { background: #5ac878; }
.header-title { font-weight: 600; font-size: .9rem; color: #fff; }
.header-status { font-size: .72rem; color: rgba(255,255,255,.7); }
.close-btn { background: none; border: none; color: rgba(255,255,255,.8); font-size: 1rem; cursor: pointer; padding: .2rem; }
.close-btn:hover { color: #fff; }

.chat-intro {
  flex: 1;
  padding: 1.25rem;
  overflow-y: auto;
}
.greeting { color: #ccc; font-size: .9rem; margin: 0 0 .75rem; }
.offline-msg { background: rgba(255,255,255,.06); border-radius: .6rem; padding: .75rem; margin-bottom: .75rem; }
.offline-msg p { margin: 0; font-size: .85rem; color: #aaa; }
.intro-form { display: flex; flex-direction: column; gap: .6rem; }
.chat-input {
  padding: .5rem .75rem;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: .6rem;
  color: inherit;
  font-size: .88rem;
}
.start-btn {
  padding: .6rem 1rem;
  border: none;
  border-radius: .6rem;
  color: #fff;
  font-size: .9rem;
  cursor: pointer;
  font-weight: 600;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}
.chat-empty { color: #aaa; font-size: .85rem; text-align: center; padding: 1rem 0; }
.offline-notice { font-size: .82rem; color: #888; margin-top: .5rem; }

.chat-msg { display: flex; flex-direction: column; }
.chat-msg.outgoing { align-items: flex-end; }
.chat-msg.incoming { align-items: flex-start; }

.msg-bubble {
  max-width: 80%;
  padding: .5rem .8rem;
  border-radius: 1rem;
  font-size: .88rem;
  line-height: 1.4;
  word-break: break-word;
}
.outgoing .msg-bubble {
  background: var(--chat-accent, hsl(355,70%,58%));
  color: #fff;
  border-bottom-right-radius: .25rem;
}
.incoming .msg-bubble {
  background: rgba(255,255,255,.08);
  color: inherit;
  border-bottom-left-radius: .25rem;
}
.msg-meta { display: flex; gap: .4rem; align-items: center; margin-top: .2rem; }
.sender-name { font-size: .72rem; color: #888; }
.msg-time { font-size: .7rem; color: #666; }

.session-closed {
  text-align: center;
  font-size: .82rem;
  color: #888;
  padding: .5rem;
}
.session-closed a { color: var(--chat-accent, hsl(355,70%,58%)); text-decoration: none; }

.chat-composer {
  display: flex;
  gap: .5rem;
  align-items: flex-end;
  padding: .75rem;
  border-top: 1px solid rgba(255,255,255,.08);
}
.composer-input {
  flex: 1;
  padding: .5rem .75rem;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: .75rem;
  color: inherit;
  font-size: .88rem;
  resize: none;
  font-family: inherit;
  line-height: 1.4;
}
.send-btn {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 1rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.send-btn:disabled { opacity: .5; cursor: not-allowed; }

/* Transition */
.chat-slide-enter-active, .chat-slide-leave-active { transition: opacity .2s, transform .2s; }
.chat-slide-enter-from, .chat-slide-leave-to { opacity: 0; transform: translateY(1rem) scale(.97); }

/* Mobile */
@media(max-width: 480px) {
  .chat-window { width: calc(100vw - 2rem); }
}
</style>
