/**
 * REZ MIND INTEGRATION (FIXED)
 *
 * Connects all messaging to ReZ Mind for:
 * - Intent detection
 * - AI response generation
 * - Learning from interactions
 * - Personalization
 *
 * FIXES APPLIED (Agent 16):
 * - Added x-internal-token to all internal service calls
 * - Added retry logic with exponential backoff
 * - Added circuit breaker pattern
 * - Added timeouts to all service calls
 * - Added correlation IDs for tracing
 * - Added event persistence queue
 * - Standardized error handling
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ============================================================================
// Configuration
// ============================================================================

const REZMIND_URL = process.env.REZMIND_URL || 'https://rez-event-platform.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'messaging-service-token';
const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000;

// Circuit breaker state
const circuitState = {
  'rez-mind': { failures: 0, state: 'CLOSED' as 'CLOSED' | 'OPEN' | 'HALF_OPEN', lastFailure: 0 },
};

// Event queue for persistence
const eventQueue: Map<string, { type: string; payload: unknown; timestamp: string }> = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

function generateCorrelationId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function calculateBackoff(retryCount: number): number {
  const base = 1000;
  const maxDelay = 30000;
  const delay = Math.min(base * Math.pow(2, retryCount), maxDelay);
  return Math.floor(delay + delay * Math.random() * 0.25);
}

function recordSuccess(): void {
  circuitState['rez-mind'].failures = 0;
  circuitState['rez-mind'].state = 'CLOSED';
}

function recordFailure(): void {
  circuitState['rez-mind'].failures++;
  circuitState['rez-mind'].lastFailure = Date.now();
  if (circuitState['rez-mind'].failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitState['rez-mind'].state = 'OPEN';
  }
}

function canExecute(): boolean {
  const state = circuitState['rez-mind'];
  if (state.state === 'CLOSED') return true;
  if (state.state === 'OPEN') {
    if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      state.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  return true;
}

function isRetryable(error: AxiosError): boolean {
  if (!error.response) {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'];
    return retryableCodes.includes(error.code || '');
  }
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return retryableStatuses.includes(error.response.status);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; onRetry?: (attempt: number, error: Error, delay: number) => void } = {}
): Promise<T> {
  let lastError: Error | undefined;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const axiosError = error as AxiosError;

      if (attempt < maxRetries && isRetryable(axiosError)) {
        const delay = calculateBackoff(attempt);
        if (options.onRetry) {
          options.onRetry(attempt + 1, lastError, delay);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}

function queueEvent(type: string, payload: unknown): string {
  const eventId = generateEventId();
  eventQueue.set(eventId, { type, payload, timestamp: new Date().toISOString() });
  console.log(`[EventQueue] Queued event ${eventId}: ${type}`);
  return eventId;
}

// ============================================================================
// HTTP Client (FIXED)
// ============================================================================

const httpClient: AxiosInstance = axios.create({
  baseURL: REZMIND_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Token': INTERNAL_TOKEN,
    'X-Source-Service': 'unified-messaging',
  },
});

// ============================================================================
// Types
// ============================================================================

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface AIResponse {
  reply: string;
  confidence: number;
  suggestedActions?: {
    type: string;
    payload: any;
  }[];
  personalization?: {
    userName?: string;
    merchantName?: string;
    offer?: string;
  };
}

export interface UserContext {
  userId: string;
  phone: string;
  name?: string;
  segments: string[];
  preferences?: Record<string, any>;
}

export interface MerchantContext {
  merchantId?: string;
  name?: string;
  category?: string;
  whatsappNumberId?: string;
}

// ============================================================================
// Health Check (for circuit breaker status)
// ============================================================================

export function getCircuitBreakerStatus(): { service: string; state: string; failures: number } {
  return {
    service: 'rez-mind',
    state: circuitState['rez-mind'].state,
    failures: circuitState['rez-mind'].failures,
  };
}

export function getQueuedEventsCount(): number {
  return eventQueue.size;
}

// ============================================================================
// INTENT DETECTION (FIXED)
// ============================================================================

export async function detectIntent(
  text: string,
  context?: { userId?: string; merchantId?: string; channel?: string }
): Promise<IntentResult> {
  const correlationId = generateCorrelationId();

  const makeRequest = async (): Promise<IntentResult> => {
    if (!canExecute()) {
      console.warn('[ReZ Mind] Circuit breaker open, using fallback');
      return localIntentDetection(text);
    }

    const response = await httpClient.post('/api/intent/detect', {
      correlationId,
      eventId: generateEventId(),
      timestamp: new Date().toISOString(),
      text,
      context: {
        userId: context?.userId,
        merchantId: context?.merchantId,
        channel: context?.channel || 'whatsapp',
      },
    }, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });

    recordSuccess();
    return response.data;
  };

  try {
    return await withRetry(makeRequest, {
      onRetry: (attempt, error, delay) => {
        console.warn(`[ReZ Mind] Intent detection retry ${attempt}`, { delay, error: error.message });
        recordFailure();
      },
    });
  } catch (error) {
    console.error('[ReZ Mind] Intent detection failed:', error);
    return localIntentDetection(text);
  }
}

// ============================================================================
// AI RESPONSE GENERATION (FIXED)
// ============================================================================

export async function generateAIResponse(
  userContext: { user?: UserContext; merchant?: MerchantContext; conversation?: any; signals?: any },
  intentResult: IntentResult,
  conversationHistory?: any[]
): Promise<AIResponse> {
  const correlationId = generateCorrelationId();

  const makeRequest = async (): Promise<AIResponse> => {
    if (!canExecute()) {
      console.warn('[ReZ Mind] Circuit breaker open, using template response');
      return generateTemplateResponse(intentResult);
    }

    const response = await httpClient.post('/api/ai/respond', {
      correlationId,
      eventId: generateEventId(),
      timestamp: new Date().toISOString(),
      context: {
        user: userContext.user,
        merchant: userContext.merchant,
        conversation: userContext.conversation,
        signals: userContext.signals,
      },
      intent: intentResult.intent,
      entities: intentResult.entities,
      history: conversationHistory,
      persona: userContext.merchant?.name || 'helpful_assistant',
    }, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });

    recordSuccess();
    return response.data;
  };

  try {
    return await withRetry(makeRequest, {
      onRetry: (attempt, error, delay) => {
        console.warn(`[ReZ Mind] AI response retry ${attempt}`, { delay, error: error.message });
        recordFailure();
      },
    });
  } catch (error) {
    console.error('[ReZ Mind] AI response failed:', error);
    return generateTemplateResponse(intentResult);
  }
}

// ============================================================================
// CAPTURE FOR LEARNING (FIXED)
// ============================================================================

export async function captureIntentSignal(signal: {
  userId?: string;
  merchantId?: string;
  channel: string;
  eventType: string;
  category: string;
  query?: string;
  response?: string;
  outcome?: 'converted' | 'ignored' | 'escalated';
  metadata?: Record<string, any>;
}): Promise<void> {
  const correlationId = generateCorrelationId();

  const makeRequest = async (): Promise<void> => {
    if (!canExecute()) {
      queueEvent('intent-signal', signal);
      return;
    }

    await httpClient.post('/api/intent/capture', {
      correlationId,
      eventId: generateEventId(),
      timestamp: new Date().toISOString(),
      ...signal,
      appType: 'messaging',
    }, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });

    recordSuccess();
    console.log(`[ReZ Mind] Captured: ${signal.eventType}`);
  };

  try {
    await withRetry(makeRequest, {
      onRetry: (attempt, error, delay) => {
        console.warn(`[ReZ Mind] Capture retry ${attempt}`, { delay, error: error.message });
        recordFailure();
      },
    });
  } catch (error) {
    console.error('[ReZ Mind] Capture failed:', error);
    // Queue for later
    queueEvent('intent-signal', signal);
  }
}

export async function captureConversation(
  conversationId: string,
  messages: any[],
  outcome: 'resolved' | 'escalated' | 'converted'
): Promise<void> {
  const correlationId = generateCorrelationId();

  const makeRequest = async (): Promise<void> => {
    if (!canExecute()) {
      queueEvent('conversation-capture', { conversationId, messages, outcome });
      return;
    }

    await httpClient.post('/api/intent/conversation', {
      correlationId,
      eventId: generateEventId(),
      timestamp: new Date().toISOString(),
      conversationId,
      messages,
      outcome,
      channel: 'whatsapp',
    }, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });

    recordSuccess();
  };

  try {
    await withRetry(makeRequest);
  } catch (error) {
    console.error('[ReZ Mind] Conversation capture failed:', error);
    queueEvent('conversation-capture', { conversationId, messages, outcome });
  }
}

// ============================================================================
// USER CONTEXT (FIXED)
// ============================================================================

export async function getUserContextForMessaging(userId: string): Promise<{
  preferences: Record<string, any>;
  recentIntents: string[];
  segments: string[];
  affinity: Record<string, number>;
}> {
  const correlationId = generateCorrelationId();

  const makeRequest = async (): Promise<{
    preferences: Record<string, any>;
    recentIntents: string[];
    segments: string[];
    affinity: Record<string, number>;
  }> => {
    if (!canExecute()) {
      return getDefaultUserContext();
    }

    const response = await httpClient.get(`/api/user/${userId}/messaging-context`, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });

    recordSuccess();
    return response.data;
  };

  try {
    return await withRetry(makeRequest);
  } catch (error) {
    console.error('[ReZ Mind] User context failed:', error);
    return getDefaultUserContext();
  }
}

// ============================================================================
// PERSONALIZATION (FIXED)
// ============================================================================

export async function getPersonalizedOffer(
  userId: string,
  merchantId: string,
  context: string
): Promise<{
  offerText?: string;
  discount?: number;
  coins?: number;
  productRecommendation?: string;
} | null> {
  const correlationId = generateCorrelationId();

  const makeRequest = async (): Promise<{
    offerText?: string;
    discount?: number;
    coins?: number;
    productRecommendation?: string;
  } | null> => {
    if (!canExecute()) {
      return null;
    }

    const response = await httpClient.post('/api/personalization/offer', {
      correlationId,
      eventId: generateEventId(),
      timestamp: new Date().toISOString(),
      userId,
      merchantId,
      context,
    }, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });

    recordSuccess();
    return response.data;
  };

  try {
    return await withRetry(makeRequest);
  } catch (error) {
    console.error('[ReZ Mind] Personalization failed:', error);
    return null;
  }
}

// ============================================================================
// LEAD SCORING (FIXED)
// ============================================================================

export async function getLeadScore(
  userId: string
): Promise<{
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  signals: Record<string, number>;
  recommendedAction: string;
}> {
  const correlationId = generateCorrelationId();

  const makeRequest = async (): Promise<{
    score: number;
    temperature: 'hot' | 'warm' | 'cold';
    signals: Record<string, number>;
    recommendedAction: string;
  }> => {
    if (!canExecute()) {
      return { score: 50, temperature: 'warm', signals: {}, recommendedAction: 'nurture' };
    }

    const response = await httpClient.get(`/api/user/${userId}/lead-score`, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });

    recordSuccess();
    return response.data;
  };

  try {
    return await withRetry(makeRequest);
  } catch (error) {
    console.error('[ReZ Mind] Lead score failed:', error);
    return { score: 50, temperature: 'warm', signals: {}, recommendedAction: 'nurture' };
  }
}

// ============================================================================
// AREA CONTEXT (for DOOH) (FIXED)
// ============================================================================

export async function getAreaContext(
  areaId: string
): Promise<{
  areaId: string;
  demographics: Record<string, any>;
  topIntents: string[];
  activeUsers: number;
} | null> {
  const correlationId = generateCorrelationId();

  const makeRequest = async (): Promise<{
    areaId: string;
    demographics: Record<string, any>;
    topIntents: string[];
    activeUsers: number;
  } | null> => {
    if (!canExecute()) {
      return null;
    }

    const response = await httpClient.get(`/api/area/${areaId}/context`, {
      headers: {
        'X-Correlation-ID': correlationId,
      },
    });

    recordSuccess();
    return response.data;
  };

  try {
    return await withRetry(makeRequest);
  } catch (error) {
    console.error('[ReZ Mind] Area context failed:', error);
    return null;
  }
}

// ============================================================================
// Flush Event Queue
// ============================================================================

export async function flushEventQueue(): Promise<{ flushed: number; remaining: number }> {
  let flushed = 0;

  for (const [eventId, event] of eventQueue.entries()) {
    try {
      if (event.type === 'intent-signal') {
        await httpClient.post('/api/intent/capture', {
          ...event.payload,
          timestamp: event.timestamp,
        });
        eventQueue.delete(eventId);
        flushed++;
      } else if (event.type === 'conversation-capture') {
        const { conversationId, messages, outcome } = event.payload as any;
        await httpClient.post('/api/intent/conversation', {
          conversationId,
          messages,
          outcome,
          channel: 'whatsapp',
          timestamp: event.timestamp,
        });
        eventQueue.delete(eventId);
        flushed++;
      }
    } catch (error) {
      console.warn(`[EventQueue] Failed to flush event ${eventId}:`, error);
    }
  }

  return { flushed, remaining: eventQueue.size };
}

// ============================================================================
// FALLBACK FUNCTIONS
// ============================================================================

function localIntentDetection(text: string): IntentResult {
  const lower = text.toLowerCase();

  const patterns: [string, RegExp, number][] = [
    ['order_status', /order|track|delivery|Where's my|order id/i, 0.85],
    ['menu_inquiry', /menu|card|food|item|what do you have|show me/i, 0.80],
    ['hours_inquiry', /open|hour|time|close|closing|available/i, 0.90],
    ['location_inquiry', /address|where|location|directions|find you/i, 0.85],
    ['reservation', /book|table|reserve|reservation|appointment/i, 0.85],
    ['complaint', /bad|worst|terrible|angry|issue|problem|not happy/i, 0.80],
    ['feedback', /good|great|amazing|love|best|review|excellent/i, 0.75],
    ['offer_inquiry', /offer|deal|discount|off|special|promo/i, 0.80],
    ['support_request', /help|support|assistant|speak|human|agent/i, 0.85],
    ['payment_issue', /pay|payment|card|upi|failed|transaction/i, 0.90],
    ['greeting', /hi|hello|hey|good morning|good evening/i, 0.95],
    ['goodbye', /bye|thanks|thank you|see you/i, 0.90],
  ];

  for (const [intent, regex, confidence] of patterns) {
    if (regex.test(lower)) {
      return { intent, confidence, entities: {} };
    }
  }

  return { intent: 'general_inquiry', confidence: 0.60, entities: {} };
}

function generateTemplateResponse(intent: IntentResult): AIResponse {
  const templates: Record<string, AIResponse> = {
    order_status: {
      reply: "I can help you with your order! Please share your order ID or the phone number used for ordering.",
      confidence: 0.90,
    },
    menu_inquiry: {
      reply: "Here's our menu! Would you like to see our popular items or the full menu?",
      confidence: 0.85,
    },
    hours_inquiry: {
      reply: "We're open from 11 AM to 11 PM today! Is there anything else I can help you with?",
      confidence: 0.95,
    },
    location_inquiry: {
      reply: "We're located in the heart of the city! Here's our address: [Address]. Would you like directions?",
      confidence: 0.85,
    },
    reservation: {
      reply: "I'd be happy to help you book a table! How many people and what time would you like?",
      confidence: 0.90,
    },
    complaint: {
      reply: "I'm sorry to hear that. Let me help you right away. Could you share more details?",
      confidence: 0.85,
    },
    feedback: {
      reply: "Thank you so much for your kind words! We're glad you enjoyed your experience!",
      confidence: 0.90,
    },
    offer_inquiry: {
      reply: "Great timing! We have some exciting offers right now. Would you like to hear about them?",
      confidence: 0.85,
    },
    support_request: {
      reply: "Of course! I'm here to help. What can I assist you with today?",
      confidence: 0.80,
    },
    payment_issue: {
      reply: "I'm sorry you're having trouble with payment. Let me connect you with our team right away.",
      confidence: 0.90,
    },
    greeting: {
      reply: "Hi there! Welcome! How can I help you today?",
      confidence: 0.95,
    },
    goodbye: {
      reply: "Thank you for chatting with us! Have a great day!",
      confidence: 0.90,
    },
  };

  return templates[intent.intent] || {
    reply: "Thanks for reaching out! How can I help you today?",
    confidence: 0.70,
  };
}

function getDefaultUserContext() {
  return {
    preferences: {},
    recentIntents: [],
    segments: [],
    affinity: {},
  };
}
