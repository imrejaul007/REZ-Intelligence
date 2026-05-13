import mongoose, { Document } from 'mongoose';
export declare enum BlacklistType {
    IP_ADDRESS = "IP_ADDRESS",
    DEVICE_FINGERPRINT = "DEVICE_FINGERPRINT",
    EMAIL = "EMAIL",
    PHONE = "PHONE",
    CARD_HASH = "CARD_HASH",
    IBAN = "IBAN",
    ACCOUNT = "ACCOUNT",
    USER = "USER",
    MERCHANT = "MERCHANT",
    VELOCITY_GROUP = "VELOCITY_GROUP"
}
export declare enum BlacklistReason {
    FRAUD_CONFIRMED = "FRAUD_CONFIRMED",
    CHARGEBACK = "CHARGEBACK",
    REFUND_ABUSE = "REFUND_ABUSE",
    POLICY_VIOLATION = "POLICY_VIOLATION",
    VELOCITY_VIOLATION = "VELOCITY_VIOLATION",
    CARD_TESTING = "CARD_TESTING",
    BOT_ACTIVITY = "BOT_ACTIVITY",
    MANUAL_REVIEW = "MANUAL_REVIEW",
    ACCOUNT_TAKEOVER = "ACCOUNT_TAKEOVER",
    TEST_ACCOUNT = "TEST_ACCOUNT",
    OTHER = "OTHER"
}
export declare enum BlacklistSeverity {
    WARN = "WARN",
    BLOCK = "BLOCK",
    INVESTIGATE = "INVESTIGATE"
}
export interface IBlacklistEntry extends Document {
    entryId: string;
    type: BlacklistType;
    value: string;
    reason: BlacklistReason;
    severity: BlacklistSeverity;
    userId?: string;
    transactionId?: string;
    orderId?: string;
    fraudCaseId?: string;
    details: {
        description?: string;
        evidence?: Record<string, unknown>;
        relatedEntries?: string[];
        firstOccurrence?: Date;
        occurrenceCount?: number;
    };
    expiresAt?: Date;
    isPermanent: boolean;
    addedBy: string;
    addedAt: Date;
    updatedAt: Date;
    lastMatchedAt?: Date;
    matchCount: number;
    isActive: boolean;
    notes?: string;
    recordMatch(): Promise<void>;
}
interface IBlacklistEntryModel extends mongoose.Model<IBlacklistEntry> {
    isBlacklisted(type: BlacklistType, value: string): Promise<{
        isBlacklisted: boolean;
        entry?: IBlacklistEntry;
    }>;
    addToBlacklist(data: {
        type: BlacklistType;
        value: string;
        reason: BlacklistReason;
        severity?: BlacklistSeverity;
        userId?: string;
        transactionId?: string;
        orderId?: string;
        fraudCaseId?: string;
        addedBy: string;
        isPermanent?: boolean;
        expiresAt?: Date;
        notes?: string;
    }): Promise<IBlacklistEntry>;
    paginate(query: {
        type?: BlacklistType;
        reason?: BlacklistReason;
        severity?: BlacklistSeverity;
        isActive?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{
        docs: IBlacklistEntry[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
}
export declare const BlacklistEntry: IBlacklistEntryModel;
export declare function generateBlacklistEntryId(): string;
export {};
//# sourceMappingURL=Blacklist.d.ts.map