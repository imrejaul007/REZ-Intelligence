import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface DecisionContext {
  userId: string;
  sessionId: string;
  requestType: 'offer' | 'fraud' | 'recommendation' | 'loyalty' | 'personalization';
  context: Record<string, unknown>;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionResult {
  decisionId: string;
  requestType: string;
  decision: 'approved' | 'denied' | 'review' | 'pending';
  score: number;
  confidence: number;
  reasons: string[];
  actions: DecisionAction[];
  metadata: Record<string, unknown>;
  processingTimeMs: number;
}

export interface DecisionAction {
  type: string;
  target: string;
  value?;
  priority: 'high' | 'medium' | 'low';
}

type Headers = Record<string, string | undefined>;

export class DecisionRouter {
  private logger: Logger;
  private decisionHandlers: Map<string, (ctx: DecisionContext) => Promise<DecisionResult>>;
  private defaultTimeout: number = 100; // ms

  constructor(logger: Logger) {
    this.logger = logger;
    this.decisionHandlers = new Map();
    this.initializeHandlers();
  }

  private initializeHandlers() {
    // Register built-in handlers
    this.decisionHandlers.set('offer', this.handleOfferDecision.bind(this));
    this.decisionHandlers.set('fraud', this.handleFraudDecision.bind(this));
    this.decisionHandlers.set('recommendation', this.handleRecommendationDecision.bind(this));
    this.decisionHandlers.set('loyalty', this.handleLoyaltyDecision.bind(this));
    this.decisionHandlers.set('personalization', this.handlePersonalizationDecision.bind(this));
  }

  async route(body, headers: Headers): Promise<DecisionResult> {
    const startTime = Date.now();
    const decisionId = uuidv4();

    try {
      // Validate input
      if (!body.userId || !body.requestType) {
        throw new Error('Missing required fields: userId, requestType');
      }

      const context: DecisionContext = {
        userId: body.userId,
        sessionId: body.sessionId || headers['x-session-id'] || uuidv4(),
        requestType: body.requestType,
        context: body.context || {},
        timestamp: new Date().toISOString(),
        metadata: {
          requestId: headers['x-request-id'],
          userAgent: headers['user-agent'],
          ip: headers['x-forwarded-for'] || headers['x-real-ip'],
        },
      };

      this.logger.info({
        decisionId,
        userId: context.userId,
        requestType: context.requestType,
      }, 'Routing decision request');

      // Get handler for request type
      const handler = this.decisionHandlers.get(context.requestType);
      if (!handler) {
        throw new Error(`Unknown request type: ${context.requestType}`);
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(handler, context);

      this.logger.info({
        decisionId,
        decision: result.decision,
        score: result.score,
        processingTimeMs: Date.now() - startTime,
      }, 'Decision completed');

      return result;

    } catch (error) {
      const err = error as Error;
      this.logger.error({ decisionId, error: err.message }, 'Decision routing failed');

      // Return error result
      return {
        decisionId,
        requestType: body.requestType || 'unknown',
        decision: 'review',
        score: 0,
        confidence: 0,
        reasons: [err.message],
        actions: [],
        metadata: { error: true },
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  private async executeWithTimeout(
    handler: (ctx: DecisionContext) => Promise<DecisionResult>,
    context: DecisionContext
  ): Promise<DecisionResult> {
    return Promise.race([
      handler(context),
      new Promise<DecisionResult>((_, reject) =>
        setTimeout(() => reject(new Error('Decision timeout')), this.defaultTimeout)
      ),
    ]);
  }

  private async handleOfferDecision(ctx: DecisionContext): Promise<DecisionResult> {
    const { userId, context } = ctx;

    // Simulate ML model evaluation
    const score = this.calculateOfferScore(context);
    const decision = this.determineDecision(score, 0.6, 0.8);

    return {
      decisionId: uuidv4(),
      requestType: 'offer',
      decision,
      score,
      confidence: 0.85,
      reasons: [
        score > 0.7 ? 'High user affinity score' : 'Standard offer eligibility',
        context.history ? 'Active user engagement' : 'New user evaluation',
      ],
      actions: decision === 'approved' ? [{
        type: 'present_offer',
        target: 'user',
        value: context.offerId,
        priority: 'high',
      }] : [],
      metadata: {
        userId,
        offerType: context.offerType,
        eligibilityCriteria: context.criteria,
      },
      processingTimeMs: 0,
    };
  }

  private async handleFraudDecision(ctx: DecisionContext): Promise<DecisionResult> {
    const { userId, context } = ctx;

    const score = this.calculateFraudScore(context);
    const decision = this.determineFraudDecision(score);

    return {
      decisionId: uuidv4(),
      requestType: 'fraud',
      decision,
      score,
      confidence: 0.92,
      reasons: this.generateFraudReasons(context, score),
      actions: this.generateFraudActions(decision, context),
      metadata: {
        userId,
        transactionId: context.transactionId,
        riskIndicators: context.riskIndicators,
      },
      processingTimeMs: 0,
    };
  }

  private async handleRecommendationDecision(ctx: DecisionContext): Promise<DecisionResult> {
    const { userId, context } = ctx;

    return {
      decisionId: uuidv4(),
      requestType: 'recommendation',
      decision: 'approved',
      score: 0.9,
      confidence: 0.88,
      reasons: ['User preference alignment', 'Contextual relevance'],
      actions: [{
        type: 'generate_recommendations',
        target: 'user',
        value: { count: context.maxItems || 10 },
        priority: 'medium',
      }],
      metadata: {
        userId,
        category: context.category,
        strategy: context.strategy,
      },
      processingTimeMs: 0,
    };
  }

  private async handleLoyaltyDecision(ctx: DecisionContext): Promise<DecisionResult> {
    const { userId, context } = ctx;

    const score = this.calculateLoyaltyScore(context);

    return {
      decisionId: uuidv4(),
      requestType: 'loyalty',
      decision: score > 0.5 ? 'approved' : 'pending',
      score,
      confidence: 0.78,
      reasons: ['Loyalty tier evaluation', 'Engagement metrics'],
      actions: [{
        type: 'evaluate_tier',
        target: 'user',
        value: context.currentTier,
        priority: 'low',
      }],
      metadata: {
        userId,
        currentPoints: context.points,
        tier: context.currentTier,
      },
      processingTimeMs: 0,
    };
  }

  private async handlePersonalizationDecision(ctx: DecisionContext): Promise<DecisionResult> {
    const { userId, context } = ctx;

    return {
      decisionId: uuidv4(),
      requestType: 'personalization',
      decision: 'approved',
      score: 0.95,
      confidence: 0.91,
      reasons: ['Profile completeness', 'Behavioral signals'],
      actions: [{
        type: 'personalize_content',
        target: 'user',
        value: context.contentType,
        priority: 'medium',
      }],
      metadata: {
        userId,
        segments: context.segments,
        preferences: context.preferences,
      },
      processingTimeMs: 0,
    };
  }

  // Scoring helpers
  private calculateOfferScore(context: Record<string, unknown>): number {
    let score = 0.5;

    // User engagement factor
    if (context.history?.length > 10) score += 0.2;
    else if (context.history?.length > 5) score += 0.1;

    // Recency factor
    if (context.lastActivity) {
      const daysSinceActivity = (Date.now() - new Date(context.lastActivity).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity < 7) score += 0.15;
      else if (daysSinceActivity > 30) score -= 0.1;
    }

    // Offer type affinity
    if (context.offerType === 'premium' && context.isPremiumUser) score += 0.1;

    return Math.min(1, Math.max(0, score));
  }

  private calculateFraudScore(context: Record<string, unknown>): number {
    let score = 0.1; // Low base fraud score

    // Velocity check
    if (context.transactionVelocity > 5) score += 0.3;
    if (context.transactionVelocity > 10) score += 0.3;

    // Amount anomalies
    if (context.amount > context.averageAmount * 3) score += 0.25;

    // Location anomalies
    if (context.locationMismatch) score += 0.2;

    // Device anomalies
    if (context.newDevice) score += 0.1;
    if (context.vpnDetected) score += 0.15;

    return Math.min(1, score);
  }

  private calculateLoyaltyScore(context: Record<string, unknown>): number {
    let score = 0.3;

    // Points factor
    const pointsRatio = context.points / 10000;
    score += Math.min(0.3, pointsRatio * 0.3);

    // Engagement frequency
    if (context.weeklyActivity > 5) score += 0.2;
    else if (context.weeklyActivity > 2) score += 0.1;

    // Tier multiplier
    const tierMultipliers: Record<string, number> = {
      bronze: 1,
      silver: 1.2,
      gold: 1.4,
      platinum: 1.6,
    };
    score *= tierMultipliers[context.currentTier] || 1;

    return Math.min(1, score);
  }

  private determineDecision(score: number, denyThreshold: number, approveThreshold: number): 'approved' | 'denied' | 'review' | 'pending' {
    if (score >= approveThreshold) return 'approved';
    if (score < denyThreshold) return 'denied';
    return 'review';
  }

  private determineFraudDecision(score: number): 'approved' | 'denied' | 'review' {
    if (score < 0.2) return 'approved';
    if (score >= 0.7) return 'denied';
    return 'review';
  }

  private generateFraudReasons(context: Record<string, unknown>, score: number): string[] {
    const reasons: string[] = [];

    if (score < 0.2) {
      reasons.push('Normal transaction pattern');
    } else {
      if (context.transactionVelocity > 5) reasons.push('High transaction velocity detected');
      if (context.amount > context.averageAmount * 3) reasons.push('Unusual transaction amount');
      if (context.locationMismatch) reasons.push('Location mismatch with profile');
      if (context.vpnDetected) reasons.push('VPN/proxy detected');
      if (context.newDevice) reasons.push('First-time device usage');
    }

    return reasons;
  }

  private generateFraudActions(decision: string, context: Record<string, unknown>): DecisionAction[] {
    const actions: DecisionAction[] = [];

    if (decision === 'denied') {
      actions.push({
        type: 'block_transaction',
        target: context.transactionId,
        priority: 'high',
      });
      actions.push({
        type: 'flag_account',
        target: context.userId,
        priority: 'medium',
      });
    } else if (decision === 'review') {
      actions.push({
        type: 'queue_for_review',
        target: context.transactionId,
        priority: 'medium',
      });
    }

    return actions;
  }

  // Register custom handler
  registerHandler(requestType: string, handler: (ctx: DecisionContext) => Promise<DecisionResult>): void {
    this.decisionHandlers.set(requestType, handler);
    this.logger.info({ requestType }, 'Registered custom decision handler');
  }
}
