import * as admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

function initializeFirebase(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    console.warn('FIREBASE_SERVICE_ACCOUNT not set - push notifications disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized for push notifications');
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return null;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification(
  fcmTokens: string[],
  payload: PushNotificationPayload
): Promise<{ success: number; failure: number }> {
  const app = initializeFirebase();
  if (!app) {
    return { success: 0, failure: fcmTokens.length };
  }

  if (fcmTokens.length === 0) {
    return { success: 0, failure: 0 };
  }

  const messaging = admin.messaging(app);

  const message: admin.messaging.MulticastMessage = {
    tokens: fcmTokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    webpush: {
      fcmOptions: {
        link: '/',
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    return {
      success: response.successCount,
      failure: response.failureCount,
    };
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return { success: 0, failure: fcmTokens.length };
  }
}

export async function sendNewMessageNotification(
  fcmTokens: string[],
  senderName: string,
  channelName: string | null,
  messagePreview: string
): Promise<{ success: number; failure: number }> {
  const truncatedMessage = messagePreview.length > 100 
    ? messagePreview.substring(0, 97) + '...' 
    : messagePreview;

  return sendPushNotification(fcmTokens, {
    title: channelName || `Message from ${senderName}`,
    body: channelName ? `${senderName}: ${truncatedMessage}` : truncatedMessage,
    data: {
      type: 'chat_message',
    },
  });
}

export async function sendBulletinNotification(
  fcmTokens: string[],
  postTitle: string,
  authorName: string
): Promise<{ success: number; failure: number }> {
  return sendPushNotification(fcmTokens, {
    title: 'New Bulletin Post',
    body: `${authorName}: ${postTitle}`,
    data: {
      type: 'bulletin_post',
    },
  });
}
