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
exports.BlacklistEntry = exports.BlacklistSeverity = exports.BlacklistReason = exports.BlacklistType = void 0;
exports.generateBlacklistEntryId = generateBlacklistEntryId;
const mongoose_1 = __importStar(require("mongoose"));
var BlacklistType;
(function (BlacklistType) {
    BlacklistType["IP_ADDRESS"] = "IP_ADDRESS";
    BlacklistType["DEVICE_FINGERPRINT"] = "DEVICE_FINGERPRINT";
    BlacklistType["EMAIL"] = "EMAIL";
    BlacklistType["PHONE"] = "PHONE";
    BlacklistType["CARD_HASH"] = "CARD_HASH";
    BlacklistType["IBAN"] = "IBAN";
    BlacklistType["ACCOUNT"] = "ACCOUNT";
    BlacklistType["USER"] = "USER";
    BlacklistType["MERCHANT"] = "MERCHANT";
    BlacklistType["VELOCITY_GROUP"] = "VELOCITY_GROUP";
})(BlacklistType || (exports.BlacklistType = BlacklistType = {}));
var BlacklistReason;
(function (BlacklistReason) {
    BlacklistReason["FRAUD_CONFIRMED"] = "FRAUD_CONFIRMED";
    BlacklistReason["CHARGEBACK"] = "CHARGEBACK";
    BlacklistReason["REFUND_ABUSE"] = "REFUND_ABUSE";
    BlacklistReason["POLICY_VIOLATION"] = "POLICY_VIOLATION";
    BlacklistReason["VELOCITY_VIOLATION"] = "VELOCITY_VIOLATION";
    BlacklistReason["CARD_TESTING"] = "CARD_TESTING";
    BlacklistReason["BOT_ACTIVITY"] = "BOT_ACTIVITY";
    BlacklistReason["MANUAL_REVIEW"] = "MANUAL_REVIEW";
    BlacklistReason["ACCOUNT_TAKEOVER"] = "ACCOUNT_TAKEOVER";
    BlacklistReason["TEST_ACCOUNT"] = "TEST_ACCOUNT";
    BlacklistReason["OTHER"] = "OTHER";
})(BlacklistReason || (exports.BlacklistReason = BlacklistReason = {}));
var BlacklistSeverity;
(function (BlacklistSeverity) {
    BlacklistSeverity["WARN"] = "WARN";
    BlacklistSeverity["BLOCK"] = "BLOCK";
    BlacklistSeverity["INVESTIGATE"] = "INVESTIGATE";
})(BlacklistSeverity || (exports.BlacklistSeverity = BlacklistSeverity = {}));
const BlacklistEntrySchema = new mongoose_1.Schema({
    entryId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    type: {
        type: String,
        enum: Object.values(BlacklistType),
        required: true,
        index: true,
    },
    value: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    reason: {
        type: String,
        enum: Object.values(BlacklistReason),
        required: true,
    },
    severity: {
        type: String,
        enum: Object.values(BlacklistSeverity),
        default: BlacklistSeverity.BLOCK,
    },
    userId: {
        type: String,
        index: true,
    },
    transactionId: String,
    orderId: String,
    fraudCaseId: String,
    details: {
        description: String,
        evidence: mongoose_1.Schema.Types.Mixed,
        relatedEntries: [String],
        firstOccurrence: Date,
        occurrenceCount: Number,
    },
    expiresAt: {
        type: Date,
        index: true,
    },
    isPermanent: {
        type: Boolean,
        default: false,
    },
    addedBy: {
        type: String,
        required: true,
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
    lastMatchedAt: Date,
    matchCount: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    notes: String,
}, {
    timestamps: true,
});
// Compound indexes
BlacklistEntrySchema.index({ type: 1, value: 1 }, { unique: true });
BlacklistEntrySchema.index({ type: 1, isActive: 1 });
BlacklistEntrySchema.index({ userId: 1, isActive: 1 });
BlacklistEntrySchema.index({ expiresAt: 1 }, { sparse: true });
// TTL index for temporary entries
BlacklistEntrySchema.index({ expiresAt: 1 }, {
    expireAfterSeconds: 0,
    partialFilterExpression: { isPermanent: false },
});
// Static method to check if a value is blacklisted
BlacklistEntrySchema.statics.isBlacklisted = async function (type, value) {
    const normalizedValue = value.toLowerCase().trim();
    const entry = await this.findOne({
        type,
        value: normalizedValue,
        isActive: true,
        $or: [
            { isPermanent: true },
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } },
        ],
    });
    return {
        isBlacklisted: !!entry,
        entry: entry || undefined,
    };
};
// Static method to add entry to blacklist
BlacklistEntrySchema.statics.addToBlacklist = async function (data) {
    const entryId = generateBlacklistEntryId();
    const entry = await this.create({
        entryId,
        type: data.type,
        value: data.value.toLowerCase().trim(),
        reason: data.reason,
        severity: data.severity || BlacklistSeverity.BLOCK,
        userId: data.userId,
        transactionId: data.transactionId,
        orderId: data.orderId,
        fraudCaseId: data.fraudCaseId,
        addedBy: data.addedBy,
        isPermanent: data.isPermanent ?? true,
        expiresAt: data.expiresAt,
        notes: data.notes,
        details: {
            firstOccurrence: new Date(),
            occurrenceCount: 1,
        },
    });
    return entry;
};
// Static method for pagination
BlacklistEntrySchema.statics.paginate = async function (query) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;
    const filter = {};
    if (query.type)
        filter.type = query.type;
    if (query.reason)
        filter.reason = query.reason;
    if (query.severity)
        filter.severity = query.severity;
    if (query.isActive !== undefined)
        filter.isActive = query.isActive;
    const [docs, total] = await Promise.all([
        this.find(filter).sort({ addedAt: -1 }).skip(skip).limit(limit).lean(),
        this.countDocuments(filter),
    ]);
    return {
        docs: docs,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
    };
};
// Method to record a match
BlacklistEntrySchema.methods.recordMatch = async function () {
    this.matchCount += 1;
    this.lastMatchedAt = new Date();
    await this.save();
};
exports.BlacklistEntry = mongoose_1.default.model('BlacklistEntry', BlacklistEntrySchema);
function generateBlacklistEntryId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `BL-${timestamp}-${random}`.toUpperCase();
}
//# sourceMappingURL=Blacklist.js.map