/**
 * REZ Intelligence Client
 *
 * Connects Agent OS to ALL intelligence services:
 * - Intent Graph
 * - Memory Engine
 * - Identity Graph
 * - Event Platform
 * - Taste Profile
 * - Reorder Engine
 * - Demand Forecast
 * - Autonomous Agents
 */

const axios = require('axios');

class IntelligenceClient {
  constructor(config = {}) {
    this.config = {
      // Intelligence services
      INTENT_GRAPH_URL: process.env.REZ_INTENT_GRAPH_URL || 'http://localhost:4050',
      MEMORY_ENGINE_URL: process.env.REZ_MEMORY_ENGINE_URL || 'http://localhost:4051',
      IDENTITY_GRAPH_URL: process.env.REZ_IDENTITY_GRAPH_URL || 'http://localhost:4050',
      EVENT_PLATFORM_URL: process.env.REZ_EVENT_PLATFORM_URL || 'http://localhost:4008',
      TASTE_PROFILE_URL: process.env.REZ_TASTE_PROFILE_URL || 'http://localhost:4041',
      REORDER_ENGINE_URL: process.env.REZ_REORDER_URL || 'http://localhost:4040',
      DEMAND_FORECAST_URL: process.env.REZ_DEMAND_URL || 'http://localhost:4042',

      // Autonomous agents
      AGENTS_URL: process.env.REZ_AGENTS_URL || 'http://localhost:4062',

      // Business services
      ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL || 'https://rez-order-service.onrender.com',
      BOOKING_SERVICE_URL: process.env.BOOKING_SERVICE_URL || 'https://rez-booking.onrender.com',
      WALLET_SERVICE_URL: process.env.WALLET_SERVICE_URL || 'https://rez-wallet.onrender.com',

      // Support
      SUPPORT_URL: process.env.SUPPORT_COPILOT_URL || 'http://localhost:4033',
      KNOWLEDGE_BASE_URL: process.env.KNOWLEDGE_BASE_URL || 'https://rez-knowledge.onrender.com'
    };

    this.intelligenceCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  // =========================================================================
  // IDENTITY GRAPH - User identity across apps
  // =========================================================================

  /**
   * Get unified user profile
   */
  async getUserProfile(userId, phone, email) {
    const cacheKey = `profile:${userId || phone || email}`;

    // Check cache
    if (this.intelligenceCache.has(cacheKey)) {
      const cached = this.intelligenceCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const response = await axios.post(`${this.config.IDENTITY_GRAPH_URL}/api/resolve`, {
        userId,
        phone,
        email
      }, { timeout: 3000 });

      const profile = response.data;

      // Cache result
      this.intelligenceCache.set(cacheKey, {
        data: profile,
        timestamp: Date.now()
      });

      return profile;
    } catch (error) {
      console.warn('[Intelligence] Identity lookup failed:', error.message);
      return null;
    }
  }

  // =========================================================================
  // MEMORY ENGINE - User context/history
  // =========================================================================

  /**
   * Store user memory/context
   */
  async storeMemory(userId, data) {
    try {
      await axios.post(`${this.config.MEMORY_ENGINE_URL}/api/memory`, {
        userId,
        ...data
      }, { timeout: 3000 });
      return true;
    } catch (error) {
      console.warn('[Intelligence] Memory store failed:', error.message);
      return false;
    }
  }

  /**
   * Get user memories
   */
  async getMemories(userId, type = 'all') {
    try {
      const response = await axios.get(
        `${this.config.MEMORY_ENGINE_URL}/api/memory/${userId}?type=${type}`,
        { timeout: 3000 }
      );
      return response.data.memories || [];
    } catch (error) {
      console.warn('[Intelligence] Memory retrieval failed:', error.message);
      return [];
    }
  }

  // =========================================================================
  // EVENT PLATFORM - Log events
  // =========================================================================

  /**
   * Log event to intelligence
   */
  async logEvent(event) {
    try {
      await axios.post(`${this.config.EVENT_PLATFORM_URL}/api/events`, {
        source: 'agent-os',
        type: event.type,
        userId: event.userId,
        data: event.data,
        timestamp: new Date().toISOString()
      }, { timeout: 2000 });
      return true;
    } catch (error) {
      console.warn('[Intelligence] Event log failed:', error.message);
      return false;
    }
  }

  // =========================================================================
  // TASTE PROFILE - User preferences
  // =========================================================================

  /**
   * Get user taste profile
   */
  async getTasteProfile(userId) {
    try {
      const response = await axios.get(
        `${this.config.TASTE_PROFILE_URL}/api/profile/${userId}`,
        { timeout: 3000 }
      );
      return response.data.profile;
    } catch (error) {
      console.warn('[Intelligence] Taste profile lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Update taste profile
   */
  async updateTasteProfile(userId, preferences) {
    try {
      await axios.post(`${this.config.TASTE_PROFILE_URL}/api/profile/${userId}`, {
        preferences
      }, { timeout: 3000 });
      return true;
    } catch (error) {
      console.warn('[Intelligence] Taste update failed:', error.message);
      return false;
    }
  }

  // =========================================================================
  // REORDER ENGINE - Purchase predictions
  // =========================================================================

  /**
   * Get reorder predictions for user
   */
  async getReorderPredictions(userId, merchantId) {
    try {
      const response = await axios.post(`${this.config.REORDER_ENGINE_URL}/api/predict`, {
        userId,
        merchantId
      }, { timeout: 3000 });
      return response.data.predictions || [];
    } catch (error) {
      console.warn('[Intelligence] Reorder prediction failed:', error.message);
      return [];
    }
  }

  /**
   * Record reorder outcome
   */
  async recordReorderOutcome(userId, merchantId, reordered) {
    try {
      await axios.post(`${this.config.REORDER_ENGINE_URL}/api/feedback`, {
        userId,
        merchantId,
        reordered
      }, { timeout: 2000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  // =========================================================================
  // AUTONOMOUS AGENTS - Get agent insights
  // =========================================================================

  /**
   * Get insights from autonomous agents
   */
  async getAgentInsight(userId, agentType) {
    try {
      const response = await axios.get(
        `${this.config.AGENTS_URL}/api/agents/${agentType}/insights/${userId}`,
        { timeout: 5000 }
      );
      return response.data.insights;
    } catch (error) {
      console.warn('[Intelligence] Agent insight failed:', error.message);
      return null;
    }
  }

  // =========================================================================
  // SUPPORT COPILOT - Route to support
  // =========================================================================

  /**
   * Get support response
   */
  async getSupportResponse(userId, message, context = {}) {
    try {
      const response = await axios.post(`${this.config.SUPPORT_URL}/api/message`, {
        userId,
        message,
        context
      }, { timeout: 10000 });

      return response.data;
    } catch (error) {
      console.error('[Intelligence] Support request failed:', error.message);
      return {
        response: "I'm having trouble connecting to support. Let me try again.",
        escalation: false
      };
    }
  }

  // =========================================================================
  // KNOWLEDGE BASE - Get answers
  // =========================================================================

  /**
   * Search knowledge base
   */
  async searchKnowledge(query) {
    try {
      const response = await axios.post(`${this.config.KNOWLEDGE_BASE_URL}/api/search`, {
        query
      }, { timeout: 5000 });
      return response.data.results || [];
    } catch (error) {
      return [];
    }
  }

  // =========================================================================
  // UNIFIED CONTEXT - Get all user data at once
  // =========================================================================

  /**
   * Get complete user context for Agent OS
   */
  async getUserContext(userId, phone, email) {
    const context = {
      timestamp: new Date().toISOString()
    };

    // Run all lookups in parallel
    const [profile, memories, taste, predictions] = await Promise.allSettled([
      this.getUserProfile(userId, phone, email),
      this.getMemories(userId),
      userId ? this.getTasteProfile(userId) : Promise.resolve(null),
      userId ? Promise.all([
        this.getReorderPredictions(userId)
      ]) : Promise.resolve([])
    ]);

    // Extract successful results
    if (profile.status === 'fulfilled' && profile.value) {
      context.profile = profile.value;
    }

    if (memories.status === 'fulfilled') {
      context.memories = memories.value;
    }

    if (taste.status === 'fulfilled' && taste.value) {
      context.taste = taste.value;
    }

    if (predictions.status === 'fulfilled' && predictions.value[0]) {
      context.predictions = predictions.value[0];
    }

    return context;
  }
}

// Singleton instance
const intelligenceClient = new IntelligenceClient();

module.exports = intelligenceClient;
