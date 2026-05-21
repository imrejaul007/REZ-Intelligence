/**
 * REZ Care - Autonomous Loop Service
 *
 * Connects REZ Care to:
 * - RABTUL Services (Payment, Wallet, Auth, etc.)
 * - REZ Intelligence (Churn, LTV, Sentiment, etc.)
 * - REZ Media (Campaigns, Loyalty, Karma, etc.)
 * - CorpPerks (HR, Training, etc.)
 */

import axios from 'axios';
import { logger } from '../utils/logger';

// ============================================
// SERVICE URLs
// ============================================

const SERVICES = {
  // RABTUL Core
  payment: process.env.RABTUL_PAYMENT_URL || 'http://localhost:4001',
  wallet: process.env.RABTUL_WALLET_URL || 'http://localhost:4004',
  auth: process.env.RABTUL_AUTH_URL || 'http://localhost:4002',
  order: process.env.RABTUL_ORDER_URL || 'http://localhost:4006',
  catalog: process.env.RABTUL_CATALOG_URL || 'http://localhost:4007',
  profile: process.env.RABTUL_PROFILE_URL || 'http://localhost:4013',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4011',

  // REZ Intelligence
  churnPredictor: process.env.REZ_CHURN_PREDICTOR_URL || 'http://localhost:4123',
  ltvAttribution: process.env.REZ_LTV_URL || 'http://localhost:4090',
  sentimentAnalysis: process.env.REZ_SENTIMENT_URL || 'http://localhost:4150',
  demandForecast: process.env.REZ_DEMAND_FORECAST_URL || 'http://localhost:4160',
  merchantBrain: process.env.REZ_MERCHANT_BRAIN_URL || 'http://localhost:4122',
  deliveryTracking: process.env.REZ_DELIVERY_URL || 'http://localhost:4009',
  inventoryIntelligence: process.env.REZ_INVENTORY_URL || 'http://localhost:4170',

  // REZ Media
  campaignHub: process.env.REZ_CAMPAIGN_HUB_URL || 'http://localhost:4500',
  loyalty: process.env.REZ_LOYALTY_URL || 'http://localhost:4600',
  karma: process.env.REZ_KARMA_URL || 'http://localhost:4610',

  // CorpPerks
  corpperks: process.env.CORPPERKS_API_URL || 'http://localhost:5000',

  // Internal
  copilot: process.env.SUPPORT_COPILOT_URL || 'http://localhost:4033',
};

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

// ============================================
// TYPES
// ============================================

export interface TicketContext {
  ticketId: string;
  customerId: string;
  customerPhone: string;
  category: string;
  platform: string;
  sentiment?: string;
  priority?: string;
  metadata?: any;
}

export interface AutonomousAction {
  action: string;
  service: string;
  params: any;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================
// AUTONOMOUS LOOP SERVICE
// ============================================

class AutonomousLoop {
  private headers = {
    'Content-Type': 'application/json',
    'X-Internal-Token': INTERNAL_TOKEN,
  };

  // ============================================
  // MAIN ENTRY POINT
  // ============================================

  /**
   * Process ticket autonomously
   */
  async processTicket(ticket: TicketContext): Promise<{
    actions: AutonomousAction[];
    ltv?: number;
    churnRisk?: number;
    sentiment?: any;
  }> {
    const actions: AutonomousAction[] = [];

    // 1. Get customer intelligence
    const [ltv, churnRisk, sentiment] = await Promise.all([
      this.getLTV(ticket.customerId),
      this.getChurnRisk(ticket.customerId),
      this.getSentiment(ticket.customerId),
    ]);

    // 2. Determine actions
    if (ticket.category === 'cancellation' && ltv > 50000) {
      actions.push(...this.vipRetentionActions(ticket, ltv));
    }

    if (sentiment?.critical_negative) {
      actions.push(...this.criticalSentimentActions(ticket));
    }

    if (ticket.category === 'payment') {
      actions.push(...this.paymentActions(ticket));
    }

    if (ticket.category === 'delivery') {
      const deliveryActions = await this.deliveryActions(ticket);
      actions.push(...deliveryActions);
    }

    if (ticket.category === 'out_of_stock') {
      const inventoryActions = await this.inventoryActions(ticket);
      actions.push(...inventoryActions);
    }

    if (ticket.platform === 'peopleos') {
      const corpperksActions = await this.corpperksActions(ticket);
      actions.push(...corpperksActions);
    }

    // 3. Execute actions
    await Promise.all(actions.map(action => this.executeAction(action)));

    return { actions, ltv, churnRisk, sentiment };
  }

  // ============================================
  // INTELLIGENCE FETCHING
  // ============================================

  private async getLTV(customerId: string): Promise<number> {
    try {
      const res = await axios.get(
        `${SERVICES.ltvAttribution}/customer/${customerId}/ltv`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data?.ltv || 0;
    } catch {
      return 0;
    }
  }

  private async getChurnRisk(customerId: string): Promise<number> {
    try {
      const res = await axios.get(
        `${SERVICES.churnPredictor}/customer/${customerId}/risk`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data?.risk || 0;
    } catch {
      return 0;
    }
  }

  private async getSentiment(customerId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICES.sentimentAnalysis}/customer/${customerId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  private async getDeliveryTracking(orderId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICES.deliveryTracking}/${orderId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  private async getInventory(productId: string): Promise<any> {
    try {
      const res = await axios.get(
        `${SERVICES.inventoryIntelligence}/product/${productId}`,
        { headers: this.headers, timeout: 5000 }
      );
      return res.data;
    } catch {
      return null;
    }
  }

  // ============================================
  // ACTION GENERATORS
  // ============================================

  private vipRetentionActions(ticket: TicketContext, ltv: number): AutonomousAction[] {
    const actions: AutonomousAction[] = [];

    if (ltv > 100000) {
      actions.push({
        action: 'credit_wallet',
        service: 'wallet',
        params: { customerId: ticket.customerId, amount: 500, reason: 'VIP retention' },
        reason: `VIP customer (LTV: ${ltv}`,
        priority: 'critical',
      });
    }

    if (ltv > 50000) {
      actions.push({
        action: 'grant_loyalty_points',
        service: 'loyalty',
        params: { customerId: ticket.customerId, points: 1000 },
        reason: `VIP retention for high-value customer`,
        priority: 'high',
      });
    }

    actions.push({
      action: 'send_sms',
      service: 'notifications',
      params: {
        phone: ticket.customerPhone,
        template: 'vip_retention',
        variables: { customerId: ticket.customerId },
      },
      reason: 'VIP retention offer',
      priority: 'high',
    });

    return actions;
  }

  private criticalSentimentActions(ticket: TicketContext): AutonomousAction[] {
    return [
      {
        action: 'escalate_manager',
        service: 'care',
        params: { ticketId: ticket.ticketId },
        reason: 'Critical negative sentiment detected',
        priority: 'critical',
      },
      {
        action: 'send_sms',
        service: 'notifications',
        params: {
          phone: ticket.customerPhone,
          template: 'critical_support',
          message: 'Our team lead will call you shortly',
        },
        reason: 'Critical sentiment - proactive outreach',
        priority: 'high',
      },
      {
        action: 'trigger_campaign',
        service: 'campaignHub',
        params: { campaignType: 'vip_retention' },
        reason: 'Critical customer at risk',
        priority: 'medium',
      },
    ];
  }

  private paymentActions(ticket: TicketContext): AutonomousAction[] {
    return [
      {
        action: 'check_payment_status',
        service: 'payment',
        params: { orderId: ticket.metadata?.orderId },
        reason: 'Payment issue ticket',
        priority: 'high',
      },
      {
        action: 'send_retry_payment_link',
        service: 'notifications',
        params: { phone: ticket.customerPhone },
        reason: 'Help customer complete payment',
        priority: 'medium',
      },
    ];
  }

  private async deliveryActions(ticket: TicketContext): Promise<AutonomousAction[]> {
    const actions: AutonomousAction[] = [];
    const tracking = await this.getDeliveryTracking(ticket.metadata?.orderId);

    if (tracking) {
      actions.push({
        action: 'send_tracking_update',
        service: 'notifications',
        params: {
          phone: ticket.customerPhone,
          tracking: tracking.status,
          eta: tracking.eta,
        },
        reason: 'Proactive delivery update',
        priority: 'medium',
      });

      if (tracking.delay > 30) {
        actions.push({
          action: 'credit_wallet',
          service: 'wallet',
          params: { customerId: ticket.customerId, amount: 50 },
          reason: 'Delivery delay compensation',
          priority: 'high',
        });

        actions.push({
          action: 'grant_karma',
          service: 'karma',
          params: { customerId: ticket.customerId, points: 10 },
          reason: 'Compensation for delay',
          priority: 'medium',
        });
      }
    }

    return actions;
  }

  private async inventoryActions(ticket: TicketContext): Promise<AutonomousAction[]> {
    const actions: AutonomousAction[] = [];
    const inventory = await this.getInventory(ticket.metadata?.productId);

    if (inventory?.stock < 10 && inventory?.demand > 100) {
      actions.push({
        action: 'trigger_reorder',
        service: 'order',
        params: { productId: ticket.metadata?.productId },
        reason: 'Low stock + high demand',
        priority: 'high',
      });

      actions.push({
        action: 'notify_merchant',
        service: 'notifications',
        params: { merchantId: ticket.metadata?.merchantId, message: 'Stock alert' },
        reason: 'Merchant inventory alert',
        priority: 'medium',
      });
    }

    return actions;
  }

  private corpperksActions(ticket: TicketContext): AutonomousAction[] {
    const platformActions: Record<string, AutonomousAction[]> = {
      peopleos: [
        { action: 'route_hr_agent', service: 'corpperks', params: { ticketId: ticket.ticketId }, reason: 'HR ticket', priority: 'high' },
      ],
      talentai: [
        { action: 'route_talent_agent', service: 'corpperks', params: { ticketId: ticket.ticketId }, reason: 'Talent ticket', priority: 'high' },
      ],
      restopapa: [
        { action: 'route_restaurant_agent', service: 'corpperks', params: { ticketId: ticket.ticketId }, reason: 'Restaurant ticket', priority: 'high' },
      ],
      nextabizz: [
        { action: 'route_business_agent', service: 'corpperks', params: { ticketId: ticket.ticketId }, reason: 'Business ticket', priority: 'high' },
      ],
      insightcampus: [
        { action: 'route_student_agent', service: 'corpperks', params: { ticketId: ticket.ticketId }, reason: 'Student ticket', priority: 'high' },
      ],
    };

    return platformActions[ticket.platform] || [];
  }

  // ============================================
  // ACTION EXECUTION
  // ============================================

  private async executeAction(action: AutonomousAction): Promise<void> {
    try {
      switch (action.service) {
        case 'wallet':
          await this.executeWallet(action.params);
          break;
        case 'notifications':
          await this.executeNotification(action.params);
          break;
        case 'loyalty':
          await this.executeLoyalty(action.params);
          break;
        case 'karma':
          await this.executeKarma(action.params);
          break;
        case 'campaignHub':
          await this.executeCampaign(action.params);
          break;
        case 'corpperks':
          await this.executeCorpPerks(action.params);
          break;
        case 'payment':
          await this.executePayment(action.params);
          break;
        case 'order':
          await this.executeOrder(action.params);
          break;
        default:
          logger.warn(`Unknown service: ${action.service}`);
      }
      logger.info(`[Autonomous] Executed ${action.action} via ${action.service}`);
    } catch (error) {
      logger.error(`[Autonomous] Failed ${action.action}`, error);
    }
  }

  private async executeWallet(params: any): Promise<void> {
    await axios.post(`${SERVICES.wallet}/credit`, params, { headers: this.headers });
  }

  private async executeNotification(params: any): Promise<void> {
    await axios.post(`${SERVICES.notifications}/send`, params, { headers: this.headers });
  }

  private async executeLoyalty(params: any): Promise<void> {
    await axios.post(`${SERVICES.loyalty}/grant`, params, { headers: this.headers });
  }

  private async executeKarma(params: any): Promise<void> {
    await axios.post(`${SERVICES.karma}/grant`, params, { headers: this.headers });
  }

  private async executeCampaign(params: any): Promise<void> {
    await axios.post(`${SERVICES.campaignHub}/trigger`, params, { headers: this.headers });
  }

  private async executeCorpPerks(params: any): Promise<void> {
    await axios.post(`${SERVICES.corpperks}/support/route`, params, { headers: this.headers });
  }

  private async executePayment(params: any): Promise<void> {
    // Payment-specific logic
  }

  private async executeOrder(params: any): Promise<void> {
    // Order-specific logic
  }
}

export const autonomousLoop = new AutonomousLoop();
