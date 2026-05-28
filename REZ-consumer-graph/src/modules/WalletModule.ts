/**
 * WalletModule - Unified Wallet Management
 * Aggregates wallet balances across all REZ platforms
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import { ConsumerGraph } from '../ConsumerGraph';
import { WalletType, LinkedWallet, WalletTransaction } from '../types';

export interface WalletSummary {
  wallets: LinkedWallet[];
  total_points_value: number;
  total_cash_value: number;
  last_transaction: string;
}

export interface TransactionResult {
  success: boolean;
  transaction_id?: string;
  new_balance?: number;
  error?: string;
}

export class WalletModule {
  private consumerGraph: ConsumerGraph;
  private httpClient: AxiosInstance;
  private logger: winston.Logger;
  private localTransactions: Map<string, WalletTransaction[]>;

  constructor(consumerGraph: ConsumerGraph, baseUrl: string) {
    this.consumerGraph = consumerGraph;
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
    this.localTransactions = new Map();
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

    this.logger.info('WalletModule initialized');
  }

  // ============================================
  // WALLET MANAGEMENT
  // ============================================

  /**
   * Get wallet summary for consumer
   */
  async getWalletSummary(userId: string): Promise<WalletSummary | null> {
    try {
      // Try to get from wallet service
      const response = await this.httpClient.get(`/wallets/summary/${userId}`);
      const wallets: LinkedWallet[] = response.data.wallets || [];

      return {
        wallets,
        total_points_value: wallets
          .filter((w) => w.type === 'points')
          .reduce((sum, w) => sum + w.balance, 0),
        total_cash_value: wallets
          .filter((w) => w.type === 'cash')
          .reduce((sum, w) => sum + w.balance, 0),
        last_transaction: response.data.last_transaction || new Date().toISOString(),
      };
    } catch (error) {
      // Fall back to local data
      this.logger.warn('Failed to fetch wallet summary from service, using local data', {
        userId,
        error,
      });
      return this.getLocalWalletSummary(userId);
    }
  }

  private async getLocalWalletSummary(userId: string): Promise<WalletSummary | null> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return null;

    const consumerData = profile.toJSON();
    const wallets = consumerData.wallets || [];

    return {
      wallets,
      total_points_value: wallets
        .filter((w) => w.type === 'points')
        .reduce((sum, w) => sum + w.balance, 0),
      total_cash_value: wallets
        .filter((w) => w.type === 'cash')
        .reduce((sum, w) => sum + w.balance, 0),
      last_transaction: consumerData.updated_at,
    };
  }

  /**
   * Get specific wallet balance
   */
  async getWalletBalance(userId: string, type: WalletType): Promise<number | null> {
    const summary = await this.getWalletSummary(userId);
    const wallet = summary?.wallets.find((w) => w.type === type);
    return wallet?.balance ?? null;
  }

  /**
   * Add wallet to consumer
   */
  async addWallet(
    userId: string,
    type: WalletType,
    initialBalance: number = 0,
    address?: string
  ): Promise<boolean> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) {
      this.logger.error('Consumer not found', { userId });
      return false;
    }

    // Check if wallet already exists
    const existingWallet = profile.getWallet(type);
    if (existingWallet) {
      this.logger.warn('Wallet already exists', { userId, type });
      return false;
    }

    // Add wallet to profile
    profile.addWallet(type, initialBalance, address);

    // Sync with wallet service
    try {
      await this.httpClient.post('/wallets', {
        user_id: userId,
        type,
        balance: initialBalance,
        address,
      });
    } catch (error) {
      this.logger.warn('Failed to sync wallet to service', { userId, type, error });
    }

    this.logger.info('Wallet added', { userId, type, balance: initialBalance });
    return true;
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  /**
   * Credit wallet
   */
  async credit(
    userId: string,
    type: WalletType,
    amount: number,
    source: string,
    description: string
  ): Promise<TransactionResult> {
    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) {
      return { success: false, error: 'Consumer not found' };
    }

    // Create transaction record
    const transaction: WalletTransaction = {
      id: `${crypto.randomUUID()}`,
      wallet_type: type,
      amount,
      type: 'credit',
      source,
      description,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };

    // Update local balance
    const wallet = profile.getWallet(type);
    const newBalance = (wallet?.balance || 0) + amount;
    profile.updateWalletBalance(type, newBalance);

    // Store transaction
    this.storeTransaction(userId, transaction);

    // Sync with wallet service
    try {
      await this.httpClient.post('/transactions/credit', {
        user_id: userId,
        wallet_type: type,
        amount,
        source,
        description,
        transaction_id: transaction.id,
      });
    } catch (error) {
      this.logger.warn('Failed to sync credit transaction to service', { error });
    }

    this.logger.info('Wallet credited', { userId, type, amount, newBalance });
    return {
      success: true,
      transaction_id: transaction.id,
      new_balance: newBalance,
    };
  }

  /**
   * Debit wallet
   */
  async debit(
    userId: string,
    type: WalletType,
    amount: number,
    source: string,
    description: string
  ): Promise<TransactionResult> {
    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) {
      return { success: false, error: 'Consumer not found' };
    }

    // Check balance
    const wallet = profile.getWallet(type);
    if (!wallet || wallet.balance < amount) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Create transaction record
    const transaction: WalletTransaction = {
      id: `${crypto.randomUUID()}`,
      wallet_type: type,
      amount,
      type: 'debit',
      source,
      description,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };

    // Update local balance
    const newBalance = wallet.balance - amount;
    profile.updateWalletBalance(type, newBalance);

    // Store transaction
    this.storeTransaction(userId, transaction);

    // Sync with wallet service
    try {
      await this.httpClient.post('/transactions/debit', {
        user_id: userId,
        wallet_type: type,
        amount,
        source,
        description,
        transaction_id: transaction.id,
      });
    } catch (error) {
      this.logger.warn('Failed to sync debit transaction to service', { error });
    }

    this.logger.info('Wallet debited', { userId, type, amount, newBalance });
    return {
      success: true,
      transaction_id: transaction.id,
      new_balance: newBalance,
    };
  }

  /**
   * Transfer between wallets
   */
  async transfer(
    userId: string,
    fromType: WalletType,
    toType: WalletType,
    amount: number,
    description: string
  ): Promise<TransactionResult> {
    // Debit from source
    const debitResult = await this.debit(userId, fromType, amount, 'internal', `Transfer to ${toType}`);
    if (!debitResult.success) {
      return debitResult;
    }

    // Credit to destination
    const creditResult = await this.credit(userId, toType, amount, 'internal', `Transfer from ${fromType}`);
    if (!creditResult.success) {
      // Rollback debit
      await this.credit(userId, fromType, amount, 'internal', 'Transfer rollback');
      return { success: false, error: 'Transfer failed, rollback completed' };
    }

    return {
      success: true,
      transaction_id: creditResult.transaction_id,
      new_balance: creditResult.new_balance,
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: string,
    type?: WalletType,
    limit: number = 50
  ): Promise<WalletTransaction[]> {
    const transactions = this.localTransactions.get(userId) || [];

    let filtered = transactions;
    if (type) {
      filtered = transactions.filter((t) => t.wallet_type === type);
    }

    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // ============================================
  // HELPERS
  // ============================================

  private storeTransaction(userId: string, transaction: WalletTransaction): void {
    if (!this.localTransactions.has(userId)) {
      this.localTransactions.set(userId, []);
    }
    this.localTransactions.get(userId)!.push(transaction);
  }

  /**
   * Convert points to cash value
   */
  calculatePointsValue(points: number, rate: number = 0.01): number {
    return points * rate;
  }

  /**
   * Get total wallet value across all types
   */
  async getTotalValue(userId: string): Promise<number> {
    const summary = await this.getWalletSummary(userId);
    if (!summary) return 0;

    // Points at 1 cent each, cash at face value
    return summary.total_points_value * 0.01 + summary.total_cash_value;
  }
}
