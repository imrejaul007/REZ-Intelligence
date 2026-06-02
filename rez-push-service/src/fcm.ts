import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

interface PushNotification {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

export async function sendPushNotification(notification: PushNotification): Promise<string> {
  const message: admin.messaging.Message = {
    token: notification.token,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data,
    apns: {
      payload: {
        aps: {
          badge: notification.badge || 1,
          sound: notification.sound || 'default',
        },
      },
    },
    android: {
      priority: 'high' as const,
      notification: {
        channelId: 'rez_notifications',
      },
    },
  };

  const response = await admin.messaging().send(message);
  return response;
}

export async function sendMultiple(notifications: PushNotification[]): Promise<string[]> {
  const promises = notifications.map(sendPushNotification);
  return Promise.all(promises);
}
