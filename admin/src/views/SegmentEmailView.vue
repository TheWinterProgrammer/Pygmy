<template>
  <div class="segment-email-view">
    <div class="page-header">
      <div>
        <h1>📧 Bulk Email Sender</h1>
        <p class="subtitle">Compose and send emails directly to customer segments or filters</p>
      </div>
    </div>

    <div class="layout">
      <!-- Compose column -->
      <div class="compose-col">
        <div class="glass section">
          <h2>✍️ Compose Email</h2>

          <div class="form-group">
            <label>Campaign Name</label>
            <input v-model="form.campaign_name" class="form-input" placeholder="e.g. Winter Sale Win-back" />
          </div>

          <div class="form-group">
            <label>Subject *</label>
            <input v-model="form.subject" class="form-input" placeholder="Your email subject line…" />
          </div>

          <div class="form-group">
            <label>Message Body *</label>
            <textarea
              v-model="form.html_body"
              class="form-input"
              rows="12"
              placeholder="Hi {{name}},&#10;&#10;Write your message here…&#10;&#10;Supports HTML tags."
            ></textarea>
            <div class="hint">Personalization: <code>{{name}}</code> <code>{{first_name}}</code> <code>{{email}}</code> <code>{{site_name}}</code> <code>{{site_url}}</code></div>
          </div>
        </div>

        <!-- Preview -->
        <div v-if="previewHtml" class="glass section preview-section">
          <h2>👁️ Preview</h2>
          <div class="email-preview" v-html="previewHtml"></div>
        </div>

        <!-- Campaign History -->
        <div class="glass section">
          <h2>📋 Campaign History</h2>
          <div v-if="loadingHistory" class="loading-bar"></div>
          <div v-else-if="!campaigns.length" class="empty-state">No campaigns sent yet.</div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Subject</th>
                <th>Sent</th>
                <th>Recipients</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in campaigns" :key="c.id">
                <td class="camp-name">{{ c.name }}</td>
                <td class="text-muted">{{ c.subject }}</td>
                <td>{{ c.sent_count }}</td>
                <td class="text-muted">/ {{ c.recipient_count }}</td>
                <td><span :class="['status-pill', c.status]">{{ c.status }}</span></td>
                <td class="text-muted">{{ fmtDate(c.created_at) }}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" @click="reuseEmail(c)" title="Re-use this email">♻️</button>
                  <button class="btn btn-ghost btn-sm danger" @click="deleteCampaign(c.id)" title="Delete">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Audience column -->
      <div class="audience-col">
        <div class="glass section">
          <h2>🎯 Target Audience</h2>

          <div class="form-group">
            <label>Filter by Segment</label>
            <select v-model="form.segment_id" class="form-input" @change="updatePreview">
              <option value="">— All Customers —</option>
              <option v-for="s in segments" :key="s.id" :value="s.id">{{ s.name }} ({{ s.member_count || 0 }})</option>
            </select>
          </div>

          <div class="form-group">
            <label>Churn Risk Filter</label>
            <select v-model="form.churn_risk" class="form-input" @change="updatePreview">
              <option value="">— Any Risk Level —</option>
              <option value="high">🔴 High Risk</option>
              <option value="medium">🟡 Medium Risk</option>
              <option value="low">🟢 Low Risk</option>
            </select>
          </div>

          <div class="form-group">
            <label>Dormant Since (days)</label>
            <select v-model="form.dormant_days" class="form-input" @change="updatePreview">
              <option value="">— No Filter —</option>
              <option value="30">30+ days</option>
              <option value="60">60+ days</option>
              <option value="90">90+ days</option>
              <option value="180">180+ days</option>
            </select>
          </div>

          <div class="form-group">
            <label>Filter by Customer Tag</label>
            <select v-model="form.tag_id" class="form-input" @change="updatePreview">
              <option value="">— Any Tag —</option>
              <option v-for="t in tags" :key="t.id" :value="t.id">{{ t.name }} ({{ t.customer_count || 0 }})</option>
            </select>
          </div>

          <div class="form-group">
            <label>Search / Custom Filter</label>
            <input v-model="form.q" class="form-input" placeholder="Search by email, name…" @input="debouncedPreview" />
          </div>

          <!-- Recipient count -->
          <div class="recipient-card glass">
            <div v-if="loadingPreview" class="loading-bar"></div>
            <div v-else>
              <div class="rec-count">{{ preview.count || 0 }}</div>
              <div class="rec-label">Recipients</div>
              <div v-if="preview.sample?.length" class="rec-sample">
                <span v-for="c in preview.sample" :key="c.id" class="sample-chip">{{ c.email }}</span>
                <span v-if="(preview.count || 0) > 5" class="sample-more">+{{ preview.count - 5 }} more</span>
              </div>
            </div>
          </div>

          <!-- Send button -->
          <button
            class="btn btn-accent send-btn"
            :disabled="sending || !form.subject || !form.html_body || !preview.count"
            @click="sendEmail"
          >
            {{ sending ? '⏳ Sending…' : `📤 Send to ${preview.count || 0} customers` }}
          </button>

          <div v-if="sendResult" :class="['send-result', sendResult.ok ? 'ok' : 'err']">
            {{ sendResult.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api.js'

const form = ref({
  campaign_name: '',
  subject: '',
  html_body: '',
  segment_id: '',
  churn_risk: '',
  dormant_days: '',
  tag_id: '',
  q: '',
})

const segments = ref([])
const tags = ref([])
const campaigns = ref([])
const preview = ref({ count: 0, sample: [] })
const loadingPreview = ref(false)
const loadingHistory = ref(false)
const sending = ref(false)
const sendResult = ref(null)

const previewHtml = computed(() => {
  if (!form.value.html_body) return ''
  return form.value.html_body
    .replace(/\{\{name\}\}/gi, 'John Doe')
    .replace(/\{\{first_name\}\}/gi, 'John')
    .replace(/\{\{email\}\}/gi, 'john@example.com')
    .replace(/\{\{site_name\}\}/gi, 'Your Store')
    .replace(/\{\{site_url\}\}/gi, 'https://yourstore.com')
    .replace(/\n/g, '<br>')
})

let debounceTimer = null
function debouncedPreview() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(updatePreview, 500)
}

async function updatePreview() {
  loadingPreview.value = true
  try {
    const params = {}
    if (form.value.segment_id) params.segment_id = form.value.segment_id
    if (form.value.churn_risk) params.churn_risk = form.value.churn_risk
    if (form.value.dormant_days) params.dormant_days = form.value.dormant_days
    if (form.value.tag_id) params.tag_id = form.value.tag_id
    if (form.value.q) params.q = form.value.q
    const res = await api.get('/segment-email/preview', { params })
    preview.value = res.data
  } catch {
    preview.value = { count: 0, sample: [] }
  } finally {
    loadingPreview.value = false
  }
}

async function sendEmail() {
  if (!form.value.subject || !form.value.html_body) return
  if (!confirm(`Send "${form.value.subject}" to ${preview.value.count} customers?`)) return

  sending.value = true
  sendResult.value = null
  try {
    const payload = { ...form.value }
    if (!payload.segment_id) delete payload.segment_id
    if (!payload.churn_risk) delete payload.churn_risk
    if (!payload.dormant_days) delete payload.dormant_days
    if (!payload.tag_id) delete payload.tag_id
    if (!payload.q) delete payload.q

    const res = await api.post('/segment-email/send', payload)
    sendResult.value = { ok: true, message: `✅ Sending to ${res.data.recipient_count} customers (Campaign #${res.data.campaign_id})` }
    loadHistory()
  } catch (e) {
    sendResult.value = { ok: false, message: '❌ Send failed: ' + (e.response?.data?.error || e.message) }
  } finally {
    sending.value = false
  }
}

function reuseEmail(c) {
  form.value.subject = c.subject
  form.value.html_body = c.html_body
  form.value.campaign_name = c.name + ' (copy)'
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign record?')) return
  await api.delete(`/segment-email/campaigns/${id}`)
  loadHistory()
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    const res = await api.get('/segment-email/campaigns')
    campaigns.value = res.data
  } finally {
    loadingHistory.value = false
  }
}

async function loadFilters() {
  try {
    const [segsRes, tagsRes] = await Promise.all([
      api.get('/customer-segments'),
      api.get('/customer-tags'),
    ])
    segments.value = segsRes.data
    tags.value = tagsRes.data
  } catch {}
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

onMounted(() => {
  loadFilters()
  loadHistory()
  updatePreview()
})
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; flex-wrap:wrap; gap:.75rem; }
h1 { font-size:1.4rem; font-weight:800; margin:0; }
.subtitle { color:var(--text-muted); font-size:.83rem; margin:.25rem 0 0; }

.layout { display:grid; grid-template-columns:1fr 340px; gap:1.25rem; align-items:start; }
@media (max-width:900px) { .layout { grid-template-columns:1fr; } }

.section { border-radius:1rem; padding:1.25rem; margin-bottom:1.25rem; }
.section h2 { font-size:.95rem; font-weight:700; margin:0 0 1rem; }

.form-group { margin-bottom:1rem; }
.form-group label { display:block; font-size:.78rem; font-weight:600; color:var(--text-muted); margin-bottom:.35rem; text-transform:uppercase; letter-spacing:.04em; }
.hint { font-size:.72rem; color:var(--text-muted); margin-top:.3rem; }
.hint code { background:rgba(255,255,255,.08); padding:.1em .35em; border-radius:.25rem; font-size:.9em; }

.preview-section .email-preview {
  background:#fff; color:#222; padding:1.25rem; border-radius:.75rem;
  font-family:sans-serif; font-size:.88rem; line-height:1.6; max-height:300px; overflow-y:auto;
}

.recipient-card { border-radius:.875rem; padding:1.25rem; text-align:center; margin-bottom:1rem; }
.rec-count { font-size:2.5rem; font-weight:900; color:var(--accent); line-height:1; }
.rec-label { font-size:.85rem; color:var(--text-muted); margin:.3rem 0 .75rem; }
.rec-sample { display:flex; flex-wrap:wrap; gap:.35rem; justify-content:center; }
.sample-chip { background:rgba(255,255,255,.08); padding:.2em .55em; border-radius:999px; font-size:.72rem; color:#aaa; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sample-more { font-size:.72rem; color:var(--text-muted); align-self:center; }

.send-btn { width:100%; padding:.75rem; font-size:.95rem; font-weight:700; border-radius:.75rem; }
.send-result { margin-top:.75rem; padding:.75rem; border-radius:.75rem; font-size:.85rem; text-align:center; }
.send-result.ok { background:rgba(74,222,128,.12); color:#4ade80; }
.send-result.err { background:rgba(239,68,68,.12); color:#ef4444; }

.table { width:100%; border-collapse:collapse; font-size:.83rem; }
.table th { padding:.5rem .75rem; text-align:left; color:var(--text-muted); font-size:.75rem; font-weight:600; border-bottom:1px solid rgba(255,255,255,.06); }
.table td { padding:.5rem .75rem; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
.table tr:last-child td { border-bottom:none; }
.camp-name { font-weight:600; }
.text-muted { color:var(--text-muted); font-size:.8rem; }
.status-pill { display:inline-block; padding:.2em .55em; border-radius:999px; font-size:.72rem; font-weight:600; }
.status-pill.completed { background:rgba(74,222,128,.12); color:#4ade80; }
.status-pill.sending { background:rgba(245,158,11,.12); color:#f59e0b; }
.status-pill.pending { background:rgba(255,255,255,.07); color:#aaa; }
.danger { color:hsl(355,70%,60%); }
.empty-state { text-align:center; color:var(--text-muted); padding:1.5rem; font-size:.88rem; }
.loading-bar { height:3px; background:var(--accent); border-radius:999px; animation:pulse 1s infinite alternate; margin-bottom:.5rem; }
@keyframes pulse { from { opacity:.4 } to { opacity:1 } }
</style>
