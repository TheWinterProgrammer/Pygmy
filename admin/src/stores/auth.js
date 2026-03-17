import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api.js'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('pygmy_token') || '')
  const user = ref(null)

  const isLoggedIn = computed(() => !!token.value)

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('pygmy_token', data.token)
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      const { data } = await api.get('/auth/me')
      user.value = data
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('pygmy_token')
  }

  return { token, user, isLoggedIn, login, fetchMe, logout }
})
