const SessionEvent = require('../models/SessionEvent');
const UserIntentProfile = require('../models/UserIntentProfile');

class RealTimeAnalyzer {
  constructor() {
    this.exitIntentThresholds = {
      mouseMoveDistance: 100,
      idleTimeSeconds: 30,
      rapidScrollUp: 0.7,
      tabSwitchCount: 1
    };

    this.urgencyPatterns = {
      cartActions: ['add_to_cart', 'view_cart', 'begin_checkout'],
      highIntent: ['purchase', 'begin_checkout', 'payment_entered'],
      timePressure: ['countdown_view', 'limited_stock_view', 'flash_sale_view']
    };

    this.behavioralPatterns = {
      purchaseIntent: [
        { event: 'add_to_cart', weight: 0.3 },
        { event: 'view_cart', weight: 0.2 },
        { event: 'begin_checkout', weight: 0.4 },
        { event: 'save_payment', weight: 0.1 }
      ],
      exitRisk: [
        { event: 'back_button', weight: 0.3 },
        { event: 'tab_switch', weight: 0.2 },
        { event: 'mouse_leave_top', weight: 0.3 },
        { event: 'idle_timeout', weight: 0.2 }
      ]
    };
  }

  async analyzeSessionEvents(userId, sessionId) {
    const events = await SessionEvent.find({
      user_id: userId,
      session_id: sessionId
    }).sort({ timestamp: 1 });

    if (!events || events.length === 0) {
      return this.getDefaultAnalysis();
    }

    return {
      total_events: events.length,
      session_duration_seconds: this.calculateSessionDuration(events),
      events_per_minute: this.calculateEventsPerMinute(events),
      event_types: this.countEventTypes(events),
      behavioral_sequence: this.analyzeBehavioralSequence(events),
      exit_intent_signals: this.detectExitIntent(events),
      urgency_signals: this.detectUrgencySignals(events),
      engagement_score: this.calculateEngagementScore(events)
    };
  }

  calculateSessionDuration(events) {
    if (events.length < 2) return 0;
    const start = new Date(events[0].timestamp);
    const end = new Date(events[events.length - 1].timestamp);
    return Math.round((end - start) / 1000);
  }

  calculateEventsPerMinute(events) {
    const duration = this.calculateSessionDuration(events);
    if (duration === 0) return 0;
    return (events.length / duration) * 60;
  }

  countEventTypes(events) {
    const counts = {};
    events.forEach(event => {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1;
    });
    return counts;
  }

  analyzeBehavioralSequence(events) {
    const sequence = [];
    let lastCartValue = 0;
    let lastProductViewed = null;
    let searchCount = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const analysis = {
        event_type: event.event_type,
        timestamp: event.timestamp,
        indicators: []
      };

      switch (event.event_type) {
        case 'search':
          searchCount++;
          analysis.indicators.push('research_activity');
          if (event.event_data?.search_query) {
            const query = event.event_data.search_query.toLowerCase();
            if (query.includes('sale') || query.includes('deal') || query.includes('discount')) {
              analysis.indicators.push('deal_seeking');
            }
            if (query.includes('compare') || query.includes('vs')) {
              analysis.indicators.push('comparison_mode');
            }
          }
          break;

        case 'product_view':
          if (lastProductViewed === event.event_data?.product_id) {
            analysis.indicators.push('repeated_view');
          }
          lastProductViewed = event.event_data?.product_id;
          if (event.event_data?.price) {
            analysis.price_point = event.event_data.price;
          }
          break;

        case 'add_to_cart':
          analysis.indicators.push('high_intent');
          if (event.event_data?.cart_value) {
            const valueChange = event.event_data.cart_value - lastCartValue;
            if (valueChange > 0) {
              analysis.indicators.push('increasing_cart_value');
            }
            lastCartValue = event.event_data.cart_value;
          }
          break;

        case 'view_cart':
          analysis.indicators.push('cart_consideration');
          if (event.event_data?.cart_value && event.event_data.cart_value > 0) {
            analysis.indicators.push('active_cart');
          }
          break;

        case 'begin_checkout':
          analysis.indicators.push('purchase_intent_strong');
          break;

        case 'purchase':
          analysis.indicators.push('conversion');
          analysis.purchase_value = event.event_data?.price || lastCartValue;
          break;
      }

      sequence.push(analysis);
    }

    return {
      events: sequence,
      summary: {
        total_searches: searchCount,
        final_cart_value: lastCartValue,
        last_product_viewed: lastProductViewed
      }
    };
  }

  detectExitIntent(events) {
    const signals = {
      score: 0,
      detected: false,
      signals: []
    };

    const recentEvents = events.slice(-10);

    // Check for mouse movement toward top (exit intent gesture)
    const mouseMoves = recentEvents.filter(e => e.event_type === 'mouse_move');
    if (mouseMoves.length > 3) {
      signals.score += 0.2;
      signals.signals.push('multiple_mouse_movements');
    }

    // Check for tab switches
    const tabSwitches = recentEvents.filter(e => e.event_type === 'tab_switch');
    if (tabSwitches.length >= this.exitIntentThresholds.tabSwitchCount) {
      signals.score += 0.25;
      signals.signals.push('tab_switch_detected');
    }

    // Check for back button usage
    const backButton = recentEvents.filter(e =>
      e.event_type === 'click' && e.event_data?.url?.includes('back')
    );
    if (backButton.length > 0) {
      signals.score += 0.2;
      signals.signals.push('back_button_pressed');
    }

    // Check for idle time
    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      const idleTime = (Date.now() - new Date(lastEvent.timestamp).getTime()) / 1000;
      if (idleTime > this.exitIntentThresholds.idleTimeSeconds) {
        signals.score += 0.25;
        signals.signals.push('idle_timeout');
      }
    }

    // Check for rapid scroll up
    const scrollEvents = recentEvents.filter(e => e.event_type === 'scroll');
    if (scrollEvents.length >= 2) {
      const lastScroll = scrollEvents[scrollEvents.length - 1];
      const prevScroll = scrollEvents[scrollEvents.length - 2];
      if (lastScroll.event_data?.scroll_depth < prevScroll.event_data?.scroll_depth * 0.5) {
        signals.score += 0.1;
        signals.signals.push('rapid_scroll_up');
      }
    }

    signals.detected = signals.score >= 0.5;

    return signals;
  }

  detectUrgencySignals(events) {
    const signals = {
      level: 'none',
      score: 0,
      signals: [],
      time_sensitivity: null
    };

    const cartEvents = events.filter(e =>
      this.urgencyPatterns.cartActions.includes(e.event_type)
    );

    const highIntentEvents = events.filter(e =>
      this.urgencyPatterns.highIntent.includes(e.event_type)
    );

    const timePressureEvents = events.filter(e =>
      this.urgencyPatterns.timePressure.includes(e.event_type)
    );

    // Calculate urgency based on cart activity
    if (cartEvents.length > 0) {
      const lastCartEvent = cartEvents[cartEvents.length - 1];
      const timeSinceCart = (Date.now() - new Date(lastCartEvent.timestamp).getTime()) / 1000;

      if (timeSinceCart < 300) { // Within 5 minutes
        signals.score += 0.3;
        signals.signals.push('recent_cart_activity');
      } else if (timeSinceCart < 1800) { // Within 30 minutes
        signals.score += 0.15;
        signals.signals.push('cart_still_active');
      }
    }

    // High intent events indicate strong urgency
    if (highIntentEvents.length > 0) {
      signals.score += 0.4;
      signals.signals.push('high_intent_behavior');
    }

    // Time pressure signals
    if (timePressureEvents.length > 0) {
      signals.score += 0.3;
      signals.signals.push('time_pressure_indicators');
    }

    // Cart abandonment risk
    const cartAddEvents = events.filter(e => e.event_type === 'add_to_cart');
    const purchaseEvents = events.filter(e => e.event_type === 'purchase');

    if (cartAddEvents.length > purchaseEvents.length) {
      signals.score += 0.2;
      signals.signals.push('cart_abandonment_risk');
    }

    // Determine urgency level
    if (signals.score >= 0.7) {
      signals.level = 'high';
      signals.time_sensitivity = 'immediate';
    } else if (signals.score >= 0.4) {
      signals.level = 'medium';
      signals.time_sensitivity = 'within_hour';
    } else if (signals.score >= 0.2) {
      signals.level = 'low';
      signals.time_sensitivity = 'within_day';
    }

    return signals;
  }

  calculateEngagementScore(events) {
    if (events.length === 0) return 0;

    let score = 0;

    // Event diversity (engaged users interact with multiple features)
    const uniqueEventTypes = new Set(events.map(e => e.event_type)).size;
    score += Math.min(uniqueEventTypes * 0.05, 0.3);

    // Scroll engagement
    const scrollEvents = events.filter(e => e.event_type === 'scroll');
    if (scrollEvents.length > 0) {
      const avgScrollDepth = scrollEvents.reduce((sum, e) =>
        sum + (e.event_data?.scroll_depth || 0), 0) / scrollEvents.length;
      score += (avgScrollDepth / 100) * 0.2;
    }

    // Time engagement
    const duration = this.calculateSessionDuration(events);
    if (duration > 60) score += 0.2;
    if (duration > 180) score += 0.1;

    // Interaction rate
    const eventsPerMin = this.calculateEventsPerMinute(events);
    if (eventsPerMin > 3) score += 0.15;

    // Cart/checkout engagement
    const purchaseEvents = events.filter(e =>
      ['add_to_cart', 'view_cart', 'begin_checkout'].includes(e.event_type)
    );
    if (purchaseEvents.length > 0) score += 0.1;

    return Math.min(1, score);
  }

  getDefaultAnalysis() {
    return {
      total_events: 0,
      session_duration_seconds: 0,
      events_per_minute: 0,
      event_types: {},
      behavioral_sequence: { events: [], summary: {} },
      exit_intent_signals: { score: 0, detected: false, signals: [] },
      urgency_signals: { level: 'none', score: 0, signals: [], time_sensitivity: null },
      engagement_score: 0
    };
  }

  async processRealtimeEvent(eventData) {
    const sessionEvent = new SessionEvent({
      session_id: eventData.session_id,
      user_id: eventData.user_id,
      event_type: eventData.event_type,
      event_data: eventData.event_data || {},
      intent_indicators: this.analyzeSingleEvent(eventData)
    });

    await sessionEvent.save();
    return sessionEvent;
  }

  analyzeSingleEvent(eventData) {
    const indicators = {
      is_repeated_view: false,
      is_price_sensitive: false,
      shows_urgency: false,
      is_high_intent: false
    };

    switch (eventData.event_type) {
      case 'product_view':
        indicators.is_repeated_view = eventData.event_data?.is_repeat || false;
        break;

      case 'search':
        const query = (eventData.event_data?.search_query || '').toLowerCase();
        indicators.is_price_sensitive =
          query.includes('cheap') ||
          query.includes('affordable') ||
          query.includes('budget') ||
          query.includes('sale');
        break;

      case 'add_to_cart':
      case 'begin_checkout':
      case 'purchase':
        indicators.shows_urgency = true;
        indicators.is_high_intent = true;
        break;
    }

    return indicators;
  }
}

module.exports = new RealTimeAnalyzer();
