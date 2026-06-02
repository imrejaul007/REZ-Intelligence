interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  channels: ('push' | 'sms' | 'whatsapp')[];
}

export class NotificationRetry {
  private maxRetries = 3;
  private retryDelays = [5000, 30000, 120000]; // 5s, 30s, 2min

  async send(payload: NotificationPayload): Promise<boolean> {
    let success = false;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.sendToAllChannels(payload);
        success = true;
        break;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelays[attempt]);
        }
      }
    }

    if (!success) {
      await this.logFailure(payload, lastError);
    }

    return success;
  }

  private async sendToAllChannels(payload: NotificationPayload): Promise<void> {
    const promises = [];

    if (payload.channels.includes('push')) {
      promises.push(this.sendPush(payload));
    }
    if (payload.channels.includes('sms')) {
      promises.push(this.sendSMS(payload));
    }
    if (payload.channels.includes('whatsapp')) {
      promises.push(this.sendWhatsApp(payload));
    }

    await Promise.allSettled(promises);
  }

  private async sendPush(payload: NotificationPayload): Promise<void> {
    // FCM/APNs implementation
  }

  private async sendSMS(payload: NotificationPayload): Promise<void> {
    // Twilio implementation
  }

  private async sendWhatsApp(payload: NotificationPayload): Promise<void> {
    // WhatsApp Business API
  }

  private async logFailure(payload: NotificationPayload, error: Error | null): Promise<void> {
    // Log to database for manual review
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
