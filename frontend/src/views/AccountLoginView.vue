<template>
  <div class="auth-page">
    <div class="auth-card glass">
      <div class="auth-logo">🪆</div>
      <h1 class="auth-title">{{ mode === 'login' ? 'Sign In' : 'Create Account' }}</h1>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <template v-if="mode === 'register'">
          <div class="form-row">
            <div class="form-group">
              <label>First Name</label>
              <input v-model="form.first_name" type="text" class="input" placeholder="Jane" />
            </div>
            <div class="form-group">
              <label>Last Name</label>
              <input v-model="form.last_name" type="text" class="input" placeholder="Doe" />
            </div>
          </div>
        </template>

        <div class="form-group">
          <label>Email</label>
          <input v-model="form.email" type="email" class="input" placeholder="you@example.com" required />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input v-model="form.password" type="password" class="input" placeholder="••••••••" required minlength="6" />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button type="submit" class="btn btn-accent btn-full" :disabled="loading">
          {{ loading ? 'Please wait…' : (mode === 'login' ? 'Sign In' : 'Create Account') }}
        </button>
      </form>

      <div class="auth-toggle">
        <template v-if="mode === 'login'">
          Don't have an account?
          <button class="link-btn" @click="mode = 'register'; error = ''">Create one</button>
        </template>
        <template v-else>
          Already have an account?
          <button class="link-btn" @click="mode = 'login'; error = ''">Sign in</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useCustomerStore } from '../stores/customer.js'

const router = useRouter()
const route = useRoute()
const store = useCustomerStore()

const mode = ref(route.query.mode === 'register' ? 'register' : 'login')
const loading = ref(false)
const error = ref('')
const form = reactive({ email: '', password: '', first_name: '', last_name: '' })

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'login') {
      await store.login(form.email, form.password)
    } else {
      await store.register(form)
    }
    const redirect = route.query.redirect || '/account'
    router.push(redirect)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--bg);
}

.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 2.5rem;
  border-radius: 1.5rem;
  text-align: center;
}

.auth-logo {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.auth-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 2rem;
  color: var(--text);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text);
  padding: 0.65rem 0.9rem;
  border-radius: 0.6rem;
  font-size: 0.95rem;
  width: 100%;
}

.input:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-full { width: 100%; margin-top: 0.5rem; }

.error-msg {
  background: rgba(239,68,68,0.15);
  border: 1px solid rgba(239,68,68,0.3);
  color: #f87171;
  padding: 0.6rem 1rem;
  border-radius: 0.6rem;
  font-size: 0.875rem;
}

.auth-toggle {
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: var(--muted);
}

.link-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  margin-left: 0.25rem;
  text-decoration: underline;
}
</style>
