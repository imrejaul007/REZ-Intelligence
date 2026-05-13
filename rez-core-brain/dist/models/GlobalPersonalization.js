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
exports.intelligenceMetricsSchema = exports.contextualDataSchema = exports.loyaltyProfileSchema = exports.userPreferencesSchema = exports.IntelligenceMetrics = exports.ContextualData = exports.LoyaltyProfile = exports.UserPreferences = exports.LoyaltyTier = exports.PrivacyLevel = exports.Tone = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Tone enum
var Tone;
(function (Tone) {
    Tone["FORMAL"] = "formal";
    Tone["CASUAL"] = "casual";
    Tone["FRIENDLY"] = "friendly";
    Tone["PROFESSIONAL"] = "professional";
})(Tone || (exports.Tone = Tone = {}));
// Privacy level enum
var PrivacyLevel;
(function (PrivacyLevel) {
    PrivacyLevel["STRICT"] = "strict";
    PrivacyLevel["BALANCED"] = "balanced";
    PrivacyLevel["OPEN"] = "open";
})(PrivacyLevel || (exports.PrivacyLevel = PrivacyLevel = {}));
// Loyalty tier enum
var LoyaltyTier;
(function (LoyaltyTier) {
    LoyaltyTier["BRONZE"] = "bronze";
    LoyaltyTier["SILVER"] = "silver";
    LoyaltyTier["GOLD"] = "gold";
    LoyaltyTier["PLATINUM"] = "platinum";
    LoyaltyTier["DIAMOND"] = "diamond";
})(LoyaltyTier || (exports.LoyaltyTier = LoyaltyTier = {}));
// User Preferences schema
const userPreferencesSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    tone: {
        type: String,
        enum: Object.values(Tone),
        default: Tone.FRIENDLY,
    },
    language: {
        type: String,
        default: 'en',
    },
    timezone: {
        type: String,
        default: 'UTC',
    },
    notificationPreferences: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
    },
    privacyLevel: {
        type: String,
        enum: Object.values(PrivacyLevel),
        default: PrivacyLevel.BALANCED,
    },
    accessibilityNeeds: {
        type: [String],
        default: [],
    },
    preferredContentTypes: {
        type: [String],
        default: [],
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
    collection: 'user_preferences',
});
exports.userPreferencesSchema = userPreferencesSchema;
// Methods
userPreferencesSchema.methods.updatePreference = async function (key, value) {
    const allowedKeys = ['tone', 'language', 'timezone', 'privacyLevel', 'preferredContentTypes'];
    if (!allowedKeys.includes(key)) {
        throw new Error(`Cannot update protected preference: ${key}`);
    }
    this[key] = value;
    await this.save();
};
userPreferencesSchema.methods.resetToDefaults = async function () {
    this.tone = Tone.FRIENDLY;
    this.language = 'en';
    this.timezone = 'UTC';
    this.notificationPreferences = { email: true, push: true, sms: false };
    this.privacyLevel = PrivacyLevel.BALANCED;
    this.accessibilityNeeds = [];
    this.preferredContentTypes = [];
    await this.save();
};
// Loyalty Profile schema
const loyaltyProfileSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    tier: {
        type: String,
        enum: Object.values(LoyaltyTier),
        default: LoyaltyTier.BRONZE,
    },
    points: {
        type: Number,
        default: 0,
        min: 0,
    },
    lifetimeValue: {
        type: Number,
        default: 0,
        min: 0,
    },
    memberSince: {
        type: Date,
        default: Date.now,
    },
    benefits: {
        type: [String],
        default: [],
    },
    preferences: {
        favoriteCategories: { type: [String], default: [] },
        preferredBrands: { type: [String], default: [] },
        communicationStyle: { type: String },
    },
    history: {
        totalPurchases: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
        averageOrderValue: { type: Number, default: 0 },
        lastPurchaseDate: { type: Date },
        favoriteStore: { type: String },
    },
}, {
    timestamps: true,
    collection: 'loyalty_profiles',
});
exports.loyaltyProfileSchema = loyaltyProfileSchema;
// Tier thresholds
const TIER_THRESHOLDS = {
    [LoyaltyTier.BRONZE]: 0,
    [LoyaltyTier.SILVER]: 1000,
    [LoyaltyTier.GOLD]: 5000,
    [LoyaltyTier.PLATINUM]: 15000,
    [LoyaltyTier.DIAMOND]: 50000,
};
// Tier benefits
const TIER_BENEFITS = {
    [LoyaltyTier.BRONZE]: ['Basic rewards', 'Email support'],
    [LoyaltyTier.SILVER]: ['5% discount', 'Priority support', 'Early access'],
    [LoyaltyTier.GOLD]: ['10% discount', 'Free shipping', 'Exclusive deals'],
    [LoyaltyTier.PLATINUM]: ['15% discount', 'Personal shopper', 'VIP events'],
    [LoyaltyTier.DIAMOND]: ['20% discount', 'Concierge service', 'Luxury gifts'],
};
// Methods
loyaltyProfileSchema.methods.addPoints = async function (points) {
    if (points < 0) {
        throw new Error('Cannot add negative points');
    }
    this.points += points;
    await this.upgradeTier();
    await this.save();
};
loyaltyProfileSchema.methods.deductPoints = async function (points) {
    if (points < 0) {
        throw new Error('Cannot deduct negative points');
    }
    if (this.points < points) {
        return false;
    }
    this.points -= points;
    await this.save();
    return true;
};
loyaltyProfileSchema.methods.upgradeTier = async function () {
    const tiers = Object.values(LoyaltyTier);
    for (let i = tiers.length - 1; i >= 0; i--) {
        if (this.points >= TIER_THRESHOLDS[tiers[i]]) {
            if (this.tier !== tiers[i]) {
                this.tier = tiers[i];
                this.benefits = TIER_BENEFITS[tiers[i]];
            }
            break;
        }
    }
};
loyaltyProfileSchema.methods.calculateLifetimeValue = async function () {
    this.history.averageOrderValue =
        this.history.totalPurchases > 0
            ? this.history.totalSpent / this.history.totalPurchases
            : 0;
    await this.save();
};
// Static methods
loyaltyProfileSchema.statics.getTierInfo = function (tier) {
    return {
        tier,
        threshold: TIER_THRESHOLDS[tier],
        benefits: TIER_BENEFITS[tier],
    };
};
// Contextual Data schema
const contextualDataSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    currentContext: {
        location: { type: String },
        device: { type: String },
        browser: { type: String },
        os: { type: String },
        appVersion: { type: String },
        sessionId: { type: String },
    },
    recentActivity: {
        lastAction: { type: String },
        lastAgent: { type: String },
        lastTopic: { type: String },
        lastSearch: { type: String },
    },
    temporalContext: {
        dayOfWeek: { type: Number },
        timeOfDay: { type: String },
        isHoliday: { type: Boolean },
        season: { type: String },
    },
    relationships: {
        activeAgents: { type: [String], default: [] },
        recentIntents: { type: [String], default: [] },
        pendingTasks: { type: [String], default: [] },
    },
}, {
    timestamps: true,
    collection: 'contextual_data',
});
exports.contextualDataSchema = contextualDataSchema;
// Methods
contextualDataSchema.methods.updateActivity = async function (action, agent) {
    this.recentActivity.lastAction = action;
    this.recentActivity.lastAgent = agent;
    await this.save();
};
contextualDataSchema.methods.addActiveAgent = async function (agentId) {
    if (!this.relationships.activeAgents.includes(agentId)) {
        this.relationships.activeAgents.push(agentId);
        await this.save();
    }
};
contextualDataSchema.methods.removeActiveAgent = async function (agentId) {
    this.relationships.activeAgents = this.relationships.activeAgents.filter((id) => id !== agentId);
    await this.save();
};
contextualDataSchema.methods.addIntent = async function (intent) {
    const intents = this.relationships.recentIntents;
    intents.unshift(intent);
    // Keep only last 10 intents
    this.relationships.recentIntents = intents.slice(0, 10);
    await this.save();
};
// Intelligence Metrics schema
const intelligenceMetricsSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    engagement: {
        dailyActiveDays: { type: Number, default: 0 },
        averageSessionLength: { type: Number, default: 0 },
        interactionFrequency: { type: Number, default: 0 },
    },
    preferences: {
        consistencyScore: { type: Number, default: 0.5 },
        adaptationRate: { type: Number, default: 0 },
        satisfactionScore: { type: Number },
    },
    behavior: {
        predictabilityScore: { type: Number, default: 0.5 },
        explorationVsExploitation: { type: Number, default: 0.5 },
        preferredAgents: { type: [String], default: [] },
        peakActivityHours: { type: [Number], default: [] },
    },
    calculatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    collection: 'intelligence_metrics',
});
exports.intelligenceMetricsSchema = intelligenceMetricsSchema;
// Methods
intelligenceMetricsSchema.methods.recalculate = async function () {
    // This would typically pull data from various sources
    // For now, just update the calculated timestamp
    this.calculatedAt = new Date();
    await this.save();
};
// Static methods
intelligenceMetricsSchema.statics.getOrCreate = async function (userId) {
    let metrics = await this.findOne({ userId });
    if (!metrics) {
        metrics = await this.create({ userId });
    }
    return metrics;
};
// Create and export models
exports.UserPreferences = mongoose_1.default.model('UserPreferences', userPreferencesSchema);
exports.LoyaltyProfile = mongoose_1.default.model('LoyaltyProfile', loyaltyProfileSchema);
exports.ContextualData = mongoose_1.default.model('ContextualData', contextualDataSchema);
exports.IntelligenceMetrics = mongoose_1.default.model('IntelligenceMetrics', intelligenceMetricsSchema);
exports.default = {
    UserPreferences: exports.UserPreferences,
    LoyaltyProfile: exports.LoyaltyProfile,
    ContextualData: exports.ContextualData,
    IntelligenceMetrics: exports.IntelligenceMetrics,
};
//# sourceMappingURL=GlobalPersonalization.js.map