import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { apiRequest } from './queryClient';

let firebaseApp: FirebaseApp | null = null;
let messaging: Messaging | null = null;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
}

function initializeFirebase(): { app: FirebaseApp; messaging: Messaging } | null {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured - push notifications disabled');
    return null;
  }

  try {
    if (!firebaseApp) {
      if (getApps().length === 0) {
        firebaseApp = initializeApp(firebaseConfig);
      } else {
        firebaseApp = getApps()[0];
      }
    }

    if (!messaging) {
      messaging = getMessaging(firebaseApp);
    }

    return { app: firebaseApp, messaging };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<string | null> {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return null;
  }

  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  const firebase = initializeFirebase();
  if (!firebase) {
    return null;
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    
    console.log('Service Worker registered:', registration);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    // Get FCM token
    const vapidKey = import.meta.env.VITE_PUBLIC_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VAPID key not configured');
      return null;
    }

    const token = await getToken(firebase.messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('FCM token obtained');
      
      // Send token to backend (using the existing push registration endpoint)
      await apiRequest('POST', '/api/push-subscriptions', {
        fcm_token: token,
        device_type: 'web',
      });
      
      console.log('FCM token registered with backend');
      return token;
    } else {
      console.warn('No FCM token received');
      return null;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

export function setupForegroundMessageHandler(
  onNotification: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): (() => void) | null {
  const firebase = initializeFirebase();
  if (!firebase) {
    return null;
  }

  try {
    const unsubscribe = onMessage(firebase.messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      const notification = {
        title: payload.notification?.title || 'New Notification',
        body: payload.notification?.body || '',
        data: payload.data as Record<string, string> | undefined,
      };

      onNotification(notification);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up foreground message handler:', error);
    return null;
  }
}

export function isPushNotificationSupported(): boolean {
  return (
    isFirebaseConfigured() &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}
