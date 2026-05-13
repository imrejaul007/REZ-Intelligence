import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { commandParser } from './commandParser';
import { smsService } from './smsService';
import axios from 'axios';
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

export interface TwilioWebhookBody {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  AccountSid: string;
}

export class WebhookService {
  /**
   * Verify Twilio webhook signature
   */
  verifyTwilioSignature(req: Request): boolean {
    const signature = req.headers['x-twilio-signature'] as string;
    if (!signature) {
      logger.warn('Missing Twilio signature header');
      return false;
    }

    const url = `${config.orchestrator.url}/webhook/sms`;
    const params = req.body as Record<string, string>;

    // Build the full URL with query params for validation
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const data = `${url}${sortedParams}`;

    const expectedSignature = crypto
      .createHmac('sha1', config.twilio.authToken)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Handle incoming SMS from Twilio webhook
   */
  async handleIncomingSMS(req: Request, res: Response): Promise<void> {
    const body = req.body as TwilioWebhookBody;

    logger.info('Received incoming SMS', {
      from: body.From,
      to: body.To,
      messageSid: body.MessageSid,
      bodyLength: body.Body?.length,
    });

    try {
      // Validate required fields
      if (!body.From || !body.Body) {
        logger.error('Invalid webhook payload', { body });
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Parse the SMS command
      const parsedCommand = commandParser.parse(body.Body);

      if (!parsedCommand.valid) {
        logger.warn('Invalid SMS command format', {
          from: body.From,
          body: body.Body,
          error: parsedCommand.error,
        });

        // Send help response for invalid commands
        await smsService.sendTemplate(body.From, 'help_response', {
          helpText: 'Invalid command. Use: REZ ORDER <item>, REZ STATUS <orderId>, or REZ HELP',
          supportPhone: '1800-XXX-XXXX',
        });

        res.status(200).send(); // Twilio expects 200 for webhook
        return;
      }

      // Forward to Orchestrator
      const orchestratorResponse = await this.forwardToOrchestrator(parsedCommand, body.From);

      if (orchestratorResponse.success) {
        logger.info('Command processed successfully', {
          command: parsedCommand.command,
          from: body.From,
        });

        // Send confirmation SMS if needed
        if (orchestratorResponse.sendSMS) {
          await smsService.send(body.From, orchestratorResponse.message);
        }
      } else {
        logger.error('Orchestrator processing failed', {
          command: parsedCommand.command,
          from: body.From,
          error: orchestratorResponse.error,
        });

        // Send error message to user
        await smsService.send(body.From, `REZ: ${orchestratorResponse.error || 'Processing failed. Please try again.'}`);
      }

      res.status(200).send();
    } catch (error) {
      logger.error('Error handling incoming SMS', { error, body });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Forward parsed command to Orchestrator service
   */
  private async forwardToOrchestrator(
    parsedCommand: ReturnType<typeof commandParser.parse>,
    phoneNumber: string
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    sendSMS?: boolean;
  }> {
    try {
      const response = await axios.post(
        `${config.orchestrator.url}/api/intent/from-sms`,
        {
          command: parsedCommand.command,
          action: parsedCommand.action,
          params: parsedCommand.params,
          phoneNumber,
          source: 'twilio',
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': config.internalServiceTokens.orchestrator || '',
          },
          timeout: 30000,
        }
      );

      return {
        success: true,
        message: response.data.message,
        sendSMS: response.data.sendSMS ?? true,
      };
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      logger.error('Failed to forward to orchestrator', {
        error: axiosError.message,
        response: axiosError.response?.data,
      });

      return {
        success: false,
        error: axiosError.response?.data?.message || 'Failed to process request',
      };
    }
  }
}

export const webhookService = new WebhookService();
