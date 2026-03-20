<template>
  <div v-if="conflict" class="lock-banner">
    <span class="lock-icon">🔒</span>
    <div class="lock-text">
      <strong>{{ conflict.user_name }}</strong> is currently editing this content
      <span class="lock-since"> · since {{ formatTime(conflict.locked_at) }}</span>
    </div>
    <span class="lock-hint">Your changes may be overwritten if you save simultaneously.</span>
  </div>
</template>

<script setup>
const props = defineProps({
  conflict: { type: Object, default: null }
})

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.lock-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(240, 160, 30, 0.1);
  border: 1px solid rgba(240, 160, 30, 0.35);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  flex-wrap: wrap;
}
.lock-icon { font-size: 1.1rem; flex-shrink: 0; }
.lock-text { flex: 1; min-width: 0; }
.lock-text strong { color: hsl(40, 85%, 65%); }
.lock-since { color: var(--muted); }
.lock-hint { color: var(--muted); font-size: 0.78rem; width: 100%; padding-left: calc(1.1rem + 0.75rem); }
</style>
