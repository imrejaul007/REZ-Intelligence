import { v4 as uuidv4 } from 'uuid';
import {
  IRoutingDecision,
  RoutingDecision,
  DecisionStatus,
  RoutingStrategy,
  PriorityTier,
  PriorityTierNames,
} from '../models';
import { intentClassifier, ClassifiedIntent } from './intentClassifier';
import { ruleEngine, RuleEvaluationResult } from './ruleEngine';
import {
  PRIORITY_MATRIX,
  getMatrixEntry,
  calculatePriorityScore,
} from '../rules/priorityMatrix';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface PriorityResolutionRequest {
  requestId?: string;
  intent: string;
  context?: {
    userId?: string;
    sessionId?: string;
    domain?: string;
    customerTier?: number;
    metadata?: Record<string, unknown>;
  };
  bypassCache?: boolean;
}

export interface PriorityResolutionResult {
  requestId: string;
  decision: {
    priorityTier: number;
    priorityTierName: string;
    priorityScore: number;
    routingStrategy: string;
    targetAgent?: string;
    targetQueue?: string;
    slaDeadline?: Date;
    confidence: number;
  };
  classification: {
    primaryType: string;
    confidence: number;
    detectedPatterns: Array<{
      type: string;
      pattern: string;
      confidence: number;
    }>;
  };
  matchedRules: Array<{
    name: string;
    score: number;
    actions: {
      routeTo?: string;
      escalate?: boolean;
      notify?: string[];
      tags?: string[];
      slaMinutes?: number;
    };
  }>;
  modifiers: {
    urgency: number;
    complexity: number;
    customerTier: number;
    businessImpact: number;
    domainMatch: string | null;
  };
  processingTimeMs: number;
  timestamp: Date;
}

export interface RoutingDecisionWithRule extends RuleEvaluationResult {
  finalTier: PriorityTier;
  finalScore: number;
}

export class PriorityResolver {
  private redis: import('ioredis') | null = null;

  setRedisClient(redis: import('ioredis')): void {
    this.redis = redis;
  }

  async resolve(request: PriorityResolutionRequest): Promise<PriorityResolutionResult> {
    const startTime = Date.now();
    const requestId = request.requestId || uuidv4();

    try {
      logger.info('Resolving priority', { requestId, intent: request.intent.substring(0, 50) });

      const classifiedIntent = intentClassifier.classify(
        request.intent,
        request.context
      );

      const context = {
        intent: classifiedIntent,
        metadata: request.context?.metadata,
        userId: request.context?.userId,
        sessionId: request.context?.sessionId,
        domain: request.context?.domain,
      };

      const ruleResults = await ruleEngine.evaluateRules(classifiedIntent, context);
      const routingDecision = await this.determineRouting(
        classifiedIntent,
        ruleResults,
        request.context
      );

      const matchedRules = ruleResults
        .filter(r => r.matched)
        .slice(0, 5)
        .map(r => ({
          name: r.rule.name,
          score: r.score,
          actions: r.rule.actions,
        }));

      const processingTimeMs = Date.now() - startTime;

      const result: PriorityResolutionResult = {
        requestId,
        decision: {
          priorityTier: routingDecision.finalTier,
          priorityTierName: PriorityTierNames[routingDecision.finalTier],
          priorityScore: routingDecision.finalScore,
          routingStrategy: routingDecision.rule?.ruleType || 'custom',
          targetAgent: routingDecision.rule?.actions?.routeTo,
          targetQueue: routingDecision.rule?.actions?.routeTo || this.getQueueForTier(routingDecision.finalTier),
          slaDeadline: this.calculateSLADeadline(routingDecision.finalTier),
          confidence: classifiedIntent.confidence,
        },
        classification: {
          primaryType: classifiedIntent.primaryType,
          confidence: classifiedIntent.confidence,
          detectedPatterns: classifiedIntent.detectedPatterns.map(p => ({
            type: p.type,
            pattern: p.pattern,
            confidence: p.confidence,
          })),
        },
        matchedRules,
        modifiers: classifiedIntent.modifiers,
        processingTimeMs,
        timestamp: new Date(),
      };

      await this.persistDecision(result, classifiedIntent);

      logger.info('Priority resolved', {
        requestId,
        tier: routingDecision.finalTier,
        tierName: PriorityTierNames[routingDecision.finalTier],
        score: routingDecision.finalScore,
        processingTimeMs,
      });

      return result;
    } catch (error) {
      logger.error('Priority resolution failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async determineRouting(
    classifiedIntent: ClassifiedIntent,
    ruleResults: RuleEvaluationResult[],
    context?: PriorityResolutionRequest['context']
  ): Promise<RoutingDecisionWithRule> {
    let finalTier = classifiedIntent.priorityTier;
    let finalScore = classifiedIntent.priorityScore;
    let bestRule: RuleEvaluationResult | null = null;

    for (const ruleResult of ruleResults) {
      if (!ruleResult.matched) continue;

      if (ruleResult.rule.priorityTier < finalTier) {
        finalTier = ruleResult.rule.priorityTier;
        finalScore = Math.min(100, finalScore + 20);
        bestRule = ruleResult;
      } else if (ruleResult.rule.priorityTier === finalTier && ruleResult.score > (bestRule?.score || 0)) {
        bestRule = ruleResult;
      }
    }

    if (classifiedIntent.modifiers.urgency > 50) {
      if (finalTier > PriorityTier.SUPPORT) {
        finalTier = PriorityTier.SUPPORT;
        finalScore = Math.min(100, finalScore + 15);
      }
    }

    if (context?.customerTier && context.customerTier > 3) {
      finalScore = Math.min(100, finalScore + context.customerTier * 2);
    }

    const matrixEntry = getMatrixEntry(finalTier);
    if (matrixEntry) {
      if (finalScore > matrixEntry.scoreRange.max) {
        finalScore = matrixEntry.scoreRange.max;
      }
      if (finalScore < matrixEntry.scoreRange.min) {
        finalScore = matrixEntry.scoreRange.min;
      }
    }

    return {
      ...(bestRule || { rule: null, matched: false, score: 0, matchedConditions: [] }),
      finalTier,
      finalScore,
    };
  }

  private getQueueForTier(tier: PriorityTier): string {
    const queueMap: Record<PriorityTier, string> = {
      [PriorityTier.EMERGENCY]: 'emergency-response',
      [PriorityTier.PAYMENT_FRAUD]: 'payment-security',
      [PriorityTier.SUPPORT]: 'customer-support',
      [PriorityTier.DOMAIN_EXPERT]: 'domain-experts',
      [PriorityTier.SALES]: 'sales',
      [PriorityTier.LOYALTY]: 'loyalty',
      [PriorityTier.ANALYTICS]: 'analytics',
    };
    return queueMap[tier] || 'general';
  }

  private calculateSLADeadline(tier: PriorityTier): Date {
    const matrixEntry = getMatrixEntry(tier);
    if (!matrixEntry) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const deadlineMs = matrixEntry.responseTimeSla.target * 1000;
    return new Date(Date.now() + deadlineMs);
  }

  private async persistDecision(
    result: PriorityResolutionResult,
    classifiedIntent: ClassifiedIntent
  ): Promise<void> {
    try {
      const decision = new RoutingDecision({
        requestId: result.requestId,
        intent: classifiedIntent.intent,
        intentType: classifiedIntent.primaryType,
        priorityTier: result.decision.priorityTier,
        priorityScore: result.decision.priorityScore,
        routingStrategy: RoutingStrategy.PRIORITY,
        targetAgent: result.decision.targetAgent,
        targetQueue: result.decision.targetQueue,
        slaDeadline: result.decision.slaDeadline,
        confidence: result.decision.confidence,
        factors: [],
        status: DecisionStatus.COMPLETED,
        processingTimeMs: result.processingTimeMs,
        metadata: result as unknown as Record<string, unknown>,
      });

      await decision.save();

      if (this.redis) {
        const cacheKey = `${config.redis.keyPrefix}decision:${result.requestId}`;
        await this.redis.setex(
          cacheKey,
          config.cache.ttlSeconds,
          JSON.stringify(result)
        );
      }

      logger.debug('Decision persisted', { requestId: result.requestId });
    } catch (error) {
      logger.error('Failed to persist decision', {
        requestId: result.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getDecision(requestId: string): Promise<PriorityResolutionResult | null> {
    if (this.redis) {
      const cacheKey = `${config.redis.keyPrefix}decision:${requestId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as PriorityResolutionResult;
      }
    }

    const decision = await RoutingDecision.findOne({ requestId });
    if (!decision) {
      return null;
    }

    const result: PriorityResolutionResult = {
      requestId: decision.requestId,
      decision: {
        priorityTier: decision.priorityTier,
        priorityTierName: PriorityTierNames[decision.priorityTier],
        priorityScore: decision.priorityScore,
        routingStrategy: decision.routingStrategy,
        targetAgent: decision.targetAgent,
        targetQueue: decision.targetQueue,
        slaDeadline: decision.slaDeadline || undefined,
        confidence: decision.confidence,
      },
      classification: {
        primaryType: decision.intentType,
        confidence: decision.confidence,
        detectedPatterns: [],
      },
      matchedRules: [],
      modifiers: {
        urgency: 0,
        complexity: 0,
        customerTier: 0,
        businessImpact: 0,
        domainMatch: null,
      },
      processingTimeMs: decision.processingTimeMs || 0,
      timestamp: decision.createdAt,
    };

    return result;
  }

  async getPendingDecisions(limit = 100): Promise<IRoutingDecision[]> {
    return RoutingDecision.find({ status: DecisionStatus.PENDING })
      .sort({ createdAt: 1 })
      .limit(limit);
  }

  async getDecisionsByTier(
    tier: PriorityTier,
    status?: DecisionStatus
  ): Promise<IRoutingDecision[]> {
    const query: Record<string, unknown> = { priorityTier: tier };
    if (status) {
      query.status = status;
    }
    return RoutingDecision.find(query).sort({ createdAt: -1 });
  }
}

export const priorityResolver = new PriorityResolver();

export default priorityResolver;
