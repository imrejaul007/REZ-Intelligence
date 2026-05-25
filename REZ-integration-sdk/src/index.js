import logger from './utils/logger';

'use strict';

/**
 * REZ Integration SDK - Client-side library for all apps
 *
 * This is the UNIFIED entry point for all apps to integrate with REZ Intelligence.
 * Replace individual services (intentCapture, REZ Mind client, etc.) with this single SDK.
 *
 * Usage:
 *   const rez = new REZIntegration({
 *     appId: 'rez-app-merchant',
 *     apiKey: 'your-api-key',
 *     baseUrl: 'https://api.rez.money'
 *   });
 *
 *   // Track events
 *   await rez.events.track('order_completed', { orderId: '123', amount: 250 });
 *
 *   // Get recommendations
 *   const recs = await rez.recommendations.get('user_123');
 *
 *   // Send conversion feedback
 *   await rez.feedback.conversion('nudge_abc', { converted: true, orderId: '456' });
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  baseUrl: process.env.REZ_API_URL || 'https://api.rez.money',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
  batchSize: 10,
  batchInterval: 5000
};

// ============================================================================
// APP TYPES (for identity resolution)
// ============================================================================

const APP_TYPES = {
  CONSUMER: 'consumer',
  MERCHANT: 'merchant',
  ADMIN: 'admin',
  HOTEL: 'hotel',
  DO: 'do',
  RENDES: 'rendes',
  ADS: 'ads',
  CREATOR: 'creator'
};

// ============================================================================
// UNIFIED EVENT SCHEMA
// ============================================================================

const EVENT_TYPES = {
  // Discovery events
  QR_SCAN: 'qr_scan',
  PAGE_VIEW: 'page_view',
  SEARCH: 'search',

  // Engagement events
  ITEM_VIEW: 'item_view',
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',

  // Transaction events
  ORDER_STARTED: 'order_started',
  ORDER_COMPLETED: 'order_completed',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_REFUNDED: 'order_refunded',
  PAYMENT_COMPLETED: 'payment_completed',

  // User events
  SIGNUP: 'signup',
  LOGIN: 'login',
  PROFILE_UPDATE: 'profile_update',

  // Commerce events
  MENU_VIEW: 'menu_view',
  ITEM_ADDED: 'item_added',
  REVIEW_SUBMITTED: 'review_submitted',

  // Booking events
  BOOKING_STARTED: 'booking_started',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  CHECKIN: 'checkin',
  CHECKOUT: 'checkout',

  // Ad events
  AD_IMPRESSION: 'ad_impression',
  AD_CLICK: 'ad_click',
  AD_CONVERSION: 'ad_conversion',

  // Notification events
  NUDGE_SENT: 'nudge_sent',
  NUDGE_CLICKED: 'nudge_clicked',
  NUDGE_CONVERTED: 'nudge_converted',

  // Custom events
  CUSTOM: 'custom'
};

// ============================================================================
// MAIN SDK CLASS
// ============================================================================

class REZIntegration {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.appId = this.config.appId;
    this.apiKey = this.config.apiKey;
    this.userId = null;
    this.sessionId = null;
    this.deviceId = null;

    // Initialize sub-modules
    this.events = new EventTracker(this);
    this.identity = new IdentityManager(this);
    this.recommendations = new RecommendationEngine(this);
    this.feedback = new FeedbackCollector(this);
    this.middleware = new MiddlewareManager(this);

    // Batch queue for events
    this.eventQueue = [];
    this.batchTimer = null;

    // Start batch timer
    this._startBatchTimer();
  }

  // ----------------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------------

  /**
   * Initialize SDK with user context
   */
  async init(options = {}) {
    const { userId, sessionId, deviceId, phone, email, metadata } = options;

    // Set user context
    this.userId = userId || null;
    this.sessionId = sessionId || uuidv4();
    this.deviceId = deviceId || this._getDeviceId();

    // If user has phone/email, resolve identity
    if (phone || email) {
      await this.identity.resolve({ phone, email, userId });
    }

    // Track session start
    await this.events.track('session_start', {
      sessionId: this.sessionId,
      userId: this.userId,
      deviceId: this.deviceId,
      ...metadata
    });

    return this;
  }

  /**
   * Set current user
   */
  setUser(userId, metadata = {}) {
    const previousUserId = this.userId;
    this.userId = userId;

    // Track user switch if different
    if (previousUserId && previousUserId !== userId) {
      this.events.track('user_switch', {
        from: previousUserId,
        to: userId
      });
    }

    // Update identity
    this.identity.updateContext({ userId, ...metadata });

    return this;
  }

  // ----------------------------------------------------------------
  // Internal Methods
  // ----------------------------------------------------------------

  _getDeviceId() {
    // Try to get from localStorage or generate new
    if (typeof window !== 'undefined') {
      let deviceId = localStorage.getItem('rez_device_id');
      if (!deviceId) {
        deviceId = 'dev_' + uuidv4();
        localStorage.setItem('rez_device_id', deviceId);
      }
      return deviceId;
    }
    return 'srv_' + uuidv4();
  }

  _getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-REZ-App-Id': this.appId,
      'X-REZ-API-Key': this.apiKey,
      'X-REZ-Session-Id': this.sessionId,
      'X-REZ-Device-Id': this.deviceId,
      'X-REZ-Request-Id': uuidv4()
    };
  }

  async _request(method, path, data = null, options = {}) {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this._getHeaders();

    let attempts = 0;
    const maxAttempts = options.retries || this.config.retryAttempts;

    while (attempts < maxAttempts) {
      try {
        const response = await axios({
          method,
          url,
          data,
          headers,
          timeout: options.timeout || this.config.timeout
        });
        return response.data;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          // Queue for retry if write operation
          if (method !== 'GET' && this.eventQueue) {
            this.eventQueue.push({ method, path, data, attempts });
          }
          throw error;
        }
        await new Promise(r => setTimeout(r, this.config.retryDelay * attempts));
      }
    }
  }

  _startBatchTimer() {
    if (typeof setInterval !== 'undefined') {
      this.batchTimer = setInterval(() => {
        this._flushEventBatch();
      }, this.config.batchInterval);
    }
  }

  async _flushEventBatch() {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0, this.config.batchSize);

    try {
      await this._request('POST', '/api/events/batch', { events: batch });
    } catch (error) {
      // Re-queue failed events
      this.eventQueue.unshift(...batch);
      console.error('Failed to flush event batch:', error.message);
    }
  }

  /**
   * Cleanup on unload
   */
  destroy() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this._flushEventBatch();
  }
}

// ============================================================================
// EVENT TRACKER
// ============================================================================

class EventTracker {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Track a single event
   */
  async track(eventType, properties = {}) {
    const event = {
      eventId: uuidv4(),
      appId: this.sdk.appId,
      eventType,
      userId: this.sdk.userId,
      sessionId: this.sdk.sessionId,
      deviceId: this.sdk.deviceId,
      timestamp: new Date().toISOString(),
      properties,
      context: {
        url: typeof window !== 'undefined' ? window.location?.href : null,
        referrer: typeof document !== 'undefined' ? document.referrer : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
      }
    };

    // Add to batch queue
    this.sdk.eventQueue.push(event);

    // Flush if batch size reached
    if (this.sdk.eventQueue.length >= this.sdk.config.batchSize) {
      await this.sdk._flushEventBatch();
    }

    return event;
  }

  /**
   * Track multiple events at once
   */
  async trackBatch(events) {
    const batch = events.map(e => ({
      eventId: uuidv4(),
      appId: this.sdk.appId,
      eventType: e.eventType,
      userId: this.sdk.userId,
      sessionId: this.sdk.sessionId,
      deviceId: this.sdk.deviceId,
      timestamp: new Date().toISOString(),
      properties: e.properties || {},
      context: e.context || {}
    }));

    return this.sdk._request('POST', '/api/events/batch', { events: batch });
  }

  // Convenience methods for common events
  async orderCompleted(orderData) {
    return this.track(EVENT_TYPES.ORDER_COMPLETED, {
      orderId: orderData.orderId,
      merchantId: orderData.merchantId,
      amount: orderData.amount,
      items: orderData.items,
      paymentMethod: orderData.paymentMethod,
      ...orderData.metadata
    });
  }

  async qrScan(qrData) {
    return this.track(EVENT_TYPES.QR_SCAN, {
      merchantId: qrData.merchantId,
      source: qrData.source || 'direct',
      ...qrData.metadata
    });
  }

  async pageView(pageData) {
    return this.track(EVENT_TYPES.PAGE_VIEW, {
      page: pageData.page,
      category: pageData.category,
      merchantId: pageData.merchantId,
      ...pageData.metadata
    });
  }

  async search(searchData) {
    return this.track(EVENT_TYPES.SEARCH, {
      query: searchData.query,
      results: searchData.results,
      clicked: searchData.clicked,
      ...searchData.metadata
    });
  }

  async nudgeFeedback(nudgeData) {
    const eventType = nudgeData.converted
      ? EVENT_TYPES.NUDGE_CONVERTED
      : nudgeData.clicked
        ? EVENT_TYPES.NUDGE_CLICKED
        : EVENT_TYPES.NUDGE_SENT;

    return this.track(eventType, {
      nudgeId: nudgeData.nudgeId,
      merchantId: nudgeData.merchantId,
      itemId: nudgeData.itemId,
      ...nudgeData.metadata
    });
  }
}

// ============================================================================
// IDENTITY MANAGER
// ============================================================================

class IdentityManager {
  constructor(sdk) {
    this.sdk = sdk;
    this.resolved = false;
  }

  /**
   * Resolve identity for user
   */
  async resolve(identifiers) {
    try {
      const result = await this.sdk._request('POST', '/api/identity/resolve', {
        source: this.sdk.appId,
        identifiers
      });

      if (result.unifiedId) {
        this.sdk.userId = result.unifiedId;
        this.resolved = true;
      }

      return result;
    } catch (error) {
      console.error('Identity resolution failed:', error.message);
      return null;
    }
  }

  /**
   * Link multiple identifiers to same user
   */
  async link(identifiers) {
    return this.sdk._request('POST', `/api/identity/${this.sdk.userId}/link`, {
      source: this.sdk.appId,
      identifiers
    });
  }

  /**
   * Update user context
   */
  updateContext(metadata = {}) {
    this.sdk._request('PATCH', `/api/identity/${this.sdk.userId}/context`, {
      source: this.sdk.appId,
      metadata
    }).catch(() => {}); // Fire and forget
  }

  /**
   * Get unified user profile
   */
  async getProfile() {
    return this.sdk._request('GET', `/api/identity/${this.sdk.userId}`);
  }
}

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

class RecommendationEngine {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Get recommendations for user
   */
  async get(userId, options = {}) {
    const targetUserId = userId || this.sdk.userId;

    return this.sdk._request('GET', `/api/recommendations/${targetUserId}`, {
      context: {
        appId: this.sdk.appId,
        sessionId: this.sdk.sessionId,
        ...options.context
      },
      types: options.types || ['reorder', 'cross_sell', 'personalized'],
      limit: options.limit || 10,
      ...options
    });
  }

  /**
   * Get reorder suggestions
   */
  async getReorders(userId, options = {}) {
    return this.get(userId, {
      types: ['reorder'],
      ...options
    });
  }

  /**
   * Get cross-sell suggestions
   */
  async getCrossSell(userId, options = {}) {
    return this.get(userId, {
      types: ['cross_sell'],
      ...options
    });
  }

  /**
   * Get personalized offers
   */
  async getOffers(userId, options = {}) {
    return this.get(userId, {
      types: ['offer'],
      ...options
    });
  }

  /**
   * Get search results ranked by personalization
   */
  async getSearchResults(query, options = {}) {
    return this.sdk._request('POST', '/api/search/rank', {
      query,
      userId: this.sdk.userId,
      context: {
        appId: this.sdk.appId,
        ...options.context
      },
      limit: options.limit || 20
    });
  }
}

// ============================================================================
// FEEDBACK COLLECTOR
// ============================================================================

class FeedbackCollector {
  constructor(sdk) {
    this.sdk = sdk;
  }

  /**
   * Track conversion attribution
   */
  async conversion(nudgeId, data = {}) {
    return this.sdk._request('POST', '/api/feedback/conversion', {
      nudgeId,
      userId: this.sdk.userId,
      appId: this.sdk.appId,
      converted: data.converted !== false,
      orderId: data.orderId,
      amount: data.amount,
      metadata: data.metadata
    });
  }

  /**
   * Track recommendation feedback
   */
  async recommendationFeedback(recId, feedback = {}) {
    return this.sdk._request('POST', '/api/feedback/recommendation', {
      recommendationId: recId,
      userId: this.sdk.userId,
      appId: this.sdk.appId,
      action: feedback.action, // 'click', 'purchase', 'dismiss'
      itemId: feedback.itemId,
      metadata: feedback.metadata
    });
  }

  /**
   * Track model feedback
   */
  async modelFeedback(modelId, feedback = {}) {
    return this.sdk._request('POST', '/api/feedback/model', {
      modelId,
      userId: this.sdk.userId,
      appId: this.sdk.appId,
      prediction: feedback.prediction,
      actual: feedback.actual,
      correct: feedback.correct,
      metadata: feedback.metadata
    });
  }
}

// ============================================================================
// MIDDLEWARE MANAGER
// ============================================================================

class MiddlewareManager {
  constructor(sdk) {
    this.sdk = sdk;
    this.hooks = {
      beforeTrack: [],
      afterTrack: [],
      onError: []
    };
  }

  /**
   * Add middleware hook
   */
  use(hook, fn) {
    if (this.hooks[hook]) {
      this.hooks[hook].push(fn);
    }
    return this;
  }

  /**
   * Run hooks
   */
  async runHook(hook, data) {
    let result = data;
    for (const fn of this.hooks[hook]) {
      result = await fn(result) || result;
    }
    return result;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// For Node.js / Server-side usage
module.exports = {
  REZIntegration,
  EventTracker,
  IdentityManager,
  RecommendationEngine,
  FeedbackCollector,
  APP_TYPES,
  EVENT_TYPES,
  DEFAULT_CONFIG
};

// For browser / client-side usage (if bundled)
// if (typeof window !== 'undefined') {
//   window.REZIntegration = REZIntegration;
// }

logger.info('REZ Integration SDK loaded. Initialize with:');
logger.info('  const rez = new REZIntegration({ appId: "your-app", apiKey: "your-key" });');
logger.info('  await rez.init({ userId: "user123" });');
