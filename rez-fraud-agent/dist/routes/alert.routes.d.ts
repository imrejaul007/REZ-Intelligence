declare const router: import("express-serve-static-core").Router;
export declare enum AlertSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum AlertChannel {
    WEBHOOK = "WEBHOOK",
    SLACK = "SLACK",
    EMAIL = "EMAIL",
    SMS = "SMS"
}
export interface FraudAlert {
    alertId: string;
    type: 'FRAUD_CASE' | 'VELOCITY_VIOLATION' | 'BLACKLIST_MATCH' | 'HIGH_RISK_TRANSACTION';
    severity: AlertSeverity;
    timestamp: Date;
    data: {
        fraudCaseId?: string;
        transactionId?: string;
        userId?: string;
        riskScore?: number;
        decision?: string;
        patterns?: string[];
        message: string;
    };
    channels: AlertChannel[];
    status: 'PENDING' | 'SENT' | 'FAILED';
    sentAt?: Date;
    retryCount: number;
}
export default router;
//# sourceMappingURL=alert.routes.d.ts.map