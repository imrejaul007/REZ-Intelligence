import { sendPushNotification } from './fcm';
import { templates } from './templates';
import type { PushPayload } from './templates';

class NotificationService {
  async send(userId: string, template: PushPayload) {
    // Get user's FCM token from database
    const token = await this.getUserToken(userId);

    if (!token) {
      console.log(`No FCM token for user ${userId}`);
      return;
    }

    await sendPushNotification({
      token,
      ...template,
    });
  }

  async sendMultiple(userIds: string[], template: PushPayload) {
    const tokens = await Promise.all(userIds.map(id => this.getUserToken(id)));
    const validTokens = tokens.filter((t): t is string => t !== null);

    for (const token of validTokens) {
      await sendPushNotification({ token, ...template });
    }
  }

  private async getUserToken(userId: string): Promise<string | null> {
    // TODO: Get from database
    return null;
  }
}

export const notificationService = new NotificationService();

// Quick send helpers
export async function notifyLoyalty(userId: string, type: string, data: Record<string, unknown>) {
  switch (type) {
    case 'milestone':
      await notificationService.send(userId, templates.loyalty_milestone(
        data.milestone as string,
        data.coins as number
      ));
      break;
    case 'streak_risk':
      await notificationService.send(userId, templates.streak_at_risk(data.days as number));
      break;
    case 'tier_upgrade':
      await notificationService.send(userId, templates.tier_upgrade(
        data.tier as string,
        data.bonus as number
      ));
      break;
  }
}

export async function notifyKitchen(storeId: string, orderId: string) {
  await notificationService.send(storeId, templates.order_created(orderId));
}
