<template>
  <div class="registry-detail-page">
    <SiteNav />
    <main>
      <div v-if="loading" class="loading">Loading registry…</div>
      <div v-else-if="!registry" class="not-found">
        <h2>Registry not found</h2>
        <RouterLink to="/gift-registry">← All Registries</RouterLink>
      </div>
      <template v-else>
        <!-- Hero -->
        <section class="reg-hero">
          <div class="reg-type">{{ typeEmoji(registry.event_type) }} {{ registry.event_type }}</div>
          <h1>{{ registry.title }}</h1>
          <div class="reg-date" v-if="registry.event_date">📅 {{ registry.event_date }}</div>
          <p v-if="registry.description" class="reg-desc">{{ registry.description }}</p>
          <div class="reg-host" v-if="registry.customer">
            Created by {{ registry.customer.first_name }} {{ registry.customer.last_name }}
          </div>
        </section>

        <!-- Progress summary -->
        <div class="progress-summary glass-card">
          <div class="ps-stat">
            <div class="ps-val">{{ registry.items?.length || 0 }}</div>
            <div class="ps-label">Items</div>
          </div>
          <div class="ps-stat">
            <div class="ps-val">{{ totalPurchased }}</div>
            <div class="ps-label">Purchased</div>
          </div>
          <div class="ps-stat">
            <div class="ps-val">{{ totalRemaining }}</div>
            <div class="ps-label">Still needed</div>
          </div>
          <div class="ps-progress">
            <div class="ps-bar">
              <div class="ps-fill" :style="{ width: completionPct + '%' }"></div>
            </div>
            <div class="ps-pct">{{ completionPct }}% fulfilled</div>
          </div>
        </div>

        <!-- Items grid -->
        <section class="items-section">
          <h2>Gift List</h2>
          <div class="items-grid">
            <div v-for="item in registry.items" :key="item.id" class="item-card" :class="{ fulfilled: item.remaining === 0 }">
              <div class="fulfilled-overlay" v-if="item.remaining === 0">✅ Fully Gifted!</div>
              <RouterLink :to="`/shop/${item.product_slug}`" class="item-product-link">
                <img v-if="item.cover_image" :src="item.cover_image" :alt="item.name" class="item-img" />
                <div class="item-placeholder" v-else>🎁</div>
              </RouterLink>
              <div class="item-body">
                <RouterLink :to="`/shop/${item.product_slug}`" class="item-name">{{ item.name }}</RouterLink>
                <div class="item-price">€{{ (item.sale_price || item.price)?.toFixed(2) }}</div>
                <div class="item-progress">
                  <span>{{ item.purchased_qty }} / {{ item.quantity }} purchased</span>
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: Math.min(100, (item.purchased_qty / item.quantity) * 100) + '%' }"></div>
                  </div>
                </div>
                <div class="item-notes" v-if="item.notes">{{ item.notes }}</div>

                <!-- Gift button -->
                <button v-if="item.remaining > 0" class="btn-gift" @click="openGift(item)">
                  🎁 Gift This ({{ item.remaining }} remaining)
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Thank you message -->
        <div v-if="registry.thank_you" class="thank-you-card glass-card">
          <h3>A Note from the Registry Owner</h3>
          <p>{{ registry.thank_you }}</p>
        </div>
      </template>
    </main>
    <SiteFooter />

    <!-- Gift Modal -->
    <div v-if="giftTarget" class="modal-overlay" @click.self="giftTarget = null">
      <div class="modal-panel">
        <div class="modal-header">
          <h2>🎁 Gift "{{ giftTarget.name }}"</h2>
          <button class="close-btn" @click="giftTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Your Name</label>
            <input v-model="giftForm.giver_name" placeholder="Your name" />
          </div>
          <div class="form-group">
            <label>Your Email (optional, for confirmation)</label>
            <input v-model="giftForm.giver_email" type="email" placeholder="your@email.com" />
          </div>
          <div class="form-group">
            <label>Quantity ({{ giftTarget.remaining }} remaining)</label>
            <input v-model.number="giftForm.quantity" type="number" min="1" :max="giftTarget.remaining" />
          </div>
          <div class="form-group">
            <label>Message (optional)</label>
            <textarea v-model="giftForm.message" rows="3" placeholder="A note to the recipient…"></textarea>
          </div>
          <div v-if="giftError" class="error-msg">{{ giftError }}</div>
          <div v-if="giftSuccess" class="success-msg">{{ giftSuccess }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="giftTarget = null">Cancel</button>
          <button class="btn-accent" @click="recordGift" :disabled="gifting">
            {{ gifting ? 'Recording…' : 'Record Gift' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const route = useRoute()
const registry = ref(null)
const loading = ref(true)
const giftTarget = ref(null)
const giftError = ref('')
const giftSuccess = ref('')
const gifting = ref(false)
const giftForm = ref({ giver_name: '', giver_email: '', quantity: 1, message: '' })

function typeEmoji (t) { return { wedding: '💍', baby: '👶', birthday: '🎂', other: '🎁' }[t] || '🎁' }

const totalPurchased = computed(() => (registry.value?.items || []).reduce((s, i) => s + (i.purchased_qty || 0), 0))
const totalRemaining = computed(() => (registry.value?.items || []).reduce((s, i) => s + i.remaining, 0))
const completionPct = computed(() => {
  const total = (registry.value?.items || []).reduce((s, i) => s + i.quantity, 0)
  if (!total) return 0
  return Math.round((totalPurchased.value / total) * 100)
})

function openGift (item) {
  giftTarget.value = item
  giftError.value = ''
  giftSuccess.value = ''
  giftForm.value = { giver_name: '', giver_email: '', quantity: 1, message: '' }
}

async function recordGift () {
  if (!giftForm.value.giver_name.trim()) { giftError.value = 'Please enter your name.'; return }
  gifting.value = true
  giftError.value = ''
  try {
    const res = await fetch('/api/gift-registry/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registry_id: registry.value.id, item_id: giftTarget.value.id, ...giftForm.value })
    })
    const data = await res.json()
    if (!res.ok) { giftError.value = data.error || 'Could not record gift.'; gifting.value = false; return }
    giftSuccess.value = '🎉 Your gift has been recorded! Thank you!'
    // Refresh registry
    await loadRegistry()
    setTimeout(() => { giftTarget.value = null }, 2000)
  } catch { giftError.value = 'Network error. Please try again.' }
  gifting.value = false
}

async function loadRegistry () {
  const res = await fetch(`/api/gift-registry/public/${route.params.slug}`)
  if (res.ok) { registry.value = await res.json() }
  else { registry.value = null }
}

onMounted(async () => { await loadRegistry(); loading.value = false })
</script>

<style scoped>
.registry-detail-page { min-height: 100vh; background: hsl(228,4%,10%); color: #fff; }
main { max-width: 960px; margin: 0 auto; padding: 6rem 1.5rem 4rem; }
.loading, .not-found { text-align: center; padding: 4rem 0; color: rgba(255,255,255,0.5); }

.reg-hero { text-align: center; margin-bottom: 2rem; }
.reg-type { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.5); margin-bottom: 0.5rem; }
.reg-hero h1 { font-size: 2.5rem; font-weight: 800; margin: 0 0 0.5rem; }
.reg-date { font-size: 0.9rem; color: rgba(255,255,255,0.5); margin-bottom: 0.5rem; }
.reg-desc { color: rgba(255,255,255,0.6); max-width: 500px; margin: 0 auto 0.75rem; }
.reg-host { font-size: 0.8rem; color: rgba(255,255,255,0.4); }

.glass-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.5rem; padding: 1.5rem; margin-bottom: 2rem; }
.progress-summary { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
.ps-stat { text-align: center; }
.ps-val { font-size: 2rem; font-weight: 700; }
.ps-label { font-size: 0.72rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em; }
.ps-progress { flex: 1; min-width: 200px; }
.ps-bar { height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-bottom: 0.4rem; }
.ps-fill { height: 100%; background: var(--accent,#e03c3c); border-radius: 4px; transition: width 0.5s; }
.ps-pct { font-size: 0.75rem; color: rgba(255,255,255,0.5); }

.items-section h2 { margin-bottom: 1.5rem; }
.items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.25rem; }
.item-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 1.25rem; overflow: hidden; display: flex; flex-direction: column; position: relative; transition: border-color 0.2s; }
.item-card:hover { border-color: rgba(255,255,255,0.2); }
.item-card.fulfilled { opacity: 0.6; }
.fulfilled-overlay { position: absolute; top: 0.75rem; right: 0.75rem; background: rgba(80,200,120,0.9); color: #fff; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 0.5rem; }
.item-product-link { display: block; text-decoration: none; }
.item-img { width: 100%; aspect-ratio: 1; object-fit: cover; }
.item-placeholder { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 3rem; background: rgba(255,255,255,0.04); }
.item-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
.item-name { text-decoration: none; color: #fff; font-weight: 600; font-size: 0.95rem; }
.item-price { color: var(--accent,#e03c3c); font-weight: 700; }
.item-progress { font-size: 0.75rem; color: rgba(255,255,255,0.5); }
.progress-bar { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.25rem; }
.progress-fill { height: 100%; background: var(--accent,#e03c3c); border-radius: 2px; }
.item-notes { font-size: 0.75rem; color: rgba(255,255,255,0.4); font-style: italic; }
.btn-gift { background: var(--accent,#e03c3c); color: #fff; border: none; border-radius: 0.75rem; padding: 0.5rem 1rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; margin-top: auto; }

.thank-you-card h3 { margin: 0 0 0.75rem; font-size: 1rem; }
.thank-you-card p { color: rgba(255,255,255,0.6); font-style: italic; margin: 0; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-panel { background: hsl(228,4%,12%); border: 1px solid rgba(255,255,255,0.12); border-radius: 1.5rem; width: 100%; max-width: 480px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.close-btn { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1.2rem; }
.modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; gap: 0.75rem; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group label { font-size: 0.8rem; color: rgba(255,255,255,0.6); }
.form-group input, .form-group textarea { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.6rem 0.75rem; color: #fff; font-family: inherit; width: 100%; box-sizing: border-box; }
.error-msg { color: #ff6b6b; font-size: 0.85rem; }
.success-msg { color: #50c878; font-size: 0.85rem; }
.btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem; padding: 0.5rem 1.25rem; color: #fff; cursor: pointer; }
.btn-accent { background: var(--accent,#e03c3c); color: #fff; border: none; border-radius: 0.5rem; padding: 0.5rem 1.25rem; cursor: pointer; font-weight: 600; }
.btn-accent:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
