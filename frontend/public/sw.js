// Pygmy CMS — Service Worker for Web Push Notifications
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  if (!e.data) return
  let data
  try { data = e.data.json() } catch { data = { title: 'New Notification', body: e.data.text(), data: { url: '/' } } }

  const options = {
    body:    data.body    || '',
    icon:    data.icon    || '/favicon.svg',
    badge:   data.badge   || '/favicon.svg',
    image:   data.image   || undefined,
    data:    data.data    || { url: '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  e.waitUntil(self.registration.showNotification(data.title || 'Pygmy CMS', options))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url === url && 'focus' in c)
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
