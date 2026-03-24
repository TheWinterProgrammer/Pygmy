// Pygmy CMS — Service Worker (Phase 55)
// Provides offline fallback and asset caching for PWA support.

const CACHE_NAME = 'pygmy-v1'
const OFFLINE_URL = '/offline.html'

// Assets to pre-cache
const PRECACHE = [
  '/',
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for navigation
  if (event.request.method !== 'GET') return
  // Don't intercept API calls
  if (event.request.url.includes('/api/')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || new Response('Offline', { status: 503 }))
      )
    )
    return
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.url.match(/\.(js|css|png|jpg|webp|svg|woff2)$/)) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      return cached || fetchPromise
    })
  )
})
