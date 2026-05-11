const mongoose = require('mongoose');

const sessionEventSchema = new mongoose.Schema({
  session_id: {
    type: String,
    required: true,
    index: true
  },
  user_id: {
    type: String,
    required: true,
    index: true
  },
  event_type: {
    type: String,
    enum: [
      'page_view',
      'search',
      'product_view',
      'add_to_cart',
      'remove_from_cart',
      'view_cart',
      'begin_checkout',
      'purchase',
      'scroll',
      'time_on_page',
      'exit_intent',
      'mouse_move',
      'tab_switch',
      'click',
      'form_interaction',
      'video_play',
      'download'
    ],
    required: true
  },
  event_data: {
    url: String,
    product_id: String,
    category: String,
    search_query: String,
    price: Number,
    cart_value: Number,
    scroll_depth: Number,
    time_spent_seconds: Number,
    device_type: String,
    referrer: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  intent_indicators: {
    is_repeated_view: { type: Boolean, default: false },
    is_price_sensitive: { type: Boolean, default: false },
    shows_urgency: { type: Boolean, default: false },
    is_high_intent: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

sessionEventSchema.index({ user_id: 1, timestamp: -1 });
sessionEventSchema.index({ session_id: 1, timestamp: -1 });
sessionEventSchema.index({ event_type: 1, timestamp: -1 });

module.exports = mongoose.model('SessionEvent', sessionEventSchema);
