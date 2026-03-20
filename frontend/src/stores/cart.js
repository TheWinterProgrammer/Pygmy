// Pygmy CMS — Cart store (Pinia + localStorage)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'pygmy_cart'

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

  // Persist on every change
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
    } catch {}
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))

  const subtotal = computed(() =>
    items.value.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  )

  // ── Actions ────────────────────────────────────────────────────────────────

  function addItem(product, quantity = 1) {
    const existing = items.value.find(i => i.product_id === product.id)
    if (existing) {
      existing.quantity += quantity
    } else {
      items.value.push({
        product_id:  product.id,
        name:        product.name,
        slug:        product.slug,
        cover_image: product.cover_image || null,
        unit_price:  product.sale_price ?? product.price ?? 0,
        quantity,
      })
    }
    persist()
  }

  function removeItem(productId) {
    items.value = items.value.filter(i => i.product_id !== productId)
    persist()
  }

  function updateQuantity(productId, quantity) {
    if (quantity < 1) return removeItem(productId)
    const item = items.value.find(i => i.product_id === productId)
    if (item) {
      item.quantity = quantity
      persist()
    }
  }

  function clear() {
    items.value = []
    persist()
  }

  function open()  { isOpen.value = true }
  function close() { isOpen.value = false }
  function toggle() { isOpen.value = !isOpen.value }

  return { items, count, subtotal, isOpen, addItem, removeItem, updateQuantity, clear, open, close, toggle }
})
