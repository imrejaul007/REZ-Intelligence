import logger from './utils/logger';
const crypto = require('crypto');

/**
 * Mock Server for Integration Tests
 *
 * Simulates the REZ Intelligence API for testing the SDK without a real backend.
 * Provides realistic responses for identity resolution, events, recommendations, and feedback.
 */

const http = require('http');

// In-memory data stores for mock persistence
const mockData = {
  events: [],
  identities: {},
  recommendations: {},
  feedback: [],
  profiles: {}
};

// Request body accumulator for POST requests
function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Parse URL and extract pathname and query parameters
function parseUrl(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost:3001'}`);
  return {
    pathname: url.pathname,
    searchParams: Object.fromEntries(url.searchParams)
  };
}

// Mock response handler
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Route handlers
const handlers = {
  // Health check
  '/health': {
    GET: async (req, res, parsed) => {
      sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    }
  },

  // Identity resolution
  '/api/identity/resolve': {
    POST: async (req, res, parsed) => {
      const body = await collectRequestBody(req);
      const unifiedId = `uid_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;

      mockData.identities[unifiedId] = {
        ...body.identifiers,
        source: body.source,
        resolvedAt: new Date().toISOString()
      };

      mockData.profiles[unifiedId] = {
        userId: unifiedId,
        identifiers: body.identifiers,
        createdAt: new Date().toISOString(),
        preferences: {}
      };

      sendJson(res, 200, { unifiedId });
    }
  },

  // Identity profile
  '/api/identity/:userId': {
    GET: async (req, res, parsed) => {
      const { userId } = parsed.searchParams;
      const profile = mockData.profiles[userId] || {
        userId,
        preferences: {},
        createdAt: new Date().toISOString()
      };
      sendJson(res, 200, profile);
    }
  },

  // Link identifiers
  '/api/identity/:userId/link': {
    POST: async (req, res, parsed) => {
      const body = await collectRequestBody(req);
      const userId = req.url.split('/')[3];

      if (mockData.profiles[userId]) {
        mockData.profiles[userId].identifiers = {
          ...mockData.profiles[userId].identifiers,
          ...body.identifiers
        };
      }

      sendJson(res, 200, { success: true, linked: body.identifiers });
    }
  },

  // Update context
  '/api/identity/:userId/context': {
    PATCH: async (req, res, parsed) => {
      const body = await collectRequestBody(req);

      sendJson(res, 200, { success: true, updated: body.metadata });
    }
  },

  // Single event tracking
  '/api/events': {
    POST: async (req, res, parsed) => {
      const body = await collectRequestBody(req);
      if (body.event) {
        mockData.events.push({
          ...body.event,
          receivedAt: new Date().toISOString()
        });
      }
      sendJson(res, 200, { success: true, eventId: body.event?.eventId });
    }
  },

  // Batch event tracking
  '/api/events/batch': {
    POST: async (req, res, parsed) => {
      const body = await collectRequestBody(req);
      const { events = [] } = body;

      const processed = events.map(event => ({
        ...event,
        receivedAt: new Date().toISOString()
      }));

      mockData.events.push(...processed);

      sendJson(res, 200, {
        success: true,
        processed: processed.length,
        eventIds: processed.map(e => e.eventId)
      });
    }
  },

  // Recommendations
  '/api/recommendations/:userId': {
    GET: async (req, res, parsed) => {
      const userId = req.url.split('/')[4];
      const url = new URL(req.url, `http://${req.headers.host}`);
      const types = url.searchParams.get('types')?.split(',') || ['reorder', 'cross_sell', 'personalized'];
      const limit = parseInt(url.searchParams.get('limit')) || 10;

      const recommendations = [];

      if (types.includes('reorder')) {
        recommendations.push(
          { itemId: 'reorder_1', name: 'Previous Order Item', type: 'reorder', score: 0.95 },
          { itemId: 'reorder_2', name: 'Frequent Order', type: 'reorder', score: 0.88 }
        );
      }

      if (types.includes('cross_sell')) {
        recommendations.push(
          { itemId: 'cross_1', name: 'Add-on Item', type: 'cross_sell', score: 0.72 }
        );
      }

      if (types.includes('personalized')) {
        recommendations.push(
          { itemId: 'rec_1', name: 'Recommended for You', type: 'personalized', score: 0.65 }
        );
      }

      sendJson(res, 200, {
        recommendations: recommendations.slice(0, limit),
        userId,
        generatedAt: new Date().toISOString()
      });
    }
  },

  // Search ranking
  '/api/search/rank': {
    POST: async (req, res, parsed) => {
      const body = await collectRequestBody(req);

      // Simulate personalized search results
      const results = [
        { itemId: 'search_1', name: `${body.query} - Best Match`, score: 0.95, personalized: true },
        { itemId: 'search_2', name: `${body.query} - Popular`, score: 0.82, personalized: false },
        { itemId: 'search_3', name: `${body.query} - Related`, score: 0.75, personalized: true }
      ];

      sendJson(res, 200, {
        results: results.slice(0, body.limit || 20),
        query: body.query,
        userId: body.userId,
        rankedAt: new Date().toISOString()
      });
    }
  },

  // Conversion feedback
  '/api/feedback/conversion': {
    POST: async (req, res, parsed) => {
      const body = await collectRequestBody(req);

      mockData.feedback.push({
        type: 'conversion',
        ...body,
        receivedAt: new Date().toISOString()
      });

      sendJson(res, 200, { success: true, feedbackId: `fb_${Date.now()}` });
    }
  },

  // Recommendation feedback
  '/api/feedback/recommendation': {
    POST: async (req, res, parsed) => {
      const body = await collectRequestBody(req);

      mockData.feedback.push({
        type: 'recommendation',
        ...body,
        receivedAt: new Date().toISOString()
      });

      sendJson(res, 200, { success: true, feedbackId: `fb_rec_${Date.now()}` });
    }
  },

  // Model feedback
  '/api/feedback/model': {
    POST: async (req, res, parsed) => {
      const body = await collectRequestBody(req);

      mockData.feedback.push({
        type: 'model',
        ...body,
        receivedAt: new Date().toISOString()
      });

      sendJson(res, 200, { success: true, feedbackId: `fb_model_${Date.now()}` });
    }
  }
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Set CORS headers for testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-REZ-App-Id, X-REZ-API-Key');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { pathname } = parseUrl(req);

  // Find matching handler
  let handler = null;
  let matchedPath = null;

  for (const [path, methods] of Object.entries(handlers)) {
    const pathPattern = path.replace(/:(\w+)/g, '([^/]+)');
    const regex = new RegExp(`^${pathPattern}$`);

    if (regex.test(pathname) && methods[req.method]) {
      handler = methods[req.method];
      matchedPath = path;
      break;
    }
  }

  if (handler) {
    try {
      await handler(req, res, { pathname, searchParams: parseUrl(req).searchParams });
    } catch (error) {
      console.error('Handler error:', error);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  } else {
    sendJson(res, 404, { error: 'Not found', path: pathname, method: req.method });
  }
});

/**
 * Start the mock server
 * @param {number} port - Port to listen on
 * @returns {Promise<http.Server>} The server instance
 */
function start(port = 3001) {
  return new Promise(resolve => {
    server.listen(port, () => {
      logger.info(`Mock server running on port ${port}`);
      resolve(server);
    });
  });
}

/**
 * Stop the mock server
 */
function stop() {
  server.close();
}

/**
 * Reset all mock data
 */
function reset() {
  mockData.events = [];
  mockData.identities = {};
  mockData.recommendations = {};
  mockData.feedback = [];
  mockData.profiles = {};
}

/**
 * Get current mock data (for assertions)
 * @returns {Object} Current mock data
 */
function getMockData() {
  return { ...mockData };
}

/**
 * Get event count
 * @returns {number} Number of events received
 */
function getEventCount() {
  return mockData.events.length;
}

/**
 * Get feedback count
 * @returns {number} Number of feedback items received
 */
function getFeedbackCount() {
  return mockData.feedback.length;
}

module.exports = {
  start,
  stop,
  reset,
  getMockData,
  getEventCount,
  getFeedbackCount,
  mockData
};
