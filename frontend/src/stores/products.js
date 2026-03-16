import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useProductStore = defineStore('products', () => {
  const products = ref([])
  const loading = ref(false)
  const error = ref(null)
  const activeIndex = ref(0)

  const activeProduct = computed(() => products.value[activeIndex.value] || null)
  const total = computed(() => products.value.length)

  async function fetchProducts() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/products')
      products.value = await res.json()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  function next() {
    if (products.value.length === 0) return
    activeIndex.value = (activeIndex.value + 1) % products.value.length
  }

  function prev() {
    if (products.value.length === 0) return
    activeIndex.value = (activeIndex.value - 1 + products.value.length) % products.value.length
  }

  function goTo(index) {
    activeIndex.value = Math.max(0, Math.min(index, products.value.length - 1))
  }

  async function uploadProduct(formData) {
    const res = await fetch('/api/products', { method: 'POST', body: formData })
    if (!res.ok) throw new Error('Upload failed')
    const product = await res.json()
    products.value.push(product)
    activeIndex.value = products.value.length - 1
    return product
  }

  async function bulkUpload(files, names = []) {
    const formData = new FormData()
    files.forEach(f => formData.append('images', f))
    if (names.length) formData.append('names', JSON.stringify(names))
    const res = await fetch('/api/products/bulk', { method: 'POST', body: formData })
    if (!res.ok) throw new Error('Bulk upload failed')
    const newProducts = await res.json()
    products.value.push(...newProducts)
    return newProducts
  }

  async function deleteProduct(id) {
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    const idx = products.value.findIndex(p => p.id === id)
    products.value.splice(idx, 1)
    if (activeIndex.value >= products.value.length) {
      activeIndex.value = Math.max(0, products.value.length - 1)
    }
  }

  return {
    products, loading, error, activeIndex, activeProduct, total,
    fetchProducts, next, prev, goTo, uploadProduct, bulkUpload, deleteProduct
  }
})
