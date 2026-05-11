import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface LoyaltyTriggerRequest {
  userId: string;
  triggerType: TriggerType;
  context: TriggerContext;
  currentTier: Tier;
  currentPoints: number;
}

export type TriggerType =
  | 'purchase'
  | 'signup'
  | 'referral'
  | 'review'
  | 'social_share'
  | 'birthday'
  | 'anniversary'
  | 'milestone'
  | 'engagement'
  | 'dormancy';

export interface TriggerContext {
  transactionId?: string;
  amount?: number;
  source?: string;
  referralCode?: string;
  reviewRating?: number;
  platform?: string;
  milestoneType?: 'points' | 'purchases' | 'reviews';
  milestoneValue?: number;
  lastActivityDate?: string;
  inactivityDays?: number;
}

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTriggerResult {
  triggered: boolean;
  triggerId: string;
  triggerType: TriggerType;
  actions: LoyaltyAction[];
  pointsAwarded: number;
  newBalance: number;
  tierProgress?: TierProgress;
  message: LoyaltyMessage;
  nextTrigger?: NextTrigger;
  processingTimeMs: number;
}

export interface LoyaltyAction {
  type: 'award_points' | 'tier_upgrade' | 'vip_access' | 'special_offer' | 'notification' | 'badge_earned';
  details: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
}

export interface TierProgress {
  currentTier: Tier;
  nextTier: Tier | null;
  pointsToNextTier: number;
  percentageProgress: number;
  bonusMultiplier: number;
}

export interface LoyaltyMessage {
  headline: string;
  body: string;
  cta?: string;
  templateId: string;
}

export interface NextTrigger {
  type: TriggerType;
  estimatedDays: number;
  incentive: string;
}

export interface LoyaltyRule {
  id: string;
  triggerType: TriggerType;
  condition: (request: LoyaltyTriggerRequest) => boolean;
  pointsAwarded: number;
  multiplier: number;
  actions: LoyaltyAction[];
  message: Omit<LoyaltyMessage, 'templateId'>;
  cooldown: number; // hours
}

const TIER_THRESHOLDS: Record<Tier, number> = {
  bronze: 0,
  silver: 5000,
  gold: 20000,
  platinum: 50000,
};

const TIER_MULTIPLIERS: Record<Tier, number> = {
  bronze: 1.0,
  silver: 1.25,
  gold: 1.5,
  platinum: 2.0,
};

const POINTS_CONFIG = {
  baseMultiplier: 1,
  bonusEvents: {
    purchase: 1, // 1 point per $1
    review: 50,
    referral: 500,
    socialShare: 25,
    signup: 100,
  },
};

export class LoyaltyTriggerEngine {
  private logger: Logger;
  private rules: LoyaltyRule[];
  private cooldowns: Map<string, number>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.rules = this.initializeRules();
    this.cooldowns = new Map();
  }

  private initializeRules(): LoyaltyRule[] {
    return [
      // Purchase triggers
      {
        id: 'purchase_standard',
        triggerType: 'purchase',
        condition: (req) => req.context.amount !== undefined && req.context.amount > 0,
        pointsAwarded: 0, // Calculated dynamically
        multiplier: 1,
        actions: [
          { type: 'award_points', details: {}, priority: 'high' },
        ],
        message: { headline: 'Points Earned!', body: 'Thank you for your purchase' },
        cooldown: 0,
      },
      {
        id: 'purchase_ milestone',
        triggerType: 'milestone',
        condition: (req) => req.context.milestoneType === 'purchases',
        pointsAwarded: 500,
        multiplier: 1,
        actions: [
          { type: 'award_points', details: { bonus: true }, priority: 'high' },
          { type: 'badge_earned', details: { badge: 'milestone_achiever' }, priority: 'medium' },
        ],
        message: { headline: 'Milestone Reached!', body: 'You\'ve made {value} purchases!' },
        cooldown: 0,
      },
      // Referral triggers
      {
        id: 'referral_success',
        triggerType: 'referral',
        condition: (req) => req.context.referralCode !== undefined,
        pointsAwarded: 500,
        multiplier: 1,
        actions: [
          { type: 'award_points', details: { type: 'referral_bonus' }, priority: 'high' },
          { type: 'special_offer', details: { offer: 'referral_discount' }, priority: 'medium' },
        ],
        message: { headline: 'Referral Success!', body: 'Your friend joined. Enjoy your reward!' },
        cooldown: 0,
      },
      // Review triggers
      {
        id: 'review_posted',
        triggerType: 'review',
        condition: (req) => req.context.reviewRating !== undefined && req.context.reviewRating >= 4,
        pointsAwarded: 50,
        multiplier: 1,
        actions: [
          { type: 'award_points', details: { type: 'review_bonus' }, priority: 'medium' },
        ],
        message: { headline: 'Thanks for your review!', body: 'You earned bonus points' },
        cooldown: 24, // 24 hours
      },
      // Social triggers
      {
        id: 'social_share',
        triggerType: 'social_share',
        condition: (req) => req.context.platform !== undefined,
        pointsAwarded: 25,
        multiplier: 1,
        actions: [
          { type: 'award_points', details: { type: 'social_share' }, priority: 'low' },
        ],
        message: { headline: 'Shared!', body: 'Thanks for spreading the word' },
        cooldown: 4,
      },
      // Birthday trigger
      {
        id: 'birthday_bonus',
        triggerType: 'birthday',
        condition: () => true,
        pointsAwarded: 200,
        multiplier: 2,
        actions: [
          { type: 'award_points', details: { type: 'birthday_bonus' }, priority: 'high' },
          { type: 'special_offer', details: { offer: 'birthday_special' }, priority: 'high' },
        ],
        message: { headline: 'Happy Birthday!', body: 'Enjoy bonus points and a special offer!' },
        cooldown: 0,
      },
      // Anniversary trigger
      {
        id: 'anniversary_bonus',
        triggerType: 'anniversary',
        condition: () => true,
        pointsAwarded: 500,
        multiplier: 1.5,
        actions: [
          { type: 'award_points', details: { type: 'anniversary_bonus' }, priority: 'high' },
          { type: 'vip_access', details: { duration: '30d' }, priority: 'medium' },
        ],
        message: { headline: 'Happy Anniversary!', body: 'Celebrating {years} years with us!' },
        cooldown: 0,
      },
      // Dormancy re-engagement
      {
        id: 'dormancy_winback',
        triggerType: 'dormancy',
        condition: (req) => req.context.inactivityDays !== undefined && req.context.inactivityDays >= 30,
        pointsAwarded: 100,
        multiplier: 1.5,
        actions: [
          { type: 'award_points', details: { type: 'winback' }, priority: 'medium' },
          { type: 'special_offer', details: { offer: 'come_back' }, priority: 'high' },
        ],
        message: { headline: 'We Miss You!', body: 'Welcome back with bonus points!' },
        cooldown: 0,
      },
      // Tier upgrade
      {
        id: 'tier_upgrade',
        triggerType: 'milestone',
        condition: (req) => req.context.milestoneType === 'tier',
        pointsAwarded: 1000,
        multiplier: 2,
        actions: [
          { type: 'tier_upgrade', details: {}, priority: 'high' },
          { type: 'vip_access', details: { duration: '90d' }, priority: 'high' },
        ],
        message: { headline: 'Congratulations!', body: 'You\'ve reached {tier} status!' },
        cooldown: 0,
      },
    ];
  }

  async evaluateTrigger(request: LoyaltyTriggerRequest): Promise<LoyaltyTriggerResult> {
    const startTime = Date.now();
    const triggerId = uuidv4();

    try {
      this.logger.info({
        triggerId,
        userId: request.userId,
        triggerType: request.triggerType,
        currentTier: request.currentTier,
        currentPoints: request.currentPoints,
      }, 'Evaluating loyalty trigger');

      // Check cooldown
      const cooldownKey = `${request.userId}:${request.triggerType}`;
      const lastTriggered = this.cooldowns.get(cooldownKey);
      if (lastTriggered) {
        const cooldownRule = this.rules.find(r => r.triggerType === request.triggerType);
        const hoursSinceLastTrigger = (Date.now() - lastTriggered) / (1000 * 60 * 60);
        if (cooldownRule && hoursSinceLastTrigger < cooldownRule.cooldown) {
          return this.createCooldownResult(triggerId, request, cooldownRule.cooldown - hoursSinceLastTrigger);
        }
      }

      // Find matching rules
      const matchingRules = this.rules.filter(rule => {
        if (rule.triggerType !== request.triggerType) return false;
        return rule.condition(request);
      });

      if (matchingRules.length === 0) {
        return this.createNoMatchResult(triggerId, request);
      }

      // Calculate points
      let totalPoints = 0;
      const actions: LoyaltyAction[] = [];

      for (const rule of matchingRules) {
        let points = rule.pointsAwarded;

        // Apply tier multiplier
        points *= TIER_MULTIPLIERS[request.currentTier];

        // Apply rule multiplier
        points *= rule.multiplier;

        // For purchases, calculate based on amount
        if (request.triggerType === 'purchase' && request.context.amount) {
          points = Math.floor(request.context.amount) * POINTS_CONFIG.baseMultiplier;
          points *= TIER_MULTIPLIERS[request.currentTier];
        }

        totalPoints += points;

        // Collect actions
        for (const action of rule.actions) {
          actions.push({ ...action, details: { ...action.details, ruleId: rule.id } });
        }
      }

      const newBalance = request.currentPoints + totalPoints;

      // Check for tier upgrade
      const tierProgress = this.calculateTierProgress(newBalance, request.currentTier);

      // Update cooldown
      this.cooldowns.set(cooldownKey, Date.now());

      // Generate message
      const primaryRule = matchingRules[0];
      const message = this.generateMessage(primaryRule.message, request, totalPoints, tierProgress);

      // Determine next trigger
      const nextTrigger = this.estimateNextTrigger(request);

      const result: LoyaltyTriggerResult = {
        triggered: true,
        triggerId,
        triggerType: request.triggerType,
        actions,
        pointsAwarded: totalPoints,
        newBalance,
        tierProgress: tierProgress.upgraded ? {
          currentTier: tierProgress.nextTier!,
          nextTier: this.getNextTier(tierProgress.nextTier!),
          pointsToNextTier: tierProgress.pointsToNextTier,
          percentageProgress: tierProgress.percentageProgress,
          bonusMultiplier: TIER_MULTIPLIERS[tierProgress.nextTier!],
        } : undefined,
        message,
        nextTrigger,
        processingTimeMs: Date.now() - startTime,
      };

      this.logger.info({
        triggerId,
        userId: request.userId,
        pointsAwarded: totalPoints,
        newBalance,
        tierUpgraded: tierProgress.upgraded,
        actionsCount: actions.length,
      }, 'Loyalty trigger processed');

      return result;

    } catch (error) {
      const err = error as Error;
      this.logger.error({ triggerId, error: err.message }, 'Loyalty trigger evaluation failed');
      throw error;
    }
  }

  private calculateTierProgress(
    totalPoints: number,
    currentTier: Tier
  ): { upgraded: boolean; nextTier: Tier | null; pointsToNextTier: number; percentageProgress: number } {
    const nextTier = this.getNextTier(currentTier);

    if (!nextTier) {
      return { upgraded: false, nextTier: null, pointsToNextTier: 0, percentageProgress: 100 };
    }

    const nextTierThreshold = TIER_THRESHOLDS[nextTier];
    const currentTierThreshold = TIER_THRESHOLDS[currentTier];
    const tierRange = nextTierThreshold - currentTierThreshold;
    const pointsInTier = totalPoints - currentTierThreshold;
    const percentageProgress = (pointsInTier / tierRange) * 100;

    const upgraded = totalPoints >= nextTierThreshold;

    return {
      upgraded,
      nextTier: upgraded ? nextTier : currentTier,
      pointsToNextTier: Math.max(0, nextTierThreshold - totalPoints),
      percentageProgress: Math.min(100, percentageProgress),
    };
  }

  private getNextTier(tier: Tier): Tier | null {
    const tiers: Tier[] = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(tier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  }

  private generateMessage(
    template: Omit<LoyaltyMessage, 'templateId'>,
    request: LoyaltyTriggerRequest,
    points: number,
    tierProgress: { upgraded: boolean; nextTier: Tier | null }
  ): LoyaltyMessage {
    let headline = template.headline;
    let body = template.body;

    // Replace placeholders
    headline = headline.replace('{value}', String(request.context.milestoneValue || ''));
    headline = headline.replace('{tier}', tierProgress.nextTier || '');
    headline = headline.replace('{years}', String(request.context.milestoneValue || ''));

    body = body.replace('{points}', String(points));
    body = body.replace('{value}', String(request.context.milestoneValue || ''));
    body = body.replace('{tier}', tierProgress.nextTier || '');

    const cta = this.getCtaForTrigger(request.triggerType);

    return {
      headline,
      body,
      cta,
      templateId: `loyalty_${request.triggerType}_${Date.now()}`,
    };
  }

  private getCtaForTrigger(triggerType: TriggerType): string | undefined {
    const ctas: Partial<Record<TriggerType, string>> = {
      purchase: 'Shop Again',
      referral: 'Share Your Code',
      birthday: 'Claim Your Gift',
      anniversary: 'View Your Benefits',
      dormancy: 'Welcome Back',
    };
    return ctas[triggerType];
  }

  private estimateNextTrigger(request: LoyaltyTriggerRequest): NextTrigger | undefined {
    const estimates: Partial<Record<TriggerType, { days: number; incentive: string }>> = {
      purchase: { days: 7, incentive: 'Double points on your next purchase' },
      review: { days: 14, incentive: 'Share a review and earn bonus points' },
      social_share: { days: 3, incentive: 'Share with friends for rewards' },
      referral: { days: 30, incentive: 'Refer a friend, earn 500 points' },
    };

    const estimate = estimates[request.triggerType];
    if (!estimate) return undefined;

    return {
      type: request.triggerType,
      estimatedDays: estimate.days,
      incentive: estimate.incentive,
    };
  }

  private createCooldownResult(
    triggerId: string,
    request: LoyaltyTriggerRequest,
    remainingHours: number
  ): LoyaltyTriggerResult {
    return {
      triggered: false,
      triggerId,
      triggerType: request.triggerType,
      actions: [],
      pointsAwarded: 0,
      newBalance: request.currentPoints,
      message: {
        headline: 'Please wait',
        body: `This offer can be claimed again in ${Math.ceil(remainingHours)} hours`,
        templateId: 'cooldown_message',
      },
      processingTimeMs: 0,
    };
  }

  private createNoMatchResult(triggerId: string, request: LoyaltyTriggerRequest): LoyaltyTriggerResult {
    return {
      triggered: false,
      triggerId,
      triggerType: request.triggerType,
      actions: [],
      pointsAwarded: 0,
      newBalance: request.currentPoints,
      message: {
        headline: 'Thanks!',
        body: 'Keep engaging to earn more points',
        templateId: 'no_match_message',
      },
      processingTimeMs: 0,
    };
  }

  // Register custom rule
  registerRule(rule: LoyaltyRule): void {
    this.rules.push(rule);
    this.logger.info({ ruleId: rule.id, triggerType: rule.triggerType }, 'Registered custom loyalty rule');
  }

  // Clear cooldown for testing
  clearCooldown(userId: string, triggerType: TriggerType): void {
    this.cooldowns.delete(`${userId}:${triggerType}`);
  }
}
