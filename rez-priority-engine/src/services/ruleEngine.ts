import { IPriorityRule, PriorityRule } from '../models/PriorityRule';
import { ClassifiedIntent } from './intentClassifier';
import { logger } from '../utils/logger.js';

export interface RuleEvaluationResult {
  rule: IPriorityRule;
  matched: boolean;
  score: number;
  matchedConditions: Array<{
    field: string;
    operator: string;
    expected: unknown;
    actual: unknown;
  }>;
}

export interface RuleContext {
  intent: ClassifiedIntent;
  metadata?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  domain?: string;
}

type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'nin'
  | 'regex';

export class RuleEngine {
  private rulesCache: Map<string, IPriorityRule[]> = new Map();
  private cacheExpiry = 5 * 60 * 1000;
  private lastCacheUpdate = 0;

  async evaluateRules(
    intent: ClassifiedIntent,
    context?: Partial<RuleContext>
  ): Promise<RuleEvaluationResult[]> {
    const rules = await this.getActiveRules(context?.domain);
    const results: RuleEvaluationResult[] = [];

    for (const rule of rules) {
      const result = this.evaluateRule(rule, intent, context);
      results.push(result);
    }

    results.sort((a, b) => {
      if (a.matched !== b.matched) {
        return a.matched ? -1 : 1;
      }
      return b.score - a.score;
    });

    logger.debug('Rule evaluation completed', {
      intent: intent.intent.substring(0, 50),
      totalRules: rules.length,
      matchedRules: results.filter(r => r.matched).length,
    });

    return results;
  }

  async getBestMatchingRule(
    intent: ClassifiedIntent,
    context?: Partial<RuleContext>
  ): Promise<RuleEvaluationResult | null> {
    const results = await this.evaluateRules(intent, context);
    return results.find(r => r.matched) || null;
  }

  private async getActiveRules(domain?: string): Promise<IPriorityRule[]> {
    const cacheKey = domain || 'global';
    const now = Date.now();

    if (
      this.rulesCache.has(cacheKey) &&
      now - this.lastCacheUpdate < this.cacheExpiry
    ) {
      return this.rulesCache.get(cacheKey)!;
    }

    const query: Record<string, unknown> = { enabled: true };
    if (domain) {
      query.$or = [{ domain }, { domain: { $exists: false } }];
    }

    const rules = await PriorityRule.find(query)
      .sort({ priorityTier: 1, name: 1 })
      .lean();

    this.rulesCache.set(cacheKey, rules as IPriorityRule[]);
    this.lastCacheUpdate = now;

    return rules as IPriorityRule[];
  }

  private evaluateRule(
    rule: IPriorityRule,
    intent: ClassifiedIntent,
    context?: Partial<RuleContext>
  ): RuleEvaluationResult {
    const matchedConditions: RuleEvaluationResult['matchedConditions'] = [];
    let totalScore = 0;

    const intentData = {
      intent: intent.intent,
      primaryType: intent.primaryType,
      confidence: intent.confidence,
      priorityTier: intent.priorityTier,
      priorityScore: intent.priorityScore,
      ...intent.modifiers,
      ...context?.metadata,
    };

    for (const condition of rule.conditions) {
      const actualValue = this.getFieldValue(intentData, condition.field);
      const expectedValue = condition.value;

      const isMatch = this.evaluateCondition(
        actualValue,
        condition.operator as ConditionOperator,
        expectedValue
      );

      if (isMatch) {
        matchedConditions.push({
          field: condition.field,
          operator: condition.operator,
          expected: expectedValue,
          actual: actualValue,
        });
        totalScore += 10;
      }
    }

    const matched = rule.conditions.length === 0 || matchedConditions.length > 0;
    const score = matched ? totalScore + (100 - rule.priorityTier * 10) : 0;

    return {
      rule,
      matched,
      score,
      matchedConditions,
    };
  }

  private getFieldValue(data: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = data;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateCondition(
    actual: unknown,
    operator: ConditionOperator,
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;

      case 'neq':
        return actual !== expected;

      case 'gt':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

      case 'gte':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;

      case 'lt':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

      case 'lte':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;

      case 'contains':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.toLowerCase().includes(expected.toLowerCase());
        }
        if (Array.isArray(actual)) {
          return actual.some(item => this.evaluateCondition(item, 'eq', expected));
        }
        return false;

      case 'startsWith':
        return typeof actual === 'string' && typeof expected === 'string' &&
          actual.toLowerCase().startsWith(expected.toLowerCase());

      case 'endsWith':
        return typeof actual === 'string' && typeof expected === 'string' &&
          actual.toLowerCase().endsWith(expected.toLowerCase());

      case 'in':
        if (Array.isArray(expected)) {
          return expected.some(item => this.evaluateCondition(actual, 'eq', item));
        }
        return false;

      case 'nin':
        if (Array.isArray(expected)) {
          return !expected.some(item => this.evaluateCondition(actual, 'eq', item));
        }
        return true;

      case 'regex':
        if (typeof actual === 'string' && typeof expected === 'string') {
          try {
            const regex = new RegExp(expected, 'i');
            return regex.test(actual);
          } catch {
            logger.warn('Invalid regex pattern', { pattern: expected });
            return false;
          }
        }
        return false;

      default:
        logger.warn('Unknown operator', { operator });
        return false;
    }
  }

  async createRule(ruleData: Partial<IPriorityRule>): Promise<IPriorityRule> {
    const rule = new PriorityRule(ruleData);
    await rule.save();
    this.invalidateCache();
    logger.info('Rule created', { ruleId: rule._id, name: rule.name });
    return rule;
  }

  async updateRule(ruleId: string, updates: Partial<IPriorityRule>): Promise<IPriorityRule | null> {
    const rule = await PriorityRule.findByIdAndUpdate(
      ruleId,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (rule) {
      this.invalidateCache();
      logger.info('Rule updated', { ruleId, name: rule.name });
    }
    return rule;
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    const result = await PriorityRule.findByIdAndDelete(ruleId);
    if (result) {
      this.invalidateCache();
      logger.info('Rule deleted', { ruleId });
      return true;
    }
    return false;
  }

  invalidateCache(): void {
    this.rulesCache.clear();
    this.lastCacheUpdate = 0;
    logger.debug('Rule engine cache invalidated');
  }

  async getRules(domain?: string): Promise<IPriorityRule[]> {
    return this.getActiveRules(domain);
  }
}

export const ruleEngine = new RuleEngine();

export default ruleEngine;
