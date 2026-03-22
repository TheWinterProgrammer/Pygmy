<template>
  <div>
    <div class="page-header">
      <h1>📥 Digital Downloads</h1>
      <RouterLink to="/products" class="btn btn-ghost">← Products</RouterLink>
    </div>

    <!-- Stats strip -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-label">Digital Products</div>
        <div class="stat-value">{{ stats.products }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Total Files</div>
        <div class="stat-value">{{ stats.files }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Active Tokens</div>
        <div class="stat-value accent">{{ stats.activeTokens }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Total Downloads</div>
        <div class="stat-value">{{ stats.totalDownloads }}</div>
      </div>
    </div>

    <!-- Product cards -->
    <div v-if="loading" class="glass section"><div class="loading-bar"></div></div>

    <div v-else-if="!products.length" class="glass section empty-state">
      <div style="font-size:3rem;margin-bottom:1rem">📥</div>
      <h3>No digital products yet</h3>
      <p class="text-muted">Mark a product as digital in its edit view and upload downloadable files.</p>
      <RouterLink to="/products" class="btn btn-primary" style="margin-top:1rem">Browse Products</RouterLink>
    </div>

    <div v-else>
      <div class="product-card glass" v-for="p in products" :key="p.id">
        <div class="product-header" @click="toggleExpand(p.id)">
          <div class="product-thumb">
            <img v-if="p.cover_image" :src="p.cover_image" :alt="p.name" />
            <div v-else class="thumb-placeholder">📦</div>
          </div>
          <div class="product-info">
            <div class="product-name">{{ p.name }}</div>
            <div class="product-meta text-muted">
              <span class="status-pill" :class="p.status">{{ p.status }}</span>
              <span class="dot">·</span>
              {{ p.file_count }} file{{ p.file_count !== 1 ? 's' : '' }}
              <span class="dot" v-if="p.token_count > 0">·</span>
              <span v-if="p.token_count > 0" class="accent-text">{{ p.token_count }} active token{{ p.token_count !== 1 ? 's' : '' }}</span>
            </div>
          </div>
          <div class="product-actions">
            <RouterLink :to="`/products/${p.id}`" class="btn btn-ghost btn-sm" @click.stop>✏️ Edit</RouterLink>
            <span class="expand-arrow" :class="{ open: expanded.has(p.id) }">▾</span>
          </div>
        </div>

        <!-- Expanded: files + tokens -->
        <div class="product-body" v-if="expanded.has(p.id)">
          <!-- Files -->
          <div class="sub-section">
            <div class="sub-title">Files</div>
            <div v-if="!p.files?.length" class="empty-sub">No files uploaded for this product.</div>
            <div class="file-row" v-for="f in (p.files || [])" :key="f.id">
              <span class="file-icon">{{ iconFor(f.mime_type) }}</span>
              <span class="file-name">{{ f.label }}</span>
              <span class="file-meta text-muted">{{ humanSize(f.file_size) }}</span>
              <span class="pill" v-if="f.download_limit > 0">max {{ f.download_limit }} dl</span>
              <span class="pill" v-if="f.expires_days > 0">exp {{ f.expires_days }}d</span>
            </div>
          </div>

          <!-- Recent orders with tokens -->
          <div class="sub-section" v-if="p.recentOrders?.length">
            <div class="sub-title">Recent Order Tokens</div>
            <div class="token-row" v-for="t in (p.recentOrders || [])" :key="t.token">
              <div class="token-info">
                <span class="token-order">{{ t.order_number }}</span>
                <span class="dot">·</span>
                <span class="text-muted">{{ t.customer_email }}</span>
                <span class="dot">·</span>
                <span class="text-muted">{{ t.file_label }}</span>
              </div>
              <div class="token-status">
                <span class="pill success" v-if="!t.expired && !t.exhausted">
                  {{ t.download_count }}/{{ t.download_limit || '∞' }} uses
                </span>
                <span class="pill danger" v-else-if="t.expired">Expired</span>
                <span class="pill danger" v-else-if="t.exhausted">Exhausted</span>
                <span v-if="t.expires_at" class="text-muted" style="font-size:.75rem;">
                  · exp {{ fmtDate(t.expires_at) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Issue tokens modal -->
    <div v-if="issueModal" class="modal-overlay" @click.self="issueModal = null">
      <div class="modal-box glass">
        <h3>🔑 Issue Download Tokens</h3>
        <div class="form-group">
          <label>Order ID</label>
          <input class="input" v-model="issueOrderId" type="number" placeholder="Order ID…" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="issueModal = null">Cancel</button>
          <button class="btn btn-primary" @click="issueTokens" :disabled="issuing">{{ issuing ? 'Issuing…' : 'Issue Tokens' }}</button>
        </div>
        <p v-if="issueResult" class="issue-result" :class="issueResult.ok ? 'success' : 'error'">
          {{ issueResult.message }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const loading = ref(true)
const products = ref([])
const stats = ref(null)
const expanded = reactive(new Set())
const issueModal = ref(false)
const issueOrderId = ref('')
const issuing = ref(false)
const issueResult = ref(null)

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

function humanSize(bytes) {
  if (!bytes) return '—'
  const units = ['B','KB','MB','GB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++ }
  return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/digital-downloads/admin/overview')
    products.value = data.products || []
    stats.value = data.stats
  } catch {
    // Fallback: load digital products manually
    try {
      const { data: prods } = await api.get('/products', { params: { all: 1, limit: 200 } })
      const digital = (prods.products || prods).filter(p => p.is_digital)
      // Load files for each
      products.value = await Promise.all(digital.map(async p => {
        try {
          const { data: files } = await api.get(`/digital-downloads/files?product_id=${p.id}`)
          return { ...p, files, file_count: files.length, token_count: 0, recentOrders: [] }
        } catch { return { ...p, files: [], file_count: 0, token_count: 0, recentOrders: [] } }
      }))
      stats.value = {
        products: products.value.length,
        files: products.value.reduce((s, p) => s + p.file_count, 0),
        activeTokens: 0,
        totalDownloads: 0,
      }
    } catch {}
  } finally {
    loading.value = false
  }
}

function toggleExpand(id) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

async function issueTokens() {
  if (!issueOrderId.value) return
  issuing.value = true
  issueResult.value = null
  try {
    const { data } = await api.post('/digital-downloads/issue', { order_id: parseInt(issueOrderId.value) })
    issueResult.value = { ok: true, message: `Issued ${data.tokens_issued} token(s) successfully.` }
    toast.success('Tokens issued!')
  } catch (e) {
    issueResult.value = { ok: false, message: e.response?.data?.error || 'Failed to issue tokens.' }
  } finally {
    issuing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.stats-row { display: flex; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.stat-card { padding: 1rem 1.25rem; border-radius: 0.75rem; min-width: 130px; }
.stat-label { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; }
.stat-value { font-size: 1.5rem; font-weight: 700; }
.stat-value.accent { color: var(--accent); }

.empty-state { padding: 3rem; text-align: center; }

/* Product cards */
.product-card { margin-bottom: 0.75rem; border-radius: 0.875rem; overflow: hidden; }
.product-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1.125rem;
  cursor: pointer;
  transition: background 0.15s;
}
.product-header:hover { background: rgba(255,255,255,0.03); }

.product-thumb {
  width: 44px; height: 44px;
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  font-size: 1.2rem;
}
.product-thumb img { width: 100%; height: 100%; object-fit: cover; }

.product-info { flex: 1; min-width: 0; }
.product-name { font-weight: 600; font-size: 0.95rem; }
.product-meta { font-size: 0.78rem; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.2rem; }

.status-pill { padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.68rem; font-weight: 600; }
.status-pill.published { background: hsl(142,60%,15%); color: hsl(142,60%,55%); }
.status-pill.draft { background: rgba(255,255,255,0.06); color: var(--text-muted); }

.product-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.expand-arrow { font-size: 0.85rem; color: var(--text-muted); transition: transform 0.2s; }
.expand-arrow.open { transform: rotate(180deg); }
.accent-text { color: var(--accent); }
.dot { opacity: 0.4; }

/* Product body */
.product-body { border-top: 1px solid rgba(255,255,255,0.07); padding: 1rem 1.125rem; display: flex; flex-direction: column; gap: 1.25rem; }
.sub-section {}
.sub-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); margin-bottom: 0.6rem; }
.empty-sub { font-size: 0.82rem; color: var(--text-muted); }

.file-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  background: rgba(255,255,255,0.03);
  border-radius: 0.5rem;
  margin-bottom: 0.3rem;
  font-size: 0.85rem;
}
.file-icon { font-size: 1rem; }
.file-name { flex: 1; font-weight: 500; }
.file-meta { font-size: 0.75rem; }

.token-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.625rem;
  padding: 0.45rem 0.625rem;
  background: rgba(255,255,255,0.03);
  border-radius: 0.5rem;
  margin-bottom: 0.3rem;
  font-size: 0.82rem;
  flex-wrap: wrap;
}
.token-info { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
.token-order { font-weight: 600; }
.token-status { display: flex; align-items: center; gap: 0.3rem; }

.pill {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(255,255,255,0.08);
  color: var(--text-muted);
}
.pill.success { background: hsl(142,60%,15%); color: hsl(142,60%,60%); }
.pill.danger { background: hsl(355,60%,18%); color: hsl(355,60%,65%); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}
.modal-box { width: 400px; max-width: 95vw; padding: 1.75rem; border-radius: 1.25rem; }
.modal-box h3 { margin: 0 0 1rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
.issue-result { margin-top: 0.75rem; font-size: 0.85rem; padding: 0.5rem 0.75rem; border-radius: 0.5rem; }
.issue-result.success { background: hsl(142,60%,12%); color: hsl(142,60%,60%); }
.issue-result.error { background: hsl(355,60%,15%); color: hsl(355,60%,65%); }
</style>
