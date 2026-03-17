<template>
  <div class="login-page">
    <div class="login-card glass">
      <div class="login-brand">
        <span class="logo">🪆</span>
        <h1>Pygmy</h1>
        <p>CMS Admin Panel</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" class="input" placeholder="admin@pygmy.local" required autofocus />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" class="input" placeholder="••••••••" required />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="loading" style="width:100%;justify-content:center;">
          {{ loading ? 'Signing in…' : 'Sign In' }}
        </button>
        <p v-if="error" class="error-msg">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    router.push('/dashboard')
  } catch (e) {
    error.value = e.response?.data?.error || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  background-image: radial-gradient(ellipse at 30% 50%, hsl(355,40%,12%) 0%, transparent 60%);
}
.login-card {
  width: 100%;
  max-width: 380px;
  padding: 2.5rem;
}
.login-brand {
  text-align: center;
  margin-bottom: 2rem;
}
.logo {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.5rem;
}
.login-brand h1 { font-size: 1.8rem; margin-bottom: 0.2rem; }
.login-brand p  { color: var(--text-muted); font-size: 0.88rem; }

.login-form { display: flex; flex-direction: column; gap: 0; }
.error-msg {
  margin-top: 0.75rem;
  color: var(--accent);
  font-size: 0.85rem;
  text-align: center;
}
</style>
