const UserIntentProfile = require('../models/UserIntentProfile');
const SessionEvent = require('../models/SessionEvent');

class IntentScoringService {
  constructor() {
    this.intentWeights = {
      ready_to_buy: {
        add_to_cart: 0.25,
        begin_checkout: 0.30,
        purchase: 0.30,
        repeated_views: 0.10,
        time_on_page_recent: 0.05
      },
      just_browsing: {
        short_time_on_page: -0.15,
        no_interaction: -0.10,
        wide_category_jump: 0.15,
        no_cart_action: -0.20,
        quick_scroll: -0.10
      },
      research_mode: {
        extended_time_on_page: 0.15,
        comparison_views: 0.20,
        detailed_content_views: 0.15,
        review_reading: 0.15,
        multiple_searches: 0.15,
        question_queries: 0.20
      },
      deal_hunting: {
        discount_clicks: 0.20,
        sale_page_views: 0.20,
        price_filter_usage: 0.15,
        coupon_search: 0.25,
        low_price_item_focus: 0.10,
        compare_prices: 0.10
      },
      loyalty_checking: {
        brand_search: 0.25,
        reorder_pattern: 0.30,
        favorites_access: 0.20,
        past_order_review: 0.15,
        loyalty_program_check: 0.10
      },
      cart_abandonment_risk: {
        cart_items_count: 0.20,
        high_cart_value: 0.15,
        checkout_started: 0.25,
        payment_step_reached: 0.20,
        session_end_without_purchase: 0.20
      },
      reactivation_needed: {
        days_inactive: 0.30,
        no_recent_searches: 0.15,
        no_recent_views: 0.15,
        email_open: 0.20,
        push_open: 0.20
      },
      high_value_opportunity: {
        high_lifetime_value: 0.25,
        frequent_purchases: 0.20,
        premium_product_views: 0.20,
        brand_loyalty: 0.15,
        referral_activity: 0.10,
        abandoned_high_value_cart: 0.10
      }
    };

    this.questionPatterns = [
      /\b(what|how|which|where|why|can i|does|is)\b/i,
      /\b(difference|compare|specs?|specifications|features|review)\b/i,
      /\b(sizing|size|fit|measurements|dimensions)\b/i,
      /\b(shipping|delivery|return| warranty|guarantee)\b/i
    ];
  }

  calculateIntentScores(userId, currentSignals) {
    const scores = {
      ready_to_buy: 0,
      just_browsing: 0,
      research_mode: 0,
      deal_hunting: 0,
      loyalty_checking: 0,
      cart_abandonment_risk: 0,
      reactivation_needed: 0,
      high_value_opportunity: 0
    };

    // Calculate ready_to_buy score
    if (currentSignals.cart_behavior?.items_added > 0) {
      scores.ready_to_buy += this.intentWeights.ready_to_buy.add_to_cart;
    }
    if (currentSignals.browse_history?.some(h => h.url?.includes('checkout'))) {
      scores.ready_to_buy += this.intentWeights.ready_to_buy.begin_checkout;
    }
    const repeatedViewsCount = Array.from(currentSignals.repeated_views?.values() || []).filter(v => v > 1).length;
    scores.ready_to_buy += Math.min(repeatedViewsCount * 0.02, this.intentWeights.ready_to_buy.repeated_views);

    // Calculate just_browsing score
    const avgTimeOnPage = this.calculateAverageTime(currentSignals.time_on_page);
    if (avgTimeOnPage < 15) {
      scores.just_browsing += this.intentWeights.just_browsing.short_time_on_page;
    }
    if (currentSignals.cart_behavior?.items_added === 0) {
      scores.just_browsing += this.intentWeights.just_browsing.no_cart_action;
    }
    const avgScrollDepth = this.calculateAverageScroll(currentSignals.scroll_depth);
    if (avgScrollDepth < 30) {
      scores.just_browsing += this.intentWeights.just_browsing.quick_scroll;
    }

    // Calculate research_mode score
    if (avgTimeOnPage > 60) {
      scores.research_mode += this.intentWeights.research_mode.extended_time_on_page;
    }
    if (currentSignals.search_queries?.length > 2) {
      scores.research_mode += this.intentWeights.research_mode.multiple_searches;
    }
    const hasQuestionQuery = currentSignals.search_queries?.some(q =>
      this.questionPatterns.some(p => p.test(q))
    );
    if (hasQuestionQuery) {
      scores.research_mode += this.intentWeights.research_mode.question_queries;
    }

    // Calculate deal_hunting score
    const ps = currentSignals.price_sensitivity || {};
    scores.deal_hunting += Math.min(ps.discount_clicks * 0.05, this.intentWeights.deal_hunting.discount_clicks);
    scores.deal_hunting += ps.price_filter_usage * 0.05;
    scores.deal_hunting += ps.compare_count * 0.05;

    // Calculate cart_abandonment_risk score
    if (currentSignals.cart_behavior?.items_added > 0 && !currentSignals.cart_behavior?.last_cart_update) {
      scores.cart_abandonment_risk += this.intentWeights.cart_abandonment_risk.cart_items_count;
    }
    if (currentSignals.cart_behavior?.cart_value > 100) {
      scores.cart_abandonment_risk += this.intentWeights.cart_abandonment_risk.high_cart_value;
    }

    // Normalize scores to 0-1 range
    const maxPossibleScore = 1;
    Object.keys(scores).forEach(intent => {
      scores[intent] = Math.max(0, Math.min(1, scores[intent]));
    });

    return scores;
  }

  calculateAverageTime(timeOnPage) {
    if (!timeOnPage || timeOnPage.size === 0) return 0;
    const values = Array.from(timeOnPage.values());
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  calculateAverageScroll(scrollDepth) {
    if (!scrollDepth || scrollDepth.size === 0) return 0;
    const values = Array.from(scrollDepth.values());
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  determinePrimaryIntent(scores) {
    let maxIntent = 'just_browsing';
    let maxScore = 0;

    Object.entries(scores).forEach(([intent, score]) => {
      if (score > maxScore) {
        maxScore = score;
        maxIntent = intent;
      }
    });

    const confidence = maxScore;
    const contributingFactors = this.getContributingFactors(scores, maxIntent);

    return {
      category: maxIntent,
      confidence,
      contributing_factors: contributingFactors,
      detected_at: new Date()
    };
  }

  getContributingFactors(scores, primaryIntent) {
    const factors = [];
    const threshold = 0.1;

    Object.entries(scores).forEach(([intent, score]) => {
      if (score >= threshold && intent !== primaryIntent) {
        factors.push(`${intent}: ${(score * 100).toFixed(0)}%`);
      }
    });

    return factors;
  }

  async scoreUserIntent(userId, sessionData = {}) {
    let profile = await UserIntentProfile.findOne({ user_id: userId });

    if (!profile) {
      profile = new UserIntentProfile({
        user_id: userId,
        current_session: {
          session_id: sessionData.session_id || this.generateSessionId(),
          started_at: new Date(),
          last_activity: new Date()
        }
      });
    }

    // Update session data
    profile.current_session.last_activity = new Date();
    profile.current_session.total_events += 1;

    // Merge incoming signals
    if (sessionData.signals) {
      profile.signals = this.mergeSignals(profile.signals, sessionData.signals);
    }

    // Calculate scores
    const scores = this.calculateIntentScores(userId, profile.signals);
    const intent = this.determinePrimaryIntent(scores);

    // Update current intent
    profile.current_intent = intent;
    profile.current_session.intent_score = intent.confidence;

    // Add to historical intents
    profile.historical_intents.push(intent);
    if (profile.historical_intents.length > 50) {
      profile.historical_intents = profile.historical_intents.slice(-50);
    }

    // Update mood indicators
    profile.mood_indicators = this.detectMood(profile);

    profile.last_updated = new Date();
    await profile.save();

    return {
      user_id: userId,
      session_id: profile.current_session.session_id,
      current_intent: intent,
      all_scores: scores,
      mood: profile.mood_indicators,
      urgency_signals: profile.urgency_signals
    };
  }

  mergeSignals(existing, incoming) {
    const merged = { ...existing };

    if (incoming.search_queries) {
      merged.search_queries = [...(merged.search_queries || []), ...incoming.search_queries];
    }

    if (incoming.browse_history) {
      merged.browse_history = [...(merged.browse_history || []), ...incoming.browse_history];
    }

    if (incoming.cart_behavior) {
      merged.cart_behavior = {
        ...merged.cart_behavior,
        ...incoming.cart_behavior
      };
    }

    if (incoming.time_on_page) {
      merged.time_on_page = new Map([
        ...(merged.time_on_page || new Map()),
        ...(incoming.time_on_page instanceof Map ? incoming.time_on_page : new Map(Object.entries(incoming.time_on_page)))
      ]);
    }

    if (incoming.scroll_depth) {
      merged.scroll_depth = new Map([
        ...(merged.scroll_depth || new Map()),
        ...(incoming.scroll_depth instanceof Map ? incoming.scroll_depth : new Map(Object.entries(incoming.scroll_depth)))
      ]);
    }

    if (incoming.device_type) {
      merged.device_type = incoming.device_type;
    }

    if (incoming.session_context) {
      merged.session_context = { ...merged.session_context, ...incoming.session_context };
    }

    if (incoming.repeated_views) {
      merged.repeated_views = new Map([
        ...(merged.repeated_views || new Map()),
        ...(incoming.repeated_views instanceof Map ? incoming.repeated_views : new Map(Object.entries(incoming.repeated_views)))
      ]);
    }

    if (incoming.price_sensitivity) {
      merged.price_sensitivity = {
        ...merged.price_sensitivity,
        ...incoming.price_sensitivity
      };
    }

    return merged;
  }

  detectMood(profile) {
    const hour = new Date().getHours();
    let timeOfDay;
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const avgTime = this.calculateAverageTime(profile.signals?.time_on_page);
    let browsingPace = 'normal';
    if (avgTime < 20) browsingPace = 'fast';
    else if (avgTime > 90) browsingPace = 'slow';

    const totalEvents = profile.current_session?.total_events || 0;
    const sessionDuration = profile.current_session?.last_activity ?
      (new Date() - new Date(profile.current_session.last_activity)) / 1000 : 0;
    const eventsPerMinute = sessionDuration > 0 ? (totalEvents / sessionDuration) * 60 : 0;

    let engagementLevel = 'medium';
    if (eventsPerMinute < 2 || avgTime < 15) engagementLevel = 'low';
    else if (eventsPerMinute > 8 && avgTime > 60) engagementLevel = 'high';

    return {
      time_of_day: timeOfDay,
      day_of_week: dayOfWeek,
      browsing_pace: browsingPace,
      engagement_level: engagementLevel
    };
  }

  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new IntentScoringService();
