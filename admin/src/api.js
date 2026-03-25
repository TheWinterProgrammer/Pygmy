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

// Composable wrapper for views that use { get, post, put, del } pattern
export function useApi() {
  return {
    get:    (url, config) => api.get(url, config),
    post:   (url, data, config) => api.post(url, data, config),
    put:    (url, data, config) => api.put(url, data, config),
    patch:  (url, data, config) => api.patch(url, data, config),
    del:    (url, config) => api.delete(url, config),
    delete: (url, config) => api.delete(url, config),
  }
}
