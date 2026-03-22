<template>
  <Transition name="bar-slide">
    <div
      v-if="bar && !dismissed"
      class="announcement-bar"
      :class="`position-${bar.position}`"
      :style="{ background: bar.bg_color, color: bar.text_color }"
    >
      <div class="bar-content">
        <span class="bar-message">{{ bar.message }}</span>
        <a
          v-if="bar.link_url"
          :href="bar.link_url"
          class="bar-link"
          :style="{ color: bar.text_color }"
        >{{ bar.link_label || 'Learn more →' }}</a>
      </div>
      <button
        v-if="bar.dismissable"
        class="bar-close"
        :style="{ color: bar.text_color }"
        @click="dismiss"
        aria-label="Close"
      >✕</button>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const bar = ref(null)
const dismissed = ref(false)

const STORAGE_KEY = 'pygmy_bar_dismissed'

onMounted(async () => {
  try {
    const r = await api.get('/announcement-bars/live')
    if (!r.data) return
    bar.value = r.data

    // Check if dismissed
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored === String(r.data.id)) {
      dismissed.value = true
    }
  } catch {
    // silently fail — non-critical
  }
})

function dismiss() {
  dismissed.value = true
  if (bar.value?.id) {
    sessionStorage.setItem(STORAGE_KEY, String(bar.value.id))
  }
}
</script>

<style scoped>
.announcement-bar {
  width: 100%;
  padding: .6rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .88rem;
  font-weight: 500;
  position: relative;
  z-index: 200;
  gap: 1rem;
  min-height: 38px;
}
.announcement-bar.position-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 900;
}
.bar-content {
  display: flex;
  align-items: center;
  gap: .75rem;
  flex-wrap: wrap;
  justify-content: center;
}
.bar-message {
  line-height: 1.4;
}
.bar-link {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}
.bar-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  opacity: .7;
  padding: .1rem .3rem;
  line-height: 1;
  position: absolute;
  right: .75rem;
  top: 50%;
  transform: translateY(-50%);
}
.bar-close:hover { opacity: 1; }

.bar-slide-enter-active, .bar-slide-leave-active { transition: all .3s ease; }
.bar-slide-enter-from, .bar-slide-leave-to { opacity: 0; max-height: 0; padding: 0; min-height: 0; }
</style>
