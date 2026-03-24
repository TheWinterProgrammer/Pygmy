<!-- NPS Survey Widget — floating bottom card, appears after configurable delay -->
<template>
  <Transition name="slide-up">
    <div v-if="visible && !dismissed && !submitted" class="nps-widget glass">
      <button class="nps-close" @click="dismiss">✕</button>

      <div v-if="step === 'score'">
        <div class="nps-question">{{ config.question }}</div>
        <div class="nps-subtitle">0 = Not at all likely &nbsp;•&nbsp; 10 = Extremely likely</div>
        <div class="nps-scores">
          <button
            v-for="n in 11"
            :key="n - 1"
            :class="['score-btn', { selected: selectedScore === n - 1 }, scoreClass(n - 1)]"
            @click="selectScore(n - 1)"
          >{{ n - 1 }}</button>
        </div>
      </div>

      <div v-else-if="step === 'feedback'">
        <div class="nps-question">{{ config.follow_up }}</div>
        <div class="nps-score-recap">
          You gave us a <span class="score-inline" :class="scoreClass(selectedScore)">{{ selectedScore }}/10</span>
        </div>
        <textarea
          v-model="feedback"
          class="nps-textarea"
          rows="3"
          placeholder="(Optional) Tell us more…"
          maxlength="500"
        ></textarea>
        <div class="nps-actions">
          <button class="nps-btn-secondary" @click="submit(true)">Skip</button>
          <button class="nps-btn-primary" @click="submit(false)" :disabled="submitting">
            {{ submitting ? 'Sending…' : 'Submit' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="slide-up">
    <div v-if="submitted" class="nps-widget glass nps-thanks">
      <button class="nps-close" @click="submitted = false">✕</button>
      <div class="thanks-icon">🙏</div>
      <div class="thanks-text">Thank you for your feedback!</div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const visible = ref(false)
const dismissed = ref(false)
const submitted = ref(false)
const submitting = ref(false)
const selectedScore = ref(null)
const feedback = ref('')
const step = ref('score')
const config = ref({ question: 'How likely are you to recommend us?', follow_up: "What's the main reason for your score?" })

const STORAGE_KEY = 'pygmy_nps_state'

function scoreClass(n) {
  if (n >= 9) return 'promoter'
  if (n >= 7) return 'passive'
  return 'detractor'
}

function selectScore(n) {
  selectedScore.value = n
  // Brief visual delay then move to feedback
  setTimeout(() => { step.value = 'feedback' }, 300)
}

async function submit(skipFeedback) {
  if (submitting.value) return
  submitting.value = true
  try {
    await api.post('/nps', {
      score: selectedScore.value,
      feedback: skipFeedback ? '' : feedback.value,
      order_number: new URLSearchParams(window.location.search).get('order') || '',
    })
    submitted.value = true
    dismissed.value = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ done: true, at: Date.now() }))
    setTimeout(() => { submitted.value = false }, 4000)
  } catch (e) {
    console.warn('NPS submit error:', e)
    dismissed.value = true
  } finally {
    submitting.value = false
  }
}

function dismiss() {
  dismissed.value = true
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: true, at: Date.now() }))
}

onMounted(async () => {
  try {
    const res = await api.get('/nps/config')
    if (!res.data.enabled) return
    Object.assign(config.value, res.data)
  } catch { return }

  // Check if already done or dismissed recently (7 days)
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  if (state?.done) return
  if (state?.dismissed && Date.now() - state.at < 7 * 24 * 60 * 60 * 1000) return

  // Show after 8 seconds
  setTimeout(() => { visible.value = true }, 8000)
})
</script>

<style scoped>
.nps-widget {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 900;
  border-radius: 1.25rem;
  padding: 1.25rem 1.5rem;
  width: 340px;
  max-width: calc(100vw - 2rem);
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
}

.nps-close {
  position: absolute;
  top: .6rem; right: .75rem;
  background: none; border: none;
  color: rgba(255,255,255,.4);
  cursor: pointer; font-size: .9rem;
  line-height: 1;
}
.nps-close:hover { color: rgba(255,255,255,.8); }

.nps-question { font-size: .95rem; font-weight: 700; margin-bottom: .25rem; line-height: 1.4; }
.nps-subtitle  { font-size: .72rem; color: rgba(255,255,255,.4); margin-bottom: .85rem; }

.nps-scores {
  display: flex;
  gap: .3rem;
  flex-wrap: wrap;
}
.score-btn {
  width: 28px; height: 28px;
  border-radius: .4rem;
  border: 1px solid rgba(255,255,255,.15);
  background: rgba(255,255,255,.07);
  color: rgba(255,255,255,.7);
  font-size: .8rem; font-weight: 700;
  cursor: pointer; font-family: inherit;
  transition: all .15s;
  display: flex; align-items: center; justify-content: center;
}
.score-btn:hover { transform: scale(1.1); border-color: rgba(255,255,255,.4); }
.score-btn.selected { transform: scale(1.15); }
.score-btn.promoter:hover, .score-btn.promoter.selected  { background: rgba(74,222,128,.25); border-color: #4ade80; color: #4ade80; }
.score-btn.passive:hover,  .score-btn.passive.selected   { background: rgba(251,191,36,.25); border-color: #fbbf24; color: #fbbf24; }
.score-btn.detractor:hover,.score-btn.detractor.selected { background: rgba(248,113,113,.25);border-color: #f87171; color: #f87171; }

.nps-score-recap { font-size: .82rem; color: rgba(255,255,255,.5); margin-bottom: .75rem; }
.score-inline { font-weight: 700; }
.score-inline.promoter  { color: #4ade80; }
.score-inline.passive   { color: #fbbf24; }
.score-inline.detractor { color: #f87171; }

.nps-textarea {
  width: 100%;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: .5rem;
  color: #fff;
  padding: .5rem .75rem;
  font-size: .83rem;
  font-family: inherit;
  resize: vertical;
  min-height: 70px;
}
.nps-textarea:focus { outline: none; border-color: var(--accent); }
.nps-textarea::placeholder { color: rgba(255,255,255,.3); }

.nps-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .75rem; }
.nps-btn-primary {
  background: var(--accent);
  border: none; border-radius: .5rem;
  color: #fff; padding: .45rem 1rem;
  font-size: .83rem; font-weight: 600;
  cursor: pointer; font-family: inherit;
}
.nps-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.nps-btn-secondary {
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: .5rem;
  color: rgba(255,255,255,.7);
  padding: .45rem .75rem;
  font-size: .83rem; cursor: pointer; font-family: inherit;
}

.nps-thanks { text-align: center; padding: 1.5rem; }
.thanks-icon { font-size: 2rem; margin-bottom: .5rem; }
.thanks-text { font-size: .95rem; font-weight: 600; }

/* Transitions */
.slide-up-enter-active, .slide-up-leave-active { transition: all .35s cubic-bezier(.4,0,.2,1); }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(20px); }

.glass {
  background: rgba(25,26,32,.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,.12);
}
</style>
