<template>
  <div class="bookings-view">
    <div class="page-header">
      <h1>📅 Bookings</h1>
      <div class="header-actions">
        <button class="btn btn-outline" @click="showServiceModal = true; editingService = null; serviceForm = defaultServiceForm()">➕ New Service</button>
        <button class="btn btn-outline" @click="activeTab = 'availability'">🕐 Availability</button>
        <button class="btn btn-primary" @click="activeTab = 'bookings'">📋 All Bookings</button>
      </div>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip">
      <div class="stat-card" v-for="s in stats" :key="s.label">
        <div class="stat-value">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="['tab', activeTab === 'bookings' && 'active']" @click="activeTab = 'bookings'">Bookings</button>
      <button :class="['tab', activeTab === 'services' && 'active']" @click="activeTab = 'services'">Services</button>
      <button :class="['tab', activeTab === 'blocked' && 'active']" @click="activeTab = 'blocked'">Blocked Dates</button>
    </div>

    <!-- ── Bookings Tab ── -->
    <div v-if="activeTab === 'bookings'" class="tab-content">
      <div class="filter-bar">
        <input v-model="search" placeholder="Search by name, email, ref…" class="input" />
        <select v-model="filterStatus" class="input select">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
        <select v-model="filterService" class="input select">
          <option value="">All Services</option>
          <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <input v-model="filterDateFrom" type="date" class="input" />
        <input v-model="filterDateTo" type="date" class="input" />
        <button class="btn btn-outline" @click="loadBookings">🔍 Filter</button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Service</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in bookings" :key="b.id">
              <td><code>{{ b.reference }}</code></td>
              <td>{{ b.service_name }}</td>
              <td>{{ b.booking_date }} {{ b.time_slot }}</td>
              <td>
                <div>{{ b.customer_name }}</div>
                <small class="muted">{{ b.customer_email }}</small>
              </td>
              <td><span :class="['status-pill', b.status]">{{ b.status }}</span></td>
              <td class="actions">
                <button class="btn btn-sm" @click="openBooking(b)">✏️</button>
                <button class="btn btn-sm btn-danger" @click="deleteBooking(b.id)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!bookings.length" class="empty">No bookings found.</div>
        <div class="pagination" v-if="total > limit">
          <button @click="page--; loadBookings()" :disabled="page <= 0">← Prev</button>
          <span>{{ page + 1 }} / {{ Math.ceil(total / limit) }}</span>
          <button @click="page++; loadBookings()" :disabled="(page + 1) * limit >= total">Next →</button>
        </div>
      </div>
    </div>

    <!-- ── Services Tab ── -->
    <div v-if="activeTab === 'services'" class="tab-content">
      <div class="services-grid">
        <div class="service-card" v-for="s in services" :key="s.id">
          <div class="service-cover" v-if="s.cover_image"><img :src="s.cover_image" /></div>
          <div class="service-body">
            <div class="service-name">{{ s.name }}</div>
            <div class="service-meta">
              <span>⏱ {{ s.duration_min }} min</span>
              <span>€{{ s.price }}</span>
              <span :class="s.active ? 'badge-green' : 'badge-gray'">{{ s.active ? 'Active' : 'Inactive' }}</span>
            </div>
            <div class="service-counts">{{ s.pending_count }} pending · {{ s.booking_count }} total</div>
          </div>
          <div class="service-actions">
            <button class="btn btn-sm" @click="editService(s)">✏️ Edit</button>
            <button class="btn btn-sm" @click="openAvailability(s)">🕐 Availability</button>
            <button class="btn btn-sm btn-danger" @click="deleteService(s.id)">🗑️</button>
          </div>
        </div>
        <div class="service-card add-card" @click="showServiceModal = true; editingService = null; serviceForm = defaultServiceForm()">
          <div style="font-size:2rem">➕</div>
          <div>Add Service</div>
        </div>
      </div>
    </div>

    <!-- ── Blocked Dates Tab ── -->
    <div v-if="activeTab === 'blocked'" class="tab-content">
      <div class="filter-bar">
        <select v-model="blockedServiceFilter" class="input select">
          <option value="">All Services</option>
          <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button class="btn btn-primary" @click="showBlockedModal = true; blockedForm = { service_id: '', blocked_date: '', reason: '' }">➕ Block Date</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Service</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            <tr v-for="bd in blockedDates" :key="bd.id">
              <td>{{ bd.blocked_date }}</td>
              <td>{{ bd.service_id ? services.find(s => s.id === bd.service_id)?.name || bd.service_id : 'All Services' }}</td>
              <td>{{ bd.reason || '—' }}</td>
              <td><button class="btn btn-sm btn-danger" @click="deleteBlockedDate(bd.id)">🗑️</button></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!blockedDates.length" class="empty">No blocked dates.</div>
      </div>
    </div>

    <!-- ── Edit Booking Modal ── -->
    <div class="modal-backdrop" v-if="editingBooking" @click.self="editingBooking = null">
      <div class="modal">
        <h2>Booking {{ editingBooking.reference }}</h2>
        <div class="detail-grid">
          <div><strong>Service:</strong> {{ editingBooking.service_name }}</div>
          <div><strong>Date:</strong> {{ editingBooking.booking_date }}</div>
          <div><strong>Time:</strong> {{ editingBooking.time_slot }}</div>
          <div><strong>Duration:</strong> {{ editingBooking.duration_min }} min</div>
          <div><strong>Customer:</strong> {{ editingBooking.customer_name }}</div>
          <div><strong>Email:</strong> {{ editingBooking.customer_email }}</div>
          <div v-if="editingBooking.customer_phone"><strong>Phone:</strong> {{ editingBooking.customer_phone }}</div>
        </div>
        <div class="form-group" v-if="editingBooking.notes">
          <label>Customer Notes</label>
          <div class="notes-box">{{ editingBooking.notes }}</div>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select v-model="bookingEditForm.status" class="input select">
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
        <div class="form-group">
          <label>Admin Notes</label>
          <textarea v-model="bookingEditForm.admin_notes" class="input textarea"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="editingBooking = null">Cancel</button>
          <button class="btn btn-primary" @click="saveBooking">💾 Save</button>
        </div>
      </div>
    </div>

    <!-- ── Service Modal ── -->
    <div class="modal-backdrop" v-if="showServiceModal" @click.self="showServiceModal = false">
      <div class="modal modal-wide">
        <h2>{{ editingService ? 'Edit Service' : 'New Service' }}</h2>
        <div class="form-row">
          <div class="form-group">
            <label>Name *</label>
            <input v-model="serviceForm.name" class="input" />
          </div>
          <div class="form-group">
            <label>Duration (minutes) *</label>
            <input v-model.number="serviceForm.duration_min" type="number" min="5" class="input" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Price (€)</label>
            <input v-model.number="serviceForm.price" type="number" min="0" step="0.01" class="input" />
          </div>
          <div class="form-group">
            <label>Buffer after (min)</label>
            <input v-model.number="serviceForm.buffer_min" type="number" min="0" class="input" />
          </div>
          <div class="form-group">
            <label>Max bookings per slot</label>
            <input v-model.number="serviceForm.max_per_slot" type="number" min="1" class="input" />
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="serviceForm.description" class="input textarea"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <input v-model="serviceForm.category" class="input" />
          </div>
          <div class="form-group">
            <label>Sort Order</label>
            <input v-model.number="serviceForm.sort_order" type="number" class="input" />
          </div>
          <div class="form-group toggle-group">
            <label>Active</label>
            <label class="toggle"><input type="checkbox" v-model="serviceForm.active" /><span></span></label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showServiceModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveService">💾 Save Service</button>
        </div>
      </div>
    </div>

    <!-- ── Availability Modal ── -->
    <div class="modal-backdrop" v-if="availabilityService" @click.self="availabilityService = null">
      <div class="modal modal-wide">
        <h2>🕐 Availability — {{ availabilityService.name }}</h2>
        <p class="hint">Set weekly recurring time windows. Slots are generated automatically based on service duration + buffer.</p>
        <div class="availability-grid">
          <div class="avail-row" v-for="(row, i) in availabilityForm" :key="i">
            <span class="day-label">{{ DAYS[row.day_of_week] }}</span>
            <label class="toggle"><input type="checkbox" v-model="row.available" /><span></span></label>
            <template v-if="row.available">
              <input type="time" v-model="row.start_time" class="input input-sm" />
              <span>–</span>
              <input type="time" v-model="row.end_time" class="input input-sm" />
            </template>
            <span v-else class="muted">Closed</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="availabilityService = null">Cancel</button>
          <button class="btn btn-primary" @click="saveAvailability">💾 Save Schedule</button>
        </div>
      </div>
    </div>

    <!-- ── Block Date Modal ── -->
    <div class="modal-backdrop" v-if="showBlockedModal" @click.self="showBlockedModal = false">
      <div class="modal">
        <h2>Block a Date</h2>
        <div class="form-group">
          <label>Service (leave blank for all)</label>
          <select v-model="blockedForm.service_id" class="input select">
            <option value="">All Services</option>
            <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Date *</label>
          <input type="date" v-model="blockedForm.blocked_date" class="input" />
        </div>
        <div class="form-group">
          <label>Reason (optional)</label>
          <input v-model="blockedForm.reason" class="input" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showBlockedModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveBlockedDate">💾 Block Date</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
const auth = useAuthStore()
const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
const h = () => ({ Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' })
const api = (url, opts = {}) => fetch(`${API}${url}`, { headers: h(), ...opts }).then(r => r.json())

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const activeTab = ref('bookings')
const bookings = ref([])
const services = ref([])
const blockedDates = ref([])
const total = ref(0)
const page = ref(0)
const limit = 50
const search = ref('')
const filterStatus = ref('')
const filterService = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const blockedServiceFilter = ref('')
const statsData = ref({})

const stats = computed(() => [
  { label: 'Total Bookings', value: statsData.value.total || 0 },
  { label: 'Pending', value: statsData.value.pending || 0 },
  { label: 'Confirmed', value: statsData.value.confirmed || 0 },
  { label: 'Today', value: statsData.value.today || 0 },
  { label: 'This Week', value: statsData.value.this_week || 0 },
  { label: 'Revenue', value: '€' + (statsData.value.revenue || 0).toFixed(2) },
  { label: 'Services', value: statsData.value.services || 0 },
])

const editingBooking = ref(null)
const bookingEditForm = ref({})
const showServiceModal = ref(false)
const editingService = ref(null)
const serviceForm = ref({})
const availabilityService = ref(null)
const availabilityForm = ref([])
const showBlockedModal = ref(false)
const blockedForm = ref({})

function defaultServiceForm() {
  return { name: '', description: '', duration_min: 60, price: 0, buffer_min: 0, max_per_slot: 1, category: '', sort_order: 0, active: true }
}

async function loadAll() {
  [statsData.value, services.value] = await Promise.all([
    api('/api/bookings/stats'),
    api('/api/bookings/services'),
  ])
  await loadBookings()
  await loadBlockedDates()
}

async function loadBookings() {
  const params = new URLSearchParams({ limit, offset: page.value * limit })
  if (search.value) params.set('q', search.value)
  if (filterStatus.value) params.set('status', filterStatus.value)
  if (filterService.value) params.set('service_id', filterService.value)
  if (filterDateFrom.value) params.set('date_from', filterDateFrom.value)
  if (filterDateTo.value) params.set('date_to', filterDateTo.value)
  const res = await api(`/api/bookings?${params}`)
  bookings.value = res.bookings || []
  total.value = res.total || 0
}

async function loadBlockedDates() {
  const params = new URLSearchParams()
  if (blockedServiceFilter.value) params.set('service_id', blockedServiceFilter.value)
  blockedDates.value = await api(`/api/bookings/blocked-dates?${params}`)
}

function openBooking(b) {
  editingBooking.value = b
  bookingEditForm.value = { status: b.status, admin_notes: b.admin_notes || '' }
}

async function saveBooking() {
  await api(`/api/bookings/${editingBooking.value.id}`, { method: 'PUT', body: JSON.stringify(bookingEditForm.value) })
  editingBooking.value = null
  loadBookings()
  statsData.value = await api('/api/bookings/stats')
}

async function deleteBooking(id) {
  if (!confirm('Delete this booking?')) return
  await api(`/api/bookings/${id}`, { method: 'DELETE' })
  loadBookings()
}

function editService(s) {
  editingService.value = s
  serviceForm.value = { ...s, active: !!s.active }
  showServiceModal.value = true
}

async function saveService() {
  const url = editingService.value ? `/api/bookings/services/${editingService.value.id}` : '/api/bookings/services'
  const method = editingService.value ? 'PUT' : 'POST'
  await api(url, { method, body: JSON.stringify(serviceForm.value) })
  showServiceModal.value = false
  services.value = await api('/api/bookings/services')
  statsData.value = await api('/api/bookings/stats')
}

async function deleteService(id) {
  if (!confirm('Delete this service and all its bookings?')) return
  await api(`/api/bookings/services/${id}`, { method: 'DELETE' })
  services.value = await api('/api/bookings/services')
}

async function openAvailability(s) {
  availabilityService.value = s
  const existing = await api(`/api/bookings/services/${s.id}/availability`)
  const map = {}
  for (const r of existing) map[r.day_of_week] = r
  availabilityForm.value = [0,1,2,3,4,5,6].map(d => ({
    day_of_week: d,
    start_time: map[d]?.start_time || '09:00',
    end_time: map[d]?.end_time || '17:00',
    available: map[d]?.available !== undefined ? !!map[d].available : (d > 0 && d < 6),
  }))
  showServiceModal.value = false
}

async function saveAvailability() {
  await api(`/api/bookings/services/${availabilityService.value.id}/availability`, {
    method: 'PUT',
    body: JSON.stringify({ schedule: availabilityForm.value }),
  })
  availabilityService.value = null
}

async function saveBlockedDate() {
  if (!blockedForm.value.blocked_date) return alert('Date is required')
  await api('/api/bookings/blocked-dates', { method: 'POST', body: JSON.stringify(blockedForm.value) })
  showBlockedModal.value = false
  loadBlockedDates()
}

async function deleteBlockedDate(id) {
  await api(`/api/bookings/blocked-dates/${id}`, { method: 'DELETE' })
  loadBlockedDates()
}

onMounted(loadAll)
</script>

<style scoped>
.bookings-view { padding: 1.5rem; }
.page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; }
.page-header h1 { margin:0; font-size:1.5rem; }
.header-actions { display:flex; gap:.5rem; }
.stats-strip { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; }
.stat-card { background:rgba(255,255,255,.06); border-radius:.75rem; padding:1rem 1.5rem; min-width:120px; text-align:center; }
.stat-value { font-size:1.75rem; font-weight:700; }
.stat-label { font-size:.75rem; color:#aaa; margin-top:.25rem; }
.tabs { display:flex; gap:1px; margin-bottom:1.5rem; }
.tab { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#ccc; padding:.5rem 1.25rem; cursor:pointer; border-radius:.5rem; }
.tab.active { background:var(--accent); color:#fff; border-color:transparent; }
.filter-bar { display:flex; gap:.75rem; flex-wrap:wrap; margin-bottom:1rem; }
.table-wrap { overflow-x:auto; }
.table { width:100%; border-collapse:collapse; }
.table th, .table td { padding:.75rem 1rem; text-align:left; border-bottom:1px solid rgba(255,255,255,.08); }
.table th { font-size:.8rem; color:#888; text-transform:uppercase; letter-spacing:.05em; }
.empty { text-align:center; color:#666; padding:3rem; }
.pagination { display:flex; align-items:center; gap:1rem; justify-content:center; padding:1rem; }
.status-pill { padding:.2em .75em; border-radius:999px; font-size:.75rem; font-weight:600; }
.status-pill.pending { background:rgba(245,158,11,.2); color:#f59e0b; }
.status-pill.confirmed { background:rgba(99,102,241,.2); color:#818cf8; }
.status-pill.completed { background:rgba(34,197,94,.2); color:#4ade80; }
.status-pill.cancelled { background:rgba(239,68,68,.2); color:#f87171; }
.status-pill.no_show { background:rgba(107,114,128,.2); color:#9ca3af; }
.actions { display:flex; gap:.5rem; }
.services-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1rem; }
.service-card { background:rgba(255,255,255,.06); border-radius:1rem; overflow:hidden; border:1px solid rgba(255,255,255,.08); }
.service-cover img { width:100%; height:140px; object-fit:cover; }
.service-body { padding:1rem; }
.service-name { font-size:1.1rem; font-weight:700; margin-bottom:.5rem; }
.service-meta { display:flex; gap:.75rem; font-size:.8rem; color:#aaa; flex-wrap:wrap; }
.service-counts { font-size:.8rem; color:#888; margin-top:.4rem; }
.service-actions { padding:.75rem 1rem; border-top:1px solid rgba(255,255,255,.08); display:flex; gap:.5rem; }
.add-card { display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; min-height:180px; color:#888; gap:.5rem; }
.add-card:hover { background:rgba(255,255,255,.1); }
.badge-green { color:#4ade80; }
.badge-gray { color:#9ca3af; }
.availability-grid { display:flex; flex-direction:column; gap:.75rem; margin:1rem 0; }
.avail-row { display:flex; align-items:center; gap:1rem; }
.day-label { width:90px; font-weight:600; }
.input-sm { width:100px; }
.detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:.5rem 1.5rem; margin-bottom:1rem; font-size:.9rem; }
.notes-box { background:rgba(255,255,255,.05); padding:.75rem; border-radius:.5rem; margin-top:.25rem; }
.hint { color:#888; font-size:.85rem; }
/* Modal styles (reuse from existing) */
.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.7); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal { background:hsl(228,4%,15%); border:1px solid rgba(255,255,255,.1); border-radius:1.25rem; padding:2rem; width:min(560px,90vw); max-height:85vh; overflow-y:auto; }
.modal-wide { width:min(720px,95vw); }
.modal h2 { margin-top:0; }
.modal-actions { display:flex; gap:.75rem; justify-content:flex-end; margin-top:1.5rem; }
.form-group { margin-bottom:1rem; }
.form-group label { display:block; font-size:.85rem; color:#aaa; margin-bottom:.3rem; }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.toggle-group { display:flex; flex-direction:column; }
.input { width:100%; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); color:#fff; padding:.6rem .9rem; border-radius:.5rem; font-size:.95rem; box-sizing:border-box; }
.textarea { min-height:80px; resize:vertical; }
.select { appearance:none; }
.muted { color:#666; font-size:.8rem; }
.btn { padding:.5rem 1rem; border-radius:.5rem; border:none; cursor:pointer; font-size:.9rem; font-weight:600; transition:.15s; }
.btn-primary { background:var(--accent,#c94040); color:#fff; }
.btn-outline { background:rgba(255,255,255,.08); color:#fff; border:1px solid rgba(255,255,255,.15); }
.btn-danger { background:rgba(239,68,68,.2); color:#f87171; }
.btn-sm { padding:.3rem .7rem; font-size:.8rem; }
.toggle { position:relative; display:inline-block; width:44px; height:24px; }
.toggle input { opacity:0; width:0; height:0; }
.toggle span { position:absolute; cursor:pointer; inset:0; background:#444; border-radius:999px; transition:.3s; }
.toggle input:checked + span { background:var(--accent,#c94040); }
.toggle span:before { position:absolute; content:""; height:16px; width:16px; left:4px; bottom:4px; background:#fff; border-radius:50%; transition:.3s; }
.toggle input:checked + span:before { transform:translateX(20px); }
code { font-size:.8rem; background:rgba(255,255,255,.08); padding:.1rem .4rem; border-radius:.3rem; }
</style>
