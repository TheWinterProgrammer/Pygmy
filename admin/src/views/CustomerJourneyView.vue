<template>
  <div class="journey-view">
    <div class="page-header">
      <div class="header-left">
        <h1>🗺️ Customer Journey Analytics</h1>
        <p class="subtitle">Visualize how visitors navigate from landing to purchase</p>
      </div>
      <div class="header-right">
        <select v-model="days" @change="loadAll" class="form-input" style="width:140px">
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <!-- Summary Cards -->
    <div class="stats-strip" v-if="summary">
      <div class="stat-card accent">
        <div class="stat-value">{{ summary.totals.total_sessions?.toLocaleString() ?? 0 }}</div>
        <div class="stat-label">Total Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.totals.total_events?.toLocaleString() ?? 0 }}</div>
        <div class="stat-label">Total Events</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.totals.conversions?.toLocaleString() ?? 0 }}</div>
        <div class="stat-label">Purchases</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.totals.conversion_rate ?? 0 }}%</div>
        <div class="stat-label">Conversion Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.totals.logged_in_sessions?.toLocaleString() ?? 0 }}</div>
        <div class="stat-label">Logged-in Sessions</div>
      </div>
    </div>

    <div class="journey-grid">
      <!-- Funnel Visualization -->
      <div class="glass card-section funnel-section">
        <h3 style="margin:0 0 1.25rem">🔭 Conversion Funnel</h3>
        <div v-if="funnel" class="funnel-stages">
          <div
            v-for="(stage, i) in funnel.stages"
            :key="stage.stage"
            class="funnel-stage"
          >
            <div class="funnel-bar-wrap">
              <div
                class="funnel-bar"
                :style="{ width: maxStage > 0 ? (stage.count / maxStage * 100) + '%' : '0%', background: stageBg(i) }"
              ></div>
            </div>
            <div class="funnel-info">
              <span class="funnel-name">{{ stage.stage }}</span>
              <span class="funnel-count">{{ stage.count?.toLocaleString() }}</span>
              <span v-if="stage.conversion_rate != null" class="funnel-cr" :class="crClass(stage.conversion_rate)">
                ↓ {{ stage.conversion_rate }}%
              </span>
            </div>
            <div v-if="i > 0 && stage.drop_off != null" class="funnel-dropoff">
              {{ stage.drop_off }}% drop-off
            </div>
          </div>
        </div>
        <div v-else class="empty-state-small">No funnel data yet</div>
      </div>

      <!-- Traffic Sources -->
      <div class="glass card-section sources-section">
        <h3 style="margin:0 0 1.25rem">🌐 Traffic Sources</h3>
        <div v-if="sources && sources.sources.length" class="sources-list">
          <div v-for="s in sources.sources.slice(0, 10)" :key="s.source" class="source-row">
            <span class="source-icon">{{ sourceIcon(s.source) }}</span>
            <span class="source-name">{{ s.source }}</span>
            <div class="source-bar-wrap">
              <div
                class="source-bar"
                :style="{ width: maxSource > 0 ? (s.sessions / maxSource * 100) + '%' : '0%' }"
              ></div>
            </div>
            <span class="source-count">{{ s.sessions?.toLocaleString() }}</span>
          </div>
        </div>
        <div v-else class="empty-state-small">No source data yet</div>

        <!-- UTM Campaigns -->
        <template v-if="sources && sources.utm_campaigns.length">
          <h4 style="margin:1.5rem 0 0.75rem;font-size:0.85rem;color:var(--text-muted)">UTM Campaigns</h4>
          <div class="utm-table">
            <table>
              <thead><tr><th>Campaign</th><th>Medium</th><th>Sessions</th></tr></thead>
              <tbody>
                <tr v-for="c in sources.utm_campaigns" :key="c.utm_campaign">
                  <td>{{ c.utm_campaign }}</td>
                  <td><span class="medium-pill">{{ c.utm_medium || '—' }}</span></td>
                  <td>{{ c.sessions }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>

    <!-- Entry Pages -->
    <div class="glass card-section" style="margin-top:1.5rem" v-if="paths">
      <div class="section-header">
        <h3 style="margin:0">🚪 Top Entry Pages</h3>
        <span class="text-muted" style="font-size:0.8rem">First page visitors land on</span>
      </div>
      <div class="paths-table" style="margin-top:1rem">
        <table>
          <thead>
            <tr>
              <th>Page Path</th>
              <th>Sessions</th>
              <th>Conversions</th>
              <th>Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in paths.entry_pages" :key="p.page_path">
              <td class="path-cell"><code>{{ p.page_path }}</code></td>
              <td>{{ p.sessions?.toLocaleString() }}</td>
              <td>{{ p.conversions }}</td>
              <td>
                <span :class="['cr-badge', crBadgeClass(p.conversion_rate)]">
                  {{ p.conversion_rate }}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Daily Sessions Chart -->
    <div class="glass card-section" style="margin-top:1.5rem" v-if="summary && summary.daily.length">
      <h3 style="margin:0 0 1.25rem">📈 Daily Sessions vs. Conversions</h3>
      <div class="daily-chart">
        <div
          v-for="d in summary.daily"
          :key="d.date"
          class="daily-bar-group"
          :title="`${d.date}: ${d.sessions} sessions, ${d.conversions} conversions`"
        >
          <div class="bar-sessions" :style="{ height: maxDaily > 0 ? (d.sessions / maxDaily * 80) + 'px' : '2px' }"></div>
          <div class="bar-conversions" :style="{ height: maxConversions > 0 ? (d.conversions / maxConversions * 80) + 'px' : '2px' }"></div>
          <div class="bar-label">{{ d.date.slice(5) }}</div>
        </div>
      </div>
      <div class="chart-legend">
        <span class="leg-sessions">■ Sessions</span>
        <span class="leg-conversions">■ Conversions</span>
      </div>
    </div>

    <!-- Recent Converting Journeys -->
    <div class="glass card-section" style="margin-top:1.5rem" v-if="sessions && sessions.sessions.length">
      <h3 style="margin:0 0 1.25rem">✅ Recent Converting Journeys</h3>
      <div class="journey-list">
        <div v-for="s in sessions.sessions.slice(0, 10)" :key="s.session_id" class="journey-item">
          <div class="journey-meta">
            <code class="session-id">{{ s.session_id }}</code>
            <span class="step-count">{{ s.steps }} steps</span>
            <span class="converted-badge">✅ Converted</span>
          </div>
          <div class="journey-path">
            <template v-for="(evt, idx) in s.events.slice(0, 8)" :key="idx">
              <span class="journey-step" :class="['step-' + evt.event_type]" :title="evt.page_path">
                {{ eventIcon(evt.event_type) }} {{ evt.event_type.replace(/_/g, ' ') }}
              </span>
              <span v-if="idx < Math.min(s.events.length - 1, 7)" class="step-arrow">→</span>
            </template>
            <span v-if="s.events.length > 8" class="more-steps">+{{ s.events.length - 8 }} more</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Converting Products -->
    <div class="glass card-section" style="margin-top:1.5rem" v-if="summary && summary.top_products.length">
      <h3 style="margin:0 0 1rem">🏆 Most Viewed Products</h3>
      <div class="product-pills">
        <RouterLink
          v-for="p in summary.top_products"
          :key="p.entity_slug"
          :to="`/products?q=${p.entity_slug}`"
          class="product-pill"
        >
          <span class="pp-slug">{{ p.entity_slug }}</span>
          <span class="pp-views">{{ p.views }} views</span>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const days = ref(30)
const loading = ref(false)
const summary = ref(null)
const funnel = ref(null)
const sources = ref(null)
const paths = ref(null)
const sessions = ref(null)

async function loadAll () {
  loading.value = true
  try {
    const [sumRes, funnelRes, sourcesRes, pathsRes, sessionsRes] = await Promise.all([
      api.get(`/customer-journey/summary?days=${days.value}`),
      api.get(`/customer-journey/funnel?days=${days.value}`),
      api.get(`/customer-journey/sources?days=${days.value}`),
      api.get(`/customer-journey/paths?days=${days.value}`),
      api.get(`/customer-journey/sessions?days=7&limit=20`),
    ])
    summary.value = sumRes.data
    funnel.value = funnelRes.data
    sources.value = sourcesRes.data
    paths.value = pathsRes.data
    sessions.value = sessionsRes.data
  } catch (e) {
    console.error('Journey load error', e)
  } finally {
    loading.value = false
  }
}

const maxStage = computed(() => {
  if (!funnel.value) return 1
  return Math.max(...funnel.value.stages.map(s => s.count), 1)
})

const maxSource = computed(() => {
  if (!sources.value || !sources.value.sources.length) return 1
  return Math.max(...sources.value.sources.map(s => s.sessions), 1)
})

const maxDaily = computed(() => {
  if (!summary.value || !summary.value.daily.length) return 1
  return Math.max(...summary.value.daily.map(d => d.sessions), 1)
})

const maxConversions = computed(() => {
  if (!summary.value || !summary.value.daily.length) return 1
  return Math.max(...summary.value.daily.map(d => d.conversions), 1)
})

const stageBgs = [
  'hsl(228, 50%, 55%)',
  'hsl(260, 50%, 55%)',
  'hsl(290, 50%, 55%)',
  'hsl(320, 60%, 55%)',
  'hsl(355, 70%, 58%)',
]
function stageBg (i) { return stageBgs[i % stageBgs.length] }

function crClass (rate) {
  if (rate >= 30) return 'cr-green'
  if (rate >= 10) return 'cr-orange'
  return 'cr-red'
}

function crBadgeClass (rate) {
  if (rate >= 5) return 'badge-good'
  if (rate >= 1) return 'badge-mid'
  return 'badge-low'
}

function sourceIcon (source) {
  const icons = { google: '🔍', facebook: '📘', twitter: '🐦', instagram: '📸', linkedin: '💼', direct: '🔗', referral: '🌐', email: '📧' }
  return icons[source] || '🌐'
}

function eventIcon (type) {
  const icons = { page_view: '👁', product_view: '🛍', add_to_cart: '🛒', checkout_start: '💳', purchase: '✅' }
  return icons[type] || '·'
}

onMounted(loadAll)
</script>

<style scoped>
.journey-view { max-width: 1400px; }
.loading-bar { height: 3px; background: var(--accent); animation: loading 1s infinite; border-radius: 2px; margin-bottom: 1rem; }
@keyframes loading { 0%,100%{ opacity:.4 } 50%{ opacity:1 } }

.journey-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 1.5rem;
}
@media (max-width: 900px) { .journey-grid { grid-template-columns: 1fr; } }

.card-section { padding: 1.5rem; border-radius: 1rem; }
.section-header { display: flex; align-items: center; justify-content: space-between; }

/* Funnel */
.funnel-stages { display: flex; flex-direction: column; gap: 0.75rem; }
.funnel-stage { display: flex; flex-direction: column; gap: 0.25rem; }
.funnel-bar-wrap { height: 28px; background: rgba(255,255,255,0.05); border-radius: 6px; overflow: hidden; }
.funnel-bar { height: 100%; border-radius: 6px; transition: width 0.6s ease; opacity: 0.85; }
.funnel-info { display: flex; gap: 1rem; align-items: center; font-size: 0.85rem; }
.funnel-name { font-weight: 600; min-width: 120px; }
.funnel-count { color: var(--text-muted); }
.funnel-cr { font-size: 0.78rem; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.cr-green { background: rgba(52,211,153,0.15); color: #34d399; }
.cr-orange { background: rgba(251,191,36,0.15); color: #fbbf24; }
.cr-red { background: rgba(239,68,68,0.15); color: #ef4444; }
.funnel-dropoff { font-size: 0.72rem; color: var(--text-muted); padding-left: 4px; }

/* Sources */
.sources-list { display: flex; flex-direction: column; gap: 0.6rem; }
.source-row { display: flex; align-items: center; gap: 0.75rem; }
.source-icon { font-size: 1.1rem; width: 24px; text-align: center; }
.source-name { min-width: 90px; font-size: 0.85rem; text-transform: capitalize; }
.source-bar-wrap { flex: 1; height: 8px; background: rgba(255,255,255,0.07); border-radius: 4px; overflow: hidden; }
.source-bar { height: 100%; background: var(--accent); border-radius: 4px; opacity: 0.7; transition: width 0.5s ease; }
.source-count { font-size: 0.82rem; color: var(--text-muted); min-width: 40px; text-align: right; }

/* UTM table */
.utm-table table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.utm-table th, .utm-table td { text-align: left; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.utm-table th { color: var(--text-muted); font-weight: 500; }
.medium-pill { background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 10px; font-size: 0.78rem; }

/* Paths table */
.paths-table table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.paths-table th, .paths-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.paths-table th { color: var(--text-muted); font-weight: 500; font-size: 0.78rem; }
.path-cell code { font-size: 0.8rem; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; }
.cr-badge { padding: 2px 8px; border-radius: 10px; font-size: 0.78rem; font-weight: 600; }
.badge-good { background: rgba(52,211,153,0.15); color: #34d399; }
.badge-mid { background: rgba(251,191,36,0.15); color: #fbbf24; }
.badge-low { background: rgba(156,163,175,0.15); color: #9ca3af; }

/* Daily chart */
.daily-chart { display: flex; align-items: flex-end; gap: 4px; height: 100px; overflow-x: auto; padding-bottom: 1.5rem; }
.daily-bar-group { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 20px; }
.bar-sessions { width: 10px; background: hsl(228,50%,55%); border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s; }
.bar-conversions { width: 10px; background: var(--accent); border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s; }
.bar-label { font-size: 0.62rem; color: var(--text-muted); writing-mode: vertical-rl; transform: rotate(180deg); margin-top: 2px; }
.chart-legend { display: flex; gap: 1.5rem; margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted); }
.leg-sessions { color: hsl(228,50%,65%); }
.leg-conversions { color: var(--accent); }

/* Journey list */
.journey-list { display: flex; flex-direction: column; gap: 0.75rem; }
.journey-item { background: rgba(255,255,255,0.03); border-radius: 0.5rem; padding: 0.75rem 1rem; }
.journey-meta { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; }
.session-id { font-size: 0.78rem; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; }
.step-count { font-size: 0.78rem; color: var(--text-muted); }
.converted-badge { font-size: 0.75rem; background: rgba(52,211,153,0.15); color: #34d399; padding: 2px 8px; border-radius: 10px; }
.journey-path { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 0.78rem; }
.journey-step { background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 6px; white-space: nowrap; }
.step-purchase { background: rgba(52,211,153,0.12); color: #34d399; }
.step-add_to_cart { background: rgba(251,191,36,0.12); color: #fbbf24; }
.step-checkout_start { background: rgba(139,92,246,0.12); color: #a78bfa; }
.step-arrow { color: var(--text-muted); }
.more-steps { font-size: 0.72rem; color: var(--text-muted); }

/* Product pills */
.product-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.product-pill { display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.06); border-radius: 0.5rem; padding: 0.4rem 0.75rem; text-decoration: none; color: inherit; font-size: 0.82rem; transition: background 0.2s; }
.product-pill:hover { background: rgba(255,255,255,0.1); }
.pp-slug { font-weight: 500; }
.pp-views { color: var(--text-muted); font-size: 0.76rem; }

.empty-state-small { text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem; }
</style>
