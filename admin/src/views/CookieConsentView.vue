<template>
  <div class="cookie-consent-view">
    <div class="page-header">
      <h1>🍪 Cookie Consent Manager</h1>
      <p class="subtitle">Configure your GDPR cookie consent banner and review consent logs.</p>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="['tab', { active: tab === 'config' }]" @click="tab='config'">⚙️ Banner Config</button>
      <button :class="['tab', { active: tab === 'stats' }]"  @click="tab='stats'; loadStats()">📊 Consent Stats</button>
      <button :class="['tab', { active: tab === 'log' }]"    @click="tab='log'; loadLog()">📋 Consent Log</button>
    </div>

    <!-- ─── Config Tab ─────────────────────────────────────────────── -->
    <div v-if="tab === 'config'" class="tab-panel">
      <div class="glass-card config-card">
        <h3>Banner Settings</h3>
        <div class="form-grid">
          <label class="toggle-row">
            <span>Enable Cookie Banner</span>
            <input type="checkbox" v-model="cfg.cookie_consent_enabled" true-value="1" false-value="0" />
          </label>
          <label class="toggle-row">
            <span>Show "Manage Preferences" button</span>
            <input type="checkbox" v-model="cfg.cookie_consent_show_manage" true-value="1" false-value="0" />
          </label>

          <div class="field">
            <label>Banner Position</label>
            <select v-model="cfg.cookie_consent_position">
              <option value="bottom">Bottom (full width)</option>
              <option value="bottom-left">Bottom Left (card)</option>
              <option value="bottom-right">Bottom Right (card)</option>
            </select>
          </div>

          <div class="field">
            <label>Banner Title</label>
            <input v-model="cfg.cookie_consent_title" placeholder="We use cookies" />
          </div>

          <div class="field full">
            <label>Banner Message</label>
            <textarea v-model="cfg.cookie_consent_message" rows="3"></textarea>
          </div>

          <div class="field">
            <label>"Accept All" Button Text</label>
            <input v-model="cfg.cookie_consent_btn_accept" />
          </div>
          <div class="field">
            <label>"Reject All" Button Text</label>
            <input v-model="cfg.cookie_consent_btn_reject" />
          </div>
          <div class="field">
            <label>"Manage Preferences" Button Text</label>
            <input v-model="cfg.cookie_consent_btn_manage" />
          </div>
          <div class="field">
            <label>Consent Cookie Expiry (days)</label>
            <input type="number" v-model="cfg.cookie_consent_expiry_days" min="1" max="3650" />
          </div>
          <div class="field">
            <label>Privacy Policy URL</label>
            <input v-model="cfg.cookie_consent_privacy_url" placeholder="https://example.com/privacy" />
          </div>
          <div class="field">
            <label>Cookie Policy URL</label>
            <input v-model="cfg.cookie_consent_cookie_url" placeholder="https://example.com/cookies" />
          </div>
        </div>

        <h3 style="margin-top:1.5rem">Cookie Categories</h3>
        <p class="hint">Necessary cookies are always enabled and do not require consent.</p>
        <div class="categories-grid">
          <label class="cat-toggle">
            <div class="cat-info">
              <span class="cat-name">✅ Necessary</span>
              <span class="cat-desc">Session, auth, CSRF — always active</span>
            </div>
            <span class="always-on">Always On</span>
          </label>
          <label class="cat-toggle">
            <div class="cat-info">
              <span class="cat-name">📈 Analytics</span>
              <span class="cat-desc">Page views, user behavior tracking</span>
            </div>
            <input type="checkbox" v-model="cfg.cookie_consent_analytics" true-value="1" false-value="0" />
          </label>
          <label class="cat-toggle">
            <div class="cat-info">
              <span class="cat-name">📣 Marketing</span>
              <span class="cat-desc">Ad targeting, retargeting pixels</span>
            </div>
            <input type="checkbox" v-model="cfg.cookie_consent_marketing" true-value="1" false-value="0" />
          </label>
          <label class="cat-toggle">
            <div class="cat-info">
              <span class="cat-name">🎛️ Preferences</span>
              <span class="cat-desc">Language, currency, UI settings</span>
            </div>
            <input type="checkbox" v-model="cfg.cookie_consent_preferences" true-value="1" false-value="0" />
          </label>
        </div>

        <div class="actions" style="margin-top:1.5rem">
          <button class="btn btn-primary" @click="saveConfig" :disabled="saving">
            {{ saving ? 'Saving…' : '💾 Save Settings' }}
          </button>
          <span v-if="savedMsg" class="saved-flash">✓ Saved!</span>
        </div>
      </div>

      <!-- Banner Preview -->
      <div class="glass-card preview-card">
        <h3>Banner Preview</h3>
        <div :class="['banner-preview', cfg.cookie_consent_position]">
          <div class="banner-inner">
            <div class="banner-text">
              <strong>{{ cfg.cookie_consent_title || 'We use cookies' }}</strong>
              <p>{{ cfg.cookie_consent_message || '' }}</p>
              <div v-if="cfg.cookie_consent_privacy_url || cfg.cookie_consent_cookie_url" class="banner-links">
                <a v-if="cfg.cookie_consent_privacy_url" :href="cfg.cookie_consent_privacy_url" target="_blank">Privacy Policy</a>
                <a v-if="cfg.cookie_consent_cookie_url" :href="cfg.cookie_consent_cookie_url" target="_blank">Cookie Policy</a>
              </div>
            </div>
            <div class="banner-btns">
              <button class="btn btn-ghost btn-sm">{{ cfg.cookie_consent_btn_reject || 'Reject All' }}</button>
              <button v-if="cfg.cookie_consent_show_manage === '1'" class="btn btn-ghost btn-sm">{{ cfg.cookie_consent_btn_manage || 'Manage' }}</button>
              <button class="btn btn-primary btn-sm">{{ cfg.cookie_consent_btn_accept || 'Accept All' }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Stats Tab ──────────────────────────────────────────────── -->
    <div v-if="tab === 'stats'" class="tab-panel">
      <div class="period-bar">
        <label>Period:</label>
        <select v-model="statDays" @change="loadStats">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      <div v-if="stats" class="stats-grid">
        <div class="stat-card">
          <span class="stat-num">{{ stats.total }}</span>
          <span class="stat-label">Total Consents</span>
        </div>
        <div class="stat-card green">
          <span class="stat-num">{{ stats.counts.all }}</span>
          <span class="stat-label">Accepted All</span>
        </div>
        <div class="stat-card orange">
          <span class="stat-num">{{ stats.counts.none }}</span>
          <span class="stat-label">Rejected All</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ stats.total > 0 ? Math.round((stats.counts.all / stats.total) * 100) : 0 }}%</span>
          <span class="stat-label">Full Accept Rate</span>
        </div>
      </div>

      <div v-if="stats" class="glass-card category-breakdown">
        <h3>Category Acceptance</h3>
        <div v-for="cat in categoryBreakdown" :key="cat.key" class="cat-bar-row">
          <span class="cat-bar-label">{{ cat.label }}</span>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" :style="{ width: cat.pct + '%' }"></div>
          </div>
          <span class="cat-bar-pct">{{ cat.pct }}%</span>
          <span class="cat-bar-n">{{ cat.n }}</span>
        </div>
      </div>

      <div v-if="stats?.daily?.length" class="glass-card chart-card">
        <h3>Daily Consents</h3>
        <div class="bar-chart">
          <div v-for="d in stats.daily" :key="d.day" class="bar-col">
            <div class="bar" :style="{ height: barH(d.n, stats.daily) + 'px' }" :title="`${d.day}: ${d.n}`"></div>
            <span class="bar-label">{{ d.day.slice(5) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Log Tab ────────────────────────────────────────────────── -->
    <div v-if="tab === 'log'" class="tab-panel">
      <div class="log-header">
        <div class="period-bar">
          <label>Period:</label>
          <select v-model="logDays" @change="loadLog">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
          </select>
        </div>
        <button class="btn btn-ghost btn-sm" @click="purgeOld">🗑️ Purge Old (>365d)</button>
      </div>

      <div class="glass-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>IP</th>
              <th>Necessary</th>
              <th>Analytics</th>
              <th>Marketing</th>
              <th>Preferences</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in consents" :key="c.id">
              <td class="mono">{{ c.session_id.slice(0, 12) }}…</td>
              <td class="mono">{{ c.ip || '—' }}</td>
              <td><span class="badge green">✓</span></td>
              <td><span :class="['badge', c.categories.analytics ? 'green' : 'red']">{{ c.categories.analytics ? '✓' : '✗' }}</span></td>
              <td><span :class="['badge', c.categories.marketing ? 'green' : 'red']">{{ c.categories.marketing ? '✓' : '✗' }}</span></td>
              <td><span :class="['badge', c.categories.preferences ? 'green' : 'red']">{{ c.categories.preferences ? '✓' : '✗' }}</span></td>
              <td>{{ new Date(c.accepted_at).toLocaleDateString() }}</td>
              <td><button class="btn-icon" @click="deleteConsent(c.id)">🗑️</button></td>
            </tr>
            <tr v-if="!consents.length"><td colspan="8" class="empty">No consent records found.</td></tr>
          </tbody>
        </table>
        <div class="pagination" v-if="logTotal > 50">
          <button class="btn btn-ghost btn-sm" :disabled="logPage === 0" @click="logPage--; loadLog()">← Prev</button>
          <span>Page {{ logPage + 1 }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="(logPage + 1) * 50 >= logTotal" @click="logPage++; loadLog()">Next →</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const tab = ref('config')
const saving = ref(false)
const savedMsg = ref(false)
const cfg = ref({
  cookie_consent_enabled: '1',
  cookie_consent_position: 'bottom',
  cookie_consent_title: 'We use cookies',
  cookie_consent_message: '',
  cookie_consent_btn_accept: 'Accept All',
  cookie_consent_btn_reject: 'Reject All',
  cookie_consent_btn_manage: 'Manage Preferences',
  cookie_consent_show_manage: '1',
  cookie_consent_analytics: '1',
  cookie_consent_marketing: '1',
  cookie_consent_preferences: '1',
  cookie_consent_privacy_url: '',
  cookie_consent_cookie_url: '',
  cookie_consent_expiry_days: '365',
})

const stats = ref(null)
const statDays = ref('30')
const consents = ref([])
const logTotal = ref(0)
const logPage = ref(0)
const logDays = ref('30')

onMounted(loadConfig)

async function loadConfig() {
  const { data } = await api.get('/cookie-consent/config')
  Object.assign(cfg.value, data)
}

async function saveConfig() {
  saving.value = true
  try {
    const payload = { ...cfg.value }
    await api.put('/settings', payload)
    savedMsg.value = true
    setTimeout(() => { savedMsg.value = false }, 2000)
  } finally {
    saving.value = false
  }
}

async function loadStats() {
  const { data } = await api.get('/cookie-consent/stats', { params: { days: statDays.value } })
  stats.value = data
}

async function loadLog() {
  const { data } = await api.get('/cookie-consent', {
    params: { days: logDays.value, limit: 50, offset: logPage.value * 50 }
  })
  consents.value = data.consents
  logTotal.value = data.total
}

async function deleteConsent(id) {
  await api.delete(`/cookie-consent/${id}`)
  loadLog()
}

async function purgeOld() {
  if (!confirm('Purge all consent records older than 365 days?')) return
  await api.delete('/cookie-consent/purge/old')
  loadLog()
}

const categoryBreakdown = computed(() => {
  if (!stats.value) return []
  const t = stats.value.total || 1
  return [
    { key: 'analytics',   label: '📈 Analytics',   n: stats.value.counts.analytics,   pct: Math.round((stats.value.counts.analytics / t) * 100) },
    { key: 'marketing',   label: '📣 Marketing',   n: stats.value.counts.marketing,   pct: Math.round((stats.value.counts.marketing / t) * 100) },
    { key: 'preferences', label: '🎛️ Preferences', n: stats.value.counts.preferences, pct: Math.round((stats.value.counts.preferences / t) * 100) },
  ]
})

function barH(n, arr) {
  const max = Math.max(...arr.map(d => d.n), 1)
  return Math.max(4, Math.round((n / max) * 100))
}
</script>

<style scoped>
.cookie-consent-view { max-width: 960px; }
.page-header { margin-bottom: 1.5rem; }
.page-header h1 { margin: 0; }
.subtitle { color: var(--text-muted); margin: 0.25rem 0 0; }

.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.tab { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); color: var(--text); padding: 0.5rem 1.25rem; border-radius: 2rem; cursor: pointer; transition: all .2s; }
.tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.tab-panel { display: flex; flex-direction: column; gap: 1.5rem; }

.glass-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1.5rem; }
.glass-card h3 { margin: 0 0 1rem; font-size: 1rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-grid .full { grid-column: 1 / -1; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field label { font-size: 0.8rem; color: var(--text-muted); }
.field input, .field select, .field textarea {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.5rem; padding: 0.5rem 0.75rem; color: var(--text); font-size: 0.9rem;
}
.field textarea { resize: vertical; font-family: inherit; }

.toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 0.5rem; cursor: pointer; font-size: 0.9rem; }
.toggle-row input[type=checkbox] { width: 1.1rem; height: 1.1rem; accent-color: var(--accent); }

.hint { font-size: 0.8rem; color: var(--text-muted); margin: -0.5rem 0 1rem; }

.categories-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.cat-toggle { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,255,255,0.03); border-radius: 0.75rem; }
.cat-toggle input { width: 1.1rem; height: 1.1rem; accent-color: var(--accent); }
.cat-info { display: flex; flex-direction: column; gap: 0.2rem; }
.cat-name { font-size: 0.9rem; font-weight: 600; }
.cat-desc { font-size: 0.78rem; color: var(--text-muted); }
.always-on { font-size: 0.78rem; color: var(--text-muted); font-style: italic; }

.actions { display: flex; align-items: center; gap: 1rem; }
.saved-flash { color: #22c55e; font-size: 0.9rem; }

/* Preview */
.preview-card { }
.banner-preview { border: 1px dashed rgba(255,255,255,0.15); border-radius: 0.75rem; padding: 1rem; }
.banner-inner { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
.banner-text { flex: 1; min-width: 200px; }
.banner-text strong { font-size: 0.9rem; }
.banner-text p { font-size: 0.8rem; color: var(--text-muted); margin: 0.25rem 0; }
.banner-links { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.banner-links a { font-size: 0.75rem; color: var(--accent); }
.banner-btns { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

/* Stats */
.period-bar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
.period-bar select { background: var(--surface); border: 1px solid rgba(255,255,255,0.1); color: var(--text); padding: 0.4rem 0.75rem; border-radius: 0.5rem; }

.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.stat-card { background: var(--surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 1rem; padding: 1.25rem 1rem; text-align: center; }
.stat-card.green { border-color: rgba(34,197,94,0.3); }
.stat-card.orange { border-color: rgba(249,115,22,0.3); }
.stat-num { display: block; font-size: 1.8rem; font-weight: 700; }
.stat-label { font-size: 0.78rem; color: var(--text-muted); }

.category-breakdown h3 { margin-bottom: 1rem; }
.cat-bar-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
.cat-bar-label { width: 130px; font-size: 0.85rem; }
.cat-bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.07); border-radius: 4px; overflow: hidden; }
.cat-bar-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width .3s; }
.cat-bar-pct { width: 40px; text-align: right; font-size: 0.85rem; font-weight: 600; }
.cat-bar-n { width: 50px; text-align: right; font-size: 0.78rem; color: var(--text-muted); }

.chart-card h3 { margin-bottom: 1rem; }
.bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 110px; }
.bar-col { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; min-width: 0; }
.bar { background: var(--accent); border-radius: 3px 3px 0 0; min-height: 4px; width: 100%; }
.bar-label { font-size: 0.6rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }

/* Log */
.log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.data-table th { text-align: left; padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.08); }
.data-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
.mono { font-family: monospace; font-size: 0.8rem; }
.badge { padding: 0.15rem 0.5rem; border-radius: 0.3rem; font-size: 0.75rem; font-weight: 600; }
.badge.green { background: rgba(34,197,94,0.15); color: #22c55e; }
.badge.red { background: rgba(239,68,68,0.15); color: #ef4444; }
.empty { text-align: center; color: var(--text-muted); padding: 2rem !important; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0.25rem; }
.pagination { display: flex; align-items: center; gap: 1rem; padding: 1rem 0 0; justify-content: center; }

.btn { padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; cursor: pointer; font-size: 0.9rem; transition: all .2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-ghost { background: rgba(255,255,255,0.07); color: var(--text); border: 1px solid rgba(255,255,255,0.1); }
.btn-sm { padding: 0.35rem 0.9rem; font-size: 0.82rem; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 600px) {
  .form-grid, .stats-grid { grid-template-columns: 1fr; }
}
</style>
