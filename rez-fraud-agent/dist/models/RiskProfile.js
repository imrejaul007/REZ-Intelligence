"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskProfile = exports.AccountStanding = exports.RiskLevel = void 0;
exports.generateProfileId = generateProfileId;
const mongoose_1 = __importStar(require("mongoose"));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["TRUSTED"] = "TRUSTED";
    RiskLevel["NORMAL"] = "NORMAL";
    RiskLevel["ELEVATED"] = "ELEVATED";
    RiskLevel["HIGH"] = "HIGH";
    RiskLevel["CRITICAL"] = "CRITICAL";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var AccountStanding;
(function (AccountStanding) {
    AccountStanding["GOOD"] = "GOOD";
    AccountStanding["UNDER_REVIEW"] = "UNDER_REVIEW";
    AccountStanding["RESTRICTED"] = "RESTRICTED";
    AccountStanding["SUSPENDED"] = "SUSPENDED";
    AccountStanding["CLOSED"] = "CLOSED";
})(AccountStanding || (exports.AccountStanding = AccountStanding = {}));
const TransactionHistorySchema = new mongoose_1.Schema({
    transactionId: { type: String, required: true },
    amount: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    merchantCategory: { type: String, required: true },
    riskScore: { type: Number, required: true },
    status: { type: String, required: true },
}, { _id: false });
const LoginHistorySchema = new mongoose_1.Schema({
    ipAddress: { type: String, required: true },
    deviceFingerprint: { type: String, required: true },
    userAgent: { type: String, required: true },
    location: {
        country: { type: String, required: true },
        city: String,
        coordinates: [Number],
    },
    timestamp: { type: Date, required: true },
    successful: { type: Boolean, default: true },
}, { _id: false });
const UsualLocationSchema = new mongoose_1.Schema({
    country: { type: String, required: true },
    city: String,
    frequency: { type: Number, default: 1 },
}, { _id: false });
const RiskProfileSchema = new mongoose_1.Schema({
    profileId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    accountId: String,
    riskLevel: {
        type: String,
        enum: Object.values(RiskLevel),
        default: RiskLevel.NORMAL,
        index: true,
    },
    riskScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    accountStanding: {
        type: String,
        enum: Object.values(AccountStanding),
        default: AccountStanding.GOOD,
    },
    transactionHistory: [TransactionHistorySchema],
    loginHistory: [LoginHistorySchema],
    averageTransactionAmount: { type: Number, default: 0 },
    maxTransactionAmount: { type: Number, default: 0 },
    usualMerchantCategories: [String],
    usualLocations: [UsualLocationSchema],
    usualDevices: [String],
    usualIPAddresses: [String],
    totalTransactions: { type: Number, default: 0 },
    failedTransactionCount: { type: Number, default: 0 },
    chargebackCount: { type: Number, default: 0 },
    refundCount: { type: Number, default: 0 },
    fraudCaseCount: { type: Number, default: 0 },
    usualTransactionHours: [Number],
    averageSessionDuration: { type: Number, default: 0 },
    isKnownFraudster: { type: Boolean, default: false },
    isVerifiedAccount: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    hasPaymentMethodOnFile: { type: Boolean, default: false },
    lastTransactionAt: Date,
    lastLoginAt: Date,
    lastRiskAssessmentAt: Date,
    riskFlags: [String],
    notes: { type: String, default: '' },
}, {
    timestamps: true,
});
// Indexes
RiskProfileSchema.index({ riskLevel: 1, riskScore: -1 });
RiskProfileSchema.index({ 'usualLocations.country': 1 });
RiskProfileSchema.index({ isKnownFraudster: 1 });
// Virtual for fraud rate
RiskProfileSchema.virtual('fraudRate').get(function () {
    if (this.totalTransactions === 0)
        return 0;
    return (this.fraudCaseCount / this.totalTransactions) * 100;
});
// Method to update risk level based on score
RiskProfileSchema.methods.updateRiskLevel = function () {
    if (this.riskScore >= 90) {
        this.riskLevel = RiskLevel.CRITICAL;
    }
    else if (this.riskScore >= 75) {
        this.riskLevel = RiskLevel.HIGH;
    }
    else if (this.riskScore >= 50) {
        this.riskLevel = RiskLevel.ELEVATED;
    }
    else if (this.riskScore >= 25) {
        this.riskLevel = RiskLevel.NORMAL;
    }
    else {
        this.riskLevel = RiskLevel.TRUSTED;
    }
};
exports.RiskProfile = mongoose_1.default.model('RiskProfile', RiskProfileSchema);
function generateProfileId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `RP-${timestamp}-${random}`.toUpperCase();
}
//# sourceMappingURL=RiskProfile.js.map