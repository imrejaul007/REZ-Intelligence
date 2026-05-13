"use strict";
/**
 * Wallet Service Connector
 *
 * Connects to rez-wallet-service (Port 4002) for wallet operations,
 * balance management, credits, and debits.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletConnector = void 0;
exports.getWalletConnector = getWalletConnector;
const client_1 = require("../utils/client");
const DEFAULT_CONFIG = {
    timeout: 30000,
    maxRetries: 3,
};
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
class WalletConnector extends client_1.ServiceClient {
    config;
    constructor(config = {}) {
        const walletUrl = config.baseUrl || process.env.WALLET_SERVICE_URL || 'http://localhost:4002';
        const internalToken = config.internalToken || getInternalToken();
        const mergedConfig = {
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
    async getBalance(userId) {
        return this.safeRequest({
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
    async credit(request) {
        return this.safeRequest({
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
    async debit(request) {
        return this.safeRequest({
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
    async topup(request) {
        return this.safeRequest({
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
    async payout(request) {
        return this.safeRequest({
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
    async listTransactions(userId, params = {}, coinType) {
        return this.safeRequest({
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
    async getTransaction(transactionId) {
        return this.safeRequest({
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
    async getConversionRate(coinType) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/wallet/conversion-rate/${coinType}`,
        });
    }
    /**
     * Health check for wallet service
     *
     * @returns Health status
     */
    async healthCheck() {
        const start = Date.now();
        try {
            await this.client.get('/health');
            return { healthy: true, latency: Date.now() - start };
        }
        catch {
            return { healthy: false, latency: Date.now() - start };
        }
    }
}
exports.WalletConnector = WalletConnector;
/**
 * Get internal token from environment
 */
function getInternalToken() {
    const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    try {
        const tokens = JSON.parse(tokensJson);
        return tokens.orchestrator || tokens.wallet || '';
    }
    catch {
        console.warn('[WalletConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
        return '';
    }
}
// Singleton instance
let walletInstance = null;
function getWalletConnector(config) {
    if (!walletInstance) {
        walletInstance = new WalletConnector(config);
    }
    return walletInstance;
}
exports.default = WalletConnector;
//# sourceMappingURL=wallet.js.map