/**
 * ReZ Consumer Loop Service
 *
 * Demonstrates the core flywheel: QR Scan → Browse → Order → Reorder
 *
 * This service orchestrates the consumer engagement cycle:
 * 1. QR Scan - Records user-merchant touchpoint
 * 2. Browse/Search - Tracks intent signals
 * 3. Order - Captures purchase behavior
 * 4. Reorder Trigger - Scheduled nudge for repeat purchases
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3005;

// ============================================================================
// LOGGING UTILITY
// ============================================================================

const log = {
  info: (stage, message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
      timestamp,
      level: 'INFO',
      stage,
      message,
      ...data
    }));
  },
  warn: (stage, message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.warn(JSON.stringify({
      timestamp,
      level: 'WARN',
      stage,
      message,
      ...data
    }));
  },
  error: (stage, message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.error(JSON.stringify({
      timestamp,
      level: 'ERROR',
      stage,
      message,
      ...data
    }));
  }
};

// ============================================================================
// IN-MEMORY DATA STORES (Demo Mode)
// ============================================================================

const stores = {
  // Event history for the flywheel
  events: [],

  // Taste profiles per user
  tasteProfiles: {},

  // Search history / memory engine
  searchHistory: {},

  // Orders
  orders: [],

  // Reorder scores
  reorderScores: {},

  // Sent nudges
  nudges: []
};

// ============================================================================
// MOCK SERVICE INTEGRATIONS
// ============================================================================

/**
 * Mock Event Platform - Records all consumer events
 */
const EventPlatform = {
  async record(event) {
    stores.events.push({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...event
    });
    return { success: true, eventId: event.id || uuidv4() };
  }
};

/**
 * Mock Taste Profile Service - Tracks user preferences
 */
const TasteProfile = {
  async update(userId, merchantId, eventType) {
    if (!stores.tasteProfiles[userId]) {
      stores.tasteProfiles[userId] = {
        userId,
        merchants: {},
        categories: {},
        updatedAt: new Date().toISOString()
      };
    }

    const profile = stores.tasteProfiles[userId];

    // Update merchant affinity
    if (!profile.merchants[merchantId]) {
      profile.merchants[merchantId] = { visits: 0, lastVisit: null };
    }
    profile.merchants[merchantId].visits++;
    profile.merchants[merchantId].lastVisit = new Date().toISOString();

    // Update categories based on event
    if (eventType === 'order') {
      profile.categories[merchantId] = (profile.categories[merchantId] || 0) + 10;
    } else if (eventType === 'browse') {
      profile.categories[merchantId] = (profile.categories[merchantId] || 0) + 2;
    }

    profile.updatedAt = new Date().toISOString();

    return { success: true, profile };
  },

  async get(userId) {
    return stores.tasteProfiles[userId] || null;
  }
};

/**
 * Mock Memory Engine - Stores search/browse context
 */
const MemoryEngine = {
  async store(userId, query, context) {
    if (!stores.searchHistory[userId]) {
      stores.searchHistory[userId] = [];
    }

    stores.searchHistory[userId].push({
      id: uuidv4(),
      query,
      context,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  },

  async getContext(userId) {
    const history = stores.searchHistory[userId] || [];
    return {
      recentSearches: history.slice(-5),
      totalSearches: history.length
    };
  }
};

/**
 * Mock Identity Graph - Links user behaviors to identity
 */
const IdentityGraph = {
  async link(userId, entityType, entityId, data) {
    const key = `${userId}:${entityType}:${entityId}`;
    return {
      success: true,
      linkId: key,
      data
    };
  },

  async getIdentity(userId) {
    return {
      userId,
      entities: {
        merchants: Object.keys(stores.tasteProfiles[userId]?.merchants || {}),
        orders: stores.orders.filter(o => o.userId === userId).length
      }
    };
  }
};

/**
 * Mock Reorder Engine - Calculates reorder probability
 */
const ReorderEngine = {
  calculateScore(orderData) {
    const daysSinceOrder = Math.floor(
      (Date.now() - new Date(orderData.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Simple scoring algorithm
    const baseScore = 50;
    const recencyBoost = Math.max(0, 30 - daysSinceOrder * 2);
    const frequencyBoost = Math.min(20, orderData.items.length * 5);

    const score = Math.min(100, baseScore + recencyBoost + frequencyBoost);

    return {
      score,
      factors: {
        daysSinceOrder,
        recencyBoost,
        frequencyBoost,
        itemCount: orderData.items.length
      },
      threshold: 60,
      shouldNudge: score >= 60
    };
  },

  async processReorders() {
    const results = [];

    for (const order of stores.orders) {
      const scoreData = this.calculateScore(order);

      stores.reorderScores[order.orderId] = scoreData;

      if (scoreData.shouldNudge) {
        results.push({
          orderId: order.orderId,
          userId: order.userId,
          merchantId: order.merchantId,
          scoreData,
          action: 'nudge'
        });
      }
    }

    return results;
  }
};

/**
 * Mock Notification Service - Sends nudges
 */
const NotificationService = {
  async sendNudge(userId, order, score) {
    const nudge = {
      id: uuidv4(),
      userId,
      orderId: order.orderId,
      message: `Time to reorder from ${order.merchantName}!`,
      score,
      sentAt: new Date().toISOString(),
      status: 'sent'
    };

    stores.nudges.push(nudge);
    return { success: true, nudge };
  }
};

// ============================================================================
// API MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  log.info('HTTP', `${req.method} ${req.path}`, {
    query: req.query,
    body: req.body
  });
  next();
});

// ============================================================================
// FLYWHEEL STAGE 1: QR SCAN
// ============================================================================

/**
 * POST /api/qr-scan
 *
 * Records a QR code scan event - first touchpoint with merchant
 */
app.post('/api/qr-scan', async (req, res) => {
  const { userId, merchantId, merchantName, location } = req.body;

  if (!userId || !merchantId) {
    return res.status(400).json({
      success: false,
      error: 'userId and merchantId are required'
    });
  }

  log.info('QR_SCAN', 'Processing QR scan', { userId, merchantId });

  try {
    const eventId = uuidv4();

    // Step 1: Record in Event Platform
    await EventPlatform.record({
      id: eventId,
      type: 'qr_scan',
      userId,
      merchantId,
      merchantName,
      location,
      stage: 'discovery'
    });

    // Step 2: Update Taste Profile
    await TasteProfile.update(userId, merchantId, 'scan');

    log.info('QR_SCAN', 'QR scan processed successfully', {
      userId,
      merchantId,
      eventId
    });

    res.json({
      success: true,
      data: {
        eventId,
        userId,
        merchantId,
        merchantName,
        stage: 'discovery',
        nextAction: 'browse',
        message: 'Scan recorded. Ready for browse/order flow.'
      }
    });
  } catch (error) {
    log.error('QR_SCAN', 'Failed to process QR scan', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// FLYWHEEL STAGE 2: BROWSE / SEARCH
// ============================================================================

/**
 * POST /api/browse
 *
 * Records browse/search activity and updates personalization context
 */
app.post('/api/browse', async (req, res) => {
  const { userId, query, merchantId, items } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required'
    });
  }

  log.info('BROWSE', 'Processing browse event', { userId, query, merchantId });

  try {
    const eventId = uuidv4();

    // Step 1: Store in Memory Engine
    await MemoryEngine.store(userId, query || 'browse', {
      merchantId,
      items,
      stage: 'consideration'
    });

    // Step 2: Record in Event Platform
    await EventPlatform.record({
      id: eventId,
      type: 'browse',
      userId,
      merchantId,
      query,
      items,
      stage: 'consideration'
    });

    // Step 3: Update Taste Profile
    if (merchantId) {
      await TasteProfile.update(userId, merchantId, 'browse');
    }

    // Step 4: Get Personalization Context
    const context = await MemoryEngine.getContext(userId);
    const tasteProfile = await TasteProfile.get(userId);

    log.info('BROWSE', 'Browse event processed', { userId, eventId });

    res.json({
      success: true,
      data: {
        eventId,
        userId,
        context,
        tasteProfile,
        stage: 'consideration',
        recommendations: generateMockRecommendations(tasteProfile, merchantId)
      }
    });
  } catch (error) {
    log.error('BROWSE', 'Failed to process browse', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// FLYWHEEL STAGE 3: ORDER
// ============================================================================

/**
 * POST /api/order
 *
 * Records an order and triggers downstream updates
 */
app.post('/api/order', async (req, res) => {
  const { userId, merchantId, merchantName, items, totalAmount } = req.body;

  if (!userId || !merchantId || !items) {
    return res.status(400).json({
      success: false,
      error: 'userId, merchantId, and items are required'
    });
  }

  log.info('ORDER', 'Processing order', { userId, merchantId, itemCount: items.length });

  try {
    const orderId = uuidv4();
    const order = {
      orderId,
      userId,
      merchantId,
      merchantName,
      items,
      totalAmount: totalAmount || items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    // Step 1: Record in Event Platform
    await EventPlatform.record({
      id: orderId,
      type: 'order',
      userId,
      merchantId,
      orderId,
      items,
      totalAmount: order.totalAmount,
      stage: 'conversion'
    });

    // Step 2: Create Reorder Profile (initialize for future reorder)
    stores.reorderScores[orderId] = {
      score: 50,
      initialized: true,
      lastOrderDate: order.createdAt,
      itemCount: items.length
    };

    // Step 3: Update Identity Graph
    await IdentityGraph.link(userId, 'order', orderId, {
      merchantId,
      items: items.map(i => i.id || i.name),
      totalAmount: order.totalAmount
    });

    // Step 4: Update Taste Profile with order signal
    await TasteProfile.update(userId, merchantId, 'order');

    // Store order
    stores.orders.push(order);

    log.info('ORDER', 'Order processed successfully', {
      orderId,
      userId,
      merchantId,
      totalAmount: order.totalAmount
    });

    res.json({
      success: true,
      data: {
        orderId,
        ...order,
        stage: 'conversion',
        reorderScheduled: true,
        estimatedReorderWindow: '7-14 days',
        message: 'Order complete! Reorder reminder scheduled.'
      }
    });
  } catch (error) {
    log.error('ORDER', 'Failed to process order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// FLYWHEEL STAGE 4: REORDER TRIGGER (Scheduled)
// ============================================================================

/**
 * POST /api/reorder/trigger
 *
 * Manually triggers reorder evaluation for all orders
 */
app.post('/api/reorder/trigger', async (req, res) => {
  log.info('REORDER', 'Triggering reorder evaluation');

  try {
    // Step 1: Check Reorder Scores
    const reorderCandidates = await ReorderEngine.processReorders();

    // Step 2: Send Nudges for high-scoring orders
    const nudgeResults = [];
    for (const candidate of reorderCandidates) {
      const order = stores.orders.find(o => o.orderId === candidate.orderId);
      if (order) {
        const nudgeResult = await NotificationService.sendNudge(
          candidate.userId,
          order,
          candidate.scoreData.score
        );
        nudgeResults.push({
          orderId: candidate.orderId,
          nudgeId: nudgeResult.nudge.id,
          score: candidate.scoreData.score,
          userId: candidate.userId
        });
      }
    }

    // Step 3: Track Conversion (mock - in real system, this would be tracked)
    const conversionTracking = {
      evaluated: stores.orders.length,
      candidates: reorderCandidates.length,
      nudgesSent: nudgeResults.length,
      conversionRate: nudgeResults.length > 0 ? 'TBD' : 'N/A'
    };

    log.info('REORDER', 'Reorder evaluation complete', conversionTracking);

    res.json({
      success: true,
      data: {
        evaluated: stores.orders.length,
        candidates: reorderCandidates,
        nudges: nudgeResults,
        tracking: conversionTracking
      }
    });
  } catch (error) {
    log.error('REORDER', 'Failed to trigger reorder', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reorder/scores/:userId
 *
 * Get reorder scores for a specific user
 */
app.get('/api/reorder/scores/:userId', async (req, res) => {
  const { userId } = req.params;

  const userOrders = stores.orders.filter(o => o.userId === userId);

  const scores = userOrders.map(order => ({
    orderId: order.orderId,
    merchantId: order.merchantId,
    merchantName: order.merchantName,
    lastOrderDate: order.createdAt,
    score: stores.reorderScores[order.orderId] || { score: 0 },
    daysSinceOrder: Math.floor(
      (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
  }));

  res.json({ success: true, data: scores });
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

/**
 * GET /api/user/:userId/profile
 *
 * Get complete user profile across all services
 */
app.get('/api/user/:userId/profile', async (req, res) => {
  const { userId } = req.params;

  const [tasteProfile, identity, events, searchContext] = await Promise.all([
    TasteProfile.get(userId),
    IdentityGraph.getIdentity(userId),
    Promise.resolve(stores.events.filter(e => e.userId === userId)),
    MemoryEngine.getContext(userId)
  ]);

  res.json({
    success: true,
    data: {
      userId,
      tasteProfile,
      identity,
      events: events.slice(-10),
      searchContext,
      totalOrders: stores.orders.filter(o => o.userId === userId).length,
      flywheelStage: determineFlywheelStage(events, stores.orders.filter(o => o.userId === userId))
    }
  });
});

/**
 * GET /api/events
 *
 * Get all events (for debugging/demo)
 */
app.get('/api/events', (req, res) => {
  res.json({
    success: true,
    data: {
      total: stores.events.length,
      events: stores.events.slice(-50)
    }
  });
});

/**
 * GET /api/flywheel/status
 *
 * Get overall flywheel status
 */
app.get('/api/flywheel/status', (req, res) => {
  res.json({
    success: true,
    data: {
      totalEvents: stores.events.length,
      totalOrders: stores.orders.length,
      totalNudges: stores.nudges.length,
      usersWithProfiles: Object.keys(stores.tasteProfiles).length,
      recentActivity: {
        events: stores.events.slice(-5).map(e => ({
          type: e.type,
          userId: e.userId,
          timestamp: e.timestamp
        })),
        orders: stores.orders.slice(-3).map(o => ({
          orderId: o.orderId,
          userId: o.userId,
          merchantName: o.merchantName
        }))
      }
    }
  });
});

/**
 * POST /api/reset
 *
 * Reset all data (for demo purposes)
 */
app.post('/api/reset', (req, res) => {
  stores.events = [];
  stores.tasteProfiles = {};
  stores.searchHistory = {};
  stores.orders = [];
  stores.reorderScores = {};
  stores.nudges = [];

  log.info('RESET', 'All stores reset');

  res.json({ success: true, message: 'All data reset' });
});

// ============================================================================
// DEMO FRONTEND
// ============================================================================

/**
 * GET /demo
 *
 * Serves a simple demo page showing the flywheel
 */
app.get('/demo', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReZ Consumer Loop - Flywheel Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      text-align: center;
      font-size: 2.5em;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #00d9ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      text-align: center;
      color: #888;
      margin-bottom: 40px;
    }
    .flywheel {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    .stage {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
      transition: all 0.3s ease;
    }
    .stage:hover {
      transform: translateY(-4px);
      border-color: #00d9ff;
      box-shadow: 0 8px 32px rgba(0,217,255,0.2);
    }
    .stage-icon { font-size: 2em; margin-bottom: 12px; }
    .stage-title {
      font-size: 1.2em;
      font-weight: bold;
      margin-bottom: 8px;
      color: #00d9ff;
    }
    .stage-desc {
      font-size: 0.9em;
      color: #888;
      margin-bottom: 16px;
    }
    .stage-form { display: flex; flex-direction: column; gap: 8px; }
    input, select, button {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.05);
      color: #fff;
      font-size: 0.9em;
    }
    input::placeholder { color: #666; }
    button {
      background: linear-gradient(135deg, #00d9ff, #00ff88);
      border: none;
      cursor: pointer;
      font-weight: bold;
      color: #1a1a2e;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.8; }
    .status-panel {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }
    .stat { text-align: center; }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #00ff88;
    }
    .stat-label { font-size: 0.85em; color: #888; }
    .activity-log {
      background: rgba(0,0,0,0.3);
      border-radius: 12px;
      padding: 16px;
      max-height: 300px;
      overflow-y: auto;
    }
    .log-entry {
      padding: 8px 12px;
      margin-bottom: 4px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.85em;
      display: flex;
      gap: 12px;
    }
    .log-entry:nth-child(odd) { background: rgba(255,255,255,0.02); }
    .log-time { color: #666; }
    .log-stage { color: #00d9ff; min-width: 80px; }
    .log-msg { color: #ccc; }
    .items-area {
      width: 100%;
      min-height: 60px;
      resize: vertical;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ReZ Consumer Loop</h1>
    <p class="subtitle">QR Scan -> Browse -> Order -> Reorder Flywheel Demo</p>

    <div class="status-panel">
      <div class="status-grid">
        <div class="stat">
          <div class="stat-value" id="totalEvents">0</div>
          <div class="stat-label">Events</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="totalOrders">0</div>
          <div class="stat-label">Orders</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="totalNudges">0</div>
          <div class="stat-label">Nudges</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="totalUsers">0</div>
          <div class="stat-label">Active Users</div>
        </div>
      </div>
    </div>

    <div class="flywheel">
      <div class="stage">
        <div class="stage-icon">1.</div>
        <div class="stage-title">QR Scan</div>
        <div class="stage-desc">User scans merchant QR code</div>
        <div class="stage-form">
          <input type="text" id="qrUserId" placeholder="User ID" value="user-001">
          <input type="text" id="qrMerchantId" placeholder="Merchant ID" value="merchant-coffee">
          <input type="text" id="qrMerchantName" placeholder="Merchant Name" value="Coffee Paradise">
          <button onclick="executeQRScan()">Scan</button>
        </div>
      </div>

      <div class="stage">
        <div class="stage-icon">2.</div>
        <div class="stage-title">Browse</div>
        <div class="stage-desc">User searches or browses items</div>
        <div class="stage-form">
          <input type="text" id="browseUserId" placeholder="User ID" value="user-001">
          <input type="text" id="browseQuery" placeholder="Search query" value="iced latte">
          <button onclick="executeBrowse()">Browse</button>
        </div>
      </div>

      <div class="stage">
        <div class="stage-icon">3.</div>
        <div class="stage-title">Order</div>
        <div class="stage-desc">Complete purchase transaction</div>
        <div class="stage-form">
          <input type="text" id="orderUserId" placeholder="User ID" value="user-001">
          <input type="text" id="orderMerchantId" placeholder="Merchant ID" value="merchant-coffee">
          <input type="text" id="orderMerchantName" placeholder="Merchant Name" value="Coffee Paradise">
          <textarea id="orderItems" class="items-area" placeholder="Items JSON">[{ "name": "Iced Latte", "price": 4.99, "quantity": 2 }, { "name": "Croissant", "price": 3.50, "quantity": 1 }]</textarea>
          <button onclick="executeOrder()">Order</button>
        </div>
      </div>

      <div class="stage">
        <div class="stage-icon">4.</div>
        <div class="stage-title">Reorder</div>
        <div class="stage-desc">Automated reorder triggers</div>
        <div class="stage-form">
          <button onclick="triggerReorder()">Trigger Reorder Check</button>
          <button onclick="viewReorderScores()" style="background: transparent; border: 1px solid #00ff88; color: #00ff88;">View Scores</button>
          <button onclick="resetData()" style="background: transparent; border: 1px solid #ff6b6b; color: #ff6b6b; margin-top: 8px;">Reset All</button>
        </div>
      </div>
    </div>

    <div class="status-panel">
      <h3 style="margin-bottom: 16px;">Activity Log</h3>
      <div class="activity-log" id="activityLog">
        <div class="log-entry">
          <span class="log-time">--:--:--</span>
          <span class="log-stage">READY</span>
          <span class="log-msg">Consumer Loop Service is running</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    function addLog(stage, message, type) {
      type = type || 'info';
      var log = document.getElementById('activityLog');
      var time = new Date().toLocaleTimeString();
      var entry = document.createElement('div');
      entry.className = 'log-entry';
      var color = type === 'success' ? '#00ff88' : type === 'error' ? '#ff6b6b' : '#00d9ff';
      entry.innerHTML = '<span class="log-time">' + time + '</span><span class="log-stage" style="color:' + color + '">' + stage + '</span><span class="log-msg">' + message + '</span>';
      log.insertBefore(entry, log.firstChild);
      if (log.children.length > 50) log.removeChild(log.lastChild);
    }

    async function executeQRScan() {
      var userId = document.getElementById('qrUserId').value;
      var merchantId = document.getElementById('qrMerchantId').value;
      var merchantName = document.getElementById('qrMerchantName').value;

      try {
        var res = await fetch('/api/qr-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, merchantId: merchantId, merchantName: merchantName })
        });
        var data = await res.json();
        if (data.success) {
          addLog('QR_SCAN', 'Scan recorded: ' + merchantName, 'success');
          updateStatus();
        } else {
          addLog('QR_SCAN', 'Error: ' + data.error, 'error');
        }
      } catch (e) {
        addLog('QR_SCAN', 'Failed: ' + e.message, 'error');
      }
    }

    async function executeBrowse() {
      var userId = document.getElementById('browseUserId').value;
      var query = document.getElementById('browseQuery').value;

      try {
        var res = await fetch('/api/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, query: query })
        });
        var data = await res.json();
        if (data.success) {
          addLog('BROWSE', 'Search recorded: "' + query + '"', 'success');
          updateStatus();
        }
      } catch (e) {
        addLog('BROWSE', 'Failed: ' + e.message, 'error');
      }
    }

    async function executeOrder() {
      var userId = document.getElementById('orderUserId').value;
      var merchantId = document.getElementById('orderMerchantId').value;
      var merchantName = document.getElementById('orderMerchantName').value;
      var items;
      try {
        items = JSON.parse(document.getElementById('orderItems').value);
      } catch (e) {
        addLog('ORDER', 'Invalid items JSON', 'error');
        return;
      }

      try {
        var res = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, merchantId: merchantId, merchantName: merchantName, items: items })
        });
        var data = await res.json();
        if (data.success) {
          addLog('ORDER', 'Order ' + data.data.orderId.substring(0,8) + '... placed! ' + items.length + ' items', 'success');
          updateStatus();
        }
      } catch (e) {
        addLog('ORDER', 'Failed: ' + e.message, 'error');
      }
    }

    async function triggerReorder() {
      try {
        var res = await fetch('/api/reorder/trigger', { method: 'POST' });
        var data = await res.json();
        if (data.success) {
          addLog('REORDER', 'Evaluated ' + data.data.evaluated + ' orders, sent ' + data.data.nudges.length + ' nudges', 'success');
          updateStatus();
        }
      } catch (e) {
        addLog('REORDER', 'Failed: ' + e.message, 'error');
      }
    }

    async function viewReorderScores() {
      var userId = prompt('Enter User ID to view scores:', 'user-001');
      if (!userId) return;

      try {
        var res = await fetch('/api/reorder/scores/' + encodeURIComponent(userId));
        var data = await res.json();
        if (data.success && data.data.length > 0) {
          var scores = data.data.map(function(s) {
            return s.merchantName + ': ' + s.score.score + 'pts (' + s.daysSinceOrder + 'd ago)';
          }).join('\\n');
          addLog('SCORES', '\\n' + scores, 'info');
        } else {
          addLog('SCORES', 'No orders found for user', 'info');
        }
      } catch (e) {
        addLog('SCORES', 'Failed: ' + e.message, 'error');
      }
    }

    async function resetData() {
      if (!confirm('Reset all demo data?')) return;
      try {
        await fetch('/api/reset', { method: 'POST' });
        document.getElementById('activityLog').innerHTML = '';
        addLog('RESET', 'All data cleared', 'success');
        updateStatus();
      } catch (e) {
        addLog('RESET', 'Failed: ' + e.message, 'error');
      }
    }

    async function updateStatus() {
      try {
        var res = await fetch('/api/flywheel/status');
        var data = await res.json();
        if (data.success) {
          document.getElementById('totalEvents').textContent = data.data.totalEvents;
          document.getElementById('totalOrders').textContent = data.data.totalOrders;
          document.getElementById('totalNudges').textContent = data.data.totalNudges;
          document.getElementById('totalUsers').textContent = data.data.usersWithProfiles;
        }
      } catch (e) {}
    }

    // Initial status update
    updateStatus();
    setInterval(updateStatus, 5000);
  </script>
</body>
</html>`;

  res.type('html').send(html);
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateMockRecommendations(tasteProfile, currentMerchantId) {
  if (!tasteProfile) return [];

  const merchants = Object.entries(tasteProfile.merchants || {})
    .filter(([id]) => id !== currentMerchantId)
    .sort((a, b) => b[1].visits - a[1].visits)
    .slice(0, 3)
    .map(([id, data]) => ({
      merchantId: id,
      visits: data.visits,
      affinity: Math.min(100, data.visits * 20)
    }));

  return merchants;
}

function determineFlywheelStage(events, orders) {
  const recentEvents = events.slice(-10);
  const hasRecentOrder = orders.length > 0;

  if (!hasRecentOrder && recentEvents.some(e => e.type === 'qr_scan')) {
    return 'discovery';
  }
  if (recentEvents.some(e => e.type === 'browse')) {
    return 'consideration';
  }
  if (hasRecentOrder) {
    return 'conversion';
  }
  return 'idle';
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
  log.info('STARTUP', `ReZ Consumer Loop Service started on port ${PORT}`);
  log.info('STARTUP', `Demo UI available at http://localhost:${PORT}/demo`);
  log.info('STARTUP', 'Flywheel stages: QR_SCAN -> BROWSE -> ORDER -> REORDER');
});

export default app;
