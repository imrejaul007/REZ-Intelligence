/**
 * REZ Care Service - Autonomous Actions Engine
 *
 * Executes automatic actions based on ticket context:
 * - RABTUL: Refunds, Wallet credits, Notifications
 * - REZ Media: Loyalty, Karma, Campaigns
 * - REZ Intelligence: Churn prevention, VIP retention
 * - CorpPerks: HR routing
 */

import { logger } from '../utils/logger.js';
import { serviceConnector } from './serviceConnector';

export interface TicketContext {
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  customerPhone?: string;
  category: string;
  priority: string;
  sentiment: string;
  ltv?: number;
  churnRisk?: number;
  orderId?: string;
  productId?: string;
  merchantId?: string;
  platform: string;
}

export interface AutonomousAction {
  id: string;
  type: string;
  service: string;
  params: Record<string, unknown>;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  executed: boolean;
  result?;
}

/**
 * Autonomous Actions Engine
 */
class AutonomousActionsEngine {
  /**
   * Determine actions for a ticket
   */
  async determineActions(ticket: TicketContext): Promise<AutonomousAction[]> {
    const actions: AutonomousAction[] = [];

    // 1. CRITICAL SENTIMENT + VIP → Immediate compensation
    if (ticket.sentiment === 'critical_negative' && ticket.ltv && ticket.ltv > 50000) {
      actions.push({
        id: `action_${Date.now()}_1`,
        type: 'credit_wallet',
        service: 'RABTUL',
        params: { customerId: ticket.customerId, amount: 500, reason: 'VIP critical sentiment compensation' },
        reason: `VIP customer (LTV: ${ticket.ltv}) with critical sentiment`,
        priority: 'critical',
        executed: false,
      });
    }

    // 2. CANCELLATION + HIGH CHURN RISK → Retention offer
    if (ticket.category === 'cancellation' && ticket.churnRisk && ticket.churnRisk > 0.7) {
      actions.push({
        id: `action_${Date.now()}_2`,
        type: 'grant_loyalty',
        service: 'REZ Media',
        params: { customerId: ticket.customerId, points: 1000, reason: 'Cancellation prevention' },
        reason: `High churn risk (${ticket.churnRisk}) + cancellation`,
        priority: 'high',
        executed: false,
      });

      actions.push({
        id: `action_${Date.now()}_3`,
        type: 'trigger_campaign',
        service: 'REZ Media',
        params: { customerId: ticket.customerId, campaignType: 'vip_retention' },
        reason: 'Retention campaign for at-risk customer',
        priority: 'high',
        executed: false,
      });
    }

    // 3. DELIVERY DELAY → Compensation + Notification
    if (ticket.category === 'delivery' && ticket.orderId) {
      actions.push({
        id: `action_${Date.now()}_4`,
        type: 'send_notification',
        service: 'RABTUL',
        params: { customerId: ticket.customerId, type: 'delivery_update', message: 'Checking your delivery status' },
        reason: 'Proactive delivery update',
        priority: 'medium',
        executed: false,
      });
    }

    // 4. PAYMENT FAILURE → Retry + Support link
    if (ticket.category === 'payment') {
      actions.push({
        id: `action_${Date.now()}_5`,
        type: 'send_notification',
        service: 'RABTUL',
        params: { customerId: ticket.customerId, type: 'payment_retry', message: 'Payment retry link attached' },
        reason: 'Help customer complete payment',
        priority: 'high',
        executed: false,
      });
    }

    // 5. OUT OF STOCK + HIGH DEMAND → Notify merchant
    if (ticket.category === 'out_of_stock' && ticket.productId) {
      actions.push({
        id: `action_${Date.now()}_6`,
        type: 'notify_merchant',
        service: 'REZ Intelligence',
        params: { merchantId: ticket.merchantId, productId: ticket.productId, type: 'stock_alert' },
        reason: 'Customer complaint about OOS product',
        priority: 'medium',
        executed: false,
      });
    }

    // 6. REFUND REQUEST + LOW VALUE → Auto-approve
    if (ticket.category === 'refund' && ticket.ltv && ticket.ltv < 1000) {
      actions.push({
        id: `action_${Date.now()}_7`,
        type: 'process_refund',
        service: 'RABTUL',
        params: { orderId: ticket.orderId, reason: 'Customer request (low value)' },
        reason: 'Auto-approve low value refund',
        priority: 'medium',
        executed: false,
      });
    }

    // 7. HOTEL/BOOKING → Route to hospitality expert
    if (ticket.category === 'hotel' || ticket.category === 'booking') {
      actions.push({
        id: `action_${Date.now()}_8`,
        type: 'route_to_expert',
        service: 'Industry Expert',
        params: { expert: 'hospitality', ticketId: ticket.ticketId },
        reason: 'Hotel/booking related issue',
        priority: 'medium',
        executed: false,
      });
    }

    // 8. PAYROLL/HR → Route to CorpPerks
    if (ticket.category === 'payroll' || ticket.category === 'leave' || ticket.platform === 'peopleos') {
      actions.push({
        id: `action_${Date.now()}_9`,
        type: 'route_to_corpperks',
        service: 'CorpPerks',
        params: { employeeId: ticket.customerId, category: ticket.category },
        reason: 'HR-related issue',
        priority: 'high',
        executed: false,
      });
    }

    return actions;
  }

  /**
   * Execute all determined actions
   */
  async executeActions(actions: AutonomousAction[]): Promise<{ executed: number; failed: number; results: unknown[] }> {
    const results: unknown[] = [];
    let executed = 0;
    let failed = 0;

    for (const action of actions) {
      try {
        const result = await this.executeAction(action);
        action.executed = true;
        action.result = result;
        results.push({ actionId: action.id, success: true, result });
        executed++;
        logger.info(`[Autonomous] Executed: ${action.type}`, { ticket: action.params });
      } catch (error) {
        action.result = { error: (error as Error).message };
        results.push({ actionId: action.id, success: false, error: (error as Error).message });
        failed++;
        logger.error(`[Autonomous] Failed: ${action.type}`, error);
      }
    }

    return { executed, failed, results };
  }

  /**
   * Execute single action
   */
  private async executeAction(action: AutonomousAction): Promise<unknown> {
    switch (action.service) {
      // RABTUL Services
      case 'RABTUL':
        return this.executeRABTULAction(action);
      // REZ Media
      case 'REZ Media':
        return this.executeREZMediaAction(action);
      // REZ Intelligence
      case 'REZ Intelligence':
        return this.executeIntelligenceAction(action);
      // Industry Experts
      case 'Industry Expert':
        return this.executeExpertAction(action);
      // CorpPerks
      case 'CorpPerks':
        return this.executeCorpPerksAction(action);
      default:
        throw new Error(`Unknown service: ${action.service}`);
    }
  }

  private async executeRABTULAction(action: AutonomousAction): Promise<unknown> {
    const params = action.params as Record<string, unknown>;
    switch (action.type) {
      case 'credit_wallet':
        return serviceConnector.creditWallet(
          String(params.customerId),
          Number(params.amount),
          String(params.reason)
        );
      case 'send_notification':
        return serviceConnector.sendNotification(
          String(params.customerId),
          String(params.type),
          String(params.message)
        );
      case 'process_refund':
        return serviceConnector.processRefund(
          String(params.orderId),
          Number(params.amount) || 0,
          String(params.reason)
        );
      default:
        return { success: true };
    }
  }

  private async executeREZMediaAction(action: AutonomousAction): Promise<unknown> {
    const params = action.params as Record<string, unknown>;
    switch (action.type) {
      case 'grant_loyalty':
        return serviceConnector.grantLoyaltyPoints(
          String(params.customerId),
          Number(params.points),
          String(params.reason)
        );
      case 'grant_karma':
        return serviceConnector.grantKarma(
          String(params.customerId),
          Number(params.points),
          String(params.action)
        );
      case 'trigger_campaign':
        return serviceConnector.triggerRetentionCampaign(
          String(params.customerId),
          String(params.campaignType)
        );
      default:
        return { success: true };
    }
  }

  private async executeIntelligenceAction(action: AutonomousAction): Promise<unknown> {
    const params = action.params as Record<string, unknown>;
    switch (action.type) {
      case 'notify_merchant':
        return serviceConnector.getMerchantInsights(String(params.merchantId));
      default:
        return { success: true };
    }
  }

  private async executeExpertAction(action: AutonomousAction): Promise<unknown> {
    const params = action.params as Record<string, unknown>;
    return serviceConnector.routeToExpert(String(params.ticketId));
  }

  private async executeCorpPerksAction(action: AutonomousAction): Promise<unknown> {
    const params = action.params as Record<string, unknown>;
    return serviceConnector.routeToCorpPerks(
      String(params.employeeId),
      String(params.category)
    );
  }
}

export const autonomousActions = new AutonomousActionsEngine();
