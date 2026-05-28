"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIGNAL_CAUSALITY_STRENGTH = exports.SIGNAL_SOURCE_RELIABILITY = exports.SIGNAL_WEIGHTS = void 0;
exports.computeOverall = computeOverall;
exports.evaluateSegments = evaluateSegments;
var express_1 = require("express");
var cors_1 = require("cors");
var helmet_1 = require("helmet");
var compression_1 = require("compression");
var mongoose_1 = require("mongoose");
var ioredis_1 = require("ioredis");
var winston_1 = require("winston");
var axios_1 = require("axios");
var zod_1 = require("zod");
// ============================================
// Configuration & Environment
// ============================================
var config = {
    port: parseInt(process.env.PORT || '4142', 10),
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-signals',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    cacheTtl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutes default
    realtimeCacheTtl: parseInt(process.env.REALTIME_CACHE_TTL || '30', 10), // 30 seconds
    internalToken: process.env.INTERNAL_SERVICE_TOKEN || 'dev-token',
};
// ============================================
// Signal Weights Configuration
// ============================================
exports.SIGNAL_WEIGHTS = {
    location: 0.15,
    behavioral: 0.25,
    social: 0.15,
    competitor: 0.20,
    engagement: 0.25,
};
// ============================================
// Signal Source Reliability Configuration
// ============================================
// Historical reliability of each signal source (based on past accuracy)
exports.SIGNAL_SOURCE_RELIABILITY = {
    location: 0.85, // Location data is fairly reliable
    behavioral: 0.90, // Behavioral signals are most reliable
    social: 0.75, // Social signals have moderate reliability
    competitor: 0.70, // Competitor signals have lower reliability
    engagement: 0.88, // Engagement signals are reliable
};
// Default freshness scores (freshness decays over time)
var FRESHNESS_HALF_LIFE_MS = 5 * 60 * 1000; // 5 minutes
// Causality strength (how much this signal type predicts outcomes)
exports.SIGNAL_CAUSALITY_STRENGTH = {
    location: 0.3, // Low causality
    behavioral: 0.7, // High causality
    social: 0.5, // Moderate causality
    competitor: 0.4, // Low-moderate causality
    engagement: 0.6, // Moderate-high causality
};
// ============================================
// Segment Definitions
// ============================================
var SEGMENT_THRESHOLDS = {
    HIGH_VALUE: 75,
    MEDIUM_VALUE: 50,
    ENGAGED: 60,
    AT_RISK: 40,
    POWER_USER: 80,
    CASUAL: 30,
    COMPETITOR_CONSCIOUS: 70,
    LOCATION_SENSITIVE: 65,
    SOCIAL_BUTTERFLY: 70,
    INFLUENCER: 75,
};
// ============================================
// Utility Functions
// ============================================
function computeOverall(signals) {
    return Math.round(signals.location * exports.SIGNAL_WEIGHTS.location +
        signals.behavioral * exports.SIGNAL_WEIGHTS.behavioral +
        signals.social * exports.SIGNAL_WEIGHTS.social +
        signals.competitor * exports.SIGNAL_WEIGHTS.competitor +
        signals.engagement * exports.SIGNAL_WEIGHTS.engagement);
}
// NEW: Compute quality metadata for a single signal
function computeSignalQuality(type, timestamp, score) {
    var now = Date.now();
    var ageMs = now - timestamp.getTime();
    var ageHours = ageMs / (1000 * 60 * 60);
    // Freshness: 100 when just updated, decays to 0 after 1 hour
    var freshness = Math.max(0, Math.min(100, 100 - (ageHours * 100)));
    // Confidence based on freshness and reliability
    var reliability = exports.SIGNAL_SOURCE_RELIABILITY[type] * 100;
    var confidence = Math.round((freshness * 0.6 + reliability * 0.4));
    // Causality strength (static per signal type)
    var causalityStrength = exports.SIGNAL_CAUSALITY_STRENGTH[type];
    // Stale if data is older than 30 minutes
    var isStale = ageMs > 30 * 60 * 1000;
    return {
        reliability: reliability,
        freshness: Math.round(freshness),
        confidence: confidence,
        causalityStrength: causalityStrength,
        isStale: isStale,
        lastUpdated: timestamp,
    };
}
// NEW: Compute quality scores for all signals
function computeSignalQualities(fetchedSignals) {
    var qualities = {};
    for (var _i = 0, fetchedSignals_1 = fetchedSignals; _i < fetchedSignals_1.length; _i++) {
        var signal = fetchedSignals_1[_i];
        qualities[signal.type] = computeSignalQuality(signal.type, signal.timestamp, signal.score);
    }
    // Ensure all signal types have quality metadata
    var allTypes = ['location', 'behavioral', 'social', 'competitor', 'engagement'];
    for (var _a = 0, allTypes_1 = allTypes; _a < allTypes_1.length; _a++) {
        var type = allTypes_1[_a];
        if (!qualities[type]) {
            qualities[type] = {
                reliability: exports.SIGNAL_SOURCE_RELIABILITY[type] * 100,
                freshness: 0,
                confidence: 0,
                causalityStrength: exports.SIGNAL_CAUSALITY_STRENGTH[type],
                isStale: true,
                lastUpdated: new Date(0),
            };
        }
    }
    return qualities;
}
// NEW: Compute overall quality score
function computeOverallQuality(qualities, fetchedSignals) {
    var types = ['location', 'behavioral', 'social', 'competitor', 'engagement'];
    // Signal coverage: what percentage of signals are present
    var presentSignals = fetchedSignals.length;
    var signalCoverage = (presentSignals / types.length) * 100;
    // Average confidence across all signals
    var totalConfidence = 0;
    var oldestTimestamp = Date.now();
    for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
        var type = types_1[_i];
        var quality = qualities[type];
        totalConfidence += quality.confidence;
        if (quality.lastUpdated.getTime() < oldestTimestamp) {
            oldestTimestamp = quality.lastUpdated.getTime();
        }
    }
    var avgConfidence = totalConfidence / types.length;
    var qualityScore = Math.round(avgConfidence * (signalCoverage / 100));
    // Data age: milliseconds since oldest signal
    var dataAge = Date.now() - oldestTimestamp;
    return { qualityScore: qualityScore, signalCoverage: Math.round(signalCoverage), dataAge: dataAge };
}
function evaluateSegments(signals, overall) {
    var segments = [];
    if (overall >= SEGMENT_THRESHOLDS.HIGH_VALUE) {
        segments.push('high-value');
    }
    else if (overall >= SEGMENT_THRESHOLDS.MEDIUM_VALUE) {
        segments.push('medium-value');
    }
    else if (overall <= SEGMENT_THRESHOLDS.AT_RISK) {
        segments.push('at-risk');
    }
    if (overall >= SEGMENT_THRESHOLDS.ENGAGED) {
        segments.push('engaged');
    }
    else if (overall < SEGMENT_THRESHOLDS.CASUAL) {
        segments.push('casual');
    }
    if (signals.engagement >= SEGMENT_THRESHOLDS.POWER_USER) {
        segments.push('power-user');
    }
    if (signals.competitor >= SEGMENT_THRESHOLDS.COMPETITOR_CONSCIOUS) {
        segments.push('competitor-conscious');
    }
    if (signals.location >= SEGMENT_THRESHOLDS.LOCATION_SENSITIVE) {
        segments.push('location-sensitive');
    }
    if (signals.social >= SEGMENT_THRESHOLDS.SOCIAL_BUTTERFLY) {
        segments.push('social-butterfly');
    }
    if (signals.social >= SEGMENT_THRESHOLDS.INFLUENCER &&
        signals.engagement >= SEGMENT_THRESHOLDS.INFLUENCER) {
        segments.push('influencer');
    }
    return segments;
}
function getTopSignals(signals) {
    return Object.entries(signals)
        .map(function (_a) {
        var type = _a[0], score = _a[1];
        return ({ type: type, score: score });
    })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 3);
}
// ============================================
// MongoDB Models
// ============================================
var unifiedSignalSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    signals: {
        location: { type: Number, default: 0, min: 0, max: 100 },
        behavioral: { type: Number, default: 0, min: 0, max: 100 },
        social: { type: Number, default: 0, min: 0, max: 100 },
        competitor: { type: Number, default: 0, min: 0, max: 100 },
        engagement: { type: Number, default: 0, min: 0, max: 100 },
    },
    overall: { type: Number, default: 0, min: 0, max: 100 },
    segments: { type: [String], default: [] },
    computedAt: { type: Date, default: Date.now },
    // NEW: Quality metadata
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    signalCoverage: { type: Number, default: 0, min: 0, max: 100 },
    dataAge: { type: Number, default: 0 }, // milliseconds
});
var segmentMembershipSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, index: true },
    segment: { type: String, required: true, index: true },
    score: { type: Number, required: true },
    active: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now },
});
segmentMembershipSchema.index({ segment: 1, active: 1 });
var UnifiedSignal = mongoose_1.default.model('UnifiedSignal', unifiedSignalSchema);
var SegmentMembership = mongoose_1.default.model('SegmentMembership', segmentMembershipSchema);
// ============================================
// Redis Client
// ============================================
var CacheService = /** @class */ (function () {
    function CacheService() {
        this.redis = null;
        this.isConnected = false;
    }
    CacheService.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.redis = new ioredis_1.Redis(config.redisUrl, {
                            maxRetriesPerRequest: 3,
                            lazyConnect: true,
                        });
                        return [4 /*yield*/, this.redis.connect()];
                    case 1:
                        _a.sent();
                        this.isConnected = true;
                        logger.info('Redis connected successfully');
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        logger.warn('Redis connection failed, caching disabled:', error_1);
                        this.isConnected = false;
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    CacheService.prototype.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isConnected || !this.redis)
                            return [2 /*return*/, null];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.redis.get(key)];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, data ? JSON.parse(data) : null];
                    case 3:
                        error_2 = _a.sent();
                        logger.error('Redis get error:', error_2);
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CacheService.prototype.set = function (key_1, value_1) {
        return __awaiter(this, arguments, void 0, function (key, value, ttlSeconds) {
            var error_3;
            if (ttlSeconds === void 0) { ttlSeconds = config.cacheTtl; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isConnected || !this.redis)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.redis.setex(key, ttlSeconds, JSON.stringify(value))];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        logger.error('Redis set error:', error_3);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CacheService.prototype.del = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isConnected || !this.redis)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.redis.del(key)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        logger.error('Redis del error:', error_4);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CacheService.prototype.invalidatePattern = function (pattern) {
        return __awaiter(this, void 0, void 0, function () {
            var keys, error_5;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.isConnected || !this.redis)
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.redis.keys(pattern)];
                    case 2:
                        keys = _b.sent();
                        if (!(keys.length > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, (_a = this.redis).del.apply(_a, keys)];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_5 = _b.sent();
                        logger.error('Redis invalidate error:', error_5);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return CacheService;
}());
var cacheService = new CacheService();
// ============================================
// Logger
// ============================================
var logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
        }),
    ],
});
var SIGNAL_SOURCES = [
    {
        name: 'location',
        baseUrl: process.env.REZ_LOCATION_SERVICE_URL || 'http://localhost:4013',
        endpoint: '/api/signals',
        weight: exports.SIGNAL_WEIGHTS.location,
    },
    {
        name: 'behavioral',
        baseUrl: process.env.REZ_BEHAVIORAL_SERVICE_URL || 'http://localhost:4014',
        endpoint: '/api/signals',
        weight: exports.SIGNAL_WEIGHTS.behavioral,
    },
    {
        name: 'social',
        baseUrl: process.env.REZ_SOCIAL_SERVICE_URL || 'http://localhost:4015',
        endpoint: '/api/signals',
        weight: exports.SIGNAL_WEIGHTS.social,
    },
    {
        name: 'competitor',
        baseUrl: process.env.REZ_COMPETITOR_SERVICE_URL || 'http://localhost:4016',
        endpoint: '/api/signals',
        weight: exports.SIGNAL_WEIGHTS.competitor,
    },
    {
        name: 'engagement',
        baseUrl: process.env.REZ_ENGAGEMENT_SERVICE_URL || 'http://localhost:4017',
        endpoint: '/api/signals',
        weight: exports.SIGNAL_WEIGHTS.engagement,
    },
];
function fetchSignalFromSource(source, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, axios_1.default.get("".concat(source.baseUrl).concat(source.endpoint, "/").concat(userId), {
                            timeout: 2000,
                            headers: {
                                'X-Internal-Token': config.internalToken,
                            },
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, {
                            type: source.name,
                            score: Math.min(100, Math.max(0, response.data.score || 0)),
                            timestamp: new Date(),
                        }];
                case 2:
                    error_6 = _a.sent();
                    logger.warn("Failed to fetch ".concat(source.name, " signal for user ").concat(userId, ":"), error_6);
                    // Return default score on failure
                    return [2 /*return*/, {
                            type: source.name,
                            score: 50, // Neutral default
                            timestamp: new Date(),
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function aggregateSignals(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, bypassCache) {
        var cacheKey, cached, signalPromises, fetchedSignals, signals, _i, fetchedSignals_2, signal, overall, segments, signalQualities, _a, qualityScore, signalCoverage, dataAge, unifiedSignal, error_7;
        if (bypassCache === void 0) { bypassCache = false; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    cacheKey = "signals:".concat(userId);
                    if (!!bypassCache) return [3 /*break*/, 2];
                    return [4 /*yield*/, cacheService.get(cacheKey)];
                case 1:
                    cached = _b.sent();
                    if (cached) {
                        logger.debug("Cache hit for user ".concat(userId));
                        return [2 /*return*/, cached];
                    }
                    _b.label = 2;
                case 2:
                    signalPromises = SIGNAL_SOURCES.map(function (source) { return fetchSignalFromSource(source, userId); });
                    return [4 /*yield*/, Promise.all(signalPromises)];
                case 3:
                    fetchedSignals = _b.sent();
                    signals = {
                        location: 0,
                        behavioral: 0,
                        social: 0,
                        competitor: 0,
                        engagement: 0,
                    };
                    for (_i = 0, fetchedSignals_2 = fetchedSignals; _i < fetchedSignals_2.length; _i++) {
                        signal = fetchedSignals_2[_i];
                        signals[signal.type] = signal.score;
                    }
                    overall = computeOverall(signals);
                    segments = evaluateSegments(signals, overall);
                    signalQualities = computeSignalQualities(fetchedSignals);
                    _a = computeOverallQuality(signalQualities, fetchedSignals), qualityScore = _a.qualityScore, signalCoverage = _a.signalCoverage, dataAge = _a.dataAge;
                    unifiedSignal = {
                        userId: userId,
                        signals: signals,
                        overall: overall,
                        segments: segments,
                        computedAt: new Date(),
                        // NEW: Quality metadata
                        qualityScore: qualityScore,
                        signalCoverage: signalCoverage,
                        dataAge: dataAge,
                    };
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 7, , 8]);
                    return [4 /*yield*/, UnifiedSignal.findOneAndUpdate({ userId: userId }, unifiedSignal, { upsert: true, new: true })];
                case 5:
                    _b.sent();
                    // Update segment memberships
                    return [4 /*yield*/, updateSegmentMemberships(userId, segments, overall)];
                case 6:
                    // Update segment memberships
                    _b.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_7 = _b.sent();
                    logger.error('Failed to save unified signal:', error_7);
                    return [3 /*break*/, 8];
                case 8: 
                // Cache the result
                return [4 /*yield*/, cacheService.set(cacheKey, unifiedSignal, config.cacheTtl)];
                case 9:
                    // Cache the result
                    _b.sent();
                    return [2 /*return*/, unifiedSignal];
            }
        });
    });
}
function updateSegmentMemberships(userId, segments, overall) {
    return __awaiter(this, void 0, void 0, function () {
        var memberships;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Deactivate all existing memberships
                return [4 /*yield*/, SegmentMembership.updateMany({ userId: userId }, { active: false })];
                case 1:
                    // Deactivate all existing memberships
                    _a.sent();
                    memberships = segments.map(function (segment) { return ({
                        userId: userId,
                        segment: segment,
                        score: overall,
                        active: true,
                        joinedAt: new Date(),
                    }); });
                    if (!(memberships.length > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, SegmentMembership.bulkWrite(memberships.map(function (m) { return ({
                            updateOne: {
                                filter: { userId: userId, segment: m.segment },
                                update: { $set: m },
                                upsert: true,
                            },
                        }); }))];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getRealTimeSignals(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, cached, signalPromises, fetchedSignals, signals, _i, fetchedSignals_3, signal, overall, velocity, signalQualities, realtimeSignals;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cacheKey = "signals:realtime:".concat(userId);
                    return [4 /*yield*/, cacheService.get(cacheKey)];
                case 1:
                    cached = _a.sent();
                    if (cached) {
                        return [2 /*return*/, cached];
                    }
                    signalPromises = SIGNAL_SOURCES.map(function (source) { return fetchSignalFromSource(source, userId); });
                    return [4 /*yield*/, Promise.all(signalPromises)];
                case 2:
                    fetchedSignals = _a.sent();
                    signals = {
                        location: 0,
                        behavioral: 0,
                        social: 0,
                        competitor: 0,
                        engagement: 0,
                    };
                    for (_i = 0, fetchedSignals_3 = fetchedSignals; _i < fetchedSignals_3.length; _i++) {
                        signal = fetchedSignals_3[_i];
                        signals[signal.type] = signal.score;
                    }
                    overall = computeOverall(signals);
                    velocity = {
                        location: signals.location > 70 ? 1 : signals.location < 30 ? -1 : 0,
                        behavioral: signals.behavioral > 70 ? 1 : signals.behavioral < 30 ? -1 : 0,
                        social: signals.social > 70 ? 1 : signals.social < 30 ? -1 : 0,
                        competitor: signals.competitor > 70 ? 1 : signals.competitor < 30 ? -1 : 0,
                        engagement: signals.engagement > 70 ? 1 : signals.engagement < 30 ? -1 : 0,
                    };
                    signalQualities = computeSignalQualities(fetchedSignals);
                    realtimeSignals = {
                        userId: userId,
                        signals: signals,
                        overall: overall,
                        velocity: velocity,
                        timestamp: new Date(),
                        signalQualities: signalQualities,
                    };
                    // Cache with short TTL
                    return [4 /*yield*/, cacheService.set(cacheKey, realtimeSignals, config.realtimeCacheTtl)];
                case 3:
                    // Cache with short TTL
                    _a.sent();
                    return [2 /*return*/, realtimeSignals];
            }
        });
    });
}
// ============================================
// Request Validation Schemas
// ============================================
var userIdParamsSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, 'userId is required').max(100),
});
var segmentParamsSchema = zod_1.z.object({
    segment: zod_1.z.string().min(1, 'segment is required').max(50),
});
// ============================================
// Express Application
// ============================================
var app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json());
// Request logging middleware
app.use(function (req, _res, next) {
    logger.info("".concat(req.method, " ").concat(req.path), {
        ip: req.ip,
        query: req.query,
    });
    next();
});
// Health check endpoint
app.get('/health', function (_req, res) {
    res.json({
        status: 'healthy',
        service: 'rez-signal-aggregator',
        timestamp: new Date().toISOString(),
        mongodb: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
        redis: cacheService.isConnected ? 'connected' : 'disconnected',
    });
});
// GET /signals/:userId - Get unified signals
app.get('/signals/:userId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, signals, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                userId = userIdParamsSchema.parse(req.params).userId;
                return [4 /*yield*/, aggregateSignals(userId)];
            case 1:
                signals = _a.sent();
                res.json({
                    success: true,
                    data: signals,
                });
                return [3 /*break*/, 3];
            case 2:
                error_8 = _a.sent();
                if (error_8 instanceof zod_1.z.ZodError) {
                    res.status(400).json({ success: false, error: error_8.errors });
                    return [2 /*return*/];
                }
                logger.error('Error fetching signals:', error_8);
                res.status(500).json({ success: false, error: 'Internal server error' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// GET /signals/:userId/summary - Get signal summary
app.get('/signals/:userId/summary', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, signals, topSignals, summary, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                userId = userIdParamsSchema.parse(req.params).userId;
                return [4 /*yield*/, aggregateSignals(userId)];
            case 1:
                signals = _a.sent();
                topSignals = getTopSignals(signals.signals);
                summary = {
                    userId: userId,
                    overall: signals.overall,
                    topSignals: topSignals,
                    segmentCount: signals.segments.length,
                    lastUpdated: signals.computedAt,
                    // NEW
                    qualityScore: signals.qualityScore,
                    signalCoverage: signals.signalCoverage,
                };
                res.json({
                    success: true,
                    data: summary,
                });
                return [3 /*break*/, 3];
            case 2:
                error_9 = _a.sent();
                if (error_9 instanceof zod_1.z.ZodError) {
                    res.status(400).json({ success: false, error: error_9.errors });
                    return [2 /*return*/];
                }
                logger.error('Error fetching signal summary:', error_9);
                res.status(500).json({ success: false, error: 'Internal server error' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// GET /signals/quality/:userId - Get signal quality metadata (NEW)
app.get('/signals/quality/:userId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId_1, signalPromises, fetchedSignals, signalQualities_1, _a, qualityScore, signalCoverage, dataAge, error_10;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                userId_1 = userIdParamsSchema.parse(req.params).userId;
                signalPromises = SIGNAL_SOURCES.map(function (source) { return fetchSignalFromSource(source, userId_1); });
                return [4 /*yield*/, Promise.all(signalPromises)];
            case 1:
                fetchedSignals = _b.sent();
                signalQualities_1 = computeSignalQualities(fetchedSignals);
                _a = computeOverallQuality(signalQualities_1, fetchedSignals), qualityScore = _a.qualityScore, signalCoverage = _a.signalCoverage, dataAge = _a.dataAge;
                res.json({
                    success: true,
                    data: {
                        userId: userId_1,
                        qualityScore: qualityScore,
                        signalCoverage: signalCoverage,
                        dataAgeMs: dataAge,
                        signalQualities: signalQualities_1,
                        sources: fetchedSignals.map(function (s) { return ({
                            type: s.type,
                            score: s.score,
                            timestamp: s.timestamp,
                            quality: signalQualities_1[s.type],
                        }); }),
                    },
                });
                return [3 /*break*/, 3];
            case 2:
                error_10 = _b.sent();
                if (error_10 instanceof zod_1.z.ZodError) {
                    res.status(400).json({ success: false, error: error_10.errors });
                    return [2 /*return*/];
                }
                logger.error('Error fetching signal quality:', error_10);
                res.status(500).json({ success: false, error: 'Internal server error' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// GET /signals/:userId/segments - Get segment memberships
app.get('/signals/:userId/segments', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, memberships, error_11;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                userId = userIdParamsSchema.parse(req.params).userId;
                return [4 /*yield*/, SegmentMembership.find({
                        userId: userId,
                        active: true,
                    }).sort({ joinedAt: -1 })];
            case 1:
                memberships = _a.sent();
                res.json({
                    success: true,
                    data: memberships,
                });
                return [3 /*break*/, 3];
            case 2:
                error_11 = _a.sent();
                if (error_11 instanceof zod_1.z.ZodError) {
                    res.status(400).json({ success: false, error: error_11.errors });
                    return [2 /*return*/];
                }
                logger.error('Error fetching segments:', error_11);
                res.status(500).json({ success: false, error: 'Internal server error' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// GET /signals/segments/:segment - Get users in segment
app.get('/signals/segments/:segment', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var segment, limit, offset, memberships, total, error_12;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                segment = segmentParamsSchema.parse(req.params).segment;
                limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
                offset = parseInt(req.query.offset || '0', 10);
                return [4 /*yield*/, SegmentMembership.find({
                        segment: segment,
                        active: true,
                    })
                        .sort({ score: -1 })
                        .skip(offset)
                        .limit(limit)];
            case 1:
                memberships = _a.sent();
                return [4 /*yield*/, SegmentMembership.countDocuments({
                        segment: segment,
                        active: true,
                    })];
            case 2:
                total = _a.sent();
                res.json({
                    success: true,
                    data: {
                        users: memberships.map(function (m) { return ({
                            userId: m.userId,
                            score: m.score,
                            joinedAt: m.joinedAt,
                        }); }),
                        pagination: {
                            total: total,
                            limit: limit,
                            offset: offset,
                            hasMore: offset + memberships.length < total,
                        },
                    },
                });
                return [3 /*break*/, 4];
            case 3:
                error_12 = _a.sent();
                if (error_12 instanceof zod_1.z.ZodError) {
                    res.status(400).json({ success: false, error: error_12.errors });
                    return [2 /*return*/];
                }
                logger.error('Error fetching segment users:', error_12);
                res.status(500).json({ success: false, error: 'Internal server error' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// POST /signals/compute/:userId - Force recompute
app.post('/signals/compute/:userId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, signals, error_13;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                userId = userIdParamsSchema.parse(req.params).userId;
                // Invalidate cache
                return [4 /*yield*/, cacheService.del("signals:".concat(userId))];
            case 1:
                // Invalidate cache
                _a.sent();
                return [4 /*yield*/, cacheService.del("signals:realtime:".concat(userId))];
            case 2:
                _a.sent();
                return [4 /*yield*/, aggregateSignals(userId, true)];
            case 3:
                signals = _a.sent();
                res.json({
                    success: true,
                    data: signals,
                    message: 'Signals recomputed successfully',
                });
                return [3 /*break*/, 5];
            case 4:
                error_13 = _a.sent();
                if (error_13 instanceof zod_1.z.ZodError) {
                    res.status(400).json({ success: false, error: error_13.errors });
                    return [2 /*return*/];
                }
                logger.error('Error recomputing signals:', error_13);
                res.status(500).json({ success: false, error: 'Internal server error' });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// GET /signals/real-time/:userId - Get real-time signals (no long cache)
app.get('/signals/real-time/:userId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, realtimeSignals, error_14;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                userId = userIdParamsSchema.parse(req.params).userId;
                return [4 /*yield*/, getRealTimeSignals(userId)];
            case 1:
                realtimeSignals = _a.sent();
                res.json({
                    success: true,
                    data: realtimeSignals,
                });
                return [3 /*break*/, 3];
            case 2:
                error_14 = _a.sent();
                if (error_14 instanceof zod_1.z.ZodError) {
                    res.status(400).json({ success: false, error: error_14.errors });
                    return [2 /*return*/];
                }
                logger.error('Error fetching real-time signals:', error_14);
                res.status(500).json({ success: false, error: 'Internal server error' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// GET /signals/weights - Get current signal weights
app.get('/signals/weights', function (_req, res) {
    res.json({
        success: true,
        data: exports.SIGNAL_WEIGHTS,
    });
});
// GET /signals/segments/list - List all available segments
app.get('/signals/segments/list', function (_req, res) {
    // ============================================
    // RisaCare-Compatible Endpoints
    // ============================================
    // POST /api/signals/track - Track a user signal
    var trackSignalSchema = zod_1.z.object({
        userId: zod_1.z.string().min(1),
        signalType: zod_1.z.string().min(1),
        properties: zod_1.z.record(zod_1.z.unknown()).optional(),
        timestamp: zod_1.z.string().optional()
    });
    app.post('/api/signals/track', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, userId, signalType, properties, error_15;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    _a = trackSignalSchema.parse(req.body), userId = _a.userId, signalType = _a.signalType, properties = _a.properties;
                    // Store signal in MongoDB
                    return [4 /*yield*/, UserSignalModel.create({
                            userId: userId,
                            signalType: signalType,
                            properties: properties || {},
                            timestamp: new Date(),
                            source: 'risa-care'
                        })];
                case 1:
                    // Store signal in MongoDB
                    _b.sent();
                    // Invalidate cache
                    return [4 /*yield*/, cacheService.del("signals:".concat(userId))];
                case 2:
                    // Invalidate cache
                    _b.sent();
                    res.json({ success: true });
                    return [3 /*break*/, 4];
                case 3:
                    error_15 = _b.sent();
                    if (error_15 instanceof zod_1.z.ZodError) {
                        res.status(400).json({ success: false, error: error_15.errors });
                        return [2 /*return*/];
                    }
                    logger.error('Error tracking signal:', error_15);
                    res.status(500).json({ success: false, error: 'Internal server error' });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    // GET /api/signals/user/:userId - Get user signals for RisaCare
    app.get('/api/signals/user/:userId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var userId, signals, aggregatedSignals, error_16;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    userId = req.params.userId;
                    return [4 /*yield*/, UserSignalModel.find({ userId: userId })
                            .sort({ timestamp: -1 })
                            .limit(100)];
                case 1:
                    signals = _a.sent();
                    aggregatedSignals = signals.reduce(function (acc, signal) {
                        var existing = acc.find(function (s) { return s.signalType === signal.signalType; });
                        if (existing) {
                            existing.count += 1;
                            existing.lastSeen = signal.timestamp.toISOString();
                        }
                        else {
                            acc.push({
                                signalType: signal.signalType,
                                count: 1,
                                lastSeen: signal.timestamp.toISOString()
                            });
                        }
                        return acc;
                    }, []);
                    res.json(aggregatedSignals);
                    return [3 /*break*/, 3];
                case 2:
                    error_16 = _a.sent();
                    logger.error('Error fetching user signals:', error_16);
                    res.status(500).json({ success: false, error: 'Internal server error' });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    app.get('/signals/segments/list', function (_req, res) {
        var segments = [
            { name: 'high-value', threshold: SEGMENT_THRESHOLDS.HIGH_VALUE, description: 'Overall score >= 75' },
            { name: 'medium-value', threshold: SEGMENT_THRESHOLDS.MEDIUM_VALUE, description: 'Overall score >= 50' },
            { name: 'at-risk', threshold: SEGMENT_THRESHOLDS.AT_RISK, description: 'Overall score <= 40' },
            { name: 'engaged', threshold: SEGMENT_THRESHOLDS.ENGAGED, description: 'Overall score >= 60' },
            { name: 'casual', threshold: SEGMENT_THRESHOLDS.CASUAL, description: 'Overall score < 30' },
            { name: 'power-user', threshold: SEGMENT_THRESHOLDS.POWER_USER, description: 'Engagement score >= 80' },
            { name: 'competitor-conscious', threshold: SEGMENT_THRESHOLDS.COMPETITOR_CONSCIOUS, description: 'Competitor score >= 70' },
            { name: 'location-sensitive', threshold: SEGMENT_THRESHOLDS.LOCATION_SENSITIVE, description: 'Location score >= 65' },
            { name: 'social-butterfly', threshold: SEGMENT_THRESHOLDS.SOCIAL_BUTTERFLY, description: 'Social score >= 70' },
            { name: 'influencer', threshold: SEGMENT_THRESHOLDS.INFLUENCER, description: 'Social >= 75 and Engagement >= 75' },
        ];
        res.json({
            success: true,
            data: segments,
        });
    });
    // Error handling middleware
    app.use(function (err, _req, res, _next) {
        logger.error('Unhandled error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    });
    // 404 handler
    app.use(function (_req, res) {
        res.status(404).json({
            success: false,
            error: 'Not found',
        });
    });
    // ============================================
    // Server Startup
    // ============================================
    function startServer() {
        return __awaiter(this, void 0, void 0, function () {
            var error_17;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        // Connect to MongoDB
                        logger.info('Connecting to MongoDB...');
                        return [4 /*yield*/, mongoose_1.default.connect(config.mongodbUri)];
                    case 1:
                        _a.sent();
                        logger.info('MongoDB connected successfully');
                        // Connect to Redis
                        return [4 /*yield*/, cacheService.connect()];
                    case 2:
                        // Connect to Redis
                        _a.sent();
                        // Start Express server
                        app.listen(config.port, function () {
                            logger.info("REZ Signal Aggregator running on port ".concat(config.port));
                            logger.info('Endpoints:');
                            logger.info('  GET  /health                    - Health check');
                            logger.info('  GET  /signals/:userId            - Get unified signals');
                            logger.info('  GET  /signals/:userId/summary     - Get signal summary');
                            logger.info('  GET  /signals/:userId/segments   - Get segment memberships');
                            logger.info('  GET  /signals/segments/:segment  - Get users in segment');
                            logger.info('  POST /signals/compute/:userId     - Force recompute');
                            logger.info('  GET  /signals/real-time/:userId  - Get real-time signals');
                            logger.info('  GET  /signals/weights            - Get signal weights');
                            logger.info('  GET  /signals/segments/list      - List all segments');
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_17 = _a.sent();
                        logger.error('Failed to start server:', error_17);
                        process.exit(1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    // Graceful shutdown
    process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger.info('SIGTERM received, shutting down gracefully');
                    return [4 /*yield*/, mongoose_1.default.connection.close()];
                case 1:
                    _a.sent();
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    }); });
    process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger.info('SIGINT received, shutting down gracefully');
                    return [4 /*yield*/, mongoose_1.default.connection.close()];
                case 1:
                    _a.sent();
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    }); });
    startServer();
    export { app, aggregateSignals, getRealTimeSignals };
});
