import { RiskLevel, IRiskProfile } from '../models/RiskProfile';
import { TransactionContext } from './fraudDetector';
import { VelocityCheckResult } from './velocityCheck';
import { TransactionMonitorResult } from './transactionMonitor';
export interface RiskScoreInput {
    baseScore: number;
    patterns: Array<{
        type: string;
        score: number;
    }>;
    velocityResult: VelocityCheckResult;
    transactionMonitorResult: TransactionMonitorResult;
    context: TransactionContext;
    riskProfile: IRiskProfile | null;
}
export interface RiskScoreBreakdown {
    totalScore: number;
    components: {
        patternScore: number;
        velocityScore: number;
        behavioralScore: number;
        historicalScore: number;
        contextualScore: number;
    };
    factors: string[];
    recommendations: string[];
}
export declare class RiskScorer {
    private readonly WEIGHTS;
    calculateScore(input: RiskScoreInput): Promise<number>;
    calculateBreakdown(input: RiskScoreInput): Promise<RiskScoreBreakdown>;
    getRiskLevel(score: number): RiskLevel;
    private analyzeBehavioralFactors;
    private analyzeHistoricalFactors;
    private analyzeContextualFactors;
}
//# sourceMappingURL=riskScorer.d.ts.map