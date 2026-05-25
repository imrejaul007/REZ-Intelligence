/**
 * Voice Channel Adapter
 * Handles voice/Telephony integration with Twilio Voice
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { ChannelType, IncomingMessage, OutgoingMessage } from '../types';
import { ChannelAdapter } from '../types';
import { config } from '../config';
import { logger } from '../config/logger';
import { ConversationService } from '../services/conversationLogger';
import { getContextManager } from '../services/contextManager';
import { getIntentProcessor } from '../services/intentProcessor';
import { getAgentRouter } from '../services/agentRouter';
import { getResponseGenerator } from '../services/responseGenerator';
import { Session } from '../models/Session';
import { Conversation } from '../models/Conversation';

const voiceLogger = logger.child({ component: 'VoiceAdapter' });

interface TwilioVoiceWebhook {
  From: string;
  To: string;
  CallSid: string;
  CallStatus: string;
  TranscriptionText?: string;
  Digits?: string;
  RecordingUrl?: string;
  RecordingDuration?: string;
  Prompt?: string;
}

export class VoiceAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'voice';
  private conversationService: ConversationService;
  private contextManager = getContextManager();
  private intentProcessor = getIntentProcessor();
  private agentRouter = getAgentRouter();
  private responseGenerator = getResponseGenerator();

  constructor(conversationService: ConversationService) {
    this.conversationService = conversationService;
  }

  /**
   * Process incoming voice input (speech or DTMF)
   */
  async processMessage(payload: IncomingMessage): Promise<OutgoingMessage> {
    const startTime = Date.now();

    voiceLogger.debug('Processing voice input', {
      sessionId: payload.sessionId,
    });

    try {
      // Get or create session
      const { session, conversation } = await this.getOrCreateSession(payload);

      // Log incoming message
      const incomingMsg = await this.conversationService.logIncomingMessage(
        payload,
        conversation.conversationId,
        session.sessionId
      );

      // Load context
      const context = await this.contextManager.loadContext(session.sessionId);

      // Detect intent
      const intent = await this.intentProcessor.detectIntent(payload.message, context);

      // Route to agent
      const routing = await this.agentRouter.route(intent, context);

      // Generate response
      const response = await this.responseGenerator.generate(
        payload,
        context,
        intent,
        routing
      );

      // Log outgoing message
      const processingTime = Date.now() - startTime;
      await this.conversationService.logOutgoingMessage(response, incomingMsg.messageId, {
        routingTimeMs: processingTime / 3,
        generationTimeMs: (processingTime / 3) * 2,
      });

      return response;
    } catch (error) {
      voiceLogger.error('Failed to process voice input', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send voice response via TwiML
   */
  async sendMessage(message: OutgoingMessage): Promise<string> {
    voiceLogger.debug('Sending voice response', {
      messageId: message.messageId,
    });

    // Voice responses are sent via TwiML in the webhook response
    // This method returns the TwiML string
    return this.generateTwiml(message);
  }

  /**
   * Handle incoming Twilio Voice webhook
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const body = req.body as TwilioVoiceWebhook;

    voiceLogger.debug('Received voice webhook', {
      callSid: body.CallSid,
      callStatus: body.CallStatus,
    });

    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(req)) {
        voiceLogger.warn('Invalid voice webhook signature');
        res.status(401).send('Invalid signature');
        return;
      }

      // Handle different call statuses
      switch (body.CallStatus) {
        case 'initiated':
        case 'ringing':
          await this.handleCallStarted(body);
          break;

        case 'in-progress':
          await this.handleCallActive(body);
          break;

        case 'completed':
          await this.handleCallEnded(body);
          break;

        case 'failed':
        case 'busy':
        case 'no-answer':
          await this.handleCallFailed(body);
          break;
      }

      // Check for transcription (after user speaks)
      if (body.TranscriptionText) {
        await this.handleTranscription(body);
      }

      // Check for DTMF input
      if (body.Digits) {
        await this.handleDTMF(body);
      }

      res.status(200).send('OK');
    } catch (error) {
      voiceLogger.error('Voice webhook handling failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).send('Internal error');
    }
  }

  /**
   * Handle call started
   */
  private async handleCallStarted(body: TwilioVoiceWebhook): Promise<void> {
    voiceLogger.info('Voice call initiated', {
      callSid: body.CallSid,
      from: body.From,
      to: body.To,
    });

    // Create a new session for the call
    const payload: IncomingMessage = {
      message: '',
      channel: 'voice',
      userId: body.From,
      metadata: {
        callSid: body.CallSid,
      },
    };

    try {
      const { session, conversation } = await this.getOrCreateSession(payload);

      // Update call metadata
      await Session.updateOne(
        { sessionId: session.sessionId },
        {
          $set: {
            'channelMetadata.platform': 'voice',
            'channelMetadata.callSid': body.CallSid,
          },
        }
      );

      voiceLogger.debug('Voice session created', {
        sessionId: session.sessionId,
        callSid: body.CallSid,
      });
    } catch (error) {
      voiceLogger.error('Failed to create voice session', {
        callSid: body.CallSid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle active call (greeting)
   */
  private async handleCallActive(body: TwilioVoiceWebhook): Promise<void> {
    voiceLogger.debug('Voice call active', {
      callSid: body.CallSid,
    });

    // Send greeting
    const twiml = this.generateGreetingTwiml();
    res.type('text/xml').send(twiml);
  }

  /**
   * Handle call ended
   */
  private async handleCallEnded(body: TwilioVoiceWebhook): Promise<void> {
    voiceLogger.info('Voice call ended', {
      callSid: body.CallSid,
    });

    try {
      // Find session by call sid and end it
      const session = await Session.findOne({
        'channelMetadata.callSid': body.CallSid,
      });

      if (session) {
        await this.conversationService.endSession(session.sessionId);
        voiceLogger.debug('Voice session ended', {
          sessionId: session.sessionId,
        });
      }
    } catch (error) {
      voiceLogger.error('Failed to end voice session', {
        callSid: body.CallSid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle call failed
   */
  private async handleCallFailed(body: TwilioVoiceWebhook): Promise<void> {
    voiceLogger.warn('Voice call failed', {
      callSid: body.CallSid,
      status: body.CallStatus,
    });

    // Log the failure
    await this.handleCallEnded(body);
  }

  /**
   * Handle transcription (speech to text)
   */
  private async handleTranscription(body: TwilioVoiceWebhook): Promise<void> {
    voiceLogger.debug('Processing voice transcription', {
      callSid: body.CallSid,
      transcriptionLength: body.TranscriptionText?.length || 0,
    });

    const payload: IncomingMessage = {
      message: body.TranscriptionText || '',
      channel: 'voice',
      userId: body.From,
      metadata: {
        callSid: body.CallSid,
        inputType: 'voice',
      },
    };

    try {
      const response = await this.processMessage(payload);

      // Send response via TwiML
      const twiml = this.generateTwiml(response);
      res.type('text/xml').send(twiml);
    } catch (error) {
      voiceLogger.error('Failed to process transcription', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle DTMF input
   */
  private async handleDTMF(body: TwilioVoiceWebhook): Promise<void> {
    voiceLogger.debug('Processing DTMF input', {
      callSid: body.CallSid,
      digits: body.Digits,
    });

    // Map DTMF to intent
    const dtmfIntent = this.mapDTMFToIntent(body.Digits || '');

    if (dtmfIntent) {
      const payload: IncomingMessage = {
        message: dtmfIntent,
        channel: 'voice',
        userId: body.From,
        metadata: {
          callSid: body.CallSid,
          inputType: 'dtmf',
          digits: body.Digits,
        },
      };

      try {
        const response = await this.processMessage(payload);
        const twiml = this.generateTwiml(response);
        res.type('text/xml').send(twiml);
      } catch (error) {
        voiceLogger.error('Failed to process DTMF', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Verify Twilio webhook signature
   */
  private verifyWebhookSignature(req: Request): boolean {
    const signature = req.headers['x-twilio-signature'] as string;
    if (!signature || !config.channels.voice.webhookSecret) {
      return config.server.nodeEnv === 'development';
    }

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (config.server.nodeEnv === 'development') {
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha1', config.channels.voice.webhookSecret)
      .update(url)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get or create session for voice caller
   */
  private async getOrCreateSession(payload: IncomingMessage): Promise<{
    session: InstanceType<typeof Session>;
    conversation: InstanceType<typeof Conversation>;
  }> {
    const userId = payload.userId || 'unknown';

    // Find or create conversation
    let conversation = await Conversation.findOne({
      userId,
      status: 'active',
      primaryChannel: 'voice',
    });

    if (!conversation) {
      conversation = await Conversation.findOrCreate(userId, 'voice');
    }

    // Find or create session
    const { session, isNew } = await Session.getOrCreateSession({
      conversationId: conversation.conversationId,
      userId,
      channel: 'voice',
      channelMetadata: {
        platform: 'voice',
        deviceType: 'phone',
      },
    });

    if (isNew) {
      await conversation.addSession(session._id);
      await conversation.save();
    }

    return { session, conversation };
  }

  /**
   * Generate TwiML greeting response
   */
  private generateGreetingTwiml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" bargeIn="true">
    Welcome to REZ support. How can I help you today?
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">
    You can say your request naturally, or press 1 for orders, 2 for support, or 0 to speak with an agent.
  </Say>
  <Gather numDigits="1" action="/webhooks/voice/input" method="POST" timeout="10">
    <Pause length="10"/>
  </Gather>
  <Say voice="Polly.Joanna">
    I didn't receive unknown input. Please try again.
  </Say>
  <Redirect>/webhooks/voice/gather</Redirect>
</Response>`;
  }

  /**
   * Generate TwiML from outgoing message
   */
  private generateTwiml(message: OutgoingMessage): string {
    const text = message.content.text || 'Thank you for calling. Goodbye.';

    let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>`;

    // Split text into sentences for natural pacing
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      if (sentence.trim()) {
        twiml += `
  <Say voice="Polly.Joanna" bargeIn="true">${this.escapeXml(sentence.trim())}</Say>`;
      }
    }

    // Add pause before ending or continuing
    twiml += `
  <Pause length="1"/>`;

    // Check if user needs to provide more input
    if (message.metadata?.needsInput) {
      twiml += `
  <Gather numDigits="1" action="/webhooks/voice/input" method="POST" timeout="15">
    <Pause length="15"/>
  </Gather>`;
    }

    twiml += `
</Response>`;

    return twiml;
  }

  /**
   * Map DTMF digits to intent
   */
  private mapDTMFToIntent(digits: string): string | null {
    const digitMap: Record<string, string> = {
      '1': 'order_status',
      '2': 'support',
      '3': 'product_inquiry',
      '4': 'feedback',
      '5': 'cancel_order',
      '0': 'speak_to_agent',
      '*': 'repeat',
      '#': 'main_menu',
    };

    return digitMap[digits] || null;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Format message for voice channel
   */
  formatForChannel(message: OutgoingMessage): string {
    return this.generateTwiml(message);
  }
}

// Reference for res variable
let res: Response;

export { VoiceAdapter };
