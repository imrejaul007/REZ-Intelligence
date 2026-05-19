/**
 * REZ Care Service - Complete Service Connector
 *
 * Connects REZ Care to ALL platform services:
 * - RABTUL Services (Auth, Payment, Wallet, Order, Catalog, etc.)
 * - REZ Intelligence (ML, Analytics, Insights)
 * - REZ Media (Campaigns, Loyalty, Attribution)
 * - CorpPerks (HR, Training, etc.)
 * - Industry Experts
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// ============================================
// SERVICE URLs
// ============================================

const SERVICE_URLS = {
  // RABTUL Core Services
  auth: process.env.RABTUL_AUTH_URL || 'http://localhost:4002',
  payment: process.env.RABTUL_PAYMENT_URL || 'http://localhost:4001',
  wallet: process.env.RABTUL_WALLET_URL || 'http://localhost:4004',
  order: process.env.RABTUL_ORDER_URL || 'http://localhost:4006',
  catalog: process.env.RABTUL_CATALOG_URL || 'http://localhost:4007',
  profile: process.env.RABTUL_PROFILE_URL || 'http://localhost:4013',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4011',
  booking: process.env.RABTUL_BOOKING_URL || 'http://localhost:4020',
  search: process.env.RABTUL_SEARCH_URL || 'http://localhost:4008',

  // REZ Intelligence
  supportCopilot: process.env.SUPPORT_COPILOT_URL || 'http://localhost:4033',
  churnPredictor: process.env.CHURN_PREDICTOR_URL || 'http://localhost:4123',
  ltvAttribution: process.env.LTV_URL || 'http://localhost:4090',
  sentimentAnalysis: process.env.SENTIMENT_URL || 'http://localhost:4150',
  merchantBrain: process.env.MERCHANT_BRAIN_URL || 'http://localhost:4122',
  predictiveEngine: process.env.PREDICTIVE_ENGINE_URL || 'http://localhost:4123',
  intentPredictor: process.env.INTENT_URL || 'http://localhost:4018',
  demandForecast: process.env.DEMAND_URL || 'http://localhost:4160',
  inventoryIntelligence: process.env.INVENTORY_URL || 'http://localhost:4170',

  // Additional REZ Intelligence (NEW)
  recommendationEngine: process.env.RECOMMENDATION_URL || 'http://localhost:4180',
  realtimeSegments: process.env.REALTIME_SEGMENTS_URL || 'http://localhost:4126',
  unifiedProfile: process.env.UNIFIED_PROFILE_URL || 'http://localhost:4120',
  consumerGraph: process.env.CONSUMER_GRAPH_URL || 'http://localhost:4175',
  cartAbandonment: process.env.CART_ABANDON_URL || 'http://localhost:4158',
  propensityModel: process.env.PROPENSITY_URL || 'http://localhost:4124',
  tasteProfile: process.env.TASTE_URL || 'http://localhost:4166',

  // REZ Media
  campaignHub: process.env.CAMPAIGN_HUB_URL || 'http://localhost:4500',
  loyalty: process.env.LOYALTY_URL || 'http://localhost:4600',
  karma: process.env.KARMA_URL || 'http://localhost:4610',
  attribution: process.env.ATTRIBUTION_URL || 'http://localhost:4700',
  engagement: process.env.ENGAGEMENT_URL || 'http://localhost:4800',

  // CorpPerks
  corpperks: process.env.CORPPERKS_URL || 'http://localhost:5000',
  peopleos: process.env.PEOPLEOS_URL || 'http://localhost:5002',
  talentai: process.env.TALENTAI_URL || 'http://localhost:5003',

  // Industry Experts
  hospitalityExpert: process.env.HOSPITALITY_EXPERT_URL || 'http://localhost:3005',
  salonExpert: process.env.SALON_EXPERT_URL || 'http://localhost:3006',
  fitnessExpert: process.env.FITNESS_EXPERT_URL || 'http://localhost:3007',
  healthExpert: process.env.HEALTH_EXPERT_URL || 'http://localhost:3008',
  educationExpert: process.env.EDUCATION_EXPERT_URL || 'http://localhost:3009',
  travelExpert: process.env.TRAVEL_EXPERT_URL || 'http://localhost:3010',
  retailExpert: process.env.RETAIL_EXPERT_URL || 'http://localhost:3011',
  culinaryExpert: process.env.CULINARY_EXPERT_URL || 'http://localhost:3012',
};

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

// ============================================
// SERVICE CONNECTOR CLASS
// ============================================

class ServiceConnector {
  private http: AxiosInstance;
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
    };
  }

  // ============================================
  // RABTUL SERVICES
  // ============================================

  /**
   * Verify customer authentication
   */
  async verifyCustomer(token: string): Promise<{ valid: boolean; customerId?: string; profile?: any }> {
    try {
      const res = await axios.post(
        `${SERVICE_URLS.auth}/api/auth/verify`,
        { token },
        { headers: this.headers, timeout: 5000 }
      );
      return { valid: true, customerId: res.data?.userId, profile: res.data };
    } catch (error) {
      logger.warn('[Connector] Auth verification failed');
      return { valid: false };
    }
  }

  /**
   * Get customer profile
   */
  async getCustomerProfile(customerId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.profile}/api/profile/${customerId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Process refund
   */
  async processRefund(orderId: string, amount: number, reason: string): Promise<{ success: boolean; refundId?: string }> {
    try {
      const res = await axios.post(
        `${SERVICE_URLS.payment}/api/refund`,
        { orderId, amount, reason },
        { headers: this.headers, timeout: 10000 }
      );
      return { success: true, refundId: res.data?.refundId };
    } catch (error) {
      logger.error('[Connector] Refund failed', error);
      return { success: false };
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.order}/api/orders/${orderId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Get product details
   */
  async getProduct(productId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.catalog}/api/products/${productId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(customerId: string): Promise<number> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.wallet}/api/balance/${customerId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data?.balance || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Credit wallet (compensation)
   */
  async creditWallet(customerId: string, amount: number, reason: string): Promise<boolean> {
    try {
      await axios.post(
        `${SERVICE_URLS.wallet}/api/credit`,
        { customerId, amount, reason },
        { headers: this.headers, timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send notification
   */
  async sendNotification(customerId: string, type: string, message: string, data?: any): Promise<boolean> {
    try {
      await axios.post(
        `${SERVICE_URLS.notifications}/api/send`,
        { customerId, type, message, data },
        { headers: this.headers, timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get booking details
   */
  async getBooking(bookingId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.booking}/api/bookings/${bookingId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  // ============================================
  // REZ INTELLIGENCE
  // ============================================

  /**
   * Get churn risk
   */
  async getChurnRisk(customerId: string): Promise<{ risk: number; factors: string[] }> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.churnPredictor}/customer/${customerId}/risk`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return { risk: 0.5, factors: [] };
    }
  }

  /**
   * Get customer LTV
   */
  async getLTV(customerId: string): Promise<{ ltv: number; segment: string }> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.ltvAttribution}/customer/${customerId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return { ltv: 0, segment: 'unknown' };
    }
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(text: string): Promise<{ sentiment: string; score: number }> {
    try {
      const res = await axios.post(
        `${SERVICE_URLS.sentimentAnalysis}/analyze`,
        { text },
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      // Fallback
      const lower = text.toLowerCase();
      if (/terrible|worst|hate/.test(lower)) return { sentiment: 'critical_negative', score: 0.1 };
      if (/angry|frustrated/.test(lower)) return { sentiment: 'negative', score: 0.3 };
      if (/thank|great|love/.test(lower)) return { sentiment: 'positive', score: 0.8 };
      return { sentiment: 'neutral', score: 0.5 };
    }
  }

  /**
   * Get merchant insights
   */
  async getMerchantInsights(merchantId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.merchantBrain}/insights/${merchantId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Predict next best action
   */
  async getNextBestAction(customerId: string, context: any): Promise<{ action: string; reason: string } | null> {
    try {
      const res = await axios.post(
        `${SERVICE_URLS.predictiveEngine}/next-best-action`,
        { customerId, context },
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Get inventory status
   */
  async getInventoryStatus(productId: string): Promise<{ stock: number; available: boolean }> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.inventoryIntelligence}/status/${productId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return { stock: 0, available: false };
    }
  }

  // ============================================
  // REZ MEDIA
  // ============================================

  /**
   * Trigger retention campaign
   */
  async triggerRetentionCampaign(customerId: string, reason: string): Promise<boolean> {
    try {
      await axios.post(
        `${SERVICE_URLS.campaignHub}/trigger`,
        { campaignType: 'retention', customerId, trigger: reason },
        { headers: this.headers, timeout: 10000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Grant loyalty points
   */
  async grantLoyaltyPoints(customerId: string, points: number, reason: string): Promise<boolean> {
    try {
      await axios.post(
        `${SERVICE_URLS.loyalty}/grant`,
        { customerId, points, reason },
        { headers: this.headers, timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Grant karma points
   */
  async grantKarma(customerId: string, points: number, action: string): Promise<boolean> {
    try {
      await axios.post(
        `${SERVICE_URLS.karma}/grant`,
        { customerId, points, action },
        { headers: this.headers, timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Track attribution
   */
  async trackAttribution(customerId: string, event: string, value: number): Promise<boolean> {
    try {
      await axios.post(
        `${SERVICE_URLS.attribution}/track`,
        { customerId, event, value },
        { headers: this.headers, timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // CORPPERKS
  // ============================================

  /**
   * Get employee info (CorpPerks)
   */
  async getEmployeeInfo(employeeId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICE_URLS.corpperks}/employees/${employeeId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Route to CorpPerks service
   */
  async routeToCorpPerks(employeeId: string, category: string): Promise<{ service: string; action: string }> {
    try {
      const res = await axios.post(
        `${SERVICE_URLS.corpperks}/route`,
        { employeeId, category },
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      // Default routing
      if (category.includes('leave') || category.includes('payroll')) {
        return { service: 'peopleos', action: 'route_hr' };
      }
      if (category.includes('training') || category.includes('course')) {
        return { service: 'talentai', action: 'suggest_courses' };
      }
      return { service: 'unknown', action: 'general' };
    }
  }

  // ============================================
  // INDUSTRY EXPERTS
  // ============================================

  /**
   * Route to industry expert
   */
  async routeToExpert(message: string): Promise<{ expert: string; response: string } | null> {
    const lower = message.toLowerCase();

    // Detect industry
    const expertMap: Record<string, string> = {
      hotel: 'hospitalityExpert',
      room: 'hospitalityExpert',
      booking: 'hospitalityExpert',
      hair: 'salonExpert',
      beauty: 'salonExpert',
      gym: 'fitnessExpert',
      workout: 'fitnessExpert',
      health: 'healthExpert',
      doctor: 'healthExpert',
      course: 'educationExpert',
      training: 'educationExpert',
      travel: 'travelExpert',
      trip: 'travelExpert',
      shopping: 'retailExpert',
      product: 'retailExpert',
      food: 'culinaryExpert',
      recipe: 'culinaryExpert',
      restaurant: 'culinaryExpert',
    };

    for (const [keyword, expert] of Object.entries(expertMap)) {
      if (lower.includes(keyword)) {
        const expertUrl = SERVICE_URLS[expert as keyof typeof SERVICE_URLS];
        try {
          const res = await axios.post(
            `${expertUrl}/chat`,
            { message },
            { headers: this.headers, timeout: 8000 }
          );
          return { expert, response: res.data?.message || res.data?.response };
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  /**
   * Enrich ticket with all available data
   */
  async enrichTicket(customerId: string, ticket: any): Promise<any> {
    const [profile, churn, ltv, sentiment] = await Promise.all([
      this.getCustomerProfile(customerId),
      this.getChurnRisk(customerId),
      this.getLTV(customerId),
      this.analyzeSentiment(ticket.message || ticket.description || ''),
    ]);

    return {
      ...ticket,
      customerProfile: profile,
      churnRisk: churn.risk,
      ltv: ltv.ltv,
      ltvSegment: ltv.segment,
      sentiment: sentiment.sentiment,
      sentimentScore: sentiment.score,
    };
  }
}

export const serviceConnector = new ServiceConnector();

  // NEW: Additional connections
  async getRecommendations(customerId: string): Promise<any[]> {
    try {
      const res = await axios.get(`${SERVICE_URLS.recommendationEngine}/customer/${customerId}/recommendations`, { headers: this.headers, timeout: 5000 });
      return res.data?.products || [];
    } catch { return []; }
  }

  async getCustomerSegment(customerId: string): Promise<{ segment: string; tags: string[] }> {
    try {
      const res = await axios.get(`${SERVICE_URLS.realtimeSegments}/customer/${customerId}`, { headers: this.headers, timeout: 5000 });
      return res.data || { segment: 'unknown', tags: [] };
    } catch { return { segment: 'unknown', tags: [] }; }
  }

  async getCartAbandonment(customerId: string): Promise<{ abandoned: boolean; items: any[] }> {
    try {
      const res = await axios.get(`${SERVICE_URLS.cartAbandonment}/customer/${customerId}`, { headers: this.headers, timeout: 5000 });
      return res.data || { abandoned: false, items: [] };
    } catch { return { abandoned: false, items: [] }; }
  }

  async pushEngagement(customerId: string, campaign: string): Promise<boolean> {
    try {
      await axios.post(`${SERVICE_URLS.engagement}/push`, { customerId, campaign }, { headers: this.headers, timeout: 5000 });
      return true;
    } catch { return false; }
  }
