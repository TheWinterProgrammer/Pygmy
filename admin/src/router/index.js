import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '',        redirect: '/dashboard' },
      { path: 'dashboard',    name: 'Dashboard',   component: () => import('../views/DashboardView.vue') },
      { path: 'pages',        name: 'Pages',       component: () => import('../views/PagesView.vue') },
      { path: 'pages/new',    name: 'PageNew',     component: () => import('../views/PageEditView.vue') },
      { path: 'pages/:id',    name: 'PageEdit',    component: () => import('../views/PageEditView.vue') },
      { path: 'posts',        name: 'Posts',       component: () => import('../views/PostsView.vue') },
      { path: 'posts/new',    name: 'PostNew',     component: () => import('../views/PostEditView.vue') },
      { path: 'posts/:id',    name: 'PostEdit',    component: () => import('../views/PostEditView.vue') },
      { path: 'media',        name: 'Media',       component: () => import('../views/MediaView.vue') },
      { path: 'navigation',   name: 'Navigation',  component: () => import('../views/NavigationView.vue') },
      { path: 'orders',           name: 'Orders',       component: () => import('../views/OrdersView.vue') },
      { path: 'fulfillment',      name: 'Fulfillment',  component: () => import('../views/FulfillmentView.vue') },
      { path: 'coupons',          name: 'Coupons',      component: () => import('../views/CouponsView.vue') },
      { path: 'products',         name: 'Products',     component: () => import('../views/ProductsView.vue') },
      { path: 'products/new',     name: 'ProductNew',   component: () => import('../views/ProductEditView.vue') },
      { path: 'products/:id',     name: 'ProductEdit',  component: () => import('../views/ProductEditView.vue') },
      { path: 'events',           name: 'Events',       component: () => import('../views/EventsView.vue') },
      { path: 'events/new',       name: 'EventNew',     component: () => import('../views/EventEditView.vue') },
      { path: 'events/:id',       name: 'EventEdit',    component: () => import('../views/EventEditView.vue') },
      { path: 'comments',     name: 'Comments',    component: () => import('../views/CommentsView.vue') },
      { path: 'contact',      name: 'Contact',     component: () => import('../views/ContactView.vue') },
      { path: 'users',        name: 'Users',       component: () => import('../views/UsersView.vue') },
      { path: 'analytics',    name: 'Analytics',   component: () => import('../views/AnalyticsView.vue') },
      { path: 'redirects',    name: 'Redirects',   component: () => import('../views/RedirectsView.vue') },
      { path: 'newsletter',   name: 'Newsletter',  component: () => import('../views/NewsletterView.vue') },
      { path: 'backup',       name: 'Backup',      component: () => import('../views/BackupView.vue') },
      { path: 'tags',         name: 'Tags',        component: () => import('../views/TagsView.vue') },
      { path: 'forms',        name: 'Forms',       component: () => import('../views/FormsView.vue') },
      { path: 'forms/new',    name: 'FormNew',     component: () => import('../views/FormEditView.vue') },
      { path: 'forms/:id',    name: 'FormEdit',    component: () => import('../views/FormEditView.vue') },
      { path: 'forms/:id/submissions', name: 'FormSubmissions', component: () => import('../views/FormSubmissionsView.vue') },
      { path: 'webhooks',         name: 'Webhooks',       component: () => import('../views/WebhooksView.vue') },
      { path: 'notifications',    name: 'Notifications',  component: () => import('../views/NotificationsView.vue') },
      { path: 'api-keys',         name: 'ApiKeys',        component: () => import('../views/ApiKeysView.vue') },
      { path: 'reviews',          name: 'Reviews',        component: () => import('../views/ReviewsView.vue') },
      { path: 'customers',        name: 'Customers',      component: () => import('../views/CustomersView.vue') },
      { path: 'shipping',         name: 'Shipping',       component: () => import('../views/ShippingView.vue') },
      { path: 'abandoned-carts',  name: 'AbandonedCarts', component: () => import('../views/AbandonedCartsView.vue') },
      { path: 'homepage',          name: 'Homepage',       component: () => import('../views/HomepageBuilderView.vue') },
      { path: 'tax-rates',        name: 'TaxRates',       component: () => import('../views/TaxRatesView.vue') },
      { path: 'gift-cards',       name: 'GiftCards',      component: () => import('../views/GiftCardsView.vue') },
      { path: 'downloads',        name: 'Downloads',      component: () => import('../views/DownloadsView.vue') },
      { path: 'activity-log',     name: 'ActivityLog',    component: () => import('../views/ActivityLogView.vue') },
      { path: 'subscriptions',    name: 'Subscriptions',  component: () => import('../views/SubscriptionsView.vue') },
      { path: 'revenue',          name: 'Revenue',        component: () => import('../views/RevenueView.vue') },
      { path: 'affiliates',       name: 'Affiliates',     component: () => import('../views/AffiliatesView.vue') },
      { path: 'inventory',        name: 'Inventory',      component: () => import('../views/InventoryView.vue') },
      { path: 'currency',         name: 'Currency',       component: () => import('../views/CurrencyView.vue') },
      { path: 'bundles',          name: 'Bundles',        component: () => import('../views/BundlesView.vue') },
      { path: 'bundles/:id',      name: 'BundleEdit',     component: () => import('../views/BundleEditView.vue') },
      { path: 'settings',         name: 'Settings',       component: () => import('../views/SettingsView.vue') },
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'Login' }
  }
  if (to.name === 'Login' && auth.isLoggedIn) {
    return { name: 'Dashboard' }
  }
})

export default router
