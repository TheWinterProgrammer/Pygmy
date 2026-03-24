<template>
  <div class="team-view">
    <div class="view-header">
      <div>
        <h1>👥 Team Members</h1>
        <p class="subtitle">Manage staff profiles shown on the public /team page</p>
      </div>
      <button class="btn-primary" @click="openNew">+ Add Member</button>
    </div>

    <!-- Stats -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat-card">
        <span class="stat-num green">{{ stats.active }}</span>
        <span class="stat-label">Active</span>
      </div>
      <div class="stat-card">
        <span class="stat-num accent">{{ stats.featured }}</span>
        <span class="stat-label">Featured</span>
      </div>
    </div>

    <!-- Department filter -->
    <div class="filter-row" v-if="departments.length > 0">
      <button :class="['dept-btn', {active: filterDept===''}]" @click="filterDept=''; loadMembers()">All</button>
      <button :class="['dept-btn', {active: filterDept===d}]" v-for="d in departments" :key="d" @click="filterDept=d; loadMembers()">{{ d }}</button>
    </div>

    <!-- Team grid -->
    <div class="team-grid">
      <div class="member-card" v-for="m in members" :key="m.id" :class="{inactive: m.status !== 'active'}">
        <div class="member-photo">
          <img v-if="m.photo" :src="m.photo" :alt="m.name" />
          <div v-else class="photo-placeholder">{{ initials(m.name) }}</div>
          <span class="featured-star" v-if="m.featured">⭐</span>
        </div>
        <div class="member-info">
          <div class="member-name">{{ m.name }}</div>
          <div class="member-role">{{ m.role }}</div>
          <div class="member-dept" v-if="m.department">{{ m.department }}</div>
          <div class="member-bio" v-if="m.bio">{{ truncate(m.bio, 90) }}</div>
          <div class="member-links">
            <a v-if="m.linkedin" :href="m.linkedin" target="_blank" rel="noopener" class="social-link">💼</a>
            <a v-if="m.twitter" :href="m.twitter" target="_blank" rel="noopener" class="social-link">🐦</a>
            <a v-if="m.github" :href="m.github" target="_blank" rel="noopener" class="social-link">🐱</a>
            <a v-if="m.website" :href="m.website" target="_blank" rel="noopener" class="social-link">🌐</a>
          </div>
        </div>
        <div class="member-actions">
          <span class="status-badge" :class="m.status">{{ m.status }}</span>
          <button class="btn-xs" @click="editMember(m)">✏️ Edit</button>
          <button class="btn-xs danger" @click="deleteMember(m.id)">🗑️</button>
        </div>
      </div>
    </div>

    <div class="empty-state" v-if="members.length === 0">
      No team members yet. Add your first one!
    </div>

    <!-- Add/Edit Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal=false">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ editing?.id ? 'Edit Member' : 'Add Team Member' }}</h2>
          <button class="modal-close" @click="showModal=false">✕</button>
        </div>
        <div class="modal-body">
          <div class="avatar-preview" v-if="form.photo">
            <img :src="form.photo" alt="Preview" />
          </div>
          <div class="form-grid-2">
            <div class="form-group full">
              <label>Full Name *</label>
              <input v-model="form.name" placeholder="Jane Smith" />
            </div>
            <div class="form-group">
              <label>Role / Title *</label>
              <input v-model="form.role" placeholder="Lead Developer" />
            </div>
            <div class="form-group">
              <label>Department</label>
              <input v-model="form.department" list="dept-list" placeholder="Engineering" />
              <datalist id="dept-list">
                <option v-for="d in departments" :key="d" :value="d" />
              </datalist>
            </div>
          </div>
          <div class="form-group">
            <label>Bio</label>
            <textarea v-model="form.bio" rows="3" placeholder="Short bio…"></textarea>
          </div>
          <div class="form-group">
            <label>Photo URL</label>
            <input v-model="form.photo" placeholder="https://cdn.example.com/avatar.jpg" />
          </div>
          <div class="form-group">
            <label>Email (optional — shown if filled)</label>
            <input type="email" v-model="form.email" placeholder="jane@example.com" />
          </div>
          <h3>Social Links</h3>
          <div class="form-grid-2">
            <div class="form-group">
              <label>💼 LinkedIn</label>
              <input v-model="form.linkedin" placeholder="https://linkedin.com/in/…" />
            </div>
            <div class="form-group">
              <label>🐦 Twitter / X</label>
              <input v-model="form.twitter" placeholder="https://twitter.com/…" />
            </div>
            <div class="form-group">
              <label>🐱 GitHub</label>
              <input v-model="form.github" placeholder="https://github.com/…" />
            </div>
            <div class="form-group">
              <label>🌐 Website</label>
              <input v-model="form.website" placeholder="https://…" />
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label>Status</label>
              <select v-model="form.status">
                <option value="active">Active</option>
                <option value="inactive">Inactive (hidden)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input type="number" v-model.number="form.sort_order" />
            </div>
          </div>
          <div class="form-group toggle-row">
            <label>Featured</label>
            <label class="toggle">
              <input type="checkbox" v-model="form.featured" />
              <span class="slider"></span>
            </label>
            <small>Featured members appear first / highlighted</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showModal=false">Cancel</button>
          <button class="btn-primary" @click="saveMember" :disabled="saving">{{ saving ? 'Saving…' : 'Save Member' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const members = ref([])
const departments = ref([])
const stats = ref(null)
const filterDept = ref('')
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)

const form = ref({
  name: '', role: '', department: '', bio: '', photo: '', email: '',
  linkedin: '', twitter: '', github: '', website: '',
  status: 'active', featured: false, sort_order: 0
})

async function loadStats() {
  const { data } = await api.get('/team/stats')
  stats.value = data
}

async function loadDepartments() {
  const { data } = await api.get('/team/departments')
  departments.value = data
}

async function loadMembers() {
  const params = { all: '1' }
  if (filterDept.value) params.department = filterDept.value
  const { data } = await api.get('/team', { params })
  members.value = data
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : s }

function openNew() {
  editing.value = null
  form.value = { name: '', role: '', department: '', bio: '', photo: '', email: '', linkedin: '', twitter: '', github: '', website: '', status: 'active', featured: false, sort_order: 0 }
  showModal.value = true
}

function editMember(m) {
  editing.value = m
  form.value = { ...m, featured: !!m.featured }
  showModal.value = true
}

async function saveMember() {
  if (!form.value.name) return alert('Name is required')
  saving.value = true
  try {
    if (editing.value?.id) {
      await api.put(`/team/${editing.value.id}`, form.value)
    } else {
      await api.post('/team', form.value)
    }
    showModal.value = false
    await Promise.all([loadMembers(), loadStats(), loadDepartments()])
  } finally {
    saving.value = false
  }
}

async function deleteMember(id) {
  if (!confirm('Delete this team member?')) return
  await api.delete(`/team/${id}`)
  await Promise.all([loadMembers(), loadStats()])
}

onMounted(() => Promise.all([loadStats(), loadDepartments(), loadMembers()]))
</script>

<style scoped>
.view-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:.75rem; }
.view-header h1 { margin:0; }
.subtitle { color:var(--text-muted); font-size:.9rem; margin:.25rem 0 0; }
.stats-strip { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.25rem; }
.stat-card { background:var(--surface); border:1px solid rgba(255,255,255,.08); border-radius:.75rem; padding:.75rem 1.25rem; min-width:100px; text-align:center; }
.stat-num { display:block; font-size:1.6rem; font-weight:700; }
.stat-num.accent { color:var(--accent); }
.stat-num.green { color:#4ade80; }
.stat-label { font-size:.75rem; color:var(--text-muted); }
.filter-row { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1.25rem; }
.dept-btn { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text-muted); padding:.35rem .9rem; border-radius:999px; cursor:pointer; font-size:.8rem; }
.dept-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }
.team-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1rem; }
.member-card { background:var(--surface); border:1px solid rgba(255,255,255,.08); border-radius:1rem; overflow:hidden; display:flex; flex-direction:column; }
.member-card.inactive { opacity:.55; }
.member-photo { position:relative; }
.member-photo img { width:100%; height:160px; object-fit:cover; display:block; }
.photo-placeholder { width:100%; height:160px; background:rgba(255,255,255,.07); display:flex; align-items:center; justify-content:center; font-size:2.5rem; font-weight:700; color:var(--text-muted); }
.featured-star { position:absolute; top:.5rem; right:.5rem; font-size:1rem; }
.member-info { padding:1rem; flex:1; }
.member-name { font-size:1rem; font-weight:700; margin-bottom:.15rem; }
.member-role { font-size:.85rem; color:var(--accent); margin-bottom:.2rem; }
.member-dept { font-size:.75rem; color:var(--text-muted); margin-bottom:.35rem; }
.member-bio { font-size:.8rem; color:var(--text-muted); line-height:1.4; margin-bottom:.5rem; }
.member-links { display:flex; gap:.4rem; }
.social-link { font-size:1rem; text-decoration:none; opacity:.7; }
.social-link:hover { opacity:1; }
.member-actions { padding:.75rem 1rem; border-top:1px solid rgba(255,255,255,.06); display:flex; align-items:center; gap:.5rem; }
.status-badge { font-size:.7rem; padding:.2rem .6rem; border-radius:999px; font-weight:600; margin-right:auto; }
.status-badge.active { background:rgba(74,222,128,.15); color:#4ade80; }
.status-badge.inactive { background:rgba(255,255,255,.07); color:var(--text-muted); }
.btn-xs { font-size:.75rem; padding:.3rem .7rem; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.05); color:var(--text); border-radius:.4rem; cursor:pointer; }
.btn-xs.danger { color:#ef4444; border-color:rgba(239,68,68,.3); }
.empty-state { text-align:center; color:var(--text-muted); padding:2rem; font-size:.9rem; }
/* Modal */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:1rem; }
.modal-card { background:var(--surface); border:1px solid rgba(255,255,255,.12); border-radius:1.25rem; width:100%; max-width:560px; max-height:90vh; overflow-y:auto; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid rgba(255,255,255,.07); }
.modal-header h2 { margin:0; font-size:1.1rem; }
.modal-close { background:none; border:none; color:var(--text-muted); font-size:1.1rem; cursor:pointer; }
.modal-body { padding:1.25rem 1.5rem; display:flex; flex-direction:column; gap:1rem; }
.modal-footer { padding:1rem 1.5rem; border-top:1px solid rgba(255,255,255,.07); display:flex; justify-content:flex-end; gap:.75rem; }
.avatar-preview img { width:80px; height:80px; border-radius:50%; object-fit:cover; border:2px solid rgba(255,255,255,.1); }
.form-group { display:flex; flex-direction:column; gap:.35rem; }
.form-group label { font-size:.8rem; color:var(--text-muted); font-weight:500; }
.form-group input, .form-group select, .form-group textarea {
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); color:var(--text);
  border-radius:.5rem; padding:.5rem .75rem; font-size:.9rem;
}
.form-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
.form-grid-2 .full { grid-column:1/-1; }
@media(max-width:480px){ .form-grid-2 { grid-template-columns:1fr; } }
h3 { font-size:.85rem; color:var(--text-muted); margin:.25rem 0 -.25rem; }
.toggle-row { flex-direction:row; align-items:center; gap:.75rem; }
.toggle-row small { font-size:.75rem; color:var(--text-muted); }
.toggle { position:relative; display:inline-block; width:40px; height:22px; }
.toggle input { opacity:0; width:0; height:0; }
.slider { position:absolute; cursor:pointer; inset:0; background:#374151; border-radius:22px; transition:.3s; }
.slider::before { content:''; position:absolute; height:16px; width:16px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.3s; }
input:checked + .slider { background:var(--accent); }
input:checked + .slider::before { transform:translateX(18px); }
.btn-primary { background:var(--accent); color:#fff; border:none; padding:.55rem 1.25rem; border-radius:.6rem; cursor:pointer; font-size:.9rem; font-weight:600; }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-secondary { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); color:var(--text); padding:.5rem 1rem; border-radius:.6rem; cursor:pointer; font-size:.85rem; }
</style>
