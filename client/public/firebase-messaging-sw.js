importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

let messagingInstance = null;

async function initFirebase() {
  if (firebase.apps.length > 0) return true;
  try {
    const res = await fetch('/api/firebase-config');
    if (!res.ok) {
      console.warn('[firebase-messaging-sw.js] Config endpoint returned', res.status);
      return false;
    }
    const config = await res.json();
    if (!config.apiKey || !config.projectId) {
      console.warn('[firebase-messaging-sw.js] Config missing required fields');
      return false;
    }
    firebase.initializeApp(config);
    messagingInstance = firebase.messaging();
    messagingInstance.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Background message:', payload);
      const title = payload.notification?.title || 'New Notification';
      const options = {
        body: payload.notification?.body || '',
        icon: '/favicon.png',
        badge: '/favicon.png',
        data: payload.data,
        requireInteraction: true,
      };
      self.registration.showNotification(title, options);
    });
    console.log('[firebase-messaging-sw.js] Initialized with project:', config.projectId);
    return true;
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Init failed:', err);
    return false;
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      await initFirebase();
      if (!event.data) return;
      try {
        const payload = event.data.json();
        await self.registration.showNotification(
          payload.notification?.title || 'New Notification',
          {
            body: payload.notification?.body || '',
            icon: '/favicon.png',
            badge: '/favicon.png',
            data: payload.data,
            requireInteraction: true,
          }
        );
      } catch (err) {
        console.error('[firebase-messaging-sw.js] Push handler error:', err);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = '/';
  if (data.type === 'chat_message') url = '/messages';
  else if (data.type === 'bulletin_post') url = '/bulletin';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

initFirebase();
