<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="show" :class="['cookie-banner', position]" role="dialog" aria-label="Cookie consent">
        <div class="banner-inner">
          <div class="banner-text">
            <strong>{{ cfg.cookie_consent_title || 'We use cookies' }}</strong>
            <p>{{ cfg.cookie_consent_message }}</p>
            <div v-if="cfg.cookie_consent_privacy_url || cfg.cookie_consent_cookie_url" class="banner-links">
              <a v-if="cfg.cookie_consent_privacy_url" :href="cfg.cookie_consent_privacy_url" target="_blank" rel="noopener">Privacy Policy</a>
              <a v-if="cfg.cookie_consent_cookie_url" :href="cfg.cookie_consent_cookie_url" target="_blank" rel="noopener">Cookie Policy</a>
            </div>
          </div>

          <!-- Manage Preferences Panel -->
          <Transition name="fade">
            <div v-if="showManage" class="manage-panel">
              <h4>Manage Preferences</h4>
              <div class="manage-cats">
                <label class="cat-row">
                  <div class="cat-info">
                    <span class="cat-name">✅ Necessary</span>
                    <span class="cat-desc">Required for the site to work</span>
                  </div>
                  <span class="always-on">Always Active</span>
                </label>
                <label class="cat-row" v-if="cfg.cookie_consent_analytics === '1'">
                  <div class="cat-info">
                    <span class="cat-name">📈 Analytics</span>
                    <span class="cat-desc">Help us understand how you use the site</span>
                  </div>
                  <input type="checkbox" v-model="prefs.analytics" />
                </label>
                <label class="cat-row" v-if="cfg.cookie_consent_marketing === '1'">
                  <div class="cat-info">
                    <span class="cat-name">📣 Marketing</span>
                    <span class="cat-desc">Personalised ads and campaigns</span>
                  </div>
                  <input type="checkbox" v-model="prefs.marketing" />
                </label>
                <label class="cat-row" v-if="cfg.cookie_consent_preferences === '1'">
                  <div class="cat-info">
                    <span class="cat-name">🎛️ Preferences</span>
                    <span class="cat-desc">Remember your language, currency, and layout settings</span>
                  </div>
                  <input type="checkbox" v-model="prefs.preferences" />
                </label>
              </div>
              <button class="btn-save" @click="savePreferences">Save My Preferences</button>
            </div>
          </Transition>

          <div class="banner-btns">
            <button v-if="cfg.cookie_consent_show_manage === '1'" class="btn-manage"
              @click="showManage = !showManage">
              {{ cfg.cookie_consent_btn_manage || 'Manage Preferences' }}
            </button>
            <button class="btn-reject" @click="rejectAll">
              {{ cfg.cookie_consent_btn_reject || 'Reject All' }}
            </button>
            <button class="btn-accept" @click="acceptAll">
              {{ cfg.cookie_consent_btn_accept || 'Accept All' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'

const COOKIE_KEY = 'pygmy_cookie_consent'
const SESSION_KEY = 'pygmy_session'

const show = ref(false)
const showManage = ref(false)
const cfg = ref({})
const prefs = reactive({ analytics: true, marketing: false, preferences: true })

const position = computed(() => cfg.value.cookie_consent_position || 'bottom')

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3200/api'

onMounted(async () => {
  try {
    const r = await fetch(`${API_BASE}/cookie-consent/config`)
    const data = await r.json()
    cfg.value = data

    if (data.cookie_consent_enabled !== '1') return

    // Check if already consented
    const stored = localStorage.getItem(COOKIE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const expiryDays = parseInt(data.cookie_consent_expiry_days || '365')
      const expiresAt = new Date(parsed.ts).getTime() + expiryDays * 86400000
      if (Date.now() < expiresAt) return // still valid
    }

    // Show banner after 800ms
    setTimeout(() => { show.value = true }, 800)
  } catch {
    // silently fail — don't break site if API down
  }
})

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, id) }
  return id
}

async function recordConsent(categories) {
  try {
    await fetch(`${API_BASE}/cookie-consent/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: getSessionId(), categories }),
    })
  } catch {}
}

function persistLocally(categories) {
  localStorage.setItem(COOKIE_KEY, JSON.stringify({ categories, ts: new Date().toISOString() }))
}

function acceptAll() {
  const cats = { analytics: true, marketing: true, preferences: true }
  persistLocally(cats)
  recordConsent(cats)
  show.value = false
}

function rejectAll() {
  const cats = { analytics: false, marketing: false, preferences: false }
  persistLocally(cats)
  recordConsent(cats)
  show.value = false
}

function savePreferences() {
  const cats = { analytics: !!prefs.analytics, marketing: !!prefs.marketing, preferences: !!prefs.preferences }
  persistLocally(cats)
  recordConsent(cats)
  showManage.value = false
  show.value = false
}
</script>

<style scoped>
.cookie-banner {
  position: fixed;
  z-index: 9999;
  left: 0; right: 0;
  padding: 1rem;
}
.cookie-banner.bottom { bottom: 0; }
.cookie-banner.bottom-left { bottom: 1rem; left: 1rem; right: auto; max-width: 400px; }
.cookie-banner.bottom-right { bottom: 1rem; right: 1rem; left: auto; max-width: 400px; }

.banner-inner {
  background: rgba(22, 22, 28, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 1.25rem;
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
  max-width: 960px;
  margin: 0 auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.bottom-left .banner-inner,
.bottom-right .banner-inner { max-width: 100%; flex-direction: column; }

.banner-text { flex: 1; min-width: 200px; }
.banner-text strong { font-size: 0.95rem; color: #fff; }
.banner-text p { font-size: 0.82rem; color: rgba(255,255,255,0.65); margin: 0.3rem 0 0; line-height: 1.5; }
.banner-links { display: flex; gap: 1rem; margin-top: 0.4rem; }
.banner-links a { font-size: 0.78rem; color: hsl(355, 70%, 58%); text-decoration: none; }
.banner-links a:hover { text-decoration: underline; }

.banner-btns { display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
.btn-accept, .btn-reject, .btn-manage {
  padding: 0.5rem 1.1rem;
  border-radius: 0.6rem;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all .2s;
}
.btn-accept { background: hsl(355, 70%, 58%); color: #fff; }
.btn-accept:hover { background: hsl(355, 70%, 50%); }
.btn-reject { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.15); }
.btn-reject:hover { background: rgba(255,255,255,0.15); }
.btn-manage { background: transparent; color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.12); }
.btn-manage:hover { background: rgba(255,255,255,0.07); color: #fff; }

/* Manage panel */
.manage-panel { flex: 0 0 100%; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; }
.manage-panel h4 { font-size: 0.9rem; margin: 0 0 0.75rem; }
.manage-cats { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.cat-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.04); border-radius: 0.5rem; cursor: pointer; }
.cat-row input { width: 1rem; height: 1rem; accent-color: hsl(355, 70%, 58%); }
.cat-info { display: flex; flex-direction: column; gap: 0.1rem; }
.cat-name { font-size: 0.85rem; font-weight: 600; color: #fff; }
.cat-desc { font-size: 0.75rem; color: rgba(255,255,255,0.5); }
.always-on { font-size: 0.75rem; color: rgba(255,255,255,0.4); font-style: italic; }
.btn-save { background: hsl(355, 70%, 58%); color: #fff; border: none; padding: 0.5rem 1.25rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.85rem; font-weight: 600; }

/* Transitions */
.slide-up-enter-active, .slide-up-leave-active { transition: transform .35s ease, opacity .35s ease; }
.slide-up-enter-from { transform: translateY(100%); opacity: 0; }
.slide-up-leave-to { transform: translateY(100%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
