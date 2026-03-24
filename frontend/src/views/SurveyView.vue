<template>
  <div class="survey-page">
    <!-- Loading -->
    <div v-if="loading" class="survey-loading">
      <div class="spinner"></div>
      <p>Loading survey…</p>
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="survey-not-found">
      <div class="glass not-found-card">
        <div class="nf-icon">📋</div>
        <h1>Survey not found</h1>
        <p>This survey may have ended or the link is invalid.</p>
        <RouterLink to="/" class="btn-primary">← Back to Home</RouterLink>
      </div>
    </div>

    <!-- Completed -->
    <div v-else-if="submitted" class="survey-done">
      <div class="glass done-card">
        <div class="done-icon">🎉</div>
        <h1>Thank you!</h1>
        <p>{{ survey.success_message || 'Your response has been recorded.' }}</p>
        <RouterLink to="/" class="btn-primary">← Back to Home</RouterLink>
      </div>
    </div>

    <!-- Already responded -->
    <div v-else-if="alreadyResponded" class="survey-done">
      <div class="glass done-card">
        <div class="done-icon">✅</div>
        <h1>Already submitted</h1>
        <p>You've already completed this survey. Thank you for your time!</p>
        <RouterLink to="/" class="btn-primary">← Back to Home</RouterLink>
      </div>
    </div>

    <!-- Survey form -->
    <div v-else-if="survey" class="survey-container">
      <div class="survey-hero glass">
        <h1>{{ survey.title }}</h1>
        <p v-if="survey.description" class="survey-desc">{{ survey.description }}</p>
        <div v-if="survey.show_progress && survey.questions?.length" class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <p v-if="survey.show_progress && survey.questions?.length" class="progress-label">
          Question {{ currentQuestion + 1 }} of {{ survey.questions.length }}
        </p>
      </div>

      <form class="survey-form glass" @submit.prevent="submitSurvey">
        <div
          v-for="(q, idx) in survey.questions"
          :key="q.id"
          class="question-block"
          :class="{ active: currentQuestion === idx, completed: answers[q.id] !== undefined }"
        >
          <div class="q-label">
            <span class="q-num">{{ idx + 1 }}</span>
            <span class="q-text">{{ q.question_text }}</span>
            <span v-if="q.required" class="q-required" title="Required">*</span>
          </div>

          <!-- Text input -->
          <input
            v-if="q.question_type === 'text'"
            v-model="answers[q.id]"
            type="text"
            class="q-input"
            :placeholder="q.placeholder || 'Type your answer…'"
            @focus="currentQuestion = idx"
          />

          <!-- Textarea -->
          <textarea
            v-else-if="q.question_type === 'textarea'"
            v-model="answers[q.id]"
            class="q-textarea"
            :placeholder="q.placeholder || 'Type your answer…'"
            rows="4"
            @focus="currentQuestion = idx"
          ></textarea>

          <!-- Rating (1-5 stars) -->
          <div v-else-if="q.question_type === 'rating'" class="q-rating" @click="currentQuestion = idx">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="star-btn"
              :class="{ active: Number(answers[q.id]) >= n }"
              @click="answers[q.id] = n"
            >★</button>
          </div>

          <!-- NPS (0-10) -->
          <div v-else-if="q.question_type === 'nps'" class="q-nps" @click="currentQuestion = idx">
            <div class="nps-labels">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>
            <div class="nps-buttons">
              <button
                v-for="n in 11"
                :key="n - 1"
                type="button"
                class="nps-btn"
                :class="{ 
                  active: answers[q.id] !== undefined && Number(answers[q.id]) === n - 1,
                  detractor: n <= 7,
                  passive: n === 8 || n === 9,
                  promoter: n >= 10
                }"
                @click="answers[q.id] = n - 1"
              >{{ n - 1 }}</button>
            </div>
          </div>

          <!-- Radio / Single choice -->
          <div v-else-if="q.question_type === 'radio'" class="q-options" @click="currentQuestion = idx">
            <label
              v-for="opt in q.options"
              :key="opt"
              class="q-option"
              :class="{ selected: answers[q.id] === opt }"
            >
              <input type="radio" :name="`q_${q.id}`" :value="opt" v-model="answers[q.id]" />
              {{ opt }}
            </label>
          </div>

          <!-- Checkbox / Multi select -->
          <div v-else-if="q.question_type === 'checkbox'" class="q-options" @click="currentQuestion = idx">
            <label
              v-for="opt in q.options"
              :key="opt"
              class="q-option"
              :class="{ selected: (answers[q.id] || []).includes(opt) }"
            >
              <input
                type="checkbox"
                :value="opt"
                :checked="(answers[q.id] || []).includes(opt)"
                @change="toggleCheckbox(q.id, opt)"
              />
              {{ opt }}
            </label>
          </div>

          <!-- Dropdown -->
          <select
            v-else-if="q.question_type === 'dropdown'"
            v-model="answers[q.id]"
            class="q-select"
            @focus="currentQuestion = idx"
          >
            <option value="" disabled>Choose an option…</option>
            <option v-for="opt in q.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>

          <!-- Date -->
          <input
            v-else-if="q.question_type === 'date'"
            v-model="answers[q.id]"
            type="date"
            class="q-input"
            @focus="currentQuestion = idx"
          />

          <!-- Scale (1-10) -->
          <div v-else-if="q.question_type === 'scale'" class="q-scale" @click="currentQuestion = idx">
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              v-model="answers[q.id]"
              class="scale-slider"
            />
            <div class="scale-labels">
              <span>1</span>
              <span class="scale-value">{{ answers[q.id] || '—' }}</span>
              <span>10</span>
            </div>
          </div>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button type="submit" class="btn-primary submit-btn" :disabled="submitting">
          <span v-if="submitting">Submitting…</span>
          <span v-else>Submit Survey →</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'

const route = useRoute()

const loading = ref(true)
const notFound = ref(false)
const survey = ref(null)
const answers = ref({})
const currentQuestion = ref(0)
const submitted = ref(false)
const alreadyResponded = ref(false)
const submitting = ref(false)
const error = ref('')

// Stable session/respondent ID
const respondentId = (() => {
  const key = 'pygmy_respondent_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, id)
  }
  return id
})()

const progressPct = computed(() => {
  if (!survey.value?.questions?.length) return 0
  return ((currentQuestion.value + 1) / survey.value.questions.length) * 100
})

function toggleCheckbox(qId, opt) {
  if (!answers.value[qId]) answers.value[qId] = []
  const arr = [...answers.value[qId]]
  const idx = arr.indexOf(opt)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(opt)
  answers.value[qId] = arr
}

async function submitSurvey() {
  error.value = ''
  // Validate required
  for (const q of survey.value.questions) {
    if (q.required) {
      const ans = answers.value[q.id]
      if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
        error.value = `Please answer: "${q.question_text}"`
        currentQuestion.value = survey.value.questions.indexOf(q)
        return
      }
    }
  }

  submitting.value = true
  try {
    const answersArr = Object.entries(answers.value).map(([qId, answer]) => ({
      question_id: Number(qId),
      answer: Array.isArray(answer) ? answer.join(', ') : String(answer),
    }))
    await api.post(`/surveys/${survey.value.id}/respond`, {
      answers: answersArr,
      respondent_id: respondentId,
    })
    submitted.value = true
  } catch (e) {
    if (e?.response?.data?.already_responded) {
      alreadyResponded.value = true
    } else {
      error.value = e?.response?.data?.error || 'Failed to submit. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/surveys/public/${route.params.slug}`)
    survey.value = data
    // Pre-init answers
    for (const q of data.questions) {
      if (q.question_type === 'checkbox') answers.value[q.id] = []
      else if (q.question_type === 'scale') answers.value[q.id] = '5'
    }
  } catch (e) {
    notFound.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.survey-page {
  min-height: 100vh;
  padding: 2rem 1rem 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.survey-loading,
.survey-not-found,
.survey-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1rem;
}

.spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.not-found-card,
.done-card {
  text-align: center;
  padding: 3rem;
  border-radius: 1.5rem;
  max-width: 480px;
}
.nf-icon, .done-icon { font-size: 3rem; margin-bottom: 1rem; }
.not-found-card h1, .done-card h1 { margin: 0 0 0.75rem; font-size: 1.8rem; }
.not-found-card p, .done-card p { color: var(--muted); margin: 0 0 1.5rem; }

.survey-container {
  width: 100%;
  max-width: 700px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.survey-hero {
  padding: 2rem 2.5rem;
  border-radius: 1.5rem;
  text-align: center;
}
.survey-hero h1 { margin: 0 0 0.5rem; font-size: 1.8rem; }
.survey-desc { color: var(--muted); margin: 0 0 1.5rem; line-height: 1.6; }

.progress-bar {
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}
.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.progress-label { font-size: 0.8rem; color: var(--muted); margin: 0; }

.survey-form {
  padding: 2rem 2.5rem;
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.question-block {
  padding: 1.25rem;
  border-radius: 1rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  transition: border-color 0.2s, background 0.2s;
}
.question-block.active {
  border-color: rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06);
}
.question-block.completed {
  border-color: rgba(var(--accent-rgb, 220, 60, 80), 0.3);
}

.q-label {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.q-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px; height: 24px;
  min-width: 24px;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
}
.q-text { font-weight: 500; line-height: 1.5; flex: 1; }
.q-required { color: var(--accent); font-weight: 700; }

.q-input, .q-textarea, .q-select {
  width: 100%;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  color: var(--text);
  font-family: inherit;
  font-size: 0.95rem;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.q-input:focus, .q-textarea:focus, .q-select:focus {
  outline: none;
  border-color: var(--accent);
}
.q-textarea { resize: vertical; }

/* Rating stars */
.q-rating { display: flex; gap: 0.5rem; }
.star-btn {
  background: none;
  border: none;
  font-size: 1.8rem;
  cursor: pointer;
  color: rgba(255,255,255,0.2);
  transition: color 0.15s, transform 0.1s;
  padding: 0;
}
.star-btn.active, .star-btn:hover { color: #f5a623; transform: scale(1.15); }

/* NPS */
.q-nps { display: flex; flex-direction: column; gap: 0.5rem; }
.nps-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--muted); }
.nps-buttons { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.nps-btn {
  width: 38px; height: 38px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.15s, transform 0.1s;
}
.nps-btn:hover { transform: translateY(-2px); }
.nps-btn.active.detractor { background: hsl(355, 60%, 45%); border-color: transparent; color: white; }
.nps-btn.active.passive { background: hsl(35, 80%, 50%); border-color: transparent; color: white; }
.nps-btn.active.promoter { background: hsl(145, 55%, 45%); border-color: transparent; color: white; }

/* Options */
.q-options { display: flex; flex-direction: column; gap: 0.5rem; }
.q-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255,255,255,0.1);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-size: 0.95rem;
}
.q-option:hover { background: rgba(255,255,255,0.06); }
.q-option.selected { background: rgba(var(--accent-rgb, 220,60,80), 0.12); border-color: var(--accent); }
.q-option input { width: 16px; height: 16px; accent-color: var(--accent); }

/* Scale slider */
.q-scale { display: flex; flex-direction: column; gap: 0.5rem; }
.scale-slider {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
}
.scale-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--muted);
}
.scale-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
}

.error-msg {
  background: rgba(220, 60, 80, 0.15);
  border: 1px solid rgba(220, 60, 80, 0.4);
  color: hsl(355, 80%, 70%);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
}

.submit-btn {
  align-self: flex-end;
  padding: 0.85rem 2rem;
  font-size: 1rem;
}
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 0.75rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.15s;
}
.btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

@media (max-width: 600px) {
  .survey-hero, .survey-form { padding: 1.5rem; }
  .nps-btn { width: 32px; height: 32px; }
}
</style>
