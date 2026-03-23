import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api.js'

export const useSiteStore = defineStore('site', () => {
  const settings = ref({})
  const navigation = ref([])
  const loaded = ref(false)
  const maintenance = ref(false)
  const maintenanceMessage = ref('')

  async function load() {
    if (loaded.value) return
    try {
      const [settingsRes, navRes] = await Promise.all([
        api.get('/settings'),
        api.get('/navigation')
      ])
      settings.value = settingsRes.data
      navigation.value = navRes.data
      // Apply dynamic accent color from settings
      if (settingsRes.data.accent_color) {
        document.documentElement.style.setProperty('--accent', settingsRes.data.accent_color)
      }
      // Update page title
      if (settingsRes.data.site_name) {
        document.title = settingsRes.data.site_name
      }
      // Inject custom header scripts (once, idempotent)
      if (settingsRes.data.header_scripts && !document.getElementById('pygmy-header-scripts')) {
        const el = document.createElement('div')
        el.id = 'pygmy-header-scripts'
        el.innerHTML = settingsRes.data.header_scripts
        // Move child nodes into <head>
        Array.from(el.childNodes).forEach(node => document.head.appendChild(node.cloneNode(true)))
      }
      // Inject custom footer scripts (once, idempotent)
      if (settingsRes.data.footer_scripts && !document.getElementById('pygmy-footer-scripts')) {
        const el = document.createElement('div')
        el.id = 'pygmy-footer-scripts'
        el.innerHTML = settingsRes.data.footer_scripts
        document.body.appendChild(el)
      }
      // Inject dynamic theme CSS (accent color, bg, surface, font, etc.)
      {
        const s = settingsRes.data
        let themeVars = ':root {'
        if (s.accent_color) themeVars += `--accent:${s.accent_color};`
        if (s.bg_color) themeVars += `--bg:${s.bg_color};`
        if (s.surface_color) themeVars += `--surface:${s.surface_color};`
        if (s.theme_button_radius) themeVars += `--btn-radius:${s.theme_button_radius};`
        if (s.theme_font_size) themeVars += `font-size:${s.theme_font_size};`
        themeVars += '}'
        // Google Font import if custom
        if (s.theme_font && s.theme_font !== 'Poppins' && !s.theme_font.includes('system')) {
          const fontSlug = s.theme_font.replace(/ /g, '+')
          themeVars = `@import url('https://fonts.googleapis.com/css2?family=${fontSlug}:wght@400;500;600;700&display=swap');` + themeVars
          themeVars += `body { font-family: '${s.theme_font}', sans-serif; }`
        }
        // Append custom CSS
        if (s.custom_css) themeVars += '\n' + s.custom_css

        let styleEl = document.getElementById('pygmy-theme-css')
        if (!styleEl) {
          styleEl = document.createElement('style')
          styleEl.id = 'pygmy-theme-css'
          document.head.appendChild(styleEl)
        }
        styleEl.textContent = themeVars
      }
    } catch (e) {
      // If the API responds with a 503 maintenance error, show maintenance mode
      if (e?.response?.status === 503 || e?.response?.data?.error === 'maintenance') {
        maintenance.value = true
        maintenanceMessage.value = e?.response?.data?.message || 'The site is currently under maintenance.'
      }
    } finally {
      loaded.value = true
    }
  }

  return { settings, navigation, loaded, maintenance, maintenanceMessage, load }
})
