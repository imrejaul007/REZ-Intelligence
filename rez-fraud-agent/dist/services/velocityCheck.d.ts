import { RedisClientType } from 'redis';
import { TransactionContext } from './fraudDetector';
export interface VelocityCheckResult {
    isViolation: boolean;
    score: number;
    violationType?: string;
    evidence: Record<string, unknown>;
    riskFactors: string[];
    details: {
        transactionsPerMinute: number;
        transactionsPerHour: number;
        transactionsPerDay: number;
        maxAllowedPerMinute: number;
        maxAllowedPerHour: number;
        maxAllowedPerDay: number;
    };
}
export declare class VelocityCheck {
    private redis;
    private readonly THRESHOLDS;
    constructor(redis?: RedisClientType);
    setRedisClient(redis: RedisClientType): Promise<void>;
    check(context: TransactionContext): Promise<VelocityCheckResult>;
    private checkWindow;
    private recordTransaction;
    getVelocityStats(userId: string): Promise<{
        perMinute: number;
        perHour: number;
        perDay: number;
        recentTransactions: number[];
    }>;
    resetVelocity(userId: string): Promise<void>;
    checkIPVelocity(ipAddress: string): Promise<VelocityCheckResult>;
}
//# sourceMappingURL=velocityCheck.d.ts.map