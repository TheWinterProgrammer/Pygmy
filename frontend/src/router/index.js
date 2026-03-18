import { createRouter, createWebHistory } from 'vue-router'

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
    path: '/search',
    component: () => import('../views/SearchView.vue')
  },
  {
    path: '/blog/:slug',
    component: () => import('../views/PostView.vue')
  },
  {
    path: '/:slug',
    component: () => import('../views/PageView.vue')
  }
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } }
})
