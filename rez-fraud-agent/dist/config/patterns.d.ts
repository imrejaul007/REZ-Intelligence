export declare enum FraudPatternType {
    CARD_TESTING = "CARD_TESTING",
    VELOCITY_ATTACK = "VELOCITY_ATTACK",
    ACCOUNT_TAKEOVER = "ACCOUNT_TAKEOVER",
    IMPOSSIBLE_TRAVEL = "IMPOSSIBLE_TRAVEL",
    BILLING_SHIPPING_MISMATCH = "BILLING_SHIPPING_MISMATCH",
    NEW_DEVICE_ANOMALY = "NEW_DEVICE_ANOMALY",
    UNUSUAL_AMOUNT = "UNUSUAL_AMOUNT",
    HIGH_RISK_MERCHANT = "HIGH_RISK_MERCHANT",
    MULTIPLE_FAILED_ATTEMPTS = "MULTIPLE_FAILED_ATTEMPTS",
    BOT_BEHAVIOR = "BOT_BEHAVIOR",
    VPN_PROXY_USAGE = "VPN_PROXY_USAGE",
    GEO_ANOMALY = "GEO_ANOMALY",
    SESSION_ANOMALY = "SESSION_ANOMALY",
    DEVICE_FINGERPRINT_MISMATCH = "DEVICE_FINGERPRINT_MISMATCH"
}
export interface FraudPattern {
    type: FraudPatternType;
    name: string;
    description: string;
    baseScore: number;
    indicators: string[];
    thresholds: Record<string, number>;
}
export declare const FRAUD_PATTERNS: Record<FraudPatternType, FraudPattern>;
export declare function getPatternScore(patternType: FraudPatternType, context: Record<string, unknown>): number;
export declare function getPatternsByCategory(category: string): FraudPattern[];
//# sourceMappingURL=patterns.d.ts.map