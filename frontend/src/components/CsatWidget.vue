<template>
  <Teleport to="body">
    <Transition name="csat-slide">
      <div
        v-if="visible && config"
        class="csat-widget"
        :class="[posClass, { expanded: state !== 'idle' }]"
      >
        <!-- Idle: just the question + buttons -->
        <div v-if="state === 'idle'" class="csat-idle">
          <p class="csat-question">{{ config.csat_question }}</p>
          <div class="csat-actions">
            <!-- Thumbs mode -->
            <template v-if="config.csat_type === 'thumbs'">
              <button class="csat-thumb positive" @click="pickRating(5)" title="Yes / Helpful">
                👍
              </button>
              <button class="csat-thumb negative" @click="pickRating(1)" title="No / Not helpful">
                👎
              </button>
            </template>
            <!-- Stars mode -->
            <template v-else>
              <div class="csat-stars">
                <button
                  v-for="n in 5"
                  :key="n"
                  class="csat-star"
                  :class="{ active: hoverStar >= n || selectedStar >= n }"
                  @mouseenter="hoverStar = n"
                  @mouseleave="hoverStar = 0"
                  @click="pickRating(n)"
                >★</button>
              </div>
            </template>
          </div>
          <button class="csat-dismiss" @click="dismiss" title="Dismiss">✕</button>
        </div>

        <!-- Comment mode -->
        <div v-else-if="state === 'comment'" class="csat-comment-mode">
          <p class="csat-question">{{ ratingEmoji }} {{ ratingLabel }}</p>
          <textarea
            v-if="config.csat_show_comment === '1'"
            v-model="comment"
            class="csat-textarea"
            :placeholder="config.csat_comment_placeholder || 'Tell us more (optional)…'"
            rows="3"
            maxlength="500"
          ></textarea>
          <div class="csat-footer">
            <button class="btn-ghost-sm" @click="state = 'idle'">← Back</button>
            <button class="btn-primary-sm" @click="submit" :disabled="submitting">
              {{ submitting ? '…' : 'Send Feedback' }}
            </button>
          </div>
        </div>

        <!-- Thank you state -->
        <div v-else-if="state === 'done'" class="csat-done">
          <span class="csat-done-icon">🙏</span>
          <p>{{ config.csat_thank_you_message || 'Thanks for your feedback!' }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const config = ref(null)
const visible = ref(false)
const state = ref('idle')      // idle | comment | done
const selectedStar = ref(0)
const hoverStar = ref(0)
const pendingRating = ref(null)
const comment = ref('')
const submitting = ref(false)

const SESSION_KEY = 'pygmy_csat_sessions'

function getSessionId() {
  let id = localStorage.getItem('pygmy_session_id')
  if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('pygmy_session_id', id) }
  return id
}

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}') } catch { return {} }
}
function setDismissed(path) {
  const d = getDismissed()
  d[path] = Date.now()
  localStorage.setItem(SESSION_KEY, JSON.stringify(d))
}
function wasRated(path) {
  const d = getDismissed()
  // Suppressed for 7 days after rating/dismiss
  return !!d[path] && (Date.now() - d[path]) < 7 * 24 * 3600 * 1000
}

async function loadConfig() {
  try {
    const r = await fetch('/api/csat/config')
    config.value = await r.json()
  } catch {}
}

function maybeShow() {
  if (!config.value) return
  if (config.value.csat_enabled !== '1') return
  const path = route.path
  if (wasRated(path)) return

  const delay = parseInt(config.value.csat_delay_ms || '3000', 10)
  setTimeout(() => { visible.value = true }, delay)
}

function dismiss() {
  setDismissed(route.path)
  visible.value = false
}

function pickRating(n) {
  pendingRating.value = n
  selectedStar.value = n
  if (config.value?.csat_show_comment === '1') {
    state.value = 'comment'
  } else {
    submit()
  }
}

async function submit() {
  submitting.value = true
  try {
    await fetch('/api/csat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_path: route.path,
        rating: pendingRating.value,
        comment: comment.value,
        session_id: getSessionId()
      })
    })
    state.value = 'done'
    setDismissed(route.path)
    setTimeout(() => { visible.value = false }, 3000)
  } catch {
    state.value = 'done'
  } finally {
    submitting.value = false
  }
}

const ratingEmoji = computed(() => {
  if (!pendingRating.value) return '😊'
  if (pendingRating.value >= 4) return '😊'
  if (pendingRating.value === 3) return '😐'
  return '😞'
})
const ratingLabel = computed(() => {
  if (!pendingRating.value) return ''
  if (pendingRating.value >= 4) return 'Glad to hear it!'
  if (pendingRating.value === 3) return 'Okay, thanks.'
  return "Sorry to hear that."
})

const posClass = computed(() => {
  const p = config.value?.csat_position || 'bottom-right'
  return 'pos-' + p.replace('-', '-')
})

onMounted(async () => {
  await loadConfig()
  maybeShow()
})

// Re-evaluate on route change
watch(() => route.path, () => {
  visible.value = false
  state.value = 'idle'
  comment.value = ''
  selectedStar.value = 0
  pendingRating.value = null
  setTimeout(() => maybeShow(), 500)
})
</script>

<style scoped>
.csat-widget {
  position: fixed;
  z-index: 9000;
  max-width: 320px;
  width: calc(100vw - 2rem);
  background: rgba(255,255,255,0.07);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 1.25rem;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  color: #fff;
  font-family: 'Poppins', sans-serif;
}

/* Positions */
.pos-bottom-right { bottom: 1.5rem; right: 1.5rem; }
.pos-bottom-left  { bottom: 1.5rem; left: 1.5rem; }
.pos-bottom-center { bottom: 1.5rem; left: 50%; transform: translateX(-50%); }

/* Idle layout */
.csat-idle { position: relative; }
.csat-question { margin: 0 0 .85rem; font-size: .9rem; font-weight: 600; padding-right: 1.5rem; }
.csat-actions { display: flex; gap: .75rem; align-items: center; }

/* Thumbs */
.csat-thumb { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 50%; width: 44px; height: 44px; font-size: 1.25rem; cursor: pointer; transition: background .15s, transform .15s; display: flex; align-items: center; justify-content: center; }
.csat-thumb:hover { background: rgba(255,255,255,0.2); transform: scale(1.1); }
.csat-thumb.positive:hover { background: rgba(34,197,94,0.25); border-color: #22c55e; }
.csat-thumb.negative:hover { background: rgba(239,68,68,0.25); border-color: #ef4444; }

/* Stars */
.csat-stars { display: flex; gap: .2rem; }
.csat-star { background: none; border: none; font-size: 1.6rem; cursor: pointer; color: rgba(255,255,255,0.25); transition: color .1s; }
.csat-star.active { color: #f59e0b; }
.csat-star:hover ~ .csat-star { color: rgba(255,255,255,0.25) !important; }

/* Dismiss */
.csat-dismiss { position: absolute; top: 0; right: 0; background: none; border: none; color: rgba(255,255,255,0.4); font-size: .9rem; cursor: pointer; padding: 0; line-height: 1; }
.csat-dismiss:hover { color: #fff; }

/* Comment mode */
.csat-comment-mode { }
.csat-textarea { width: 100%; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: .75rem; color: #fff; padding: .6rem .85rem; font-size: .85rem; font-family: inherit; resize: vertical; min-height: 72px; margin: .75rem 0; box-sizing: border-box; }
.csat-textarea:focus { outline: none; border-color: var(--accent, #c0434e); }
.csat-footer { display: flex; gap: .5rem; justify-content: flex-end; }
.btn-ghost-sm { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); padding: .35rem .8rem; border-radius: .5rem; font-size: .8rem; cursor: pointer; }
.btn-primary-sm { background: var(--accent, #c0434e); border: none; color: #fff; padding: .35rem .8rem; border-radius: .5rem; font-size: .8rem; cursor: pointer; font-weight: 600; }
.btn-primary-sm:disabled { opacity: .5; }

/* Done state */
.csat-done { text-align: center; }
.csat-done-icon { font-size: 2rem; display: block; margin-bottom: .5rem; }
.csat-done p { margin: 0; font-size: .9rem; opacity: .85; }

/* Transitions */
.csat-slide-enter-active, .csat-slide-leave-active { transition: opacity .35s, transform .35s; }
.csat-slide-enter-from { opacity: 0; transform: translateY(20px); }
.csat-slide-leave-to { opacity: 0; transform: translateY(20px); }
</style>
