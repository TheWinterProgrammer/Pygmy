import { createRouter, createWebHistory } from 'vue-router'
import api from '../api.js'

const routes = [
  {
    path: '/',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/blog',
    component: () => import('../views/BlogView.vue')
  },
  {
    path: '/blog/authors',
    component: () => import('../views/AuthorsView.vue')
  },
  {
    path: '/blog/author/:name',
    component: () => import('../views/AuthorView.vue')
  },
  {
    path: '/search',
    component: () => import('../views/SearchView.vue')
  },
  {
    path: '/contact',
    component: () => import('../views/ContactView.vue')
  },
  {
    path: '/support',
    component: () => import('../views/SupportView.vue')
  },
  {
    path: '/returns',
    component: () => import('../views/ReturnRequestView.vue')
  },
  {
    path: '/shop/bundles',
    component: () => import('../views/BundlesListView.vue'),
  },
  {
    path: '/shop/bundles/:slug',
    component: () => import('../views/BundleView.vue'),
  },
  {
    path: '/shop',
    component: () => import('../views/ProductsView.vue')
  },
  {
    path: '/wishlist',
    component: () => import('../views/WishlistView.vue')
  },
  {
    path: '/shop/:slug',
    component: () => import('../views/ProductView.vue')
  },
  {
    path: '/forms/:slug',
    component: () => import('../views/FormView.vue')
  },
  {
    path: '/booking',
    component: () => import('../views/BookingView.vue')
  },
  {
    path: '/events',
    component: () => import('../views/EventsView.vue')
  },
  {
    path: '/events/:slug',
    component: () => import('../views/EventView.vue')
  },
  {
    path: '/checkout',
    component: () => import('../views/CheckoutView.vue')
  },
  {
    path: '/order/lookup',
    component: () => import('../views/OrderLookupView.vue')
  },
  {
    path: '/order/downloads',
    component: () => import('../views/OrderDownloadsView.vue')
  },
  {
    path: '/gift-registry',
    component: () => import('../views/GiftRegistryView.vue')
  },
  {
    path: '/gift-registry/:slug',
    component: () => import('../views/GiftRegistryDetailView.vue')
  },
  {
    path: '/order/:orderNumber',
    component: () => import('../views/OrderConfirmView.vue')
  },
  {
    path: '/gift-cards',
    component: () => import('../views/GiftCardsView.vue')
  },
  {
    path: '/membership',
    component: () => import('../views/MembershipView.vue')
  },
  {
    path: '/collections',
    component: () => import('../views/CollectionsView.vue')
  },
  {
    path: '/collections/:slug',
    component: () => import('../views/CollectionView.vue')
  },
  {
    path: '/vendors',
    component: () => import('../views/VendorsView.vue')
  },
  {
    path: '/vendors/:slug',
    component: () => import('../views/VendorView.vue')
  },
  {
    path: '/vendor-portal',
    component: () => import('../views/VendorPortalView.vue')
  },
  {
    path: '/changelog',
    component: () => import('../views/ChangelogView.vue')
  },
  {
    path: '/account/login',
    component: () => import('../views/AccountLoginView.vue')
  },
  {
    path: '/account',
    component: () => import('../views/AccountView.vue')
  },
  {
    path: '/blog/:slug',
    component: () => import('../views/PostView.vue')
  },
  {
    path: '/compare',
    component: () => import('../views/CompareView.vue')
  },
  {
    path: '/:slug',
    component: () => import('../views/PageView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } }
})

// Check CMS-managed redirects before navigating
router.beforeEach(async (to) => {
  try {
    const { data } = await api.get('/redirects/check', { params: { path: to.path } })
    if (data && data.to_path) {
      const code = parseInt(data.type) || 301
      if (data.to_path.startsWith('http')) {
        window.location.href = data.to_path
        return false
      }
      return { path: data.to_path, replace: code === 301 }
    }
  } catch {}
})

export default router
