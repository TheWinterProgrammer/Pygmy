<template>
  <div>
    <div class="page-header">
      <h1>📬 Digest Emails</h1>
      <button class="btn btn-primary" @click="sendNow" :disabled="sending">
        {{ sending ? 'Sending…' : '📤 Send Now' }}
      </button>
    </div>

    <!-- Sent success -->
    <div v-if="sentResult" class="glass notice-success">
      <div>✅ Digest sent to {{ sentResult.recipients?.filter(r => r.sent).length }} recipient(s)</div>
      <div v-for="r in sentResult.recipients" :key="r.email" style="font-size:0.82rem;margin-top:4px">
        {{ r.sent ? '✓' : '✗' }} {{ r.email }} {{ r.error ? '— ' + r.error : '' }}
      </div>
    </div>

    <div class="two-col">
      <!-- Settings -->
      <div class="glass section">
        <h3 style="margin:0 0 20px">⚙️ Settings</h3>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" v-model="settings.enabled" @change="save" />
            Enable automated digest emails
          </label>
          <p class="form-hint">When enabled, digests are automatically sent on the configured schedule.</p>
        </div>
        <div class="form-group">
          <label>Frequency</label>
          <select v-model="settings.frequency" @change="save" class="input">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div class="form-group">
          <label>Recipients (comma-separated emails)</label>
          <input v-model="settings.recipients" @blur="save" class="input" placeholder="admin@example.com, ceo@example.com" />
          <p class="form-hint">Leave blank to use the Notification Email from Settings.</p>
        </div>

        <div v-if="settings.last_sent" class="last-sent text-muted">
          Last sent: {{ formatDate(settings.last_sent) }}
        </div>

        <div class="save-row">
          <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving…' : '💾 Save Settings' }}</button>
        </div>
      </div>

      <!-- Preview -->
      <div class="glass section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0">📊 Current Stats Preview</h3>
          <div style="display:flex;gap:8px">
            <select v-model="previewPeriod" @change="loadPreview" class="select-sm">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <button class="btn btn-ghost btn-sm" @click="loadPreview">🔄 Refresh</button>
          </div>
        </div>

        <div v-if="preview" class="preview-grid">
          <div class="preview-stat">
            <div class="ps-num">{{ preview.orders?.count || 0 }}</div>
            <div class="ps-label">Orders</div>
          </div>
          <div class="preview-stat">
            <div class="ps-num">{{ currencySymbol }}{{ (preview.orders?.revenue || 0).toFixed(2) }}</div>
            <div class="ps-label">Revenue</div>
          </div>
          <div class="preview-stat">
            <div class="ps-num">{{ preview.page_views || 0 }}</div>
            <div class="ps-label">Page Views</div>
          </div>
          <div class="preview-stat">
            <div class="ps-num">{{ preview.subscribers || 0 }}</div>
            <div class="ps-label">New Subscribers</div>
          </div>
          <div class="preview-stat">
            <div class="ps-num">{{ preview.new_customers || 0 }}</div>
            <div class="ps-label">New Customers</div>
          </div>
          <div class="preview-stat">
            <div class="ps-num">{{ preview.abandoned_carts || 0 }}</div>
            <div class="ps-label">Abandoned Carts</div>
          </div>
        </div>

        <div v-if="preview" class="attention-items">
          <h4 style="margin:12px 0 8px;font-size:0.85rem;color:var(--text-muted);text-transform:uppercase">Needs Attention</h4>
          <div v-if="!hasAttention" class="text-muted" style="font-size:0.85rem">✅ Everything looks good!</div>
          <div v-if="preview.pending_comments" class="alert-item">
            💬 {{ preview.pending_comments }} comment{{ preview.pending_comments !== 1 ? 's' : '' }} pending moderation
          </div>
          <div v-if="preview.pending_reviews" class="alert-item">
            ⭐ {{ preview.pending_reviews }} review{{ preview.pending_reviews !== 1 ? 's' : '' }} pending approval
          </div>
          <div v-if="preview.open_tickets" class="alert-item">
            🎫 {{ preview.open_tickets }} open support ticket{{ preview.open_tickets !== 1 ? 's' : '' }}
          </div>
          <div v-if="preview.inventory?.out_of_stock" class="alert-item alert-red">
            🚨 {{ preview.inventory.out_of_stock }} product{{ preview.inventory.out_of_stock !== 1 ? 's' : '' }} out of stock
          </div>
          <div v-if="preview.inventory?.low_stock" class="alert-item">
            ⚠️ {{ preview.inventory.low_stock }} product{{ preview.inventory.low_stock !== 1 ? 's' : '' }} low on stock
          </div>
        </div>
      </div>
    </div>

    <!-- About Digest Emails -->
    <div class="glass section" style="margin-top:8px">
      <h3 style="margin:0 0 12px">📖 About Digest Emails</h3>
      <div class="about-grid">
        <div class="about-item">
          <div class="about-icon">📊</div>
          <div class="about-body">
            <strong>What's included</strong>
            <p>Orders, revenue, page views, new subscribers, new customers, abandoned cart count, and action items (pending comments, support tickets, out-of-stock products).</p>
          </div>
        </div>
        <div class="about-item">
          <div class="about-icon">⏰</div>
          <div class="about-body">
            <strong>Schedule</strong>
            <p>Daily digests cover the last 24 hours. Weekly covers 7 days. Monthly covers 30 days. Emails are checked every hour and sent when due.</p>
          </div>
        </div>
        <div class="about-item">
          <div class="about-icon">📧</div>
          <div class="about-body">
            <strong>SMTP Required</strong>
            <p>Configure your SMTP server in Settings → Email before enabling digests. Without SMTP, digest emails cannot be delivered.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const settings = ref({ enabled: false, frequency: 'weekly', recipients: '', last_sent: null })
const preview = ref(null)
const previewPeriod = ref('weekly')
const saving = ref(false)
const sending = ref(false)
const sentResult = ref(null)
const currencySymbol = ref('€')

const hasAttention = computed(() => {
  if (!preview.value) return false
  return preview.value.pending_comments || preview.value.pending_reviews ||
    preview.value.open_tickets || preview.value.inventory?.out_of_stock ||
    preview.value.inventory?.low_stock
})

async function load() {
  const [s, cfg] = await Promise.all([
    api.get('/digest/settings'),
    api.get('/settings').catch(() => ({ data: {} })),
  ])
  settings.value = s.data
  currencySymbol.value = cfg.data?.shop_currency_symbol || '€'
  await loadPreview()
}

async function loadPreview() {
  const { data } = await api.get(`/digest/preview?period=${previewPeriod.value}`)
  preview.value = data
}

async function save() {
  saving.value = true
  try {
    await api.put('/digest/settings', {
      enabled: settings.value.enabled,
      frequency: settings.value.frequency,
      recipients: settings.value.recipients,
    })
  } finally {
    saving.value = false
  }
}

async function sendNow() {
  sentResult.value = null
  sending.value = true
  try {
    const { data } = await api.post('/digest/send', { period: previewPeriod.value })
    sentResult.value = data
    await load()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to send digest')
  } finally {
    sending.value = false
  }
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

onMounted(load)
</script>

<style scoped>
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }
.section { padding: 20px; margin-bottom: 16px; }

.notice-success { padding: 14px 18px; background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25); border-radius: var(--radius); margin-bottom: 16px; font-size: 0.9rem; }

.form-hint { font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; }
.last-sent { font-size: 0.82rem; margin: 12px 0; }
.save-row { margin-top: 16px; }

.preview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
.preview-stat { background: rgba(0,0,0,0.15); border-radius: 8px; padding: 12px; text-align: center; }
.ps-num { font-size: 1.4rem; font-weight: 700; color: var(--accent); }
.ps-label { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; }

.attention-items { margin-top: 4px; }
.alert-item { background: rgba(250,204,21,0.08); border: 1px solid rgba(250,204,21,0.2); border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; margin-bottom: 6px; }
.alert-red { background: rgba(224,82,82,0.08); border-color: rgba(224,82,82,0.25); }

.about-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.about-item { display: flex; gap: 12px; }
.about-icon { font-size: 1.5rem; flex-shrink: 0; }
.about-body strong { font-size: 0.9rem; }
.about-body p { font-size: 0.82rem; color: var(--text-muted); margin: 4px 0 0; line-height: 1.5; }

.select-sm { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; font-size: 0.85rem; }
</style>
