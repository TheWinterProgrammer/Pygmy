<template>
  <div class="login-page">
    <div class="login-card glass">
      <div class="login-brand">
        <span class="logo">🪆</span>
        <h1>Pygmy</h1>
        <p>{{ step === '2fa' ? 'Two-Factor Authentication' : 'CMS Admin Panel' }}</p>
      </div>

      <!-- Step 1: email + password -->
      <form v-if="step === 'credentials'" @submit.prevent="handleLogin" class="login-form">
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

      <!-- Step 2: 2FA OTP -->
      <form v-else-if="step === '2fa'" @submit.prevent="handle2fa" class="login-form">
        <p class="tfa-hint">Open your authenticator app and enter the 6-digit code.</p>
        <div class="form-group">
          <label>Authenticator Code</label>
          <input
            v-model="otp"
            class="input otp-input"
            placeholder="000000"
            maxlength="6"
            inputmode="numeric"
            autofocus
            required
          />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="loading || otp.length < 6" style="width:100%;justify-content:center;">
          {{ loading ? 'Verifying…' : 'Verify' }}
        </button>
        <button type="button" class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:0.4rem;" @click="step = 'credentials'; otp = ''">
          ← Back
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
const otp = ref('')
const loading = ref(false)
const error = ref('')
const step = ref('credentials') // 'credentials' | '2fa'

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    router.push('/dashboard')
  } catch (e) {
    // Status 206 means 2FA is required
    if (e.response?.status === 206 && e.response?.data?.requires_2fa) {
      step.value = '2fa'
    } else {
      error.value = e.response?.data?.error || 'Login failed'
    }
  } finally {
    loading.value = false
  }
}

async function handle2fa() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value, otp.value)
    router.push('/dashboard')
  } catch (e) {
    error.value = e.response?.data?.error || 'Invalid code'
    otp.value = ''
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
.tfa-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 1rem;
}
.otp-input {
  letter-spacing: 0.3em;
  font-size: 1.3rem;
  text-align: center;
}
</style>
