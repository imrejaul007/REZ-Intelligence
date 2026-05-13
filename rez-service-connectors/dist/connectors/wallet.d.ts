/**
 * Wallet Service Connector
 *
 * Connects to rez-wallet-service (Port 4002) for wallet operations,
 * balance management, credits, and debits.
 */
import { ServiceClient, ClientConfig } from '../utils/client';
import type { WalletBalance, CreditRequest, DebitRequest, CoinType, ServiceResponse, PaginationParams, PaginatedResponse } from '../types';
/**
 * Wallet Connector Configuration
 */
interface WalletConfig extends ClientConfig {
    baseUrl: string;
    internalToken: string;
}
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
export declare class WalletConnector extends ServiceClient {
    private config;
    constructor(config?: Partial<WalletConfig>);
    /**
     * Get wallet balance
     *
     * Returns the user's wallet balance across all coin types.
     *
     * @param userId - The user's ID
     * @returns Wallet balance information
     */
    getBalance(userId: string): Promise<WalletBalance>;
    /**
     * Credit wallet
     *
     * Adds funds to a user's wallet.
     * Supports idempotency to prevent duplicate credits.
     *
     * @param request - Credit parameters
     * @returns Credit result with transaction details
     */
    credit(request: CreditRequest): Promise<ServiceResponse>;
    /**
     * Debit wallet
     *
     * Removes funds from authenticated user's wallet.
     * Requires user authentication (handled by the wallet service).
     *
     * @param request - Debit parameters
     * @returns Debit result with transaction details
     */
    debit(request: DebitRequest): Promise<ServiceResponse>;
    /**
     * Topup wallet via payment
     *
     * Initiates a wallet topup using external payment method.
     *
     * @param request - Topup parameters
     * @returns Topup initiation result
     */
    topup(request: TopupRequest): Promise<ServiceResponse>;
    /**
     * Payout to bank account
     *
     * Initiates a withdrawal to user's bank account.
     *
     * @param request - Payout parameters
     * @returns Payout result
     */
    payout(request: PayoutRequest): Promise<ServiceResponse>;
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
    listTransactions(userId: string, params?: PaginationParams, coinType?: CoinType): Promise<PaginatedResponse<TransactionRecord>>;
    /**
     * Get transaction by ID
     *
     * @param transactionId - The transaction ID
     * @returns Transaction details
     */
    getTransaction(transactionId: string): Promise<ServiceResponse>;
    /**
     * Get conversion rate
     *
     * Returns current coin to INR conversion rate.
     *
     * @param coinType - The coin type
     * @returns Conversion rate
     */
    getConversionRate(coinType: CoinType): Promise<{
        rate: number;
        coinType: CoinType;
    }>;
    /**
     * Health check for wallet service
     *
     * @returns Health status
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency?: number;
    }>;
}
export declare function getWalletConnector(config?: Partial<WalletConfig>): WalletConnector;
export default WalletConnector;
//# sourceMappingURL=wallet.d.ts.map