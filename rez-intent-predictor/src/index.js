require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const intentRoutes = require('./routes/intentRoutes');
const {
  intentLoggingMiddleware,
  intentRateLimitMiddleware
} = require('./middleware/intentMiddleware');

const app = express();
const PORT = process.env.PORT || 4018;

// CORS - restrict to known origins
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://rez.money,https://admin.rez.money,https://merchant.rez.money').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS blocked'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use(intentLoggingMiddleware);

// Rate limiting for intent endpoints
app.use('/intent', intentRateLimitMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-intent-predictor',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/intent', intentRoutes);

// Intent signals documentation endpoint
app.get('/intent/signals', (req, res) => {
  res.json({
    name: 'Intent Signals',
    description: 'Signals used for intent prediction',
    signals: [
      { name: 'search_queries', type: 'array', description: 'User search queries' },
      { name: 'browse_history', type: 'array', description: 'Pages/products viewed' },
      { name: 'cart_behavior', type: 'object', description: 'Cart add/remove/value data' },
      { name: 'time_on_page', type: 'map', description: 'Time spent on each page' },
      { name: 'scroll_depth', type: 'map', description: 'Scroll depth percentage' },
      { name: 'device_type', type: 'string', description: 'mobile/tablet/desktop' },
      { name: 'session_context', type: 'object', description: 'UTM/referrer data' },
      { name: 'repeated_views', type: 'map', description: 'Product view counts' },
      { name: 'price_sensitivity', type: 'object', description: 'Deal-seeking indicators' }
    ]
  });
});

// Intent categories documentation endpoint
app.get('/intent/categories', (req, res) => {
  res.json({
    name: 'Intent Categories',
    categories: [
      { id: 'ready_to_buy', name: 'Ready to Buy', priority: 'high' },
      { id: 'just_browsing', name: 'Just Browsing', priority: 'low' },
      { id: 'research_mode', name: 'Research Mode', priority: 'medium' },
      { id: 'deal_hunting', name: 'Deal Hunting', priority: 'medium' },
      { id: 'loyalty_checking', name: 'Loyalty Checking', priority: 'medium' },
      { id: 'cart_abandonment_risk', name: 'Cart Abandonment Risk', priority: 'high' },
      { id: 'reactivation_needed', name: 'Reactivation Needed', priority: 'medium' },
      { id: 'high_value_opportunity', name: 'High Value Opportunity', priority: 'high' }
    ]
  });
});

// Push triggers documentation endpoint
app.get('/intent/triggers', (req, res) => {
  res.json({
    name: 'Push Triggers',
    triggers: [
      {
        intent: 'high_value_opportunity',
        condition: 'current_intent === high_value_opportunity',
        priority: 'high',
        cooldown_hours: 4
      },
      {
        intent: 'cart_abandonment_risk',
        condition: 'current_intent === cart_abandonment_risk AND no_activity_hours > 2',
        priority: 'high',
        cooldown_hours: 1
      },
      {
        intent: 'reactivation_needed',
        condition: 'current_intent === reactivation_needed AND days_since < 30',
        priority: 'medium',
        cooldown_hours: 24
      }
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Handle payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
      message: 'Request body exceeds the 1MB limit'
    });
  }
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`
========================================
  ReZ Intent Predictor Service
========================================
  Status:    Running
  Port:      ${PORT}
  Env:       ${process.env.NODE_ENV || 'development'}
  MongoDB:   Connected
========================================

  Endpoints:
    POST /intent/score         - Real-time intent scoring
    GET  /intent/user/:id/profile - User intent profile
    POST /intent/optimize      - Optimize intent detection
    POST /intent/event         - Record real-time event
    GET  /intent/session/:id   - Session analysis
    POST /intent/batch-score   - Batch scoring

  Documentation:
    GET /intent/signals        - Intent signals reference
    GET /intent/categories     - Intent categories
    GET /intent/triggers       - Push triggers

========================================
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
