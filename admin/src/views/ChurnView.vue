<template>
  <div class="churn-view">
    <div class="page-header">
      <div>
        <h1>📉 Churn Risk & RFM Analysis</h1>
        <p class="subtitle">Identify at-risk customers with Recency · Frequency · Monetary scoring</p>
      </div>
      <div class="header-actions">
        <RouterLink to="/segment-email" class="btn btn-accent">📧 Send Win-back Email</RouterLink>
      </div>
    </div>

    <!-- Summary Cards -->
    <div v-if="summary" class="summary-grid">
      <div class="stat-card glass">
        <div class="stat-icon">👥</div>
        <div class="stat-info">
          <div class="stat-num">{{ summary.total }}</div>
          <div class="stat-label">Total Customers</div>
        </div>
      </div>
      <div class="stat-card glass risk-high">
        <div class="stat-icon">🔴</div>
        <div class="stat-info">
          <div class="stat-num">{{ summary.risk_counts?.high || 0 }}</div>
          <div class="stat-label">High Risk</div>
          <div class="stat-sub">{{ summary.high_risk_pct }}% of base</div>
        </div>
      </div>
      <div class="stat-card glass risk-medium">
        <div class="stat-icon">🟡</div>
        <div class="stat-info">
          <div class="stat-num">{{ summary.risk_counts?.medium || 0 }}</div>
          <div class="stat-label">Medium Risk</div>
        </div>
      </div>
      <div class="stat-card glass risk-low">
        <div class="stat-icon">🟢</div>
        <div class="stat-info">
          <div class="stat-num">{{ summary.risk_counts?.low || 0 }}</div>
          <div class="stat-label">Low Risk</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <div class="stat-num">{{ summary.avg_rfm_score }}</div>
          <div class="stat-label">Avg RFM Score</div>
          <div class="stat-sub">out of 5.0</div>
        </div>
      </div>
    </div>

    <!-- Segment Overview -->
    <div class="glass section" style="margin-bottom:1.25rem">
      <h2 style="margin:0 0 1rem;font-size:1rem;font-weight:700">📊 Customer Segments</h2>
      <div v-if="loadingSegments" class="loading-bar"></div>
      <div v-else class="segments-grid">
        <div
          v-for="seg in segments"
          :key="seg.segment"
          :class="['segment-card glass', { active: activeSegment === seg.segment }]"
          @click="filterBySegment(seg.segment)"
          :style="{ '--seg-color': seg.color }"
        >
          <div class="seg-label">{{ seg.label }}</div>
          <div class="seg-count">{{ seg.count }} customers</div>
          <div class="seg-revenue">€{{ seg.total_revenue.toFixed(0) }} revenue</div>
          <div class="seg-rfm">Avg RFM: {{ seg.avg_rfm }}</div>
          <div class="seg-desc">{{ seg.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Dormant Section -->
    <div class="glass section" style="margin-bottom:1.25rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
        <h2 style="margin:0;font-size:1rem;font-weight:700">😴 Dormant Customers</h2>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
          <label style="font-size:.8rem;color:var(--text-muted)">No orders in:</label>
          <select class="form-input" v-model="dormantDays" @change="loadDormant" style="width:120px">
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="180">6 months</option>
            <option value="365">1 year</option>
          </select>
          <button
            class="btn btn-accent btn-sm"
            @click="emailDormant"
            :disabled="!dormant.length"
          >📧 Email Dormant ({{ dormant.length }})</button>
        </div>
      </div>
      <div v-if="loadingDormant" class="loading-bar"></div>
      <div v-else-if="!dormant.length" class="empty-state">No dormant customers for this period 🎉</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Orders</th>
            <th>Total Spent</th>
            <th>Days Dormant</th>
            <th>Last Order</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in dormant.slice(0, 20)" :key="c.id">
            <td>
              <div class="cust-name">{{ c.first_name }} {{ c.last_name }}</div>
              <div class="cust-email">{{ c.email }}</div>
            </td>
            <td>{{ c.total_orders }}</td>
            <td>€{{ Number(c.total_spent).toFixed(2) }}</td>
            <td><span :class="['dormant-badge', c.days_dormant > 180 ? 'danger' : c.days_dormant > 90 ? 'warning' : '']">{{ c.days_dormant }}d</span></td>
            <td class="text-muted">{{ fmtDate(c.last_order_at) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="dormant.length > 20" class="more-hint">Showing top 20 of {{ dormant.length }} dormant customers.</div>
    </div>

    <!-- RFM Customer Table -->
    <div class="glass section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
        <h2 style="margin:0;font-size:1rem;font-weight:700">
          🎯 Customer RFM Scores
          <span v-if="activeSegment" class="active-filter-pill">{{ activeSegment }} <button @click="clearFilter">✕</button></span>
        </h2>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <input class="form-input" v-model="q" placeholder="Search customers…" @input="debouncedLoad" style="width:200px" />
          <select class="form-input" v-model="filterRisk" @change="loadCustomers" style="width:130px">
            <option value="">All Risk</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
      </div>
      <div v-if="loading" class="loading-bar"></div>
      <div v-else-if="!customers.length" class="empty-state">No customers match the current filters.</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th title="Recency score (1-5, higher=more recent)">R</th>
            <th title="Frequency score (1-5, higher=more orders)">F</th>
            <th title="Monetary score (1-5, higher=more spend)">M</th>
            <th>RFM Score</th>
            <th>Churn Risk</th>
            <th>Segment</th>
            <th>Orders</th>
            <th>Total Spent</th>
            <th>Last Order</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id">
            <td>
              <div class="cust-name">{{ c.first_name }} {{ c.last_name }}</div>
              <div class="cust-email">{{ c.email }}</div>
            </td>
            <td><span class="rfm-dot" :style="{ '--s': c.r_score }">{{ c.r_score }}</span></td>
            <td><span class="rfm-dot" :style="{ '--s': c.f_score }">{{ c.f_score }}</span></td>
            <td><span class="rfm-dot" :style="{ '--s': c.m_score }">{{ c.m_score }}</span></td>
            <td>
              <div class="rfm-bar-wrap">
                <div class="rfm-bar" :style="{ width: (c.rfm_score / 5 * 100) + '%' }"></div>
                <span class="rfm-num">{{ c.rfm_score }}</span>
              </div>
            </td>
            <td>
              <span :class="['risk-pill', c.churn_risk]">
                {{ c.churn_risk === 'high' ? '🔴' : c.churn_risk === 'medium' ? '🟡' : '🟢' }}
                {{ c.churn_risk }}
              </span>
            </td>
            <td><span class="segment-pill">{{ c.segment?.replace('_', ' ') }}</span></td>
            <td>{{ c.total_orders }}</td>
            <td>€{{ Number(c.total_spent).toFixed(2) }}</td>
            <td class="text-muted">{{ fmtDate(c.last_order_at) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination" v-if="total > pageSize">
        <button class="btn btn-ghost btn-sm" :disabled="page === 0" @click="prevPage">← Prev</button>
        <span class="page-info">{{ page + 1 }} / {{ Math.ceil(total / pageSize) }} · {{ total }} customers</span>
        <button class="btn btn-ghost btn-sm" :disabled="(page + 1) * pageSize >= total" @click="nextPage">Next →</button>
      </div>
    </div>

    <!-- Email dormant modal -->
    <div v-if="showEmailModal" class="modal-overlay" @click.self="showEmailModal = false">
      <div class="modal glass">
        <h2>📧 Email {{ dormant.length }} Dormant Customers</h2>
        <p class="modal-sub">Send a win-back email to all dormant customers ({{ dormantDays }}+ days).</p>
        <div class="form-group">
          <label>Email Subject *</label>
          <input v-model="emailForm.subject" class="form-input" placeholder="We miss you! Come back for 10% off" />
        </div>
        <div class="form-group">
          <label>Message *</label>
          <textarea v-model="emailForm.body" class="form-input" rows="6" placeholder="Hi {{name}},&#10;&#10;We haven't seen you in a while…"></textarea>
          <div class="hint">Supports: {{name}}, {{first_name}}, {{email}}, {{site_name}}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showEmailModal = false">Cancel</button>
          <button class="btn btn-accent" :disabled="sending || !emailForm.subject || !emailForm.body" @click="sendWinback">
            {{ sending ? 'Sending…' : `📤 Send to ${dormant.length}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'

const router = useRouter()

const summary = ref(null)
const segments = ref([])
const customers = ref([])
const dormant = ref([])
const loading = ref(false)
const loadingSegments = ref(false)
const loadingDormant = ref(false)
const q = ref('')
const filterRisk = ref('')
const activeSegment = ref('')
const dormantDays = ref(90)
const page = ref(0)
const pageSize = 30
const total = ref(0)
const showEmailModal = ref(false)
const sending = ref(false)
const emailForm = ref({ subject: '', body: '' })

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 0; loadCustomers() }, 400)
}

async function loadSummary() {
  try {
    const res = await api.get('/churn/summary')
    summary.value = res.data
  } catch {}
}

async function loadSegments() {
  loadingSegments.value = true
  try {
    const res = await api.get('/churn/segments-overview')
    segments.value = res.data
  } finally {
    loadingSegments.value = false
  }
}

async function loadCustomers() {
  loading.value = true
  try {
    const params = {
      limit: pageSize,
      offset: page.value * pageSize,
      q: q.value,
    }
    if (filterRisk.value) params.risk = filterRisk.value
    if (activeSegment.value) params.segment = activeSegment.value

    const res = await api.get('/churn/analysis', { params })
    customers.value = res.data.customers
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

async function loadDormant() {
  loadingDormant.value = true
  try {
    const res = await api.get('/churn/dormant', { params: { days: dormantDays.value } })
    dormant.value = res.data.customers
  } finally {
    loadingDormant.value = false
  }
}

function filterBySegment(seg) {
  activeSegment.value = activeSegment.value === seg ? '' : seg
  page.value = 0
  loadCustomers()
}

function clearFilter() {
  activeSegment.value = ''
  page.value = 0
  loadCustomers()
}

function prevPage() { if (page.value > 0) { page.value--; loadCustomers() } }
function nextPage() { if ((page.value + 1) * pageSize < total.value) { page.value++; loadCustomers() } }

function emailDormant() { showEmailModal.value = true }

async function sendWinback() {
  if (!emailForm.value.subject || !emailForm.value.body) return
  sending.value = true
  try {
    await api.post('/segment-email/send', {
      subject: emailForm.value.subject,
      html_body: emailForm.value.body.replace(/\n/g, '<br>'),
      dormant_days: dormantDays.value,
      campaign_name: `Win-back: ${dormantDays.value}d dormant`,
    })
    showEmailModal.value = false
    emailForm.value = { subject: '', body: '' }
    alert(`Win-back emails queued for ${dormant.value.length} customers!`)
  } catch (e) {
    alert('Send failed: ' + (e.response?.data?.error || e.message))
  } finally {
    sending.value = false
  }
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString()
}

onMounted(() => {
  loadSummary()
  loadSegments()
  loadCustomers()
  loadDormant()
})
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; flex-wrap:wrap; gap:.75rem; }
h1 { font-size:1.4rem; font-weight:800; margin:0; }
.subtitle { color:var(--text-muted); font-size:.83rem; margin:.25rem 0 0; }

.summary-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.75rem; margin-bottom:1.25rem; }
.stat-card { border-radius:1rem; padding:1rem 1.25rem; display:flex; align-items:center; gap:.75rem; }
.stat-card.risk-high { border-left:3px solid #ef4444; }
.stat-card.risk-medium { border-left:3px solid #f59e0b; }
.stat-card.risk-low { border-left:3px solid #4ade80; }
.stat-icon { font-size:1.5rem; }
.stat-num { font-size:1.5rem; font-weight:800; line-height:1; }
.stat-label { font-size:.75rem; color:var(--text-muted); margin-top:.1rem; }
.stat-sub { font-size:.7rem; color:var(--text-muted); margin-top:.15rem; }

.section { border-radius:1rem; padding:1.25rem; }

.segments-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:.75rem; }
.segment-card { border-radius:.875rem; padding:1rem; cursor:pointer; transition:transform .15s,box-shadow .15s; border-left:3px solid var(--seg-color); }
.segment-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.25); }
.segment-card.active { outline:2px solid var(--accent); }
.seg-label { font-weight:700; font-size:.87rem; margin-bottom:.3rem; }
.seg-count { font-size:.8rem; color:var(--text-muted); }
.seg-revenue { font-size:.8rem; color:var(--accent); font-weight:600; }
.seg-rfm { font-size:.75rem; color:var(--text-muted); }
.seg-desc { font-size:.72rem; color:var(--text-muted); margin-top:.35rem; font-style:italic; }

.table { width:100%; border-collapse:collapse; font-size:.85rem; }
.table th { padding:.5rem .75rem; text-align:left; color:var(--text-muted); font-size:.75rem; font-weight:600; border-bottom:1px solid rgba(255,255,255,.06); white-space:nowrap; }
.table td { padding:.5rem .75rem; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
.table tr:last-child td { border-bottom:none; }

.cust-name { font-weight:600; font-size:.85rem; }
.cust-email { font-size:.75rem; color:var(--text-muted); }
.text-muted { color:var(--text-muted); font-size:.8rem; }

.rfm-dot {
  display:inline-flex; align-items:center; justify-content:center;
  width:24px; height:24px; border-radius:50%; font-size:.75rem; font-weight:700;
  background: color-mix(in srgb, var(--accent) calc(var(--s) * 20%), transparent);
  color:#fff;
}
.rfm-bar-wrap { display:flex; align-items:center; gap:.5rem; width:100px; }
.rfm-bar { height:6px; border-radius:999px; background:var(--accent); transition:width .3s; }
.rfm-num { font-size:.78rem; font-weight:700; color:var(--accent); min-width:24px; }

.risk-pill { display:inline-flex; align-items:center; gap:.3rem; padding:.2em .6em; border-radius:999px; font-size:.75rem; font-weight:600; text-transform:capitalize; }
.risk-pill.high { background:rgba(239,68,68,.15); color:#ef4444; }
.risk-pill.medium { background:rgba(245,158,11,.15); color:#f59e0b; }
.risk-pill.low { background:rgba(74,222,128,.15); color:#4ade80; }

.segment-pill { display:inline-block; padding:.2em .55em; border-radius:999px; font-size:.72rem; font-weight:600; background:rgba(255,255,255,.07); color:#aaa; text-transform:capitalize; }

.dormant-badge { display:inline-block; padding:.2em .55em; border-radius:999px; font-size:.75rem; font-weight:700; background:rgba(255,255,255,.07); color:#ccc; }
.dormant-badge.warning { background:rgba(245,158,11,.15); color:#f59e0b; }
.dormant-badge.danger { background:rgba(239,68,68,.15); color:#ef4444; }

.active-filter-pill { display:inline-flex; align-items:center; gap:.3rem; background:rgba(var(--accent-rgb),.15); color:var(--accent); padding:.15em .5em; border-radius:999px; font-size:.75rem; margin-left:.5rem; }
.active-filter-pill button { background:none; border:none; color:inherit; cursor:pointer; padding:0; font-size:.75rem; line-height:1; }

.empty-state { text-align:center; color:var(--text-muted); padding:2rem; font-size:.9rem; }
.more-hint { font-size:.78rem; color:var(--text-muted); text-align:center; margin-top:.75rem; }

.pagination { display:flex; justify-content:center; align-items:center; gap:1rem; margin-top:1rem; }
.page-info { font-size:.8rem; color:var(--text-muted); }

.loading-bar { height:3px; background:var(--accent); border-radius:999px; animation:pulse 1s infinite alternate; margin-bottom:.5rem; }
@keyframes pulse { from { opacity:.4 } to { opacity:1 } }

.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal { padding:2rem; border-radius:1.25rem; width:min(520px,95vw); max-height:90vh; overflow-y:auto; }
.modal h2 { margin:0 0 .5rem; font-size:1.1rem; font-weight:800; }
.modal-sub { color:var(--text-muted); font-size:.85rem; margin-bottom:1.25rem; }
.form-group { margin-bottom:1rem; }
.form-group label { display:block; font-size:.8rem; font-weight:600; color:var(--text-muted); margin-bottom:.35rem; text-transform:uppercase; letter-spacing:.04em; }
.hint { font-size:.73rem; color:var(--text-muted); margin-top:.3rem; }
.modal-footer { display:flex; justify-content:flex-end; gap:.75rem; margin-top:1.5rem; }
</style>
