const intentScoringService = require('../services/IntentScoringService');

/**
 * Middleware to attach user intent context to requests
 */
const intentContextMiddleware = async (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.user_id || req.body?.user_id;

  if (userId) {
    try {
      const intentScore = await intentScoringService.scoreUserIntent(userId);
      req.intentContext = {
        currentIntent: intentScore.current_intent,
        allScores: intentScore.all_scores,
        mood: intentScore.mood,
        sessionId: intentScore.session_id
      };
    } catch (error) {
      console.error('Intent context error:', error);
      req.intentContext = null;
    }
  }

  next();
};

/**
 * Middleware to log intent-related requests
 */
const intentLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log({
      type: 'intent_request',
      method: req.method,
      path: req.path,
      user_id: req.headers['x-user-id'] || req.body?.user_id,
      intent: req.intentContext?.currentIntent?.category,
      status: res.statusCode,
      duration_ms: duration
    });
  });

  next();
};

/**
 * Middleware to validate intent event data
 */
const validateIntentEventMiddleware = (req, res, next) => {
  const validEventTypes = [
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
  ];

  if (req.body.event_type && !validEventTypes.includes(req.body.event_type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid event_type. Valid types: ${validEventTypes.join(', ')}`
    });
  }

  next();
};

/**
 * Middleware to check rate limiting for intent endpoints
 */
const intentRateLimitMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.body?.user_id;

  if (!userId) {
    return next();
  }

  const key = `intent:${userId}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 60; // Max 60 requests per minute

  // Simple in-memory rate limiting (use Redis in production)
  if (!global.intentRateLimit) {
    global.intentRateLimit = new Map();
  }

  const userRequests = global.intentRateLimit.get(key) || [];

  // Clean old requests
  const recentRequests = userRequests.filter(time => now - time < windowMs);

  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please wait before making more requests.',
      retry_after_ms: windowMs - (now - recentRequests[0])
    });
  }

  recentRequests.push(now);
  global.intentRateLimit.set(key, recentRequests);

  next();
};

module.exports = {
  intentContextMiddleware,
  intentLoggingMiddleware,
  validateIntentEventMiddleware,
  intentRateLimitMiddleware
};
