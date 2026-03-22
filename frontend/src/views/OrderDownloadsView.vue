<template>
  <div class="downloads-page">
    <SiteNav />
    <div class="container">
      <!-- Lookup form -->
      <div class="lookup-card glass" v-if="!downloads">
        <div class="icon">📥</div>
        <h1>Access Your Downloads</h1>
        <p class="subtitle">Enter your order number and email to access your digital files.</p>

        <form @submit.prevent="lookupDownloads" class="lookup-form">
          <div class="form-group">
            <label>Order Number</label>
            <input
              v-model="form.order_number"
              class="input"
              placeholder="ORD-240101-1234"
              :value="prefillOrder || form.order_number"
              @input="form.order_number = $event.target.value"
            />
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input v-model="form.email" class="input" type="email" placeholder="you@example.com" />
          </div>
          <div class="error-msg" v-if="error">{{ error }}</div>
          <button class="btn btn-primary" type="submit" :disabled="loading">
            {{ loading ? 'Looking up…' : 'Get My Downloads' }}
          </button>
        </form>
      </div>

      <!-- Downloads list -->
      <div v-else class="downloads-card glass">
        <div class="icon">📥</div>
        <h1>Your Downloads</h1>
        <p class="order-ref">Order <strong class="accent">{{ form.order_number }}</strong></p>

        <div v-if="!downloads.length" class="empty-state">
          <p>No downloadable files found for this order.</p>
          <button class="btn btn-ghost" @click="downloads = null">← Try another order</button>
        </div>

        <div v-else class="files-list">
          <div class="file-card" v-for="d in downloads" :key="d.token">
            <div class="file-icon">{{ iconFor(d.mime_type) }}</div>
            <div class="file-info">
              <div class="file-label">{{ d.label }}</div>
              <div class="file-meta">
                {{ d.size_human }}
                <span class="dot" v-if="d.expires_at">·</span>
                <span v-if="d.expires_at && !d.expired" class="meta-tag">
                  Expires {{ fmtDate(d.expires_at) }}
                </span>
                <span v-if="d.expired" class="meta-tag expired">Link expired</span>
                <span class="dot" v-if="d.download_limit > 0">·</span>
                <span v-if="d.download_limit > 0" class="meta-tag">
                  {{ d.download_count }} / {{ d.download_limit }} downloads used
                </span>
              </div>
            </div>
            <div class="file-action">
              <a
                v-if="!d.expired && !d.exhausted"
                :href="`http://localhost:3200/api/digital-downloads/${d.token}`"
                class="btn btn-primary"
                download
              >⬇️ Download</a>
              <span v-else class="btn btn-ghost" style="cursor:default; opacity:.5;">
                {{ d.expired ? 'Expired' : 'Limit reached' }}
              </span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <button class="btn btn-ghost" @click="downloads = null">← Try another order</button>
          <RouterLink to="/shop" class="btn btn-ghost">🛍️ Continue shopping</RouterLink>
        </div>
      </div>
    </div>
    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'
import api from '../api.js'

const route = useRoute()
const prefillOrder = route.query.order || ''

const form = ref({ order_number: prefillOrder, email: '' })
const downloads = ref(null)
const loading = ref(false)
const error = ref('')

function iconFor(mime) {
  if (!mime) return '📄'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.startsWith('video/')) return '🎬'
  if (mime === 'application/pdf') return '📕'
  if (mime.includes('zip')) return '🗜️'
  if (mime.startsWith('text/')) return '📝'
  return '📦'
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function lookupDownloads() {
  if (!form.value.order_number || !form.value.email) {
    error.value = 'Please fill in both fields.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.post('/digital-downloads/order-links', {
      order_number: form.value.order_number.trim(),
      email: form.value.email.trim(),
    })
    if (!data.length) {
      error.value = 'No downloadable files found for this order.'
      return
    }
    downloads.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'Order not found. Please check your details.'
  } finally {
    loading.value = false
  }
}

// Auto-submit if both fields come from query params (rare but useful for confirmation email links)
onMounted(() => {
  if (route.query.order && route.query.email) {
    form.value.email = route.query.email
    lookupDownloads()
  }
})
</script>

<style scoped>
.downloads-page { min-height: 100vh; }
.container { max-width: 640px; margin: 0 auto; padding: 6rem 1.25rem 4rem; }

.lookup-card, .downloads-card {
  border-radius: 1.5rem;
  padding: 2.5rem 2rem;
  text-align: center;
}

.icon { font-size: 3.5rem; margin-bottom: 0.75rem; }
h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 0.5rem; }
.subtitle { color: var(--text-muted); font-size: 0.92rem; margin-bottom: 1.75rem; }
.order-ref { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
.accent { color: var(--accent); font-size: 1rem; }

/* Lookup form */
.lookup-form { text-align: left; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem; }
.error-msg {
  background: hsl(355,60%,15%);
  color: hsl(355,60%,65%);
  border-radius: 0.5rem;
  padding: 0.625rem 0.875rem;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

/* Files list */
.files-list { display: flex; flex-direction: column; gap: 0.75rem; margin: 1.5rem 0; text-align: left; }
.file-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.75rem;
}
.file-icon { font-size: 1.5rem; flex-shrink: 0; }
.file-info { flex: 1; min-width: 0; }
.file-label { font-size: 0.92rem; font-weight: 600; margin-bottom: 0.25rem; }
.file-meta { font-size: 0.75rem; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
.dot { opacity: 0.4; }
.meta-tag { font-size: 0.7rem; background: rgba(255,255,255,0.07); border-radius: 999px; padding: 0.1rem 0.45rem; }
.meta-tag.expired { background: hsl(355,60%,15%); color: hsl(355,60%,65%); }
.file-action { flex-shrink: 0; }

.empty-state { padding: 1.5rem; color: var(--text-muted); }

.card-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.07);
  padding-top: 1.25rem;
}
</style>
