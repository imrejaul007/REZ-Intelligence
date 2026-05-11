require('dotenv').config();

const express = require('express');
const { connectDB } = require('./config/database.ts');
const logger = require('./utils/logger.ts');
const cache = require('./utils/cache');
const aiBus = require('./utils/aiBus');

const {
  securityMiddleware,
  corsMiddleware,
  compressionMiddleware,
  requestLogger,
  limiter,
  writeLimiter,
  timeoutMiddleware,
  errorHandler,
  notFoundHandler,
  healthCheck
} = require('./middleware/auth.ts');

const personalizationRoutes = require('./routes/personalization');
const contentRoutes = require('./routes/content');
const interactionsRoutes = require('./routes/interactions');

const app = express();
const PORT = process.env.PORT || 4017;

// Trust proxy for rate limiting behind load balancer
app.set('trust proxy', 1);

// Global middleware
app.use(securityMiddleware);
app.use(corsMiddleware);
app.use(compressionMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(timeoutMiddleware(30000));

// Rate limiting
app.use('/api/', limiter);
app.use('/api/personalize', limiter);

// Health check endpoints
app.get('/health', healthCheck);
app.get('/ready', healthCheck);

// API routes
app.use('/api/personalize', personalizationRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/interactions', interactionsRoutes);

// AI Bus webhook endpoint for receiving events from ReZ Mind
app.post('/api/ai-bus/webhook', async (req, res) => {
  try {
    const { channel, payload } = req.body;

    if (!channel || !payload) {
      return res.status(400).json({
        error: 'Invalid webhook payload',
        message: 'channel and payload are required'
      });
    }

    logger.info(`AI Bus webhook received: ${channel}`);

    // Emit the event locally to trigger handlers
    aiBus.emit(channel, payload);

    res.json({ success: true, received: channel });
  } catch (error) {
    logger.error('AI Bus webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Bus status endpoint
app.get('/api/ai-bus/status', (req, res) => {
  res.json({
    service: 'personalization-engine',
    connected: aiBus.connected || false,
    subscriptions: Array.from(aiBus.subscriptions.keys()),
    url: aiBus.url
  });
});

// Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'ReZ Personalization Engine',
    version: '1.0.0',
    port: PORT,
    endpoints: {
      personalization: {
        'GET /api/personalize/homepage': 'Get personalized homepage feed',
        'GET /api/personalize/search': 'Personalize search results (query params: userId, query, q)',
        'POST /api/personalize/search': 'Personalize provided search results',
        'GET /api/personalize/recommendations': 'Get personalized recommendations',
        'POST /api/personalize/user/:userId': 'Update user profile',
        'GET /api/personalize/user/:userId': 'Get user profile',
        'POST /api/personalize/interaction': 'Record user interaction',
        'GET /api/personalize/segment/:userId': 'Get user segment',
        'GET /api/personalize/similar/:itemId': 'Get similar items',
        'POST /api/personalize/batch': 'Batch personalization',
        'GET /api/personalize/stats': 'Get engine statistics'
      },
      content: {
        'POST /api/content': 'Create content item',
        'GET /api/content': 'List content items',
        'GET /api/content/:itemId': 'Get content item',
        'PUT /api/content/:itemId': 'Update content item',
        'DELETE /api/content/:itemId': 'Delete content item',
        'POST /api/content/bulk': 'Bulk create/update items',
        'GET /api/content/meta/categories': 'Get categories',
        'GET /api/content/meta/brands': 'Get brands'
      },
      interactions: {
        'GET /api/interactions': 'List interactions',
        'GET /api/interactions/user/:userId': 'Get user interactions',
        'GET /api/interactions/item/:itemId': 'Get item interactions',
        'GET /api/interactions/analytics/user/:userId': 'Get user analytics',
        'GET /api/interactions/analytics/popular-items': 'Get popular items',
        'DELETE /api/interactions/cleanup': 'Cleanup old interactions'
      }
    },
    algorithms: {
      collaborative_filtering: 'User-based collaborative filtering with matrix factorization',
      content_based: 'Content-based filtering with preference vectors',
      contextual_bandits: 'Epsilon-greedy, Thompson Sampling, and LinUCB',
      diversity: 'MMR-based diversity constrained re-ranking'
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close AI Bus connection
      await aiBus.close();
      logger.info('AI Bus connection closed');

      const mongoose = require('mongoose');
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (err) {
      logger.error('Error during shutdown:', err);
    }

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
let server;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize collaborative filtering with recent data
    try {
      await require('./algorithms/collaborativeFiltering').buildUserProfiles(30);
      logger.info('Collaborative filtering model initialized');
    } catch (err) {
      logger.warn('Could not initialize collaborative filtering model:', err.message);
    }

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║     ReZ Personalization Engine Started Successfully     ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                             ║
║  Environment: ${process.env.NODE_ENV || 'development'}                          ║
║  MongoDB: Connected                                      ║
║  AI Bus: ${aiBus.enabled ? (aiBus.connected ? 'Connected' : 'Enabled (connecting...)') : 'Disabled'}                                           ║
║  Health: http://localhost:${PORT}/health                   ║
║  API Docs: http://localhost:${PORT}/api                     ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
