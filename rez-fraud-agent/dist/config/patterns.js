"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRAUD_PATTERNS = exports.FraudPatternType = void 0;
exports.getPatternScore = getPatternScore;
exports.getPatternsByCategory = getPatternsByCategory;
var FraudPatternType;
(function (FraudPatternType) {
    FraudPatternType["CARD_TESTING"] = "CARD_TESTING";
    FraudPatternType["VELOCITY_ATTACK"] = "VELOCITY_ATTACK";
    FraudPatternType["ACCOUNT_TAKEOVER"] = "ACCOUNT_TAKEOVER";
    FraudPatternType["IMPOSSIBLE_TRAVEL"] = "IMPOSSIBLE_TRAVEL";
    FraudPatternType["BILLING_SHIPPING_MISMATCH"] = "BILLING_SHIPPING_MISMATCH";
    FraudPatternType["NEW_DEVICE_ANOMALY"] = "NEW_DEVICE_ANOMALY";
    FraudPatternType["UNUSUAL_AMOUNT"] = "UNUSUAL_AMOUNT";
    FraudPatternType["HIGH_RISK_MERCHANT"] = "HIGH_RISK_MERCHANT";
    FraudPatternType["MULTIPLE_FAILED_ATTEMPTS"] = "MULTIPLE_FAILED_ATTEMPTS";
    FraudPatternType["BOT_BEHAVIOR"] = "BOT_BEHAVIOR";
    FraudPatternType["VPN_PROXY_USAGE"] = "VPN_PROXY_USAGE";
    FraudPatternType["GEO_ANOMALY"] = "GEO_ANOMALY";
    FraudPatternType["SESSION_ANOMALY"] = "SESSION_ANOMALY";
    FraudPatternType["DEVICE_FINGERPRINT_MISMATCH"] = "DEVICE_FINGERPRINT_MISMATCH";
})(FraudPatternType || (exports.FraudPatternType = FraudPatternType = {}));
exports.FRAUD_PATTERNS = {
    [FraudPatternType.CARD_TESTING]: {
        type: FraudPatternType.CARD_TESTING,
        name: 'Card Testing',
        description: 'Fraudsters test stolen card details with small transactions',
        baseScore: 85,
        indicators: [
            'Multiple small-value transactions',
            'Sequential card number variations',
            'Rapid success/failure patterns',
            'Unusual merchant categories',
        ],
        thresholds: {
            minAttempts: 3,
            maxAmount: 50,
            timeWindowSeconds: 300,
        },
    },
    [FraudPatternType.VELOCITY_ATTACK]: {
        type: FraudPatternType.VELOCITY_ATTACK,
        name: 'Velocity Attack',
        description: 'Excessive transactions in a short time period',
        baseScore: 90,
        indicators: [
            'Too many transactions per minute',
            'Rapid-fire attempts',
            'Burst activity followed by silence',
        ],
        thresholds: {
            maxTransactionsPerMinute: 10,
            maxTransactionsPerHour: 50,
            burstThreshold: 5,
        },
    },
    [FraudPatternType.ACCOUNT_TAKEOVER]: {
        type: FraudPatternType.ACCOUNT_TAKEOVER,
        name: 'Account Takeover',
        description: 'Signs of unauthorized account access',
        baseScore: 80,
        indicators: [
            'Password reset followed by transaction',
            'New linked payment method',
            'Changed account details',
            'Login from new location',
        ],
        thresholds: {
            passwordResetToTransactionMinutes: 15,
            newPaymentMethodAgeHours: 24,
        },
    },
    [FraudPatternType.IMPOSSIBLE_TRAVEL]: {
        type: FraudPatternType.IMPOSSIBLE_TRAVEL,
        name: 'Impossible Travel',
        description: 'Transactions from locations impossible to reach in time',
        baseScore: 75,
        indicators: [
            'Transactions from distant locations in short time',
            'Login from different continents within hours',
            'VPN/Proxy usage with real IP evidence',
        ],
        thresholds: {
            minDistanceKm: 1000,
            minTimeHours: 2,
        },
    },
    [FraudPatternType.BILLING_SHIPPING_MISMATCH]: {
        type: FraudPatternType.BILLING_SHIPPING_MISMATCH,
        name: 'Billing/Shipping Mismatch',
        description: 'Shipping address differs significantly from billing',
        baseScore: 45,
        indicators: [
            'Different cities for billing and shipping',
            'Different countries',
            'Package rerouting',
            ' freight forwarder addresses',
        ],
        thresholds: {
            cityMismatchWeight: 20,
            countryMismatchWeight: 40,
        },
    },
    [FraudPatternType.NEW_DEVICE_ANOMALY]: {
        type: FraudPatternType.NEW_DEVICE_ANOMALY,
        name: 'New Device Anomaly',
        description: 'Transaction from previously unseen device',
        baseScore: 25,
        indicators: [
            'First-seen device fingerprint',
            'Device characteristics differ from history',
            'Emulator or virtual machine detected',
        ],
        thresholds: {
            deviceHistoryDays: 30,
            newDeviceScore: 25,
        },
    },
    [FraudPatternType.UNUSUAL_AMOUNT]: {
        type: FraudPatternType.UNUSUAL_AMOUNT,
        name: 'Unusual Transaction Amount',
        description: 'Transaction amount significantly differs from normal',
        baseScore: 40,
        indicators: [
            'Amount exceeds historical average by threshold',
            'Round number transactions',
            'Just-under-limit amounts',
        ],
        thresholds: {
            amountMultiplier: 3,
            highValueAmount: 10000,
            maxAmount: 50000,
        },
    },
    [FraudPatternType.HIGH_RISK_MERCHANT]: {
        type: FraudPatternType.HIGH_RISK_MERCHANT,
        name: 'High-Risk Merchant',
        description: 'Transaction with high-risk merchant or category',
        baseScore: 35,
        indicators: [
            'High-risk MCC code',
            'Known fraudulent merchant',
            'New merchant with poor reputation',
        ],
        thresholds: {
            mccRiskThreshold: 0.7,
        },
    },
    [FraudPatternType.MULTIPLE_FAILED_ATTEMPTS]: {
        type: FraudPatternType.MULTIPLE_FAILED_ATTEMPTS,
        name: 'Multiple Failed Attempts',
        description: 'Several failed payment attempts before success',
        baseScore: 55,
        indicators: [
            'Failed attempts preceding success',
            'Different card numbers tried',
            'Excessive retry attempts',
        ],
        thresholds: {
            maxFailedAttempts: 5,
            timeWindowSeconds: 600,
        },
    },
    [FraudPatternType.BOT_BEHAVIOR]: {
        type: FraudPatternType.BOT_BEHAVIOR,
        name: 'Bot-like Behavior',
        description: 'Automated/scripted activity patterns',
        baseScore: 70,
        indicators: [
            'Perfect timing intervals',
            'No mouse movement',
            'Keyboard shortcuts only',
            'No scroll behavior',
        ],
        thresholds: {
            maxReactionTimeMs: 500,
            minPageTimeSeconds: 5,
        },
    },
    [FraudPatternType.VPN_PROXY_USAGE]: {
        type: FraudPatternType.VPN_PROXY_USAGE,
        name: 'VPN/Proxy Usage',
        description: 'Connection through VPN or proxy service',
        baseScore: 30,
        indicators: [
            'Known VPN IP ranges',
            'Proxy server detected',
            'TOR exit node',
            'Data center IP',
        ],
        thresholds: {
            vpnScoreBoost: 30,
            torScoreBoost: 50,
        },
    },
    [FraudPatternType.GEO_ANOMALY]: {
        type: FraudPatternType.GEO_ANOMALY,
        name: 'Geographic Anomaly',
        description: 'Transaction location inconsistent with user history',
        baseScore: 35,
        indicators: [
            'First transaction in new country',
            'Transaction far from usual locations',
            'Location not matching user profile',
        ],
        thresholds: {
            distanceFromUsualKm: 500,
            newCountryPenalty: 25,
        },
    },
    [FraudPatternType.SESSION_ANOMALY]: {
        type: FraudPatternType.SESSION_ANOMALY,
        name: 'Session Anomaly',
        description: 'Unusual session characteristics',
        baseScore: 30,
        indicators: [
            'Unusually short session',
            'Multiple sessions simultaneous',
            'Session from unusual user agent',
        ],
        thresholds: {
            minSessionDurationSeconds: 10,
            maxConcurrentSessions: 2,
        },
    },
    [FraudPatternType.DEVICE_FINGERPRINT_MISMATCH]: {
        type: FraudPatternType.DEVICE_FINGERPRINT_MISMATCH,
        name: 'Device Fingerprint Mismatch',
        description: 'Device fingerprint inconsistent with account history',
        baseScore: 45,
        indicators: [
            'Same device different accounts',
            'Fingerprint components missing',
            'Canvas/WebGL fingerprint anomalies',
        ],
        thresholds: {
            fingerprintSimilarityThreshold: 0.7,
        },
    },
};
function getPatternScore(patternType, context) {
    const pattern = exports.FRAUD_PATTERNS[patternType];
    if (!pattern)
        return 0;
    let score = pattern.baseScore;
    // Adjust score based on context factors
    const severity = context.severity;
    if (severity) {
        score = Math.min(100, score * (1 + severity / 100));
    }
    return Math.round(score);
}
function getPatternsByCategory(category) {
    return Object.values(exports.FRAUD_PATTERNS).filter((pattern) => pattern.indicators.some((indicator) => indicator.toLowerCase().includes(category.toLowerCase())));
}
//# sourceMappingURL=patterns.js.map