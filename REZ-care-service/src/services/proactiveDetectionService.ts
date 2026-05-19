/**
 * REZ Care Service - Proactive Detection Service
 *
 * Detects issues BEFORE customers complain.
 * Monitors for anomalies and triggers auto-resolution.
 */

import mongoose from 'mongoose';
import axios from 'axios';
import { ProactiveAlert } from '../types';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

// Service URLs
const SERVICE_URLS = {
  payment: process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com',
  wallet: process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'https://rez-notifications-service.onrender.com',
  support: process.env.SUPPORT_SERVICE_URL || 'https://rez-support-dashboard.onrender.com',
  order: process.env.ORDER_SERVICE_URL || 'https://rez-order-service.onrender.com',
  merchant: process.env.MERCHANT_SERVICE_URL || 'https://rez-merchant-service.onrender.com',
};

// Alert Schema
const ProactiveAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['payment', 'qr', 'app', 'delivery', 'merchant', 'fraud', 'sentiment'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['P1', 'P2', 'P3', 'P4'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'investigating', 'resolved', 'auto_resolved'],
    default: 'active',
    index: true
  },
  detectedAt: { type: Date, default: Date.now, index: true },
  triggeredBy: String,
  description: String,

  affectedUsers: [String],
  affectedMerchants: [String],
  estimatedImpact: Number,

  actions: [{
    type: String,
    timestamp: Date,
    details: String,
    performedBy: String
  }],

  resolvedAt: Date,
  resolution: String,
  resolvedBy: String
}, { timestamps: true });

ProactiveAlertSchema.index({ status: 1, detectedAt: -1 });
ProactiveAlertSchema.index({ type: 1, severity: 1, status: 1 });

const ProactiveAlertModel = mongoose.model('ProactiveAlert', ProactiveAlertSchema);

// Detection Rules Configuration
interface DetectionRule {
  id: string;
  name: string;
  type: ProactiveAlert['type'];
  severity: ProactiveAlert['severity'];
  threshold: number;
  window: number; // minutes
  autoResolve: boolean;
  autoCompensate?: { amount: number; currency: string };
}

const DETECTION_RULES: DetectionRule[] = [
  // Payment Rules
  {
    id: 'PAYMENT_FAILURE_SPIKE',
    name: 'Payment Failure Spike',
    type: 'payment',
    severity: 'P1',
    threshold: 10,
    window: 10,
    autoResolve: false,
    autoCompensate: { amount: 5, currency: 'NC' }
  },
  {
    id: 'QR_SCAN_FAILURE_STREAK',
    name: 'QR Scan Failure Streak',
    type: 'qr',
    severity: 'P2',
    threshold: 3,
    window: 60,
    autoResolve: true,
    autoCompensate: { amount: 5, currency: 'NC' }
  },
  {
    id: 'MERCHANT_QR_DOWN',
    name: 'Merchant QR Down',
    type: 'merchant',
    severity: 'P1',
    threshold: 5,
    window: 30,
    autoResolve: false,
    autoCompensate: { amount: 10, currency: 'NC' }
  },
  {
    id: 'APP_ERROR_SPIKE',
    name: 'App Error Spike',
    type: 'app',
    severity: 'P1',
    threshold: 20,
    window: 5,
    autoResolve: false
  },
  {
    id: 'DELIVERY_DELAY_ANOMALY',
    name: 'Delivery Delay Anomaly',
    type: 'delivery',
    severity: 'P2',
    threshold: 1,
    window: 60,
    autoResolve: true,
    autoCompensate: { amount: 20, currency: 'NC' }
  },
  {
    id: 'FRAUD_PATTERN_DETECTED',
    name: 'Suspicious Activity Pattern',
    type: 'fraud',
    severity: 'P1',
    threshold: 1,
    window: 60,
    autoResolve: false
  }
];

export class ProactiveDetectionService {
  private connected: boolean = false;

  async initialize(): Promise<void> {
    await this.connect();
    logger.info('Proactive Detection Service initialized');
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await mongoose.connect(MONGODB_URI);
      this.connected = true;
      logger.info('Proactive Detection connected to MongoDB');
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(filters?: {
    type?: string;
    severity?: string;
  }): Promise<ProactiveAlert[]> {
    await this.connect();

    const query: any = { status: { $in: ['active', 'investigating'] } };
    if (filters?.type) query.type = filters.type;
    if (filters?.severity) query.severity = filters.severity;

    const alerts = await ProactiveAlertModel
      .find(query)
      .sort({ detectedAt: -1 })
      .limit(100);

    return alerts.map(a => a.toObject() as any);
  }

  /**
   * Create alert manually
   */
  async createAlert(data: any): Promise<any> {
    await this.connect();

    const alert = new ProactiveAlertModel({
      ...data,
      status: 'active',
      detectedAt: new Date(),
      actions: []
    });

    await alert.save();

    // Execute auto actions
    await this.executeAlertActions(alert);

    logger.info('Alert created', { alertId: alert._id, type: alert.type });
    return alert.toObject() as any;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolution: string, resolvedBy?: string): Promise<ProactiveAlert> {
    await this.connect();

    const alert = await ProactiveAlertModel.findById(alertId);
    if (!alert) throw new Error('Alert not found');

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolution = resolution;
    alert.resolvedBy = resolvedBy || 'system';

    alert.actions.push({
      type: 'resolved',
      timestamp: new Date(),
      details: resolution,
      performedBy: resolvedBy || 'system'
    });

    await alert.save();

    logger.info('Alert resolved', { alertId, resolution });
    return alert.toObject() as any;
  }

  /**
   * Handle payment failure event
   */
  async handlePaymentFailure(data: {
    customerId: string;
    merchantId?: string;
    orderId?: string;
    errorCode?: string;
    amount?: number;
  }): Promise<void> {
    await this.connect();

    // Check for spike
    const recentFailures = await this.countRecentEvents('payment', data.customerId, 30);
    if (recentFailures >= 3) {
      // Create alert for repeated failures
      const alert = await this.createAlert({
        type: 'payment',
        severity: recentFailures >= 5 ? 'P1' : 'P2',
        triggeredBy: 'payment_failure_event',
        description: `Customer has ${recentFailures} payment failures in last 30 minutes`,
        affectedUsers: [data.customerId],
        estimatedImpact: data.amount || 0
      });

      // Auto-compensate
      if (recentFailures >= 3) {
        await this.compensateCustomer(data.customerId, 10, 'Payment inconvenience', alert._id.toString());
      }
    }
  }

  /**
   * Handle QR scan failure
   */
  async handleQRFailure(data: {
    customerId: string;
    merchantId: string;
    reason?: string;
  }): Promise<void> {
    await this.connect();

    // Check for merchant-level issue
    const merchantFailures = await this.countRecentEventsByMerchant('qr', data.merchantId, 30);
    if (merchantFailures >= 5) {
      // Merchant QR is down - major issue
      const alert = await this.createAlert({
        type: 'merchant',
        severity: 'P1',
        triggeredBy: 'qr_scan_failure',
        description: `Merchant ${data.merchantId} has ${merchantFailures} QR failures in 30 minutes`,
        affectedMerchants: [data.merchantId],
        affectedUsers: [],
        estimatedImpact: merchantFailures * 100
      });

      // Notify merchant
      await this.notifyMerchant(data.merchantId, 'QR Scan Issues Detected', alert.description);
      return;
    }

    // Check for customer-level issue
    const customerFailures = await this.countRecentEvents('qr', data.customerId, 60);
    if (customerFailures >= 3) {
      // Customer having repeated issues
      const alert = await this.createAlert({
        type: 'qr',
        severity: 'P3',
        triggeredBy: 'qr_scan_failure',
        description: `Customer has ${customerFailures} QR scan failures in 1 hour`,
        affectedUsers: [data.customerId],
        estimatedImpact: customerFailures * 5
      });

      // Auto-compensate and notify
      await this.compensateCustomer(data.customerId, 5, 'QR inconvenience', alert._id.toString());
      await this.notifyCustomer(data.customerId, 'QR Issue Resolved', 'We noticed some QR issues. 5 NC credited to your wallet.');
    }
  }

  /**
   * Handle app error
   */
  async handleAppError(data: {
    customerId: string;
    errorType: string;
    appVersion?: string;
    deviceInfo?: string;
  }): Promise<void> {
    await this.connect();

    // Check for spike
    const recentErrors = await this.countGlobalEvents('app_error', 5);
    if (recentErrors >= 20) {
      const alert = await this.createAlert({
        type: 'app',
        severity: 'P1',
        triggeredBy: 'app_error_spike',
        description: `App error spike detected: ${recentErrors} errors in 5 minutes`,
        affectedUsers: [],
        estimatedImpact: recentErrors
      });

      // Page on-call team
      await this.pageOncall('App Error Spike', `P1 Alert: ${alert.description}`);
    }
  }

  /**
   * Handle complaint
   */
  async handleComplaint(data: {
    customerId: string;
    complaintText: string;
    severity?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    await this.connect();

    const alert = await this.createAlert({
      type: 'sentiment',
      severity: data.severity === 'high' ? 'P2' : 'P3',
      triggeredBy: 'complaint_received',
      description: data.complaintText,
      affectedUsers: [data.customerId],
      estimatedImpact: 1
    });

    // If high severity, escalate
    if (data.severity === 'high') {
      await this.escalateToSupervisor(data.customerId, alert);
    }
  }

  /**
   * Handle order delivered
   */
  async handleOrderDelivered(data: {
    orderId: string;
    customerId: string;
    merchantId: string;
    deliveryTime: number; // minutes
    expectedTime: number; // minutes
  }): Promise<void> {
    // Check for delay
    if (data.deliveryTime > data.expectedTime * 1.5) {
      const delay = data.deliveryTime - data.expectedTime;
      const alert = await this.createAlert({
        type: 'delivery',
        severity: delay > 60 ? 'P2' : 'P3',
        triggeredBy: 'delivery_delay',
        description: `Order ${data.orderId} delivered ${delay} minutes late`,
        affectedUsers: [data.customerId],
        estimatedImpact: delay
      });

      // Auto-compensate
      const compensationAmount = Math.min(50, Math.round(delay / 10) * 10);
      await this.compensateCustomer(data.customerId, compensationAmount, 'Delivery delay', alert._id.toString());
    }
  }

  /**
   * Handle payout failure
   */
  async handlePayoutFailure(data: {
    merchantId: string;
    amount: number;
    reason?: string;
  }): Promise<void> {
    await this.connect();

    const alert = await this.createAlert({
      type: 'merchant',
      severity: 'P2',
      triggeredBy: 'payout_failed',
      description: `Payout of ₹${data.amount} failed for merchant ${data.merchantId}. Reason: ${data.reason || 'Unknown'}`,
      affectedMerchants: [data.merchantId],
      estimatedImpact: data.amount
    });

    // Notify merchant
    await this.notifyMerchant(
      data.merchantId,
      'Payout Issue',
      `Your payout of ₹${data.amount} could not be processed. Our team is looking into it.`
    );
  }

  /**
   * Run periodic detection checks
   */
  async runDetectionChecks(): Promise<void> {
    await this.connect();

    // Check payment failure rate
    await this.checkPaymentFailureRate();

    // Check QR scan success rate
    await this.checkQRScanRate();

    // Check delivery delays
    await this.checkDeliveryDelays();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async countRecentEvents(type: string, customerId: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    return ProactiveAlertModel.countDocuments({
      type,
      'affectedUsers': customerId,
      detectedAt: { $gte: since }
    });
  }

  private async countRecentEventsByMerchant(type: string, merchantId: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    return ProactiveAlertModel.countDocuments({
      type,
      'affectedMerchants': merchantId,
      detectedAt: { $gte: since }
    });
  }

  private async countGlobalEvents(type: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    return ProactiveAlertModel.countDocuments({
      type,
      detectedAt: { $gte: since }
    });
  }

  private async executeAlertActions(alert: any): Promise<void> {
    const actions: { type: string; timestamp: Date; details: string; performedBy: string }[] = [];

    switch (alert.type) {
      case 'payment':
        actions.push({ type: 'notify_team', timestamp: new Date(), details: 'Payment team notified', performedBy: 'system' });
        if (alert.severity === 'P1') {
          actions.push({ type: 'page_oncall', timestamp: new Date(), details: 'On-call team paged', performedBy: 'system' });
        }
        break;

      case 'merchant':
        actions.push({ type: 'notify_merchant', timestamp: new Date(), details: 'Merchant notified', performedBy: 'system' });
        break;

      case 'app':
        actions.push({ type: 'create_incident', timestamp: new Date(), details: 'Incident created', performedBy: 'system' });
        actions.push({ type: 'page_oncall', timestamp: new Date(), details: 'On-call team paged', performedBy: 'system' });
        break;

      case 'sentiment':
        actions.push({ type: 'create_ticket', timestamp: new Date(), details: 'Support ticket created', performedBy: 'system' });
        if (alert.severity === 'P1' || alert.severity === 'P2') {
          actions.push({ type: 'notify_supervisor', timestamp: new Date(), details: 'Supervisor notified', performedBy: 'system' });
        }
        break;
    }

    alert.actions.push(...actions);
    await alert.save();
  }

  private async compensateCustomer(
    customerId: string,
    amount: number,
    reason: string,
    alertId: string
  ): Promise<void> {
    try {
      await axios.post(
        `${SERVICE_URLS.wallet}/api/wallet/credit`,
        {
          userId: customerId,
          amount,
          reason: `compensation_${reason.toLowerCase().replace(/\s+/g, '_')}`,
          type: 'credit',
          metadata: { alertId, source: 'proactive_detection' }
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 10000 }
      );

      // Notify customer
      await this.notifyCustomer(
        customerId,
        'Compensation Applied',
        `We've credited ${amount} NC to your wallet for the inconvenience. Thank you for your patience!`
      );

      logger.info('Customer compensated', { customerId, amount, reason });
    } catch (error) {
      logger.error('Failed to compensate customer', error);
    }
  }

  private async notifyCustomer(customerId: string, title: string, message: string): Promise<void> {
    try {
      await axios.post(
        `${SERVICE_URLS.notifications}/api/notifications/send`,
        {
          userId: customerId,
          type: 'proactive_alert',
          channel: 'inapp',
          title,
          body: message
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to notify customer', error);
    }
  }

  private async notifyMerchant(merchantId: string, title: string, message: string): Promise<void> {
    try {
      await axios.post(
        `${SERVICE_URLS.merchant}/api/notifications/merchant/${merchantId}`,
        {
          type: 'alert',
          title,
          message
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to notify merchant', error);
    }
  }

  private async pageOncall(title: string, message: string): Promise<void> {
    // In production, this would integrate with PagerDuty, Pushover, etc.
    logger.warn('PAGING ONCALL', { title, message });

    try {
      await axios.post(
        `${SERVICE_URLS.notifications}/api/notifications/send`,
        {
          userId: 'oncall-team',
          type: 'oncall_alert',
          channel: 'sms',
          title,
          body: message
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to page oncall', error);
    }
  }

  private async escalateToSupervisor(customerId: string, alert: any): Promise<void> {
    try {
      await axios.post(
        `${SERVICE_URLS.support}/api/tickets`,
        {
          type: 'sentiment_escalation',
          customerId,
          subject: `High Priority Complaint - Customer ${customerId}`,
          description: alert.description,
          priority: 'high',
          tags: ['escalated', 'sentiment'],
          sourceService: 'proactive_detection'
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to escalate', error);
    }
  }

  private async checkPaymentFailureRate(): Promise<void> {
    // This would query payment service for real-time failure rates
    // Implementation depends on payment service API
    logger.debug('Running payment failure rate check');
  }

  private async checkQRScanRate(): Promise<void> {
    // This would query merchant service for QR success rates
    logger.debug('Running QR scan rate check');
  }

  private async checkDeliveryDelays(): Promise<void> {
    // This would query order service for delay patterns
    logger.debug('Running delivery delay check');
  }
}
