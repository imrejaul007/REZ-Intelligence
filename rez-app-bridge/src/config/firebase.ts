import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

let firebaseApp: admin.app.App | null = null;

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const config: FirebaseConfig = {
    projectId: process.env.FCM_PROJECT_ID || '',
    privateKey: (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    clientEmail: process.env.FCM_CLIENT_EMAIL || '',
  };

  if (!config.projectId || !config.privateKey || !config.clientEmail) {
    logger.warn('Firebase configuration is incomplete. Push notifications will be disabled.');
    return null as unknown as admin.app.App;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.projectId,
        privateKey: config.privateKey,
        clientEmail: config.clientEmail,
      }),
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', { error });
    throw error;
  }
}

export function getFirebaseApp(): admin.app.App | null {
  return firebaseApp;
}

export function getMessaging(): admin.messaging.Messaging | null {
  if (!firebaseApp) {
    return null;
  }
  return firebaseApp.messaging();
}
