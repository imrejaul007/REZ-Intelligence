"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudDetector = void 0;
const riskScorer_1 = require("./riskScorer");
const transactionMonitor_1 = require("./transactionMonitor");
const patternMatcher_1 = require("./patternMatcher");
const velocityCheck_1 = require("./velocityCheck");
const blacklistService_1 = require("./blacklistService");
const FraudCase_1 = require("../models/FraudCase");
const RiskProfile_1 = require("../models/RiskProfile");
const logger_1 = require("../utils/logger");
const patterns_1 = require("../config/patterns");
const tone_1 = require("../config/tone");
class FraudDetector {
    riskScorer;
    transactionMonitor;
    patternMatcher;
    velocityCheck;
    blacklistService;
    constructor() {
        this.riskScorer = new riskScorer_1.RiskScorer();
        this.transactionMonitor = new transactionMonitor_1.TransactionMonitor();
        this.patternMatcher = new patternMatcher_1.PatternMatcher();
        this.velocityCheck = new velocityCheck_1.VelocityCheck();
        this.blacklistService = new blacklistService_1.BlacklistService();
    }
    async analyzeTransaction(context) {
        const startTime = Date.now();
        const detectedPatterns = [];
        const riskFactors = [];
        const metadata = {};
        try {
            // Step 1: Check blacklists
            logger_1.logger.debug('Checking blacklists...', { transactionId: context.transactionId });
            const blacklistResult = await this.checkBlacklists(context);
            if (blacklistResult.isBlacklisted) {
                metadata.blacklistMatch = blacklistResult.details;
                return this.createResult({
                    decision: 'DENY',
                    riskScore: 100,
                    detectedPatterns: [{
                            type: patterns_1.FraudPatternType.BOT_BEHAVIOR,
                            name: 'Blacklisted Entity',
                            score: 100,
                            evidence: blacklistResult.details,
                        }],
                    riskFactors: [`Blacklisted: ${blacklistResult.reason}`],
                    startTime,
                    context,
                    metadata,
                });
            }
            // Step 2: Get or create risk profile
            let riskProfile = null;
            if (context.userId) {
                riskProfile = await RiskProfile_1.RiskProfile.findOne({ userId: context.userId });
                metadata.hasExistingProfile = !!riskProfile;
            }
            // Step 3: Run pattern matching
            logger_1.logger.debug('Running pattern matching...', { transactionId: context.transactionId });
            const patternMatches = await this.patternMatcher.analyze(context, riskProfile);
            for (const match of patternMatches) {
                const pattern = patterns_1.FRAUD_PATTERNS[match.patternType];
                if (pattern) {
                    detectedPatterns.push({
                        type: match.patternType,
                        name: pattern.name,
                        score: (0, patterns_1.getPatternScore)(match.patternType, match.context),
                        evidence: match.evidence,
                    });
                    riskFactors.push(...match.riskFactors);
                }
            }
            // Step 4: Run velocity checks
            logger_1.logger.debug('Running velocity checks...', { transactionId: context.transactionId });
            const velocityResult = await this.velocityCheck.check(context);
            if (velocityResult.isViolation) {
                detectedPatterns.push({
                    type: patterns_1.FraudPatternType.VELOCITY_ATTACK,
                    name: 'Velocity Attack Detected',
                    score: velocityResult.score,
                    evidence: velocityResult.evidence,
                });
                riskFactors.push(...velocityResult.riskFactors);
            }
            metadata.velocityCheck = velocityResult;
            // Step 5: Monitor transaction for anomalies
            logger_1.logger.debug('Monitoring transaction...', { transactionId: context.transactionId });
            const transactionMonitorResult = await this.transactionMonitor.monitor(context);
            if (transactionMonitorResult.anomalies.length > 0) {
                metadata.transactionAnomalies = transactionMonitorResult.anomalies;
                riskFactors.push(...transactionMonitorResult.anomalies.map(a => a.description));
            }
            // Step 6: Calculate final risk score
            logger_1.logger.debug('Calculating risk score...', { transactionId: context.transactionId });
            const riskScore = await this.riskScorer.calculateScore({
                baseScore: detectedPatterns.length > 0
                    ? Math.max(...detectedPatterns.map(p => p.score))
                    : 0,
                patterns: detectedPatterns,
                velocityResult,
                transactionMonitorResult,
                context,
                riskProfile,
            });
            const riskLevel = this.riskScorer.getRiskLevel(riskScore);
            // Step 7: Make decision
            const decision = this.makeDecision(riskScore, detectedPatterns, context);
            // Step 8: Create fraud case if needed
            let caseId;
            if (decision === 'DENY' || decision === 'REVIEW' || riskScore >= 75) {
                caseId = await this.createFraudCase(context, {
                    decision,
                    riskScore,
                    riskLevel,
                    detectedPatterns,
                    riskFactors,
                });
            }
            // Step 9: Format response message
            const tone = (0, tone_1.getToneForRiskScore)(riskScore);
            const message = this.formatResponseMessage(decision, riskScore, detectedPatterns);
            const processingTimeMs = Date.now() - startTime;
            logger_1.logger.info('Fraud analysis complete', {
                transactionId: context.transactionId,
                decision,
                riskScore,
                processingTimeMs,
                patternsDetected: detectedPatterns.length,
            });
            return {
                decision,
                riskScore,
                riskLevel,
                detectedPatterns,
                riskFactors: [...new Set(riskFactors)],
                tone: tone.type,
                message,
                caseId,
                requiresAction: decision === 'DENY' || decision === 'REVIEW',
                processingTimeMs,
                metadata,
            };
        }
        catch (error) {
            logger_1.logger.error('Fraud detection error', {
                transactionId: context.transactionId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Fail-safe: deny on error
            return this.createResult({
                decision: 'DENY',
                riskScore: 100,
                detectedPatterns: [{
                        type: patterns_1.FraudPatternType.BOT_BEHAVIOR,
                        name: 'System Error',
                        score: 100,
                        evidence: { error: error instanceof Error ? error.message : 'Unknown error' },
                    }],
                riskFactors: ['System error during analysis'],
                startTime,
                context,
                metadata: { error: true },
            });
        }
    }
    async checkBlacklists(context) {
        const checks = [];
        if (context.ipAddress) {
            checks.push({ type: 'IP', value: context.ipAddress });
        }
        if (context.deviceFingerprint) {
            checks.push({ type: 'DEVICE', value: context.deviceFingerprint });
        }
        if (context.userId) {
            checks.push({ type: 'USER', value: context.userId });
        }
        if (context.accountId) {
            checks.push({ type: 'ACCOUNT', value: context.accountId });
        }
        for (const check of checks) {
            const result = await this.blacklistService.check(check.type, check.value);
            if (result.isBlacklisted) {
                return {
                    isBlacklisted: true,
                    reason: result.entry?.reason,
                    details: {
                        type: check.type,
                        value: check.value,
                        severity: result.entry?.severity,
                        entryId: result.entry?.entryId,
                    },
                };
            }
        }
        return { isBlacklisted: false };
    }
    makeDecision(riskScore, patterns, context) {
        // Immediate deny conditions
        if (riskScore >= 95)
            return 'DENY';
        if (patterns.some(p => p.type === patterns_1.FraudPatternType.CARD_TESTING && p.score >= 80))
            return 'DENY';
        if (patterns.some(p => p.type === patterns_1.FraudPatternType.VELOCITY_ATTACK && p.score >= 85))
            return 'DENY';
        // Review conditions
        if (riskScore >= 75)
            return 'REVIEW';
        if (patterns.some(p => p.score >= 70))
            return 'CHALLENGE';
        // Challenge for suspicious activity
        if (context.isNewPaymentMethod && riskScore >= 50)
            return 'CHALLENGE';
        // Allow
        if (riskScore < 50)
            return 'ALLOW';
        return 'CHALLENGE';
    }
    async createFraudCase(context, analysis) {
        const caseId = (0, FraudCase_1.generateFraudCaseId)();
        const severity = this.mapRiskScoreToSeverity(analysis.riskScore);
        const fraudCase = new FraudCase_1.FraudCase({
            caseId,
            userId: context.userId,
            accountId: context.accountId,
            transactionId: context.transactionId,
            orderId: context.orderId,
            status: FraudCase_1.FraudCaseStatus.OPEN,
            severity,
            riskScore: analysis.riskScore,
            detectedPatterns: analysis.detectedPatterns.map(p => ({
                patternType: p.type,
                patternName: p.name,
                matchedAt: new Date(),
                score: p.score,
                evidence: p.evidence,
            })),
            riskFactors: analysis.riskFactors,
            evidence: {
                transactions: [{
                        transactionId: context.transactionId,
                        amount: context.amount,
                        currency: context.currency,
                        merchantCategory: context.merchantCategory,
                        timestamp: new Date(),
                    }],
                deviceInfo: {
                    fingerprint: context.deviceFingerprint,
                    type: context.deviceType,
                    userAgent: context.userAgent,
                },
                locationInfo: {
                    billing: {
                        country: context.billingCountry,
                        city: context.billingCity,
                        coordinates: context.billingCoordinates,
                    },
                    shipping: {
                        country: context.shippingCountry,
                        city: context.shippingCity,
                        coordinates: context.shippingCoordinates,
                    },
                },
            },
            source: 'AUTOMATED',
            actionsTaken: [{
                    action: 'CASE_CREATED',
                    timestamp: new Date(),
                    details: `Automated fraud case created with decision: ${analysis.decision}`,
                }],
        });
        await fraudCase.save();
        logger_1.logger.info('Fraud case created', {
            caseId,
            transactionId: context.transactionId,
            riskScore: analysis.riskScore,
        });
        return caseId;
    }
    mapRiskScoreToSeverity(riskScore) {
        if (riskScore >= 90)
            return FraudCase_1.FraudCaseSeverity.CRITICAL;
        if (riskScore >= 75)
            return FraudCase_1.FraudCaseSeverity.HIGH;
        if (riskScore >= 50)
            return FraudCase_1.FraudCaseSeverity.MEDIUM;
        return FraudCase_1.FraudCaseSeverity.LOW;
    }
    formatResponseMessage(decision, riskScore, patterns) {
        const tone = (0, tone_1.getToneForRiskScore)(riskScore);
        switch (decision) {
            case 'DENY':
                return (0, tone_1.formatMessageWithTone)(`Transaction blocked due to high risk score (${riskScore}). Detected ${patterns.length} fraud patterns.`, tone);
            case 'REVIEW':
                return (0, tone_1.formatMessageWithTone)(`Transaction flagged for review. Risk score: ${riskScore}. Patterns detected: ${patterns.map(p => p.name).join(', ')}.`, tone);
            case 'CHALLENGE':
                return (0, tone_1.formatMessageWithTone)(`Additional verification required. Risk score: ${riskScore}. Please confirm your identity.`, tone);
            case 'ALLOW':
                return (0, tone_1.formatMessageWithTone)(`Transaction approved. Risk score: ${riskScore}. No significant fraud indicators detected.`, tone);
            default:
                return `Analysis complete. Risk score: ${riskScore}.`;
        }
    }
    createResult(params) {
        const tone = (0, tone_1.getToneForRiskScore)(params.riskScore);
        const processingTimeMs = Date.now() - params.startTime;
        return {
            decision: params.decision,
            riskScore: params.riskScore,
            riskLevel: this.riskScorer.getRiskLevel(params.riskScore),
            detectedPatterns: params.detectedPatterns,
            riskFactors: params.riskFactors,
            tone: tone.type,
            message: (0, tone_1.formatMessageWithTone)(`${params.decision} - Risk Score: ${params.riskScore}`, tone),
            requiresAction: params.decision === 'DENY' || params.decision === 'REVIEW',
            processingTimeMs,
            metadata: params.metadata,
        };
    }
}
exports.FraudDetector = FraudDetector;
//# sourceMappingURL=fraudDetector.js.map