import { BaseConnector } from './baseConnector';
import type { Logger, RetryOptions, CircuitBreakerOptions, WalletBalanceResult, WalletTransactionResult } from '../types';
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
export declare class WalletConnector extends BaseConnector {
    constructor(baseUrl: string, authToken: string, options?: {
        logger?: Logger;
        timeout?: number;
        retry?: RetryOptions;
        circuitBreaker?: CircuitBreakerOptions;
    });
    /**
     * Get wallet balance for a user
     */
    getBalance(userId: string): Promise<WalletBalanceResult>;
    /**
     * Get wallet summary (credits, debits, etc.)
     */
    getSummary(userId: string): Promise<WalletSummaryResult>;
    /**
     * Credit wallet
     */
    credit(request: CreditRequest): Promise<WalletTransactionResult>;
    /**
     * Debit wallet
     */
    debit(request: DebitRequest): Promise<WalletTransactionResult>;
    /**
     * Transfer between wallets
     */
    transfer(fromUserId: string, toUserId: string, amount: number, description?: string): Promise<{
        debitTransaction: WalletTransactionResult;
        creditTransaction: WalletTransactionResult;
    }>;
    /**
     * Get transaction history
     */
    getTransactions(userId: string, options?: {
        page?: number;
        pageSize?: number;
        type?: string;
        fromDate?: string;
        toDate?: string;
        reference?: string;
    }): Promise<WalletTransactionListResult>;
    /**
     * Get specific transaction
     */
    getTransaction(transactionId: string): Promise<WalletTransactionResult>;
    /**
     * Reverse a transaction
     */
    reverseTransaction(transactionId: string, reason?: string): Promise<WalletTransactionResult>;
    /**
     * Check if user has sufficient balance
     */
    hasSufficientBalance(userId: string, amount: number): Promise<{
        hasBalance: boolean;
        currentBalance: number;
    }>;
    /**
     * Freeze wallet amount
     */
    freezeAmount(userId: string, amount: number, reason: string): Promise<WalletTransactionResult>;
    /**
     * Unfreeze wallet amount
     */
    unfreezeAmount(userId: string, amount: number, reason: string): Promise<WalletTransactionResult>;
    /**
     * Create or activate wallet for user
     */
    ensureWallet(userId: string): Promise<WalletBalanceResult>;
}
export declare function createWalletConnector(baseUrl: string, authToken: string, options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
}): WalletConnector;
//# sourceMappingURL=wallet.d.ts.map