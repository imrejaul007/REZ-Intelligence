import { BaseConnector } from './baseConnector';
import type {
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  WalletBalanceResult,
  WalletTransactionResult,
  HttpResponse,
} from '../types';

// ============================================================================
// Wallet Service Types
// ============================================================================

export interface CreditRequest {
  userId: string;
  amount: number;
  type?: 'credit' | 'cashback' | 'refund' | 'reversal';
  description?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface DebitRequest {
  userId: string;
  amount: number;
  type?: 'debit' | 'payment' | 'withdrawal';
  description?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface WalletTransactionListResult {
  transactions: WalletTransactionResult[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WalletSummaryResult {
  userId: string;
  totalCredits: number;
  totalDebits: number;
  totalRefunds: number;
  totalCashback: number;
  transactionCount: number;
  currency: string;
}

// ============================================================================
// Wallet Connector
// ============================================================================

export class WalletConnector extends BaseConnector {
  constructor(
    baseUrl: string,
    authToken: string,
    options: {
      logger?: Logger;
      timeout?: number;
      retry?: RetryOptions;
      circuitBreaker?: CircuitBreakerOptions;
    } = {},
  ) {
    super('wallet-service', baseUrl, authToken, options);
  }

  /**
   * Get wallet balance for a user
   */
  async getBalance(userId: string): Promise<WalletBalanceResult> {
    this.logger.debug('Getting wallet balance', { userId });

    const response = await this.get<WalletBalanceResult>(`/wallets/${userId}/balance`);
    return response.data;
  }

  /**
   * Get wallet summary (credits, debits, etc.)
   */
  async getSummary(userId: string): Promise<WalletSummaryResult> {
    this.logger.debug('Getting wallet summary', { userId });

    const response = await this.get<WalletSummaryResult>(`/wallets/${userId}/summary`);
    return response.data;
  }

  /**
   * Credit wallet
   */
  async credit(request: CreditRequest): Promise<WalletTransactionResult> {
    this.logger.info('Crediting wallet', {
      userId: request.userId,
      amount: request.amount,
      type: request.type,
    });

    const response = await this.post<WalletTransactionResult>('/wallets/credit', request);
    this.logger.info('Wallet credited successfully', {
      transactionId: response.data.transactionId,
      userId: request.userId,
    });
    return response.data;
  }

  /**
   * Debit wallet
   */
  async debit(request: DebitRequest): Promise<WalletTransactionResult> {
    this.logger.info('Debiting wallet', {
      userId: request.userId,
      amount: request.amount,
      type: request.type,
    });

    const response = await this.post<WalletTransactionResult>('/wallets/debit', request);
    this.logger.info('Wallet debited successfully', {
      transactionId: response.data.transactionId,
      userId: request.userId,
    });
    return response.data;
  }

  /**
   * Transfer between wallets
   */
  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    description?: string,
  ): Promise<{ debitTransaction: WalletTransactionResult; creditTransaction: WalletTransactionResult }> {
    this.logger.info('Transferring between wallets', {
      fromUserId,
      toUserId,
      amount,
    });

    const response = await this.post<{
      debitTransaction: WalletTransactionResult;
      creditTransaction: WalletTransactionResult;
    }>('/wallets/transfer', {
      fromUserId,
      toUserId,
      amount,
      description,
    });

    this.logger.info('Wallet transfer completed', {
      debitTransactionId: response.data.debitTransaction.transactionId,
      creditTransactionId: response.data.creditTransaction.transactionId,
    });

    return response.data;
  }

  /**
   * Get transaction history
   */
  async getTransactions(
    userId: string,
    options?: {
      page?: number;
      pageSize?: number;
      type?: string;
      fromDate?: string;
      toDate?: string;
      reference?: string;
    },
  ): Promise<WalletTransactionListResult> {
    this.logger.debug('Getting transaction history', { userId, options });

    const params: Record<string, string> = {};

    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.type) params.type = options.type;
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;
    if (options?.reference) params.reference = options.reference;

    const response = await this.get<WalletTransactionListResult>(
      `/wallets/${userId}/transactions`,
      params,
    );
    return response.data;
  }

  /**
   * Get specific transaction
   */
  async getTransaction(transactionId: string): Promise<WalletTransactionResult> {
    this.logger.debug('Getting transaction', { transactionId });

    const response = await this.get<WalletTransactionResult>(`/transactions/${transactionId}`);
    return response.data;
  }

  /**
   * Reverse a transaction
   */
  async reverseTransaction(
    transactionId: string,
    reason?: string,
  ): Promise<WalletTransactionResult> {
    this.logger.info('Reversing transaction', { transactionId, reason });

    const response = await this.post<WalletTransactionResult>(`/transactions/${transactionId}/reverse`, {
      reason,
    });
    this.logger.info('Transaction reversed', { transactionId });
    return response.data;
  }

  /**
   * Check if user has sufficient balance
   */
  async hasSufficientBalance(
    userId: string,
    amount: number,
  ): Promise<{ hasBalance: boolean; currentBalance: number }> {
    this.logger.debug('Checking balance', { userId, amount });

    const response = await this.post<{ hasBalance: boolean; currentBalance: number }>(
      `/wallets/${userId}/check-balance`,
      { amount },
    );
    return response.data;
  }

  /**
   * Freeze wallet amount
   */
  async freezeAmount(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<WalletTransactionResult> {
    this.logger.info('Freezing wallet amount', { userId, amount, reason });

    const response = await this.post<WalletTransactionResult>(`/wallets/${userId}/freeze`, {
      amount,
      reason,
    });
    return response.data;
  }

  /**
   * Unfreeze wallet amount
   */
  async unfreezeAmount(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<WalletTransactionResult> {
    this.logger.info('Unfreezing wallet amount', { userId, amount, reason });

    const response = await this.post<WalletTransactionResult>(`/wallets/${userId}/unfreeze`, {
      amount,
      reason,
    });
    return response.data;
  }

  /**
   * Create or activate wallet for user
   */
  async ensureWallet(userId: string): Promise<WalletBalanceResult> {
    this.logger.debug('Ensuring wallet exists', { userId });

    const response = await this.post<WalletBalanceResult>('/wallets', { userId });
    return response.data;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createWalletConnector(
  baseUrl: string,
  authToken: string,
  options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
  },
): WalletConnector {
  return new WalletConnector(baseUrl, authToken, options);
}
