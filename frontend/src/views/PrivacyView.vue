<template>
  <div class="privacy-page">
    <SiteNav />

    <section class="privacy-hero">
      <div class="hero-inner">
        <div class="hero-icon">🛡️</div>
        <h1>{{ config.title || 'Your Privacy' }}</h1>
        <p>{{ config.subtitle || 'Manage your personal data' }}</p>
      </div>
    </section>

    <div class="privacy-content container">
      <!-- What data we hold -->
      <div class="glass privacy-card">
        <h2>📋 What data we hold about you</h2>
        <ul class="data-list">
          <li>👤 Your name, email address, and phone number</li>
          <li>🏠 Saved shipping and billing addresses</li>
          <li>🛒 Your order history and purchase records</li>
          <li>⭐ Any reviews you've submitted</li>
          <li>🏆 Loyalty points transactions</li>
          <li>💌 Wishlist and saved items</li>
          <li>🍪 Cookie consent preferences</li>
        </ul>
      </div>

      <!-- Data Export -->
      <div class="glass privacy-card" v-if="config.data_export_enabled !== false">
        <h2>📤 Download your data</h2>
        <p>You have the right to receive a copy of all personal data we hold about you (GDPR Article 20 — Right to Data Portability).</p>
        <p>We'll process your request within 30 days and send you a secure download link via email.</p>

        <div v-if="exportSuccess" class="success-box">
          ✅ {{ exportSuccess }}
        </div>
        <div v-else>
          <div class="request-form">
            <input v-model="exportEmail" type="email" class="form-input" placeholder="Your email address" />
            <button class="btn-accent" @click="submitExport" :disabled="exportLoading">
              {{ exportLoading ? 'Submitting…' : '📤 Request Data Export' }}
            </button>
          </div>
          <div v-if="exportError" class="error-box">{{ exportError }}</div>
        </div>
      </div>

      <!-- Account Deletion -->
      <div class="glass privacy-card danger-card" v-if="config.deletion_enabled !== false">
        <h2>🗑️ Delete your account</h2>
        <p>You have the right to request deletion of your personal data (GDPR Article 17 — Right to Erasure).</p>
        <p>Upon approval, your name, email, phone, and addresses will be permanently removed. Order history is retained in anonymised form for legal and accounting purposes.</p>
        <p><strong>This action cannot be undone.</strong></p>

        <div v-if="deleteSuccess" class="success-box">
          ✅ {{ deleteSuccess }}
        </div>
        <div v-else>
          <div v-if="!showDeleteForm">
            <button class="btn-danger" @click="showDeleteForm = true">🗑️ Request Account Deletion</button>
          </div>
          <div v-else class="request-form">
            <input v-model="deleteEmail" type="email" class="form-input" placeholder="Confirm your email address" />
            <div class="confirm-check">
              <input type="checkbox" v-model="deleteConfirmed" id="delete-confirm" />
              <label for="delete-confirm">I understand this will permanently remove my personal data</label>
            </div>
            <div class="request-form-actions">
              <button class="btn-danger" @click="submitDelete" :disabled="deleteLoading || !deleteConfirmed">
                {{ deleteLoading ? 'Submitting…' : 'Confirm Deletion Request' }}
              </button>
              <button class="btn-ghost" @click="showDeleteForm = false">Cancel</button>
            </div>
          </div>
          <div v-if="deleteError" class="error-box">{{ deleteError }}</div>
        </div>
      </div>

      <!-- Notification Preferences (for logged-in customers) -->
      <div class="glass privacy-card" v-if="isLoggedIn">
        <h2>🔔 Email preferences</h2>
        <p>Choose which emails you'd like to receive from us.</p>

        <div v-if="prefsLoading" class="loading">Loading preferences…</div>
        <div v-else-if="prefs" class="prefs-grid">
          <label class="pref-row" v-for="(label, key) in prefLabels" :key="key">
            <div class="pref-info">
              <span class="pref-label">{{ label.label }}</span>
              <span class="pref-desc">{{ label.desc }}</span>
            </div>
            <div class="toggle-wrapper">
              <input type="checkbox" v-model="prefs[key]" :true-value="1" :false-value="0"
                     @change="savePrefs" class="toggle-input" :id="`pref-${key}`" />
              <label :for="`pref-${key}`" class="toggle-label"></label>
            </div>
          </label>
        </div>
        <div v-if="prefsSaved" class="success-box" style="margin-top:1rem">✅ Preferences saved</div>
      </div>

      <!-- Contact DPO -->
      <div class="glass privacy-card" v-if="config.dpo_email">
        <h2>📧 Contact our Data Protection Officer</h2>
        <p>For any privacy-related questions or requests, you can reach our Data Protection Officer at:</p>
        <a :href="`mailto:${config.dpo_email}`" class="dpo-email">{{ config.dpo_email }}</a>
      </div>
    </div>

    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'

const config = ref({})
const exportEmail = ref('')
const exportLoading = ref(false)
const exportSuccess = ref(null)
const exportError = ref(null)
const showDeleteForm = ref(false)
const deleteEmail = ref('')
const deleteLoading = ref(false)
const deleteSuccess = ref(null)
const deleteError = ref(null)
const deleteConfirmed = ref(false)

// Notification preferences
const prefs = ref(null)
const prefsLoading = ref(false)
const prefsSaved = ref(false)

const prefLabels = {
  order_updates:  { label: 'Order updates',       desc: 'Shipping confirmations, status changes, and delivery notifications' },
  promotions:     { label: 'Promotions & offers', desc: 'Sale announcements, discount codes, and special deals' },
  newsletter:     { label: 'Newsletter',          desc: 'Blog posts, news, and general updates' },
  back_in_stock:  { label: 'Back-in-stock alerts', desc: 'Notifications when items on your watchlist are restocked' },
  price_drops:    { label: 'Price drop alerts',   desc: 'Notifications when items you're watching go on sale' },
  loyalty:        { label: 'Loyalty & rewards',   desc: 'Points earned, tier upgrades, and rewards catalog updates' },
  digest:         { label: 'Digest emails',       desc: 'Weekly/monthly roundup of content and updates' },
}

function getCustomerToken () {
  return localStorage.getItem('pygmy_customer_token')
}

const isLoggedIn = computed(() => !!getCustomerToken())

async function loadConfig () {
  try {
    const r = await fetch(`${API}/api/gdpr/config`)
    config.value = await r.json()
  } catch (_) {}
}

async function loadPrefs () {
  if (!isLoggedIn.value) return
  prefsLoading.value = true
  try {
    const r = await fetch(`${API}/api/notification-prefs/me`, {
      headers: { Authorization: `Bearer ${getCustomerToken()}` }
    })
    if (r.ok) prefs.value = await r.json()
  } finally {
    prefsLoading.value = false
  }
}

async function savePrefs () {
  if (!prefs.value) return
  try {
    await fetch(`${API}/api/notification-prefs/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getCustomerToken()}`,
      },
      body: JSON.stringify(prefs.value),
    })
    prefsSaved.value = true
    setTimeout(() => { prefsSaved.value = false }, 3000)
  } catch (_) {}
}

async function submitExport () {
  if (!exportEmail.value) { exportError.value = 'Please enter your email address'; return }
  exportLoading.value = true
  exportError.value = null
  try {
    const r = await fetch(`${API}/api/gdpr/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'export', email: exportEmail.value }),
    })
    const data = await r.json()
    if (!r.ok) { exportError.value = data.error || 'Request failed'; return }
    exportSuccess.value = data.message || 'Your request has been submitted. We'll contact you within 30 days.'
  } finally {
    exportLoading.value = false
  }
}

async function submitDelete () {
  if (!deleteEmail.value) { deleteError.value = 'Please enter your email address'; return }
  if (!deleteConfirmed.value) { deleteError.value = 'Please check the confirmation box'; return }
  deleteLoading.value = true
  deleteError.value = null
  try {
    const r = await fetch(`${API}/api/gdpr/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'delete', email: deleteEmail.value }),
    })
    const data = await r.json()
    if (!r.ok) { deleteError.value = data.error || 'Request failed'; return }
    deleteSuccess.value = data.message || 'Your deletion request has been submitted. We will process it within 30 days.'
  } finally {
    deleteLoading.value = false
  }
}

onMounted(() => {
  loadConfig()
  loadPrefs()
})
</script>

<style scoped>
.privacy-page { min-height: 100vh; background: var(--bg, hsl(228,4%,10%)); color: #fff; }
.privacy-hero { text-align: center; padding: 5rem 2rem 3rem; background: linear-gradient(135deg, hsl(228,4%,12%), hsl(228,4%,8%)); }
.hero-inner { max-width: 600px; margin: 0 auto; }
.hero-icon { font-size: 3rem; margin-bottom: 1rem; }
.privacy-hero h1 { font-size: clamp(1.8rem,5vw,3rem); font-weight: 800; margin-bottom: 0.75rem; }
.privacy-hero p { color: rgba(255,255,255,0.7); font-size: 1.1rem; }
.privacy-content.container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem 4rem; display: flex; flex-direction: column; gap: 1.5rem; }
.glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(16px); border-radius: 1.5rem; }
.privacy-card { padding: 2rem; }
.privacy-card h2 { font-size: 1.2rem; margin-bottom: 1rem; }
.privacy-card p { color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 0.75rem; }
.data-list { padding-left: 1.25rem; }
.data-list li { color: rgba(255,255,255,0.7); margin-bottom: 0.4rem; list-style: none; padding: 0.2rem 0; }
.request-form { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; align-items: flex-start; }
.request-form .form-input { flex: 1; min-width: 240px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #fff; outline: none; font-family: inherit; }
.btn-accent { background: hsl(355,70%,58%); color: #fff; padding: 0.75rem 1.5rem; border: none; border-radius: 0.75rem; cursor: pointer; font-weight: 600; white-space: nowrap; }
.btn-accent:disabled { opacity: 0.6; cursor: default; }
.danger-card { border-color: rgba(239,68,68,0.3); }
.btn-danger { background: rgba(239,68,68,0.8); color: #fff; padding: 0.75rem 1.5rem; border: none; border-radius: 0.75rem; cursor: pointer; font-weight: 600; }
.btn-danger:disabled { opacity: 0.5; cursor: default; }
.btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); padding: 0.75rem 1.5rem; border-radius: 0.75rem; cursor: pointer; color: rgba(255,255,255,0.7); }
.confirm-check { display: flex; align-items: center; gap: 0.5rem; margin: 0.75rem 0; font-size: 0.9rem; color: rgba(255,255,255,0.7); width: 100%; }
.request-form-actions { display: flex; gap: 1rem; flex-wrap: wrap; width: 100%; }
.success-box { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #4ade80; margin-top: 1rem; }
.error-box { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #f87171; margin-top: 0.5rem; width: 100%; }
.prefs-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.pref-row { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: rgba(255,255,255,0.03); border-radius: 0.75rem; cursor: pointer; gap: 1rem; }
.pref-info { flex: 1; }
.pref-label { display: block; font-weight: 500; }
.pref-desc { display: block; font-size: 0.82rem; color: rgba(255,255,255,0.5); margin-top: 0.1rem; }
.toggle-wrapper { position: relative; flex-shrink: 0; }
.toggle-input { display: none; }
.toggle-label { display: block; width: 44px; height: 24px; background: rgba(255,255,255,0.15); border-radius: 99px; cursor: pointer; transition: background 0.2s; position: relative; }
.toggle-label::after { content:''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
.toggle-input:checked + .toggle-label { background: hsl(355,70%,58%); }
.toggle-input:checked + .toggle-label::after { transform: translateX(20px); }
.dpo-email { color: hsl(355,70%,58%); font-weight: 600; font-size: 1.1rem; }
.loading { color: rgba(255,255,255,0.5); text-align: center; padding: 1rem; }
</style>
