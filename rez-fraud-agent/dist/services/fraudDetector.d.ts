import { RiskLevel } from '../models/RiskProfile';
import { FraudPatternType } from '../config/patterns';
export interface TransactionContext {
    transactionId: string;
    userId?: string;
    accountId?: string;
    orderId?: string;
    amount: number;
    currency: string;
    merchantCategory?: string;
    merchantId?: string;
    deviceFingerprint?: string;
    deviceType?: string;
    userAgent?: string;
    ipAddress?: string;
    billingCountry?: string;
    billingCity?: string;
    shippingCountry?: string;
    shippingCity?: string;
    shippingCoordinates?: [number, number];
    billingCoordinates?: [number, number];
    sessionId?: string;
    sessionDuration?: number;
    pageViews?: number;
    navigationPattern?: string[];
    cardLast4?: string;
    cardType?: string;
    isNewPaymentMethod?: boolean;
    accountAge?: number;
    isVerified?: boolean;
    twoFactorEnabled?: boolean;
}
export interface FraudDetectionResult {
    decision: 'ALLOW' | 'DENY' | 'CHALLENGE' | 'REVIEW';
    riskScore: number;
    riskLevel: RiskLevel;
    detectedPatterns: Array<{
        type: FraudPatternType;
        name: string;
        score: number;
        evidence: Record<string, unknown>;
    }>;
    riskFactors: string[];
    tone: string;
    message: string;
    caseId?: string;
    requiresAction: boolean;
    processingTimeMs: number;
    metadata: Record<string, unknown>;
}
export declare class FraudDetector {
    private riskScorer;
    private transactionMonitor;
    private patternMatcher;
    private velocityCheck;
    private blacklistService;
    constructor();
    analyzeTransaction(context: TransactionContext): Promise<FraudDetectionResult>;
    private checkBlacklists;
    private makeDecision;
    private createFraudCase;
    private mapRiskScoreToSeverity;
    private formatResponseMessage;
    private createResult;
}
//# sourceMappingURL=fraudDetector.d.ts.map