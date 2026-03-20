// useContentLock — acquire, refresh, and release a content lock for an entity.
// Usage: const lock = useContentLock('post', postId)
// lock.conflict => { user_name, locked_at } if someone else has it, else null
// lock.acquire() / lock.release() (called automatically on mount/unmount if `auto: true`)
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const BASE = 'http://localhost:3200'
const REFRESH_INTERVAL_MS = 60 * 1000 * 4 // refresh every 4 min (TTL is 5 min)

export function useContentLock(entityType, entityId, opts = {}) {
  const { auto = true } = opts
  const auth     = useAuthStore()
  const conflict = ref(null)  // { user_name, locked_at } | null
  const acquired = ref(false)
  let timer = null

  const headers = () => ({
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
  })

  async function acquire() {
    if (!entityId) return
    try {
      const res = await fetch(`${BASE}/api/locks`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
      })
      const data = await res.json()
      if (data.ok) {
        acquired.value = true
        conflict.value = null
      } else if (data.conflict) {
        conflict.value = data.conflict
        acquired.value = false
      }
    } catch {
      // silently ignore lock errors — editing should still work
    }
  }

  async function release() {
    if (!entityId || !acquired.value) return
    try {
      await fetch(`${BASE}/api/locks/${entityType}/${entityId}`, {
        method: 'DELETE',
        headers: headers(),
      })
    } catch {}
    acquired.value = false
    conflict.value = null
  }

  if (auto) {
    onMounted(async () => {
      await acquire()
      timer = setInterval(acquire, REFRESH_INTERVAL_MS)
    })

    onBeforeUnmount(async () => {
      clearInterval(timer)
      await release()
    })
  }

  return { conflict, acquired, acquire, release }
}
