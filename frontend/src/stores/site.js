import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api.js'

export const useSiteStore = defineStore('site', () => {
  const settings = ref({})
  const navigation = ref([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
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
    loaded.value = true
  }

  return { settings, navigation, loaded, load }
})
