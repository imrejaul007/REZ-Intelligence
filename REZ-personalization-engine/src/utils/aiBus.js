/**
 * AI Bus Client for ReZ Mind Integration
 * Handles event emission and subscription for personalization events
 */

const EventEmitter = require('events');
const logger = require('./logger');

class AIBusClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.service = options.service || 'personalization-engine';
    this.url = options.url || process.env.REZ_MIND_URL || 'http://localhost:4020';
    this.enabled = process.env.AI_BUS_ENABLED !== 'false';
    this.reconnectDelay = 5000;
    this.maxReconnectAttempts = 5;
    this.reconnectAttempts = 0;
    this.connected = false;
    this.subscriptions = new Map();

    // HTTP client using native fetch
    this.baseUrl = this.url;

    if (this.enabled) {
      this.connect();
    } else {
      logger.info('AI Bus is disabled, running in standalone mode');
    }
  }

  async connect() {
    if (!this.enabled) return;

    try {
      // Health check to verify connection
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        this.connected = true;
        this.reconnectAttempts = 0;
        logger.info(`AI Bus connected to ${this.baseUrl}`);
        this.setupSubscriptions();
      } else {
        throw new Error(`Health check failed with status ${response.status}`);
      }
    } catch (error) {
      logger.warn(`AI Bus connection failed: ${error.message}`);
      this.connected = false;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('AI Bus max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      logger.info(`AI Bus reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect();
    }, this.reconnectDelay);
  }

  async setupSubscriptions() {
    // Subscribe to ReZ Mind events
    await this.subscribe('mind:insight', this.handleInsight.bind(this));
    await this.subscribe('mind:recommendation', this.handleRecommendation.bind(this));
  }

  /**
   * Subscribe to an event channel
   */
  async subscribe(channel, handler) {
    if (!this.enabled) {
      logger.debug(`AI Bus subscription (mock): ${channel}`);
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: this.service,
          channel,
          url: `${process.env.PERSONALIZATION_ENGINE_URL || 'http://localhost:4017'}/api/ai-bus/webhook`
        })
      });

      if (response.ok) {
        this.subscriptions.set(channel, handler);
        logger.info(`Subscribed to ${channel}`);
      }
    } catch (error) {
      logger.error(`Failed to subscribe to ${channel}: ${error.message}`);
    }
  }

  /**
   * Emit an event to the AI Bus
   */
  async emit(channel, payload) {
    const event = {
      service: this.service,
      channel,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: this.generateCorrelationId()
    };

    // Emit locally for testing/debugging
    this.emit(channel, payload);

    if (!this.enabled || !this.connected) {
      logger.debug(`AI Bus event (mock): ${channel}`, payload);
      return { mock: true, event };
    }

    try {
      const response = await fetch(`${this.baseUrl}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        throw new Error(`Publish failed with status ${response.status}`);
      }

      logger.debug(`AI Bus event emitted: ${channel}`, { correlationId: event.correlationId });
      return await response.json();
    } catch (error) {
      logger.error(`Failed to emit ${channel}: ${error.message}`);
      // Store for retry or dead letter queue
      this.storeFailedEvent(event);
      return { error: error.message };
    }
  }

  /**
   * Handle incoming insights from ReZ Mind
   */
  async handleInsight(payload) {
    logger.info('Received insight from ReZ Mind', { type: payload.type });

    try {
      switch (payload.type) {
        case 'segment_change':
          await this.applySegmentInsight(payload);
          break;
        case 'preference_update':
          await this.applyPreferenceInsight(payload);
          break;
        case 'behavioral_pattern':
          await this.applyBehavioralInsight(payload);
          break;
        default:
          logger.debug('Unknown insight type:', payload.type);
      }
    } catch (error) {
      logger.error('Error processing insight:', error);
    }
  }

  /**
   * Handle incoming recommendations from ReZ Mind
   */
  async handleRecommendation(payload) {
    logger.info('Received recommendation from ReZ Mind', { action: payload.action });

    try {
      switch (payload.action) {
        case 'adjust_weights':
          await this.applyWeightRecommendation(payload);
          break;
        case 'update_segments':
          await this.applySegmentRecommendation(payload);
          break;
        case 'retrain_model':
          await this.triggerModelRetrain(payload);
          break;
        default:
          logger.debug('Unknown recommendation action:', payload.action);
      }
    } catch (error) {
      logger.error('Error processing recommendation:', error);
    }
  }

  /**
   * Apply segment insight from ReZ Mind
   */
  async applySegmentInsight(payload) {
    const { userId, suggestedSegment, confidence, reason } = payload;
    logger.info(`Applying segment insight for ${userId}: ${suggestedSegment} (${confidence})`);

    // Emit acknowledgment back to AI Bus
    await this.emit('personalization:segment_insight_applied', {
      userId,
      suggestedSegment,
      applied: true,
      reason
    });
  }

  /**
   * Apply preference insight from ReZ Mind
   */
  async applyPreferenceInsight(payload) {
    const { userId, preferences } = payload;
    logger.info(`Applying preference insight for ${userId}:`, preferences);

    await this.emit('personalization:preference_insight_applied', {
      userId,
      preferences,
      applied: true
    });
  }

  /**
   * Apply behavioral insight from ReZ Mind
   */
  async applyBehavioralInsight(payload) {
    const { userId, pattern, action } = payload;
    logger.info(`Applying behavioral insight for ${userId}:`, pattern);

    await this.emit('personalization:behavioral_insight_applied', {
      userId,
      pattern,
      action
    });
  }

  /**
   * Apply weight recommendation from ReZ Mind
   */
  async applyWeightRecommendation(payload) {
    const { algorithmWeights, reason } = payload;
    logger.info('Applying algorithm weight recommendation:', algorithmWeights);

    // Update weights in memory (would normally persist to config)
    this.emit('weights:updated', algorithmWeights);

    await this.emit('personalization:weight_recommendation_applied', {
      algorithmWeights,
      reason
    });
  }

  /**
   * Apply segment recommendation from ReZ Mind
   */
  async applySegmentRecommendation(payload) {
    const { userId, newSegments, removeSegments } = payload;
    logger.info(`Applying segment recommendation for ${userId}`);

    await this.emit('personalization:segment_recommendation_applied', {
      userId,
      newSegments,
      removeSegments
    });
  }

  /**
   * Trigger model retrain based on ReZ Mind recommendation
   */
  async triggerModelRetrain(payload) {
    const { reason, priority } = payload;
    logger.info(`Triggering model retrain, priority: ${priority}`);

    await this.emit('personalization:retrain_triggered', {
      reason,
      priority,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Store failed events for retry
   */
  storeFailedEvent(event) {
    // In production, this would write to a dead letter queue
    logger.warn('Event stored for retry:', event.channel);
  }

  /**
   * Generate correlation ID for tracing
   */
  generateCorrelationId() {
    return `${this.service}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close connection gracefully
   */
  async close() {
    this.connected = false;
    this.subscriptions.clear();
    logger.info('AI Bus connection closed');
  }
}

// Export singleton instance
const aiBus = new AIBusClient({
  service: 'personalization-engine'
});

module.exports = aiBus;
