<template>
  <div>
    <div class="page-header">
      <h1>Settings</h1>
      <button class="btn btn-primary" @click="save" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save Settings' }}
      </button>
    </div>

    <div class="settings-grid" v-if="loaded">
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🌐 Site Identity</h2>
        <div class="form-group">
          <label>Site Name</label>
          <input v-model="form.site_name" class="input" placeholder="My Pygmy Site" />
        </div>
        <div class="form-group">
          <label>Tagline</label>
          <input v-model="form.site_tagline" class="input" placeholder="A short description of your site" />
        </div>
        <div class="form-group">
          <label>Logo URL</label>
          <div class="pick-row">
            <input v-model="form.site_logo" class="input" placeholder="/uploads/media/logo.png" />
            <button type="button" class="btn btn-ghost btn-sm" @click="pickerTarget = 'site_logo'">🖼️</button>
          </div>
        </div>
        <div class="form-group">
          <label>Footer Text</label>
          <input v-model="form.footer_text" class="input" placeholder="© 2026 My Site" />
        </div>
      </div>

      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🎨 Appearance</h2>
        <div class="form-group">
          <label>Accent Color</label>
          <div class="color-row">
            <input v-model="form.accent_color" class="input" placeholder="hsl(355, 70%, 58%)" />
            <input type="color" :value="hslToHex(form.accent_color)" class="color-swatch" @input="e => form.accent_color = e.target.value" />
          </div>
        </div>
        <div class="form-group">
          <label>Posts Per Page</label>
          <input v-model.number="form.posts_per_page" type="number" class="input" min="1" max="100" />
        </div>
      </div>

      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🦸 Hero Section</h2>
        <div class="form-group">
          <label>Hero Title</label>
          <input v-model="form.hero_title" class="input" placeholder="Welcome to My Site" />
        </div>
        <div class="form-group">
          <label>Hero Subtitle</label>
          <input v-model="form.hero_subtitle" class="input" placeholder="A warm intro line" />
        </div>
        <div class="form-group">
          <label>Hero Background URL (image or video)</label>
          <div class="pick-row">
            <input v-model="form.hero_bg_url" class="input" placeholder="/uploads/media/hero.jpg" />
            <button type="button" class="btn btn-ghost btn-sm" @click="pickerTarget = 'hero_bg_url'">🖼️</button>
          </div>
        </div>
        <div v-if="form.hero_bg_url" class="hero-preview" :style="{ backgroundImage: `url(${form.hero_bg_url})` }">
          <div class="hero-overlay">
            <strong>{{ form.hero_title }}</strong>
            <span>{{ form.hero_subtitle }}</span>
          </div>
        </div>
      </div>

      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">✉️ Contact Page</h2>
        <div class="form-group">
          <label>Intro Text</label>
          <textarea v-model="form.contact_intro" class="input textarea" rows="3"
            placeholder="Have a question? Drop us a message…" />
        </div>
      </div>

      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">📊 Analytics</h2>
        <div class="form-group">
          <label>Google Analytics ID <small style="color:var(--text-muted)">(e.g. G-XXXXXXXXXX)</small></label>
          <input v-model="form.google_analytics" class="input" placeholder="G-XXXXXXXXXX" />
        </div>
      </div>

      <div class="glass section profile-section">
        <h2 style="margin-bottom:1.25rem;">🔐 My Profile</h2>
        <div class="form-group">
          <label>Display Name</label>
          <input v-model="profile.name" class="input" placeholder="Admin" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input v-model="profile.email" class="input" type="email" placeholder="admin@pygmy.local" />
        </div>
        <div class="form-group">
          <label>New Password <small style="color:var(--text-muted)">(leave blank to keep current)</small></label>
          <input v-model="profile.password" class="input" type="password" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input v-model="profile.confirm" class="input" type="password" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <button class="btn btn-primary" @click="saveProfile" :disabled="savingProfile">
          {{ savingProfile ? 'Saving…' : 'Update Profile' }}
        </button>
      </div>
    </div>

    <!-- Media picker modal -->
    <MediaPickerModal
      v-if="pickerTarget"
      @select="url => { form[pickerTarget] = url }"
      @close="pickerTarget = null"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'
import MediaPickerModal from '../components/MediaPickerModal.vue'

const toast = useToastStore()
const loaded = ref(false)
const saving = ref(false)
const savingProfile = ref(false)
const pickerTarget = ref(null)

const profile = ref({ name: '', email: '', password: '', confirm: '' })

const form = ref({
  site_name: '',
  site_tagline: '',
  site_logo: '',
  accent_color: '',
  hero_title: '',
  hero_subtitle: '',
  hero_bg_url: '',
  footer_text: '',
  posts_per_page: 10,
  google_analytics: '',
  contact_intro: ''
})

onMounted(async () => {
  const [settingsRes, meRes] = await Promise.all([
    api.get('/settings'),
    api.get('/auth/me')
  ])
  Object.assign(form.value, settingsRes.data)
  profile.value.name = meRes.data.name
  profile.value.email = meRes.data.email
  loaded.value = true
})

async function save() {
  saving.value = true
  try {
    await api.put('/settings', form.value)
    toast.success('Settings saved')
  } catch {
    toast.error('Failed to save')
  } finally {
    saving.value = false
  }
}

async function saveProfile() {
  if (profile.value.password && profile.value.password !== profile.value.confirm) {
    toast.error('Passwords do not match')
    return
  }
  savingProfile.value = true
  try {
    const payload = { name: profile.value.name, email: profile.value.email }
    if (profile.value.password) payload.password = profile.value.password
    await api.put('/auth/me', payload)
    profile.value.password = ''
    profile.value.confirm = ''
    toast.success('Profile updated')
  } catch (e) {
    toast.error(e.response?.data?.error || 'Update failed')
  } finally {
    savingProfile.value = false
  }
}

function hslToHex(hsl) {
  // Quick approximation: return neutral if can't parse
  try {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (!match) return '#e84a5f'
    const [, h, s, l] = match.map(Number)
    const sl = s / 100, ll = l / 100
    const c = (1 - Math.abs(2 * ll - 1)) * sl
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = ll - c / 2
    let r, g, b
    if (h < 60)       { r = c; g = x; b = 0 }
    else if (h < 120) { r = x; g = c; b = 0 }
    else if (h < 180) { r = 0; g = c; b = x }
    else if (h < 240) { r = 0; g = x; b = c }
    else if (h < 300) { r = x; g = 0; b = c }
    else              { r = c; g = 0; b = x }
    return '#' + [r + m, g + m, b + m].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
  } catch { return '#e84a5f' }
}
</script>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.section { padding: 1.5rem; }
.color-row { display: flex; gap: 0.5rem; align-items: center; }
.pick-row { display: flex; gap: 0.5rem; align-items: center; }
.pick-row .input { flex: 1; }
.profile-section { grid-column: span 2; }
.color-swatch {
  width: 40px; height: 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0;
  background: none;
}
.hero-preview {
  margin-top: 0.75rem;
  height: 120px;
  border-radius: var(--radius-sm);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.hero-overlay {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}
@media (max-width: 768px) {
  .settings-grid { grid-template-columns: 1fr; }
}
</style>
