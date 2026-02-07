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
  const configured = !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
  console.log('[Push] isFirebaseConfigured:', configured, {
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId,
    hasSenderId: !!firebaseConfig.messagingSenderId,
    hasAppId: !!firebaseConfig.appId,
  });
  return configured;
}

function initializeFirebase(): { app: FirebaseApp; messaging: Messaging } | null {
  if (!isFirebaseConfigured()) {
    console.warn('[Push] Firebase not configured - push notifications disabled');
    return null;
  }

  try {
    if (!firebaseApp) {
      if (getApps().length === 0) {
        firebaseApp = initializeApp(firebaseConfig);
        console.log('[Push] Firebase app initialized (new instance)');
      } else {
        firebaseApp = getApps()[0];
        console.log('[Push] Firebase app initialized (reused existing instance)');
      }
    }

    if (!messaging) {
      messaging = getMessaging(firebaseApp);
      console.log('[Push] Firebase Messaging instance created');
    }

    return { app: firebaseApp, messaging };
  } catch (error) {
    console.error('[Push] Failed to initialize Firebase:', error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<string | null> {
  console.log('[Push] requestNotificationPermission() called');
  console.log('[Push] Current Notification.permission:', 'Notification' in window ? Notification.permission : 'NOT_SUPPORTED');

  if (!('Notification' in window)) {
    console.warn('[Push] This browser does not support notifications');
    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Service workers not supported');
    return null;
  }

  console.log('[Push] Initializing Firebase...');
  const firebase = initializeFirebase();
  if (!firebase) {
    console.error('[Push] Firebase initialization failed - aborting');
    return null;
  }

  try {
    console.log('[Push] Requesting notification permission from browser...');
    const permission = await Notification.requestPermission();
    console.log('[Push] Notification.requestPermission() result:', permission);
    
    if (permission !== 'granted') {
      console.log('[Push] Permission not granted, returning null');
      return null;
    }

    console.log('[Push] Permission granted! Registering Service Worker...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    console.log('[Push] Service Worker registered successfully:', {
      scope: registration.scope,
      active: !!registration.active,
      installing: !!registration.installing,
      waiting: !!registration.waiting,
    });

    console.log('[Push] Waiting for Service Worker to be ready...');
    await navigator.serviceWorker.ready;
    console.log('[Push] Service Worker is ready');

    const vapidKey = import.meta.env.VITE_PUBLIC_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[Push] VAPID key not configured (VITE_PUBLIC_VAPID_KEY is empty)');
      return null;
    }
    console.log('[Push] VAPID key present, length:', vapidKey.length);

    console.log('[Push] Requesting FCM token...');
    const token = await getToken(firebase.messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('[Push] FCM token obtained successfully:', token.substring(0, 20) + '...' + token.substring(token.length - 10));
      console.log('[Push] FCM token full length:', token.length);
      
      console.log('[Push] Registering token with backend (POST /api/push-subscriptions)...');
      await apiRequest('POST', '/api/push-subscriptions', {
        fcm_token: token,
        device_type: 'web',
      });
      
      console.log('[Push] FCM token registered with backend successfully');
      return token;
    } else {
      console.warn('[Push] No FCM token received from getToken() - returned empty/null');
      return null;
    }
  } catch (error: any) {
    console.error('[Push] Error in requestNotificationPermission:', error);
    console.error('[Push] Error name:', error?.name);
    console.error('[Push] Error message:', error?.message);
    if (error?.code) console.error('[Push] Error code:', error.code);
    if (error?.stack) console.error('[Push] Error stack:', error.stack);
    return null;
  }
}

export function setupForegroundMessageHandler(
  onNotification: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): (() => void) | null {
  console.log('[Push] setupForegroundMessageHandler() called');
  const firebase = initializeFirebase();
  if (!firebase) {
    console.warn('[Push] Cannot setup foreground handler - Firebase not initialized');
    return null;
  }

  try {
    const unsubscribe = onMessage(firebase.messaging, (payload) => {
      console.log('[Push] Foreground message received:', JSON.stringify(payload, null, 2));
      
      const notification = {
        title: payload.notification?.title || 'New Notification',
        body: payload.notification?.body || '',
        data: payload.data as Record<string, string> | undefined,
      };

      console.log('[Push] Dispatching foreground notification:', notification);
      onNotification(notification);
    });

    console.log('[Push] Foreground message handler registered successfully');
    return unsubscribe;
  } catch (error) {
    console.error('[Push] Error setting up foreground message handler:', error);
    return null;
  }
}

export function isPushNotificationSupported(): boolean {
  const supported =
    isFirebaseConfigured() &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;
  console.log('[Push] isPushNotificationSupported:', supported, {
    firebaseConfigured: isFirebaseConfigured(),
    hasNotification: 'Notification' in window,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
  });
  return supported;
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    console.log('[Push] getNotificationPermissionStatus: unsupported');
    return 'unsupported';
  }
  const status = Notification.permission;
  console.log('[Push] getNotificationPermissionStatus:', status);
  return status;
}
