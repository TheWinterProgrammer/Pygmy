<template>
  <Teleport to="body">
    <Transition name="cp-fade">
      <div v-if="open" class="cp-overlay" @mousedown.self="close">
        <div class="cp-panel glass-modal" role="dialog" aria-label="Command Palette">
          <!-- Search input -->
          <div class="cp-search-row">
            <span class="cp-search-icon">🔍</span>
            <input
              ref="inputRef"
              v-model="query"
              class="cp-input"
              placeholder="Search pages, commands…"
              autocomplete="off"
              spellcheck="false"
              @keydown.down.prevent="moveDown"
              @keydown.up.prevent="moveUp"
              @keydown.enter.prevent="runSelected"
              @keydown.esc.prevent="close"
            />
            <kbd class="cp-esc" @click="close">Esc</kbd>
          </div>

          <!-- Results -->
          <div class="cp-results" ref="resultsRef">
            <template v-if="filtered.length">
              <template v-for="(group, gi) in groupedResults" :key="gi">
                <div class="cp-group-label">{{ group.label }}</div>
                <div
                  v-for="(item, i) in group.items"
                  :key="item.id"
                  class="cp-item"
                  :class="{ active: item._flatIdx === activeIdx }"
                  @mouseenter="activeIdx = item._flatIdx"
                  @click="runItem(item)"
                >
                  <span class="cp-item-icon">{{ item.icon }}</span>
                  <span class="cp-item-label">{{ item.label }}</span>
                  <span class="cp-item-path" v-if="item.path">{{ item.path }}</span>
                  <kbd v-if="item._flatIdx === activeIdx" class="cp-enter-hint">↵</kbd>
                </div>
              </template>
            </template>
            <div v-else class="cp-empty">No results for "{{ query }}"</div>
          </div>

          <div class="cp-footer">
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const open = ref(false)
const query = ref('')
const activeIdx = ref(0)
const inputRef = ref(null)
const resultsRef = ref(null)

// All navigable items in the admin panel
const ALL_ITEMS = [
  // ── Content ──────────────────────────────────────────────────────────────
  { icon: '📊', label: 'Dashboard', path: '/dashboard',    group: 'Pages' },
  { icon: '📄', label: 'Pages',     path: '/pages',         group: 'Pages' },
  { icon: '✍️',  label: 'Posts',    path: '/posts',         group: 'Pages' },
  { icon: '🖼️', label: 'Media',    path: '/media',         group: 'Pages' },
  { icon: '🧭', label: 'Navigation', path: '/navigation',  group: 'Pages' },
  { icon: '📆', label: 'Events',    path: '/events',        group: 'Pages' },
  { icon: '💬', label: 'Comments',  path: '/comments',      group: 'Pages' },
  { icon: '🏠', label: 'Homepage Builder', path: '/homepage', group: 'Pages' },
  // ── Commerce ─────────────────────────────────────────────────────────────
  { icon: '🛍️', label: 'Products',  path: '/products',      group: 'Commerce' },
  { icon: '📦', label: 'Orders',    path: '/orders',         group: 'Commerce' },
  { icon: '🚢', label: 'Fulfillment', path: '/fulfillment', group: 'Commerce' },
  { icon: '🎟️', label: 'Coupons',   path: '/coupons',        group: 'Commerce' },
  { icon: '🚚', label: 'Shipping',  path: '/shipping',       group: 'Commerce' },
  { icon: '⭐', label: 'Reviews',   path: '/reviews',        group: 'Commerce' },
  { icon: '↩️', label: 'Returns & Refunds', path: '/returns', group: 'Commerce' },
  { icon: '🛒', label: 'Abandoned Carts', path: '/abandoned-carts', group: 'Commerce' },
  { icon: '🗂️', label: 'Collections', path: '/collections', group: 'Commerce' },
  { icon: '🎯', label: 'Post-Purchase Upsell', path: '/upsell', group: 'Commerce' },
  { icon: '⚡', label: 'Flash Sales', path: '/flash-sales', group: 'Commerce' },
  { icon: '🪄', label: 'Bundles',   path: '/bundles',        group: 'Commerce' },
  { icon: '🏭', label: 'Suppliers', path: '/suppliers',      group: 'Commerce' },
  { icon: '📋', label: 'Waitlist',  path: '/waitlist',       group: 'Commerce' },
  { icon: '🏷️', label: 'Customer Groups', path: '/customer-groups', group: 'Commerce' },
  { icon: '📦', label: 'Order Bumps', path: '/order-bumps', group: 'Commerce' },
  { icon: '🔁', label: 'Product Subscriptions', path: '/product-subscriptions', group: 'Commerce' },
  { icon: '🎁', label: 'Gift Cards', path: '/gift-cards',   group: 'Commerce' },
  { icon: '💳', label: 'Store Credit', path: '/store-credit', group: 'Commerce' },
  { icon: '📥', label: 'Downloads', path: '/downloads',      group: 'Commerce' },
  // ── Customers ────────────────────────────────────────────────────────────
  { icon: '🧑‍💼', label: 'Customers', path: '/customers',    group: 'Customers' },
  { icon: '💳', label: 'Subscriptions', path: '/subscriptions', group: 'Customers' },
  { icon: '🏆', label: 'Loyalty Tiers', path: '/loyalty-tiers', group: 'Customers' },
  { icon: '🤝', label: 'Affiliates', path: '/affiliates',    group: 'Customers' },
  { icon: '🔗', label: 'Referral Program', path: '/referral', group: 'Customers' },
  { icon: '🎯', label: 'Customer Segments', path: '/customer-segments', group: 'Customers' },
  // ── Marketing ────────────────────────────────────────────────────────────
  { icon: '📨', label: 'Newsletter', path: '/newsletter',   group: 'Marketing' },
  { icon: '📧', label: 'Email Sequences', path: '/email-sequences', group: 'Marketing' },
  { icon: '✉️', label: 'Email Templates', path: '/email-templates', group: 'Marketing' },
  { icon: '📬', label: 'Digest Emails', path: '/digest',    group: 'Marketing' },
  { icon: '📢', label: 'Announcement Bars', path: '/announcement-bars', group: 'Marketing' },
  { icon: '💬', label: 'Pop-up Builder', path: '/popups',   group: 'Marketing' },
  { icon: '🔔', label: 'Push Notifications', path: '/push-notifications', group: 'Marketing' },
  { icon: '📉', label: 'Price Alerts', path: '/price-alerts', group: 'Marketing' },
  { icon: '🔔', label: 'Back-in-Stock Alerts', path: '/stock-alerts', group: 'Marketing' },
  { icon: '🎟️', label: 'Coupon Campaigns', path: '/coupon-campaigns', group: 'Marketing' },
  { icon: '⚡', label: 'Automation Rules', path: '/automation', group: 'Marketing' },
  // ── Analytics ────────────────────────────────────────────────────────────
  { icon: '📈', label: 'Analytics',  path: '/analytics',   group: 'Analytics' },
  { icon: '💰', label: 'Revenue',    path: '/revenue',      group: 'Analytics' },
  { icon: '🔍', label: 'Search Analytics', path: '/search-analytics', group: 'Analytics' },
  { icon: '🧪', label: 'A/B Testing', path: '/ab-testing', group: 'Analytics' },
  { icon: '⚡', label: 'Performance', path: '/performance', group: 'Analytics' },
  { icon: '📅', label: 'Bookings',   path: '/bookings',     group: 'Analytics' },
  { icon: '📈', label: 'Stock Forecast', path: '/stock-forecast', group: 'Analytics' },
  { icon: '👥', label: 'Social Proof', path: '/social-proof', group: 'Analytics' },
  // ── Site ─────────────────────────────────────────────────────────────────
  { icon: '✉️', label: 'Contact',   path: '/contact',       group: 'Site' },
  { icon: '🎫', label: 'Support Tickets', path: '/support', group: 'Site' },
  { icon: '📋', label: 'Forms',     path: '/forms',          group: 'Site' },
  { icon: '🌐', label: 'Languages', path: '/languages',     group: 'Site' },
  { icon: '🔀', label: 'Redirects', path: '/redirects',     group: 'Site' },
  { icon: '📅', label: 'Content Calendar', path: '/content-calendar', group: 'Site' },
  { icon: '🩺', label: 'Site Health', path: '/site-health', group: 'Site' },
  { icon: '🗄️', label: 'Backup',    path: '/backup',         group: 'Site' },
  // ── Settings ─────────────────────────────────────────────────────────────
  { icon: '⚙️', label: 'Settings',  path: '/settings',      group: 'Settings' },
  { icon: '🧾', label: 'Tax Rates', path: '/tax-rates',      group: 'Settings' },
  { icon: '🚚', label: 'Shipping Zones', path: '/shipping',  group: 'Settings' },
  { icon: '💱', label: 'Multi-Currency', path: '/currency',  group: 'Settings' },
  { icon: '🔑', label: 'API Keys',  path: '/api-keys',        group: 'Settings' },
  { icon: '🔗', label: 'Webhooks',  path: '/webhooks',        group: 'Settings' },
  { icon: '🎨', label: 'Storefront Customizer', path: '/storefront-customizer', group: 'Settings' },
  { icon: '🏷️', label: 'Product Badges', path: '/product-badges', group: 'Settings' },
  { icon: '👥', label: 'Users',     path: '/users',           group: 'Settings' },
]

// Assign flat indices for keyboard nav
const itemsWithIdx = computed(() => {
  let idx = 0
  return ALL_ITEMS.map(it => ({ ...it, id: it.path, _flatIdx: idx++ }))
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return itemsWithIdx.value
  return itemsWithIdx.value.filter(it =>
    it.label.toLowerCase().includes(q) ||
    it.group.toLowerCase().includes(q) ||
    it.path.toLowerCase().includes(q)
  ).map((it, i) => ({ ...it, _flatIdx: i }))
})

const groupedResults = computed(() => {
  const groups = {}
  for (const item of filtered.value) {
    if (!groups[item.group]) groups[item.group] = { label: item.group, items: [] }
    groups[item.group].items.push(item)
  }
  return Object.values(groups)
})

function moveDown() {
  activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1)
  scrollActive()
}
function moveUp() {
  activeIdx.value = Math.max(activeIdx.value - 1, 0)
  scrollActive()
}
function scrollActive() {
  nextTick(() => {
    const el = resultsRef.value?.querySelector('.cp-item.active')
    el?.scrollIntoView({ block: 'nearest' })
  })
}
function runSelected() {
  const item = filtered.value[activeIdx.value]
  if (item) runItem(item)
}
function runItem(item) {
  router.push(item.path)
  close()
}

function open_palette() {
  open.value = true
  query.value = ''
  activeIdx.value = 0
  nextTick(() => inputRef.value?.focus())
}
function close() {
  open.value = false
}

// Reset selection when query changes
watch(query, () => { activeIdx.value = 0 })

// Global keyboard shortcut: Ctrl+K / Cmd+K
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    open.value ? close() : open_palette()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// Expose open for external trigger
defineExpose({ open: open_palette, close })
</script>

<style scoped>
.cp-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  backdrop-filter: blur(4px);
}

.cp-panel {
  width: min(620px, 96vw);
  border-radius: 1.25rem;
  overflow: hidden;
  background: hsl(228, 4%, 13%);
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 32px 80px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.cp-search-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.cp-search-icon { font-size: 1.1rem; opacity: 0.5; }
.cp-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #fff;
  font-size: 1.05rem;
  font-family: 'Poppins', sans-serif;
}
.cp-input::placeholder { color: rgba(255,255,255,0.35); }
.cp-esc {
  padding: 2px 7px;
  border-radius: 5px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.5);
  font-size: 0.7rem;
  cursor: pointer;
  font-family: monospace;
}

.cp-results {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0.5rem;
}
.cp-group-label {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  padding: 0.5rem 0.6rem 0.2rem;
}
.cp-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.6rem;
  cursor: pointer;
  transition: background 0.1s;
  color: rgba(255,255,255,0.85);
  font-size: 0.9rem;
}
.cp-item:hover, .cp-item.active {
  background: rgba(255,255,255,0.08);
}
.cp-item.active { background: rgba(var(--accent-rgb, 220,60,60), 0.18); }
.cp-item-icon { font-size: 1rem; flex-shrink: 0; }
.cp-item-label { flex: 1; }
.cp-item-path {
  color: rgba(255,255,255,0.3);
  font-size: 0.75rem;
  font-family: monospace;
}
.cp-enter-hint {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
  font-size: 0.7rem;
  font-family: monospace;
  flex-shrink: 0;
}
.cp-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: rgba(255,255,255,0.35);
  font-size: 0.9rem;
}
.cp-footer {
  display: flex;
  gap: 1.2rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 0.72rem;
  color: rgba(255,255,255,0.35);
  flex-shrink: 0;
}
.cp-footer kbd {
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: monospace;
  margin-right: 3px;
}

/* Transition */
.cp-fade-enter-active, .cp-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.cp-fade-enter-from, .cp-fade-leave-to { opacity: 0; transform: translateY(-12px) scale(0.97); }
</style>
