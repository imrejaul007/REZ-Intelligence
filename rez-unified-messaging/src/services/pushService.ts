/**
 * PUSH NOTIFICATION SERVICE
 *
 * Supports Firebase Cloud Messaging (FCM)
 */

// ============================================
// CONFIG
// ============================================

interface PushConfig {
  serverKey: string;
  projectId: string;
}

const config: PushConfig = {
  serverKey: process.env.FIREBASE_SERVER_KEY || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
};

// ============================================
// TYPES
// ============================================

export interface PushNotification {
  title: string;
  body: string;
  image?: string;
  icon?: string;
  clickAction?: string;
  data?: Record<string, string>;
}

export interface PushTarget {
  token?: string;        // Single device
  topic?: string;         // Topic subscription
  condition?: string;     // Condition query
}

export interface PushResult {
  success: number;
  failed: number;
  messageIds?: string[];
  errors?: { index: number; error: string }[];
}

// ============================================
// SEND TO DEVICE
// ============================================

export async function sendToDevice(
  deviceToken: string,
  notification: PushNotification,
  data?: Record<string, string>
): Promise<{ success: boolean; messageId?: string }> {
  try {
    const payload = {
      to: deviceToken,
      notification: {
        title: notification.title,
        body: notification.body,
        image: notification.image,
        icon: notification.icon || 'ic_notification',
        click_action: notification.clickAction,
      },
      data: {
        ...data,
        ...notification.data,
      },
      priority: 'high' as const,
    };

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${config.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success === 1) {
      return { success: true, messageId: result.results[0]?.message_id };
    }

    return { success: false };

  } catch (error) {
    console.error('[Push] Send error:', error);
    return { success: false };
  }
}

// ============================================
// SEND TO TOPIC
// ============================================

export async function sendToTopic(
  topic: string,
  notification: PushNotification,
  data?: Record<string, string>
): Promise<{ success: boolean; messageId?: string }> {
  try {
    const payload = {
      to: `/topics/${topic}`,
      notification: {
        title: notification.title,
        body: notification.body,
        image: notification.image,
      },
      data,
      priority: 'high' as const,
    };

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${config.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    return { success: result.success === 1, messageId: result.results[0]?.message_id };

  } catch (error) {
    return { success: false };
  }
}

// ============================================
// SEND TO MULTIPLE DEVICES
// ============================================

export async function sendToMultiple(
  deviceTokens: string[],
  notification: PushNotification,
  data?: Record<string, string>
): Promise<PushResult> {
  try {
    const payload = {
      registration_ids: deviceTokens,
      notification: {
        title: notification.title,
        body: notification.body,
        image: notification.image,
      },
      data,
      priority: 'high' as const,
    };

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${config.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    return {
      success: result.success || 0,
      failed: result.failure || 0,
      messageIds: result.results?.map((r: any) => r.message_id),
      errors: result.results?.map((r: any, i: number) => r.error ? { index: i, error: r.error } : null).filter(Boolean),
    };

  } catch (error) {
    return { success: 0, failed: deviceTokens.length };
  }
}

// ============================================
// TOPIC MANAGEMENT
// ============================================

export async function subscribeToTopic(
  deviceToken: string,
  topic: string
): Promise<boolean> {
  try {
    const payload = {
      to: `/topics/${topic}`,
      registration_tokens: [deviceToken],
    };

    const response = await fetch(`https://iid.googleapis.com/iid/v1:batchAdd`, {
      method: 'POST',
      headers: {
        'Authorization': `key=${config.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response.ok;

  } catch (error) {
    return false;
  }
}

export async function unsubscribeFromTopic(
  deviceToken: string,
  topic: string
): Promise<boolean> {
  try {
    const payload = {
      to: `/topics/${topic}`,
      registration_tokens: [deviceToken],
    };

    const response = await fetch(`https://iid.googleapis.com/iid/v1:batchRemove`, {
      method: 'POST',
      headers: {
        'Authorization': `key=${config.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response.ok;

  } catch (error) {
    return false;
  }
}

// ============================================
// PRESET NOTIFICATIONS
// ============================================

export async function sendOrderUpdate(
  deviceToken: string,
  orderId: string,
  status: string,
  message: string
): Promise<{ success: boolean }> {
  return sendToDevice(deviceToken, {
    title: `Order #${orderId}`,
    body: message,
    clickAction: `rez://order/${orderId}`,
  }, { orderId, status, type: 'order_update' });
}

export async function sendOfferNotification(
  deviceToken: string,
  offerTitle: string,
  offerText: string,
  offerId: string
): Promise<{ success: boolean }> {
  return sendToDevice(deviceToken, {
    title: offerTitle,
    body: offerText,
    clickAction: `rez://offer/${offerId}`,
  }, { offerId, type: 'offer' });
}

export async function sendReEngagement(
  deviceToken: string,
  message: string,
  context: string
): Promise<{ success: boolean }> {
  return sendToDevice(deviceToken, {
    title: 'We miss you!',
    body: message,
    clickAction: `rez://home`,
  }, { type: 'reengagement', context });
}

export async function sendAbandonedCartReminder(
  deviceToken: string,
  items: string[],
  total: number
): Promise<{ success: boolean }> {
  return sendToDevice(deviceToken, {
    title: 'Your cart is waiting! 🛒',
    body: `Complete your order of ${items.length} items worth ₹${total}`,
    clickAction: 'rez://cart',
  }, { type: 'abandoned_cart', items: JSON.stringify(items) });
}
