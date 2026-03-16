<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <div class="logo">Pygmy<span class="logo-dot">.</span></div>
        <nav class="nav">
          <button class="btn-upload" @click="showUpload = !showUpload">
            + Add Products
          </button>
        </nav>
      </div>
    </header>

    <!-- Upload panel -->
    <Transition name="slide-down">
      <UploadPanel v-if="showUpload" @close="showUpload = false" />
    </Transition>

    <!-- Main showcase -->
    <main class="main">
      <div v-if="store.loading" class="state-msg">Loading products…</div>
      <div v-else-if="store.total === 0" class="state-empty">
        <div class="empty-icon">📦</div>
        <h2>No products yet</h2>
        <p>Click <strong>+ Add Products</strong> to upload your studio images.</p>
      </div>
      <ProductSlideshow v-else />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useProductStore } from './stores/products.js'
import ProductSlideshow from './components/ProductSlideshow.vue'
import UploadPanel from './components/UploadPanel.vue'

const store = useProductStore()
const showUpload = ref(false)

onMounted(() => store.fetchProducts())
</script>
