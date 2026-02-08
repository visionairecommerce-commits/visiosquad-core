import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { apiRequest } from './queryClient';

let firebaseApp: FirebaseApp | null = null;
let messaging: Messaging | null = null;

const firebaseConfig = {
  apiKey: "AIzaSyDbQZsJe7Kk1cBXCWMAeWfBUS32PMieBwM",
  authDomain: "visiosport-notifications.firebaseapp.com",
  projectId: "visiosport-notifications",
  storageBucket: "visiosport-notifications.appspot.com",
  messagingSenderId: "206308630478",
  appId: "1:206308630478:web:47bf44885c4c93fee3559f",
};

function isFirebaseConfigured(): boolean {
  console.log('[Push] Using API Key:', firebaseConfig.apiKey.substring(0, 5) + '...');
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
}

function initializeFirebase(): { app: FirebaseApp; messaging: Messaging } | null {
  if (!isFirebaseConfigured()) {
    console.warn('[Push] Firebase not configured - missing env vars');
    return null;
  }

  try {
    if (!firebaseApp) {
      firebaseApp = getApps().length === 0
        ? initializeApp(firebaseConfig)
        : getApps()[0];
    }
    if (!messaging) {
      messaging = getMessaging(firebaseApp);
    }
    return { app: firebaseApp, messaging };
  } catch (error) {
    console.error('[Push] Failed to initialize Firebase:', error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<string | null> {
  console.log('[Push] requestNotificationPermission() called');

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[Push] Browser does not support notifications or service workers');
    return null;
  }

  const firebase = initializeFirebase();
  if (!firebase) return null;

  try {
    const permission = await Notification.requestPermission();
    console.log('[Push] Permission result:', permission);
    if (permission !== 'granted') return null;

    console.log('[Push] Registering Service Worker...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[Push] SW registered, waiting for ready...');
    await navigator.serviceWorker.ready;
    console.log('[Push] SW ready');

    const vapidKey = import.meta.env.VITE_PUBLIC_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[Push] VITE_PUBLIC_VAPID_KEY not set');
      return null;
    }
    console.log('[Push] VAPID key length:', vapidKey.length);

    console.log('[Push] Calling getToken()...');
    const token = await getToken(firebase.messaging, {
      vapidKey: vapidKey.trim(),
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('[Push] FCM token obtained, length:', token.length);
      await apiRequest('POST', '/api/push-subscriptions', {
        fcm_token: token,
        device_type: 'web',
      });
      console.log('[Push] Token registered with backend');
      return token;
    } else {
      console.warn('[Push] getToken() returned empty - check VAPID key matches Firebase project');
      return null;
    }
  } catch (error: any) {
    console.error('[Push] Error:', error?.message || error);
    if (error?.code) console.error('[Push] Code:', error.code);
    return null;
  }
}

export function setupForegroundMessageHandler(
  onNotification: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): (() => void) | null {
  const firebase = initializeFirebase();
  if (!firebase) return null;

  try {
    const unsubscribe = onMessage(firebase.messaging, (payload) => {
      console.log('[Push] Foreground message:', payload);
      onNotification({
        title: payload.notification?.title || 'New Notification',
        body: payload.notification?.body || '',
        data: payload.data as Record<string, string> | undefined,
      });
    });
    return unsubscribe;
  } catch (error) {
    console.error('[Push] Foreground handler error:', error);
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
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
