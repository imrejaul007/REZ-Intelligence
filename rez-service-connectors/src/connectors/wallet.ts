/**
 * Wallet Service Connector
 *
 * Connects to rez-wallet-service (Port 4002) for wallet operations,
 * balance management, credits, and debits.
 */

import { ServiceClient, ClientConfig } from '../utils/client';
import type {
  WalletBalance,
  CreditRequest,
  DebitRequest,
  CoinType,
  ServiceResponse,
  PaginationParams,
  PaginatedResponse,
} from '../types';

/**
 * Wallet Connector Configuration
 */
interface WalletConfig extends ClientConfig {
  baseUrl: string;
  internalToken: string;
}

const DEFAULT_CONFIG: Partial<WalletConfig> = {
  timeout: 30000,
  maxRetries: 3,
};

export interface TransactionRecord {
  transactionId: string;
  type: 'credit' | 'debit';
  amount: number;
  coinType: CoinType;
  source: string;
  description?: string;
  balanceAfter: number;
  createdAt: string;
}

export interface PayoutRequest {
  userId: string;
  amount: number;
  bankAccount: {
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
  };
  purpose?: string;
  idempotencyKey?: string;
}

export interface TopupRequest {
  userId: string;
  amount: number;
  paymentMethod: string;
  razorpayPaymentId?: string;
  idempotencyKey?: string;
}

/**
 * Wallet Connector
 *
 * Provides methods to interact with the wallet service:
 * - Get wallet balance
 * - Credit wallet (add funds)
 * - Debit wallet (remove funds)
 * - List transactions
 * - Payout to bank
 */
export class WalletConnector extends ServiceClient {
  private config: WalletConfig;

  constructor(config: Partial<WalletConfig> = {}) {
    const walletUrl = config.baseUrl || process.env.WALLET_SERVICE_URL || 'http://localhost:4002';
    const internalToken = config.internalToken || getInternalToken();

    const mergedConfig: WalletConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      baseUrl: walletUrl,
      internalToken,
      serviceName: 'wallet-service',
    };

    super(mergedConfig);
    this.config = mergedConfig;
  }

  /**
   * Get wallet balance
   *
   * Returns the user's wallet balance across all coin types.
   *
   * @param userId - The user's ID
   * @returns Wallet balance information
   */
  async getBalance(userId: string): Promise<WalletBalance> {
    return this.safeRequest<WalletBalance>({
      method: 'GET',
      url: `/api/wallet/balance/${userId}`,
    });
  }

  /**
   * Credit wallet
   *
   * Adds funds to a user's wallet.
   * Supports idempotency to prevent duplicate credits.
   *
   * @param request - Credit parameters
   * @returns Credit result with transaction details
   */
  async credit(request: CreditRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'POST',
      url: '/api/wallet/credit',
      data: {
        userId: request.userId,
        amount: request.amount,
        coinType: request.coinType,
        source: request.source,
        description: request.description,
        idempotencyKey: request.idempotencyKey,
      },
    });
  }

  /**
   * Debit wallet
   *
   * Removes funds from authenticated user's wallet.
   * Requires user authentication (handled by the wallet service).
   *
   * @param request - Debit parameters
   * @returns Debit result with transaction details
   */
  async debit(request: DebitRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'POST',
      url: '/api/wallet/debit',
      data: {
        amount: request.amount,
        source: request.source,
        description: request.description,
        idempotencyKey: request.idempotencyKey,
      },
    });
  }

  /**
   * Topup wallet via payment
   *
   * Initiates a wallet topup using external payment method.
   *
   * @param request - Topup parameters
   * @returns Topup initiation result
   */
  async topup(request: TopupRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'POST',
      url: '/api/wallet/topup',
      data: {
        userId: request.userId,
        amount: request.amount,
        paymentMethod: request.paymentMethod,
        razorpayPaymentId: request.razorpayPaymentId,
        idempotencyKey: request.idempotencyKey,
      },
    });
  }

  /**
   * Payout to bank account
   *
   * Initiates a withdrawal to user's bank account.
   *
   * @param request - Payout parameters
   * @returns Payout result
   */
  async payout(request: PayoutRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'POST',
      url: '/api/wallet/payout',
      data: {
        userId: request.userId,
        amount: request.amount,
        bankAccount: request.bankAccount,
        purpose: request.purpose,
        idempotencyKey: request.idempotencyKey,
      },
    });
  }

  /**
   * List transactions
   *
   * Returns paginated transaction history.
   *
   * @param userId - The user's ID
   * @param params - Pagination parameters
   * @param coinType - Optional filter by coin type
   * @returns Paginated transaction list
   */
  async listTransactions(
    userId: string,
    params: PaginationParams = {},
    coinType?: CoinType
  ): Promise<PaginatedResponse<TransactionRecord>> {
    return this.safeRequest<PaginatedResponse<TransactionRecord>>({
      method: 'GET',
      url: `/api/wallet/transactions/${userId}`,
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        offset: params.offset,
        coinType,
      },
    });
  }

  /**
   * Get transaction by ID
   *
   * @param transactionId - The transaction ID
   * @returns Transaction details
   */
  async getTransaction(transactionId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'GET',
      url: `/api/wallet/transactions/detail/${transactionId}`,
    });
  }

  /**
   * Get conversion rate
   *
   * Returns current coin to INR conversion rate.
   *
   * @param coinType - The coin type
   * @returns Conversion rate
   */
  async getConversionRate(coinType: CoinType): Promise<{ rate: number; coinType: CoinType }> {
    return this.safeRequest<{ rate: number; coinType: CoinType }>({
      method: 'GET',
      url: `/api/wallet/conversion-rate/${coinType}`,
    });
  }

  /**
   * Health check for wallet service
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number }> {
    const start = Date.now();
    try {
      await this.client.get('/health');
      return { healthy: true, latency: Date.now() - start };
    } catch {
      return { healthy: false, latency: Date.now() - start };
    }
  }
}

/**
 * Get internal token from environment
 */
function getInternalToken(): string {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
  try {
    const tokens = JSON.parse(tokensJson);
    return tokens.orchestrator || tokens.wallet || '';
  } catch {
    console.warn('[WalletConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return '';
  }
}

// Singleton instance
let walletInstance: WalletConnector | null = null;

export function getWalletConnector(config?: Partial<WalletConfig>): WalletConnector {
  if (!walletInstance) {
    walletInstance = new WalletConnector(config);
  }
  return walletInstance;
}

export default WalletConnector;
