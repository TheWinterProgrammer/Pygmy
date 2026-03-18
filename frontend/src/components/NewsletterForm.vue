<template>
  <section class="newsletter-section" v-if="enabled">
    <div class="newsletter-card glass">
      <div class="nl-copy">
        <h3 class="nl-title">Stay in the loop</h3>
        <p class="nl-desc">{{ intro }}</p>
      </div>

      <form class="nl-form" @submit.prevent="submit" v-if="!success">
        <input
          v-model="name"
          class="nl-input"
          type="text"
          placeholder="Your name (optional)"
          autocomplete="name"
        />
        <div class="nl-row">
          <input
            v-model="email"
            class="nl-input"
            type="email"
            placeholder="Your email address"
            required
            autocomplete="email"
          />
          <button class="btn btn-primary nl-btn" type="submit" :disabled="loading">
            {{ loading ? '…' : 'Subscribe' }}
          </button>
        </div>
        <p class="nl-error" v-if="error">{{ error }}</p>
        <p class="nl-privacy">No spam, ever. Unsubscribe at any time.</p>
      </form>

      <div class="nl-success" v-else>
        <span class="nl-check">✅</span>
        <p>{{ successMsg }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSiteStore } from '../stores/site.js'

const site = useSiteStore()

const BASE = 'http://localhost:3200'

const name = ref('')
const email = ref('')
const loading = ref(false)
const success = ref(false)
const successMsg = ref('')
const error = ref('')

const enabled = computed(() => site.settings.newsletter_enabled === '1')
const intro = computed(() => site.settings.newsletter_intro || 'Get the latest updates delivered straight to your inbox.')

async function submit() {
  if (!email.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${BASE}/api/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, name: name.value }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      error.value = data.error || 'Something went wrong. Please try again.'
    } else {
      success.value = true
      successMsg.value = data.message || 'You have been subscribed!'
    }
  } catch {
    error.value = 'Network error. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.newsletter-section {
  padding: 4rem 1.5rem;
  max-width: 700px;
  margin: 0 auto;
}

.newsletter-card {
  border-radius: 1.5rem;
  padding: 2.5rem;
  text-align: center;
}

.nl-title {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
  font-weight: 700;
}

.nl-desc {
  color: var(--text-muted, rgba(255,255,255,0.55));
  font-size: 0.92rem;
  margin: 0 0 1.75rem;
  line-height: 1.6;
}

.nl-form { display: flex; flex-direction: column; gap: 0.6rem; }

.nl-input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.6rem;
  padding: 0.65rem 1rem;
  color: inherit;
  font-family: inherit;
  font-size: 0.92rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.nl-input:focus { border-color: var(--accent, hsl(355,70%,58%)); }
.nl-input::placeholder { color: rgba(255,255,255,0.3); }

.nl-row {
  display: flex;
  gap: 0.5rem;
}
.nl-row .nl-input { flex: 1; }
.nl-btn { white-space: nowrap; }

.nl-error { color: hsl(355,70%,65%); font-size: 0.82rem; margin: 0; }
.nl-privacy { color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0.25rem 0 0; }

.nl-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}
.nl-check { font-size: 2.5rem; }
.nl-success p { margin: 0; color: rgba(255,255,255,0.7); font-size: 0.95rem; }
</style>
