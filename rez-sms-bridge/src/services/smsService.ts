import { config } from '../config';
import { createClient, RedisClientType } from 'redis';
import axios from 'axios';
import { z } from 'zod';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

const sendSchema = z.object({
  to: z.string().min(10),
  message: z.string().max(1600),
});

const templateSendSchema = z.object({
  to: z.string().min(10),
  template: z.enum(['order_confirmed', 'order_placed', 'help_response', 'status_update', 'verification']),
  data: z.record(z.unknown()),
});

let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({ url: config.redis.url });
    redisClient.on('error', (err) => logger.error('Redis Client Error', { error: err }));
    await redisClient.connect();
  }
  return redisClient;
}

export class SMSService {
  /**
   * Send a plain SMS message
   */
  async send(to: string, message: string): Promise<void> {
    const validation = sendSchema.safeParse({ to, message });
    if (!validation.success) {
      throw new Error(`Invalid SMS parameters: ${validation.error.message}`);
    }

    logger.info('Sending SMS', { to, messageLength: message.length });

    // Check for duplicate within 60 seconds (rate limiting)
    const redis = await getRedisClient();
    const duplicateKey = `sms:send:${to}:${Buffer.from(message).toString('base64').slice(0, 32)}`;
    const isDuplicate = await redis.exists(duplicateKey);

    if (isDuplicate) {
      logger.warn('Duplicate SMS detected, skipping', { to });
      return;
    }

    try {
      // Try Twilio first
      if (config.twilio.accountSid && config.twilio.authToken) {
        await this.sendViaTwilio(to, message);
        await redis.setEx(duplicateKey, 60, '1');
        logger.info('SMS sent via Twilio', { to });
        return;
      }

      // Fallback to MSG91
      if (config.msg91.apiKey) {
        await this.sendViaMsg91(to, message);
        await redis.setEx(duplicateKey, 60, '1');
        logger.info('SMS sent via MSG91', { to });
        return;
      }

      throw new Error('No SMS provider configured');
    } catch (error) {
      logger.error('Failed to send SMS', { to, error });
      throw error;
    }
  }

  /**
   * Send a templated SMS message
   */
  async sendTemplate(to: string, template: string, data: Record<string, unknown>): Promise<void> {
    const validation = templateSendSchema.safeParse({ to, template, data });
    if (!validation.success) {
      throw new Error(`Invalid template parameters: ${validation.error.message}`);
    }

    const templates: Record<string, { message: string }> = {
      order_confirmed: {
        message: `REZ: Your order #{orderId} has been confirmed. Total: Rs.{amount}. Track at: {trackingUrl}`,
      },
      order_placed: {
        message: `REZ: Order #{orderId} placed successfully! Items: {items}. Total: Rs.{amount}.`,
      },
      help_response: {
        message: `REZ Help: {helpText}. For assistance call {supportPhone}.`,
      },
      status_update: {
        message: `REZ: Order #{orderId} status updated to "{status}". {additionalInfo}`,
      },
      verification: {
        message: `REZ: Your verification code is {code}. Valid for {validity} minutes. Do not share.`,
      },
    };

    const templateConfig = templates[template];
    if (!templateConfig) {
      throw new Error(`Unknown template: ${template}`);
    }

    // Replace placeholders in template
    let message = templateConfig.message;
    for (const [key, value] of Object.entries(data)) {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    await this.send(to, message);
  }

  private async sendViaTwilio(to: string, body: string): Promise<void> {
    const { accountSid, authToken, phoneNumber } = config.twilio;

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({
        To: to,
        From: phoneNumber,
        Body: body,
      }),
      {
        auth: {
          username: accountSid,
          password: authToken,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (response.status !== 201) {
      throw new Error(`Twilio API error: ${response.status}`);
    }
  }

  private async sendViaMsg91(to: string, message: string): Promise<void> {
    const flowId = 'REZ'; // Configure your flow ID
    const response = await axios.post(
      'https://api.msg91.com/api/v5/flow/',
      {
        flow_id: flowId,
        sender: 'REZAPP',
        mobiles: to.replace('+', ''),
        message,
      },
      {
        headers: {
          'authkey': config.msg91.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.type !== 'success') {
      throw new Error(`MSG91 API error: ${JSON.stringify(response.data)}`);
    }
  }
}

export const smsService = new SMSService();
