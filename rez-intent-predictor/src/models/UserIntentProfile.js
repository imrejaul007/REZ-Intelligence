const mongoose = require('mongoose');

const intentSignalsSchema = new mongoose.Schema({
  search_queries: { type: [String], default: [] },
  browse_history: [{
    url: String,
    product_id: String,
    category: String,
    timestamp: Date,
    duration_seconds: Number
  }],
  cart_behavior: {
    items_added: { type: Number, default: 0 },
    items_removed: { type: Number, default: 0 },
    cart_value: { type: Number, default: 0 },
    last_cart_update: Date
  },
  time_on_page: { type: Map, of: Number, default: {} },
  scroll_depth: { type: Map, of: Number, default: {} },
  device_type: { type: String, enum: ['mobile', 'tablet', 'desktop'], default: 'desktop' },
  session_context: {
    referrer: String,
    utm_source: String,
    utm_medium: String,
    utm_campaign: String
  },
  repeated_views: { type: Map, of: Number, default: {} },
  price_sensitivity: {
    discount_clicks: { type: Number, default: 0 },
    price_filter_usage: { type: Number, default: 0 },
    compare_count: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  }
}, { _id: false });

const intentCategorySchema = new mongoose.Schema({
  category: {
    type: String,
    enum: [
      'ready_to_buy',
      'just_browsing',
      'research_mode',
      'deal_hunting',
      'loyalty_checking',
      'cart_abandonment_risk',
      'reactivation_needed',
      'high_value_opportunity'
    ],
    required: true
  },
  confidence: { type: Number, min: 0, max: 1, default: 0 },
  contributing_factors: [String],
  detected_at: { type: Date, default: Date.now }
}, { _id: false });

const userIntentProfileSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  current_session: {
    session_id: String,
    started_at: Date,
    last_activity: Date,
    total_events: { type: Number, default: 0 },
    intent_score: { type: Number, default: 0 }
  },
  signals: {
    type: intentSignalsSchema,
    default: () => ({})
  },
  current_intent: intentCategorySchema,
  historical_intents: [intentCategorySchema],
  mood_indicators: {
    time_of_day: { type: String, enum: ['morning', 'afternoon', 'evening', 'night'] },
    day_of_week: String,
    browsing_pace: { type: String, enum: ['slow', 'normal', 'fast'] },
    engagement_level: { type: String, enum: ['low', 'medium', 'high'] }
  },
  urgency_signals: {
    items_in_cart: { type: Number, default: 0 },
    cart_value: { type: Number, default: 0 },
    viewed_checkout: { type: Boolean, default: false },
    recent_purchase: { type: Boolean, default: false },
    abandoned_cart_value: { type: Number, default: 0 }
  },
  exit_intent: {
    mouse_move_to_top: { type: Number, default: 0 },
    tab_switches: { type: Number, default: 0 },
    back_button_pressed: { type: Boolean, default: false },
    idle_time_seconds: { type: Number, default: 0 }
  },
  push_eligibility: {
    should_push: { type: Boolean, default: false },
    push_reasons: [String],
    last_push_at: Date,
    push_count_24h: { type: Number, default: 0 }
  },
  metrics: {
    total_sessions: { type: Number, default: 0 },
    total_purchases: { type: Number, default: 0 },
    average_order_value: { type: Number, default: 0 },
    conversion_rate: { type: Number, default: 0 },
    days_since_last_activity: { type: Number, default: 0 },
    days_since_last_purchase: { type: Number, default: 0 },
    lifetime_value: { type: Number, default: 0 }
  },
  last_updated: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: true
});

userIntentProfileSchema.index({ 'current_intent.category': 1 });
userIntentProfileSchema.index({ 'push_eligibility.should_push': 1 });
userIntentProfileSchema.index({ 'metrics.days_since_last_activity': 1 });

module.exports = mongoose.model('UserIntentProfile', userIntentProfileSchema);
