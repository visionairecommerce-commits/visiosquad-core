importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Activating...');
  event.waitUntil(clients.claim());
});

let firebaseInitialized = false;

async function initializeFirebase() {
  if (firebaseInitialized) return true;
  if (firebase.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }

  try {
    const response = await fetch('/api/firebase-config');
    if (!response.ok) {
      console.error('[firebase-messaging-sw.js] Failed to fetch config:', response.status);
      return false;
    }
    const config = await response.json();
    console.log('[firebase-messaging-sw.js] Config received, projectId:', config.projectId);

    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
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

    firebaseInitialized = true;
    console.log('[firebase-messaging-sw.js] Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Init error:', error?.message || error);
    return false;
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      await initializeFirebase();
      if (!event.data) return;
      try {
        const payload = event.data.json();
        const title = payload.notification?.title || 'New Notification';
        const options = {
          body: payload.notification?.body || '',
          icon: '/favicon.png',
          badge: '/favicon.png',
          data: payload.data,
          requireInteraction: true,
        };
        await self.registration.showNotification(title, options);
      } catch (error) {
        console.error('[firebase-messaging-sw.js] Push error:', error);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = '/';
  if (data.type === 'chat_message') {
    url = '/messages';
  } else if (data.type === 'bulletin_post') {
    url = '/bulletin';
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

initializeFirebase();
