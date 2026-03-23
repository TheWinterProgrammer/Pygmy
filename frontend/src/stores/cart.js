// Pygmy CMS — Cart store (Pinia + localStorage)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api.js'

const STORAGE_KEY = 'pygmy_cart'
const SESSION_KEY  = 'pygmy_cart_session'

// Stable session ID per browser session (persisted across page loads)
function getOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export const useCartStore = defineStore('cart', () => {
  // Load persisted cart from localStorage
  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  const items = ref(loadPersisted())
  const isOpen = ref(false)
  const sessionId = getOrCreateSessionId()

  // Persist on every change
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
    } catch {}
  }

  // Track abandoned cart (fire-and-forget, silent failure)
  let trackTimer = null
  function scheduleTrack(email = '', name = '') {
    clearTimeout(trackTimer)
    trackTimer = setTimeout(() => {
      if (!items.value.length) return
      api.post('/abandoned-carts/track', {
        session_id: sessionId,
        email,
        name,
        items: items.value,
        subtotal: subtotal.value,
      }).catch(() => {})
    }, 2000) // debounce 2s
  }

  function markRecovered() {
    api.post('/abandoned-carts/recover', { session_id: sessionId }).catch(() => {})
  }

  // ── Saved Cart (server-side, for logged-in customers) ──────────────────────

  let saveTimer = null
  /** Save current cart to server (debounced, only when logged in) */
  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        // Dynamically import to avoid circular dep at module load time
        import('./customer.js').then(({ useCustomerStore }) => {
          const customer = useCustomerStore()
          if (!customer.isLoggedIn) return
          api.put('/saved-carts/me', { items: items.value }, {
            headers: { Authorization: `Bearer ${customer.token}` }
          }).catch(() => {})
        }).catch(() => {})
      } catch {}
    }, 3000)
  }

  /** Load saved cart from server for logged-in customer */
  async function loadSavedCart() {
    try {
      const { useCustomerStore } = await import('./customer.js')
      const customer = useCustomerStore()
      if (!customer.isLoggedIn) return null
      const res = await api.get('/saved-carts/me', {
        headers: { Authorization: `Bearer ${customer.token}` }
      })
      return res.data // { items, subtotal, updated_at }
    } catch {
      return null
    }
  }

  /** Restore saved cart (merge or replace) */
  async function restoreSavedCart(mode = 'merge') {
    const saved = await loadSavedCart()
    if (!saved?.items?.length) return false
    if (mode === 'replace') {
      items.value = saved.items
    } else {
      // merge: add saved items that aren't already in cart
      for (const si of saved.items) {
        const exists = items.value.find(i => i.cart_key === si.cart_key)
        if (!exists) items.value.push(si)
      }
    }
    persist()
    return true
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))

  const subtotal = computed(() =>
    items.value.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  )

  // ── Actions ────────────────────────────────────────────────────────────────

  // cartKey: unique key per product+variant combo (e.g. "42" or "42:Color:Red")
  function makeKey(productId, variantKey = null) {
    return variantKey ? `${productId}:${variantKey}` : String(productId)
  }

  /**
   * addItem(product, quantity, variantInfo?)
   * variantInfo: { key: "Color:Red", label: "Color: Red", price_adj: 0 }
   */
  function addItem(product, quantity = 1, variantInfo = null) {
    const cartKey = makeKey(product.id, variantInfo?.key)
    const existing = items.value.find(i => i.cart_key === cartKey)
    const basePrice = product.sale_price ?? product.price ?? 0
    const unitPrice = basePrice + (variantInfo?.price_adj || 0)

    if (existing) {
      existing.quantity += quantity
    } else {
      items.value.push({
        cart_key:     cartKey,
        product_id:   product.id,
        name:         product.name,
        slug:         product.slug,
        cover_image:  product.cover_image || null,
        unit_price:   unitPrice,
        quantity,
        variant_key:   variantInfo?.key   || null,
        variant_label: variantInfo?.label || null,
      })
    }
    persist()
    scheduleTrack()
    scheduleSave()
  }

  function removeItem(cartKey) {
    items.value = items.value.filter(i => (i.cart_key || String(i.product_id)) !== cartKey)
    persist()
    scheduleTrack()
    scheduleSave()
  }

  function updateQuantity(cartKey, quantity) {
    if (quantity < 1) return removeItem(cartKey)
    const item = items.value.find(i => (i.cart_key || String(i.product_id)) === cartKey)
    if (item) {
      item.quantity = quantity
      persist()
      scheduleTrack()
      scheduleSave()
    }
  }

  function clear() {
    items.value = []
    persist()
  }

  /** Call when the customer enters their email on checkout (enriches abandoned cart record) */
  function updateContactInfo(email, name) {
    scheduleTrack(email, name)
  }

  function open()  { isOpen.value = true }
  function close() { isOpen.value = false }
  function toggle() { isOpen.value = !isOpen.value }

  return {
    items, count, subtotal, isOpen, sessionId,
    addItem, removeItem, updateQuantity, clear,
    open, close, toggle,
    updateContactInfo, markRecovered,
    loadSavedCart, restoreSavedCart, scheduleSave,
  }
})
