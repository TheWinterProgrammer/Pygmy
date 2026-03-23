// Pygmy CMS — Product Compare Store (Phase 37)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCompareStore = defineStore('compare', () => {
  const items = ref([])
  const MAX = 4

  const count    = computed(() => items.value.length)
  const isFull   = computed(() => items.value.length >= MAX)
  const isOpen   = ref(false)

  function toggle(product) {
    const idx = items.value.findIndex(p => p.id === product.id)
    if (idx >= 0) {
      items.value.splice(idx, 1)
    } else if (!isFull.value) {
      items.value.push(product)
    }
  }

  function isAdded(id) {
    return items.value.some(p => p.id === id)
  }

  function remove(id) {
    items.value = items.value.filter(p => p.id !== id)
  }

  function clear() {
    items.value = []
    isOpen.value = false
  }

  function openDrawer()  { if (items.value.length) isOpen.value = true }
  function closeDrawer() { isOpen.value = false }

  return { items, count, isFull, isOpen, toggle, isAdded, remove, clear, openDrawer, closeDrawer }
}, { persist: false })
