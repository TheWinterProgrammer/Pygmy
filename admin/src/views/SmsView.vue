<template>
  <div>
    <div class="page-header">
      <h1>📱 SMS Notifications</h1>
      <button class="btn btn-primary" @click="saveSettings" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save Settings' }}
      </button>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Sent</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">{{ stats.sent }}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat-card" :class="{ danger: stats.failed > 0 }">
        <div class="stat-value">{{ stats.failed }}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.today }}</div>
        <div class="stat-label">Today</div>
      </div>
    </div>

    <div class="two-col">
      <!-- Settings Panel -->
      <div class="settings-panel glass section">
        <h3>⚙️ Provider Settings</h3>

        <div class="field">
          <label>
            <input type="checkbox" v-model="s.sms_enabled_bool" /> Enable SMS Notifications
          </label>
        </div>

        <div class="field">
          <label>Provider</label>
          <select v-model="s.sms_provider" class="input">
            <option value="twilio">Twilio</option>
          </select>
        </div>

        <div class="field">
          <label>Account SID</label>
          <input v-model="s.sms_account_sid" class="input" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
        <div class="field">
          <label>Auth Token</label>
          <input v-model="s.sms_auth_token" type="password" class="input" placeholder="••••••••••••••••••••••••••••••••" />
        </div>
        <div class="field">
          <label>From Number (E.164)</label>
          <input v-model="s.sms_from_number" class="input" placeholder="+1234567890" />
        </div>

        <hr class="divider" />
        <h3>🔔 Triggers</h3>

        <div class="field">
          <label>
            <input type="checkbox" v-model="s.sms_order_confirm_bool" />
            Send SMS on new order to customer
          </label>
        </div>
        <div class="field" v-if="s.sms_order_confirm_bool">
          <label>Order Confirmation Message</label>
          <textarea v-model="s.sms_order_message" class="input" rows="3"
            placeholder="Hi {{name}}, your order {{order_number}} has been placed! Total: {{total}}" />
          <div class="hint">Variables: <code>{{ fmtVar('name') }}</code>, <code>{{ fmtVar('order_number') }}</code>, <code>{{ fmtVar('total') }}</code></div>
        </div>

        <div class="field">
          <label>
            <input type="checkbox" v-model="s.sms_order_shipped_bool" />
            Send SMS when order ships
          </label>
        </div>
        <div class="field" v-if="s.sms_order_shipped_bool">
          <label>Shipped Message</label>
          <textarea v-model="s.sms_shipped_message" class="input" rows="3"
            placeholder="Hi {{name}}, your order {{order_number}} has shipped! Track: {{tracking_url}}" />
          <div class="hint">Variables: <code>{{ fmtVar('name') }}</code>, <code>{{ fmtVar('order_number') }}</code>, <code>{{ fmtVar('tracking_url') }}</code></div>
        </div>

        <div class="field">
          <label>
            <input type="checkbox" v-model="s.sms_notify_admin_bool" />
            Notify admin on new order via SMS
          </label>
        </div>
        <div class="field" v-if="s.sms_notify_admin_bool">
          <label>Admin Phone Number (E.164)</label>
          <input v-model="s.sms_admin_number" class="input" placeholder="+4917612345678" />
        </div>

        <hr class="divider" />
        <h3>🧪 Test SMS</h3>
        <div class="field">
          <label>Send a test SMS to</label>
          <div style="display:flex;gap:0.5rem;">
            <input v-model="testTo" class="input" placeholder="+4917612345678" style="flex:1" />
            <button class="btn btn-secondary" @click="sendTest" :disabled="testLoading">
              {{ testLoading ? 'Sending…' : 'Send Test' }}
            </button>
          </div>
          <div class="result-msg success" v-if="testResult === 'ok'">✓ Test SMS sent!</div>
          <div class="result-msg error" v-else-if="testResult">✗ {{ testResult }}</div>
        </div>
      </div>

      <!-- SMS Log -->
      <div class="glass section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <h3 style="margin:0">📋 SMS Log</h3>
          <select v-model="logFilter" class="input input-sm" style="width:120px">
            <option value="">All</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div class="log-table" v-if="logs.length">
          <table class="table">
            <thead>
              <tr>
                <th>To</th>
                <th>Message</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td class="mono">{{ log.to_number }}</td>
                <td class="msg-cell" :title="log.message">{{ log.message.slice(0, 60) }}{{ log.message.length > 60 ? '…' : '' }}</td>
                <td>
                  <span class="badge" :class="log.status === 'sent' ? 'badge-green' : 'badge-red'">
                    {{ log.status }}
                  </span>
                </td>
                <td class="text-muted mono" style="font-size:.75rem">{{ fmtDate(log.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state glass">No SMS logs yet.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import api from '../api.js'

const saving = ref(false)
const stats = ref(null)
const logs = ref([])
const logFilter = ref('')
const testTo = ref('')
const testLoading = ref(false)
const testResult = ref(null)

const s = reactive({
  sms_enabled_bool: false,
  sms_provider: 'twilio',
  sms_account_sid: '',
  sms_auth_token: '',
  sms_from_number: '',
  sms_order_confirm_bool: true,
  sms_order_message: 'Hi {{name}}, your order {{order_number}} has been placed! Total: {{total}}',
  sms_order_shipped_bool: true,
  sms_shipped_message: 'Hi {{name}}, your order {{order_number}} has shipped! Track: {{tracking_url}}',
  sms_notify_admin_bool: false,
  sms_admin_number: '',
})

async function loadSettings() {
  const { data } = await api.get('/settings')
  s.sms_enabled_bool = data.sms_enabled === '1'
  s.sms_provider = data.sms_provider || 'twilio'
  s.sms_account_sid = data.sms_account_sid || ''
  s.sms_auth_token = data.sms_auth_token || ''
  s.sms_from_number = data.sms_from_number || ''
  s.sms_order_confirm_bool = data.sms_order_confirm !== '0'
  s.sms_order_message = data.sms_order_message || 'Hi {{name}}, your order {{order_number}} has been placed! Total: {{total}}'
  s.sms_order_shipped_bool = data.sms_order_shipped !== '0'
  s.sms_shipped_message = data.sms_shipped_message || 'Hi {{name}}, your order {{order_number}} has shipped! Track: {{tracking_url}}'
  s.sms_notify_admin_bool = data.sms_notify_admin === '1'
  s.sms_admin_number = data.sms_admin_number || ''
}

async function saveSettings() {
  saving.value = true
  try {
    await api.put('/settings', {
      sms_enabled: s.sms_enabled_bool ? '1' : '0',
      sms_provider: s.sms_provider,
      sms_account_sid: s.sms_account_sid,
      sms_auth_token: s.sms_auth_token,
      sms_from_number: s.sms_from_number,
      sms_order_confirm: s.sms_order_confirm_bool ? '1' : '0',
      sms_order_message: s.sms_order_message,
      sms_order_shipped: s.sms_order_shipped_bool ? '1' : '0',
      sms_shipped_message: s.sms_shipped_message,
      sms_notify_admin: s.sms_notify_admin_bool ? '1' : '0',
      sms_admin_number: s.sms_admin_number,
    })
  } finally {
    saving.value = false
  }
}

async function loadStats() {
  const { data } = await api.get('/sms/stats')
  stats.value = data
}

async function loadLogs() {
  const params = logFilter.value ? `?status=${logFilter.value}` : ''
  const { data } = await api.get(`/sms/log${params}`)
  logs.value = data.logs || []
}

async function sendTest() {
  if (!testTo.value) return
  testLoading.value = true
  testResult.value = null
  try {
    await api.post('/sms/send', { to: testTo.value, message: 'Test message from Pygmy CMS 🪆' })
    testResult.value = 'ok'
  } catch (e) {
    testResult.value = e.response?.data?.error || 'Failed to send'
  } finally {
    testLoading.value = false
  }
}

function fmtDate(dt) {
  return new Date(dt).toLocaleString()
}

function fmtVar(v) {
  return `{{${v}}}`
}

watch(logFilter, loadLogs)

onMounted(() => {
  loadSettings()
  loadStats()
  loadLogs()
})
</script>

<style scoped>
.two-col {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
.section { padding: 1.5rem; border-radius: 1rem; }
.settings-panel h3 { margin: 0 0 1rem; font-size: 0.9rem; opacity: 0.8; }
.field { margin-bottom: 1rem; }
.field label { display: block; margin-bottom: 0.3rem; font-size: 0.85rem; }
.field label input[type=checkbox] { margin-right: 0.4rem; }
.hint { font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-top: 0.3rem; }
.divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1.2rem 0; }
.result-msg { margin-top: 0.5rem; font-size: 0.85rem; padding: 0.4rem 0.8rem; border-radius: 0.5rem; }
.result-msg.success { background: rgba(60,200,80,0.15); color: #6cf06c; }
.result-msg.error { background: rgba(200,60,60,0.15); color: #f08080; }
.input-sm { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
.mono { font-family: monospace; }
.stats-strip {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.stat-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.75rem;
  padding: 0.8rem 1.2rem;
  min-width: 120px;
}
.stat-card.accent { border-color: var(--accent); }
.stat-card.danger { border-color: #f08080; }
.stat-value { font-size: 1.5rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; opacity: 0.6; margin-top: 2px; }
.table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.table th, .table td { padding: 0.5rem 0.7rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
.table th { opacity: 0.5; font-weight: 600; font-size: 0.75rem; }
.msg-cell { max-width: 260px; }
</style>
