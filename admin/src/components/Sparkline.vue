<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="sparkline"
    aria-hidden="true"
  >
    <!-- Area fill -->
    <path v-if="areaPath" :d="areaPath" :fill="fill" opacity="0.18" />
    <!-- Line -->
    <path v-if="linePath" :d="linePath" :stroke="color" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Dot at last point -->
    <circle
      v-if="lastPoint"
      :cx="lastPoint.x"
      :cy="lastPoint.y"
      r="2.2"
      :fill="color"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data:   { type: Array, default: () => [] },  // array of numbers
  width:  { type: Number, default: 80 },
  height: { type: Number, default: 28 },
  color:  { type: String, default: 'hsl(355,70%,58%)' },
  fill:   { type: String, default: 'hsl(355,70%,58%)' },
})

const points = computed(() => {
  const d = props.data
  if (!d || d.length < 2) return []
  const min = Math.min(...d)
  const max = Math.max(...d)
  const range = max - min || 1
  const pad = 3
  return d.map((v, i) => ({
    x: pad + (i / (d.length - 1)) * (props.width - pad * 2),
    y: pad + (1 - (v - min) / range) * (props.height - pad * 2),
  }))
})

function smooth(pts) {
  if (!pts.length) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const cx = (prev.x + curr.x) / 2
    d += ` C ${cx} ${prev.y} ${cx} ${curr.y} ${curr.x} ${curr.y}`
  }
  return d
}

const linePath = computed(() => smooth(points.value))

const areaPath = computed(() => {
  const pts = points.value
  if (!pts.length) return ''
  const bottom = props.height - 1
  return `${smooth(pts)} L ${pts[pts.length - 1].x} ${bottom} L ${pts[0].x} ${bottom} Z`
})

const lastPoint = computed(() => {
  const pts = points.value
  return pts.length ? pts[pts.length - 1] : null
})
</script>

<style scoped>
.sparkline { display: block; }
</style>
