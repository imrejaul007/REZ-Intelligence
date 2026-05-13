import { TransactionContext } from './fraudDetector';
import { IRiskProfile } from '../models/RiskProfile';
import { FraudPatternType, FraudPattern } from '../config/patterns';
export interface PatternMatch {
    patternType: FraudPatternType;
    pattern: FraudPattern;
    score: number;
    confidence: number;
    evidence: Record<string, unknown>;
    context: Record<string, unknown>;
    riskFactors: string[];
}
export declare class PatternMatcher {
    analyze(context: TransactionContext, riskProfile: IRiskProfile | null): Promise<PatternMatch[]>;
    private checkCardTesting;
    private checkImpossibleTravel;
    private checkBillingShippingMismatch;
    private checkNewDeviceAnomaly;
    private checkUnusualAmount;
    private checkBotBehavior;
    private checkGeoAnomaly;
    private checkSessionAnomaly;
    private calculateDistance;
    private toRad;
    private isFreightForwarderCity;
    private isSuspiciousUserAgent;
    private isKnownVPNRange;
}
//# sourceMappingURL=patternMatcher.d.ts.map