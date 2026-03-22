<template>
  <Teleport to="body">
    <Transition name="cookie-banner">
      <div v-if="show" class="cookie-banner glass" role="dialog" aria-label="Cookie consent">
        <div class="cookie-inner">
          <div class="cookie-text">
            <span class="cookie-icon">🍪</span>
            <div>
              <p class="cookie-msg">{{ settings.cookie_consent_message }}</p>
              <a v-if="settings.cookie_consent_policy_url" :href="settings.cookie_consent_policy_url" class="cookie-policy-link" target="_blank">
                Privacy Policy
              </a>
            </div>
          </div>
          <div class="cookie-actions">
            <button class="cookie-btn btn-manage" @click="openPrefs">
              {{ settings.cookie_consent_manage_label || 'Manage Preferences' }}
            </button>
            <button class="cookie-btn btn-reject" @click="rejectAll">
              {{ settings.cookie_consent_reject_label || 'Reject Non-Essential' }}
            </button>
            <button class="cookie-btn btn-accept" @click="acceptAll">
              {{ settings.cookie_consent_accept_label || 'Accept All' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Preferences Modal -->
    <Transition name="fade">
      <div v-if="showPrefs" class="cookie-modal-overlay" @click.self="showPrefs = false">
        <div class="cookie-modal glass">
          <h3>🍪 Cookie Preferences</h3>
          <p class="cookie-modal-desc">
            Choose which cookies you allow. Essential cookies are always active as they are required for the site to function.
          </p>

          <div class="pref-row">
            <div class="pref-info">
              <strong>Essential Cookies</strong>
              <span>Session, login, cart. Required for the site to work.</span>
            </div>
            <div class="pref-toggle always-on">Always On</div>
          </div>

          <div class="pref-row">
            <div class="pref-info">
              <strong>Analytics Cookies</strong>
              <span>Help us understand how visitors interact with the site.</span>
            </div>
            <label class="toggle">
              <input type="checkbox" v-model="prefAnalytics" />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="pref-row">
            <div class="pref-info">
              <strong>Marketing Cookies</strong>
              <span>Used for personalised ads and affiliate tracking.</span>
            </div>
            <label class="toggle">
              <input type="checkbox" v-model="prefMarketing" />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="cookie-modal-actions">
            <button class="cookie-btn btn-reject" @click="savePrefs">Save My Preferences</button>
            <button class="cookie-btn btn-accept" @click="acceptAll">Accept All</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  settings: { type: Object, default: () => ({}) }
})

const STORAGE_KEY = 'pygmy_cookie_consent'
const show = ref(false)
const showPrefs = ref(false)
const prefAnalytics = ref(false)
const prefMarketing = ref(false)

function getConsent() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}

function setConsent(consent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...consent, ts: Date.now() }))
  window.dispatchEvent(new CustomEvent('pygmy:consent', { detail: consent }))
}

function acceptAll() {
  setConsent({ analytics: true, marketing: true, essential: true })
  show.value = false
  showPrefs.value = false
}

function rejectAll() {
  setConsent({ analytics: false, marketing: false, essential: true })
  show.value = false
  showPrefs.value = false
}

function openPrefs() {
  const existing = getConsent()
  prefAnalytics.value = existing?.analytics ?? (props.settings.cookie_analytics_default === '1')
  prefMarketing.value = existing?.marketing ?? (props.settings.cookie_marketing_default === '1')
  showPrefs.value = true
}

function savePrefs() {
  setConsent({ analytics: prefAnalytics.value, marketing: prefMarketing.value, essential: true })
  show.value = false
  showPrefs.value = false
}

onMounted(() => {
  if (props.settings.cookie_consent_enabled !== '1') return
  const existing = getConsent()
  if (!existing) {
    // Small delay so it doesn't flash immediately on page load
    setTimeout(() => { show.value = true }, 800)
  }
})

// Export consent for external use
defineExpose({ getConsent, acceptAll, rejectAll })
</script>

<style scoped>
.cookie-banner {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  border-radius: 1.25rem;
  padding: 1rem 1.5rem;
  background: rgba(20, 20, 28, 0.92);
  border: 1px solid rgba(255,255,255,0.12);
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  max-width: 900px;
  margin: 0 auto;
}

.cookie-inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.cookie-text {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
  min-width: 240px;
}

.cookie-icon { font-size: 1.5rem; flex-shrink: 0; }

.cookie-msg {
  font-size: 0.875rem;
  color: rgba(255,255,255,0.85);
  margin: 0 0 0.25rem;
  line-height: 1.5;
}

.cookie-policy-link {
  font-size: 0.75rem;
  color: var(--accent, hsl(355, 70%, 58%));
  text-decoration: underline;
}

.cookie-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  flex-shrink: 0;
}

.cookie-btn {
  border: none;
  border-radius: 0.5rem;
  padding: 0.45rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}
.cookie-btn:hover { opacity: 0.85; }

.btn-accept {
  background: var(--accent, hsl(355, 70%, 58%));
  color: #fff;
}
.btn-reject {
  background: rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.85);
}
.btn-manage {
  background: transparent;
  color: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.15);
}

/* Modal */
.cookie-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.cookie-modal {
  background: rgba(20, 20, 28, 0.97);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 1.25rem;
  padding: 1.75rem;
  width: 100%;
  max-width: 480px;
}

.cookie-modal h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.cookie-modal-desc { font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-bottom: 1.25rem; line-height: 1.5; }

.pref-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.pref-row:last-of-type { border-bottom: none; }

.pref-info { display: flex; flex-direction: column; gap: 0.2rem; }
.pref-info strong { font-size: 0.875rem; }
.pref-info span { font-size: 0.75rem; color: rgba(255,255,255,0.5); }

.always-on { font-size: 0.75rem; color: #4ade80; font-weight: 600; }

/* Toggle switch */
.toggle { position: relative; display: inline-flex; cursor: pointer; }
.toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.toggle-track {
  width: 40px;
  height: 22px;
  background: rgba(255,255,255,0.12);
  border-radius: 11px;
  position: relative;
  transition: background 0.25s;
  flex-shrink: 0;
}
.toggle-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.25s;
}
.toggle input:checked + .toggle-track {
  background: var(--accent, hsl(355, 70%, 58%));
}
.toggle input:checked + .toggle-track::after {
  transform: translateX(18px);
}

.cookie-modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }

/* Transitions */
.cookie-banner-enter-active, .cookie-banner-leave-active {
  transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s;
}
.cookie-banner-enter-from, .cookie-banner-leave-to {
  transform: translateY(120%);
  opacity: 0;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 600px) {
  .cookie-banner { bottom: 0; left: 0; right: 0; border-radius: 1rem 1rem 0 0; }
  .cookie-inner { flex-direction: column; align-items: flex-start; }
  .cookie-actions { width: 100%; justify-content: flex-end; }
}
</style>
