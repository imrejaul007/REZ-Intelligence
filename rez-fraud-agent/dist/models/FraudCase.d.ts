import mongoose, { Document } from 'mongoose';
export declare enum FraudCaseStatus {
    OPEN = "OPEN",
    UNDER_REVIEW = "UNDER_REVIEW",
    CONFIRMED = "CONFIRMED",
    FALSE_POSITIVE = "FALSE_POSITIVE",
    RESOLVED = "RESOLVED",
    ESCALATED = "ESCALATED"
}
export declare enum FraudCaseSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export interface IFraudPatternMatch {
    patternType: string;
    patternName: string;
    matchedAt: Date;
    score: number;
    evidence: Record<string, unknown>;
}
export interface IFraudCase extends Document {
    caseId: string;
    userId?: string;
    accountId?: string;
    transactionId?: string;
    orderId?: string;
    status: FraudCaseStatus;
    severity: FraudCaseSeverity;
    riskScore: number;
    detectedPatterns: IFraudPatternMatch[];
    riskFactors: string[];
    indicators: Record<string, unknown>;
    evidence: {
        transactions: Array<Record<string, unknown>>;
        deviceInfo?: Record<string, unknown>;
        locationInfo?: Record<string, unknown>;
        behavioralData?: Record<string, unknown>;
        sessionData?: Record<string, unknown>;
    };
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date;
    assignedTo?: string;
    reviewedBy?: string;
    reviewNotes?: string;
    actionsTaken: Array<{
        action: string;
        timestamp: Date;
        performedBy?: string;
        details?: string;
    }>;
    blockedAmount?: number;
    preventedLoss?: number;
    source: 'AUTOMATED' | 'MANUAL' | 'EXTERNAL';
    externalReference?: string;
}
export declare const FraudCase: mongoose.Model<IFraudCase, {}, {}, {}, mongoose.Document<unknown, {}, IFraudCase, {}, {}> & IFraudCase & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare function generateFraudCaseId(): string;
//# sourceMappingURL=FraudCase.d.ts.map