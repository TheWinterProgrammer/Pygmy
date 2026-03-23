<template>
  <div class="support-widget" v-if="enabled">
    <!-- Floating bubble -->
    <button class="support-bubble" @click="toggleChat" :class="{ open: isOpen }" :title="isOpen ? 'Close support' : 'Get help'">
      <span v-if="!isOpen">💬</span>
      <span v-else>✕</span>
    </button>

    <!-- Chat panel -->
    <transition name="chat-slide">
      <div class="chat-panel glass" v-if="isOpen">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-avatar">🎫</div>
          <div class="chat-header-info">
            <span class="chat-title">{{ siteName }} Support</span>
            <span class="chat-status" :class="{ online: status?.online }">
              {{ status?.online ? '● Online' : '○ Offline' }}
            </span>
          </div>
        </div>

        <!-- State: initial / form / messages / submitted -->
        <!-- Initial greeting -->
        <div class="chat-body" v-if="view === 'greeting'">
          <div class="chat-greeting">
            <p>{{ status?.greeting || 'Hi! How can we help?' }}</p>
            <p v-if="!status?.online" class="offline-msg">{{ status?.offline_msg }}</p>
          </div>
          <div class="chat-options">
            <button class="chat-option-btn" @click="view = 'newTicket'">
              ✉️ Send us a message
            </button>
            <button class="chat-option-btn" @click="view = 'lookup'">
              🔍 Check ticket status
            </button>
          </div>
        </div>

        <!-- New ticket form -->
        <div class="chat-body" v-else-if="view === 'newTicket'">
          <button class="back-btn" @click="view = 'greeting'">← Back</button>
          <h3 class="chat-subheading">Send us a message</h3>
          <div class="chat-form" v-if="!submitted">
            <label>Your Name *
              <input v-model="form.name" placeholder="Full name" />
            </label>
            <label>Email *
              <input v-model="form.email" type="email" placeholder="your@email.com" />
            </label>
            <label>Subject *
              <input v-model="form.subject" placeholder="How can we help?" />
            </label>
            <label>Message *
              <textarea v-model="form.message" rows="3" placeholder="Describe your issue…"></textarea>
            </label>
            <button class="chat-submit-btn" :disabled="!canSubmit || submitting" @click="submitTicket">
              {{ submitting ? 'Sending…' : '↩️ Send Message' }}
            </button>
          </div>
          <div class="chat-success" v-else>
            <div class="success-icon">✅</div>
            <p>Message received! Your ticket number is:</p>
            <div class="ticket-ref">#{{ ticketRef }}</div>
            <p class="success-hint">We'll reply to <strong>{{ form.email }}</strong> as soon as possible.</p>
            <button class="chat-option-btn" @click="view = 'lookup'; lookupNum = ticketRef; lookupEmail = form.email; lookupTicket()">
              View my ticket
            </button>
          </div>
        </div>

        <!-- Lookup ticket -->
        <div class="chat-body" v-else-if="view === 'lookup'">
          <button class="back-btn" @click="view = 'greeting'; lookedUp = null">← Back</button>
          <h3 class="chat-subheading">Check ticket status</h3>

          <div v-if="!lookedUp">
            <label>Ticket number
              <input v-model="lookupNum" placeholder="TKT-20260101-1234" />
            </label>
            <label>Your email
              <input v-model="lookupEmail" type="email" placeholder="your@email.com" />
            </label>
            <button class="chat-submit-btn" :disabled="!lookupNum || !lookupEmail || lookingUp" @click="lookupTicket">
              {{ lookingUp ? 'Looking up…' : '🔍 Find Ticket' }}
            </button>
            <p v-if="lookupError" class="lookup-error">{{ lookupError }}</p>
          </div>

          <!-- Ticket thread -->
          <div v-else class="lookup-result">
            <div class="ticket-meta">
              <span class="ticket-ref">#{{ lookedUp.ticket.ticket_number }}</span>
              <span class="status-pill" :class="`status-${lookedUp.ticket.status}`">{{ statusLabel(lookedUp.ticket.status) }}</span>
            </div>
            <div class="ticket-subject">{{ lookedUp.ticket.subject }}</div>

            <div class="mini-thread">
              <div
                v-for="msg in lookedUp.messages"
                :key="msg.id"
                class="mini-msg"
                :class="`mini-${msg.sender}`"
              >
                <strong>{{ msg.sender === 'customer' ? 'You' : 'Support' }}</strong>
                <span class="mini-time">{{ fmtDate(msg.created_at) }}</span>
                <p>{{ msg.message }}</p>
              </div>
            </div>

            <!-- Reply from customer -->
            <div v-if="lookedUp.ticket.status !== 'closed' && lookedUp.ticket.status !== 'resolved'" class="lookup-reply">
              <textarea v-model="lookupReply" rows="2" placeholder="Add a follow-up message…"></textarea>
              <button class="chat-submit-btn small" :disabled="!lookupReply.trim() || sendingReply" @click="sendLookupReply">
                {{ sendingReply ? '…' : 'Send' }}
              </button>
            </div>

            <button class="back-btn" style="margin-top:.75rem" @click="lookedUp = null; lookupNum = ''; lookupEmail = ''">Look up another</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const API = 'http://localhost:3200/api'
const enabled = ref(false)
const status = ref(null)
const siteName = ref('Support')
const isOpen = ref(false)
const view = ref('greeting')

// New ticket
const form = ref({ name: '', email: '', subject: '', message: '' })
const submitting = ref(false)
const submitted = ref(false)
const ticketRef = ref('')

// Lookup
const lookupNum = ref('')
const lookupEmail = ref('')
const lookingUp = ref(false)
const lookupError = ref('')
const lookedUp = ref(null)
const lookupReply = ref('')
const sendingReply = ref(false)

const canSubmit = computed(() => form.value.name && form.value.email && form.value.subject && form.value.message)

async function loadStatus() {
  try {
    const res = await fetch(`${API}/support/status`)
    const data = await res.json()
    enabled.value = data.enabled
    status.value = data
  } catch {}
}

async function loadSiteName() {
  try {
    const res = await fetch(`${API}/settings`)
    const data = await res.json()
    siteName.value = data.site_name || 'Support'
  } catch {}
}

function toggleChat() {
  isOpen.value = !isOpen.value
  if (isOpen.value && view.value === 'greeting') {
    submitted.value = false
  }
}

async function submitTicket() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const res = await fetch(`${API}/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: form.value.subject,
        customer_name: form.value.name,
        customer_email: form.value.email,
        message: form.value.message,
        channel: 'widget',
      }),
    })
    const data = await res.json()
    ticketRef.value = data.ticket_number
    submitted.value = true
  } catch {
    alert('Failed to send. Please try again.')
  }
  submitting.value = false
}

async function lookupTicket() {
  if (!lookupNum.value || !lookupEmail.value) return
  lookingUp.value = true
  lookupError.value = ''
  try {
    const res = await fetch(`${API}/support/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_number: lookupNum.value.trim(), email: lookupEmail.value.trim() }),
    })
    if (!res.ok) { lookupError.value = 'Ticket not found. Check your ticket number and email.'; lookingUp.value = false; return }
    const data = await res.json()
    lookedUp.value = data
    lookupReply.value = ''
  } catch { lookupError.value = 'Error looking up ticket.' }
  lookingUp.value = false
}

async function sendLookupReply() {
  if (!lookupReply.value.trim() || sendingReply.value) return
  sendingReply.value = true
  try {
    await fetch(`${API}/support/${lookedUp.value.ticket.ticket_number}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lookupEmail.value, message: lookupReply.value, sender_name: lookedUp.value.ticket.customer_name }),
    })
    // Reload thread
    await lookupTicket()
    lookupReply.value = ''
  } catch {}
  sendingReply.value = false
}

function statusLabel(s) {
  return { open: 'Open', in_progress: 'In Progress', waiting: 'Waiting', resolved: 'Resolved', closed: 'Closed' }[s] || s
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  await Promise.all([loadStatus(), loadSiteName()])
})
</script>

<style scoped>
.support-widget { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999; font-family: 'Poppins', sans-serif; }

.support-bubble {
  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
  background: hsl(355, 70%, 58%); color: #fff; font-size: 1.4rem;
  box-shadow: 0 4px 20px rgba(176,48,58,.5);
  transition: transform .2s, box-shadow .2s;
  display: flex; align-items: center; justify-content: center;
}
.support-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(176,48,58,.6); }
.support-bubble.open { background: rgba(255,255,255,.15); }

.chat-panel {
  position: absolute; bottom: 70px; right: 0;
  width: 340px; max-height: 520px;
  border-radius: 1.5rem; overflow: hidden;
  display: flex; flex-direction: column;
  background: hsl(228, 4%, 13%);
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 8px 40px rgba(0,0,0,.5);
}
.chat-slide-enter-active, .chat-slide-leave-active { transition: all .25s cubic-bezier(.4,0,.2,1); }
.chat-slide-enter-from, .chat-slide-leave-to { opacity: 0; transform: translateY(12px) scale(.97); }

.chat-header {
  display: flex; align-items: center; gap: .75rem;
  padding: 1rem 1.25rem;
  background: hsl(355, 70%, 45%);
  flex-shrink: 0;
}
.chat-avatar { font-size: 1.5rem; }
.chat-header-info { display: flex; flex-direction: column; }
.chat-title { font-weight: 600; color: #fff; font-size: .9rem; }
.chat-status { font-size: .72rem; color: rgba(255,255,255,.7); }
.chat-status.online { color: #7fdd7f; }

.chat-body { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: .75rem; }

.chat-greeting { text-align: center; padding: .75rem 0; }
.chat-greeting p { color: #c0c0cc; font-size: .9rem; margin: 0 0 .5rem; }
.offline-msg { font-size: .8rem; color: #888; font-style: italic; }
.chat-options { display: flex; flex-direction: column; gap: .5rem; }
.chat-option-btn {
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
  border-radius: .75rem; color: #e2e2e8; padding: .65rem 1rem; cursor: pointer;
  text-align: left; font-size: .85rem; font-family: inherit; transition: background .15s;
}
.chat-option-btn:hover { background: rgba(255,255,255,.12); }

.back-btn { background: none; border: none; color: #888; cursor: pointer; font-size: .8rem; padding: 0; margin-bottom: .25rem; text-align: left; }
.back-btn:hover { color: #e2e2e8; }
.chat-subheading { margin: 0 0 .75rem; font-size: .95rem; color: #e2e2e8; }

.chat-form { display: flex; flex-direction: column; gap: .5rem; }
.chat-form label { display: flex; flex-direction: column; gap: .2rem; font-size: .75rem; color: #888; }
.chat-form input, .chat-form textarea {
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
  border-radius: .5rem; color: #e2e2e8; padding: .45rem .65rem; font-family: inherit; font-size: .85rem;
}
.chat-form textarea { resize: vertical; }
.chat-submit-btn {
  background: hsl(355, 70%, 58%); color: #fff; border: none; border-radius: .6rem;
  padding: .55rem 1rem; cursor: pointer; font-weight: 600; font-size: .85rem; font-family: inherit;
  transition: opacity .15s; margin-top: .25rem;
}
.chat-submit-btn:hover:not(:disabled) { opacity: .88; }
.chat-submit-btn:disabled { opacity: .5; cursor: default; }
.chat-submit-btn.small { padding: .35rem .75rem; font-size: .8rem; }

.chat-success { text-align: center; padding: .5rem 0; display: flex; flex-direction: column; align-items: center; gap: .5rem; }
.success-icon { font-size: 2rem; }
.ticket-ref { background: rgba(176,48,58,.2); border: 1px solid hsl(355,70%,58%); border-radius: .5rem; padding: .3rem .8rem; font-weight: 700; color: hsl(355,70%,58%); font-family: monospace; }
.success-hint { font-size: .8rem; color: #888; }

/* Lookup */
.lookup-result { display: flex; flex-direction: column; gap: .5rem; }
.ticket-meta { display: flex; align-items: center; gap: .5rem; }
.ticket-subject { font-weight: 600; font-size: .9rem; color: #e2e2e8; }
.status-pill { padding: .15rem .5rem; border-radius: .4rem; font-size: .7rem; font-weight: 600; }
.status-open { background: rgba(52,199,89,.15); color: #34c759; }
.status-in_progress { background: rgba(255,159,10,.15); color: #ff9f0a; }
.status-waiting { background: rgba(90,200,250,.15); color: #5ac8fa; }
.status-resolved, .status-closed { background: rgba(99,99,102,.15); color: #8e8e93; }
.mini-thread { display: flex; flex-direction: column; gap: .4rem; max-height: 180px; overflow-y: auto; }
.mini-msg { background: rgba(255,255,255,.05); border-radius: .6rem; padding: .5rem .7rem; font-size: .8rem; }
.mini-customer { background: rgba(176,48,58,.1); }
.mini-msg strong { font-size: .75rem; color: #aaa; }
.mini-msg .mini-time { font-size: .68rem; color: #666; margin-left: .5rem; }
.mini-msg p { margin: .25rem 0 0; color: #c0c0cc; }
.lookup-reply { display: flex; gap: .4rem; }
.lookup-reply textarea { flex: 1; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; color: #e2e2e8; padding: .4rem .6rem; font-family: inherit; font-size: .8rem; resize: none; }
.lookup-error { color: hsl(355,70%,58%); font-size: .8rem; }

.glass { backdrop-filter: blur(16px); }
</style>
