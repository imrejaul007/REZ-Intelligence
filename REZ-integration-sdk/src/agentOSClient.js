import logger from './utils/logger';

/**
 * REZ Agent OS - Universal App Connector
 *
 * Connects ALL apps to Agent OS:
 * - do-app (DO Service)
 * - Hotel OTA
 * - AdBazaar
 * - Rendez
 * - Merchant App
 *
 * Usage:
 * import { AgentOSClient } from './agentOSClient';
 *
 * const agentOS = new AgentOSClient({
 *   appId: 'do-app',
 *   apiKey: 'your-api-key',
 *   baseUrl: 'http://localhost:4100'
 * });
 *
 * // Send message
 * await agentOS.chat('Book a table for 2');
 *
 * // Track event
 * await agentOS.track('order_completed', { orderId: '123' });
 *
 * // Get recommendations
 * await agentOS.recommend({ userId: 'user123' });
 */

class AgentOSClient {
  constructor(config = {}) {
    this.config = {
      appId: config.appId || 'unknown',
      apiKey: config.apiKey || process.env.AGENT_OS_API_KEY,
      baseUrl: config.baseUrl || process.env.AGENT_OS_URL || 'http://localhost:4100',
      userId: config.userId,
      namespace: config.namespace || config.appId || 'default',
      timeout: config.timeout || 30000,
      retries: config.retries || 3
    };

    this.messageQueue = [];
    this.isConnected = false;
    this.ws = null;
  }

  // =========================================================================
  // CONNECTION
  // =========================================================================

  /**
   * Connect via WebSocket for real-time chat
   */
  connect(userId) {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.baseUrl.replace('http', 'ws')}/ws?userId=${userId}&namespace=${this.config.namespace}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.config.userId = userId;
        logger.info(`[AgentOS] Connected as ${userId}`);
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.ws.onerror = (error) => {
        console.error('[AgentOS] WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        logger.info('[AgentOS] Disconnected');
      };
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  // =========================================================================
  // CHAT
  // =========================================================================

  /**
   * Send chat message to Agent OS
   */
  async chat(message, context = {}) {
    try {
      const response = await this.request('/api/message', {
        userId: this.config.userId,
        message,
        namespace: this.config.namespace,
        context: {
          ...context,
          appId: this.config.appId,
          source: this.config.appId
        }
      });

      return response;
    } catch (error) {
      console.error('[AgentOS] Chat error:', error);
      throw error;
    }
  }

  /**
   * Send chat via WebSocket (real-time)
   */
  sendMessage(message) {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected. Call connect() first.');
    }

    this.ws.send(JSON.stringify({ message }));
  }

  // =========================================================================
  // EVENT TRACKING
  // =========================================================================

  /**
   * Track event to Agent OS
   */
  async track(eventType, properties = {}) {
    try {
      await this.request('/api/track', {
        userId: this.config.userId,
        eventType,
        properties: {
          ...properties,
          appId: this.config.appId,
          namespace: this.config.namespace,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[AgentOS] Track error:', error);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(page, properties = {}) {
    await this.track('page_view', { page, ...properties });
  }

  /**
   * Track user action
   */
  async trackAction(action, properties = {}) {
    await this.track('user_action', { action, ...properties });
  }

  // =========================================================================
  // RECOMMENDATIONS
  // =========================================================================

  /**
   * Get personalized recommendations
   */
  async recommend(options = {}) {
    try {
      return await this.request('/api/recommend', {
        userId: this.config.userId,
        namespace: this.config.namespace,
        ...options
      });
    } catch (error) {
      console.error('[AgentOS] Recommend error:', error);
      return { recommendations: [] };
    }
  }

  // =========================================================================
  // USER CONTEXT
  // =========================================================================

  /**
   * Update user context
   */
  async updateContext(context) {
    try {
      await this.request('/api/context', {
        userId: this.config.userId,
        namespace: this.config.namespace,
        context
      });
    } catch (error) {
      console.error('[AgentOS] Update context error:', error);
    }
  }

  /**
   * Get user context from all intelligence
   */
  async getUserContext() {
    try {
      return await this.request(`/api/context/${this.config.userId}`);
    } catch (error) {
      console.error('[AgentOS] Get context error:', error);
      return null;
    }
  }

  // =========================================================================
  // CREDIT & FINANCIAL
  // =========================================================================

  /**
   * Get user credit score
   */
  async getCreditScore() {
    try {
      return await this.request('/api/credit/score', {
        userId: this.config.userId
      });
    } catch (error) {
      console.error('[AgentOS] Credit score error:', error);
      return null;
    }
  }

  /**
   * Calculate BNPL
   */
  async calculateBNPL(merchantId, amount) {
    try {
      return await this.request('/api/credit/bnpl', {
        userId: this.config.userId,
        merchantId,
        amount
      });
    } catch (error) {
      console.error('[AgentOS] BNPL error:', error);
      return null;
    }
  }

  // =========================================================================
  // MERCHANT
  // =========================================================================

  /**
   * Get merchant analytics
   */
  async getMerchantAnalytics(merchantId) {
    try {
      return await this.request(`/api/pos/analytics/${merchantId}`);
    } catch (error) {
      console.error('[AgentOS] Merchant analytics error:', error);
      return null;
    }
  }

  /**
   * Get merchant inventory
   */
  async getMerchantInventory(merchantId) {
    try {
      return await this.request(`/api/pos/inventory/${merchantId}`);
    } catch (error) {
      console.error('[AgentOS] Inventory error:', error);
      return null;
    }
  }

  // =========================================================================
  // INTERNAL
  // =========================================================================

  async request(endpoint, body) {
    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError;

    for (let i = 0; i < this.config.retries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-App-Id': this.config.appId
          },
          body: JSON.stringify(body),
          timeout: this.config.timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        if (i < this.config.retries - 1) {
          await this.delay(1000 * (i + 1));
        }
      }
    }

    throw lastError;
  }

  handleMessage(data) {
    // Override this to handle incoming messages
    if (data.type === 'message') {
      console.log('[AgentOS] Message:', data.message);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =========================================================================
// APP-SPECIFIC CLIENTS
// =========================================================================

/**
 * DO App Client
 * Connects DO service to Agent OS
 */
class DOAppClient extends AgentOSClient {
  constructor(config = {}) {
    super({
      appId: 'do-app',
      namespace: 'do-service',
      ...config
    });
  }

  /**
   * Track DO booking
   */
  async trackBooking(booking) {
    await this.track('do_booking', {
      serviceType: booking.serviceType,
      provider: booking.provider,
      amount: booking.amount,
      bookingId: booking.bookingId
    });
  }

  /**
   * Get DO recommendations
   */
  async getDORecommendations(location) {
    return await this.recommend({
      type: 'do-service',
      location
    });
  }
}

/**
 * Hotel OTA Client
 * Connects Hotel booking to Agent OS
 */
class HotelOTAClient extends AgentOSClient {
  constructor(config = {}) {
    super({
      appId: 'hotel-ota',
      namespace: 'hotel',
      ...config
    });
  }

  /**
   * Track hotel booking
   */
  async trackBooking(booking) {
    await this.track('hotel_booking', {
      hotelId: booking.hotelId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      rooms: booking.rooms,
      amount: booking.amount
    });
  }

  /**
   * Get hotel recommendations
   */
  async getHotelRecommendations(location, dates) {
    return await this.recommend({
      type: 'hotel',
      location,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut
    });
  }

  /**
   * Track hotel search
   */
  async trackSearch(searchParams) {
    await this.track('hotel_search', searchParams);
  }
}

/**
 * AdBazaar Client
 * Connects AdBazaar to Agent OS
 */
class AdBazaarClient extends AgentOSClient {
  constructor(config = {}) {
    super({
      appId: 'adbazaar',
      namespace: 'advertising',
      ...config
    });
  }

  /**
   * Track ad impression
   */
  async trackImpression(adId, campaignId) {
    await this.track('ad_impression', {
      adId,
      campaignId
    });
  }

  /**
   * Track ad click
   */
  async trackClick(adId, campaignId) {
    await this.track('ad_click', {
      adId,
      campaignId
    });
  }

  /**
   * Track conversion
   */
  async trackConversion(adId, orderId, value) {
    await this.track('ad_conversion', {
      adId,
      orderId,
      value
    });
  }

  /**
   * Get ad targeting data
   */
  async getTargetingData(userId) {
    const context = await this.getUserContext();
    return {
      interests: context?.taste?.interests || [],
      location: context?.profile?.location,
      segment: context?.profile?.segment
    };
  }
}

/**
 * Rendez Client
 * Connects Rendez dating app to Agent OS
 */
class RendezClient extends AgentOSClient {
  constructor(config = {}) {
    super({
      appId: 'rendez',
      namespace: 'dating',
      ...config
    });
  }

  /**
   * Track profile view
   */
  async trackProfileView(profileId) {
    await this.track('profile_view', { profileId });
  }

  /**
   * Track match
   */
  async trackMatch(matchId, profileId) {
    await this.track('match', { matchId, profileId });
  }

  /**
   * Track message sent
   */
  async trackMessage(conversationId) {
    await this.track('message_sent', { conversationId });
  }

  /**
   * Get dating recommendations
   */
  async getDatingRecommendations() {
    return await this.recommend({ type: 'dating' });
  }
}

/**
 * Merchant App Client
 * Connects Merchant app to Agent OS
 */
class MerchantClient extends AgentOSClient {
  constructor(config = {}) {
    super({
      appId: 'merchant-app',
      namespace: 'merchant',
      ...config
    });
  }

  /**
   * Track sale
   */
  async trackSale(sale) {
    await this.track('merchant_sale', {
      orderId: sale.orderId,
      amount: sale.amount,
      items: sale.items?.length || 0
    });
  }

  /**
   * Get merchant insights
   */
  async getInsights(merchantId) {
    return await this.getMerchantAnalytics(merchantId);
  }

  /**
   * Get inventory alerts
   */
  async getInventoryAlerts(merchantId) {
    const inventory = await this.getMerchantInventory(merchantId);
    return inventory?.items?.filter(item => item.quantity < 10) || [];
  }
}

module.exports = {
  AgentOSClient,
  DOAppClient,
  HotelOTAClient,
  AdBazaarClient,
  RendezClient,
  MerchantClient
};
