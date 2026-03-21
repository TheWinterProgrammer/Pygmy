<template>
  <nav class="site-nav" :class="{ scrolled }">
    <div class="nav-inner container">
      <!-- Brand -->
      <RouterLink to="/" class="nav-brand">
        <img v-if="site.settings.site_logo" :src="site.settings.site_logo" alt="logo" class="nav-logo" />
        <span v-else class="nav-name">{{ site.settings.site_name || 'Pygmy' }}</span>
      </RouterLink>

      <!-- Desktop links -->
      <ul class="nav-links" v-if="!mobileOpen">
        <template v-for="item in site.navigation" :key="item.id">
          <li v-if="!item.children?.length">
            <a
              :href="item.url"
              :target="item.target"
              class="nav-link"
              :class="{ active: isActive(item.url) }"
            >{{ item.label }}</a>
          </li>
          <!-- Dropdown -->
          <li v-else class="has-dropdown" @mouseenter="openDropdown = item.id" @mouseleave="openDropdown = null">
            <span class="nav-link nav-link-drop">
              {{ item.label }} <span class="chevron">▾</span>
            </span>
            <ul class="dropdown glass" v-show="openDropdown === item.id">
              <li v-for="child in item.children" :key="child.id">
                <a :href="child.url" :target="child.target" class="dropdown-link">{{ child.label }}</a>
              </li>
            </ul>
          </li>
        </template>
      </ul>

      <!-- Search button -->
      <RouterLink to="/search" class="nav-search-btn" aria-label="Search" title="Search">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </RouterLink>

      <!-- Wishlist button -->
      <RouterLink to="/wishlist" class="nav-wishlist-btn" aria-label="Wishlist" title="Wishlist">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span v-if="wishlist.count > 0" class="wishlist-badge">{{ wishlist.count > 9 ? '9+' : wishlist.count }}</span>
      </RouterLink>

      <!-- Cart button -->
      <button class="nav-cart-btn" @click="cart.toggle()" aria-label="Cart" title="Shopping cart">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        <span v-if="cart.count > 0" class="cart-badge">{{ cart.count > 9 ? '9+' : cart.count }}</span>
      </button>

      <!-- Hamburger -->
      <button class="hamburger" @click="mobileOpen = !mobileOpen" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>

    <!-- Mobile menu -->
    <Transition name="slide-down">
      <div class="mobile-menu glass" v-if="mobileOpen">
        <ul class="mobile-links">
          <li v-for="item in flatNav" :key="item.id">
            <a
              :href="item.url"
              :target="item.target"
              class="mobile-link"
              :class="{ active: isActive(item.url) }"
              @click="mobileOpen = false"
            >{{ item.label }}</a>
          </li>
        </ul>
      </div>
    </Transition>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteStore } from '../stores/site.js'
import { useCartStore } from '../stores/cart.js'
import { useWishlistStore } from '../stores/wishlist.js'

const site     = useSiteStore()
const cart     = useCartStore()
const wishlist = useWishlistStore()
const route = useRoute()
const scrolled = ref(false)
const mobileOpen = ref(false)
const openDropdown = ref(null)

function onScroll() {
  scrolled.value = window.scrollY > 40
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

function isActive(url) {
  if (url === '/') return route.path === '/'
  return route.path.startsWith(url)
}

// Flatten nav tree for mobile
const flatNav = computed(() => {
  const out = []
  function walk(items, depth = 0) {
    items.forEach(item => {
      out.push({ ...item, _depth: depth })
      if (item.children?.length) walk(item.children, depth + 1)
    })
  }
  walk(site.navigation)
  return out
})
</script>

<style scoped>
.site-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  padding: 0.75rem 0;
  transition: all 0.3s ease;
}

.site-nav.scrolled {
  background: rgba(20, 21, 26, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 0.5rem 0;
}

.nav-inner {
  display: flex;
  align-items: center;
  gap: 2rem;
}

/* Brand */
.nav-brand {
  display: flex;
  align-items: center;
  text-decoration: none;
  flex-shrink: 0;
}
.nav-logo {
  height: 36px;
  width: auto;
}
.nav-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

/* Links */
.nav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  list-style: none;
  margin-left: auto;
}

.nav-link {
  display: block;
  padding: 0.45rem 0.85rem;
  border-radius: 2rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
  cursor: pointer;
}
.nav-link:hover,
.nav-link.active {
  color: var(--text);
  background: rgba(255,255,255,0.06);
  text-decoration: none;
}
.nav-link.active {
  color: var(--accent);
}

/* Dropdown */
.has-dropdown {
  position: relative;
}
.nav-link-drop {
  user-select: none;
}
.chevron {
  font-size: 0.7rem;
  vertical-align: middle;
}
.dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  min-width: 180px;
  list-style: none;
  padding: 0.5rem 0;
  border-radius: 1rem;
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
}
.dropdown-link {
  display: block;
  padding: 0.55rem 1.1rem;
  color: var(--text-muted);
  font-size: 0.88rem;
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
}
.dropdown-link:hover {
  color: var(--text);
  background: rgba(255,255,255,0.05);
}

/* Search button */
.nav-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px; height: 34px;
  border-radius: 50%;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
  flex-shrink: 0;
}
.nav-search-btn:hover,
.nav-search-btn.router-link-active {
  color: var(--text);
  background: rgba(255,255,255,0.06);
  text-decoration: none;
}

/* Wishlist button */
.nav-wishlist-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px; height: 34px;
  border-radius: 50%;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
  flex-shrink: 0;
}
.nav-wishlist-btn:hover,
.nav-wishlist-btn.router-link-active {
  color: var(--accent);
  background: rgba(255,255,255,0.06);
}
.wishlist-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--accent);
  color: #fff;
  font-size: .62rem;
  font-weight: 700;
  border-radius: 99px;
  padding: .05em .35em;
  min-width: 1.4em;
  text-align: center;
  line-height: 1.6;
}

/* Cart button */
.nav-cart-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px; height: 34px;
  border-radius: 50%;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  flex-shrink: 0;
}
.nav-cart-btn:hover {
  color: var(--text);
  background: rgba(255,255,255,0.06);
}
.cart-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--accent);
  color: #fff;
  font-size: .62rem;
  font-weight: 700;
  border-radius: 99px;
  padding: .05em .35em;
  min-width: 1.4em;
  text-align: center;
  line-height: 1.6;
}

/* Hamburger */
.hamburger {
  display: none;
  flex-direction: column;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem;
  margin-left: auto;
}
.hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--text);
  border-radius: 2px;
  transition: 0.3s;
}

/* Mobile menu */
.mobile-menu {
  margin: 0.5rem 1rem 0.75rem;
  border-radius: 1.25rem;
  padding: 0.5rem;
}
.mobile-links {
  list-style: none;
  display: flex;
  flex-direction: column;
}
.mobile-link {
  display: block;
  padding: 0.7rem 1.1rem;
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 500;
  border-radius: 0.75rem;
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
}
.mobile-link:hover,
.mobile-link.active {
  color: var(--accent);
  background: rgba(255,255,255,0.04);
}

/* Transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 680px) {
  .nav-links { display: none; }
  .hamburger { display: flex; }
}
</style>
