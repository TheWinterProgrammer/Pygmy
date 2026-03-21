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
  }

  function removeItem(cartKey) {
    items.value = items.value.filter(i => (i.cart_key || String(i.product_id)) !== cartKey)
    persist()
  }

  function updateQuantity(cartKey, quantity) {
    if (quantity < 1) return removeItem(cartKey)
    const item = items.value.find(i => (i.cart_key || String(i.product_id)) === cartKey)
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
