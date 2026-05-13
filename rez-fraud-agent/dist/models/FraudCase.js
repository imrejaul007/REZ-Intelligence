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
exports.FraudCase = exports.FraudCaseSeverity = exports.FraudCaseStatus = void 0;
exports.generateFraudCaseId = generateFraudCaseId;
const mongoose_1 = __importStar(require("mongoose"));
var FraudCaseStatus;
(function (FraudCaseStatus) {
    FraudCaseStatus["OPEN"] = "OPEN";
    FraudCaseStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    FraudCaseStatus["CONFIRMED"] = "CONFIRMED";
    FraudCaseStatus["FALSE_POSITIVE"] = "FALSE_POSITIVE";
    FraudCaseStatus["RESOLVED"] = "RESOLVED";
    FraudCaseStatus["ESCALATED"] = "ESCALATED";
})(FraudCaseStatus || (exports.FraudCaseStatus = FraudCaseStatus = {}));
var FraudCaseSeverity;
(function (FraudCaseSeverity) {
    FraudCaseSeverity["LOW"] = "LOW";
    FraudCaseSeverity["MEDIUM"] = "MEDIUM";
    FraudCaseSeverity["HIGH"] = "HIGH";
    FraudCaseSeverity["CRITICAL"] = "CRITICAL";
})(FraudCaseSeverity || (exports.FraudCaseSeverity = FraudCaseSeverity = {}));
const FraudPatternMatchSchema = new mongoose_1.Schema({
    patternType: { type: String, required: true },
    patternName: { type: String, required: true },
    matchedAt: { type: Date, default: Date.now },
    score: { type: Number, required: true },
    evidence: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { _id: false });
const FraudCaseSchema = new mongoose_1.Schema({
    caseId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: String,
        index: true,
    },
    accountId: {
        type: String,
        index: true,
    },
    transactionId: {
        type: String,
        index: true,
    },
    orderId: {
        type: String,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(FraudCaseStatus),
        default: FraudCaseStatus.OPEN,
        index: true,
    },
    severity: {
        type: String,
        enum: Object.values(FraudCaseSeverity),
        default: FraudCaseSeverity.MEDIUM,
        index: true,
    },
    riskScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        index: true,
    },
    detectedPatterns: [FraudPatternMatchSchema],
    riskFactors: [String],
    indicators: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    evidence: {
        transactions: [mongoose_1.Schema.Types.Mixed],
        deviceInfo: mongoose_1.Schema.Types.Mixed,
        locationInfo: mongoose_1.Schema.Types.Mixed,
        behavioralData: mongoose_1.Schema.Types.Mixed,
        sessionData: mongoose_1.Schema.Types.Mixed,
    },
    resolvedAt: Date,
    assignedTo: String,
    reviewedBy: String,
    reviewNotes: String,
    actionsTaken: [
        {
            action: String,
            timestamp: { type: Date, default: Date.now },
            performedBy: String,
            details: String,
            _id: false,
        },
    ],
    blockedAmount: Number,
    preventedLoss: Number,
    source: {
        type: String,
        enum: ['AUTOMATED', 'MANUAL', 'EXTERNAL'],
        default: 'AUTOMATED',
    },
    externalReference: String,
}, {
    timestamps: true,
});
// Compound indexes for common queries
FraudCaseSchema.index({ status: 1, severity: 1 });
FraudCaseSchema.index({ userId: 1, status: 1 });
FraudCaseSchema.index({ createdAt: -1, status: 1 });
FraudCaseSchema.index({ riskScore: -1, status: 1 });
// TTL index for old resolved cases (optional, uncomment if needed)
// FraudCaseSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days
exports.FraudCase = mongoose_1.default.model('FraudCase', FraudCaseSchema);
// Helper function to generate case ID
function generateFraudCaseId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `FRC-${timestamp}-${random}`.toUpperCase();
}
//# sourceMappingURL=FraudCase.js.map