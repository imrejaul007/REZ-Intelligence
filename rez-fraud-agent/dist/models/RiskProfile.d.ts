import mongoose, { Document } from 'mongoose';
export declare enum RiskLevel {
    TRUSTED = "TRUSTED",
    NORMAL = "NORMAL",
    ELEVATED = "ELEVATED",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum AccountStanding {
    GOOD = "GOOD",
    UNDER_REVIEW = "UNDER_REVIEW",
    RESTRICTED = "RESTRICTED",
    SUSPENDED = "SUSPENDED",
    CLOSED = "CLOSED"
}
export interface ITransactionHistory {
    transactionId: string;
    amount: number;
    timestamp: Date;
    merchantCategory: string;
    riskScore: number;
    status: string;
}
export interface ILoginHistory {
    ipAddress: string;
    deviceFingerprint: string;
    userAgent: string;
    location: {
        country: string;
        city?: string;
        coordinates?: [number, number];
    };
    timestamp: Date;
    successful: boolean;
}
export interface IRiskProfile extends Document {
    profileId: string;
    userId: string;
    accountId?: string;
    riskLevel: RiskLevel;
    riskScore: number;
    accountStanding: AccountStanding;
    transactionHistory: ITransactionHistory[];
    loginHistory: ILoginHistory[];
    averageTransactionAmount: number;
    maxTransactionAmount: number;
    usualMerchantCategories: string[];
    usualLocations: Array<{
        country: string;
        city?: string;
        frequency: number;
    }>;
    usualDevices: string[];
    usualIPAddresses: string[];
    totalTransactions: number;
    failedTransactionCount: number;
    chargebackCount: number;
    refundCount: number;
    fraudCaseCount: number;
    usualTransactionHours: number[];
    averageSessionDuration: number;
    isKnownFraudster: boolean;
    isVerifiedAccount: boolean;
    twoFactorEnabled: boolean;
    hasPaymentMethodOnFile: boolean;
    lastTransactionAt?: Date;
    lastLoginAt?: Date;
    lastRiskAssessmentAt?: Date;
    riskFlags: string[];
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RiskProfile: mongoose.Model<IRiskProfile, {}, {}, {}, mongoose.Document<unknown, {}, IRiskProfile, {}, {}> & IRiskProfile & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare function generateProfileId(): string;
//# sourceMappingURL=RiskProfile.d.ts.map