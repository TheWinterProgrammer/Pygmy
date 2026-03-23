<template>
  <div class="ab-wrap">
    <div class="page-header">
      <h1>🧪 A/B Tests</h1>
      <button class="btn btn-primary" @click="openCreate">+ New Test</button>
    </div>

    <!-- Stats strip -->
    <div class="ab-stats" v-if="stats">
      <div class="astat glass"><div class="astat-num">{{ stats.total }}</div><div class="astat-label">Total</div></div>
      <div class="astat glass accent"><div class="astat-num">{{ stats.running }}</div><div class="astat-label">Running</div></div>
      <div class="astat glass"><div class="astat-num">{{ stats.completed }}</div><div class="astat-label">Completed</div></div>
      <div class="astat glass"><div class="astat-num">{{ stats.draft }}</div><div class="astat-label">Draft</div></div>
    </div>

    <!-- Filter -->
    <div class="filter-bar glass">
      <select v-model="filterStatus" class="input" style="max-width:140px">
        <option value="">All Status</option>
        <option value="draft">Draft</option>
        <option value="running">Running</option>
        <option value="paused">Paused</option>
        <option value="completed">Completed</option>
      </select>
    </div>

    <!-- Table -->
    <div class="glass card-table" v-if="tests.length">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Entity</th>
            <th>Goal</th>
            <th>Split</th>
            <th>Impressions</th>
            <th>Conversions</th>
            <th>Status</th>
            <th>Winner</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="test in filteredTests" :key="test.id">
            <td>
              <strong>{{ test.name }}</strong>
              <div class="text-muted text-sm" v-if="test.description">{{ test.description }}</div>
            </td>
            <td><span class="tag">{{ test.entity_type }}</span> <span class="text-muted text-sm" v-if="test.entity_id">#{{ test.entity_id }}</span></td>
            <td><span class="tag">{{ test.goal }}</span></td>
            <td>{{ 100 - test.split }}% / {{ test.split }}%</td>
            <td>{{ test.impressions }}</td>
            <td>{{ test.conversions }}</td>
            <td><span class="status-pill" :class="test.status">{{ test.status }}</span></td>
            <td>
              <span v-if="test.winner" class="winner-badge" :class="test.winner">🏆 {{ test.winner.toUpperCase() }}</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="actions">
              <button class="btn btn-ghost btn-sm" @click="openDetail(test)">📊 Stats</button>
              <button class="btn btn-ghost btn-sm" @click="openEdit(test)">✏️</button>
              <button v-if="test.status === 'draft'" class="btn btn-sm" style="background:var(--accent)" @click="setStatus(test, 'running')">▶ Start</button>
              <button v-if="test.status === 'running'" class="btn btn-ghost btn-sm" @click="setStatus(test, 'paused')">⏸ Pause</button>
              <button v-if="test.status === 'paused'" class="btn btn-ghost btn-sm" @click="setStatus(test, 'running')">▶ Resume</button>
              <button v-if="['running','paused'].includes(test.status)" class="btn btn-ghost btn-sm" @click="setStatus(test, 'completed')">✅ End</button>
              <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(test)">🗑</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="empty-state glass" v-else>
      <p>No A/B tests yet. Create one to start optimising your content!</p>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal-overlay" v-if="showForm" @click.self="showForm = false">
      <div class="modal-card glass">
        <div class="modal-header">
          <h2>{{ editing ? 'Edit Test' : 'New A/B Test' }}</h2>
          <button class="btn-close" @click="showForm = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="field-row">
            <label>Test Name *</label>
            <input v-model="form.name" class="input" placeholder="Homepage Hero CTA Test" />
          </div>
          <div class="field-row">
            <label>Description</label>
            <textarea v-model="form.description" class="input textarea" rows="2" placeholder="What are you testing?"></textarea>
          </div>
          <div class="field-row row2">
            <div>
              <label>Entity Type</label>
              <select v-model="form.entity_type" class="input">
                <option value="page">Page</option>
                <option value="post">Post</option>
                <option value="product">Product</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label>Entity ID (optional)</label>
              <input v-model="form.entity_id" type="number" class="input" placeholder="Leave blank for site-wide" />
            </div>
          </div>
          <div class="field-row row2">
            <div>
              <label>Goal</label>
              <select v-model="form.goal" class="input">
                <option value="click">Click</option>
                <option value="conversion">Conversion (purchase/signup)</option>
                <option value="bounce">Bounce reduction</option>
                <option value="time_on_page">Time on page</option>
              </select>
            </div>
            <div>
              <label>Goal Selector / Event (optional)</label>
              <input v-model="form.goal_selector" class="input" placeholder=".btn-buy or checkout.complete" />
            </div>
          </div>
          <div class="field-row">
            <label>Traffic Split (% to Variant B): <strong>{{ form.split }}%</strong></label>
            <input v-model.number="form.split" type="range" min="10" max="90" step="5" class="slider" />
            <div class="split-labels"><span>A: {{ 100 - form.split }}%</span><span>B: {{ form.split }}%</span></div>
          </div>

          <!-- Variant overrides -->
          <div class="variants-section" v-if="!editing">
            <h3>Variants</h3>
            <p class="text-muted text-sm">Define what each variant shows. Changes are JSON field overrides (e.g. <code>{"title": "Buy Now"}</code>).</p>
            <div class="variant-row" v-for="(v, i) in form.variants" :key="i">
              <div class="variant-label-badge" :class="v.label.toLowerCase()">{{ v.label }}</div>
              <input v-model="v.name" class="input" :placeholder="i === 0 ? 'Control (Original)' : 'Variant B'" />
              <textarea v-model="v.changesStr" class="input textarea mono" rows="2" :placeholder='`{"hero_title": "New headline"}`'></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showForm = false">Cancel</button>
          <button class="btn btn-primary" @click="saveForm" :disabled="saving">
            {{ saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Test') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Detail / Stats Modal -->
    <div class="modal-overlay" v-if="showDetail && detailTest" @click.self="showDetail = false">
      <div class="modal-card glass wide">
        <div class="modal-header">
          <h2>📊 {{ detailTest.name }}</h2>
          <button class="btn-close" @click="showDetail = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="detail-meta">
            <span class="tag">{{ detailTest.entity_type }}</span>
            <span class="tag">Goal: {{ detailTest.goal }}</span>
            <span class="status-pill" :class="detailTest.status">{{ detailTest.status }}</span>
            <span v-if="detailTest.started_at" class="text-muted text-sm">Started: {{ fmt(detailTest.started_at) }}</span>
            <span v-if="detailTest.ended_at" class="text-muted text-sm">Ended: {{ fmt(detailTest.ended_at) }}</span>
          </div>

          <div class="variant-cards">
            <div class="variant-card glass" v-for="v in detailTest.variants" :key="v.id" :class="{ winner: detailTest.winner === v.label.toLowerCase() }">
              <div class="variant-card-header">
                <div class="variant-label-badge" :class="v.label.toLowerCase()">{{ v.label }}</div>
                <h3>{{ v.name }}</h3>
                <span class="winner-crown" v-if="detailTest.winner === v.label.toLowerCase()">🏆 Winner</span>
              </div>
              <div class="variant-stats">
                <div class="vstat"><div class="vstat-num">{{ v.impressions }}</div><div class="vstat-label">Impressions</div></div>
                <div class="vstat"><div class="vstat-num">{{ v.conversions }}</div><div class="vstat-label">Conversions</div></div>
                <div class="vstat accent"><div class="vstat-num">{{ v.conversion_rate }}%</div><div class="vstat-label">Conv. Rate</div></div>
              </div>
              <!-- Conversion rate bar -->
              <div class="conv-bar-wrap">
                <div class="conv-bar" :style="{ width: Math.min(Number(v.conversion_rate) * 3, 100) + '%' }"></div>
              </div>
              <div v-if="Object.keys(v.changes).length" class="changes-preview">
                <div class="text-muted text-sm">Overrides:</div>
                <div v-for="(val, key) in v.changes" :key="key" class="change-row">
                  <code>{{ key }}:</code> <span>{{ val }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Winner selection -->
          <div class="winner-section" v-if="['running', 'paused', 'completed'].includes(detailTest.status)">
            <h3>Declare Winner</h3>
            <div class="winner-btns">
              <button v-for="v in detailTest.variants" :key="v.id"
                class="btn" :class="detailTest.winner === v.label.toLowerCase() ? 'btn-primary' : 'btn-ghost'"
                @click="setWinner(detailTest, v.label.toLowerCase())">
                {{ detailTest.winner === v.label.toLowerCase() ? '🏆' : '○' }} Variant {{ v.label }}
              </button>
              <button v-if="detailTest.winner" class="btn btn-ghost" @click="setWinner(detailTest, null)">Clear Winner</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div class="modal-overlay" v-if="showDeleteConfirm" @click.self="showDeleteConfirm = false">
      <div class="modal-card glass small">
        <div class="modal-header"><h2>Delete Test?</h2><button class="btn-close" @click="showDeleteConfirm = false">✕</button></div>
        <div class="modal-body"><p>Delete <strong>{{ deleteTarget?.name }}</strong> and all its impression data? This cannot be undone.</p></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showDeleteConfirm = false">Cancel</button>
          <button class="btn btn-primary danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const tests = ref([])
const filterStatus = ref('')
const showForm = ref(false)
const showDetail = ref(false)
const showDeleteConfirm = ref(false)
const editing = ref(null)
const detailTest = ref(null)
const deleteTarget = ref(null)
const saving = ref(false)

const defaultForm = () => ({
  name: '', description: '', entity_type: 'page', entity_id: '',
  split: 50, goal: 'click', goal_selector: '',
  variants: [
    { label: 'A', name: 'Control (Original)', changesStr: '{}' },
    { label: 'B', name: 'Variant B', changesStr: '{}' },
  ],
})

const form = ref(defaultForm())

const stats = computed(() => ({
  total: tests.value.length,
  running: tests.value.filter(t => t.status === 'running').length,
  completed: tests.value.filter(t => t.status === 'completed').length,
  draft: tests.value.filter(t => t.status === 'draft').length,
}))

const filteredTests = computed(() =>
  filterStatus.value ? tests.value.filter(t => t.status === filterStatus.value) : tests.value
)

async function load() {
  const r = await api.get('/ab-tests')
  tests.value = r.data.tests || []
}

function openCreate() {
  editing.value = null
  form.value = defaultForm()
  showForm.value = true
}

function openEdit(test) {
  editing.value = test
  form.value = {
    name: test.name, description: test.description || '',
    entity_type: test.entity_type, entity_id: test.entity_id || '',
    split: test.split, goal: test.goal, goal_selector: test.goal_selector || '',
    variants: [],
  }
  showForm.value = true
}

async function openDetail(test) {
  const r = await api.get(`/ab-tests/${test.id}`)
  detailTest.value = r.data.test
  showDetail.value = true
}

async function saveForm() {
  if (!form.value.name) return
  saving.value = true
  try {
    const payload = { ...form.value }
    if (!editing.value) {
      // Parse variant changes JSON
      payload.variants = form.value.variants.map(v => {
        let changes = {}
        try { changes = JSON.parse(v.changesStr || '{}') } catch (_) {}
        return { label: v.label, name: v.name, changes }
      })
    }
    if (editing.value) {
      await api.put(`/ab-tests/${editing.value.id}`, payload)
    } else {
      await api.post('/ab-tests', payload)
    }
    showForm.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function setStatus(test, status) {
  await api.put(`/ab-tests/${test.id}`, { status })
  await load()
  if (showDetail.value && detailTest.value?.id === test.id) {
    const r = await api.get(`/ab-tests/${test.id}`)
    detailTest.value = r.data.test
  }
}

async function setWinner(test, winner) {
  await api.put(`/ab-tests/${test.id}`, { winner })
  const r = await api.get(`/ab-tests/${test.id}`)
  detailTest.value = r.data.test
  await load()
}

function confirmDelete(test) {
  deleteTarget.value = test
  showDeleteConfirm.value = true
}

async function doDelete() {
  await api.delete(`/ab-tests/${deleteTarget.value.id}`)
  showDeleteConfirm.value = false
  deleteTarget.value = null
  await load()
}

function fmt(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.ab-wrap { display: flex; flex-direction: column; gap: 1.25rem; }
.ab-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.75rem; }
.astat { text-align: center; padding: 0.75rem 1rem; border-radius: 1rem; }
.astat.accent { border-color: var(--accent); }
.astat-num { font-size: 1.6rem; font-weight: 700; }
.astat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.filter-bar { display: flex; gap: 0.75rem; align-items: center; padding: 0.75rem 1rem; border-radius: 1rem; }
.card-table { border-radius: 1rem; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.7rem 0.9rem; text-align: left; }
th { background: rgba(255,255,255,0.04); color: var(--muted); font-size: 0.75rem; text-transform: uppercase; }
tr:hover td { background: rgba(255,255,255,0.03); }
.actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.status-pill { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
.status-pill.running { background: rgba(34,197,94,0.2); color: #4ade80; }
.status-pill.draft { background: rgba(255,255,255,0.08); color: var(--muted); }
.status-pill.paused { background: rgba(234,179,8,0.2); color: #fbbf24; }
.status-pill.completed { background: rgba(99,102,241,0.2); color: #818cf8; }
.winner-badge { font-size: 0.8rem; font-weight: 700; }
.winner-badge.a { color: #60a5fa; }
.winner-badge.b { color: #f87171; }
.tag { background: rgba(255,255,255,0.07); border-radius: 999px; padding: 0.15rem 0.5rem; font-size: 0.75rem; }
.text-sm { font-size: 0.8rem; }
.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; color: var(--muted); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem; }
.modal-card { border-radius: 1.5rem; padding: 1.5rem; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; }
.modal-card.wide { max-width: 760px; }
.modal-card.small { max-width: 400px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; }
.modal-body { display: flex; flex-direction: column; gap: 1rem; }
.btn-close { background: none; border: none; color: var(--muted); font-size: 1.2rem; cursor: pointer; }
.field-row { display: flex; flex-direction: column; gap: 0.35rem; }
.field-row.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.slider { width: 100%; accent-color: var(--accent); }
.split-labels { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--muted); }
.variants-section { background: rgba(255,255,255,0.03); border-radius: 1rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.variants-section h3 { margin: 0 0 0.25rem; }
.variant-row { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.75rem; border-radius: 0.75rem; background: rgba(255,255,255,0.04); }
.variant-label-badge { display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 999px; font-weight: 700; font-size: 0.85rem; }
.variant-label-badge.a { background: rgba(96,165,250,0.2); color: #60a5fa; }
.variant-label-badge.b { background: rgba(248,113,113,0.2); color: #f87171; }
.mono { font-family: monospace; font-size: 0.8rem; }
.detail-meta { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.variant-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
.variant-card { border-radius: 1rem; padding: 1rem; border: 2px solid rgba(255,255,255,0.07); transition: border-color 0.2s; }
.variant-card.winner { border-color: var(--accent); }
.variant-card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.variant-card-header h3 { margin: 0; flex: 1; }
.winner-crown { color: var(--accent); font-weight: 700; }
.variant-stats { display: flex; gap: 0.5rem; }
.vstat { flex: 1; text-align: center; }
.vstat-num { font-size: 1.4rem; font-weight: 700; }
.vstat-label { font-size: 0.7rem; color: var(--muted); }
.vstat.accent .vstat-num { color: var(--accent); }
.conv-bar-wrap { height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; margin: 0.75rem 0; overflow: hidden; }
.conv-bar { height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.5s ease; }
.changes-preview { font-size: 0.8rem; }
.change-row { display: flex; gap: 0.5rem; padding: 0.2rem 0; }
.winner-section { background: rgba(255,255,255,0.03); border-radius: 1rem; padding: 1rem; }
.winner-section h3 { margin: 0 0 0.75rem; }
.winner-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.danger { background: rgba(220,38,38,0.2) !important; color: #f87171 !important; border-color: rgba(220,38,38,0.3) !important; }
</style>
