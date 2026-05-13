import { BlacklistType, BlacklistReason, BlacklistSeverity, IBlacklistEntry } from '../models/Blacklist';
export interface BlacklistCheckResult {
    isBlacklisted: boolean;
    entry?: IBlacklistEntry;
    type?: BlacklistType;
    value?: string;
}
export interface BlacklistAddResult {
    success: boolean;
    entry?: IBlacklistEntry;
    error?: string;
}
export declare class BlacklistService {
    check(type: BlacklistType, value: string): Promise<BlacklistCheckResult>;
    add(data: {
        type: BlacklistType;
        value: string;
        reason: BlacklistReason;
        severity?: BlacklistSeverity;
        userId?: string;
        transactionId?: string;
        fraudCaseId?: string;
        addedBy: string;
        isPermanent?: boolean;
        expiresAt?: Date;
        notes?: string;
        details?: {
            description?: string;
            evidence?: Record<string, unknown>;
        };
    }): Promise<BlacklistAddResult>;
    remove(type: BlacklistType, value: string, removedBy: string): Promise<boolean>;
    list(options: {
        type?: BlacklistType;
        reason?: BlacklistReason;
        severity?: BlacklistSeverity;
        isActive?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{
        entries: IBlacklistEntry[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getStats(): Promise<{
        total: number;
        active: number;
        byType: Record<string, number>;
        byReason: Record<string, number>;
        bySeverity: Record<string, number>;
    }>;
    isIPBlocked(ip: string): Promise<BlacklistCheckResult>;
    isDeviceBlocked(fingerprint: string): Promise<BlacklistCheckResult>;
    isUserBlocked(userId: string): Promise<BlacklistCheckResult>;
    isAccountBlocked(accountId: string): Promise<BlacklistCheckResult>;
    blockIP(ip: string, reason: BlacklistReason, addedBy: string, options?: {
        expiresAt?: Date;
        notes?: string;
    }): Promise<BlacklistAddResult>;
    blockDevice(fingerprint: string, reason: BlacklistReason, addedBy: string, options?: {
        userId?: string;
        expiresAt?: Date;
        notes?: string;
    }): Promise<BlacklistAddResult>;
}
//# sourceMappingURL=blacklistService.d.ts.map