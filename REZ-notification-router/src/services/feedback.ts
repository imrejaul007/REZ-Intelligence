import axios from 'axios';
import { FeedbackPayload, NotificationType } from '../types/index.js';
import { logWarn } from './logger.js';

const FEEDBACK_URL = process.env.FEEDBACK_URL || 'http://localhost:4085';

export async function sendFeedback(
  event: string,
  notificationId: string,
  userId: string,
  type: NotificationType,
  data?: Record<string, unknown>
): Promise<boolean> {
  try {
    const payload: FeedbackPayload = {
      nudgeId: notificationId,
      userId,
      appId: 'notification-router',
      event,
      metadata: { type, data },
    };

    await axios.post(`${FEEDBACK_URL}/api/feedback/nudge`, payload, {
      timeout: 2000,
    });

    return true;
  } catch (error) {
    logWarn('Feedback send failed', { error: (error as Error).message });
    return false;
  }
}
