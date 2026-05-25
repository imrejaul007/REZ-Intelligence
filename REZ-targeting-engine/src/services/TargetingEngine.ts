import { FrequencyCap } from '../models/FrequencyCap';
import { BudgetPacing } from '../models/BudgetPacing';
import { PREDEFINED_SEGMENTS, CHANNEL_CONFIG, FREQUENCY_CAPPING_DEFAULTS } from '../config/constants';
import {
  UserContext,
  UserAttributes,
  CampaignRules,
  AudiencePreview,
  TargetingRules,
  SegmentCriteria,
  SegmentCondition
} from '../types';

export interface TargetingResult {
  eligible: boolean;
  match_reasons: string[];
  exclusion_reasons: string[];
  segments_matched: string[];
  segments_excluded: string[];
  confidence_score: number;
  priority: number;
}

export interface FrequencyCheckResult {
  allowed: boolean;
  reason?: string;
  current_counts: {
    daily: number;
    weekly: number;
    lifetime: number;
  };
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  remaining_daily: number;
  remaining_lifetime?: number;
  can_afford_impressions: number;
}

export interface ABTestAssignment {
  variant_id: string;
  variant_name: string;
  ad_template_id: string;
  weight: number;
}

export interface CostEstimate {
  base_cost: number;
  channel_multiplier: number;
  segment_adjustment: number;
  total_cost: number;
}

class TargetingEngine {
  /**
   * Main method to evaluate if a user matches a campaign's targeting rules
   */
  async evaluateTargeting(
    userContext: UserContext,
    targetingRules: TargetingRules
  ): Promise<TargetingResult> {
    const result: TargetingResult = {
      eligible: true,
      match_reasons: [],
      exclusion_reasons: [],
      segments_matched: [],
      segments_excluded: [],
      confidence_score: 0,
      priority: 0
    };

    // Check segment inclusion
    if (targetingRules.user_segments.length > 0) {
      const segmentMatch = this.checkSegmentInclusion(
        userContext,
        targetingRules.user_segments
      );
      result.segments_matched = segmentMatch.matched;
      result.match_reasons.push(...segmentMatch.reasons);

      if (segmentMatch.matched.length === 0) {
        result.eligible = false;
        result.exclusion_reasons.push('User does not match unknown required segments');
        return result;
      }
    }

    // Check exclusions
    if (targetingRules.exclusions.length > 0) {
      const exclusionCheck = this.checkExclusions(
        userContext,
        targetingRules.exclusions
      );
      result.segments_excluded = exclusionCheck.excluded;

      if (exclusionCheck.excluded.length > 0) {
        result.eligible = false;
        result.exclusion_reasons.push(
          `User belongs to excluded segments: ${exclusionCheck.excluded.join(', ')}`
        );
        return result;
      }
    }

    // Check recency
    if (targetingRules.recency_days > 0) {
      const recencyCheck = this.checkRecency(userContext.attributes, targetingRules.recency_days);
      if (!recencyCheck.pass) {
        result.eligible = false;
        result.exclusion_reasons.push(recencyCheck.reason);
        return result;
      }
      result.match_reasons.push(recencyCheck.reason);
    }

    // Check minimum orders
    if (targetingRules.min_orders > 0) {
      const ordersCheck = this.checkMinOrders(userContext.attributes, targetingRules.min_orders);
      if (!ordersCheck.pass) {
        result.eligible = false;
        result.exclusion_reasons.push(ordersCheck.reason);
        return result;
      }
      result.match_reasons.push(ordersCheck.reason);
    }

    // Check custom conditions
    if (targetingRules.custom_conditions) {
      const customCheck = this.checkCustomConditions(userContext.attributes, targetingRules.custom_conditions);
      if (!customCheck.pass) {
        result.eligible = false;
        result.exclusion_reasons.push(customCheck.reason);
        return result;
      }
      result.match_reasons.push(...customCheck.reasons);
    }

    // Calculate confidence score
    result.confidence_score = this.calculateConfidenceScore(
      result.segments_matched,
      result.match_reasons
    );

    // Calculate priority based on segment priority
    result.priority = this.calculatePriority(result.segments_matched);

    return result;
  }

  /**
   * Check if user belongs to unknown of the required segments
   */
  checkSegmentInclusion(userContext: UserContext, requiredSegments: string[]): {
    matched: string[];
    reasons: string[];
  } {
    const matched: string[] = [];
    const reasons: string[] = [];

    for (const segmentId of requiredSegments) {
      const segmentDef = PREDEFINED_SEGMENTS[segmentId as keyof typeof PREDEFINED_SEGMENTS];

      if (!segmentDef) {
        // Check if it's a dynamic segment based on user's segment array
        if (userContext.segments.includes(segmentId)) {
          matched.push(segmentId);
          reasons.push(`User belongs to segment: ${segmentId}`);
        }
        continue;
      }

      // Evaluate predefined segment criteria
      const isMatch = this.evaluateSegmentCriteria(
        userContext.attributes,
        segmentDef.criteria as unknown
      );

      if (isMatch) {
        matched.push(segmentId);
        reasons.push(`Matches segment criteria: ${segmentDef.name}`);
      }
    }

    return { matched, reasons };
  }

  /**
   * Check if user belongs to unknown excluded segments
   */
  checkExclusions(userContext: UserContext, excludedSegments: string[]): {
    excluded: string[];
  } {
    const excluded: string[] = [];

    for (const segmentId of excludedSegments) {
      const segmentDef = PREDEFINED_SEGMENTS[segmentId as keyof typeof PREDEFINED_SEGMENTS];

      if (!segmentDef) {
        // Check dynamic segments
        if (userContext.segments.includes(segmentId)) {
          excluded.push(segmentId);
        }
        continue;
      }

      // Evaluate predefined segment criteria
      const isMatch = this.evaluateSegmentCriteria(
        userContext.attributes,
        segmentDef.criteria as unknown
      );

      if (isMatch) {
        excluded.push(segmentId);
      }
    }

    return { excluded };
  }

  /**
   * Evaluate segment criteria against user attributes
   */
  evaluateSegmentCriteria(attributes: UserAttributes, criteria: SegmentCriteria): boolean {
    const results = criteria.conditions.map(condition =>
      this.evaluateCondition(attributes, condition)
    );

    if (criteria.combinator === 'AND') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(attributes: UserAttributes, condition: SegmentCondition): boolean {
    const value = (attributes as unknown)[condition.field];

    if (value === undefined || value === null) {
      return false;
    }

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return value > condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lt':
        return value < condition.value;
      case 'lte':
        return value <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'between':
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          return value >= condition.value[0] && value <= condition.value[1];
        }
        return false;
      case 'contains':
        if (typeof value === 'string') {
          return value.toLowerCase().includes(String(condition.value).toLowerCase());
        }
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase().includes(String(condition.value).toLowerCase()));
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Check recency requirement
   */
  checkRecency(attributes: UserAttributes, recencyDays: number): {
    pass: boolean;
    reason?: string;
  } {
    if (attributes.days_since_last_order <= recencyDays) {
      return {
        pass: true,
        reason: `Last order within ${recencyDays} days (${attributes.days_since_last_order} days ago)`
      };
    }
    return {
      pass: false,
      reason: `Last order was ${attributes.days_since_last_order} days ago (required: within ${recencyDays} days)`
    };
  }

  /**
   * Check minimum orders requirement
   */
  checkMinOrders(attributes: UserAttributes, minOrders: number): {
    pass: boolean;
    reason?: string;
  } {
    if (attributes.total_orders >= minOrders) {
      return {
        pass: true,
        reason: `Has ${attributes.total_orders} orders (minimum: ${minOrders})`
      };
    }
    return {
      pass: false,
      reason: `Has only ${attributes.total_orders} orders (required: ${minOrders})`
    };
  }

  /**
   * Check custom conditions
   */
  checkCustomConditions(attributes: UserAttributes, conditions: Record<string, unknown>): {
    pass: boolean;
    reason?: string;
    reasons: string[];
  } {
    const reasons: string[] = [];

    for (const [field, condition] of Object.entries(conditions)) {
      const fieldValue = (attributes as unknown)[field];
      if (fieldValue === undefined) {
        return { pass: false, reason: `Unknown field: ${field}`, reasons: [] };
      }

      if (typeof condition === 'object' && condition !== null) {
        // Complex condition
        if (!this.evaluateCondition(attributes, { field, ...condition } as SegmentCondition)) {
          return {
            pass: false,
            reason: `Custom condition failed for ${field}`,
            reasons: []
          };
        }
        reasons.push(`Custom condition satisfied: ${field}`);
      } else {
        // Simple equality check
        if (fieldValue !== condition) {
          return {
            pass: false,
            reason: `${field} value ${fieldValue} does not match required ${condition}`,
            reasons: []
          };
        }
        reasons.push(`Custom condition satisfied: ${field} = ${condition}`);
      }
    }

    return { pass: true, reasons };
  }

  /**
   * Calculate confidence score based on segment matches
   */
  calculateConfidenceScore(segmentsMatched: string[], reasons: string[]): number {
    if (segmentsMatched.length === 0) return 0;

    // Base score from number of matched segments
    let score = Math.min(segmentsMatched.length * 20, 60);

    // Additional points for specificity
    score += Math.min(reasons.length * 10, 30);

    // Bonus for high-value segments
    const highValueBonus = segmentsMatched.includes('high_value') ? 10 : 0;
    score += highValueBonus;

    return Math.min(score, 100);
  }

  /**
   * Calculate priority based on segment priorities
   */
  calculatePriority(segmentsMatched: string[]): number {
    let maxPriority = 0;

    for (const segmentId of segmentsMatched) {
      const segmentDef = PREDEFINED_SEGMENTS[segmentId as keyof typeof PREDEFINED_SEGMENTS];
      if (segmentDef?.priority && segmentDef.priority > maxPriority) {
        maxPriority = segmentDef.priority;
      }
    }

    return maxPriority || 5; // Default priority
  }

  /**
   * Check frequency capping for a user
   */
  async checkFrequencyCap(
    userId: string,
    channel: string,
    campaignId?: string
  ): Promise<FrequencyCheckResult> {
    const result = await (FrequencyCap as unknown).canImpress(userId, channel, campaignId);
    return {
      allowed: result.allowed,
      reason: result.reason,
      current_counts: {
        daily: (result.current_counts as unknown).daily || 0,
        weekly: (result.current_counts as unknown).weekly || 0,
        lifetime: (result.current_counts as unknown).lifetime || 0
      }
    };
  }

  /**
   * Record an impression for frequency capping
   */
  async recordImpression(
    userId: string,
    channel: string,
    campaignId?: string
  ): Promise<void> {
    await (FrequencyCap as unknown).recordImpression(userId, channel, campaignId);
  }

  /**
   * Check budget availability for campaign
   */
  async checkBudget(
    campaignId: string,
    costPerImpression: number,
    dailyLimit: number,
    lifetimeLimit?: number
  ): Promise<BudgetCheckResult> {
    const result = await (BudgetPacing as unknown).canSpend(campaignId, costPerImpression, dailyLimit, lifetimeLimit);

    const dailyRemaining = (result.remaining_budget as unknown).daily || 0;
    const lifetimeRemaining = (result.remaining_budget as unknown).lifetime || Infinity;

    return {
      allowed: result.allowed,
      reason: result.reason,
      remaining_daily: dailyRemaining,
      remaining_lifetime: lifetimeLimit ? lifetimeRemaining : undefined,
      can_afford_impressions: Math.floor(Math.min(dailyRemaining, lifetimeRemaining) / costPerImpression)
    };
  }

  /**
   * Record spend against campaign budget
   */
  async recordSpend(
    campaignId: string,
    amount: number,
    dailyLimit: number,
    lifetimeLimit?: number
  ): Promise<void> {
    await (BudgetPacing as unknown).recordSpend(campaignId, amount, dailyLimit, lifetimeLimit);
  }

  /**
   * Calculate pacing-aware budget allocation
   */
  calculatePacingAllocation(
    pacingMode: 'even' | 'accelerated' | 'front_loaded',
    dailyLimit: number,
    currentHour?: number
  ): number {
    return (BudgetPacing as unknown).calculatePacingAmount(pacingMode, dailyLimit, currentHour);
  }

  /**
   * Assign user to A/B test variant
   */
  assignABTestVariant(
    userId: string,
    variants: Array<{ id: string; name: string; weight: number; ad_template_id: string }>
  ): ABTestAssignment | null {
    if (!variants || variants.length === 0) return null;

    // Calculate total weight
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) return null;

    // Generate deterministic assignment based on user ID
    const hash = this.hashString(userId);
    const normalizedValue = (hash % totalWeight) / totalWeight;

    // Assign to variant based on cumulative weights
    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight / totalWeight;
      if (normalizedValue <= cumulativeWeight) {
        return {
          variant_id: variant.id,
          variant_name: variant.name,
          ad_template_id: variant.ad_template_id,
          weight: variant.weight
        };
      }
    }

    // Fallback to first variant
    return {
      variant_id: variants[0].id,
      variant_name: variants[0].name,
      ad_template_id: variants[0].ad_template_id,
      weight: variants[0].weight
    };
  }

  /**
   * Calculate cost per impression with segment adjustments
   */
  calculateCost(
    channel: 'banner' | 'push' | 'in_app' | 'sms' | 'email',
    segments: string[]
  ): CostEstimate {
    const channelConfig = CHANNEL_CONFIG[channel];
    const baseCost = parseFloat(process.env.DEFAULT_COST_PER_IMPRESSION || '0.05');

    const channelMultiplier = channelConfig.cost_multiplier;
    const segmentAdjustment = this.getSegmentCostAdjustment(segments);

    const totalCost = baseCost * channelMultiplier * segmentAdjustment;

    return {
      base_cost: baseCost,
      channel_multiplier: channelMultiplier,
      segment_adjustment: segmentAdjustment,
      total_cost: Math.round(totalCost * 10000) / 10000 // Round to 4 decimals
    };
  }

  /**
   * Get cost adjustment factor based on segments
   */
  private getSegmentCostAdjustment(segments: string[]): number {
    // High-value segments have higher CPM
    const highValueSegments = ['high_value', 'foodies', 'reorder_probability_high'];
    const hasHighValue = segments.some(s => highValueSegments.includes(s));

    if (hasHighValue) {
      return 1.5; // 50% premium
    }

    // Budget-conscious segments have lower rates
    const lowValueSegments = ['budget_minders', 'churned'];
    const hasLowValue = segments.some(s => lowValueSegments.includes(s));

    if (hasLowValue) {
      return 0.8; // 20% discount
    }

    return 1.0; // Standard rate
  }

  /**
   * Calculate cost per segment (for reporting)
   */
  calculateCostPerSegment(
    channel: 'banner' | 'push' | 'in_app' | 'sms' | 'email',
    segmentId: string,
    impressions: number
  ): number {
    const costEstimate = this.calculateCost(channel, [segmentId]);
    return costEstimate.total_cost * impressions;
  }

  /**
   * Simple hash function for deterministic A/B assignment
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get optimal send time based on user preferences and campaign scheduling
   */
  calculateOptimalSendTime(
    userPreferences: { preferred_send_time?: string; timezone: string },
    campaignScheduling: { send_time: string; timezone: string; specific_time?: string }
  ): Date {
    const now = new Date();

    if (campaignScheduling.send_time === 'specific' && campaignScheduling.specific_time) {
      // Parse specific time and set for today
      const [hours, minutes] = campaignScheduling.specific_time.split(':').map(Number);
      now.setHours(hours, minutes, 0, 0);

      // If time has passed, schedule for tomorrow
      if (now <= new Date()) {
        now.setDate(now.getDate() + 1);
      }
      return now;
    }

    if (campaignScheduling.send_time === 'optimal' && userPreferences.preferred_send_time) {
      // Use user's preferred time
      return this.getNextOptimalTime(userPreferences.preferred_send_time);
    }

    if (campaignScheduling.send_time === 'optimal') {
      // Default to evening (17:00)
      return this.getNextOptimalTime('evening');
    }

    // Use campaign-specified time
    return this.getNextOptimalTime(campaignScheduling.send_time);
  }

  /**
   * Get next occurrence of optimal send time
   */
  private getNextOptimalTime(timePreference: string): Date {
    const now = new Date();
    const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const timeRanges: Record<string, { start: number; end: number }> = {
      morning: { start: 8, end: 11 },
      afternoon: { start: 12, end: 16 },
      evening: { start: 17, end: 20 },
      night: { start: 21, end: 23 }
    };

    const range = timeRanges[timePreference] || timeRanges.evening;

    // If we're before the time window, schedule within it
    if (now.getHours() < range.start) {
      baseDate.setHours(range.start, 0, 0, 0);
    } else if (now.getHours() <= range.end) {
      // We're within the window, add some random delay (0-30 min)
      baseDate.setHours(now.getHours(), now.getMinutes() + Math.floor(Math.random() * 30), 0, 0);
    } else {
      // After the window, schedule for tomorrow
      baseDate.setDate(baseDate.getDate() + 1);
      baseDate.setHours(range.start, 0, 0, 0);
    }

    return baseDate;
  }
}

export const targetingEngine = new TargetingEngine();
export default targetingEngine;
