// Pygmy CMS — Wishlist store (Pinia + localStorage)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'pygmy_wishlist'

export const useWishlistStore = defineStore('wishlist', () => {
  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  const items = ref(loadPersisted())

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
    } catch {}
  }

  const count = computed(() => items.value.length)

  function isWishlisted(productId) {
    return items.value.some(i => i.id === productId)
  }

  function toggle(product) {
    const idx = items.value.findIndex(i => i.id === product.id)
    if (idx >= 0) {
      items.value.splice(idx, 1)
    } else {
      items.value.push({
        id:          product.id,
        name:        product.name,
        slug:        product.slug,
        cover_image: product.cover_image || null,
        price:       product.price,
        sale_price:  product.sale_price || null,
        excerpt:     product.excerpt || '',
        added_at:    new Date().toISOString(),
      })
    }
    persist()
  }

  function remove(productId) {
    items.value = items.value.filter(i => i.id !== productId)
    persist()
  }

  function clear() {
    items.value = []
    persist()
  }

  return { items, count, isWishlisted, toggle, remove, clear }
})
