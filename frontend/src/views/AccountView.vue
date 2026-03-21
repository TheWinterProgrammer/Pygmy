<template>
  <div class="account-page">
    <div class="account-layout">
      <!-- Sidebar -->
      <aside class="account-sidebar glass">
        <div class="account-avatar">{{ initials }}</div>
        <div class="account-name">{{ store.customer?.first_name || 'Account' }}</div>
        <div class="account-email">{{ store.customer?.email }}</div>
        <nav class="account-nav">
          <button
            v-for="tab in tabs" :key="tab.id"
            :class="['nav-tab', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <span>{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>
        <button class="btn btn-ghost btn-sm logout-btn" @click="handleLogout">Sign Out</button>
      </aside>

      <!-- Main -->
      <main class="account-main">
        <!-- ── Orders Tab ── -->
        <div v-if="activeTab === 'orders'">
          <h2 class="tab-title">Order History</h2>
          <div v-if="ordersLoading" class="loading">Loading orders…</div>
          <div v-else-if="orders.length === 0" class="empty-state">
            <p>You haven't placed any orders yet.</p>
            <RouterLink to="/shop" class="btn btn-accent">Browse Shop</RouterLink>
          </div>
          <div v-else class="orders-list">
            <div v-for="order in orders" :key="order.id" class="order-card glass" @click="openOrder(order)">
              <div class="order-header">
                <div>
                  <div class="order-number">{{ order.order_number }}</div>
                  <div class="order-date">{{ formatDate(order.created_at) }}</div>
                </div>
                <span :class="['status-badge', statusClass(order.status)]">{{ order.status }}</span>
              </div>
              <div class="order-items-preview">
                <span v-for="(item, i) in order.items.slice(0, 3)" :key="i" class="item-chip">
                  {{ item.name }} × {{ item.quantity }}
                </span>
                <span v-if="order.items.length > 3" class="item-chip muted">+{{ order.items.length - 3 }} more</span>
              </div>
              <div class="order-total">Total: {{ currency }}{{ Number(order.total).toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <!-- ── Addresses Tab ── -->
        <div v-if="activeTab === 'addresses'">
          <div class="tab-header">
            <h2 class="tab-title">Saved Addresses</h2>
            <button class="btn btn-accent btn-sm" @click="openAddressForm(null)">+ Add Address</button>
          </div>
          <div v-if="addrLoading" class="loading">Loading addresses…</div>
          <div v-else-if="addresses.length === 0" class="empty-state">
            <p>No saved addresses. Add one to speed up checkout!</p>
          </div>
          <div v-else class="addresses-grid">
            <div v-for="addr in addresses" :key="addr.id" class="address-card glass">
              <div class="addr-top">
                <span class="addr-label">{{ addr.label }}</span>
                <span v-if="addr.is_default" class="badge-default">Default</span>
              </div>
              <div class="addr-body">
                <div>{{ addr.first_name }} {{ addr.last_name }}</div>
                <div>{{ addr.address1 }}{{ addr.address2 ? ', ' + addr.address2 : '' }}</div>
                <div>{{ addr.city }}{{ addr.state ? ', ' + addr.state : '' }} {{ addr.zip }}</div>
                <div>{{ addr.country }}</div>
                <div v-if="addr.phone">📞 {{ addr.phone }}</div>
              </div>
              <div class="addr-actions">
                <button class="link-btn" @click="openAddressForm(addr)">Edit</button>
                <button class="link-btn danger" @click="removeAddress(addr.id)">Delete</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Profile Tab ── -->
        <div v-if="activeTab === 'profile'">
          <h2 class="tab-title">My Profile</h2>
          <form @submit.prevent="saveProfile" class="profile-form">
            <div class="form-row">
              <div class="form-group">
                <label>First Name</label>
                <input v-model="profile.first_name" type="text" class="input" />
              </div>
              <div class="form-group">
                <label>Last Name</label>
                <input v-model="profile.last_name" type="text" class="input" />
              </div>
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input v-model="profile.phone" type="tel" class="input" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input :value="store.customer?.email" type="email" class="input" disabled style="opacity:0.5" />
            </div>

            <hr class="divider" />
            <h3 class="section-title">Change Password</h3>
            <div class="form-group">
              <label>Current Password</label>
              <input v-model="profile.password" type="password" class="input" placeholder="Leave blank to keep current" />
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input v-model="profile.new_password" type="password" class="input" placeholder="Minimum 6 characters" />
            </div>

            <div v-if="profileError" class="error-msg">{{ profileError }}</div>
            <div v-if="profileSuccess" class="success-msg">{{ profileSuccess }}</div>

            <button type="submit" class="btn btn-accent" :disabled="profileLoading">
              {{ profileLoading ? 'Saving…' : 'Save Changes' }}
            </button>
          </form>
        </div>
      </main>
    </div>

    <!-- Order Detail Modal -->
    <div v-if="selectedOrder" class="modal-overlay" @click.self="selectedOrder = null">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ selectedOrder.order_number }}</h2>
          <button class="modal-close" @click="selectedOrder = null">✕</button>
        </div>
        <div class="modal-body">
          <div class="order-meta">
            <span :class="['status-badge', statusClass(selectedOrder.status)]">{{ selectedOrder.status }}</span>
            <span class="order-date">{{ formatDate(selectedOrder.created_at) }}</span>
          </div>
          <table class="items-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>
              <tr v-for="item in selectedOrder.items" :key="item.product_id">
                <td>{{ item.name }}<div v-if="item.variant_label" class="variant-label">{{ item.variant_label }}</div></td>
                <td>{{ item.quantity }}</td>
                <td>{{ currency }}{{ Number(item.unit_price).toFixed(2) }}</td>
                <td>{{ currency }}{{ Number(item.line_total).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="order-summary">
            <div class="summary-row"><span>Subtotal</span><span>{{ currency }}{{ Number(selectedOrder.subtotal).toFixed(2) }}</span></div>
            <div v-if="selectedOrder.discount_amount > 0" class="summary-row accent"><span>Discount ({{ selectedOrder.coupon_code }})</span><span>−{{ currency }}{{ Number(selectedOrder.discount_amount).toFixed(2) }}</span></div>
            <div v-if="selectedOrder.shipping_cost > 0" class="summary-row"><span>Shipping ({{ selectedOrder.shipping_rate_name }})</span><span>{{ currency }}{{ Number(selectedOrder.shipping_cost).toFixed(2) }}</span></div>
            <div class="summary-row total"><span>Total</span><span>{{ currency }}{{ Number(selectedOrder.total).toFixed(2) }}</span></div>
          </div>
          <div v-if="selectedOrder.shipping_address" class="shipping-addr">
            <div class="section-title">Shipping to</div>
            <p>{{ selectedOrder.shipping_address }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Address Form Modal -->
    <div v-if="addressForm.open" class="modal-overlay" @click.self="addressForm.open = false">
      <div class="modal glass">
        <div class="modal-header">
          <h2>{{ addressForm.id ? 'Edit Address' : 'New Address' }}</h2>
          <button class="modal-close" @click="addressForm.open = false">✕</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveAddress" class="profile-form">
            <div class="form-row">
              <div class="form-group">
                <label>Label</label>
                <input v-model="addressForm.label" type="text" class="input" placeholder="Home, Work…" />
              </div>
              <div class="form-group">
                <label>Phone</label>
                <input v-model="addressForm.phone" type="tel" class="input" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>First Name</label>
                <input v-model="addressForm.first_name" type="text" class="input" />
              </div>
              <div class="form-group">
                <label>Last Name</label>
                <input v-model="addressForm.last_name" type="text" class="input" />
              </div>
            </div>
            <div class="form-group">
              <label>Address Line 1</label>
              <input v-model="addressForm.address1" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>Address Line 2</label>
              <input v-model="addressForm.address2" type="text" class="input" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>City</label>
                <input v-model="addressForm.city" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>State / Region</label>
                <input v-model="addressForm.state" type="text" class="input" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>ZIP / Postcode</label>
                <input v-model="addressForm.zip" type="text" class="input" />
              </div>
              <div class="form-group">
                <label>Country</label>
                <input v-model="addressForm.country" type="text" class="input" required />
              </div>
            </div>
            <label class="checkbox-row">
              <input type="checkbox" v-model="addressForm.is_default" />
              <span>Set as default address</span>
            </label>
            <div v-if="addressForm.error" class="error-msg">{{ addressForm.error }}</div>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" @click="addressForm.open = false">Cancel</button>
              <button type="submit" class="btn btn-accent" :disabled="addressForm.saving">
                {{ addressForm.saving ? 'Saving…' : 'Save Address' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCustomerStore } from '../stores/customer.js'
import { useSiteStore } from '../stores/site.js'

const router = useRouter()
const store = useCustomerStore()
const site = useSiteStore()

const currency = computed(() => site.settings?.shop_currency_symbol || '€')
const initials = computed(() => {
  const c = store.customer
  if (!c) return '?'
  return ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase() || c.email?.[0]?.toUpperCase() || '?'
})

const tabs = [
  { id: 'orders', icon: '📦', label: 'Orders' },
  { id: 'addresses', icon: '📍', label: 'Addresses' },
  { id: 'profile', icon: '✏️', label: 'Profile' },
]
const activeTab = ref('orders')

// Orders
const orders = ref([])
const ordersLoading = ref(true)
const selectedOrder = ref(null)

async function loadOrders() {
  ordersLoading.value = true
  try { orders.value = await store.fetchOrders() } finally { ordersLoading.value = false }
}

function openOrder(order) { selectedOrder.value = order }

// Addresses
const addresses = ref([])
const addrLoading = ref(true)
const addressForm = reactive({
  open: false, id: null, label: 'Home', first_name: '', last_name: '',
  address1: '', address2: '', city: '', state: '', zip: '', country: '',
  phone: '', is_default: false, saving: false, error: ''
})

async function loadAddresses() {
  addrLoading.value = true
  try { addresses.value = await store.fetchAddresses() } finally { addrLoading.value = false }
}

function openAddressForm(addr) {
  if (addr) {
    Object.assign(addressForm, { ...addr, is_default: !!addr.is_default, open: true, saving: false, error: '' })
  } else {
    Object.assign(addressForm, { open: true, id: null, label: 'Home', first_name: '', last_name: '', address1: '', address2: '', city: '', state: '', zip: '', country: '', phone: '', is_default: false, saving: false, error: '' })
  }
}

async function saveAddress() {
  addressForm.saving = true
  addressForm.error = ''
  try {
    const payload = { label: addressForm.label, first_name: addressForm.first_name, last_name: addressForm.last_name, address1: addressForm.address1, address2: addressForm.address2, city: addressForm.city, state: addressForm.state, zip: addressForm.zip, country: addressForm.country, phone: addressForm.phone, is_default: addressForm.is_default }
    if (addressForm.id) {
      await store.updateAddress(addressForm.id, payload)
    } else {
      await store.addAddress(payload)
    }
    await loadAddresses()
    addressForm.open = false
  } catch (e) {
    addressForm.error = e.message
  } finally {
    addressForm.saving = false
  }
}

async function removeAddress(id) {
  if (!confirm('Remove this address?')) return
  await store.deleteAddress(id)
  addresses.value = addresses.value.filter(a => a.id !== id)
}

// Profile
const profile = reactive({
  first_name: store.customer?.first_name || '',
  last_name: store.customer?.last_name || '',
  phone: store.customer?.phone || '',
  password: '',
  new_password: '',
})
const profileLoading = ref(false)
const profileError = ref('')
const profileSuccess = ref('')

async function saveProfile() {
  profileLoading.value = true
  profileError.value = ''
  profileSuccess.value = ''
  try {
    const payload = { first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone }
    if (profile.new_password) { payload.password = profile.password; payload.new_password = profile.new_password }
    await store.updateMe(payload)
    profileSuccess.value = 'Profile updated!'
    profile.password = ''
    profile.new_password = ''
    setTimeout(() => { profileSuccess.value = '' }, 3000)
  } catch (e) {
    profileError.value = e.message
  } finally {
    profileLoading.value = false
  }
}

function handleLogout() {
  store.logout()
  router.push('/')
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusClass(s) {
  return { pending: 'status-pending', processing: 'status-processing', shipped: 'status-shipped', completed: 'status-completed', cancelled: 'status-cancelled', refunded: 'status-cancelled' }[s] || ''
}

onMounted(async () => {
  if (!store.isLoggedIn) { router.push('/account/login'); return }
  await site.init()
  loadOrders()
  loadAddresses()
  profile.first_name = store.customer?.first_name || ''
  profile.last_name = store.customer?.last_name || ''
  profile.phone = store.customer?.phone || ''
})
</script>

<style scoped>
.account-page { min-height: 100vh; padding: 5rem 2rem 3rem; background: var(--bg); }
.account-layout { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 260px 1fr; gap: 2rem; }

/* Sidebar */
.account-sidebar {
  padding: 1.75rem 1.25rem;
  border-radius: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  height: fit-content;
  position: sticky;
  top: 5rem;
}
.account-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--accent); color: white; font-size: 1.4rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem;
}
.account-name { font-weight: 700; font-size: 1rem; }
.account-email { font-size: 0.8rem; color: var(--muted); margin-bottom: 1rem; text-align: center; word-break: break-all; }
.account-nav { width: 100%; display: flex; flex-direction: column; gap: 0.25rem; }
.nav-tab {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.65rem 1rem; border-radius: 0.65rem;
  background: none; border: none; cursor: pointer;
  color: var(--muted); font-size: 0.9rem; text-align: left; width: 100%;
  transition: background 0.15s, color 0.15s;
}
.nav-tab:hover { background: rgba(255,255,255,0.06); color: var(--text); }
.nav-tab.active { background: rgba(255,255,255,0.1); color: var(--text); font-weight: 600; }
.logout-btn { margin-top: 1.5rem; width: 100%; }

/* Main */
.account-main { min-height: 400px; }
.tab-title { font-size: 1.3rem; font-weight: 700; margin-bottom: 1.5rem; }
.tab-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
.tab-header .tab-title { margin-bottom: 0; }
.loading { color: var(--muted); padding: 2rem 0; }
.empty-state { text-align: center; padding: 3rem 0; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 1rem; }

/* Orders */
.orders-list { display: flex; flex-direction: column; gap: 1rem; }
.order-card { border-radius: 1rem; padding: 1.25rem 1.5rem; cursor: pointer; transition: background 0.15s; }
.order-card:hover { background: rgba(255,255,255,0.08); }
.order-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem; }
.order-number { font-weight: 700; font-size: 0.95rem; }
.order-date { font-size: 0.8rem; color: var(--muted); margin-top: 0.1rem; }
.order-items-preview { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
.item-chip { background: rgba(255,255,255,0.07); padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.78rem; }
.item-chip.muted { opacity: 0.5; }
.order-total { font-size: 0.875rem; color: var(--muted); font-weight: 600; }

.status-badge { padding: 0.2rem 0.7rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.status-pending { background: rgba(234,179,8,0.2); color: #facc15; }
.status-processing { background: rgba(59,130,246,0.2); color: #60a5fa; }
.status-shipped { background: rgba(168,85,247,0.2); color: #c084fc; }
.status-completed { background: rgba(34,197,94,0.2); color: #4ade80; }
.status-cancelled { background: rgba(239,68,68,0.2); color: #f87171; }

/* Addresses */
.addresses-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.address-card { border-radius: 1rem; padding: 1.25rem; }
.addr-top { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
.addr-label { font-weight: 700; font-size: 0.9rem; }
.badge-default { background: rgba(var(--accent-rgb, 220,38,38), 0.2); color: var(--accent); padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.7rem; font-weight: 600; }
.addr-body { font-size: 0.875rem; line-height: 1.6; color: var(--muted); margin-bottom: 0.75rem; }
.addr-actions { display: flex; gap: 1rem; }
.link-btn { background: none; border: none; cursor: pointer; color: var(--accent); font-size: 0.85rem; padding: 0; }
.link-btn.danger { color: #f87171; }

/* Profile form */
.profile-form { display: flex; flex-direction: column; gap: 1rem; max-width: 600px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
.form-group label { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text); padding: 0.65rem 0.9rem; border-radius: 0.6rem; font-size: 0.95rem; }
.input:focus { outline: none; border-color: var(--accent); }
.divider { border: none; border-top: 1px solid var(--border); margin: 0.5rem 0; }
.section-title { font-size: 0.8rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.checkbox-row { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.875rem; }

.error-msg { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 0.6rem 1rem; border-radius: 0.6rem; font-size: 0.875rem; }
.success-msg { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #4ade80; padding: 0.6rem 1rem; border-radius: 0.6rem; font-size: 0.875rem; }

/* Order Detail Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 90%; max-width: 640px; max-height: 85vh; display: flex; flex-direction: column; border-radius: 1.25rem; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
.modal-header h2 { margin: 0; font-size: 1.1rem; }
.modal-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.1rem; }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.25rem; }
.order-meta { display: flex; align-items: center; gap: 1rem; }
.items-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.items-table th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
.items-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
.variant-label { font-size: 0.75rem; color: var(--muted); margin-top: 0.1rem; }
.order-summary { background: rgba(255,255,255,0.04); border-radius: 0.75rem; padding: 1rem; }
.summary-row { display: flex; justify-content: space-between; font-size: 0.875rem; padding: 0.3rem 0; }
.summary-row.accent { color: var(--accent); }
.summary-row.total { font-weight: 700; font-size: 1rem; padding-top: 0.6rem; margin-top: 0.4rem; border-top: 1px solid var(--border); }
.shipping-addr p { margin: 0.4rem 0 0; font-size: 0.875rem; color: var(--muted); }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

@media (max-width: 768px) {
  .account-layout { grid-template-columns: 1fr; }
  .account-sidebar { position: static; flex-direction: row; flex-wrap: wrap; }
  .account-nav { flex-direction: row; flex-wrap: wrap; }
  .form-row { grid-template-columns: 1fr; }
}
</style>
