<template>
  <div class="nps-view">
    <div class="page-header">
      <div>
        <h1>📊 NPS Surveys</h1>
        <p class="subtitle">Net Promoter Score — track customer satisfaction and loyalty</p>
      </div>
      <div class="header-actions">
        <select v-model="days" @change="load" class="form-input" style="width:130px">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">All time</option>
        </select>
        <RouterLink to="/settings" class="btn-ghost">⚙️ NPS Settings</RouterLink>
      </div>
    </div>

    <div class="loading-bar" v-if="loading"></div>

    <template v-if="summary">
      <!-- NPS Score Hero -->
      <div class="nps-hero glass">
        <div class="nps-score-wrap">
          <div class="nps-score-circle" :class="scoreClass">
            <div class="nps-score-val">{{ summary.nps_score !== null ? summary.nps_score : '—' }}</div>
            <div class="nps-score-label">NPS Score</div>
          </div>
          <div class="nps-score-desc">
            <div class="nps-rating-label" :class="scoreClass">{{ ratingLabel }}</div>
            <div class="nps-rating-sub text-muted">Based on {{ summary.total }} response{{ summary.total !== 1 ? 's' : '' }} in the last {{ days }} days</div>
          </div>
        </div>

        <div class="nps-segments">
          <div class="seg-card promoter">
            <div class="seg-label">😍 Promoters</div>
            <div class="seg-count">{{ summary.promoters }}</div>
            <div class="seg-pct">{{ summary.promoter_pct }}%</div>
            <div class="seg-note">Score 9–10</div>
          </div>
          <div class="seg-card passive">
            <div class="seg-label">😐 Passives</div>
            <div class="seg-count">{{ summary.passives }}</div>
            <div class="seg-pct">{{ summary.passive_pct }}%</div>
            <div class="seg-note">Score 7–8</div>
          </div>
          <div class="seg-card detractor">
            <div class="seg-label">😞 Detractors</div>
            <div class="seg-count">{{ summary.detractors }}</div>
            <div class="seg-pct">{{ summary.detractor_pct }}%</div>
            <div class="seg-note">Score 0–6</div>
          </div>
        </div>
      </div>

      <!-- Score Distribution -->
      <div class="glass chart-card">
        <h3 class="card-section-title">Score Distribution</h3>
        <div class="distribution-chart">
          <div
            v-for="d in summary.distribution"
            :key="d.score"
            class="dist-bar-wrap"
          >
            <div class="dist-bar-container">
              <div
                class="dist-bar"
                :class="scoreColorClass(d.score)"
                :style="`height: ${maxDist > 0 ? (d.count / maxDist * 100) : 0}%`"
              ></div>
            </div>
            <div class="dist-label">{{ d.score }}</div>
            <div class="dist-count text-muted">{{ d.count }}</div>
          </div>
        </div>
      </div>

      <!-- Average score stat -->
      <div class="stats-strip">
        <div class="stat-card">
          <div class="stat-value">{{ summary.avg_score ?? '—' }}</div>
          <div class="stat-label">Avg Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ summary.total }}</div>
          <div class="stat-label">Total Responses</div>
        </div>
        <div class="stat-card" :class="{ 'stat-accent': summary.promoter_pct > 50 }">
          <div class="stat-value">{{ summary.promoter_pct }}%</div>
          <div class="stat-label">Promoter Rate</div>
        </div>
        <div class="stat-card" :class="{ 'stat-danger': summary.detractor_pct > 30 }">
          <div class="stat-value">{{ summary.detractor_pct }}%</div>
          <div class="stat-label">Detractor Rate</div>
        </div>
      </div>
    </template>

    <!-- Tabs: Responses & Feedback -->
    <div class="tab-bar">
      <button :class="['tab-btn', { active: tab === 'responses' }]" @click="tab = 'responses'">All Responses</button>
      <button :class="['tab-btn', { active: tab === 'feedback' }]" @click="tab = 'feedback'">📝 Feedback</button>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar glass" v-if="tab === 'responses'">
      <input v-model="search" @input="loadResponses" type="text" class="form-input" placeholder="Search by email or order…" style="max-width:260px" />
      <select v-model="segment" @change="loadResponses" class="form-input" style="width:150px">
        <option value="">All segments</option>
        <option value="promoter">😍 Promoters</option>
        <option value="passive">😐 Passives</option>
        <option value="detractor">😞 Detractors</option>
      </select>
    </div>

    <!-- Responses Table -->
    <div class="glass table-card" v-if="tab === 'responses'">
      <table class="data-table" v-if="responses.length">
        <thead>
          <tr>
            <th>Score</th>
            <th>Segment</th>
            <th>Customer</th>
            <th>Order</th>
            <th>Date</th>
            <th>Feedback</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in responses" :key="r.id">
            <td>
              <span class="score-chip" :class="scoreColorClass(r.score)">{{ r.score }}</span>
            </td>
            <td>
              <span class="seg-pill" :class="segClass(r.score)">{{ segLabel(r.score) }}</span>
            </td>
            <td class="text-muted" style="font-size:.83rem">{{ r.customer_email || '—' }}</td>
            <td class="text-muted" style="font-size:.83rem">{{ r.order_number || '—' }}</td>
            <td class="text-muted" style="font-size:.78rem">{{ formatDate(r.responded_at) }}</td>
            <td style="max-width:260px">
              <div v-if="r.feedback" class="feedback-preview">{{ r.feedback }}</div>
              <span v-else class="text-muted" style="font-size:.78rem">—</span>
            </td>
            <td>
              <button class="btn-ghost btn-sm danger" @click="deleteResponse(r.id)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <div class="empty-icon">📊</div>
        <h2>No responses yet</h2>
        <p>NPS responses will appear here once customers submit surveys.</p>
      </div>
    </div>

    <!-- Feedback Tab -->
    <div v-if="tab === 'feedback'" class="feedback-list">
      <div v-if="summary?.recentFeedback?.length === 0" class="empty-state glass">
        <div class="empty-icon">💬</div>
        <p>No feedback submitted yet.</p>
      </div>
      <div
        v-for="fb in summary?.recentFeedback || []"
        :key="fb.responded_at + fb.customer_email"
        class="feedback-card glass"
      >
        <div class="fb-header">
          <span class="score-chip" :class="scoreColorClass(fb.score)">{{ fb.score }}</span>
          <span class="seg-pill" :class="segClass(fb.score)">{{ segLabel(fb.score) }}</span>
          <span class="text-muted" style="font-size:.78rem">{{ fb.customer_email || 'Anonymous' }}</span>
          <span class="text-muted" style="font-size:.78rem;margin-left:auto">{{ formatDate(fb.responded_at) }}</span>
        </div>
        <div class="fb-text">{{ fb.feedback }}</div>
        <div v-if="fb.order_number" class="text-muted" style="font-size:.78rem;margin-top:.25rem">Order: {{ fb.order_number }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const days     = ref(30)
const loading  = ref(true)
const summary  = ref(null)
const responses= ref([])
const search   = ref('')
const segment  = ref('')
const tab      = ref('responses')

const maxDist = computed(() =>
  Math.max(...(summary.value?.distribution?.map(d => d.count) || [1]))
)

const scoreClass = computed(() => {
  const s = summary.value?.nps_score
  if (s === null || s === undefined) return ''
  if (s >= 50) return 'excellent'
  if (s >= 30) return 'good'
  if (s >= 0) return 'ok'
  return 'bad'
})

const ratingLabel = computed(() => {
  const s = summary.value?.nps_score
  if (s === null || s === undefined) return 'No data'
  if (s >= 70) return 'Excellent 🌟'
  if (s >= 50) return 'Great 🎉'
  if (s >= 30) return 'Good 👍'
  if (s >= 0)  return 'Needs Work 💪'
  return 'Critical ⚠️'
})

async function load() {
  loading.value = true
  try {
    const [sumRes, resRes] = await Promise.all([
      api.get('/nps/summary', { params: { days: days.value } }),
      api.get('/nps', { params: { days: days.value, limit: 100 } })
    ])
    summary.value = sumRes.data
    responses.value = resRes.data.responses || []
  } finally {
    loading.value = false
  }
}

async function loadResponses() {
  const res = await api.get('/nps', {
    params: { days: days.value, q: search.value, segment: segment.value, limit: 100 }
  })
  responses.value = res.data.responses || []
}

async function deleteResponse(id) {
  if (!confirm('Delete this response?')) return
  await api.delete(`/nps/${id}`)
  await load()
}

function scoreColorClass(s) {
  if (s >= 9) return 'promoter-color'
  if (s >= 7) return 'passive-color'
  return 'detractor-color'
}
function segClass(s) { return s >= 9 ? 'promoter' : s >= 7 ? 'passive' : 'detractor' }
function segLabel(s) { return s >= 9 ? '😍 Promoter' : s >= 7 ? '😐 Passive' : '😞 Detractor' }

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.nps-view { display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; }
.page-header h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
.subtitle { color: rgba(255,255,255,.5); margin: 0; font-size: .9rem; }
.header-actions { display: flex; gap: .75rem; align-items: center; }

.loading-bar { height: 3px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: load 1s ease-in-out infinite; border-radius: 2px; }
@keyframes load { 0%,100%{transform:scaleX(.3);opacity:.6} 50%{transform:scaleX(1);opacity:1} }

.nps-hero { border-radius: 1rem; padding: 1.5rem; display: flex; gap: 2rem; align-items: center; flex-wrap: wrap; }
.nps-score-wrap { display: flex; align-items: center; gap: 1.25rem; }
.nps-score-circle {
  width: 90px; height: 90px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 3px solid rgba(255,255,255,.15);
  flex-shrink: 0;
}
.nps-score-circle.excellent { border-color: #4ade80; }
.nps-score-circle.good      { border-color: #a3e635; }
.nps-score-circle.ok        { border-color: #fbbf24; }
.nps-score-circle.bad       { border-color: #f87171; }
.nps-score-val { font-size: 1.8rem; font-weight: 900; line-height: 1; }
.nps-score-label { font-size: .65rem; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.5); margin-top: 2px; }
.nps-rating-label { font-size: 1.2rem; font-weight: 700; }
.nps-rating-label.excellent { color: #4ade80; }
.nps-rating-label.good      { color: #a3e635; }
.nps-rating-label.ok        { color: #fbbf24; }
.nps-rating-label.bad       { color: #f87171; }
.nps-rating-sub { font-size: .85rem; margin-top: .25rem; }

.nps-segments { display: flex; gap: .75rem; flex-wrap: wrap; margin-left: auto; }
.seg-card { text-align: center; border-radius: .75rem; padding: .75rem 1rem; min-width: 90px; }
.seg-card.promoter { background: rgba(74,222,128,.1); border: 1px solid rgba(74,222,128,.2); }
.seg-card.passive  { background: rgba(251,191,36,.1);  border: 1px solid rgba(251,191,36,.2); }
.seg-card.detractor{ background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2); }
.seg-label { font-size: .75rem; font-weight: 600; margin-bottom: .25rem; }
.seg-count { font-size: 1.4rem; font-weight: 800; line-height: 1; }
.seg-pct   { font-size: .8rem; font-weight: 600; }
.seg-note  { font-size: .68rem; color: rgba(255,255,255,.4); margin-top: .25rem; }

.chart-card { border-radius: 1rem; padding: 1.25rem; }
.card-section-title { font-size: .95rem; font-weight: 700; margin: 0 0 1rem; }
.distribution-chart { display: flex; gap: .5rem; align-items: flex-end; height: 120px; }
.dist-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .2rem; height: 100%; }
.dist-bar-container { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.dist-bar { width: 100%; border-radius: .25rem .25rem 0 0; transition: height .3s; min-height: 2px; }
.promoter-color { background: #4ade80; }
.passive-color  { background: #fbbf24; }
.detractor-color{ background: #f87171; }
.dist-label { font-size: .72rem; font-weight: 700; }
.dist-count { font-size: .68rem; color: rgba(255,255,255,.4); }

.stats-strip { display: flex; gap: .75rem; flex-wrap: wrap; }
.stat-card { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .75rem; padding: .75rem 1rem; min-width: 90px; }
.stat-card.stat-accent { border-color: rgba(74,222,128,.3); }
.stat-card.stat-danger { border-color: rgba(248,113,113,.3); }
.stat-value { font-size: 1.5rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: .75rem; color: rgba(255,255,255,.5); margin-top: .25rem; }

.tab-bar { display: flex; gap: .5rem; background: rgba(255,255,255,.04); border-radius: .75rem; padding: .3rem; width: fit-content; }
.tab-btn { padding: .4rem 1rem; border-radius: .5rem; border: none; background: transparent; color: rgba(255,255,255,.6); cursor: pointer; font-size: .85rem; font-family: inherit; transition: all .2s; }
.tab-btn.active { background: rgba(255,255,255,.1); color: #fff; font-weight: 600; }

.filter-bar { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; padding: .75rem 1rem; border-radius: .75rem; }

.table-card { border-radius: 1rem; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { padding: .65rem 1rem; text-align: left; font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: rgba(255,255,255,.5); border-bottom: 1px solid rgba(255,255,255,.08); }
.data-table td { padding: .65rem 1rem; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }

.score-chip { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; font-size: .85rem; font-weight: 800; }
.score-chip.promoter-color  { background: rgba(74,222,128,.2);  color: #4ade80; }
.score-chip.passive-color   { background: rgba(251,191,36,.2);  color: #fbbf24; }
.score-chip.detractor-color { background: rgba(248,113,113,.2); color: #f87171; }

.seg-pill { font-size: .72rem; font-weight: 600; padding: .2rem .5rem; border-radius: .4rem; }
.seg-pill.promoter  { background: rgba(74,222,128,.15); color: #4ade80; }
.seg-pill.passive   { background: rgba(251,191,36,.15); color: #fbbf24; }
.seg-pill.detractor { background: rgba(248,113,113,.15);color: #f87171; }

.feedback-preview { font-size: .83rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
.btn-ghost.danger { color: #f87171; }

.empty-state { text-align: center; padding: 3rem 2rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }
.empty-state h2 { font-size: 1.1rem; margin: 0 0 .5rem; }
.empty-state p { color: rgba(255,255,255,.5); }

.feedback-list { display: flex; flex-direction: column; gap: .75rem; }
.feedback-card { border-radius: 1rem; padding: 1rem 1.25rem; }
.fb-header { display: flex; align-items: center; gap: .6rem; margin-bottom: .5rem; }
.fb-text { font-size: .9rem; line-height: 1.5; }

.text-muted { color: rgba(255,255,255,.5); }
.form-input { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; color: #fff; padding: .5rem .75rem; font-size: .875rem; font-family: inherit; }
.form-input:focus { outline: none; border-color: var(--accent); }
.btn-ghost { background: none; border: 1px solid rgba(255,255,255,.15); color: rgba(255,255,255,.8); padding: .4rem .85rem; border-radius: .5rem; cursor: pointer; font-size: .85rem; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: .35rem; }
.btn-ghost:hover { background: rgba(255,255,255,.08); }
.btn-sm { padding: .3rem .6rem; font-size: .78rem; }
</style>
