import { RedisClientType } from 'redis';
import { TransactionContext } from './fraudDetector';
export interface TransactionAnomaly {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    score: number;
    metadata?: Record<string, unknown>;
}
export interface TransactionMonitorResult {
    isAnomalous: boolean;
    anomalies: TransactionAnomaly[];
    overallScore: number;
}
export declare class TransactionMonitor {
    private redis;
    private readonly KEYS;
    constructor(redis?: RedisClientType);
    setRedisClient(redis: RedisClientType): Promise<void>;
    monitor(context: TransactionContext): Promise<TransactionMonitorResult>;
    private checkFailedAttempts;
    private checkAmountPatterns;
    private checkLocationPatterns;
    private checkMerchantPatterns;
    recordFailedAttempt(userId: string): Promise<void>;
    clearFailedAttempts(userId: string): Promise<void>;
}
//# sourceMappingURL=transactionMonitor.d.ts.map