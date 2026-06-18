// FBN Transport — service worker for web push notifications.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch (_) { d = { body: event.data && event.data.text() }; }
    const title = d.title || 'FBN Transport';
    event.waitUntil(self.registration.showNotification(title, {
        body: d.body || '',
        data: { url: d.url || '/' },
        icon: '/fbn-logo.jpg',
        badge: '/fbn-logo.jpg',
        tag: d.tag || undefined,
        renotify: !!d.tag,
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
        for (const w of wins) {
            if ('focus' in w) { try { w.navigate(url); } catch (_) { } return w.focus(); }
        }
        return self.clients.openWindow(url);
    }));
});
