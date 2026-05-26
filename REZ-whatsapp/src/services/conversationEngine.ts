import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import twilio from 'twilio';
import { Session, ISession } from '../models/Session';
import { Conversation, IConversation } from '../models/Conversation';
import {
  SessionState,
  IntentDetection,
  MessageType,
  ConversationTurn,
} from '../types/whatsapp';
import { logger } from '../utils/logger.js';

// ============================================
// Twilio Retry Configuration
// ============================================

const TWILIO_RATE_LIMIT_DELAY = 5000; // 5 seconds between rate-limited requests
const TWILIO_MAX_RETRIES = 3;
const TWILIO_RETRY_DELAY_BASE = 1000; // Base delay for exponential backoff

interface TwilioMessageResult {
  messageId: string;
  status: string;
  sid?: string;
}

interface TemplateMessageResult {
  messageId: string;
  sid?: string;
}

interface WebhookData {
  From?: string;
  Body?: string;
  MessageSid?: string;
  Timestamp?: string;
  [key: string]: unknown;
}

interface NLUResult {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  suggestedActions: string[];
}

/**
 * AI-powered intent detection result
 */
interface AIIntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  suggestedActions: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  language?: string;
}

/**
 * Conversation context for AI detection
 */
interface AIConversationContext {
  userId?: string;
  state?: SessionState;
  conversationHistory?: Array<{ intent: string; message: string }>;
  cart?: unknown[];
  sessionData?: Record<string, unknown>;
}

interface ResponseOption {
  message: string;
  type: MessageType;
  mediaUrl?: string;
  actions?: Array<{ type: string; title: string; payload?: string }>;
  state?: SessionState;
}

export class ConversationEngine {
  private intentPatterns: Map<string, RegExp[]>;
  private stateResponses: Map<SessionState, (context: ConversationContext) => ResponseOption[]>;
  private twilioClient: twilio.Twilio | null = null;
  private whatsappPhoneNumber: string;

  constructor(twilioClient?: twilio.Twilio, whatsappPhoneNumber?: string) {
    this.intentPatterns = new Map();
    this.stateResponses = new Map();
    this.twilioClient = twilioClient || null;
    this.whatsappPhoneNumber = whatsappPhoneNumber || '';
    this.initializePatterns();
  }

  /**
   * Configure Twilio client after construction
   */
  configureTwilio(client: twilio.Twilio, phoneNumber: string): void {
    this.twilioClient = client;
    this.whatsappPhoneNumber = phoneNumber;
    logger.info('Twilio client configured for ConversationEngine');
  }

  /**
   * Retry helper with exponential backoff for Twilio rate limits
   */
  private async withTwilioRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries: number = TWILIO_MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = TWILIO_RETRY_DELAY_BASE;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error as Error;
        const errorMessage = lastError.message || '';
        const errorCode = (error as { code?: string }).code;

        // Check if this is a rate limit error (20429) or temporary failure
        if (
          errorCode === '20429' ||
          errorMessage.includes('429') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('temporarily unavailable')
        ) {
          if (attempt < retries) {
            logger.warn(`Twilio rate limit hit, retrying in ${delay}ms`, {
              attempt: attempt + 1,
              maxRetries: retries,
              operation: operationName,
            });
            await this.sleep(delay);
            delay *= 2; // Exponential backoff
            continue;
          }
        }

        // For other errors, don't retry
        throw lastError;
      }
    }

    throw lastError;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send a real WhatsApp message via Twilio
   */
  async sendMessage(
    to: string,
    body: string,
    mediaUrl?: string
  ): Promise<TwilioMessageResult> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    const from = `whatsapp:${this.whatsappPhoneNumber}`;
    const toFormatted = `whatsapp:${to.replace(/^\+/, '')}`;

    return this.withTwilioRetry(async () => {
      const messageParams: {
        from: string;
        to: string;
        body: string;
        mediaUrl?: string[];
      } = {
        from,
        to: toFormatted,
        body,
      };

      if (mediaUrl) {
        messageParams.mediaUrl = [mediaUrl];
      }

      const message = await this.twilioClient!.messages.create(messageParams);

      logger.info('WhatsApp message sent via Twilio', {
        messageId: message.sid,
        to: toFormatted,
        status: message.status,
      });

      return {
        messageId: message.sid,
        status: message.status,
        sid: message.sid,
      };
    }, `sendMessage to ${to}`);
  }

  /**
   * Send a template message via Twilio
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    components?: Record<string, string>
  ): Promise<TemplateMessageResult> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    const toFormatted = `whatsapp:${to.replace(/^\+/, '')}`;

    return this.withTwilioRetry(async () => {
      const messageParams: {
        from: string;
        to: string;
        contentSid: string;
        contentVariables?: string;
      } = {
        from: `whatsapp:${this.whatsappPhoneNumber}`,
        to: toFormatted,
        contentSid: templateName, // Template SID from Twilio
      };

      if (components && Object.keys(components).length > 0) {
        // Convert { "1": "value" } format for Twilio
        messageParams.contentVariables = JSON.stringify(components);
      }

      const message = await this.twilioClient!.messages.create(messageParams as Parameters<typeof this.twilioClient.messages.create>[0]);

      logger.info('Template message sent via Twilio', {
        messageId: message.sid,
        to: toFormatted,
        templateName,
      });

      return {
        messageId: message.sid,
        sid: message.sid,
      };
    }, `sendTemplateMessage to ${to}`);
  }

  /**
   * Send interactive message with buttons
   */
  async sendInteractiveMessage(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string
  ): Promise<TwilioMessageResult> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    const toFormatted = `whatsapp:${to.replace(/^\+/, '')}`;

    return this.withTwilioRetry(async () => {
      const interactiveContent = {
        type: 'interactive',
        interactive: {
          type: 'button' as const,
          header: header ? { type: 'text' as const, text: header } : undefined,
          body: { text: body },
          action: {
            buttons: buttons.slice(0, 3).map((btn) => ({
              type: 'reply' as const,
              reply: {
                id: btn.id,
                title: btn.title.substring(0, 25), // WhatsApp max 25 chars
              },
            })),
          },
        },
      };

      const message = await this.twilioClient!.messages.create({
        from: `whatsapp:${this.whatsappPhoneNumber}`,
        to: toFormatted,
        contentSid: 'interactive_template',
        contentVariables: JSON.stringify({ '1': body }),
      });

      // If using contentSid approach doesn't work, fall back to body-only
      if (message.status === 'failed') {
        logger.warn('Interactive message failed, sending as text', {
          messageId: message.sid,
        });
        // Send as plain text with button options inline
        const fallbackBody = `${body}\n\nOptions:\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}`;
        const fallbackMessage = await this.twilioClient!.messages.create({
          from: `whatsapp:${this.whatsappPhoneNumber}`,
          to: toFormatted,
          body: fallbackBody,
        });
        return {
          messageId: fallbackMessage.sid,
          status: fallbackMessage.status,
          sid: fallbackMessage.sid,
        };
      }

      logger.info('Interactive message sent via Twilio', {
        messageId: message.sid,
        to: toFormatted,
        buttonCount: buttons.length,
      });

      return {
        messageId: message.sid,
        status: message.status,
        sid: message.sid,
      };
    }, `sendInteractiveMessage to ${to}`);
  }

  /**
   * Handle incoming webhook message from Twilio
   */
  async handleIncomingMessage(webhookData: WebhookData): Promise<void> {
    const { From, Body, MessageSid, Timestamp } = webhookData;

    if (!From || !MessageSid) {
      logger.warn('Invalid webhook data received', { webhookData });
      return;
    }

    // Extract phone number without whatsapp: prefix
    const fromNumber = From.replace('whatsapp:', '').replace(/^\+/, '');

    logger.info('Handling incoming WhatsApp message', {
      from: fromNumber,
      messageId: MessageSid,
      timestamp: Timestamp,
    });

    try {
      // Detect intent using NLP
      const intentResult = await this.detectIntent(Body || '');

      logger.info('Intent detected', {
        from: fromNumber,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
      });

      // Generate response
      const response = await this.generateResponseFromIntent(intentResult);

      // Send response back to user
      if (response.message) {
        if (response.actions && response.actions.length > 0) {
          await this.sendInteractiveMessage(
            fromNumber,
            response.message,
            response.actions.map((a) => ({
              id: a.payload || a.title.toLowerCase().replace(/\s+/g, '_'),
              title: a.title,
            })),
            response.type === MessageType.INTERACTIVE ? 'Menu' : undefined
          );
        } else {
          await this.sendMessage(fromNumber, response.message, response.mediaUrl);
        }
      }

      // Store message in history
      await this.storeMessage(MessageSid, webhookData);

    } catch (error) {
      logger.error('Failed to handle incoming message', {
        from: fromNumber,
        messageId: MessageSid,
        error,
      });

      // Send error message to user
      try {
        await this.sendMessage(
          fromNumber,
          "Sorry, I encountered an error processing your message. Please try again."
        );
      } catch (sendError) {
        logger.error('Failed to send error message', { sendError });
      }
    }
  }

  /**
   * Store message in conversation history
   */
  private async storeMessage(messageSid: string, webhookData: WebhookData): Promise<void> {
    try {
      const fromNumber = webhookData.From?.replace('whatsapp:', '') || '';
      const body = webhookData.Body || '';
      const timestamp = webhookData.Timestamp
        ? new Date(parseInt(webhookData.Timestamp) * 1000)
        : new Date();

      // Find existing session or create minimal record
      const session = await Session.findOne({ userId: fromNumber });

      if (session) {
        session.addMessage('user', body, messageSid);
        await session.save();
      }

      logger.debug('Message stored in history', { messageSid, fromNumber });
    } catch (error) {
      logger.error('Failed to store message', { messageSid, error });
    }
  }

  /**
   * Generate response from NLU result (for incoming webhook handling)
   */
  private async generateResponseFromIntent(intentResult: NLUResult): Promise<ResponseOption> {
    // Create a minimal session context for response generation
    const mockSession = {
      userId: '',
      state: SessionState.IDLE,
      context: {
        cart: [],
        currentProduct: null,
        currentOrder: null,
      },
    } as ISession;

    switch (intentResult.intent) {
      case 'greeting':
        return this.handleGreeting(mockSession);
      case 'goodbye':
        return this.handleGoodbye(mockSession);
      case 'view_products':
        return this.handleViewProducts();
      case 'search':
        return this.handleSearch({ entities: intentResult.entities });
      case 'support':
        return this.handleSupport();
      case 'order_status':
        return this.handleOrderStatus(mockSession);
      default:
        return this.handleUnknown({});
    }
  }

  /**
   * Check Twilio account status and balance
   */
  async checkTwilioStatus(): Promise<{
    accountSid: string;
    status: string;
    balance?: number;
  }> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    try {
      // Use the accounts endpoint directly
      const account = await (this.twilioClient as unknown as { accounts: { (sid: string): { fetch: () => Promise<{ sid: string; status?: string }> } } }).accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
      return {
        accountSid: account.sid,
        status: account.status || 'unknown',
      };
    } catch (error) {
      logger.error('Failed to check Twilio status', { error });
      throw error;
    }
  }

  /**
   * Get message delivery status from Twilio
   */
  async getMessageStatus(messageSid: string): Promise<{
    sid: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not configured');
    }

    return this.withTwilioRetry(async () => {
      const message = await this.twilioClient!.messages(messageSid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        errorCode: (message.errorCode as unknown as { code?: string })?.code?.toString(),
        errorMessage: message.errorMessage || undefined,
      };
    }, `getMessageStatus ${messageSid}`);
  }

  /**
   * Initialize intent detection patterns
   */
  private initializePatterns(): void {
    // Product browsing intents
    this.intentPatterns.set('view_products', [
      /show\s+(?:me\s+)?(?:products|items)/i,
      /what(?:'s|\s+do\s+you\s+have|.*available)/i,
      /browse/i,
      /catalog/i,
    ]);

    // Search intents
    this.intentPatterns.set('search', [
      /find\s+(?:me\s+)?(.+)/i,
      /search\s+(?:for\s+)?(.+)/i,
      /looking\s+(?:for|at)\s+(.+)/i,
      /want\s+(.+)/i,
    ]);

    // Cart intents
    this.intentPatterns.set('add_to_cart', [
      /add\s+(?:to\s+)?cart/i,
      /buy\s+this/i,
      /get\s+(?:this|it)/i,
      /want\s+to\s+(?:buy|order)/i,
    ]);

    this.intentPatterns.set('view_cart', [
      /view\s+(?:my\s+)?cart/i,
      /show\s+(?:my\s+)?cart/i,
      /cart/i,
      /items\s+in\s+(?:my\s+)?bag/i,
    ]);

    this.intentPatterns.set('update_cart', [
      /update\s+(?:the\s+)?cart/i,
      /change\s+(?:quantity|items)/i,
      /remove\s+(.+)/i,
    ]);

    // Checkout intents
    this.intentPatterns.set('checkout', [
      /checkout/i,
      /place\s+(?:my\s+)?order/i,
      /order\s+now/i,
      /buy\s+now/i,
      /proceed\s+(?:to\s+)?(checkout|payment)/i,
    ]);

    // Payment intents
    this.intentPatterns.set('payment', [
      /pay\s+(?:now|online)/i,
      /payment/i,
      /upi/i,
      /card\s+payment/i,
    ]);

    // Order status intents
    this.intentPatterns.set('order_status', [
      /where(?:'s|\s+is)\s+(?:my\s+)?order/i,
      /order\s+status/i,
      /track\s+(?:my\s+)?order/i,
      /delivery\s+(?:status|update)/i,
    ]);

    // Support intents
    this.intentPatterns.set('support', [
      /help/i,
      /support/i,
      /issue/i,
      /problem/i,
      /not\s+(?:working|happy)/i,
      /complaint/i,
      /refund/i,
    ]);

    // Greeting intents
    this.intentPatterns.set('greeting', [
      /^(?:hi|hello|hey|greetings)/i,
      /good\s+(?:morning|afternoon|evening)/i,
      /howdy/i,
    ]);

    // Goodbye intents
    this.intentPatterns.set('goodbye', [
      /bye/i,
      /goodbye/i,
      /see\s+you/i,
      /talk\s+(?:to\s+you\s+)?later/i,
      /that'?s\s+all/i,
    ]);

    // Confirmation intents
    this.intentPatterns.set('confirm', [
      /yes(?:,?\s+(?:please|go\s+ahead))?/i,
      /yeah/i,
      /sure/i,
      /okay/i,
      /confirm/i,
      /proceed/i,
    ]);

    // Cancellation intents
    this.intentPatterns.set('cancel', [
      /no(?:,?\s+(?:thanks|that'?s\s+all))?/i,
      /cancel/i,
      /never\s+mind/i,
      /stop/i,
      /don'?t\s+(?:want|need)/i,
    ]);

    // More info intents
    this.intentPatterns.set('more_info', [
      /more\s+(?:details|info|information)/i,
      /tell\s+me\s+(?:more|about)/i,
      /what(?:\s+else)?(?:\s+can\s+you\s+do)?/i,
    ]);

    // Price inquiry
    this.intentPatterns.set('price_inquiry', [
      /how\s+much/i,
      /price/i,
      /cost/i,
      /rate/i,
      /charges/i,
    ]);
  }

  /**
   * Detect intent from user message
   */
  async detectIntent(
    message: string,
    context?: {
      session?: ISession;
      conversation?: IConversation;
    }
  ): Promise<NLUResult> {
    const normalizedMessage = message.trim().toLowerCase();
    const intents: Array<{ intent: string; confidence: number }> = [];

    // Check each intent pattern
    for (const [intent, patterns] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          // Extract entities
          const entities = this.extractEntities(intent, normalizedMessage, patterns);

          intents.push({
            intent,
            confidence: pattern.test(normalizedMessage) ? 0.9 : 0.5,
          });
          break;
        }
      }
    }

    // If no intents matched, try context-based inference
    if (intents.length === 0 && context?.session) {
      const inferredIntent = this.inferFromContext(
        normalizedMessage,
        context.session
      );
      if (inferredIntent) {
        intents.push(inferredIntent);
      }
    }

    // Sort by confidence and return top match
    intents.sort((a, b) => b.confidence - a.confidence);
    const topIntent = intents[0] || {
      intent: 'unknown',
      confidence: 0,
    };

    return {
      intent: topIntent.intent,
      confidence: topIntent.confidence,
      entities: {},
      suggestedActions: this.getSuggestedActions(topIntent.intent),
    };
  }

  /**
   * Extract entities from message based on intent
   */
  private extractEntities(
    intent: string,
    message: string,
    patterns: RegExp[]
  ): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        switch (intent) {
          case 'search':
          case 'looking_for':
            entities.query = match[1]?.trim() || message;
            break;
          case 'price_inquiry':
            entities.subject = match.input?.replace(pattern, '').trim() || message;
            break;
        }
      }
    }

    return entities;
  }

  /**
   * Infer intent from session context
   */
  private inferFromContext(
    message: string,
    session: ISession
  ): { intent: string; confidence: number } | null {
    // If user is viewing a product and says "yes", likely wants to add to cart
    if (
      session.state === SessionState.VIEWING_PRODUCT &&
      /^(?:yes|yeah|yep|sure|okay)$/i.test(message.trim())
    ) {
      return { intent: 'add_to_cart', confidence: 0.7 };
    }

    // If in checkout and says "yes", confirm order
    if (
      session.state === SessionState.CHECKOUT &&
      /^(?:yes|yeah|yep)$/i.test(message.trim())
    ) {
      return { intent: 'checkout', confidence: 0.8 };
    }

    return null;
  }

  /**
   * Get suggested actions for an intent
   */
  private getSuggestedActions(intent: string): string[] {
    const actionMap: Record<string, string[]> = {
      greeting: ['view_products', 'search', 'view_cart'],
      view_products: ['search', 'view_cart'],
      search: ['view_products', 'add_to_cart'],
      add_to_cart: ['view_cart', 'checkout'],
      view_cart: ['checkout', 'continue_shopping'],
      checkout: ['confirm_payment'],
      support: ['faq', 'contact_support'],
      order_status: ['track_order', 'contact_support'],
    };

    return actionMap[intent] || [];
  }

  /**
   * Generate response based on intent and context
   */
  async generateResponse(
    intent: string,
    context: {
      session: ISession;
      conversation?: IConversation;
      entities?: Record<string, unknown>;
    }
  ): Promise<ResponseOption> {
    // Generate response based on intent
    switch (intent) {
      case 'greeting':
        return this.handleGreeting(context.session);
      case 'goodbye':
        return this.handleGoodbye(context.session);
      case 'view_products':
        return this.handleViewProducts();
      case 'search':
        return this.handleSearch(context);
      case 'add_to_cart':
        return this.handleAddToCart(context);
      case 'view_cart':
        return this.handleViewCart(context.session);
      case 'update_cart':
        return this.handleUpdateCart(context);
      case 'checkout':
        return this.handleCheckout(context.session);
      case 'confirm':
        return this.handleConfirmation(context.session);
      case 'cancel':
        return this.handleCancellation(context.session);
      case 'support':
        return this.handleSupport();
      case 'order_status':
        return this.handleOrderStatus(context.session);
      case 'price_inquiry':
        return this.handlePriceInquiry(context);
      case 'more_info':
        return this.handleMoreInfo(context.session);
      case 'unknown':
        return this.handleUnknown(context);
      default:
        return this.handleFallback();
    }
  }

  private handleGreeting(session: ISession): ResponseOption {
    const hour = new Date().getHours();
    let greeting = 'Hello';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    return {
      message: `${greeting}! Welcome to our store. How can I help you today?`,
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'View Products', payload: 'view_products' },
        { type: 'reply', title: 'Search', payload: 'search' },
        { type: 'reply', title: 'View Cart', payload: 'view_cart' },
      ],
      state: SessionState.BROWSING,
    };
  }

  private handleGoodbye(session: ISession): ResponseOption {
    return {
      message:
        'Thank you for chatting with us! Feel free to come back anytime. Have a great day!',
      type: MessageType.TEXT,
      state: SessionState.IDLE,
    };
  }

  private handleViewProducts(): ResponseOption {
    return {
      message:
        'Here are our featured products. Browse or use the search feature to find something specific.',
      type: MessageType.INTERACTIVE,
      actions: [
        { type: 'reply', title: 'Categories', payload: 'categories' },
        { type: 'reply', title: 'New Arrivals', payload: 'new_arrivals' },
        { type: 'reply', title: 'Popular', payload: 'popular' },
      ],
    };
  }

  private handleSearch(context: {
    entities?: Record<string, unknown>;
  }): ResponseOption {
    const query = context.entities?.query as string;
    return {
      message: query
        ? `Searching for "${query}"... What a great choice! Here are some results:`
        : "What are you looking for? Let me know and I'll help you find it.",
      type: MessageType.TEXT,
      actions: query
        ? [
            { type: 'reply', title: 'Add to Cart', payload: 'add_first' },
            { type: 'reply', title: 'Refine Search', payload: 'search' },
          ]
        : undefined,
    };
  }

  private handleAddToCart(context: { session: ISession }): ResponseOption {
    const hasProduct = context.session.context.currentProduct;
    const cartCount = context.session.context.cart.length;

    if (!hasProduct) {
      return {
        message:
          "I'd be happy to help you add something to your cart! First, let me show you some products.",
        type: MessageType.TEXT,
        actions: [
          { type: 'reply', title: 'View Products', payload: 'view_products' },
          { type: 'reply', title: 'Search', payload: 'search' },
        ],
      };
    }

    return {
      message: `Great choice! ${hasProduct.name} has been added to your cart. You now have ${cartCount + 1} item(s).`,
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'View Cart', payload: 'view_cart' },
        { type: 'reply', title: 'Continue Shopping', payload: 'continue' },
        { type: 'reply', title: 'Checkout', payload: 'checkout' },
      ],
      state: SessionState.CART_REVIEW,
    };
  }

  private handleViewCart(session: ISession): ResponseOption {
    const cart = session.context.cart;

    if (cart.length === 0) {
      return {
        message: "Your cart is empty. Let's find something for you!",
        type: MessageType.TEXT,
        actions: [
          { type: 'reply', title: 'View Products', payload: 'view_products' },
          { type: 'reply', title: 'Search', payload: 'search' },
        ],
        state: SessionState.BROWSING,
      };
    }

    const total = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const items = cart
      .map((item) => `${item.quantity}x ${item.name} - ₹${item.price * item.quantity}`)
      .join('\n');

    return {
      message: `Your Cart:\n\n${items}\n\nTotal: ₹${total.toFixed(2)}\n\nProceed to checkout or continue shopping?`,
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'Checkout', payload: 'checkout' },
        { type: 'reply', title: 'Add More', payload: 'continue' },
        { type: 'reply', title: 'Clear Cart', payload: 'clear_cart' },
      ],
      state: SessionState.CART_REVIEW,
    };
  }

  private handleUpdateCart(context: { entities?: Record<string, unknown> }): ResponseOption {
    return {
      message: "Let's update your cart. Which item would you like to change?",
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'Add Item', payload: 'add_to_cart' },
        { type: 'reply', title: 'Remove Item', payload: 'remove_item' },
        { type: 'reply', title: 'Change Quantity', payload: 'update_quantity' },
      ],
    };
  }

  private handleCheckout(session: ISession): ResponseOption {
    const cart = session.context.cart;

    if (cart.length === 0) {
      return {
        message: "Your cart is empty. Add some items first before checking out.",
        type: MessageType.TEXT,
        actions: [
          { type: 'reply', title: 'View Products', payload: 'view_products' },
        ],
        state: SessionState.BROWSING,
      };
    }

    const total = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    return {
      message: `Order Summary:\n\nItems: ${cart.length}\nTotal: ₹${total.toFixed(2)}\n\nDelivery Address:\n[Please provide your address]\n\nReady to place order?`,
      type: MessageType.INTERACTIVE,
      actions: [
        { type: 'reply', title: 'Confirm Order', payload: 'confirm_order' },
        { type: 'reply', title: 'Add Address', payload: 'add_address' },
        { type: 'reply', title: 'Cancel', payload: 'cancel' },
      ],
      state: SessionState.CHECKOUT,
    };
  }

  private handleConfirmation(session: ISession): ResponseOption {
    return {
      message: "I've noted your confirmation. Processing your order now...",
      type: MessageType.TEXT,
      state: SessionState.PAYMENT_PENDING,
    };
  }

  private handleCancellation(session: ISession): ResponseOption {
    return {
      message: "No problem! Is there anything else I can help you with?",
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'View Products', payload: 'view_products' },
        { type: 'reply', title: 'Search', payload: 'search' },
        { type: 'reply', title: 'Track Order', payload: 'order_status' },
      ],
      state: SessionState.IDLE,
    };
  }

  private handleSupport(): ResponseOption {
    return {
      message:
        "I'm here to help! What do you need assistance with?\n\n- Order issues\n- Refunds\n- Product questions\n- Account help",
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'Order Issue', payload: 'order_issue' },
        { type: 'reply', title: 'Refund Request', payload: 'refund' },
        { type: 'reply', title: 'Other Help', payload: 'general_help' },
      ],
      state: SessionState.SUPPORT,
    };
  }

  private handleOrderStatus(session: ISession): ResponseOption {
    const currentOrder = session.context.currentOrder;

    if (!currentOrder) {
      return {
        message: "I don't see unknown active orders on your account. Would you like to start a new order?",
        type: MessageType.TEXT,
        actions: [
          { type: 'reply', title: 'View Products', payload: 'view_products' },
          { type: 'reply', title: 'Order History', payload: 'order_history' },
        ],
      };
    }

    return {
      message: `Your order #${currentOrder.id} is currently: ${currentOrder.status}\n\nYou can track the delivery in real-time.`,
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'Track Live', payload: 'live_tracking' },
        { type: 'reply', title: 'Need Help', payload: 'support' },
      ],
      state: SessionState.TRACKING,
    };
  }

  private handlePriceInquiry(context: { entities?: Record<string, unknown> }): ResponseOption {
    const subject = context.entities?.subject as string;
    return {
      message: subject
        ? `For "${subject}", I can show you the best prices. Let me get some options for you.`
        : "Which product or service are you asking about?",
      type: MessageType.TEXT,
      actions: subject
        ? [{ type: 'reply', title: 'Show Prices', payload: 'show_prices' }]
        : undefined,
    };
  }

  private handleMoreInfo(session: ISession): ResponseOption {
    return {
      message:
        "Here's what I can help you with:\n\n" +
        "- Browse and search products\n" +
        "- Add items to cart and checkout\n" +
        "- Track your orders\n" +
        "- Get support for unknown issues\n" +
        "- View promotional offers\n\n" +
        "What would you like to do?",
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'Shop Now', payload: 'view_products' },
        { type: 'reply', title: 'My Orders', payload: 'order_status' },
        { type: 'reply', title: 'Support', payload: 'support' },
      ],
    };
  }

  private handleUnknown(context: { session?: ISession }): ResponseOption {
    return {
      message:
        "I'm not quite sure I understood that. Here are some things I can help with:",
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'View Products', payload: 'view_products' },
        { type: 'reply', title: 'Search', payload: 'search' },
        { type: 'reply', title: 'View Cart', payload: 'view_cart' },
        { type: 'reply', title: 'Track Order', payload: 'order_status' },
        { type: 'reply', title: 'Get Help', payload: 'support' },
      ],
    };
  }

  private handleFallback(): ResponseOption {
    return {
      message: "I'm here to help! What would you like to do today?",
      type: MessageType.TEXT,
      actions: [
        { type: 'reply', title: 'Shop Now', payload: 'view_products' },
        { type: 'reply', title: 'Get Help', payload: 'support' },
      ],
    };
  }

  /**
   * Process a complete conversation turn
   */
  async processTurn(
    message: string,
    sessionId: string
  ): Promise<{
    response: ResponseOption;
    session: ISession;
    conversation: IConversation;
  }> {
    // Get session
    const session = await Session.findOne({ sessionId });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Detect intent
    const intentResult = await this.detectIntent(message, { session });

    // Generate response
    const response = await this.generateResponse(intentResult.intent, {
      session,
      entities: intentResult.entities,
    });

    // Update session state
    if (response.state) {
      session.state = response.state;
      await session.save();
    }

    // Add to conversation history
    session.addMessage('user', message, uuidv4());
    session.addMessage('assistant', response.message, uuidv4());
    await session.save();

    // Update or create conversation record
    let conversation = await Conversation.findOne({
      sessionId,
      endedAt: { $exists: false },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        conversationId: uuidv4(),
        sessionId,
        userId: session.userId,
        merchantId: session.merchantId,
        turns: [],
        currentState: session.state,
        startedAt: new Date(),
      });
    }

    conversation.addTurn(
      message,
      response.message,
      intentResult as IntentDetection,
      response.actions?.[0]?.payload
    );
    conversation.currentState = session.state;
    conversation.lastIntent = intentResult.intent;
    await conversation.save();

    logger.info('Conversation turn processed', {
      sessionId,
      intent: intentResult.intent,
      state: session.state,
    });

    return { response, session, conversation };
  }
}

interface ConversationContext {
  cart: unknown[];
  currentProduct?: unknown;
}

export default ConversationEngine;
