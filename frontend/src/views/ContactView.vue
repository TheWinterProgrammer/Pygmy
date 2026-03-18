<template>
  <div class="contact-page container">
    <div class="contact-wrap">
      <!-- Header -->
      <div class="contact-header">
        <h1 class="contact-title">Get in Touch</h1>
        <p class="contact-sub" v-if="site.settings.contact_intro">
          {{ site.settings.contact_intro }}
        </p>
        <p class="contact-sub" v-else>
          Have a question or want to work together? Drop us a message and we'll get back to you.
        </p>
      </div>

      <!-- Success state -->
      <div v-if="submitted" class="success-card glass">
        <div class="success-icon">✅</div>
        <h2>Message Sent!</h2>
        <p>Thanks for reaching out. We'll get back to you as soon as possible.</p>
        <button class="btn btn-primary" @click="submitted = false; reset()">Send Another</button>
      </div>

      <!-- Form -->
      <form v-else class="contact-form glass" @submit.prevent="submit">
        <div class="form-row">
          <label class="form-label">
            Name <span class="req">*</span>
            <input
              v-model="form.name"
              class="input"
              placeholder="Your name"
              :class="{ error: errors.name }"
            />
            <span class="field-error" v-if="errors.name">{{ errors.name }}</span>
          </label>
          <label class="form-label">
            Email <span class="req">*</span>
            <input
              v-model="form.email"
              type="email"
              class="input"
              placeholder="you@example.com"
              :class="{ error: errors.email }"
            />
            <span class="field-error" v-if="errors.email">{{ errors.email }}</span>
          </label>
        </div>

        <label class="form-label">
          Subject
          <input v-model="form.subject" class="input" placeholder="What's this about?" />
        </label>

        <label class="form-label">
          Message <span class="req">*</span>
          <textarea
            v-model="form.message"
            class="input textarea"
            placeholder="Write your message here…"
            rows="7"
            :class="{ error: errors.message }"
          />
          <span class="field-error" v-if="errors.message">{{ errors.message }}</span>
        </label>

        <p v-if="serverError" class="server-error">{{ serverError }}</p>

        <button type="submit" class="btn btn-primary btn-submit" :disabled="sending">
          <span v-if="sending">Sending…</span>
          <span v-else>Send Message →</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useSiteStore } from '../stores/site.js'

const site = useSiteStore()

const submitted = ref(false)
const sending = ref(false)
const serverError = ref('')

const form = reactive({ name: '', email: '', subject: '', message: '' })
const errors = reactive({ name: '', email: '', message: '' })

function reset() {
  Object.assign(form, { name: '', email: '', subject: '', message: '' })
  Object.assign(errors, { name: '', email: '', message: '' })
  serverError.value = ''
}

function validate() {
  let ok = true
  errors.name = errors.email = errors.message = ''

  if (!form.name.trim()) { errors.name = 'Name is required.'; ok = false }
  if (!form.email.trim()) { errors.email = 'Email is required.'; ok = false }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { errors.email = 'Enter a valid email.'; ok = false }
  if (!form.message.trim()) { errors.message = 'Message is required.'; ok = false }
  return ok
}

async function submit() {
  if (!validate()) return
  sending.value = true
  serverError.value = ''

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3200'}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to send message.')
    submitted.value = true
    reset()
  } catch (err) {
    serverError.value = err.message || 'Something went wrong. Please try again.'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.contact-page {
  padding-top: 6rem;
  padding-bottom: 4rem;
  min-height: 80vh;
}

.contact-wrap {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.contact-header { text-align: center; }
.contact-title {
  font-size: clamp(2rem, 5vw, 2.8rem);
  font-weight: 800;
  margin: 0 0 0.75rem;
}
.contact-sub {
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1.7;
  margin: 0;
}

/* Form */
.contact-form {
  padding: 2.5rem;
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 480px) {
  .form-row { grid-template-columns: 1fr; }
  .contact-form { padding: 1.5rem; }
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
}
.req { color: var(--accent); }

.input {
  width: 100%;
  padding: 0.7rem 0.9rem;
  background: var(--glass-bg);
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  color: var(--text);
  font-family: inherit;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.input:focus { outline: none; border-color: var(--accent); }
.input.error { border-color: var(--accent); }

.textarea { resize: vertical; min-height: 140px; line-height: 1.6; }

.field-error { font-size: 0.75rem; color: hsl(355,70%,65%); margin-top: -0.1rem; }

.server-error {
  font-size: 0.85rem;
  color: hsl(355,70%,65%);
  background: hsl(355,70%,10%);
  border: 1px solid hsl(355,70%,25%);
  border-radius: 0.5rem;
  padding: 0.65rem 0.9rem;
  margin: 0;
}

.btn-submit { width: 100%; justify-content: center; }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* Success */
.success-card {
  text-align: center;
  padding: 3rem 2rem;
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.success-icon { font-size: 2.5rem; }
.success-card h2 { margin: 0; font-size: 1.4rem; font-weight: 700; }
.success-card p  { margin: 0; color: var(--text-muted); line-height: 1.6; }
</style>
