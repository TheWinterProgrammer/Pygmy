<template>
  <div class="support-page">
    <SiteNav />
    <div class="support-content">
      <div class="support-card glass">
        <h1>🎫 Support Center</h1>
        <p class="support-intro">Create a support ticket or check on an existing one. We're here to help!</p>

        <div class="support-tabs">
          <button :class="{ active: tab === 'new' }" @click="tab = 'new'">✉️ New Ticket</button>
          <button :class="{ active: tab === 'lookup' }" @click="tab = 'lookup'">🔍 Track Ticket</button>
        </div>

        <!-- New Ticket Tab -->
        <div v-if="tab === 'new'" class="tab-content">
          <div v-if="!submitted">
            <div class="form-grid">
              <label>Your Name *
                <input v-model="form.name" placeholder="Full name" />
              </label>
              <label>Email Address *
                <input v-model="form.email" type="email" placeholder="your@email.com" />
              </label>
              <label class="span2">Subject *
                <input v-model="form.subject" placeholder="Brief description of the issue" />
              </label>
              <label>Priority
                <select v-model="form.priority">
                  <option value="low">Low — General inquiry</option>
                  <option value="normal">Normal — Standard issue</option>
                  <option value="high">High — Significant problem</option>
                  <option value="urgent">Urgent — Order/payment issue</option>
                </select>
              </label>
              <label>Order Number (if applicable)
                <input v-model="form.order_number" placeholder="ORD-YYYYMMDD-XXXX" />
              </label>
              <label class="span2">Message *
                <textarea v-model="form.message" rows="5" placeholder="Please describe your issue in detail. The more info you provide, the faster we can help."></textarea>
              </label>
            </div>
            <button class="btn btn-primary full-width" :disabled="!canSubmit || submitting" @click="submitTicket">
              {{ submitting ? 'Sending…' : '↩️ Submit Ticket' }}
            </button>
          </div>

          <div class="success-state" v-else>
            <div class="success-icon">✅</div>
            <h2>Ticket Submitted!</h2>
            <p>Your ticket number is:</p>
            <div class="ticket-ref">#{{ ticketRef }}</div>
            <p>We'll reply to <strong>{{ form.email }}</strong> as soon as possible.</p>
            <div class="success-actions">
              <button class="btn btn-secondary" @click="resetForm">Submit Another</button>
              <button class="btn btn-primary" @click="tab = 'lookup'; lookupNum = ticketRef; lookupEmail = form.email; lookupTicket()">
                Track This Ticket
              </button>
            </div>
          </div>
        </div>

        <!-- Lookup Tab -->
        <div v-else-if="tab === 'lookup'" class="tab-content">
          <div v-if="!lookedUp">
            <p class="lookup-hint">Enter your ticket number and email address to check the status of your request.</p>
            <div class="form-grid">
              <label class="span2">Ticket Number *
                <input v-model="lookupNum" placeholder="TKT-20260101-1234" @keyup.enter="lookupTicket" />
              </label>
              <label class="span2">Email Address *
                <input v-model="lookupEmail" type="email" placeholder="The email you used when submitting" @keyup.enter="lookupTicket" />
              </label>
            </div>
            <button class="btn btn-primary full-width" :disabled="!lookupNum || !lookupEmail || lookingUp" @click="lookupTicket">
              {{ lookingUp ? 'Looking up…' : '🔍 Find My Ticket' }}
            </button>
            <p v-if="lookupError" class="error-msg">{{ lookupError }}</p>
          </div>

          <div v-else class="ticket-detail">
            <div class="ticket-header">
              <div class="ticket-num-row">
                <span class="ticket-num">{{ lookedUp.ticket.ticket_number }}</span>
                <span class="status-pill" :class="`status-${lookedUp.ticket.status}`">{{ statusLabel(lookedUp.ticket.status) }}</span>
                <span class="priority-pill" :class="`priority-${lookedUp.ticket.priority}`">{{ lookedUp.ticket.priority }}</span>
              </div>
              <h2 class="ticket-subject">{{ lookedUp.ticket.subject }}</h2>
              <p class="ticket-meta">Opened {{ fmtDate(lookedUp.ticket.created_at) }}</p>
            </div>

            <div class="messages-thread">
              <div
                v-for="msg in lookedUp.messages"
                :key="msg.id"
                class="message-row"
                :class="`msg-${msg.sender}`"
              >
                <div class="msg-avatar">{{ msg.sender === 'customer' ? '👤' : '💼' }}</div>
                <div class="msg-content">
                  <div class="msg-meta">
                    <strong>{{ msg.sender === 'customer' ? 'You' : msg.sender_name }}</strong>
                    <span class="msg-time">{{ fmtDatetime(msg.created_at) }}</span>
                  </div>
                  <div class="msg-text">{{ msg.message }}</div>
                </div>
              </div>
            </div>

            <!-- Customer reply (if ticket not closed) -->
            <div v-if="lookedUp.ticket.status !== 'closed' && lookedUp.ticket.status !== 'resolved'" class="reply-section">
              <h3>Send a follow-up</h3>
              <textarea v-model="replyText" rows="3" placeholder="Add a follow-up message…" class="reply-textarea"></textarea>
              <button class="btn btn-primary" :disabled="!replyText.trim() || sendingReply" @click="sendReply">
                {{ sendingReply ? 'Sending…' : '↩️ Send Reply' }}
              </button>
            </div>

            <div class="lookup-reset">
              <button class="btn btn-secondary" @click="lookedUp = null; lookupNum = ''; lookupEmail = ''">Look up another ticket</button>
            </div>
          </div>
        </div>

      </div>
    </div>
    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const API = 'http://localhost:3200/api'
const tab = ref('new')

// New ticket
const form = ref({ name: '', email: '', subject: '', message: '', priority: 'normal', order_number: '' })
const submitting = ref(false)
const submitted = ref(false)
const ticketRef = ref('')

const canSubmit = computed(() => form.value.name && form.value.email && form.value.subject && form.value.message)

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
        priority: form.value.priority,
        order_number: form.value.order_number || undefined,
        channel: 'widget',
      }),
    })
    const data = await res.json()
    ticketRef.value = data.ticket_number
    submitted.value = true
  } catch {
    alert('Failed to submit. Please try again.')
  }
  submitting.value = false
}

function resetForm() {
  form.value = { name: '', email: '', subject: '', message: '', priority: 'normal', order_number: '' }
  submitted.value = false
  ticketRef.value = ''
}

// Lookup
const lookupNum = ref('')
const lookupEmail = ref('')
const lookingUp = ref(false)
const lookupError = ref('')
const lookedUp = ref(null)
const replyText = ref('')
const sendingReply = ref(false)

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
    lookedUp.value = await res.json()
    replyText.value = ''
  } catch { lookupError.value = 'An error occurred. Please try again.' }
  lookingUp.value = false
}

async function sendReply() {
  if (!replyText.value.trim() || sendingReply.value) return
  sendingReply.value = true
  try {
    await fetch(`${API}/support/${lookedUp.value.ticket.ticket_number}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lookupEmail.value, message: replyText.value, sender_name: lookedUp.value.ticket.customer_name }),
    })
    await lookupTicket()
    replyText.value = ''
  } catch { alert('Failed to send reply.') }
  sendingReply.value = false
}

function statusLabel(s) {
  return { open: 'Open', in_progress: 'In Progress', waiting: 'Waiting', resolved: 'Resolved', closed: 'Closed' }[s] || s
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDatetime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.support-page { min-height: 100vh; background: hsl(228, 4%, 10%); }
.support-content { max-width: 720px; margin: 0 auto; padding: 6rem 1.5rem 4rem; }
.support-card { padding: 2.5rem; border-radius: 2rem; }
.support-card h1 { margin: 0 0 .5rem; font-size: 1.8rem; }
.support-intro { color: #888; margin: 0 0 2rem; }

.support-tabs { display: flex; gap: .5rem; margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,.08); padding-bottom: .75rem; }
.support-tabs button { background: none; border: none; padding: .5rem 1rem; border-radius: .5rem; color: #888; cursor: pointer; font-family: inherit; font-size: .9rem; transition: all .15s; }
.support-tabs button.active { background: rgba(176,48,58,.2); color: var(--accent); border: 1px solid rgba(176,48,58,.3); }

.tab-content { display: flex; flex-direction: column; gap: 1rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.form-grid label { display: flex; flex-direction: column; gap: .35rem; font-size: .82rem; color: #888; }
.form-grid input, .form-grid select, .form-grid textarea {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  border-radius: .6rem; color: #e2e2e8; padding: .6rem .85rem; font-family: inherit; font-size: .88rem;
}
.form-grid textarea { resize: vertical; }
.span2 { grid-column: span 2; }

.btn { padding: .6rem 1.4rem; border-radius: .6rem; cursor: pointer; font-weight: 600; font-size: .9rem; border: none; font-family: inherit; transition: all .15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { opacity: .87; }
.btn-primary:disabled { opacity: .5; cursor: default; }
.btn-secondary { background: rgba(255,255,255,.1); color: #e2e2e8; }
.btn-secondary:hover { background: rgba(255,255,255,.15); }
.full-width { width: 100%; }

.success-state { text-align: center; padding: 2rem 0; display: flex; flex-direction: column; align-items: center; gap: .75rem; }
.success-icon { font-size: 3rem; }
.success-state h2 { margin: 0; }
.ticket-ref { background: rgba(176,48,58,.2); border: 1px solid var(--accent); border-radius: .6rem; padding: .4rem 1rem; font-weight: 700; color: var(--accent); font-family: monospace; font-size: 1.1rem; }
.success-actions { display: flex; gap: .75rem; }

.lookup-hint { color: #888; margin: 0 0 1rem; font-size: .88rem; }
.error-msg { color: var(--accent); font-size: .85rem; margin-top: .5rem; }

/* Ticket detail */
.ticket-detail { display: flex; flex-direction: column; gap: 1.5rem; }
.ticket-header { padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.ticket-num-row { display: flex; align-items: center; gap: .75rem; margin-bottom: .5rem; }
.ticket-num { font-family: monospace; color: var(--accent); font-weight: 700; font-size: .95rem; }
.ticket-subject { margin: 0 0 .25rem; font-size: 1.25rem; }
.ticket-meta { margin: 0; font-size: .8rem; color: #888; }

.status-pill, .priority-pill { padding: .2rem .6rem; border-radius: .5rem; font-size: .72rem; font-weight: 600; text-transform: capitalize; }
.status-open { background: rgba(52,199,89,.15); color: #34c759; }
.status-in_progress { background: rgba(255,159,10,.15); color: #ff9f0a; }
.status-waiting { background: rgba(90,200,250,.15); color: #5ac8fa; }
.status-resolved, .status-closed { background: rgba(99,99,102,.15); color: #8e8e93; }
.priority-urgent { background: rgba(255,59,48,.15); color: #ff3b30; }
.priority-high { background: rgba(255,149,0,.15); color: #ff9500; }
.priority-normal { background: rgba(255,255,255,.08); color: #aeaeb2; }
.priority-low { background: rgba(99,99,102,.1); color: #636366; }

.messages-thread { display: flex; flex-direction: column; gap: 1rem; }
.message-row { display: flex; gap: 1rem; }
.msg-agent { flex-direction: row-reverse; }
.msg-avatar { font-size: 1.5rem; flex-shrink: 0; width: 2rem; text-align: center; }
.msg-content { flex: 1; max-width: 85%; }
.msg-agent .msg-content { text-align: right; }
.msg-meta { display: flex; align-items: center; gap: .5rem; margin-bottom: .3rem; font-size: .8rem; }
.msg-agent .msg-meta { justify-content: flex-end; }
.msg-time { color: #888; }
.msg-text {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  border-radius: 1rem; padding: .75rem 1rem; font-size: .88rem; color: #d0d0d8; line-height: 1.5;
  white-space: pre-wrap;
}
.msg-agent .msg-text { background: rgba(176,48,58,.12); border-color: rgba(176,48,58,.25); }

.reply-section { border-top: 1px solid rgba(255,255,255,.08); padding-top: 1.25rem; }
.reply-section h3 { margin: 0 0 .75rem; font-size: 1rem; color: #e2e2e8; }
.reply-textarea { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .6rem; color: #e2e2e8; padding: .6rem .85rem; font-family: inherit; font-size: .88rem; resize: vertical; box-sizing: border-box; margin-bottom: .75rem; }

.lookup-reset { display: flex; justify-content: flex-start; }

.glass { background: rgba(255,255,255,.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.1); }
</style>
