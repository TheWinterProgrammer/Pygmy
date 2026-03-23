<template>
  <div class="booking-page">
    <!-- Hero -->
    <section class="booking-hero">
      <div class="hero-content">
        <h1>{{ settings.bookings_page_title || 'Book an Appointment' }}</h1>
        <p v-if="settings.bookings_intro">{{ settings.bookings_intro }}</p>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="loading" class="loading-wrap">
      <div class="spinner"></div>
    </div>

    <!-- Services Grid -->
    <section v-else-if="!selectedService" class="services-section">
      <div class="container">
        <h2>Choose a Service</h2>
        <div v-if="!services.length" class="empty-state">
          <p>No services available at this time. Please check back later.</p>
        </div>
        <div class="services-grid">
          <div
            class="service-card glass"
            v-for="s in services"
            :key="s.id"
            @click="selectService(s)"
          >
            <div class="service-image" v-if="s.cover_image">
              <img :src="s.cover_image" :alt="s.name" />
            </div>
            <div class="service-image placeholder" v-else>📅</div>
            <div class="service-body">
              <div v-if="s.category" class="service-category">{{ s.category }}</div>
              <h3>{{ s.name }}</h3>
              <p v-if="s.description">{{ s.description }}</p>
              <div class="service-meta">
                <span class="duration">🕐 {{ s.duration_min }} min</span>
                <span class="price" v-if="s.price > 0">€{{ Number(s.price).toFixed(2) }}</span>
                <span class="price free" v-else>Free</span>
              </div>
              <button class="btn btn-primary">Book Now →</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Booking Flow -->
    <section v-else class="booking-flow">
      <div class="container">
        <button class="back-btn" @click="goBack">← Back to Services</button>

        <div class="flow-header">
          <h2>{{ selectedService.name }}</h2>
          <div class="service-meta-inline">
            <span class="duration">🕐 {{ selectedService.duration_min }} min</span>
            <span class="price" v-if="selectedService.price > 0">€{{ Number(selectedService.price).toFixed(2) }}</span>
            <span class="price free" v-else>Free</span>
          </div>
        </div>

        <!-- Step Indicator -->
        <div class="steps">
          <div :class="['step', step >= 1 && 'done', step === 1 && 'active']">
            <div class="step-num">1</div>
            <div class="step-label">Pick a Date</div>
          </div>
          <div class="step-line"></div>
          <div :class="['step', step >= 2 && 'done', step === 2 && 'active']">
            <div class="step-num">2</div>
            <div class="step-label">Choose Time</div>
          </div>
          <div class="step-line"></div>
          <div :class="['step', step >= 3 && 'done', step === 3 && 'active']">
            <div class="step-num">3</div>
            <div class="step-label">Your Details</div>
          </div>
        </div>

        <!-- Step 1: Calendar -->
        <div v-if="step === 1" class="step-content glass">
          <h3>Select a Date</h3>
          <div class="calendar-nav">
            <button class="btn btn-outline" @click="prevMonth">‹</button>
            <span class="cal-title">{{ monthName }} {{ calYear }}</span>
            <button class="btn btn-outline" @click="nextMonth">›</button>
          </div>
          <div class="calendar-grid">
            <div class="cal-day-name" v-for="d in dayNames" :key="d">{{ d }}</div>
            <div
              v-for="cell in calendarCells"
              :key="cell.key"
              :class="['cal-cell', cell.empty && 'empty', cell.past && 'past', cell.available && 'available', cell.selected && 'selected']"
              @click="cell.available && selectDate(cell.date)"
            >
              {{ cell.day }}
            </div>
          </div>
          <div class="cal-legend">
            <span class="legend-item available">Available</span>
            <span class="legend-item past">Unavailable</span>
            <span class="legend-item selected">Selected</span>
          </div>
          <div v-if="loadingSlots" class="loading-inline">Loading availability…</div>
        </div>

        <!-- Step 2: Time Slots -->
        <div v-if="step === 2" class="step-content glass">
          <h3>Choose a Time — {{ selectedDate }}</h3>
          <div v-if="loadingSlots" class="loading-inline">Loading slots…</div>
          <div v-else-if="!slots.length" class="empty-slots">
            <p>No times available for {{ selectedDate }}. Please choose another date.</p>
            <button class="btn btn-outline" @click="step = 1">← Back to Calendar</button>
          </div>
          <div v-else class="slots-grid">
            <button
              v-for="slot in slots"
              :key="slot"
              :class="['slot-btn', selectedTime === slot && 'selected']"
              @click="selectTime(slot)"
            >
              {{ slot }}
            </button>
          </div>
          <div v-if="selectedTime" class="step-actions">
            <button class="btn btn-primary" @click="step = 3">Continue →</button>
          </div>
          <div class="step-actions" style="margin-top:0.5rem">
            <button class="btn btn-outline" @click="step = 1">← Change Date</button>
          </div>
        </div>

        <!-- Step 3: Details Form -->
        <div v-if="step === 3" class="step-content glass">
          <h3>Your Details</h3>
          <div class="summary-bar">
            <span>📅 {{ selectedDate }}</span>
            <span>🕐 {{ selectedTime }}</span>
            <span>{{ selectedService.name }}</span>
          </div>

          <form @submit.prevent="submitBooking" class="booking-form">
            <div class="form-group">
              <label>Full Name *</label>
              <input v-model="form.name" class="input" required placeholder="Your name" />
            </div>
            <div class="form-group">
              <label>Email *</label>
              <input v-model="form.email" class="input" type="email" required placeholder="you@example.com" />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input v-model="form.phone" class="input" type="tel" placeholder="+49 123 456789" />
            </div>
            <div class="form-group">
              <label>Notes (optional)</label>
              <textarea v-model="form.notes" class="input" rows="3" placeholder="Anything we should know?"></textarea>
            </div>

            <div v-if="formError" class="alert-error">{{ formError }}</div>

            <div class="form-actions">
              <button class="btn btn-outline" type="button" @click="step = 2">← Back</button>
              <button class="btn btn-primary" type="submit" :disabled="submitting">
                {{ submitting ? 'Booking…' : 'Confirm Booking' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Success -->
        <div v-if="step === 4" class="step-content glass success-card">
          <div class="success-icon">✅</div>
          <h2>Booking Confirmed!</h2>
          <p>You're booked in for <strong>{{ selectedDate }}</strong> at <strong>{{ selectedTime }}</strong>.</p>
          <p class="muted">Your reference number: <strong>{{ bookingRef }}</strong></p>
          <p class="muted">A confirmation email has been sent to <strong>{{ form.email }}</strong>.</p>
          <div class="success-actions">
            <button class="btn btn-primary" @click="reset">Book Another</button>
            <router-link to="/" class="btn btn-outline">← Home</router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSiteStore } from '../stores/site.js'

const siteStore = useSiteStore()
const settings = computed(() => siteStore.settings)

const services = ref([])
const loading = ref(true)
const selectedService = ref(null)
const step = ref(1)

// Calendar state
const calYear = ref(new Date().getFullYear())
const calMonth = ref(new Date().getMonth() + 1) // 1-indexed
const availableDates = ref([])
const selectedDate = ref('')
const loadingSlots = ref(false)

// Slot state
const slots = ref([])
const selectedTime = ref('')

// Form state
const form = ref({ name: '', email: '', phone: '', notes: '' })
const submitting = ref(false)
const formError = ref('')
const bookingRef = ref('')

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthName = computed(() => {
  return new Date(calYear.value, calMonth.value - 1, 1).toLocaleString('default', { month: 'long' })
})

const calendarCells = computed(() => {
  const firstDow = new Date(calYear.value, calMonth.value - 1, 1).getDay()
  const daysInMonth = new Date(calYear.value, calMonth.value, 0).getDate()
  const today = new Date(); today.setHours(0,0,0,0)
  const cells = []

  for (let i = 0; i < firstDow; i++) {
    cells.push({ key: `e${i}`, empty: true })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear.value}-${String(calMonth.value).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const dt = new Date(calYear.value, calMonth.value - 1, d)
    const isPast = dt < today
    const isAvailable = !isPast && availableDates.value.includes(dateStr)
    cells.push({
      key: dateStr,
      day: d,
      date: dateStr,
      past: isPast,
      available: isAvailable,
      selected: dateStr === selectedDate.value,
    })
  }

  return cells
})

async function loadServices() {
  loading.value = true
  try {
    const res = await fetch('/api/bookings/services/public')
    services.value = await res.json()
  } finally {
    loading.value = false
  }
}

async function selectService(service) {
  selectedService.value = service
  step.value = 1
  selectedDate.value = ''
  slots.value = []
  selectedTime.value = ''
  form.value = { name: '', email: '', phone: '', notes: '' }
  formError.value = ''
  bookingRef.value = ''
  await loadAvailableDates()
}

async function loadAvailableDates() {
  if (!selectedService.value) return
  loadingSlots.value = true
  try {
    const res = await fetch(`/api/bookings/available-dates?service_id=${selectedService.value.id}&year=${calYear.value}&month=${calMonth.value}`)
    const data = await res.json()
    availableDates.value = data.available_dates || []
  } finally {
    loadingSlots.value = false
  }
}

async function selectDate(date) {
  selectedDate.value = date
  step.value = 2
  selectedTime.value = ''
  loadingSlots.value = true
  try {
    const res = await fetch(`/api/bookings/availability?service_id=${selectedService.value.id}&date=${date}`)
    const data = await res.json()
    slots.value = data.slots || []
  } finally {
    loadingSlots.value = false
  }
}

function selectTime(time) {
  selectedTime.value = time
}

async function prevMonth() {
  if (calMonth.value === 1) { calYear.value--; calMonth.value = 12 }
  else calMonth.value--
  await loadAvailableDates()
}

async function nextMonth() {
  if (calMonth.value === 12) { calYear.value++; calMonth.value = 1 }
  else calMonth.value++
  await loadAvailableDates()
}

async function submitBooking() {
  if (!form.value.name || !form.value.email) {
    formError.value = 'Name and email are required.'; return
  }
  submitting.value = true; formError.value = ''
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: selectedService.value.id,
        booking_date: selectedDate.value,
        time_slot: selectedTime.value,
        customer_name: form.value.name,
        customer_email: form.value.email,
        customer_phone: form.value.phone,
        notes: form.value.notes,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Booking failed')
    bookingRef.value = data.reference
    step.value = 4
  } catch (e) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

function goBack() {
  selectedService.value = null
  step.value = 1
}

function reset() {
  selectedService.value = null
  step.value = 1
  selectedDate.value = ''
  slots.value = []
  selectedTime.value = ''
  form.value = { name: '', email: '', phone: '', notes: '' }
  bookingRef.value = ''
}

onMounted(loadServices)
</script>

<style scoped>
.booking-page { min-height: 100vh; background: var(--bg); }

/* Hero */
.booking-hero {
  background: linear-gradient(135deg, hsl(228,4%,12%), hsl(355,40%,12%));
  padding: 5rem 2rem 3rem;
  text-align: center;
}
.hero-content h1 { font-size: clamp(1.8rem, 5vw, 3rem); font-weight: 800; color: var(--text); margin: 0 0 0.75rem; }
.hero-content p { font-size: 1.1rem; color: var(--text-muted); max-width: 600px; margin: 0 auto; }

/* Services */
.services-section { padding: 3rem 1rem; }
.container { max-width: 1100px; margin: 0 auto; }
.services-section h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; }
.services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }

.service-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 1.25rem;
  backdrop-filter: blur(16px);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.service-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.3); }

.service-image { height: 180px; overflow: hidden; }
.service-image img { width: 100%; height: 100%; object-fit: cover; }
.service-image.placeholder { display: flex; align-items: center; justify-content: center; font-size: 3rem; background: hsl(228,4%,18%); }

.service-body { padding: 1.25rem; }
.service-category { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); font-weight: 600; margin-bottom: 0.4rem; }
.service-body h3 { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.5rem; }
.service-body p { font-size: 0.88rem; color: var(--text-muted); margin: 0 0 1rem; line-height: 1.5; }

.service-meta, .service-meta-inline { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
.service-meta-inline { margin-bottom: 0; }
.duration { font-size: 0.88rem; color: var(--text-muted); }
.price { font-size: 1rem; font-weight: 700; color: var(--accent); }
.price.free { color: hsl(140,60%,55%); }

/* Booking flow */
.booking-flow { padding: 2rem 1rem; }
.back-btn { background: none; border: none; color: var(--text-muted); font-size: 0.9rem; cursor: pointer; padding: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.4rem; }
.back-btn:hover { color: var(--text); }

.flow-header { margin-bottom: 2rem; }
.flow-header h2 { font-size: 1.6rem; font-weight: 800; margin: 0 0 0.5rem; }

/* Steps indicator */
.steps { display: flex; align-items: center; margin-bottom: 2rem; }
.step { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; }
.step-num { width: 2rem; height: 2rem; border-radius: 50%; background: var(--surface); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: var(--text-muted); transition: all 0.2s; }
.step.active .step-num { border-color: var(--accent); color: var(--accent); }
.step.done .step-num { background: var(--accent); border-color: var(--accent); color: #fff; }
.step-label { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }
.step.active .step-label { color: var(--text); }
.step-line { flex: 1; height: 2px; background: var(--border); margin: 0 0.5rem; margin-bottom: 1.2rem; }

/* Glass card step content */
.step-content {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(16px);
  border-radius: 1.5rem;
  padding: 2rem;
  margin-bottom: 1.5rem;
}
.step-content h3 { font-size: 1.1rem; font-weight: 700; margin: 0 0 1.25rem; }

/* Calendar */
.calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.cal-title { font-weight: 700; font-size: 1rem; }

.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 1rem; }
.cal-day-name { text-align: center; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); padding: 0.4rem 0; text-transform: uppercase; }
.cal-cell {
  aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  font-size: 0.88rem;
  cursor: default;
  color: var(--text-muted);
  transition: all 0.15s;
}
.cal-cell.empty { visibility: hidden; }
.cal-cell.past { opacity: 0.3; }
.cal-cell.available { background: hsl(228,4%,22%); color: var(--text); cursor: pointer; }
.cal-cell.available:hover { background: hsl(355,70%,25%); color: var(--accent); }
.cal-cell.selected { background: var(--accent) !important; color: #fff !important; font-weight: 700; }

.cal-legend { display: flex; gap: 1.5rem; font-size: 0.75rem; }
.legend-item { display: flex; align-items: center; gap: 0.4rem; color: var(--text-muted); }
.legend-item::before { content: ''; width: 12px; height: 12px; border-radius: 50%; }
.legend-item.available::before { background: hsl(228,4%,22%); }
.legend-item.past::before { background: rgba(255,255,255,0.1); }
.legend-item.selected::before { background: var(--accent); }

/* Slots */
.slots-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1rem; }
.slot-btn { background: hsl(228,4%,20%); border: 1px solid var(--border); color: var(--text); border-radius: 0.5rem; padding: 0.5rem 1rem; font-size: 0.9rem; cursor: pointer; transition: all 0.15s; }
.slot-btn:hover { border-color: var(--accent); color: var(--accent); }
.slot-btn.selected { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }

.step-actions { margin-top: 1rem; display: flex; gap: 0.75rem; }
.empty-slots { text-align: center; padding: 2rem; color: var(--text-muted); }

/* Form */
.summary-bar { display: flex; gap: 1.5rem; background: hsl(228,4%,18%); border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 1.5rem; font-size: 0.88rem; flex-wrap: wrap; }
.booking-form { display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); }
.form-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }

/* Success */
.success-card { text-align: center; }
.success-icon { font-size: 3rem; margin-bottom: 0.75rem; }
.success-card h2 { font-size: 1.75rem; font-weight: 800; margin: 0 0 0.75rem; }
.success-card p { color: var(--text-muted); margin: 0.4rem 0; }
.success-actions { display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem; }
.muted { color: var(--text-muted); }

/* Loading */
.loading-wrap { display: flex; justify-content: center; padding: 4rem; }
.spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
.loading-inline { color: var(--text-muted); font-size: 0.88rem; padding: 1rem 0; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Alert */
.alert-error { background: hsl(355,70%,15%); border: 1px solid hsl(355,70%,30%); color: hsl(355,70%,65%); border-radius: 0.5rem; padding: 0.75rem 1rem; font-size: 0.88rem; }

/* Inputs */
.input { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 0.5rem; padding: 0.6rem 0.85rem; font-size: 0.9rem; width: 100%; box-sizing: border-box; }
.input:focus { outline: none; border-color: var(--accent); }
textarea.input { resize: vertical; font-family: inherit; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.2rem; border-radius: 0.5rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; text-decoration: none; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { filter: brightness(1.1); }
.btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
.btn-outline:hover { background: rgba(255,255,255,0.05); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }

@media (max-width: 600px) {
  .step-content { padding: 1.25rem; }
  .steps { gap: 0; }
  .step-label { display: none; }
  .booking-hero { padding: 4rem 1rem 2rem; }
}
</style>
