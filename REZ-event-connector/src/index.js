'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');

// Shared utilities
const logger = require('../shared/logger');
const { errorHandler, asyncHandler, ValidationError, InternalError } = require('../shared/errorHandler');

// Environment validation
const REQUIRED_ENV = [
  'MONGODB_URI',
  'REDIS_URL',
  'PORT',
  'IDENTITY_GRAPH_URL',
  'MEMORY_ENGINE_URL',
  'EVENT_PLATFORM_URL',
  'INTERNAL_SERVICE_TOKEN'
];

for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Configuration
const CONFIG = {
  PORT: parseInt(process.env.PORT) || 4052,
  IDENTITY_GRAPH_URL: process.env.IDENTITY_GRAPH_URL,
  MEMORY_ENGINE_URL: process.env.MEMORY_ENGINE_URL,
  EVENT_PLATFORM_URL: process.env.EVENT_PLATFORM_URL,
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
  MONGODB_URI: process.env.MONGODB_URI,
  REDIS_URL: process.env.REDIS_URL,
  CIRCUIT_BREAKER_THRESHOLD: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
  CIRCUIT_BREAKER_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000, // 1 minute
  EVENT_BATCH_SIZE: parseInt(process.env.EVENT_BATCH_SIZE) || 100,
  EVENT_POLL_INTERVAL: parseInt(process.env.EVENT_POLL_INTERVAL) || 5000, // 5 seconds
};

// Event types handled by this connector
const EVENT_TYPES = {
  USER_SIGNUP: 'user.signup',
  ORDER_COMPLETED: 'order.completed',
  PAYMENT_COMPLETED: 'payment.completed',
  SEARCH: 'search',
  PAGE_VIEW: 'page.view',
  PROFILE_UPDATE: 'profile.update',
  SESSION_START: 'session.start',
  SESSION_END: 'session.end'
};

// App sources in the ecosystem
const APP_SOURCES = {
  REZ: 'rez',
  WASIL: 'wasil',
  HABIXO: 'habixo',
  KARMA: 'karma',
  MERCHANT_OS: 'merchant_os'
};

// Memory types for memory engine
const MEMORY_TYPES = {
  SHORT_TERM: 'short_term',
  LONG_TERM: 'long_term',
  EPISODIC: 'episodic',
  SEMANTIC: 'semantic',
  IDENTITY: 'identity',
  SESSION: 'session'
};

// Zod schemas for event validation
const BaseEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  version: z.string().default('1.0.0'),
  timestamp: z.string().datetime(),
  correlationId: z.string().optional(),
  source: z.string(),
  metadata: z.record(z.unknown()).optional(),
  payload: z.record(z.unknown())
});

const UserSignupEventSchema = BaseEventSchema.extend({
  type: z.literal(EVENT_TYPES.USER_SIGNUP),
  payload: z.object({
    userId: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    source: z.string(),
    referrer: z.string().optional(),
    utmParams: z.record(z.string()).optional()
  })
});

const OrderCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal(EVENT_TYPES.ORDER_COMPLETED),
  payload: z.object({
    orderId: z.string(),
    userId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      name: z.string(),
      category: z.string().optional(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      subtotal: z.number().positive()
    })),
    subtotal: z.number().positive(),
    tax: z.number().min(0),
    shipping: z.number().min(0),
    total: z.number().positive(),
    currency: z.string().length(3).default('INR'),
    merchantId: z.string().optional(),
    paymentMethod: z.string().optional()
  })
});

const PaymentCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal(EVENT_TYPES.PAYMENT_COMPLETED),
  payload: z.object({
    paymentId: z.string(),
    orderId: z.string(),
    userId: z.string(),
    amount: z.number().positive(),
    currency: z.string().length(3).default('INR'),
    method: z.string(),
    status: z.enum(['pending', 'completed', 'failed', 'refunded'])
  })
});

const SearchEventSchema = BaseEventSchema.extend({
  type: z.literal(EVENT_TYPES.SEARCH),
  payload: z.object({
    userId: z.string(),
    query: z.string(),
    filters: z.record(z.unknown()).optional(),
    resultsCount: z.number().int().min(0).optional(),
    sessionId: z.string().optional(),
    source: z.string()
  })
});

const PageViewEventSchema = BaseEventSchema.extend({
  type: z.literal(EVENT_TYPES.PAGE_VIEW),
  payload: z.object({
    userId: z.string().optional(),
    sessionId: z.string(),
    page: z.string(),
    referrer: z.string().optional(),
    duration: z.number().positive().optional(),
    deviceType: z.enum(['mobile', 'desktop', 'tablet']).optional()
  })
});

const ProfileUpdateEventSchema = BaseEventSchema.extend({
  type: z.literal(EVENT_TYPES.PROFILE_UPDATE),
  payload: z.object({
    userId: z.string(),
    changes: z.record(z.unknown()),
    source: z.string()
  })
});

const SessionStartEventSchema = BaseEventSchema.extend({
  type: z.literal(EVENT_TYPES.SESSION_START),
  payload: z.object({
    userId: z.string(),
    sessionId: z.string(),
    deviceType: z.enum(['mobile', 'desktop', 'tablet']).optional(),
    platform: z.string().optional(),
    ip: z.string().optional(),
    userAgent: z.string().optional()
  })
});

const SessionEndEventSchema = BaseEventSchema.extend({
  type: z.literal(EVENT_TYPES.SESSION_END),
  payload: z.object({
    userId: z.string(),
    sessionId: z.string(),
    duration: z.number().positive(),
    pagesVisited: z.number().int().min(0).optional(),
    lastPage: z.string().optional()
  })
});

// ============================================
// Circuit Breaker Implementation
// ============================================
class CircuitBreaker {
  constructor(name, threshold = 5, timeout = 60000) {
    this.name = name;
    this.threshold = threshold;
    this.timeout = timeout;
    this.failures = 0;
    this.lastFailure = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure >= this.timeout) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit breaker HALF_OPEN for ${this.name}`);
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info(`Circuit breaker CLOSED for ${this.name}`);
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker OPEN for ${this.name} after ${this.failures} failures`);
    }
  }

  getState() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

// Circuit breakers for external services
const circuitBreakers = {
  identityGraph: new CircuitBreaker('identity-graph', CONFIG.CIRCUIT_BREAKER_THRESHOLD, CONFIG.CIRCUIT_BREAKER_TIMEOUT),
  memoryEngine: new CircuitBreaker('memory-engine', CONFIG.CIRCUIT_BREAKER_THRESHOLD, CONFIG.CIRCUIT_BREAKER_TIMEOUT),
  eventPlatform: new CircuitBreaker('event-platform', CONFIG.CIRCUIT_BREAKER_THRESHOLD, CONFIG.CIRCUIT_BREAKER_TIMEOUT)
};

// ============================================
// Redis Client
// ============================================
let redis;

async function initRedis() {
  try {
    redis = new Redis(CONFIG.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100
    });

    redis.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    await redis.ping();
  } catch (err) {
    logger.warn('Redis connection failed, using in-memory fallback', { error: err.message });
    redis = null;
  }
}

// ============================================
// Event Deduplication
// ============================================
async function isEventProcessed(eventId) {
  if (!redis) return false;

  const key = `processed_event:${eventId}`;
  const exists = await redis.exists(key);

  if (!exists) {
    // Mark as processed with 24-hour TTL
    await redis.setex(key, 86400, '1');
    return false;
  }

  return true;
}

// ============================================
// External Service Clients
// ============================================
async function callIdentityGraph(endpoint, method = 'POST', data = null) {
  return circuitBreakers.identityGraph.execute(async () => {
    const response = await axios({
      method,
      url: `${CONFIG.IDENTITY_GRAPH_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': CONFIG.INTERNAL_SERVICE_TOKEN,
        'X-Request-Id': uuidv4()
      },
      timeout: 10000
    });
    return response.data;
  });
}

async function callMemoryEngine(endpoint, method = 'POST', data = null) {
  return circuitBreakers.memoryEngine.execute(async () => {
    const response = await axios({
      method,
      url: `${CONFIG.MEMORY_ENGINE_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': CONFIG.INTERNAL_SERVICE_TOKEN,
        'X-Request-Id': uuidv4()
      },
      timeout: 10000
    });
    return response.data;
  });
}

async function fetchEventsFromPlatform() {
  return circuitBreakers.eventPlatform.execute(async () => {
    const response = await axios({
      method: 'GET',
      url: `${CONFIG.EVENT_PLATFORM_URL}/api/events/poll`,
      headers: {
        'X-Internal-Token': CONFIG.INTERNAL_SERVICE_TOKEN,
        'X-Request-Id': uuidv4()
      },
      timeout: 30000
    });
    return response.data.events || [];
  });
}

// ============================================
// Event Handlers
// ============================================
class EventHandlers {
  // USER_SIGNUP: Create identity and initialize memory
  async handleUserSignup(event) {
    const { payload, source } = event;
    const { userId, email, phone, name, referrer, utmParams } = payload;

    logger.info('Processing user signup', { userId, source });

    // Create identity in identity graph
    try {
      const identityData = {
        source: source || APP_SOURCES.REZ,
        type: 'user_id',
        value: userId,
        profile: {
          name: name || null,
          email: email || null,
          phone: phone ? normalizePhone(phone) : null
        },
        confidence: 1.0
      };

      // Link email if provided
      if (email) {
        identityData.identities = [
          { type: 'email', value: email.toLowerCase().trim(), verified: true }
        ];
      }

      await callIdentityGraph('/api/identity/resolve', 'POST', identityData);
      logger.info('Identity created for new user', { userId });
    } catch (error) {
      logger.error('Failed to create identity', { userId, error: error.message });
      throw error;
    }

    // Initialize user memory with signup context
    try {
      await callMemoryEngine('/api/memory', 'POST', {
        userId,
        type: MEMORY_TYPES.IDENTITY,
        content: {
          event: 'signup',
          source,
          referrer,
          utmParams,
          signupTimestamp: event.timestamp
        },
        metadata: {
          source: 'system',
          action: 'signup',
          category: 'onboarding'
        },
        importance: 0.9,
        keywords: ['signup', 'new_user', source].filter(Boolean),
        entities: [
          { type: 'user', id: userId, name: name || userId }
        ],
        persistent: true
      });
      logger.info('Initial memory created for new user', { userId });
    } catch (error) {
      logger.error('Failed to create initial memory', { userId, error: error.message });
      // Non-fatal, continue processing
    }

    return { success: true, userId };
  }

  // ORDER_COMPLETED: Update identity graph and taste profile
  async handleOrderCompleted(event) {
    const { payload, source } = event;
    const { orderId, userId, items, total, merchantId, paymentMethod } = payload;

    logger.info('Processing order completed', { orderId, userId, total });

    // Update identity stats in identity graph
    try {
      await callIdentityGraph(`/api/identity/${userId}/stats`, 'POST', {
        transactionAmount: total,
        activity: 'order_completed'
      });
      logger.info('Identity stats updated', { userId, orderId });
    } catch (error) {
      logger.error('Failed to update identity stats', { userId, error: error.message });
    }

    // Extract product categories for taste profile
    const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
    const productIds = items.map(item => item.productId);

    // Store order in memory for personalization
    try {
      await callMemoryEngine('/api/memory', 'POST', {
        userId,
        type: MEMORY_TYPES.EPISODIC,
        content: {
          orderId,
          items: items.map(item => ({
            productId: item.productId,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          })),
          total,
          currency: payload.currency || 'INR',
          merchantId,
          paymentMethod,
          timestamp: event.timestamp
        },
        metadata: {
          source: 'system',
          action: 'order',
          category: 'purchase_history'
        },
        importance: 0.8,
        keywords: [...categories, 'order', 'purchase'],
        entities: [
          ...productIds.map(id => ({ type: 'product', id, name: items.find(i => i.productId === id)?.name })),
          ...(merchantId ? [{ type: 'merchant', id: merchantId }] : [])
        ],
        persistent: true,
        ttl: 7776000 // 90 days
      });
      logger.info('Order stored in memory', { userId, orderId });
    } catch (error) {
      logger.error('Failed to store order in memory', { userId, error: error.message });
    }

    // Update taste profile (extract preferences from order)
    try {
      await callMemoryEngine('/api/memory/extract', 'POST', {
        userId,
        entities: categories.map(category => ({
          type: 'category',
          id: category.toLowerCase().replace(/\s+/g, '_'),
          name: category,
          count: items.filter(i => i.category === category).length,
          source: 'order'
        })),
        sessionId: orderId
      });
      logger.info('Taste profile updated from order', { userId, categories });
    } catch (error) {
      logger.error('Failed to update taste profile', { userId, error: error.message });
    }

    // Store session summary
    try {
      await callMemoryEngine('/api/memory', 'POST', {
        userId,
        type: MEMORY_TYPES.SHORT_TERM,
        content: {
          event: 'order_completed',
          orderId,
          total,
          itemCount: items.length,
          timestamp: event.timestamp
        },
        metadata: {
          source: 'system',
          action: 'conversion',
          category: 'purchase'
        },
        importance: 0.9,
        keywords: ['order', 'conversion', 'purchase'],
        ttl: 86400 // 24 hours
      });
    } catch (error) {
      logger.error('Failed to store session summary', { userId, error: error.message });
    }

    return { success: true, userId, orderId };
  }

  // PAYMENT_COMPLETED: Update identity with payment info
  async handlePaymentCompleted(event) {
    const { payload, source } = event;
    const { paymentId, orderId, userId, amount, method, status } = payload;

    logger.info('Processing payment completed', { paymentId, orderId, userId, amount });

    // Update identity stats
    if (status === 'completed') {
      try {
        await callIdentityGraph(`/api/identity/${userId}/stats`, 'POST', {
          transactionAmount: amount,
          activity: 'payment_completed'
        });
      } catch (error) {
        logger.error('Failed to update identity stats', { userId, error: error.message });
      }
    }

    // Store payment memory
    try {
      await callMemoryEngine('/api/memory', 'POST', {
        userId,
        type: MEMORY_TYPES.EPISODIC,
        content: {
          paymentId,
          orderId,
          amount,
          currency: payload.currency || 'INR',
          method,
          status,
          timestamp: event.timestamp
        },
        metadata: {
          source: 'system',
          action: 'payment',
          category: 'transaction'
        },
        importance: status === 'completed' ? 0.8 : 0.5,
        keywords: ['payment', method, status],
        entityType: 'payment',
        entityId: paymentId,
        persistent: status === 'completed'
      });
    } catch (error) {
      logger.error('Failed to store payment memory', { userId, error: error.message });
    }

    return { success: true, userId, paymentId };
  }

  // SEARCH: Store search query for personalization
  async handleSearch(event) {
    const { payload, source } = event;
    const { userId, query, filters, resultsCount, sessionId } = payload;

    logger.debug('Processing search event', { userId, query });

    // Extract search terms for personalization
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);

    // Store search in memory
    try {
      await callMemoryEngine('/api/memory', 'POST', {
        userId,
        type: MEMORY_TYPES.SEMANTIC,
        content: {
          query,
          filters: filters || {},
          resultsCount: resultsCount || 0,
          sessionId,
          source,
          timestamp: event.timestamp
        },
        metadata: {
          source: 'user',
          action: 'search',
          category: 'intent'
        },
        importance: 0.6,
        keywords: searchTerms,
        entityType: 'search',
        entityId: sessionId || uuidv4(),
        ttl: 2592000 // 30 days
      });
      logger.debug('Search stored in memory', { userId, query });
    } catch (error) {
      logger.error('Failed to store search', { userId, error: error.message });
    }

    // Track recent searches for quick access
    if (redis) {
      try {
        const recentSearchesKey = `recent_searches:${userId}`;
        await redis.lpush(recentSearchesKey, JSON.stringify({
          query,
          timestamp: event.timestamp,
          resultsCount
        }));
        await redis.ltrim(recentSearchesKey, 0, 19); // Keep last 20 searches
        await redis.expire(recentSearchesKey, 86400 * 30); // 30 days
      } catch (error) {
        logger.warn('Failed to update recent searches', { userId, error: error.message });
      }
    }

    return { success: true, userId, query };
  }

  // PAGE_VIEW: Track user engagement
  async handlePageView(event) {
    const { payload } = event;
    const { userId, sessionId, page, referrer, duration, deviceType } = payload;

    // Store page view for session tracking
    if (userId) {
      try {
        await callMemoryEngine('/api/memory', 'POST', {
          userId,
          type: MEMORY_TYPES.SESSION,
          content: {
            sessionId,
            page,
            referrer,
            duration,
            deviceType,
            timestamp: event.timestamp
          },
          metadata: {
            source: 'user',
            action: 'page_view',
            category: 'engagement'
          },
          importance: 0.3,
          keywords: [page],
          entityType: 'page',
          entityId: `${sessionId}:${page}`,
          ttl: 86400 // 24 hours
        });
      } catch (error) {
        logger.error('Failed to store page view', { userId, error: error.message });
      }
    }

    // Track session pages in Redis
    if (redis && sessionId) {
      try {
        const sessionPagesKey = `session_pages:${sessionId}`;
        await redis.lpush(sessionPagesKey, JSON.stringify({
          page,
          timestamp: event.timestamp,
          duration
        }));
        await redis.expire(sessionPagesKey, 86400); // 24 hours
      } catch (error) {
        logger.warn('Failed to track session pages', { sessionId, error: error.message });
      }
    }

    return { success: true, userId, page };
  }

  // PROFILE_UPDATE: Sync profile changes
  async handleProfileUpdate(event) {
    const { payload, source } = event;
    const { userId, changes } = payload;

    logger.info('Processing profile update', { userId, changes });

    // Update identity profile
    try {
      const profileUpdates = {};

      if (changes.name) profileUpdates.name = changes.name;
      if (changes.email) profileUpdates.email = changes.email.toLowerCase().trim();
      if (changes.phone) profileUpdates.phone = normalizePhone(changes.phone);

      if (Object.keys(profileUpdates).length > 0) {
        await callIdentityGraph(`/api/identity/${userId}/profile`, 'PATCH', profileUpdates);
        logger.info('Identity profile updated', { userId });
      }
    } catch (error) {
      logger.error('Failed to update identity profile', { userId, error: error.message });
    }

    // Store profile update in memory
    try {
      await callMemoryEngine('/api/memory', 'POST', {
        userId,
        type: MEMORY_TYPES.IDENTITY,
        content: {
          changes,
          source,
          timestamp: event.timestamp
        },
        metadata: {
          source: 'user',
          action: 'profile_update',
          category: 'profile'
        },
        importance: 0.7,
        keywords: ['profile', 'update', ...Object.keys(changes)],
        persistent: true
      });
    } catch (error) {
      logger.error('Failed to store profile update in memory', { userId, error: error.message });
    }

    return { success: true, userId };
  }

  // SESSION_START: Create/update user session in memory
  async handleSessionStart(event) {
    const { payload } = event;
    const { userId, sessionId, deviceType, platform, ip, userAgent } = payload;

    logger.debug('Processing session start', { userId, sessionId });

    // Create session in memory
    try {
      await callMemoryEngine('/api/memory', 'POST', {
        userId,
        type: MEMORY_TYPES.SESSION,
        content: {
          sessionId,
          deviceType,
          platform,
          ip,
          userAgent,
          startedAt: event.timestamp,
          status: 'active'
        },
        metadata: {
          source: 'system',
          action: 'session_start',
          category: 'engagement'
        },
        importance: 0.5,
        keywords: ['session', 'active', platform],
        entityType: 'session',
        entityId: sessionId,
        ttl: 1800 // 30 minutes
      });
      logger.debug('Session created in memory', { userId, sessionId });
    } catch (error) {
      logger.error('Failed to create session in memory', { userId, error: error.message });
    }

    // Track active session in Redis
    if (redis) {
      try {
        const sessionKey = `active_session:${userId}`;
        await redis.setex(sessionKey, 1800, JSON.stringify({
          sessionId,
          deviceType,
          platform,
          startedAt: event.timestamp
        }));
      } catch (error) {
        logger.warn('Failed to track active session', { userId, error: error.message });
      }
    }

    return { success: true, userId, sessionId };
  }

  // SESSION_END: Complete session tracking
  async handleSessionEnd(event) {
    const { payload } = event;
    const { userId, sessionId, duration, pagesVisited, lastPage } = payload;

    logger.debug('Processing session end', { userId, sessionId, duration });

    // Update session memory with end data
    try {
      await callMemoryEngine('/api/memory', 'POST', {
        userId,
        type: MEMORY_TYPES.SESSION,
        content: {
          sessionId,
          duration,
          pagesVisited,
          lastPage,
          endedAt: event.timestamp,
          status: 'completed'
        },
        metadata: {
          source: 'system',
          action: 'session_end',
          category: 'engagement'
        },
        importance: 0.4,
        keywords: ['session', 'ended', 'completed'],
        entityType: 'session',
        entityId: sessionId,
        ttl: 86400 // 24 hours
      });
    } catch (error) {
      logger.error('Failed to update session end in memory', { userId, error: error.message });
    }

    // Clean up active session from Redis
    if (redis) {
      try {
        await redis.del(`active_session:${userId}`);
        await redis.del(`session_pages:${sessionId}`);
      } catch (error) {
        logger.warn('Failed to clean up session data', { userId, error: error.message });
      }
    }

    return { success: true, userId, sessionId };
  }
}

const handlers = new EventHandlers();

// Event handler mapping
const EVENT_HANDLERS = {
  [EVENT_TYPES.USER_SIGNUP]: handlers.handleUserSignup.bind(handlers),
  [EVENT_TYPES.ORDER_COMPLETED]: handlers.handleOrderCompleted.bind(handlers),
  [EVENT_TYPES.PAYMENT_COMPLETED]: handlers.handlePaymentCompleted.bind(handlers),
  [EVENT_TYPES.SEARCH]: handlers.handleSearch.bind(handlers),
  [EVENT_TYPES.PAGE_VIEW]: handlers.handlePageView.bind(handlers),
  [EVENT_TYPES.PROFILE_UPDATE]: handlers.handleProfileUpdate.bind(handlers),
  [EVENT_TYPES.SESSION_START]: handlers.handleSessionStart.bind(handlers),
  [EVENT_TYPES.SESSION_END]: handlers.handleSessionEnd.bind(handlers)
};

// ============================================
// Event Processing
// ============================================
async function processEvent(event) {
  const { id, type, payload } = event;

  // Deduplication check
  const isDuplicate = await isEventProcessed(id);
  if (isDuplicate) {
    logger.debug('Duplicate event skipped', { eventId: id, type });
    return { success: false, reason: 'duplicate' };
  }

  // Find appropriate handler
  const handler = EVENT_HANDLERS[type];
  if (!handler) {
    logger.debug('No handler for event type', { type });
    return { success: false, reason: 'no_handler' };
  }

  // Process event
  try {
    const result = await handler({ ...event, payload });
    logger.info('Event processed successfully', { eventId: id, type, result });
    return { success: true, type, result };
  } catch (error) {
    logger.error('Event processing failed', { eventId: id, type, error: error.message });
    return { success: false, type, error: error.message };
  }
}

// ============================================
// Event Polling Loop
// ============================================
let isPolling = false;
let pollInterval = null;

async function pollEvents() {
  if (isPolling) return;
  isPolling = true;

  try {
    const events = await fetchEventsFromPlatform();

    if (events.length === 0) {
      return;
    }

    logger.info(`Polling received ${events.length} events`);

    // Process events in batches
    for (let i = 0; i < events.length; i += CONFIG.EVENT_BATCH_SIZE) {
      const batch = events.slice(i, i + CONFIG.EVENT_BATCH_SIZE);
      await Promise.allSettled(batch.map(processEvent));
    }
  } catch (error) {
    logger.error('Event polling failed', { error: error.message });
  } finally {
    isPolling = false;
  }
}

function startPolling() {
  logger.info(`Starting event polling with ${CONFIG.EVENT_POLL_INTERVAL}ms interval`);
  pollInterval = setInterval(pollEvents, CONFIG.EVENT_POLL_INTERVAL);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    logger.info('Event polling stopped');
  }
}

// ============================================
// Utility Functions
// ============================================
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

// ============================================
// Express App
// ============================================
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
});

// Internal service authentication
function internalAuth(req, res, next) {
  const publicPaths = ['/health', '/ready', '/metrics'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== CONFIG.INTERNAL_SERVICE_TOKEN) {
    logger.warn('Unauthorized access attempt', {
      requestId: req.requestId,
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
      requestId: req.requestId
    });
  }
  next();
}

app.use(internalAuth);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rez-event-connector',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Readiness check
app.get('/ready', async (req, res) => {
  const checks = {
    mongodb: false,
    redis: false,
    identityGraph: false,
    memoryEngine: false
  };

  try {
    // MongoDB
    await mongoose.connection.db.admin().ping();
    checks.mongodb = true;
  } catch (err) {
    logger.error('MongoDB health check failed', { error: err.message });
  }

  try {
    // Redis
    if (redis) {
      await redis.ping();
      checks.redis = true;
    }
  } catch (err) {
    logger.error('Redis health check failed', { error: err.message });
  }

  try {
    // Identity Graph
    await axios.get(`${CONFIG.IDENTITY_GRAPH_URL}/health`, { timeout: 3000 });
    checks.identityGraph = true;
  } catch (err) {
    logger.error('Identity Graph health check failed', { error: err.message });
  }

  try {
    // Memory Engine
    await axios.get(`${CONFIG.MEMORY_ENGINE_URL}/health`, { timeout: 3000 });
    checks.memoryEngine = true;
  } catch (err) {
    logger.error('Memory Engine health check failed', { error: err.message });
  }

  const allReady = Object.values(checks).every(v => v);

  res.status(allReady ? 200 : 503).json({
    status: allReady ? 'ready' : 'degraded',
    checks,
    requestId: req.requestId
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const breakerStates = Object.fromEntries(
    Object.entries(circuitBreakers).map(([k, v]) => [k, v.getState()])
  );

  res.json({
    circuitBreakers: breakerStates,
    polling: {
      active: isPolling,
      interval: CONFIG.EVENT_POLL_INTERVAL
    },
    redis: {
      connected: !!redis
    }
  });
});

// Manual event ingestion endpoint (for testing or direct integration)
app.post('/api/events', asyncHandler(async (req, res) => {
  const { event } = req.body;

  if (!event || !event.type || !event.payload) {
    throw new ValidationError('event with type and payload required');
  }

  // Generate event ID if not provided
  if (!event.id) {
    event.id = uuidv4();
  }

  // Add metadata if not present
  if (!event.timestamp) {
    event.timestamp = new Date().toISOString();
  }

  const result = await processEvent(event);

  res.json({
    success: result.success,
    eventId: event.id,
    type: event.type,
    result: result.result || { error: result.error },
    requestId: req.requestId
  });
}));

// Batch event ingestion
app.post('/api/events/batch', asyncHandler(async (req, res) => {
  const { events } = req.body;

  if (!Array.isArray(events)) {
    throw new ValidationError('events array required');
  }

  if (events.length > CONFIG.EVENT_BATCH_SIZE) {
    throw new ValidationError(`Batch size exceeds maximum of ${CONFIG.EVENT_BATCH_SIZE}`);
  }

  // Process events
  const results = await Promise.allSettled(
    events.map(async (event) => {
      if (!event.id) event.id = uuidv4();
      if (!event.timestamp) event.timestamp = new Date().toISOString();
      return processEvent(event);
    })
  );

  const summary = {
    total: events.length,
    successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
    failed: results.filter(r => r.status === 'rejected' || !r.value.success).length
  };

  logger.info('Batch event processing completed', summary);

  res.json({
    success: true,
    summary,
    results: results.map((r, i) => ({
      eventId: events[i].id,
      ...(r.status === 'fulfilled' ? r.value : { success: false, error: 'processing_error' })
    })),
    requestId: req.requestId
  });
}));

// Get event schema documentation
app.get('/api/schemas', (req, res) => {
  res.json({
    success: true,
    supportedEvents: Object.values(EVENT_TYPES),
    schemas: {
      USER_SIGNUP: {
        type: EVENT_TYPES.USER_SIGNUP,
        description: 'User signup event - creates identity and initializes memory',
        payloadFields: ['userId', 'email', 'phone', 'name', 'source']
      },
      ORDER_COMPLETED: {
        type: EVENT_TYPES.ORDER_COMPLETED,
        description: 'Order completed - updates identity stats and taste profile',
        payloadFields: ['orderId', 'userId', 'items', 'total', 'merchantId']
      },
      PAYMENT_COMPLETED: {
        type: EVENT_TYPES.PAYMENT_COMPLETED,
        description: 'Payment completed - stores payment in memory',
        payloadFields: ['paymentId', 'orderId', 'userId', 'amount', 'status']
      },
      SEARCH: {
        type: EVENT_TYPES.SEARCH,
        description: 'User search event - stores for personalization',
        payloadFields: ['userId', 'query', 'filters', 'sessionId']
      },
      PAGE_VIEW: {
        type: EVENT_TYPES.PAGE_VIEW,
        description: 'Page view tracking',
        payloadFields: ['userId', 'sessionId', 'page', 'duration']
      },
      PROFILE_UPDATE: {
        type: EVENT_TYPES.PROFILE_UPDATE,
        description: 'Profile update - syncs to identity graph',
        payloadFields: ['userId', 'changes', 'source']
      },
      SESSION_START: {
        type: EVENT_TYPES.SESSION_START,
        description: 'Session start - creates session in memory',
        payloadFields: ['userId', 'sessionId', 'deviceType']
      },
      SESSION_END: {
        type: EVENT_TYPES.SESSION_END,
        description: 'Session end - completes session tracking',
        payloadFields: ['userId', 'sessionId', 'duration', 'pagesVisited']
      }
    }
  });
});

// Error handler
app.use(errorHandler);

// ============================================
// Graceful Shutdown
// ============================================
async function shutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  stopPolling();

  // Close Redis connection
  if (redis) {
    await redis.quit();
    logger.info('Redis connection closed');
  }

  // Close MongoDB connection
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================
// Startup
// ============================================
async function start() {
  try {
    // Connect to MongoDB
    await mongoose.connect(CONFIG.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Initialize Redis
    await initRedis();

    // Start HTTP server
    app.listen(CONFIG.PORT, () => {
      logger.info(`REZ Event Connector started on port ${CONFIG.PORT}`);
      logger.info(`Connected to Identity Graph: ${CONFIG.IDENTITY_GRAPH_URL}`);
      logger.info(`Connected to Memory Engine: ${CONFIG.MEMORY_ENGINE_URL}`);
      logger.info(`Polling Interval: ${CONFIG.EVENT_POLL_INTERVAL}ms`);
    });

    // Start event polling
    startPolling();
  } catch (err) {
    logger.error('Startup failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

start();
