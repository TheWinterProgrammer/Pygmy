<template>
  <div>
    <div class="page-header">
      <div>
        <h1>🎨 Storefront Customizer</h1>
        <p class="subtitle">Customize the look and feel of your public website</p>
      </div>
      <div style="display:flex;gap:.5rem">
        <a href="http://localhost:5174" target="_blank" rel="noopener" class="btn btn-ghost">🌐 Preview Site</a>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '⏳ Saving…' : '💾 Save Changes' }}</button>
      </div>
    </div>

    <div v-if="loading" class="glass section"><div class="loading-bar"></div></div>

    <div v-else class="customizer-layout">
      <!-- Left: Controls -->
      <div class="controls-panel">

        <!-- Colors -->
        <div class="section glass">
          <h2 class="section-title">🎨 Colors</h2>
          <div class="field">
            <label>Accent Color</label>
            <div class="color-row">
              <input type="color" v-model="form.accent_color_hex" class="color-swatch" @input="syncAccentFromHex" />
              <input v-model="form.accent_color" class="input input-sm" placeholder="hsl(355, 70%, 58%)" style="flex:1" />
            </div>
            <div class="color-presets">
              <button v-for="p in colorPresets" :key="p.name" class="preset-dot" :style="{background:p.hex}" :title="p.name" @click="applyPreset(p)"></button>
            </div>
          </div>
          <div class="field">
            <label>Background Color</label>
            <div class="color-row">
              <input type="color" v-model="form.bg_color_hex" class="color-swatch" @input="syncBgFromHex" />
              <input v-model="form.bg_color" class="input input-sm" placeholder="hsl(228, 4%, 10%)" style="flex:1" />
            </div>
          </div>
          <div class="field">
            <label>Surface Color</label>
            <div class="color-row">
              <input type="color" v-model="form.surface_color_hex" class="color-swatch" @input="syncSurfaceFromHex" />
              <input v-model="form.surface_color" class="input input-sm" placeholder="hsl(228, 4%, 15%)" style="flex:1" />
            </div>
          </div>
        </div>

        <!-- Typography -->
        <div class="section glass">
          <h2 class="section-title">🖋 Typography</h2>
          <div class="field">
            <label>Font Family</label>
            <select v-model="form.theme_font" class="input">
              <option v-for="f in fonts" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>
          </div>
          <div class="field">
            <label>Base Font Size</label>
            <select v-model="form.theme_font_size" class="input">
              <option value="14px">Small (14px)</option>
              <option value="16px">Medium (16px) — Default</option>
              <option value="18px">Large (18px)</option>
            </select>
          </div>
        </div>

        <!-- Layout -->
        <div class="section glass">
          <h2 class="section-title">📐 Layout & Shapes</h2>
          <div class="field">
            <label>Button Border Radius</label>
            <div class="toggle-group">
              <button v-for="r in radii" :key="r.value" :class="['toggle-btn', form.theme_button_radius === r.value && 'active']" @click="form.theme_button_radius = r.value">{{ r.label }}</button>
            </div>
          </div>
          <div class="field">
            <label>Card Style</label>
            <div class="toggle-group">
              <button v-for="s in cardStyles" :key="s.value" :class="['toggle-btn', form.theme_card_style === s.value && 'active']" @click="form.theme_card_style = s.value">{{ s.label }}</button>
            </div>
          </div>
          <div class="field">
            <label>Navigation Style</label>
            <div class="toggle-group">
              <button v-for="n in navStyles" :key="n.value" :class="['toggle-btn', form.theme_nav_style === n.value && 'active']" @click="form.theme_nav_style = n.value">{{ n.label }}</button>
            </div>
          </div>
          <div class="field">
            <label>Hero Layout</label>
            <div class="toggle-group">
              <button v-for="h in heroLayouts" :key="h.value" :class="['toggle-btn', form.theme_hero_layout === h.value && 'active']" @click="form.theme_hero_layout = h.value">{{ h.label }}</button>
            </div>
          </div>
        </div>

        <!-- Products Grid -->
        <div class="section glass">
          <h2 class="section-title">🛍️ Products Grid</h2>
          <div class="field">
            <label>Products Per Row (desktop)</label>
            <div class="toggle-group">
              <button v-for="n in [2,3,4]" :key="n" :class="['toggle-btn', form.theme_products_per_row == n && 'active']" @click="form.theme_products_per_row = n">{{ n }}</button>
            </div>
          </div>
          <div class="field">
            <label>Show Product Excerpt</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.theme_show_excerpt" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="field">
            <label>Show "Add to Cart" on Cards</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.theme_show_atc" />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="section glass">
          <h2 class="section-title">🦶 Footer</h2>
          <div class="field">
            <label>Footer Style</label>
            <div class="toggle-group">
              <button v-for="f in footerStyles" :key="f.value" :class="['toggle-btn', form.theme_footer_style === f.value && 'active']" @click="form.theme_footer_style = f.value">{{ f.label }}</button>
            </div>
          </div>
          <div class="field">
            <label>Show Social Links</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.theme_show_social" />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- Custom CSS -->
        <div class="section glass">
          <h2 class="section-title">💻 Custom CSS</h2>
          <div class="field">
            <label>Injected into public site <code style="font-size:.75rem;color:#888">&lt;style&gt;</code></label>
            <textarea v-model="form.custom_css" class="input code-area" rows="8" placeholder="/* Your custom CSS here */&#10;.site-nav { ... }&#10;.hero { ... }"></textarea>
          </div>
        </div>

      </div>

      <!-- Right: Live Preview -->
      <div class="preview-panel glass">
        <div class="preview-header">
          <span style="font-size:.85rem;color:#888">Live Preview</span>
          <div style="display:flex;gap:.4rem">
            <button :class="['preview-device', previewDevice==='desktop'&&'active']" @click="previewDevice='desktop'">🖥</button>
            <button :class="['preview-device', previewDevice==='mobile'&&'active']" @click="previewDevice='mobile'">📱</button>
          </div>
        </div>

        <div class="preview-frame-wrap" :class="previewDevice">
          <div class="preview-frame" :style="previewStyles">
            <!-- Nav preview -->
            <div class="pv-nav" :class="'nav-' + form.theme_nav_style" :style="navPreviewStyle">
              <span class="pv-logo">{{ siteName }}</span>
              <div class="pv-nav-links">
                <span>Home</span><span>Shop</span><span>Blog</span>
              </div>
            </div>

            <!-- Hero preview -->
            <div class="pv-hero" :class="'hero-' + form.theme_hero_layout">
              <div class="pv-hero-content">
                <h2 :style="{fontFamily: form.theme_font, color: '#fff', fontSize:'1.2rem', margin:'0 0 .4rem'}">Welcome to {{ siteName }}</h2>
                <p :style="{color:'rgba(255,255,255,.75)', fontSize:'.8rem', margin:'0 0 .75rem'}">Your beautiful online store</p>
                <button class="pv-btn" :style="btnStyle">Shop Now</button>
              </div>
            </div>

            <!-- Products preview -->
            <div class="pv-products" :style="{gridTemplateColumns: `repeat(${form.theme_products_per_row || 3}, 1fr)`}">
              <div v-for="i in Math.min(form.theme_products_per_row || 3, 4)" :key="i" class="pv-card" :class="'card-'+form.theme_card_style" :style="cardStyle">
                <div class="pv-card-img"></div>
                <div class="pv-card-body">
                  <div class="pv-card-name" :style="{fontFamily:form.theme_font}">Product Name</div>
                  <div class="pv-card-price" :style="{color:form.accent_color}">€29.99</div>
                  <p v-if="form.theme_show_excerpt" class="pv-card-excerpt">A great product for you…</p>
                  <button v-if="form.theme_show_atc" class="pv-btn pv-btn-sm" :style="btnStyle">Add to Cart</button>
                </div>
              </div>
            </div>

            <!-- Footer preview -->
            <div class="pv-footer" :class="'footer-'+form.theme_footer_style" :style="footerStyle">
              <span style="font-size:.7rem;opacity:.6">© {{ new Date().getFullYear() }} {{ siteName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="toast glass">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const API = 'http://localhost:3200/api'
const loading = ref(false)
const saving = ref(false)
const toast = ref('')
const previewDevice = ref('desktop')
const siteName = ref('My Store')

const form = reactive({
  accent_color: 'hsl(355, 70%, 58%)',
  accent_color_hex: '#e05260',
  bg_color: 'hsl(228, 4%, 10%)',
  bg_color_hex: '#191a1e',
  surface_color: 'hsl(228, 4%, 15%)',
  surface_color_hex: '#232428',
  theme_font: 'Poppins',
  theme_font_size: '16px',
  theme_button_radius: '0.5rem',
  theme_card_style: 'glass',
  theme_nav_style: 'floating',
  theme_hero_layout: 'centered',
  theme_products_per_row: 3,
  theme_show_excerpt: false,
  theme_show_atc: true,
  theme_footer_style: 'minimal',
  theme_show_social: false,
  custom_css: '',
})

const colorPresets = [
  { name: 'Red (Default)', value: 'hsl(355, 70%, 58%)', hex: '#e05260' },
  { name: 'Purple', value: 'hsl(270, 70%, 60%)', hex: '#8b5cf6' },
  { name: 'Blue', value: 'hsl(215, 80%, 55%)', hex: '#3b82f6' },
  { name: 'Teal', value: 'hsl(175, 70%, 42%)', hex: '#0d9488' },
  { name: 'Orange', value: 'hsl(28, 90%, 55%)', hex: '#f97316' },
  { name: 'Pink', value: 'hsl(330, 75%, 58%)', hex: '#ec4899' },
  { name: 'Green', value: 'hsl(145, 60%, 42%)', hex: '#22c55e' },
  { name: 'Gold', value: 'hsl(43, 90%, 50%)', hex: '#eab308' },
]

const fonts = [
  { label: 'Poppins (Default)', value: 'Poppins' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Nunito', value: 'Nunito' },
  { label: 'DM Sans', value: 'DM Sans' },
  { label: 'Raleway', value: 'Raleway' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'System UI', value: 'system-ui, sans-serif' },
]

const radii = [
  { label: 'Square', value: '0' },
  { label: 'Soft', value: '0.5rem' },
  { label: 'Round', value: '1rem' },
  { label: 'Pill', value: '2rem' },
]

const cardStyles = [
  { label: 'Glass', value: 'glass' },
  { label: 'Solid', value: 'solid' },
  { label: 'Outline', value: 'outline' },
  { label: 'Minimal', value: 'minimal' },
]

const navStyles = [
  { label: 'Floating', value: 'floating' },
  { label: 'Full-width', value: 'fullwidth' },
  { label: 'Sticky', value: 'sticky' },
]

const heroLayouts = [
  { label: 'Centered', value: 'centered' },
  { label: 'Left', value: 'left' },
  { label: 'Split', value: 'split' },
]

const footerStyles = [
  { label: 'Minimal', value: 'minimal' },
  { label: 'Wide', value: 'wide' },
  { label: 'Dark', value: 'dark' },
]

function apiFetch(path, opts = {}) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, ...(opts.headers || {}) },
  }).then(r => r.json())
}

async function load() {
  loading.value = true
  try {
    const s = await apiFetch('/settings')
    siteName.value = s.site_name || 'My Store'
    // Map settings to form
    Object.keys(form).forEach(key => {
      if (key.endsWith('_hex')) return
      const val = s[key] ?? s[key.replace('_color', '_color')]
      if (val !== undefined) form[key] = val
    })
    // Convert boolean strings
    form.theme_show_excerpt = s.theme_show_excerpt === '1' || s.theme_show_excerpt === true
    form.theme_show_atc = s.theme_show_atc !== '0' && s.theme_show_atc !== false
    form.theme_show_social = s.theme_show_social === '1' || s.theme_show_social === true
    form.theme_products_per_row = parseInt(s.theme_products_per_row || 3)
    form.custom_css = s.custom_css || ''
    // Sync hex values
    syncHexFromHsl('accent_color', 'accent_color_hex')
    syncHexFromHsl('bg_color', 'bg_color_hex')
    syncHexFromHsl('surface_color', 'surface_color_hex')
  } finally { loading.value = false }
}

function syncAccentFromHex() { form.accent_color = form.accent_color_hex }
function syncBgFromHex() { form.bg_color = form.bg_color_hex }
function syncSurfaceFromHex() { form.surface_color = form.surface_color_hex }

function syncHexFromHsl(field, hexField) {
  // If value looks like a hex, use as-is; otherwise leave default hex
  if (/^#[0-9a-f]{3,6}$/i.test(form[field])) { form[hexField] = form[field] }
}

function applyPreset(p) {
  form.accent_color = p.value
  form.accent_color_hex = p.hex
}

const previewStyles = computed(() => ({
  background: form.bg_color,
  fontFamily: form.theme_font + ', sans-serif',
  fontSize: form.theme_font_size,
}))

const btnStyle = computed(() => ({
  background: form.accent_color,
  color: '#fff',
  borderRadius: form.theme_button_radius,
  border: 'none',
  padding: '.3rem .8rem',
  cursor: 'pointer',
  fontFamily: form.theme_font,
  fontSize: '.75rem',
  fontWeight: '600',
}))

const navPreviewStyle = computed(() => ({
  background: form.theme_nav_style === 'floating'
    ? 'rgba(255,255,255,.08)'
    : form.surface_color,
  borderRadius: form.theme_nav_style === 'floating' ? '.75rem' : '0',
  backdropFilter: form.theme_nav_style === 'floating' ? 'blur(16px)' : 'none',
}))

const cardStyle = computed(() => ({
  background: form.theme_card_style === 'glass'
    ? 'rgba(255,255,255,.06)'
    : form.theme_card_style === 'solid'
    ? form.surface_color
    : 'transparent',
  border: form.theme_card_style === 'outline'
    ? `1px solid ${form.accent_color}`
    : '1px solid rgba(255,255,255,.1)',
  borderRadius: form.theme_button_radius === '2rem' ? '1rem' : form.theme_button_radius,
  backdropFilter: form.theme_card_style === 'glass' ? 'blur(8px)' : 'none',
}))

const footerStyle = computed(() => ({
  background: form.theme_footer_style === 'dark'
    ? 'rgba(0,0,0,.3)'
    : 'transparent',
  borderTop: `1px solid rgba(255,255,255,.08)`,
}))

async function save() {
  saving.value = true
  try {
    const payload = {
      accent_color: form.accent_color,
      bg_color: form.bg_color,
      surface_color: form.surface_color,
      theme_font: form.theme_font,
      theme_font_size: form.theme_font_size,
      theme_button_radius: form.theme_button_radius,
      theme_card_style: form.theme_card_style,
      theme_nav_style: form.theme_nav_style,
      theme_hero_layout: form.theme_hero_layout,
      theme_products_per_row: form.theme_products_per_row,
      theme_show_excerpt: form.theme_show_excerpt ? '1' : '0',
      theme_show_atc: form.theme_show_atc ? '1' : '0',
      theme_footer_style: form.theme_footer_style,
      theme_show_social: form.theme_show_social ? '1' : '0',
      custom_css: form.custom_css,
    }
    await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(payload) })
    showToast('✓ Storefront settings saved!')
  } catch { showToast('⚠️ Error saving settings') }
  finally { saving.value = false }
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 3000)
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
.page-header h1 { font-size: 1.75rem; margin: 0 0 .25rem; }
.subtitle { color: var(--muted, #888); margin: 0; font-size: .9rem; }

.customizer-layout { display: grid; grid-template-columns: 360px 1fr; gap: 1.5rem; align-items: start; }
@media (max-width: 1100px) { .customizer-layout { grid-template-columns: 1fr; } }

/* Controls */
.controls-panel { display: flex; flex-direction: column; gap: 1rem; }
.section { background: rgba(255,255,255,.04); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); padding: 1.25rem; }
.section-title { margin: 0 0 1rem; font-size: .95rem; font-weight: 700; }
.field { margin-bottom: 1rem; }
.field:last-child { margin-bottom: 0; }
.field label { display: block; font-size: .82rem; color: #aaa; margin-bottom: .35rem; }

.input { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); border-radius: .5rem; padding: .45rem .75rem; color: inherit; font-size: .9rem; width: 100%; }
.input-sm { width: auto; padding: .35rem .65rem; font-size: .85rem; }
.code-area { font-family: 'Monaco', 'Menlo', monospace; font-size: .8rem; resize: vertical; }

.color-row { display: flex; gap: .5rem; align-items: center; }
.color-swatch { width: 36px; height: 36px; border-radius: .5rem; border: 1px solid rgba(255,255,255,.15); cursor: pointer; padding: 2px; background: transparent; }
.color-presets { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .5rem; }
.preset-dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform .15s; }
.preset-dot:hover { transform: scale(1.2); border-color: rgba(255,255,255,.3); }

.toggle-group { display: flex; gap: .25rem; flex-wrap: wrap; }
.toggle-btn { padding: .3rem .75rem; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .5rem; color: #aaa; cursor: pointer; font-size: .82rem; transition: all .2s; }
.toggle-btn.active { background: hsl(355,70%,58%); border-color: transparent; color: #fff; }

.toggle-switch { display: inline-flex; align-items: center; cursor: pointer; }
.toggle-switch input { display: none; }
.slider { width: 40px; height: 22px; background: rgba(255,255,255,.1); border-radius: 11px; position: relative; transition: background .2s; }
.slider::after { content: ''; position: absolute; width: 16px; height: 16px; background: #fff; border-radius: 50%; top: 3px; left: 3px; transition: transform .2s; }
.toggle-switch input:checked + .slider { background: hsl(355,70%,58%); }
.toggle-switch input:checked + .slider::after { transform: translateX(18px); }

/* Buttons */
.btn { padding: .5rem 1.1rem; border-radius: .6rem; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); cursor: pointer; color: inherit; font-size: .88rem; text-decoration: none; display: inline-flex; align-items: center; gap: .4rem; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-primary { background: hsl(355,70%,58%); border-color: transparent; color: #fff; }
.btn-ghost { background: transparent; color: #aaa; }

/* Preview Panel */
.preview-panel { background: rgba(255,255,255,.04); border-radius: 1rem; border: 1px solid rgba(255,255,255,.08); padding: 1rem; position: sticky; top: 1.5rem; }
.preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.preview-device { padding: .25rem .5rem; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: .4rem; cursor: pointer; font-size: .9rem; transition: all .2s; }
.preview-device.active { background: rgba(255,255,255,.15); }

.preview-frame-wrap { border-radius: .75rem; overflow: hidden; border: 1px solid rgba(255,255,255,.1); }
.preview-frame-wrap.mobile { max-width: 375px; margin: 0 auto; }
.preview-frame { overflow: hidden; min-height: 400px; }

/* Preview elements */
.pv-nav { display: flex; align-items: center; justify-content: space-between; padding: .5rem 1rem; margin: .5rem; }
.pv-logo { font-weight: 700; font-size: .85rem; color: #fff; }
.pv-nav-links { display: flex; gap: 1rem; font-size: .72rem; color: rgba(255,255,255,.65); }

.pv-hero { padding: 2rem 1rem; display: flex; align-items: center; justify-content: center; min-height: 120px; background: linear-gradient(135deg, rgba(255,255,255,.05), transparent); margin: 0 .5rem .5rem; border-radius: .5rem; }
.pv-hero.hero-left { justify-content: flex-start; padding: 2rem 1.5rem; }
.pv-hero-content { text-align: center; }
.hero-left .pv-hero-content { text-align: left; }

.pv-products { display: grid; gap: .5rem; padding: .5rem; }
.pv-card { overflow: hidden; }
.pv-card-img { background: rgba(255,255,255,.06); height: 60px; }
.pv-card-body { padding: .5rem; }
.pv-card-name { font-size: .72rem; font-weight: 600; color: #e0e0e0; margin-bottom: .2rem; }
.pv-card-price { font-size: .72rem; font-weight: 700; margin-bottom: .2rem; }
.pv-card-excerpt { font-size: .65rem; color: #888; margin: .2rem 0; }
.pv-btn { cursor: default !important; }
.pv-btn-sm { padding: .2rem .5rem !important; font-size: .65rem !important; margin-top: .25rem; }

.pv-footer { padding: .5rem 1rem; text-align: center; font-size: .7rem; color: rgba(255,255,255,.5); }

.loading-bar { height: 3px; background: linear-gradient(90deg, transparent, hsl(355,70%,58%), transparent); animation: shimmer 1.5s infinite; border-radius: 2px; }
@keyframes shimmer { 0%,100% { opacity:.3; } 50% { opacity:1; } }

.toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: .75rem 1.25rem; border-radius: .75rem; background: hsl(228,4%,20%); border: 1px solid rgba(255,255,255,.12); color: #fff; font-size: .9rem; z-index: 9999; animation: fadeIn .2s ease; }
@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
</style>
