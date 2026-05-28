import { RiskScorer } from './riskScorer';
import { TransactionMonitor } from './transactionMonitor';
import { PatternMatcher } from './patternMatcher';
import { VelocityCheck } from './velocityCheck';
import { BlacklistService } from './blacklistService';
import { FraudCase, generateFraudCaseId, FraudCaseStatus, FraudCaseSeverity } from '../models/FraudCase';
import { RiskProfile, RiskLevel, IRiskProfile } from '../models/RiskProfile';
import { BlacklistType } from '../models/Blacklist';
import { logger } from '../utils/logger.js';
import { FraudPatternType, getPatternScore, FRAUD_PATTERNS } from '../config/patterns';
import { getToneForRiskScore, formatMessageWithTone } from '../config/tone';

export interface TransactionContext {
  transactionId: string;
  userId?: string;
  accountId?: string;
  orderId?: string;
  amount: number;
  currency: string;
  merchantCategory?: string;
  merchantId?: string;

  // Device Info
  deviceFingerprint?: string;
  deviceType?: string;
  userAgent?: string;
  ipAddress?: string;

  // Location Info
  billingCountry?: string;
  billingCity?: string;
  shippingCountry?: string;
  shippingCity?: string;
  shippingCoordinates?: [number, number];
  billingCoordinates?: [number, number];

  // Behavioral Data
  sessionId?: string;
  sessionDuration?: number;
  pageViews?: number;
  navigationPattern?: string[];

  // Payment Info
  cardLast4?: string;
  cardType?: string;
  isNewPaymentMethod?: boolean;

  // Account Info
  accountAge?: number;
  isVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export interface FraudDetectionResult {
  decision: 'ALLOW' | 'DENY' | 'CHALLENGE' | 'REVIEW';
  riskScore: number;
  riskLevel: RiskLevel;
  detectedPatterns: Array<{
    type: FraudPatternType;
    name: string;
    score: number;
    evidence: Record<string, unknown>;
  }>;
  riskFactors: string[];
  tone: string;
  message: string;
  caseId?: string;
  requiresAction: boolean;
  processingTimeMs: number;
  metadata: Record<string, unknown>;
}

export class FraudDetector {
  private riskScorer: RiskScorer;
  private transactionMonitor: TransactionMonitor;
  private patternMatcher: PatternMatcher;
  private velocityCheck: VelocityCheck;
  private blacklistService: BlacklistService;

  constructor() {
    this.riskScorer = new RiskScorer();
    this.transactionMonitor = new TransactionMonitor();
    this.patternMatcher = new PatternMatcher();
    this.velocityCheck = new VelocityCheck();
    this.blacklistService = new BlacklistService();
  }

  async analyzeTransaction(context: TransactionContext): Promise<FraudDetectionResult> {
    const startTime = Date.now();
    const detectedPatterns: FraudDetectionResult['detectedPatterns'] = [];
    const riskFactors: string[] = [];
    const metadata: Record<string, unknown> = {};

    try {
      // Step 1: Check blacklists
      logger.debug('Checking blacklists...', { transactionId: context.transactionId });

      const blacklistResult = await this.checkBlacklists(context);
      if (blacklistResult.isBlacklisted) {
        metadata.blacklistMatch = blacklistResult.details;
        return this.createResult({
          decision: 'DENY',
          riskScore: 100,
          detectedPatterns: [{
            type: FraudPatternType.BOT_BEHAVIOR,
            name: 'Blacklisted Entity',
            score: 100,
            evidence: blacklistResult.details as Record<string, unknown>,
          }],
          riskFactors: [`Blacklisted: ${blacklistResult.reason}`],
          startTime,
          context,
          metadata,
        });
      }

      // Step 2: Get or create risk profile
      let riskProfile: IRiskProfile | null = null;
      if (context.userId) {
        riskProfile = await RiskProfile.findOne({ userId: context.userId });
        metadata.hasExistingProfile = !!riskProfile;
      }

      // Step 3: Run pattern matching
      logger.debug('Running pattern matching...', { transactionId: context.transactionId });

      const patternMatches = await this.patternMatcher.analyze(context, riskProfile);
      for (const match of patternMatches) {
        const pattern = FRAUD_PATTERNS[match.patternType];
        if (pattern) {
          detectedPatterns.push({
            type: match.patternType,
            name: pattern.name,
            score: getPatternScore(match.patternType, match.context),
            evidence: match.evidence,
          });
          riskFactors.push(...match.riskFactors);
        }
      }

      // Step 4: Run velocity checks
      logger.debug('Running velocity checks...', { transactionId: context.transactionId });

      const velocityResult = await this.velocityCheck.check(context);
      if (velocityResult.isViolation) {
        detectedPatterns.push({
          type: FraudPatternType.VELOCITY_ATTACK,
          name: 'Velocity Attack Detected',
          score: velocityResult.score,
          evidence: velocityResult.evidence,
        });
        riskFactors.push(...velocityResult.riskFactors);
      }
      metadata.velocityCheck = velocityResult;

      // Step 5: Monitor transaction for anomalies
      logger.debug('Monitoring transaction...', { transactionId: context.transactionId });

      const transactionMonitorResult = await this.transactionMonitor.monitor(context);
      if (transactionMonitorResult.anomalies.length > 0) {
        metadata.transactionAnomalies = transactionMonitorResult.anomalies;
        riskFactors.push(...transactionMonitorResult.anomalies.map(a => a.description));
      }

      // Step 6: Calculate final risk score
      logger.debug('Calculating risk score...', { transactionId: context.transactionId });

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
      let caseId: string | undefined;
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
      const tone = getToneForRiskScore(riskScore);
      const message = this.formatResponseMessage(decision, riskScore, detectedPatterns);

      const processingTimeMs = Date.now() - startTime;

      logger.info('Fraud analysis complete', {
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
    } catch (error) {
      logger.error('Fraud detection error', {
        transactionId: context.transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fail-safe: deny on error
      return this.createResult({
        decision: 'DENY',
        riskScore: 100,
        detectedPatterns: [{
          type: FraudPatternType.BOT_BEHAVIOR,
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

  private async checkBlacklists(context: TransactionContext): Promise<{
    isBlacklisted: boolean;
    reason?: string;
    details?: Record<string, unknown>;
  }> {
    const checks: Array<{ type: string; value: string }> = [];

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
      const blacklistType = check.type === 'USER' ? BlacklistType.USER : BlacklistType.ACCOUNT;
      const result = await this.blacklistService.check(blacklistType, check.value);
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

  private makeDecision(
    riskScore: number,
    patterns: FraudDetectionResult['detectedPatterns'],
    context: TransactionContext
  ): 'ALLOW' | 'DENY' | 'CHALLENGE' | 'REVIEW' {
    // Immediate deny conditions
    if (riskScore >= 95) return 'DENY';
    if (patterns.some(p => p.type === FraudPatternType.CARD_TESTING && p.score >= 80)) return 'DENY';
    if (patterns.some(p => p.type === FraudPatternType.VELOCITY_ATTACK && p.score >= 85)) return 'DENY';

    // Review conditions
    if (riskScore >= 75) return 'REVIEW';
    if (patterns.some(p => p.score >= 70)) return 'CHALLENGE';

    // Challenge for suspicious activity
    if (context.isNewPaymentMethod && riskScore >= 50) return 'CHALLENGE';

    // Allow
    if (riskScore < 50) return 'ALLOW';

    return 'CHALLENGE';
  }

  private async createFraudCase(
    context: TransactionContext,
    analysis: {
      decision: string;
      riskScore: number;
      riskLevel: RiskLevel;
      detectedPatterns: FraudDetectionResult['detectedPatterns'];
      riskFactors: string[];
    }
  ): Promise<string> {
    const caseId = generateFraudCaseId();
    const severity = this.mapRiskScoreToSeverity(analysis.riskScore);

    const fraudCase = new FraudCase({
      caseId,
      userId: context.userId,
      accountId: context.accountId,
      transactionId: context.transactionId,
      orderId: context.orderId,
      status: FraudCaseStatus.OPEN,
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

    logger.info('Fraud case created', {
      caseId,
      transactionId: context.transactionId,
      riskScore: analysis.riskScore,
    });

    return caseId;
  }

  private mapRiskScoreToSeverity(riskScore: number): FraudCaseSeverity {
    if (riskScore >= 90) return FraudCaseSeverity.CRITICAL;
    if (riskScore >= 75) return FraudCaseSeverity.HIGH;
    if (riskScore >= 50) return FraudCaseSeverity.MEDIUM;
    return FraudCaseSeverity.LOW;
  }

  private formatResponseMessage(
    decision: string,
    riskScore: number,
    patterns: FraudDetectionResult['detectedPatterns']
  ): string {
    const tone = getToneForRiskScore(riskScore);

    switch (decision) {
      case 'DENY':
        return formatMessageWithTone(
          `Transaction blocked due to high risk score (${riskScore}). Detected ${patterns.length} fraud patterns.`,
          tone
        );

      case 'REVIEW':
        return formatMessageWithTone(
          `Transaction flagged for review. Risk score: ${riskScore}. Patterns detected: ${patterns.map(p => p.name).join(', ')}.`,
          tone
        );

      case 'CHALLENGE':
        return formatMessageWithTone(
          `Additional verification required. Risk score: ${riskScore}. Please confirm your identity.`,
          tone
        );

      case 'ALLOW':
        return formatMessageWithTone(
          `Transaction approved. Risk score: ${riskScore}. No significant fraud indicators detected.`,
          tone
        );

      default:
        return `Analysis complete. Risk score: ${riskScore}.`;
    }
  }

  private createResult(params: {
    decision: string;
    riskScore: number;
    detectedPatterns: FraudDetectionResult['detectedPatterns'];
    riskFactors: string[];
    startTime: number;
    context: TransactionContext;
    metadata: Record<string, unknown>;
  }): FraudDetectionResult {
    const tone = getToneForRiskScore(params.riskScore);
    const processingTimeMs = Date.now() - params.startTime;
    const decision = params.decision as FraudDetectionResult['decision'];

    return {
      decision,
      riskScore: params.riskScore,
      riskLevel: this.riskScorer.getRiskLevel(params.riskScore),
      detectedPatterns: params.detectedPatterns,
      riskFactors: params.riskFactors,
      tone: tone.type,
      message: formatMessageWithTone(
        `${params.decision} - Risk Score: ${params.riskScore}`,
        tone
      ),
      requiresAction: decision === 'DENY' || decision === 'REVIEW',
      processingTimeMs,
      metadata: params.metadata,
    };
  }
}
