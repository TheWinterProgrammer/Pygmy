<template>
  <div class="custom-404-view">
    <div class="page-header">
      <div>
        <h1>🔍 Custom 404 Page</h1>
        <p class="subtitle">Configure what visitors see when a page isn't found</p>
      </div>
      <div class="header-actions">
        <label class="toggle-pill" :class="{ active: form.custom_404_enabled === '1' }">
          <input type="checkbox" :checked="form.custom_404_enabled === '1'" @change="toggleEnabled" />
          <span class="dot"></span>
          {{ form.custom_404_enabled === '1' ? '✅ Enabled' : '⚫ Disabled' }}
        </label>
        <button class="btn-accent" @click="save" :disabled="saving">{{ saving ? 'Saving…' : '💾 Save Changes' }}</button>
      </div>
    </div>

    <div v-if="saved" class="success-banner">✅ Settings saved!</div>

    <div class="two-col">
      <!-- Settings Panel -->
      <div class="settings-panel glass-card">
        <h2>📝 Content</h2>

        <div class="form-group">
          <label>Emoji / Icon</label>
          <div class="emoji-row">
            <span class="emoji-preview">{{ form.custom_404_emoji || '🔍' }}</span>
            <input v-model="form.custom_404_emoji" placeholder="🔍" class="form-input emoji-input" />
          </div>
        </div>

        <div class="form-group">
          <label>Page Title</label>
          <input v-model="form.custom_404_title" placeholder="Page Not Found" class="form-input" />
        </div>

        <div class="form-group">
          <label>Subtitle / Message</label>
          <textarea v-model="form.custom_404_subtitle" rows="3" placeholder="Sorry, the page you're looking for doesn't exist." class="form-input"></textarea>
        </div>

        <div class="form-group">
          <label>Background Image URL (optional)</label>
          <input v-model="form.custom_404_bg_image" placeholder="https://…" class="form-input" />
        </div>

        <h2>🔘 Buttons</h2>

        <div class="form-row">
          <div class="form-group">
            <label>Primary CTA Label</label>
            <input v-model="form.custom_404_cta_label" placeholder="Go Back Home" class="form-input" />
          </div>
          <div class="form-group">
            <label>Primary CTA URL</label>
            <input v-model="form.custom_404_cta_url" placeholder="/" class="form-input" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Secondary CTA Label (optional)</label>
            <input v-model="form.custom_404_secondary_cta_label" placeholder="Browse Shop" class="form-input" />
          </div>
          <div class="form-group">
            <label>Secondary CTA URL</label>
            <input v-model="form.custom_404_secondary_cta_url" placeholder="/shop" class="form-input" />
          </div>
        </div>

        <h2>🔧 Options</h2>

        <div class="toggle-row">
          <label class="toggle-label">
            <div class="toggle-text">
              <strong>Show Search Bar</strong>
              <span>Let visitors search for what they were looking for</span>
            </div>
            <div class="toggle-pill" :class="{ active: form.custom_404_show_search === '1' }">
              <input type="checkbox" :checked="form.custom_404_show_search === '1'" @change="toggleSetting('custom_404_show_search')" />
              <span class="dot"></span>
            </div>
          </label>
        </div>

        <div class="toggle-row">
          <label class="toggle-label">
            <div class="toggle-text">
              <strong>Show Popular Pages</strong>
              <span>Display links to your most visited pages</span>
            </div>
            <div class="toggle-pill" :class="{ active: form.custom_404_show_popular === '1' }">
              <input type="checkbox" :checked="form.custom_404_show_popular === '1'" @change="toggleSetting('custom_404_show_popular')" />
              <span class="dot"></span>
            </div>
          </label>
        </div>
      </div>

      <!-- Preview Panel -->
      <div class="preview-panel">
        <div class="preview-label">👁️ Preview</div>
        <div class="preview-card glass-card" :style="bgStyle">
          <div class="preview-overlay">
            <div class="preview-content">
              <div class="preview-emoji">{{ form.custom_404_emoji || '🔍' }}</div>
              <div class="preview-code">404</div>
              <h2 class="preview-title">{{ form.custom_404_title || 'Page Not Found' }}</h2>
              <p class="preview-subtitle">{{ form.custom_404_subtitle || "Sorry, the page you're looking for doesn't exist." }}</p>
              <div class="preview-search" v-if="form.custom_404_show_search === '1'">
                <div class="fake-search">🔍 Search…</div>
              </div>
              <div class="preview-btns">
                <div class="preview-btn primary">{{ form.custom_404_cta_label || 'Go Back Home' }}</div>
                <div class="preview-btn secondary" v-if="form.custom_404_secondary_cta_label">{{ form.custom_404_secondary_cta_label }}</div>
              </div>
              <div class="preview-popular" v-if="form.custom_404_show_popular === '1'">
                <p class="popular-label">Popular Pages</p>
                <div class="popular-links">
                  <span>🏠 Home</span>
                  <span>📝 Blog</span>
                  <span>🛍️ Shop</span>
                  <span>📬 Contact</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p class="preview-note">This is how your 404 page will look to visitors</p>
      </div>
    </div>

    <!-- 404 Error Log Link -->
    <div class="error-log-card glass-card">
      <div class="error-log-inner">
        <div>
          <h3>🚫 404 Error Log</h3>
          <p>Track which URLs are causing 404 errors on your site and create redirects to fix them.</p>
        </div>
        <router-link to="/error-logs" class="btn-accent">View Error Log →</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const loading = ref(false)
const saving = ref(false)
const saved = ref(false)

const form = ref({
  custom_404_enabled: '1',
  custom_404_title: 'Page Not Found',
  custom_404_subtitle: "Sorry, the page you're looking for doesn't exist.",
  custom_404_cta_label: 'Go Back Home',
  custom_404_cta_url: '/',
  custom_404_secondary_cta_label: 'Browse Shop',
  custom_404_secondary_cta_url: '/shop',
  custom_404_show_search: '1',
  custom_404_show_popular: '1',
  custom_404_bg_image: '',
  custom_404_emoji: '🔍',
})

const bgStyle = computed(() => {
  if (!form.value.custom_404_bg_image) return {}
  return {
    backgroundImage: `url(${form.value.custom_404_bg_image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})

onMounted(async () => {
  try {
    const res = await api.get('/custom-404')
    Object.assign(form.value, res.data)
  } catch {}
})

function toggleEnabled() {
  form.value.custom_404_enabled = form.value.custom_404_enabled === '1' ? '0' : '1'
}

function toggleSetting(key) {
  form.value[key] = form.value[key] === '1' ? '0' : '1'
}

async function save() {
  saving.value = true
  try {
    await api.put('/custom-404', form.value)
    saved.value = true
    setTimeout(() => (saved.value = false), 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.custom-404-view { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
.page-header h1 { margin: 0 0 .25rem; }
.subtitle { color: #aaa; margin: 0; }
.header-actions { display: flex; gap: .75rem; align-items: center; }
.success-banner { background: rgba(90,200,120,.15); border: 1px solid rgba(90,200,120,.3); color: #5ac878; padding: .75rem 1rem; border-radius: .75rem; margin-bottom: 1rem; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
.settings-panel { padding: 1.5rem; border-radius: 1.25rem; }
.settings-panel h2 { font-size: 1rem; margin: 1.5rem 0 1rem; color: #aaa; border-bottom: 1px solid rgba(255,255,255,.07); padding-bottom: .5rem; }
.settings-panel h2:first-child { margin-top: 0; }
.form-group { display: flex; flex-direction: column; gap: .4rem; margin-bottom: .75rem; }
.form-group label { font-size: .85rem; color: #aaa; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-input { padding: .55rem .75rem; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: .6rem; color: inherit; font-size: .9rem; width: 100%; box-sizing: border-box; }
.emoji-row { display: flex; gap: .75rem; align-items: center; }
.emoji-preview { font-size: 2rem; line-height: 1; }
.emoji-input { width: 100px; }
.toggle-row { margin-bottom: .75rem; }
.toggle-label { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.toggle-text { display: flex; flex-direction: column; gap: .15rem; }
.toggle-text strong { font-size: .9rem; }
.toggle-text span { font-size: .78rem; color: #aaa; }
.toggle-pill { position: relative; display: inline-flex; align-items: center; padding: .2rem .5rem .2rem 2rem; border-radius: 999px; background: rgba(255,255,255,.08); cursor: pointer; transition: background .2s; min-width: 52px; }
.toggle-pill input { display: none; }
.toggle-pill .dot { position: absolute; left: .25rem; width: 1.1rem; height: 1.1rem; background: #aaa; border-radius: 50%; transition: left .2s, background .2s; }
.toggle-pill.active { background: rgba(var(--accent-rgb, 224,72,88),.25); }
.toggle-pill.active .dot { left: calc(100% - 1.35rem); background: var(--accent, hsl(355,70%,58%)); }
.preview-panel { display: flex; flex-direction: column; gap: .75rem; }
.preview-label { font-size: .85rem; color: #aaa; }
.preview-card { border-radius: 1.25rem; overflow: hidden; min-height: 400px; position: relative; }
.preview-overlay { position: absolute; inset: 0; background: rgba(10,10,18,.75); display: flex; align-items: center; justify-content: center; }
.preview-content { text-align: center; padding: 2rem; max-width: 340px; }
.preview-emoji { font-size: 3rem; margin-bottom: .5rem; }
.preview-code { font-size: 5rem; font-weight: 900; color: var(--accent, hsl(355,70%,58%)); opacity: .3; line-height: 1; margin-bottom: .25rem; }
.preview-title { font-size: 1.3rem; margin: 0 0 .5rem; }
.preview-subtitle { font-size: .85rem; color: #aaa; margin: 0 0 1rem; }
.fake-search { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; padding: .4rem .75rem; color: #666; font-size: .82rem; margin-bottom: 1rem; }
.preview-btns { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
.preview-btn { padding: .4rem .9rem; border-radius: .5rem; font-size: .8rem; }
.preview-btn.primary { background: var(--accent, hsl(355,70%,58%)); color: #fff; }
.preview-btn.secondary { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2); }
.preview-popular { margin-top: .5rem; }
.popular-label { font-size: .75rem; color: #aaa; margin: 0 0 .4rem; }
.popular-links { display: flex; gap: .5rem; flex-wrap: wrap; justify-content: center; }
.popular-links span { font-size: .75rem; background: rgba(255,255,255,.08); padding: .2rem .5rem; border-radius: .4rem; }
.preview-note { font-size: .78rem; color: #666; text-align: center; margin: 0; }
.error-log-card { border-radius: 1.25rem; padding: 1.5rem; }
.error-log-inner { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.error-log-inner h3 { margin: 0 0 .3rem; }
.error-log-inner p { margin: 0; color: #aaa; font-size: .88rem; }
.btn-accent { padding: .55rem 1.25rem; background: var(--accent, hsl(355,70%,58%)); border: none; border-radius: .6rem; color: #fff; cursor: pointer; font-size: .9rem; text-decoration: none; white-space: nowrap; }
.glass-card { background: var(--surface, hsl(228,4%,15%)); border: 1px solid rgba(255,255,255,.1); }
@media(max-width:900px) { .two-col { grid-template-columns: 1fr; } .form-row { grid-template-columns: 1fr; } }
</style>
