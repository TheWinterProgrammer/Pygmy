<template>
  <div>
    <div class="page-header">
      <div>
        <h1>🛒 Preorders</h1>
        <p class="subtitle">Products with preorder enabled — track reservations and manage release dates</p>
      </div>
      <div class="header-actions">
        <RouterLink to="/products" class="btn btn-ghost">← All Products</RouterLink>
      </div>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card">
        <div class="stat-num">{{ stats.total }}</div>
        <div class="stat-label">Preorder Products</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-num">{{ stats.total_reservations }}</div>
        <div class="stat-label">Total Reservations</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.releasing_soon }}</div>
        <div class="stat-label">Releasing in 30 days</div>
      </div>
    </div>

    <div v-if="loading" class="glass section loading-state">Loading preorder products…</div>
    <div v-else-if="!products.length" class="glass section empty-state">
      <div class="empty-icon">🛒</div>
      <h2>No preorder products</h2>
      <p class="text-muted">Enable preorders on a product from the product editor to see it here.</p>
      <RouterLink to="/products" class="btn btn-primary" style="margin-top:1rem;">Go to Products</RouterLink>
    </div>

    <div v-else class="glass-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Preorder Message</th>
            <th>Release Date</th>
            <th>Limit / Count</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td>
              <div class="product-cell">
                <img v-if="p.cover_image" :src="p.cover_image" class="product-thumb" alt="" />
                <div v-else class="product-thumb-placeholder">🛍️</div>
                <div>
                  <div class="product-name">{{ p.name }}</div>
                  <div class="product-sku text-muted">{{ p.sku }}</div>
                </div>
              </div>
            </td>
            <td class="preorder-msg">{{ p.preorder_message || '—' }}</td>
            <td>
              <span v-if="p.preorder_release_date" :class="isReleasingSoon(p.preorder_release_date) ? 'release-soon' : 'release-date'">
                📅 {{ fmtDate(p.preorder_release_date) }}
              </span>
              <span v-else class="text-muted">No date set</span>
            </td>
            <td>
              <div class="reservation-info">
                <div class="res-count">{{ p.preorder_count || 0 }} reserved</div>
                <div class="text-muted" v-if="p.preorder_limit > 0">Limit: {{ p.preorder_limit }}</div>
                <div class="progress-bar" v-if="p.preorder_limit > 0">
                  <div class="progress-fill" :style="{ width: Math.min(100, ((p.preorder_count || 0) / p.preorder_limit) * 100) + '%' }"></div>
                </div>
              </div>
            </td>
            <td>
              <span class="status-pill" :class="p.preorder_count >= p.preorder_limit && p.preorder_limit > 0 ? 'full' : 'open'">
                {{ p.preorder_count >= p.preorder_limit && p.preorder_limit > 0 ? '🔒 Full' : '✅ Open' }}
              </span>
            </td>
            <td class="actions">
              <RouterLink :to="`/products/${p.id}`" class="btn btn-ghost btn-sm">✏️ Edit</RouterLink>
              <button class="btn btn-ghost btn-sm" @click="openRelease(p)">🚀 Release</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Release Modal -->
    <div class="modal-overlay" v-if="releaseModal" @click.self="releaseModal = null">
      <div class="modal glass">
        <div class="modal-header">
          <h2>🚀 Release Preorders — {{ releaseModal.name }}</h2>
          <button class="btn-close" @click="releaseModal = null">✕</button>
        </div>
        <div class="modal-body">
          <p class="info-text">
            This will disable preorders for this product and (optionally) add stock so waiting customers can complete their purchase.
          </p>
          <div class="form-group">
            <label>Add Stock Quantity</label>
            <input v-model.number="releaseStock" type="number" min="0" class="input" placeholder="e.g. 100 (0 = no stock change)" />
            <p class="form-hint">Leave 0 to only disable preorder flag without touching stock.</p>
          </div>
          <div class="form-group">
            <label>Note (for stock history)</label>
            <input v-model="releaseNote" class="input" placeholder="e.g. Initial release batch" />
          </div>
          <div v-if="releaseError" class="error-msg">{{ releaseError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="releaseModal = null">Cancel</button>
          <button class="btn btn-primary" @click="doRelease" :disabled="releasing">
            {{ releasing ? 'Releasing…' : '🚀 Release Now' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const products = ref([])
const loading  = ref(false)
const releaseModal = ref(null)
const releaseStock = ref(0)
const releaseNote  = ref('')
const releaseError = ref('')
const releasing    = ref(false)

const stats = computed(() => {
  if (!products.value.length) return null
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000)
  return {
    total: products.value.length,
    total_reservations: products.value.reduce((s, p) => s + (p.preorder_count || 0), 0),
    releasing_soon: products.value.filter(p => {
      if (!p.preorder_release_date) return false
      const d = new Date(p.preorder_release_date)
      return d >= now && d <= in30
    }).length
  }
})

function isReleasingSoon(dateStr) {
  if (!dateStr) return false
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000)
  const d = new Date(dateStr)
  return d >= now && d <= in30
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/products', { params: { all: 1, limit: 200 } })
    const all = data.products || data
    products.value = all.filter(p => p.preorder_enabled)
  } finally {
    loading.value = false
  }
}

function openRelease(p) {
  releaseModal.value = p
  releaseStock.value = 0
  releaseNote.value = `Preorder release for ${p.name}`
  releaseError.value = ''
}

async function doRelease() {
  if (!releaseModal.value) return
  releasing.value = true
  releaseError.value = ''
  try {
    const p = releaseModal.value
    // Disable preorder
    await api.put(`/products/${p.id}`, { preorder_enabled: false })
    // If adding stock
    if (releaseStock.value > 0) {
      await api.post('/stock-history/adjust', {
        product_id: p.id,
        adjustment: releaseStock.value,
        note: releaseNote.value || 'Preorder release'
      })
    }
    releaseModal.value = null
    load()
  } catch (e) {
    releaseError.value = e.response?.data?.error || 'Release failed'
  } finally {
    releasing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; }
.subtitle { color:#888; font-size:.9rem; margin:.25rem 0 0; }
.header-actions { display:flex; gap:.5rem; }
.stats-strip { display:flex; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap; }
.stat-card { flex:1; min-width:120px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:1rem; padding:1rem 1.25rem; text-align:center; }
.stat-card.accent { border-color:var(--accent); }
.stat-num { font-size:1.75rem; font-weight:700; }
.stat-label { font-size:.8rem; color:#888; margin-top:.25rem; }
.glass-card { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:1.25rem; padding:1.25rem; overflow:auto; }
.glass.section { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:1.25rem; padding:2rem; margin-bottom:1.25rem; }
.loading-state, .empty-state { text-align:center; color:#888; }
.empty-icon { font-size:3rem; margin-bottom:.75rem; }
.data-table { width:100%; border-collapse:collapse; font-size:.9rem; }
.data-table th { text-align:left; padding:.6rem .75rem; border-bottom:1px solid rgba(255,255,255,.08); color:#888; font-weight:500; font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; }
.data-table td { padding:.75rem; border-bottom:1px solid rgba(255,255,255,.05); vertical-align:middle; }
.data-table tr:last-child td { border-bottom:none; }
.product-cell { display:flex; align-items:center; gap:.75rem; }
.product-thumb { width:40px; height:40px; object-fit:cover; border-radius:.5rem; }
.product-thumb-placeholder { width:40px; height:40px; background:rgba(255,255,255,.08); border-radius:.5rem; display:flex; align-items:center; justify-content:center; font-size:1.2rem; }
.product-name { font-weight:500; }
.product-sku { font-size:.8rem; }
.preorder-msg { font-size:.85rem; color:#aaa; max-width:180px; }
.release-date { font-size:.85rem; color:#93c5fd; }
.release-soon { font-size:.85rem; color:#f6ad55; font-weight:600; }
.reservation-info { display:flex; flex-direction:column; gap:.25rem; }
.res-count { font-weight:600; }
.progress-bar { height:4px; background:rgba(255,255,255,.1); border-radius:2px; overflow:hidden; margin-top:.25rem; }
.progress-fill { height:100%; background:var(--accent); border-radius:2px; transition:width .3s; }
.status-pill { display:inline-block; padding:.25rem .75rem; border-radius:2rem; font-size:.8rem; font-weight:600; }
.status-pill.open { background:rgba(72,187,120,.15); color:#48bb78; }
.status-pill.full { background:rgba(245,101,101,.15); color:#f56565; }
.actions { display:flex; gap:.35rem; }

/* Modal */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:200; backdrop-filter:blur(4px); }
.modal { background:hsl(228,4%,14%); border:1px solid rgba(255,255,255,.12); border-radius:1.5rem; width:100%; max-width:480px; max-height:90vh; overflow:auto; }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid rgba(255,255,255,.08); }
.modal-header h2 { margin:0; font-size:1.1rem; }
.btn-close { background:none; border:none; color:#888; font-size:1.1rem; cursor:pointer; }
.modal-body { padding:1.5rem; display:flex; flex-direction:column; gap:1rem; }
.info-text { color:#aaa; font-size:.9rem; margin:0; }
.form-group { display:flex; flex-direction:column; gap:.35rem; }
.form-group label { font-size:.85rem; font-weight:500; }
.form-hint { font-size:.8rem; color:#888; margin:.2rem 0 0; }
.error-msg { color:#f56565; font-size:.85rem; background:rgba(245,101,101,.1); padding:.5rem .75rem; border-radius:.5rem; }
.modal-footer { display:flex; gap:.5rem; justify-content:flex-end; padding:1rem 1.5rem; border-top:1px solid rgba(255,255,255,.08); }
</style>
