// Pygmy Admin — API client
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('pygmy_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, redirect to login
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pygmy_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
