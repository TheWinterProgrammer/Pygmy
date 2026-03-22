<template>
  <div v-if="sale" class="flash-sale-banner">
    <div class="flash-content">
      <span class="flash-label">⚡ {{ sale.badge_label || 'Flash Sale' }}</span>
      <span class="flash-desc" v-if="sale.description">{{ sale.description }}</span>
      <div v-if="sale.show_countdown && sale.ends_at" class="countdown">
        <span class="countdown-label">Ends in:</span>
        <div class="countdown-segments">
          <div class="seg">
            <span class="seg-num">{{ pad(timeLeft.h) }}</span>
            <span class="seg-label">h</span>
          </div>
          <span class="seg-sep">:</span>
          <div class="seg">
            <span class="seg-num">{{ pad(timeLeft.m) }}</span>
            <span class="seg-label">m</span>
          </div>
          <span class="seg-sep">:</span>
          <div class="seg">
            <span class="seg-num">{{ pad(timeLeft.s) }}</span>
            <span class="seg-label">s</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import api from '../api.js'

const sale = ref(null)
const timeLeft = reactive({ h: 0, m: 0, s: 0 })
let timer = null

onMounted(async () => {
  try {
    const r = await api.get('/flash-sales/current')
    if (!r.data) return
    sale.value = r.data
    if (r.data.ends_at) startCountdown(r.data.ends_at)
  } catch {}
})

onUnmounted(() => { if (timer) clearInterval(timer) })

function startCountdown(endsAt) {
  function tick() {
    const diff = new Date(endsAt) - new Date()
    if (diff <= 0) {
      sale.value = null
      clearInterval(timer)
      return
    }
    const totalSec = Math.floor(diff / 1000)
    timeLeft.h = Math.floor(totalSec / 3600)
    timeLeft.m = Math.floor((totalSec % 3600) / 60)
    timeLeft.s = totalSec % 60
  }
  tick()
  timer = setInterval(tick, 1000)
}

function pad(n) { return String(n).padStart(2, '0') }
</script>

<style scoped>
.flash-sale-banner {
  background: linear-gradient(135deg, hsl(355,70%,30%), hsl(355,70%,20%));
  border: 1px solid hsl(355,70%,40%);
  border-radius: 1rem;
  padding: 1rem 1.5rem;
  margin: 0 0 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.flash-content {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
  flex: 1;
}
.flash-label {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: .05em;
  background: hsl(355,70%,50%);
  padding: .25rem .75rem;
  border-radius: .5rem;
  white-space: nowrap;
}
.flash-desc {
  color: hsl(355,50%,80%);
  font-size: .9rem;
}
.countdown {
  display: flex;
  align-items: center;
  gap: .6rem;
  margin-left: auto;
}
.countdown-label {
  font-size: .8rem;
  color: hsl(355,50%,75%);
  font-weight: 600;
}
.countdown-segments {
  display: flex;
  align-items: center;
  gap: .2rem;
}
.seg {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0,0,0,.35);
  border-radius: .5rem;
  padding: .25rem .5rem;
  min-width: 42px;
}
.seg-num {
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.seg-label {
  font-size: .65rem;
  color: hsl(355,50%,70%);
  text-transform: uppercase;
}
.seg-sep {
  font-size: 1.3rem;
  font-weight: 800;
  color: hsl(355,50%,70%);
  line-height: 1;
  padding-bottom: .25rem;
}
</style>
