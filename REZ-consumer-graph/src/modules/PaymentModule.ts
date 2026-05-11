/**
 * PaymentModule - Payment Methods and History
 * Manages consumer payment methods and transaction history
 */

import winston from 'winston';
import { ConsumerGraph } from '../ConsumerGraph';
import { PaymentMethod, PaymentTransaction } from '../types';

export interface PaymentSummary {
  methods: PaymentMethod[];
  transactions: PaymentTransaction[];
  preferred_method?: string;
  total_spent: number;
  avg_transaction: number;
}

export interface PaymentMethodInput {
  type: 'card' | 'bank_account' | 'digital_wallet' | 'crypto';
  provider: string;
  last_four?: string;
  expiry_date?: string;
  is_default?: boolean;
}

export class PaymentModule {
  private consumerGraph: ConsumerGraph;
  private logger: winston.Logger;

  // Local storage
  private paymentMethods: Map<string, PaymentMethod[]>;
  private transactions: Map<string, PaymentTransaction[]>;

  constructor(consumerGraph: ConsumerGraph) {
    this.consumerGraph = consumerGraph;
    this.paymentMethods = new Map();
    this.transactions = new Map();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    this.logger.info('PaymentModule initialized');
  }

  // ============================================
  // PAYMENT METHODS
  // ============================================

  /**
   * Add payment method
   */
  async addPaymentMethod(
    userId: string,
    input: PaymentMethodInput
  ): Promise<PaymentMethod | null> {
    const profile = this.consumerGraph.getConsumer(userId);
    if (!profile) {
      this.logger.error('Consumer not found', { userId });
      return null;
    }

    const methods = this.getPaymentMethodsInternal(userId);

    // Check if method already exists
    const exists = methods.some(
      (m) => m.type === input.type && m.provider === input.provider
    );
    if (exists) {
      this.logger.warn('Payment method already exists', { userId, type: input.type });
      return null;
    }

    const method: PaymentMethod = {
      method_id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: input.type,
      provider: input.provider,
      last_four: input.last_four || '****',
      expiry_date: input.expiry_date,
      is_default: input.is_default || methods.length === 0,
      added_at: new Date().toISOString(),
      last_used: undefined,
      is_verified: true,
    };

    // If setting as default, unset other defaults
    if (method.is_default) {
      methods.forEach((m) => (m.is_default = false));
    }

    methods.push(method);
    this.paymentMethods.set(userId, methods);

    this.logger.info('Payment method added', {
      userId,
      methodId: method.method_id,
      type: method.type,
    });

    return method;
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(userId: string, methodId: string): Promise<boolean> {
    const methods = this.getPaymentMethodsInternal(userId);
    const index = methods.findIndex((m) => m.method_id === methodId);

    if (index === -1) {
      return false;
    }

    const wasDefault = methods[index].is_default;
    methods.splice(index, 1);

    // If removed was default, set new default
    if (wasDefault && methods.length > 0) {
      methods[0].is_default = true;
    }

    this.logger.info('Payment method removed', { userId, methodId });
    return true;
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userId: string, methodId: string): Promise<boolean> {
    const methods = this.getPaymentMethodsInternal(userId);
    const method = methods.find((m) => m.method_id === methodId);

    if (!method) {
      return false;
    }

    methods.forEach((m) => (m.is_default = false));
    method.is_default = true;

    this.logger.info('Default payment method set', { userId, methodId });
    return true;
  }

  /**
   * Get all payment methods
   */
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return this.getPaymentMethodsInternal(userId);
  }

  private getPaymentMethodsInternal(userId: string): PaymentMethod[] {
    if (!this.paymentMethods.has(userId)) {
      this.paymentMethods.set(userId, []);
    }
    return this.paymentMethods.get(userId)!;
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  /**
   * Record payment transaction
   */
  async recordTransaction(transaction: Omit<PaymentTransaction, 'transaction_id'>): Promise<PaymentTransaction> {
    const fullTransaction: PaymentTransaction = {
      ...transaction,
      transaction_id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    if (!this.transactions.has(transaction.user_id)) {
      this.transactions.set(transaction.user_id, []);
    }
    this.transactions.get(transaction.user_id)!.push(fullTransaction);

    // Update payment method last used
    const methods = this.getPaymentMethodsInternal(transaction.user_id);
    const method = methods.find((m) => m.method_id === transaction.payment_method_id);
    if (method) {
      method.last_used = transaction.timestamp;
    }

    // Update consumer transactions
    const profile = this.consumerGraph.getConsumer(transaction.user_id);
    if (profile) {
      profile.addTransaction(transaction.amount, transaction.payment_method_id);
    }

    this.logger.info('Payment transaction recorded', {
      userId: transaction.user_id,
      transactionId: fullTransaction.transaction_id,
      amount: transaction.amount,
    });

    return fullTransaction;
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaymentTransaction[]> {
    const userTransactions = this.transactions.get(userId) || [];
    return userTransactions
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(offset, offset + limit);
  }

  /**
   * Get payment summary
   */
  async getPaymentSummary(userId: string): Promise<PaymentSummary> {
    const methods = this.getPaymentMethodsInternal(userId);
    const userTransactions = this.transactions.get(userId) || [];
    const profile = this.consumerGraph.getConsumer(userId);
    const consumerData = profile?.toJSON();

    const defaultMethod = methods.find((m) => m.is_default);

    return {
      methods,
      transactions: userTransactions.slice(0, 10), // Recent transactions
      preferred_method: defaultMethod?.method_id,
      total_spent: consumerData?.transactions.total_spent || 0,
      avg_transaction: consumerData?.transactions.avg_order_value || 0,
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get spending patterns
   */
  async getSpendingPatterns(userId: string): Promise<{
    avg_transaction: number;
    max_transaction: number;
    min_transaction: number;
    total_spent: number;
    transaction_count: number;
    by_payment_method: Record<string, { count: number; total: number }>;
  }> {
    const userTransactions = this.transactions.get(userId) || [];

    if (userTransactions.length === 0) {
      return {
        avg_transaction: 0,
        max_transaction: 0,
        min_transaction: 0,
        total_spent: 0,
        transaction_count: 0,
        by_payment_method: {},
      };
    }

    const amounts = userTransactions.map((t) => t.amount);
    const byPaymentMethod: Record<string, { count: number; total: number }> = {};

    for (const transaction of userTransactions) {
      if (!byPaymentMethod[transaction.payment_method_id]) {
        byPaymentMethod[transaction.payment_method_id] = { count: 0, total: 0 };
      }
      byPaymentMethod[transaction.payment_method_id].count++;
      byPaymentMethod[transaction.payment_method_id].total += transaction.amount;
    }

    return {
      avg_transaction: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      max_transaction: Math.max(...amounts),
      min_transaction: Math.min(...amounts),
      total_spent: amounts.reduce((a, b) => a + b, 0),
      transaction_count: userTransactions.length,
      by_payment_method: byPaymentMethod,
    };
  }

  /**
   * Get payment method usage
   */
  async getPaymentMethodUsage(userId: string): Promise<
    Array<{
      method_id: string;
      type: string;
      provider: string;
      usage_count: number;
      total_amount: number;
      last_used: string;
    }>
  > {
    const userTransactions = this.transactions.get(userId) || [];
    const methods = this.getPaymentMethodsInternal(userId);

    const usageMap: Record<
      string,
      { count: number; total: number; last_used: string }
    > = {};

    for (const transaction of userTransactions) {
      if (!usageMap[transaction.payment_method_id]) {
        usageMap[transaction.payment_method_id] = {
          count: 0,
          total: 0,
          last_used: transaction.timestamp,
        };
      }
      usageMap[transaction.payment_method_id].count++;
      usageMap[transaction.payment_method_id].total += transaction.amount;
      if (transaction.timestamp > usageMap[transaction.payment_method_id].last_used) {
        usageMap[transaction.payment_method_id].last_used = transaction.timestamp;
      }
    }

    return methods.map((method) => ({
      method_id: method.method_id,
      type: method.type,
      provider: method.provider,
      usage_count: usageMap[method.method_id]?.count || 0,
      total_amount: usageMap[method.method_id]?.total || 0,
      last_used: usageMap[method.method_id]?.last_used || '',
    }));
  }

  // ============================================
  // FRAUD DETECTION HELPERS
  // ============================================

  /**
   * Check for unusual payment patterns
   */
  async checkForAnomalies(userId: string): Promise<{
    is_anomalous: boolean;
    reasons: string[];
    risk_score: number;
  }> {
    const userTransactions = this.transactions.get(userId) || [];
    const reasons: string[] = [];
    let riskScore = 0;

    if (userTransactions.length < 3) {
      return { is_anomalous: false, reasons: [], risk_score: 0 };
    }

    // Check for high value transactions
    const amounts = userTransactions.map((t) => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const recentTransactions = userTransactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    for (const transaction of recentTransactions) {
      if (transaction.amount > avgAmount * 5) {
        reasons.push('High value transaction detected');
        riskScore += 0.3;
        break;
      }
    }

    // Check for new payment method
    const methods = this.getPaymentMethodsInternal(userId);
    for (const transaction of recentTransactions) {
      const method = methods.find((m) => m.method_id === transaction.payment_method_id);
      if (method) {
        const daysSinceAdded =
          (Date.now() - new Date(method.added_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceAdded < 1 && transaction.amount > 100) {
          reasons.push('New payment method used for large transaction');
          riskScore += 0.4;
        }
      }
    }

    // Check for multiple transactions in short time
    if (recentTransactions.length >= 3) {
      const timeDiffs = [];
      for (let i = 0; i < recentTransactions.length - 1; i++) {
        timeDiffs.push(
          new Date(recentTransactions[i].timestamp).getTime() -
            new Date(recentTransactions[i + 1].timestamp).getTime()
        );
      }
      const avgTimeDiff =
        timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length / (1000 * 60);
      if (avgTimeDiff < 5 && recentTransactions.some((t) => t.amount > 50)) {
        reasons.push('Multiple rapid transactions detected');
        riskScore += 0.3;
      }
    }

    return {
      is_anomalous: riskScore > 0.5,
      reasons,
      risk_score: Math.min(1, riskScore),
    };
  }
}
