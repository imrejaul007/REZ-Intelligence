const UserIntentProfile = require('../models/UserIntentProfile');
const { randomInt } = require('crypto');

class PushTriggerService {
  constructor() {
    this.triggers = {
      high_value_opportunity: {
        condition: (profile) => profile.current_intent?.category === 'high_value_opportunity',
        priority: 'high',
        template_type: 'high_value_offer',
        cooldown_hours: 4
      },
      cart_abandonment_risk: {
        condition: (profile) => {
          const isCartRisk = profile.current_intent?.category === 'cart_abandonment_risk';
          const noActivityHours = profile.current_session?.last_activity ?
            (Date.now() - new Date(profile.current_session.last_activity).getTime()) / (1000 * 60 * 60) : 24;
          return isCartRisk && noActivityHours > 2;
        },
        priority: 'high',
        template_type: 'cart_recovery',
        cooldown_hours: 1,
        additionalParams: {
          min_no_activity_hours: 2
        }
      },
      reactivation_needed: {
        condition: (profile) => {
          const isReactivation = profile.current_intent?.category === 'reactivation_needed';
          const daysSince = profile.metrics?.days_since_last_activity || 30;
          return isReactivation && daysSince < 30;
        },
        priority: 'medium',
        template_type: 'reactivation',
        cooldown_hours: 24,
        additionalParams: {
          max_days_since: 30
        }
      }
    };

    this.pushLimits = {
      maxPushesPerDay: 5,
      maxPushesPerUser24h: 3,
      minIntervalMinutes: 30
    };
  }

  async evaluatePushEligibility(userId) {
    const profile = await UserIntentProfile.findOne({ user_id: userId });

    if (!profile) {
      return { should_push: false, reasons: ['No profile found'] };
    }

    const eligibleTriggers = [];
    const now = new Date();

    // Check push limits
    const pushCount24h = profile.push_eligibility?.push_count_24h || 0;
    if (pushCount24h >= this.pushLimits.maxPushesPerUser24h) {
      return {
        should_push: false,
        reasons: ['Daily push limit reached'],
        can_retry_at: this.getNextPushTime(profile)
      };
    }

    // Check last push time
    if (profile.push_eligibility?.last_push_at) {
      const timeSinceLastPush = (now - new Date(profile.push_eligibility.last_push_at)) / (1000 * 60);
      if (timeSinceLastPush < this.pushLimits.minIntervalMinutes) {
        return {
          should_push: false,
          reasons: ['Minimum interval not met'],
          can_retry_at: new Date(new Date(profile.push_eligibility.last_push_at).getTime() +
            this.pushLimits.minIntervalMinutes * 60 * 1000)
        };
      }
    }

    // Evaluate each trigger
    for (const [triggerName, trigger] of Object.entries(this.triggers)) {
      if (trigger.condition(profile)) {
        // Check cooldown for this specific trigger
        const triggerCooldownKey = `trigger_cooldowns.${triggerName}`;
        const lastTriggerTime = profile.push_eligibility?.[triggerCooldownKey];

        if (lastTriggerTime) {
          const cooldownMs = trigger.cooldown_hours * 60 * 60 * 1000;
          if (now - new Date(lastTriggerTime) < cooldownMs) {
            continue;
          }
        }

        eligibleTriggers.push({
          trigger: triggerName,
          priority: trigger.priority,
          template_type: trigger.template_type,
          confidence: profile.current_intent?.confidence || 0,
          additional_data: this.getTriggerData(triggerName, profile)
        });
      }
    }

    if (eligibleTriggers.length === 0) {
      return { should_push: false, reasons: ['No trigger conditions met'] };
    }

    // Sort by priority and confidence
    eligibleTriggers.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });

    const selectedTrigger = eligibleTriggers[0];

    return {
      should_push: true,
      reasons: [`Trigger: ${selectedTrigger.trigger}`],
      selected_trigger: selectedTrigger,
      all_eligible_triggers: eligibleTriggers,
      user_context: this.buildUserContext(profile)
    };
  }

  getTriggerData(triggerName, profile) {
    const baseData = {
      user_id: profile.user_id,
      intent_category: profile.current_intent?.category,
      intent_confidence: profile.current_intent?.confidence,
      mood: profile.mood_indicators
    };

    switch (triggerName) {
      case 'high_value_opportunity':
        return {
          ...baseData,
          lifetime_value: profile.metrics?.lifetime_value || 0,
          conversion_rate: profile.metrics?.conversion_rate || 0,
          avg_order_value: profile.metrics?.average_order_value || 0,
          recommendation: this.generateHighValueOffer(profile)
        };

      case 'cart_abandonment_risk':
        return {
          ...baseData,
          abandoned_cart_value: profile.urgency_signals?.abandoned_cart_value || 0,
          cart_items_count: profile.urgency_signals?.items_in_cart || 0,
          time_since_activity: profile.current_session?.last_activity ?
            (Date.now() - new Date(profile.current_session.last_activity).getTime()) / (1000 * 60 * 60) : 0,
          recommendation: this.generateCartRecoveryOffer(profile)
        };

      case 'reactivation_needed':
        return {
          ...baseData,
          days_since_activity: profile.metrics?.days_since_last_activity || 0,
          days_since_purchase: profile.metrics?.days_since_last_purchase || 0,
          past_purchases: profile.metrics?.total_purchases || 0,
          recommendation: this.generateReactivationOffer(profile)
        };

      default:
        return baseData;
    }
  }

  generateHighValueOffer(profile) {
    const offers = [
      'exclusive_member_discount',
      'early_access_sale',
      'personalized_recommendations',
      'loyalty_points_bonus'
    ];

    const recentIntents = profile.historical_intents?.slice(-5) || [];
    const viewedCategories = new Set();

    profile.signals?.browse_history?.forEach(item => {
      if (item.category) viewedCategories.add(item.category);
    });

    return {
      offer_type: offers[randomInt(0, offers.length)],
      discount_percentage: Math.min(15 + (profile.metrics?.lifetime_value || 0) / 100, 25),
      categories: Array.from(viewedCategories).slice(0, 3),
      personalized_message: `As a valued ${profile.metrics?.lifetime_value > 500 ? 'gold' : 'silver'} member...`
    };
  }

  generateCartRecoveryOffer(profile) {
    const cartValue = profile.urgency_signals?.cart_value || 0;
    const itemsCount = profile.urgency_signals?.items_in_cart || 0;

    return {
      cart_value,
      items_count: itemsCount,
      discount_offer: cartValue > 100 ? 'free_shipping' : `${Math.round(cartValue * 0.1)}%_off`,
      urgency_message: itemsCount > 0 ? 'Complete your purchase' : 'Return to your cart',
      expiry_hours: 24
    };
  }

  generateReactivationOffer(profile) {
    const daysSince = profile.metrics?.days_since_last_activity || 30;
    const pastPurchases = profile.metrics?.total_purchases || 0;

    return {
      days_away: daysSince,
      past_purchase_count: pastPurchases,
      offer_type: daysSince > 14 ? 'come_back_offer' : 'we_miss_you',
      discount_percentage: Math.min(10 + pastPurchases * 2, 25),
      personalized_message: 'We noticed you haven\'t visited recently'
    };
  }

  buildUserContext(profile) {
    return {
      device_type: profile.signals?.device_type || 'unknown',
      engagement_level: profile.mood_indicators?.engagement_level || 'medium',
      browsing_pace: profile.mood_indicators?.browsing_pace || 'normal',
      time_of_day: profile.mood_indicators?.time_of_day || 'afternoon',
      historical_intent_patterns: this.getIntentPatterns(profile),
      user_segment: this.determineUserSegment(profile)
    };
  }

  getIntentPatterns(profile) {
    const intents = profile.historical_intents || [];
    const patternCounts = {};

    intents.forEach(intent => {
      patternCounts[intent.category] = (patternCounts[intent.category] || 0) + 1;
    });

    return Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({ category, frequency: count }));
  }

  determineUserSegment(profile) {
    const ltv = profile.metrics?.lifetime_value || 0;
    const purchases = profile.metrics?.total_purchases || 0;
    const conversion = profile.metrics?.conversion_rate || 0;

    if (ltv > 1000 || purchases > 10) return 'vip';
    if (ltv > 500 || purchases > 5) return 'loyal';
    if (conversion > 0.3) return 'frequent_buyer';
    if (conversion > 0.1) return 'occasional_buyer';
    if (purchases === 0 && profile.metrics?.days_since_last_activity < 7) return 'new_browser';
    return 'inactive';
  }

  getNextPushTime(profile) {
    const lastPush = profile.push_eligibility?.last_push_at;
    if (!lastPush) return new Date();

    return new Date(new Date(lastPush).getTime() + this.pushLimits.minIntervalMinutes * 60 * 1000);
  }

  async recordPushSent(userId, triggerType) {
    await UserIntentProfile.findOneAndUpdate(
      { user_id: userId },
      {
        $set: {
          'push_eligibility.last_push_at': new Date(),
          [`push_eligibility.trigger_cooldowns.${triggerType}`]: new Date()
        },
        $inc: {
          'push_eligibility.push_count_24h': 1
        }
      },
      { new: true }
    );
  }

  async resetDailyPushCount(userId) {
    await UserIntentProfile.findOneAndUpdate(
      { user_id: userId },
      {
        $set: {
          'push_eligibility.push_count_24h': 0
        }
      }
    );
  }

  async getPushStatistics() {
    const stats = {
      total_eligible: 0,
      by_trigger: {},
      by_priority: { high: 0, medium: 0, low: 0 }
    };

    // Count profiles eligible for each trigger
    for (const [triggerName, trigger] of Object.entries(this.triggers)) {
      const count = await UserIntentProfile.countDocuments({
        'push_eligibility.should_push': true
      });
      stats.by_trigger[triggerName] = count;
      stats.total_eligible += count;
    }

    return stats;
  }
}

module.exports = new PushTriggerService();
