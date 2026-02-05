// Firebase messaging service worker
// This file will be served with injected config by the server
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration - these values are injected at build/serve time
// In development, fetch config from the server
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Initialize Firebase with config from query params or fetch from server
let firebaseConfig = null;

async function initializeFirebase() {
  if (firebase.apps.length > 0) return;
  
  try {
    // Fetch config from server
    const response = await fetch('/api/firebase-config');
    if (!response.ok) {
      console.warn('Could not fetch Firebase config');
      return;
    }
    firebaseConfig = await response.json();
    
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    
    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message:', payload);
      
      const notificationTitle = payload.notification?.title || 'New Notification';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/favicon.png',
        badge: '/favicon.png',
        data: payload.data,
        requireInteraction: true,
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
    
    console.log('[firebase-messaging-sw.js] Firebase initialized successfully');
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error initializing Firebase:', error);
  }
}

// Initialize on first push event if not already initialized
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      await initializeFirebase();
      
      if (!event.data) return;
      
      try {
        const payload = event.data.json();
        const notificationTitle = payload.notification?.title || 'New Notification';
        const notificationOptions = {
          body: payload.notification?.body || '',
          icon: '/favicon.png',
          badge: '/favicon.png',
          data: payload.data,
          requireInteraction: true,
        };
        
        await self.registration.showNotification(notificationTitle, notificationOptions);
      } catch (error) {
        console.error('[firebase-messaging-sw.js] Error handling push:', error);
      }
    })()
  );
});

// Handle notification click
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
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Initialize Firebase immediately
initializeFirebase();
