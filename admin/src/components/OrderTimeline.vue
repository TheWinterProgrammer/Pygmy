<template>
  <div class="order-timeline">
    <h3 style="margin: 0 0 16px; font-size: 16px;">📋 Order Timeline</h3>

    <!-- Timeline list -->
    <div class="timeline-list" v-if="events.length">
      <div
        v-for="event in events"
        :key="event.id"
        class="timeline-item"
        :class="`type-${event.event_type}`"
      >
        <div class="timeline-dot">{{ event.icon }}</div>
        <div class="timeline-content">
          <div class="timeline-message">{{ event.message }}</div>
          <div class="timeline-meta">
            <span>{{ event.created_by }}</span>
            <span>·</span>
            <span>{{ formatTime(event.created_at) }}</span>
            <span v-if="event.is_customer_visible" class="visibility-badge">👁 Visible to customer</span>
          </div>
        </div>
        <button
          v-if="event.event_type === 'note'"
          class="timeline-delete"
          @click="deleteEvent(event)"
          title="Delete note"
        >✕</button>
      </div>
    </div>
    <div class="empty-state-sm" v-else>No events yet.</div>

    <!-- Add note form -->
    <div class="add-note-form glass" style="margin-top:16px;padding:16px;border-radius:12px;">
      <div class="form-group" style="margin-bottom:10px;">
        <select v-model="newType" class="form-select form-select-sm">
          <option value="note">📝 Note</option>
          <option value="payment">💳 Payment</option>
          <option value="shipment">📦 Shipment</option>
          <option value="refund">↩️ Refund</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:10px;">
        <textarea
          v-model="newMessage"
          class="form-input"
          rows="2"
          placeholder="Add a note or event…"
          @keydown.ctrl.enter="addEvent"
        ></textarea>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <label class="toggle-label" style="font-size:13px;">
          <input type="checkbox" v-model="newVisible" />
          <span>Visible to customer</span>
        </label>
        <button class="btn btn-primary btn-sm" @click="addEvent" :disabled="!newMessage.trim() || adding">
          {{ adding ? '…' : '+ Add' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({ orderId: Number })
const emit = defineEmits([])

const API = 'http://localhost:3200/api'
const token = localStorage.getItem('pygmy_token')

const events = ref([])
const newType = ref('note')
const newMessage = ref('')
const newVisible = ref(false)
const adding = ref(false)

async function load() {
  if (!props.orderId) return
  try {
    const res = await fetch(`${API}/order-timeline/${props.orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    events.value = await res.json()
  } catch {}
}

async function addEvent() {
  if (!newMessage.value.trim()) return
  adding.value = true
  try {
    const res = await fetch(`${API}/order-timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        order_id: props.orderId,
        event_type: newType.value,
        message: newMessage.value.trim(),
        is_customer_visible: newVisible.value,
      }),
    })
    if (res.ok) {
      const event = await res.json()
      events.value.push(event)
      newMessage.value = ''
      newType.value = 'note'
      newVisible.value = false
    }
  } catch {}
  adding.value = false
}

async function deleteEvent(event) {
  if (!confirm('Delete this note?')) return
  try {
    await fetch(`${API}/order-timeline/${event.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    events.value = events.value.filter(e => e.id !== event.id)
  } catch {}
}

function formatTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

watch(() => props.orderId, (id) => { if (id) load() }, { immediate: true })
</script>

<style scoped>
.timeline-list { display: flex; flex-direction: column; gap: 0; position: relative; }
.timeline-list::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  background: rgba(255,255,255,0.08);
}
.timeline-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 0;
  position: relative;
}
.timeline-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  z-index: 1;
}
.timeline-item.type-status_change .timeline-dot { border-color: var(--accent); }
.timeline-item.type-shipment .timeline-dot { border-color: #3b82f6; }
.timeline-item.type-payment .timeline-dot { border-color: #22c55e; }
.timeline-item.type-refund .timeline-dot { border-color: #f59e0b; }
.timeline-item.type-system .timeline-dot { border-color: rgba(255,255,255,0.2); }

.timeline-content { flex: 1; }
.timeline-message { font-size: 14px; color: var(--text); }
.timeline-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}
.visibility-badge {
  background: rgba(255,255,255,0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
}
.timeline-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.timeline-item:hover .timeline-delete { opacity: 1; }
.timeline-delete:hover { color: var(--accent); }
.empty-state-sm { color: var(--text-muted); font-size: 13px; padding: 8px 0; }
.form-select-sm { padding: 6px 10px; font-size: 13px; }
.btn-sm { padding: 6px 14px; font-size: 13px; }
</style>
