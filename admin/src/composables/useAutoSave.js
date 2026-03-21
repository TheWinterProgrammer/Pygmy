/**
 * useAutoSave — LocalStorage-based auto-save for content editors.
 *
 * Usage:
 *   const autoSave = useAutoSave('post', postId, formRef)
 *   autoSave.watchForm()         ← call after form is populated
 *   autoSave.restore(fn)         ← call on mount to maybe restore
 *   autoSave.clear()             ← call after successful save
 *
 * Stores a draft under:  pygmy_autosave:{type}:{id|new}
 */
import { watch, ref } from 'vue'

export function useAutoSave(type, idRef, formRef) {
  const hasDraft = ref(false)
  const draftTime = ref(null)
  let debounceTimer = null

  function storageKey() {
    const id = typeof idRef === 'function' ? idRef() : (idRef?.value ?? 'new')
    return `pygmy_autosave:${type}:${id ?? 'new'}`
  }

  function save() {
    if (!formRef?.value) return
    try {
      const payload = {
        data: JSON.parse(JSON.stringify(formRef.value)),
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem(storageKey(), JSON.stringify(payload))
    } catch {}
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(storageKey())
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function clear() {
    localStorage.removeItem(storageKey())
    hasDraft.value = false
    draftTime.value = null
  }

  /**
   * Check on mount if a draft exists.
   * If it does, call `onRestore(draftData)` after user confirms.
   */
  function checkRestore(onRestore) {
    const draft = loadDraft()
    if (!draft) return
    hasDraft.value = true
    draftTime.value = draft.savedAt
    // Expose to component so it can show a banner
    return draft
  }

  function restore(onRestore) {
    const draft = loadDraft()
    if (!draft || !onRestore) return
    onRestore(draft.data)
    hasDraft.value = false
    draftTime.value = null
    localStorage.removeItem(storageKey())
  }

  /** Start watching the form for changes and debounce-save every 10s */
  function watchForm() {
    watch(
      formRef,
      () => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(save, 10_000) // save 10s after last change
      },
      { deep: true }
    )
  }

  return { hasDraft, draftTime, watchForm, checkRestore, restore, clear, save }
}
