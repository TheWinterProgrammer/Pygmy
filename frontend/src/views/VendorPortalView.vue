<template>
  <div class="vendor-portal">
    <SiteNav />

    <!-- Login screen (no token) -->
    <div v-if="!token" class="portal-login-wrap">
      <div class="glass portal-login-card">
        <div class="portal-logo">🏪</div>
        <h1>Vendor Portal</h1>
        <p class="portal-subtitle">Manage your store, products, and earnings</p>

        <!-- Tab: Login / Register -->
        <div class="auth-tabs">
          <button :class="['tab-btn', { active: authTab === 'login' }]" @click="authTab = 'login'">Sign In</button>
          <button :class="['tab-btn', { active: authTab === 'register' }]" @click="authTab = 'register'">Apply</button>
        </div>

        <!-- Login form -->
        <form v-if="authTab === 'login'" @submit.prevent="doLogin" class="auth-form">
          <input v-model="loginEmail" type="email" placeholder="Email" required class="form-input" />
          <input v-model="loginPassword" type="password" placeholder="Password" required class="form-input" />
          <button type="submit" class="btn btn-primary" :disabled="authLoading">
            {{ authLoading ? 'Signing in…' : 'Sign In' }}
          </button>
          <p v-if="authError" class="auth-error">{{ authError }}</p>
        </form>

        <!-- Register / Apply form -->
        <form v-else @submit.prevent="doRegister" class="auth-form">
          <input v-model="regName" placeholder="Store Name" required class="form-input" />
          <input v-model="regEmail" type="email" placeholder="Email" required class="form-input" />
          <input v-model="regPassword" type="password" placeholder="Password (min 8 chars)" required minlength="8" class="form-input" />
          <textarea v-model="regDesc" placeholder="Describe your store (optional)" rows="3" class="form-input"></textarea>
          <button type="submit" class="btn btn-primary" :disabled="authLoading">
            {{ authLoading ? 'Submitting…' : 'Apply to Sell' }}
          </button>
          <p v-if="authError" class="auth-error">{{ authError }}</p>
          <p class="auth-note">Applications are reviewed and approved before your store goes live.</p>
        </form>
      </div>
    </div>

    <!-- Portal Dashboard (authenticated) -->
    <div v-else class="portal-dashboard">
      <!-- Sidebar -->
      <aside class="portal-sidebar glass">
        <div class="sidebar-vendor" v-if="vendorData">
          <div class="sidebar-logo">
            <img v-if="vendorData.logo" :src="vendorData.logo" :alt="vendorData.name" />
            <span v-else>{{ vendorData.name?.[0] }}</span>
          </div>
          <div class="sidebar-name">{{ vendorData.name }}</div>
          <div :class="['sidebar-status', vendorData.status]">{{ vendorData.status }}</div>
        </div>
        <nav class="sidebar-nav">
          <button v-for="t in tabs" :key="t.key" :class="['nav-btn', { active: activeTab === t.key }]" @click="activeTab = t.key">
            {{ t.icon }} {{ t.label }}
          </button>
        </nav>
        <button class="nav-btn logout-btn" @click="logout">🚪 Sign Out</button>
      </aside>

      <!-- Main content -->
      <main class="portal-main">

        <!-- Dashboard Overview -->
        <section v-if="activeTab === 'dashboard'">
          <h2>📊 Dashboard</h2>
          <div v-if="stats" class="stats-strip">
            <div class="stat-card">
              <div class="stat-value">{{ fmt(stats.total_sales) }}</div>
              <div class="stat-label">Total Sales</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ fmt(stats.net_earnings) }}</div>
              <div class="stat-label">Net Earnings</div>
            </div>
            <div class="stat-card accent">
              <div class="stat-value">{{ fmt(stats.pending_payout) }}</div>
              <div class="stat-label">Pending Payout</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ stats.order_count }}</div>
              <div class="stat-label">Orders</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ stats.product_count }}</div>
              <div class="stat-label">Products</div>
            </div>
          </div>

          <div class="glass section-card" v-if="stats?.recent_orders?.length">
            <h3>Recent Orders</h3>
            <table class="portal-table">
              <thead><tr><th>Order</th><th>Product</th><th>Qty</th><th>Amount</th><th>Commission</th><th>Date</th></tr></thead>
              <tbody>
                <tr v-for="o in stats.recent_orders" :key="o.id">
                  <td><code>{{ o.order_number }}</code></td>
                  <td>{{ o.product_name }}</td>
                  <td>{{ o.quantity }}</td>
                  <td>{{ fmt(o.vendor_amount) }}</td>
                  <td class="commission-cell">−{{ fmt(o.commission_amount) }}</td>
                  <td>{{ fmtDate(o.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Products -->
        <section v-if="activeTab === 'products'">
          <div class="section-top">
            <h2>🛍️ Products</h2>
            <button class="btn btn-primary" @click="openProductForm()">+ New Product</button>
          </div>

          <div v-if="productsLoading" class="loading-row">Loading…</div>
          <div v-else-if="!myProducts.length" class="empty-msg glass">No products yet. Add your first product!</div>
          <div v-else class="glass section-card">
            <table class="portal-table">
              <thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Status</th><th>Stock</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="p in myProducts" :key="p.id">
                  <td><img v-if="p.cover_image" :src="p.cover_image" class="product-thumb" :alt="p.name" /></td>
                  <td>{{ p.name }}</td>
                  <td>{{ fmt(p.sale_price || p.price) }}</td>
                  <td><span :class="['status-pill', p.status]">{{ p.status }}</span></td>
                  <td>{{ p.track_stock ? p.stock_quantity : '∞' }}</td>
                  <td>
                    <button class="icon-btn" @click="openProductForm(p)" title="Edit">✏️</button>
                    <button class="icon-btn danger" @click="deleteProduct(p)" title="Delete">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Orders -->
        <section v-if="activeTab === 'orders'">
          <h2>📦 Orders</h2>
          <div v-if="ordersLoading" class="loading-row">Loading…</div>
          <div v-else-if="!myOrders.length" class="empty-msg glass">No orders yet.</div>
          <div v-else class="glass section-card">
            <table class="portal-table">
              <thead><tr><th>Order #</th><th>Product</th><th>Qty</th><th>Your Revenue</th><th>Commission</th><th>Date</th></tr></thead>
              <tbody>
                <tr v-for="o in myOrders" :key="o.id">
                  <td><code>{{ o.order_number }}</code></td>
                  <td>{{ o.product_name }}</td>
                  <td>{{ o.quantity }}</td>
                  <td>{{ fmt(o.vendor_amount) }}</td>
                  <td class="commission-cell">−{{ fmt(o.commission_amount) }}</td>
                  <td>{{ fmtDate(o.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Payouts -->
        <section v-if="activeTab === 'payouts'">
          <h2>💰 Payouts</h2>
          <div v-if="!myPayouts.length" class="empty-msg glass">No payouts recorded yet.</div>
          <div v-else class="glass section-card">
            <table class="portal-table">
              <thead><tr><th>Amount</th><th>Status</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>
                <tr v-for="p in myPayouts" :key="p.id">
                  <td>{{ fmt(p.amount) }}</td>
                  <td><span :class="['status-pill', p.status]">{{ p.status }}</span></td>
                  <td>{{ p.note || '—' }}</td>
                  <td>{{ fmtDate(p.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Profile -->
        <section v-if="activeTab === 'profile'">
          <h2>⚙️ Store Profile</h2>
          <div class="glass section-card" v-if="vendorData">
            <form @submit.prevent="saveProfile" class="profile-form">
              <div class="form-group">
                <label>Store Name</label>
                <input v-model="profileForm.name" class="form-input" />
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea v-model="profileForm.description" rows="4" class="form-input"></textarea>
              </div>
              <div class="form-group">
                <label>Logo URL</label>
                <input v-model="profileForm.logo" class="form-input" placeholder="https://..." />
              </div>
              <div class="form-group">
                <label>Banner URL</label>
                <input v-model="profileForm.banner" class="form-input" placeholder="https://..." />
              </div>
              <div class="form-group">
                <label>Payout Info (bank account, PayPal, etc.)</label>
                <textarea v-model="profileForm.payout_info_raw" rows="3" class="form-input" placeholder="Your payment details for payouts…"></textarea>
              </div>
              <button type="submit" class="btn btn-primary" :disabled="profileSaving">
                {{ profileSaving ? 'Saving…' : '💾 Save Profile' }}
              </button>
              <p v-if="profileMsg" class="success-msg">{{ profileMsg }}</p>
            </form>
          </div>

          <div class="glass section-card store-link-card" v-if="vendorData">
            <p>🔗 Your public store URL:</p>
            <a :href="`/vendors/${vendorData.slug}`" target="_blank" class="store-url">/vendors/{{ vendorData.slug }}</a>
          </div>
        </section>
      </main>
    </div>

    <!-- Product form modal -->
    <div class="modal-overlay" v-if="showProductModal" @click.self="showProductModal = false">
      <div class="glass modal-card">
        <div class="modal-header">
          <h3>{{ editProduct ? 'Edit Product' : 'New Product' }}</h3>
          <button class="close-btn" @click="showProductModal = false">✕</button>
        </div>
        <form @submit.prevent="saveProduct" class="product-form">
          <div class="form-row">
            <div class="form-group">
              <label>Name *</label>
              <input v-model="productForm.name" class="form-input" required />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select v-model="productForm.status" class="form-input">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Price (€) *</label>
              <input v-model="productForm.price" type="number" step="0.01" min="0" class="form-input" required />
            </div>
            <div class="form-group">
              <label>Sale Price (€)</label>
              <input v-model="productForm.sale_price" type="number" step="0.01" min="0" class="form-input" />
            </div>
          </div>
          <div class="form-group">
            <label>Cover Image URL</label>
            <input v-model="productForm.cover_image" class="form-input" placeholder="https://..." />
          </div>
          <div class="form-group">
            <label>Excerpt</label>
            <input v-model="productForm.excerpt" class="form-input" placeholder="Short description…" />
          </div>
          <div class="form-group">
            <label>SKU</label>
            <input v-model="productForm.sku" class="form-input" placeholder="Optional SKU…" />
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="showProductModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="productSaving">
              {{ productSaving ? 'Saving…' : '💾 Save' }}
            </button>
          </div>
          <p v-if="productError" class="auth-error">{{ productError }}</p>
        </form>
      </div>
    </div>

    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'

// ─── Auth ──────────────────────────────────────────────────────────────────────
const token = ref(localStorage.getItem('vendorToken') || '')
const vendorData = ref(null)
const authTab = ref('login')
const authLoading = ref(false)
const authError = ref('')

const loginEmail = ref('')
const loginPassword = ref('')
const regName = ref('')
const regEmail = ref('')
const regPassword = ref('')
const regDesc = ref('')

async function doLogin() {
  authLoading.value = true; authError.value = ''
  try {
    const res = await fetch(`${API}/api/vendors/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value })
    })
    const data = await res.json()
    if (!res.ok) { authError.value = data.error || 'Login failed'; return }
    token.value = data.token
    vendorData.value = data.vendor
    localStorage.setItem('vendorToken', data.token)
    loadAll()
  } catch { authError.value = 'Network error' }
  finally { authLoading.value = false }
}

async function doRegister() {
  authLoading.value = true; authError.value = ''
  try {
    const res = await fetch(`${API}/api/vendors/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: regName.value, email: regEmail.value, password: regPassword.value, description: regDesc.value })
    })
    const data = await res.json()
    if (!res.ok) { authError.value = data.error || 'Registration failed'; return }
    if (data.vendor?.status === 'pending') {
      authError.value = ''
      authTab.value = 'login'
      loginEmail.value = regEmail.value
      authError.value = '✅ Application submitted! You will be notified once approved.'
      return
    }
    token.value = data.token
    vendorData.value = data.vendor
    localStorage.setItem('vendorToken', data.token)
    loadAll()
  } catch { authError.value = 'Network error' }
  finally { authLoading.value = false }
}

function logout() {
  token.value = ''
  vendorData.value = null
  localStorage.removeItem('vendorToken')
}

function authHeader() { return { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' } }

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const activeTab = ref('dashboard')
const tabs = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'products', icon: '🛍️', label: 'Products' },
  { key: 'orders', icon: '📦', label: 'Orders' },
  { key: 'payouts', icon: '💰', label: 'Payouts' },
  { key: 'profile', icon: '⚙️', label: 'Profile' },
]

// ─── Stats ────────────────────────────────────────────────────────────────────
const stats = ref(null)
async function loadStats() {
  const res = await fetch(`${API}/api/vendors/me/stats`, { headers: authHeader() })
  if (res.ok) stats.value = await res.json()
}

// ─── Products ─────────────────────────────────────────────────────────────────
const myProducts = ref([])
const productsLoading = ref(false)
async function loadProducts() {
  productsLoading.value = true
  const res = await fetch(`${API}/api/vendors/me/products`, { headers: authHeader() })
  if (res.ok) myProducts.value = await res.json()
  productsLoading.value = false
}

// ─── Orders ───────────────────────────────────────────────────────────────────
const myOrders = ref([])
const ordersLoading = ref(false)
async function loadOrders() {
  ordersLoading.value = true
  const res = await fetch(`${API}/api/vendors/me/orders?limit=100`, { headers: authHeader() })
  if (res.ok) { const d = await res.json(); myOrders.value = d.items || [] }
  ordersLoading.value = false
}

// ─── Payouts ──────────────────────────────────────────────────────────────────
const myPayouts = ref([])
async function loadPayouts() {
  const res = await fetch(`${API}/api/vendors/me/payouts`, { headers: authHeader() })
  if (res.ok) myPayouts.value = await res.json()
}

// ─── Profile ──────────────────────────────────────────────────────────────────
const profileForm = reactive({ name: '', description: '', logo: '', banner: '', payout_info_raw: '' })
const profileSaving = ref(false)
const profileMsg = ref('')

async function loadProfile() {
  const res = await fetch(`${API}/api/vendors/me`, { headers: authHeader() })
  if (res.ok) {
    vendorData.value = await res.json()
    profileForm.name = vendorData.value.name || ''
    profileForm.description = vendorData.value.description || ''
    profileForm.logo = vendorData.value.logo || ''
    profileForm.banner = vendorData.value.banner || ''
    profileForm.payout_info_raw = typeof vendorData.value.payout_info === 'string'
      ? vendorData.value.payout_info : JSON.stringify(vendorData.value.payout_info || '')
  }
}

async function saveProfile() {
  profileSaving.value = true; profileMsg.value = ''
  try {
    await fetch(`${API}/api/vendors/me`, {
      method: 'PUT', headers: authHeader(),
      body: JSON.stringify({ ...profileForm, payout_info: profileForm.payout_info_raw })
    })
    profileMsg.value = '✅ Profile saved!'
    setTimeout(() => profileMsg.value = '', 3000)
    await loadProfile()
  } catch {}
  profileSaving.value = false
}

// ─── Product form ─────────────────────────────────────────────────────────────
const showProductModal = ref(false)
const editProduct = ref(null)
const productForm = reactive({ name: '', price: '', sale_price: '', excerpt: '', sku: '', cover_image: '', status: 'draft' })
const productSaving = ref(false)
const productError = ref('')

function openProductForm(product = null) {
  editProduct.value = product
  productError.value = ''
  if (product) {
    Object.assign(productForm, {
      name: product.name || '',
      price: product.price || '',
      sale_price: product.sale_price || '',
      excerpt: product.excerpt || '',
      sku: product.sku || '',
      cover_image: product.cover_image || '',
      status: product.status || 'draft'
    })
  } else {
    Object.assign(productForm, { name: '', price: '', sale_price: '', excerpt: '', sku: '', cover_image: '', status: 'draft' })
  }
  showProductModal.value = true
}

async function saveProduct() {
  productSaving.value = true; productError.value = ''
  try {
    const url = editProduct.value
      ? `${API}/api/vendors/me/products/${editProduct.value.id}`
      : `${API}/api/vendors/me/products`
    const method = editProduct.value ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: authHeader(),
      body: JSON.stringify({ ...productForm, price: Number(productForm.price), sale_price: productForm.sale_price ? Number(productForm.sale_price) : null })
    })
    const data = await res.json()
    if (!res.ok) { productError.value = data.error || 'Failed to save'; return }
    showProductModal.value = false
    loadProducts()
    loadStats()
  } catch { productError.value = 'Network error' }
  finally { productSaving.value = false }
}

async function deleteProduct(p) {
  if (!confirm(`Delete "${p.name}"?`)) return
  await fetch(`${API}/api/vendors/me/products/${p.id}`, { method: 'DELETE', headers: authHeader() })
  loadProducts()
  loadStats()
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0) }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }

// ─── Init ─────────────────────────────────────────────────────────────────────
async function loadAll() {
  await loadProfile()
  await Promise.all([loadStats(), loadProducts(), loadOrders(), loadPayouts()])
}

onMounted(() => {
  if (token.value) loadAll()
})
</script>

<style scoped>
.vendor-portal { min-height: 100vh; background: var(--bg); }

/* Login */
.portal-login-wrap { display: flex; align-items: center; justify-content: center; min-height: 80vh; padding: 2rem 1rem; }
.portal-login-card { width: 100%; max-width: 420px; padding: 3rem 2.5rem; border-radius: 2rem; text-align: center; }
.portal-logo { font-size: 3rem; margin-bottom: 1rem; }
.portal-login-card h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: .4rem; }
.portal-subtitle { color: rgba(255,255,255,.6); margin-bottom: 2rem; }

.auth-tabs { display: flex; gap: .5rem; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,.1); padding-bottom: 1rem; justify-content: center; }
.tab-btn { background: none; border: none; color: rgba(255,255,255,.5); font-size: 1rem; cursor: pointer; padding: .4rem 1rem; border-radius: .5rem; font-weight: 600; }
.tab-btn.active { color: #fff; background: rgba(255,255,255,.08); }

.auth-form { display: flex; flex-direction: column; gap: .75rem; text-align: left; }
.auth-error { color: var(--accent); font-size: .85rem; margin-top: .5rem; }
.auth-note { color: rgba(255,255,255,.5); font-size: .8rem; }

/* Dashboard layout */
.portal-dashboard { display: grid; grid-template-columns: 240px 1fr; min-height: 80vh; padding: 80px 0 4rem; gap: 2rem; max-width: 1200px; margin: 0 auto; padding-left: 1rem; padding-right: 1rem; }
.portal-sidebar { border-radius: 1.5rem; padding: 1.5rem; display: flex; flex-direction: column; height: fit-content; position: sticky; top: 5rem; }

.sidebar-vendor { text-align: center; padding-bottom: 1.2rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,.1); }
.sidebar-logo { width: 56px; height: 56px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; margin: 0 auto .7rem; font-size: 1.4rem; font-weight: 700; color: #fff; overflow: hidden; }
.sidebar-logo img { width: 100%; height: 100%; object-fit: cover; }
.sidebar-name { font-weight: 600; font-size: .95rem; }
.sidebar-status { font-size: .75rem; padding: .15rem .5rem; border-radius: 999px; margin-top: .3rem; display: inline-block; }
.sidebar-status.active { background: rgba(52,211,153,.15); color: #34d399; }
.sidebar-status.pending { background: rgba(251,191,36,.15); color: #fbbf24; }
.sidebar-status.suspended { background: rgba(239,68,68,.15); color: #ef4444; }

.sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: .3rem; }
.nav-btn { background: none; border: none; color: rgba(255,255,255,.65); text-align: left; padding: .65rem .9rem; border-radius: .75rem; cursor: pointer; font-size: .9rem; font-weight: 500; transition: background .15s, color .15s; }
.nav-btn:hover { background: rgba(255,255,255,.06); color: #fff; }
.nav-btn.active { background: rgba(255,255,255,.1); color: #fff; }
.logout-btn { color: rgba(239,68,68,.7); margin-top: .5rem; }
.logout-btn:hover { color: #ef4444; background: rgba(239,68,68,.1); }

.portal-main { padding-top: 1rem; }
.portal-main h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; }

.section-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.section-top h2 { margin-bottom: 0; }

/* Stats strip */
.stats-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat-card { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 1rem; padding: 1.2rem; }
.stat-card.accent { border-color: rgba(var(--accent-rgb,204,60,70),.4); }
.stat-value { font-size: 1.5rem; font-weight: 700; }
.stat-label { font-size: .8rem; color: rgba(255,255,255,.5); margin-top: .2rem; }

/* Tables */
.section-card { border-radius: 1.25rem; padding: 1.5rem; margin-bottom: 2rem; }
.portal-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.portal-table th { text-align: left; color: rgba(255,255,255,.5); font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; padding-bottom: .75rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.portal-table td { padding: .75rem 0; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.portal-table tr:last-child td { border-bottom: none; }

.commission-cell { color: rgba(239,68,68,.8); }
.product-thumb { width: 44px; height: 44px; border-radius: .5rem; object-fit: cover; }
.status-pill { font-size: .72rem; padding: .2rem .6rem; border-radius: 999px; font-weight: 600; }
.status-pill.published { background: rgba(52,211,153,.15); color: #34d399; }
.status-pill.draft { background: rgba(255,255,255,.1); color: rgba(255,255,255,.6); }
.status-pill.paid { background: rgba(52,211,153,.15); color: #34d399; }
.status-pill.pending { background: rgba(251,191,36,.15); color: #fbbf24; }

.icon-btn { background: none; border: none; cursor: pointer; font-size: 1rem; padding: .25rem .4rem; border-radius: .4rem; opacity: .7; transition: opacity .15s; }
.icon-btn:hover { opacity: 1; }
.icon-btn.danger:hover { background: rgba(239,68,68,.15); }

/* Profile form */
.profile-form { display: flex; flex-direction: column; gap: 1.25rem; }
.form-group { display: flex; flex-direction: column; gap: .4rem; }
.form-group label { font-size: .85rem; color: rgba(255,255,255,.6); font-weight: 500; }
.store-link-card { margin-top: 1rem; }
.store-url { color: var(--accent); font-size: 1rem; text-decoration: none; }
.store-url:hover { text-decoration: underline; }

/* Form inputs */
.form-input { padding: .75rem 1rem; border-radius: .75rem; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); color: #fff; font-size: .95rem; }
.form-input::placeholder { color: rgba(255,255,255,.35); }
.form-input option { background: hsl(228,4%,15%); }

/* Buttons */
.btn { padding: .75rem 1.5rem; border-radius: .75rem; border: none; cursor: pointer; font-weight: 600; font-size: .95rem; transition: opacity .2s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-ghost { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }
.btn:disabled { opacity: .5; cursor: default; }
.success-msg { color: #34d399; font-size: .85rem; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal-card { width: 100%; max-width: 580px; border-radius: 1.5rem; padding: 2rem; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.modal-header h3 { font-size: 1.2rem; font-weight: 700; }
.close-btn { background: none; border: none; color: rgba(255,255,255,.5); font-size: 1.2rem; cursor: pointer; }
.modal-footer { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1rem; }

.product-form { display: flex; flex-direction: column; gap: 1rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.empty-msg { padding: 2rem; text-align: center; border-radius: 1.25rem; color: rgba(255,255,255,.5); }
.loading-row { padding: 2rem; text-align: center; color: rgba(255,255,255,.5); }

@media (max-width: 768px) {
  .portal-dashboard { grid-template-columns: 1fr; }
  .portal-sidebar { position: static; }
  .form-row { grid-template-columns: 1fr; }
}
</style>
