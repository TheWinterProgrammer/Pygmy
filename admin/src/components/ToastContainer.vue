<template>
  <TransitionGroup name="toast" tag="div" class="toast-wrap">
    <div
      v-for="t in toast.toasts"
      :key="t.id"
      class="toast"
      :class="`toast-${t.type}`"
    >
      {{ t.message }}
    </div>
  </TransitionGroup>
</template>

<script setup>
import { useToastStore } from '../stores/toast.js'
const toast = useToastStore()
</script>

<style scoped>
.toast-wrap {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { opacity: 0; transform: translateY(1rem); }
.toast-leave-to   { opacity: 0; transform: translateX(2rem); }
</style>
