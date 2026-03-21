// Pygmy CMS — Customer Account Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const BASE = '/api/customers'

export const useCustomerStore = defineStore('customer', () => {
  const token = ref(localStorage.getItem('customer_token') || null)
  const customer = ref(JSON.parse(localStorage.getItem('customer_user') || 'null'))

  const isLoggedIn = computed(() => !!token.value && !!customer.value)

  function persist() {
    if (token.value) localStorage.setItem('customer_token', token.value)
    else localStorage.removeItem('customer_token')
    if (customer.value) localStorage.setItem('customer_user', JSON.stringify(customer.value))
    else localStorage.removeItem('customer_user')
  }

  function authHeaders() {
    return { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' }
  }

  async function register(payload) {
    const res = await fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    token.value = data.token
    customer.value = data.customer
    persist()
    return data
  }

  async function login(email, password) {
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    token.value = data.token
    customer.value = data.customer
    persist()
    return data
  }

  async function fetchMe() {
    if (!token.value) return null
    const res = await fetch(`${BASE}/me`, { headers: authHeaders() })
    if (!res.ok) { logout(); return null }
    customer.value = await res.json()
    persist()
    return customer.value
  }

  async function updateMe(payload) {
    const res = await fetch(`${BASE}/me`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Update failed')
    customer.value = data
    persist()
    return data
  }

  async function fetchOrders() {
    const res = await fetch(`${BASE}/me/orders`, { headers: authHeaders() })
    if (!res.ok) return []
    return res.json()
  }

  async function fetchOrder(orderNumber) {
    const res = await fetch(`${BASE}/me/orders/${orderNumber}`, { headers: authHeaders() })
    if (!res.ok) return null
    return res.json()
  }

  async function fetchAddresses() {
    const res = await fetch(`${BASE}/me/addresses`, { headers: authHeaders() })
    if (!res.ok) return []
    return res.json()
  }

  async function addAddress(payload) {
    const res = await fetch(`${BASE}/me/addresses`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save address')
    return data
  }

  async function updateAddress(id, payload) {
    const res = await fetch(`${BASE}/me/addresses/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to update address')
    return data
  }

  async function deleteAddress(id) {
    await fetch(`${BASE}/me/addresses/${id}`, { method: 'DELETE', headers: authHeaders() })
  }

  function logout() {
    token.value = null
    customer.value = null
    persist()
  }

  return {
    token, customer, isLoggedIn,
    register, login, fetchMe, updateMe, logout,
    fetchOrders, fetchOrder, fetchAddresses, addAddress, updateAddress, deleteAddress,
    authHeaders,
  }
})
