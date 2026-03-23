<template>
  <div>
    <div class="page-header">
      <h1>👥 Social Proof</h1>
      <p class="subtitle">Live viewer counts and recent purchase activity</p>
      <button class="btn btn-outline" @click="load" :disabled="loading">🔄 Refresh</button>
    </div>

    <div v-if="loading" class="loading">Loading…</div>

    <template v-else>
      <!-- Stats Strip -->
      <div class="stats-row">
        <div class="stat-card glass">
          <div class="stat-label">Live Visitors</div>
          <div class="stat-value" :class="{ accent: stats.live_viewers > 0 }">{{ stats.live_viewers }}</div>
        </div>
        <div class="stat-card glass">
          <div class="stat-label">Purchase Events (48h)</div>
          <div class="stat-value">{{ stats.purchase_events }}</div>
        </div>
        <div class="stat-card glass">
          <div class="stat-label">Active Pages</div>
          <div class="stat-value">{{ stats.top_pages?.length || 0 }}</div>
        </div>
      </div>

      <!-- Top Pages with Live Viewers -->
      <div class="glass section">
        <h3 class="section-title">📍 Live Viewers by Page</h3>
        <div v-if="!stats.top_pages?.length" class="muted" style="padding:12px 0;">No active viewers right now.</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Page Path</th>
              <th>Live Viewers</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in stats.top_pages" :key="p.path">
              <td><code class="path">{{ p.path }}</code></td>
              <td>
                <span class="viewer-count">
                  <span class="live-dot"></span>
                  {{ p.viewers }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Recent Purchase Activity -->
      <div class="glass section">
        <h3 class="section-title">🛍️ Recent Purchase Activity (last 48h)</h3>
        <p class="hint">These events are shown to visitors as social proof popups on product pages.</p>
        <div v-if="!activity.length" class="muted" style="padding:12px 0;">No recent purchase events.</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Customer</th>
              <th>City</th>
              <th>Amount</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in activity" :key="e.id">
              <td><strong>{{ e.product_name }}</strong></td>
              <td>{{ e.customer_display }}</td>
              <td>{{ e.city || '—' }}</td>
              <td>{{ e.amount ? (symbol + parseFloat(e.amount).toFixed(2)) : '—' }}</td>
              <td class="muted">{{ timeAgo(e.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="glass section how-it-works">
        <h3 class="section-title">⚙️ How Social Proof Works</h3>
        <ul class="how-list">
          <li><strong>Live viewers:</strong> Product pages send a ping every 30s. Visitors who pinged in the last 90s are counted as "live". The <code>SocialProof.vue</code> component displays this count on each product page.</li>
          <li><strong>Purchase activity:</strong> When an order is placed, a masked event is recorded (e.g. "Jane D. from Berlin just bought…"). The activity feed is shown as a popup on product pages to increase confidence.</li>
          <li><strong>Privacy:</strong> Customer names are masked (first name + last initial only). No email or full address is stored.</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const stats = ref({ live_viewers: 0, purchase_events: 0, top_pages: [] })
const activity = ref([])
const loading = ref(true)
const symbol = ref('€')

async function load() {
  loading.value = true
  try {
    const [statsRes, actRes, settingsRes] = await Promise.all([
      api.get('/social-proof/admin'),
      api.get('/social-proof/recent?limit=20'),
      api.get('/settings'),
    ])
    stats.value = statsRes.data
    activity.value = actRes.data
    symbol.value = settingsRes.data.shop_currency_symbol || '€'
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.page-header h1 { margin: 0; flex: 1; }
.subtitle { margin: 0; color: var(--text-muted); font-size: .85rem; flex-basis: 100%; }
.stats-row { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.stat-card { padding: 16px 20px; min-width: 140px; text-align: center; }
.stat-label { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); }
.stat-value { font-size: 1.8rem; font-weight: 700; margin-top: 4px; }
.stat-value.accent { color: var(--accent); }
.section { padding: 20px; margin-bottom: 20px; }
.section-title { margin: 0 0 12px; font-size: 1rem; font-weight: 700; }
.hint { font-size: .82rem; color: var(--text-muted); margin: 0 0 12px; }
.table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.table th { padding: 8px 12px; text-align: left; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); border-bottom: 1px solid var(--border); }
.table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.04); }
.table tr:last-child td { border-bottom: none; }
.path { background: rgba(255,255,255,.06); padding: 2px 6px; border-radius: 4px; font-size: .82rem; }
.viewer-count { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: #4ce88a; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ce88a; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
.muted { color: var(--text-muted); }
.loading { text-align: center; padding: 40px; color: var(--text-muted); }
.how-it-works { background: rgba(255,255,255,.02); }
.how-list { margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 8px; }
.how-list li { font-size: .875rem; line-height: 1.5; }
.glass { background: var(--surface); border: 1px solid rgba(255,255,255,.08); border-radius: 1rem; }
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 6px 14px; border-radius: 8px; font-size: .82rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: .15s; }
.btn-outline { background: transparent; border-color: var(--accent); color: var(--accent); }
.btn-outline:hover { background: rgba(var(--accent-rgb),.1); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
