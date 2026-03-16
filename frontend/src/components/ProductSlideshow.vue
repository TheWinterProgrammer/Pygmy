<template>
  <div class="slideshow" @keydown.left="store.prev()" @keydown.right="store.next()" tabindex="0" ref="slideshowEl">

    <!-- Background blur layer -->
    <div class="slideshow-bg" :style="{ backgroundImage: `url(${store.activeProduct?.imageUrl})` }"></div>

    <!-- Main image with Vue transition -->
    <div class="slideshow-stage">
      <Transition :name="transitionName" mode="out-in">
        <div class="product-card" :key="store.activeIndex">
          <img
            class="product-image"
            :src="store.activeProduct?.imageUrl"
            :alt="store.activeProduct?.name"
            draggable="false"
          />
        </div>
      </Transition>
    </div>

    <!-- Product info -->
    <Transition name="fade" mode="out-in">
      <div class="product-info" :key="store.activeIndex">
        <p class="product-counter">{{ store.activeIndex + 1 }} / {{ store.total }}</p>
        <h2 class="product-name">{{ store.activeProduct?.name }}</h2>
        <p v-if="store.activeProduct?.description" class="product-desc">
          {{ store.activeProduct.description }}
        </p>
      </div>
    </Transition>

    <!-- Arrow controls -->
    <button class="arrow arrow-left" @click="clickPrev" aria-label="Previous">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
    <button class="arrow arrow-right" @click="clickNext" aria-label="Next">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>

    <!-- Dot navigation -->
    <div class="dots">
      <button
        v-for="(_, i) in store.products"
        :key="i"
        class="dot"
        :class="{ active: i === store.activeIndex }"
        @click="store.goTo(i)"
        :aria-label="`Product ${i + 1}`"
      />
    </div>

    <!-- Thumbnail strip -->
    <div class="thumbnails" v-if="store.total > 1">
      <button
        v-for="(product, i) in store.products"
        :key="product.id"
        class="thumb"
        :class="{ active: i === store.activeIndex }"
        @click="store.goTo(i)"
      >
        <img :src="product.imageUrl" :alt="product.name" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useProductStore } from '../stores/products.js'

const store = useProductStore()
const slideshowEl = ref(null)
const transitionName = ref('slide-left')

function clickNext() {
  transitionName.value = 'slide-left'
  store.next()
}

function clickPrev() {
  transitionName.value = 'slide-right'
  store.prev()
}

onMounted(() => slideshowEl.value?.focus())
</script>
