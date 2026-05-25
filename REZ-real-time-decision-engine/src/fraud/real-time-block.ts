import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface FraudCheckRequest {
  userId: string;
  transactionId: string;
  amount?: number;
  context?: 'purchase' | 'redemption' | 'transfer' | 'offer_redemption';
  metadata?: Record<string, unknown>;
}

export interface FraudCheckResult {
  blocked: boolean;
  decision: 'allow' | 'block' | 'challenge';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  signals: FraudSignal[];
  recommendations: string[];
  investigationId?: string;
  processingTimeMs: number;
}

export interface FraudSignal {
  type: string;
  value: number;
  weight: number;
  description: string;
  triggered: boolean;
}

export interface FraudRule {
  id: string;
  name: string;
  condition: (request: FraudCheckRequest, context: FraudContext) => boolean;
  weight: number;
  action: 'block' | 'challenge' | 'flag';
  reason: string;
}

export interface FraudContext {
  userHistory: TransactionHistory;
  deviceFingerprint: DeviceInfo;
  locationData: LocationInfo;
  velocityData: VelocityMetrics;
  behavioralData: BehavioralMetrics;
}

export interface TransactionHistory {
  last24h: number;
  last7d: number;
  last30d: number;
  totalAmount: number;
  chargebackCount: number;
  declinedCount: number;
  averageAmount: number;
}

export interface DeviceInfo {
  deviceId: string;
  isKnown: boolean;
  isTrusted: boolean;
  firstSeen: string;
  riskScore: number;
}

export interface LocationInfo {
  ip: string;
  country: string;
  city: string;
  isProxy: boolean;
  isVpn: boolean;
  isTor: boolean;
  riskScore: number;
}

export interface VelocityMetrics {
  transactionsPerHour: number;
  transactionsPerDay: number;
  amountChangeRate: number;
  locationChangeRate: number;
}

export interface BehavioralMetrics {
  sessionDuration: number;
  typingPattern: number;
  mousePattern: number;
  navigationPattern: number;
}

export class RealTimeFraudBlocker {
  private logger: Logger;
  private rules: FraudRule[];
  private riskThresholds = {
    block: 0.8,
    challenge: 0.5,
    flag: 0.3,
  };

  constructor(logger: Logger) {
    this.logger = logger;
    this.rules = this.initializeRules();
  }

  private initializeRules(): FraudRule[] {
    return [
      // Velocity rules
      {
        id: 'velocity_high',
        name: 'High Velocity Transactions',
        condition: (req, ctx) => ctx.velocityData.transactionsPerHour > 5,
        weight: 0.4,
        action: 'challenge',
        reason: 'Unusual transaction frequency detected',
      },
      {
        id: 'amount_anomaly',
        name: 'Amount Anomaly',
        condition: (req, ctx) => {
          if (!req.amount) return false;
          return req.amount > ctx.userHistory.averageAmount * 5;
        },
        weight: 0.5,
        action: 'challenge',
        reason: 'Transaction amount significantly higher than normal',
      },
      {
        id: 'new_device',
        name: 'New Device',
        condition: (req, ctx) => !ctx.deviceFingerprint.isKnown,
        weight: 0.2,
        action: 'flag',
        reason: 'Transaction from unrecognized device',
      },
      {
        id: 'high_risk_location',
        name: 'High Risk Location',
        condition: (req, ctx) => ctx.locationData.riskScore > 0.7,
        weight: 0.45,
        action: 'challenge',
        reason: 'Transaction from high-risk location',
      },
      {
        id: 'proxy_vpn',
        name: 'Proxy/VPN Detection',
        condition: (req, ctx) => ctx.locationData.isProxy || ctx.locationData.isVpn,
        weight: 0.35,
        action: 'flag',
        reason: 'Connection through proxy or VPN detected',
      },
      {
        id: 'tor_exit',
        name: 'TOR Exit Node',
        condition: (req, ctx) => ctx.locationData.isTor,
        weight: 0.6,
        action: 'challenge',
        reason: 'Connection through TOR network',
      },
      {
        id: 'chargeback_history',
        name: 'Chargeback History',
        condition: (req, ctx) => ctx.userHistory.chargebackCount > 0,
        weight: 0.7,
        action: 'block',
        reason: 'Previous chargeback on account',
      },
      {
        id: 'rapid_location_change',
        name: 'Rapid Location Change',
        condition: (req, ctx) => ctx.velocityData.locationChangeRate > 100, // km/h
        weight: 0.55,
        action: 'block',
        reason: 'Impossible travel detected',
      },
      {
        id: 'declined_transactions',
        name: 'Multiple Declined Transactions',
        condition: (req, ctx) => ctx.userHistory.declinedCount > 3,
        weight: 0.25,
        action: 'flag',
        reason: 'Multiple declined transactions recently',
      },
      {
        id: 'unusual_time',
        name: 'Unusual Transaction Time',
        condition: () => {
          const hour = new Date().getHours();
          return hour < 3 || hour > 5; // Unusual hours
        },
        weight: 0.1,
        action: 'flag',
        reason: 'Transaction at unusual hour',
      },
    ];
  }

  async checkTransaction(request: FraudCheckRequest): Promise<FraudCheckResult> {
    const startTime = Date.now();
    const resultId = uuidv4();

    try {
      this.logger.info({
        resultId,
        userId: request.userId,
        transactionId: request.transactionId,
        context: request.context,
      }, 'Starting fraud check');

      // Fetch context data (would be from multiple services in production)
      const context = await this.fetchFraudContext(request);

      // Evaluate all rules
      const signals: FraudSignal[] = [];
      let totalWeight = 0;
      let weightedScore = 0;

      for (const rule of this.rules) {
        const triggered = rule.condition(request, context);
        const signal: FraudSignal = {
          type: rule.id,
          value: triggered ? 1 : 0,
          weight: rule.weight,
          description: rule.name,
          triggered,
        };
        signals.push(signal);

        if (triggered) {
          totalWeight += rule.weight;
          weightedScore += rule.weight;
        }
      }

      // Calculate risk score
      const baseScore = signals.filter(s => s.triggered).length / signals.length;
      const riskScore = Math.min(1, weightedScore + (baseScore * 0.2));

      // Determine decision
      let decision: 'allow' | 'block' | 'challenge' = 'allow';
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

      if (riskScore >= this.riskThresholds.block) {
        decision = 'block';
        riskLevel = riskScore >= 0.95 ? 'critical' : 'high';
      } else if (riskScore >= this.riskThresholds.challenge) {
        decision = 'challenge';
        riskLevel = 'medium';
      } else if (riskScore >= this.riskThresholds.flag) {
        riskLevel = 'low';
      }

      // Generate reasons from triggered signals
      const reasons = signals
        .filter(s => s.triggered)
        .map(s => s.description);

      // Generate recommendations
      const recommendations = this.generateRecommendations(riskScore, context);

      // Create investigation case if needed
      let investigationId: string | undefined;
      if (decision === 'block' || decision === 'challenge') {
        investigationId = await this.createInvestigationCase(request, {
          riskScore,
          riskLevel,
          signals: reasons,
        });
      }

      const result: FraudCheckResult = {
        blocked: decision === 'block',
        decision,
        riskScore,
        riskLevel,
        reasons,
        signals,
        recommendations,
        investigationId,
        processingTimeMs: Date.now() - startTime,
      };

      this.logger.info({
        resultId,
        decision,
        riskScore,
        riskLevel,
        triggeredRules: signals.filter(s => s.triggered).length,
        processingTimeMs: result.processingTimeMs,
      }, 'Fraud check completed');

      return result;

    } catch (error) {
      const err = error as Error;
      this.logger.error({ resultId, error: err.message }, 'Fraud check failed');

      // Fail open for availability - allow transaction with flag
      return {
        blocked: false,
        decision: 'challenge',
        riskScore: 0.5,
        riskLevel: 'medium',
        reasons: ['Fraud check system error - manual review required'],
        signals: [],
        recommendations: ['Manual investigation required'],
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  private async fetchFraudContext(request: FraudCheckRequest): Promise<FraudContext> {
    // In production, this would fetch from multiple services:
    // - Transaction Service (history, velocity)
    // - Device Service (fingerprint)
    // - GeoIP Service (location)
    // - User Behavior Service (behavioral)

    return {
      userHistory: {
        last24h: 2,
        last7d: 8,
        last30d: 25,
        totalAmount: 2500,
        chargebackCount: 0,
        declinedCount: 1,
        averageAmount: 100,
      },
      deviceFingerprint: {
        deviceId: request.metadata?.deviceId || 'unknown',
        isKnown: true,
        isTrusted: true,
        firstSeen: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        riskScore: 0.1,
      },
      locationData: {
        ip: request.metadata?.ip || '127.0.0.1',
        country: 'US',
        city: 'New York',
        isProxy: false,
        isVpn: false,
        isTor: false,
        riskScore: 0.05,
      },
      velocityData: {
        transactionsPerHour: 2,
        transactionsPerDay: 5,
        amountChangeRate: 0.2,
        locationChangeRate: 10,
      },
      behavioralData: {
        sessionDuration: 1800,
        typingPattern: 0.9,
        mousePattern: 0.85,
        navigationPattern: 0.8,
      },
    };
  }

  private generateRecommendations(
    riskScore: number,
    context: FraudContext
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore >= 0.7) {
      recommendations.push('Enable additional verification (2FA/SMS)');
      recommendations.push('Review transaction with user confirmation');
    }

    if (context.deviceFingerprint.riskScore > 0.5) {
      recommendations.push('Verify device with security challenge');
    }

    if (context.locationData.riskScore > 0.3) {
      recommendations.push('Confirm location via secondary channel');
    }

    if (context.velocityData.transactionsPerHour > 3) {
      recommendations.push('Implement rate limiting for this user');
    }

    if (recommendations.length === 0) {
      recommendations.push('Standard processing approved');
    }

    return recommendations;
  }

  private async createInvestigationCase(
    request: FraudCheckRequest,
    details: { riskScore: number; riskLevel: string; signals: string[] }
  ): Promise<string> {
    const caseId = `INV-${Date.now()}-${uuidv4().slice(0, 8)}`;

    // In production, this would create a case in the Investigation Service
    this.logger.info({
      caseId,
      userId: request.userId,
      transactionId: request.transactionId,
      riskScore: details.riskScore,
      riskLevel: details.riskLevel,
      signals: details.signals,
    }, 'Created fraud investigation case');

    return caseId;
  }

  // Add custom rule
  addRule(rule: FraudRule): void {
    this.rules.push(rule);
    this.logger.info({ ruleId: rule.id, ruleName: rule.name }, 'Added custom fraud rule');
  }

  // Update threshold
  setThreshold(type: 'block' | 'challenge' | 'flag', value: number): void {
    this.riskThresholds[type] = value;
    this.logger.info({ type, value }, 'Updated fraud threshold');
  }
}
