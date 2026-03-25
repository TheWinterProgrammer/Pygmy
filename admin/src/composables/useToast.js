// Pygmy CMS — Toast notification composable (admin)
import { ref } from 'vue'

const toasts = ref([])
let nextId = 1

export function useToast() {
  function show(message, type = 'info', duration = 3000) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  function dismiss(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  function success(msg, duration) { return show(msg, 'success', duration) }
  function error(msg, duration)   { return show(msg, 'error', duration) }
  function info(msg, duration)    { return show(msg, 'info', duration) }

  return { toasts, show, dismiss, success, error, info }
}
