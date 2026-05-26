import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';
import { asyncHandler } from './errors.js';
import {
  eventPlatform,
  tasteProfileService,
  memoryEngine,
  identityGraph,
  reorderEngine,
  notificationService,
} from './services/index.js';
import {
  FlywheelStage,
  EventType,
  QRScanRequest,
  BrowseRequest,
  OrderRequest,
  Order,
} from './types.js';
import { generateMockRecommendations, determineFlywheelStage, calculateReorderWindow } from './helpers.js';

const app = express();
const PORT = parseInt(process.env['PORT'] || '4154', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next) => {
  log.info('HTTP', `${req.method} ${req.path}`, {
    query: req.query,
    body: req.body,
  });
  next();
});

// ============================================================================
// FLYWHEEL STAGE 1: QR SCAN
// ============================================================================

/**
 * POST /api/qr-scan
 * Records a QR code scan event - first touchpoint with merchant
 */
app.post('/api/qr-scan', asyncHandler(async (req: Request, res: Response) => {
  const { userId, merchantId, merchantName, location } = req.body as QRScanRequest;

  if (!userId || !merchantId) {
    return res.status(400).json({
      success: false,
      error: 'userId and merchantId are required',
    });
  }

  log.info('QR_SCAN', 'Processing QR scan', { userId, merchantId });

  try {
    const eventId = uuidv4();

    // Step 1: Record in Event Platform
    await eventPlatform.record({
      type: EventType.QR_SCAN,
      userId,
      merchantId,
      merchantName,
      location,
      stage: FlywheelStage.DISCOVERY,
    });

    // Step 2: Update Taste Profile
    await tasteProfileService.update(userId, merchantId, 'scan');

    log.info('QR_SCAN', 'QR scan processed successfully', {
      userId,
      merchantId,
      eventId,
    });

    res.json({
      success: true,
      data: {
        eventId,
        userId,
        merchantId,
        merchantName,
        stage: FlywheelStage.DISCOVERY,
        nextAction: 'browse',
        message: 'Scan recorded. Ready for browse/order flow.',
      },
    });
  } catch (error) {
    log.error('QR_SCAN', 'Failed to process QR scan', { error: (error as Error).message });
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}));

// ============================================================================
// FLYWHEEL STAGE 2: BROWSE / SEARCH
// ============================================================================

/**
 * POST /api/browse
 * Records browse/search activity and updates personalization context
 */
app.post('/api/browse', asyncHandler(async (req: Request, res: Response) => {
  const { userId, query, merchantId, items } = req.body as BrowseRequest;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required',
    });
  }

  log.info('BROWSE', 'Processing browse event', { userId, query, merchantId });

  try {
    const eventId = uuidv4();

    // Step 1: Store in Memory Engine
    await memoryEngine.store(userId, query || 'browse', {
      merchantId,
      items,
      stage: FlywheelStage.CONSIDERATION,
    });

    // Step 2: Record in Event Platform
    await eventPlatform.record({
      type: EventType.BROWSE,
      userId,
      merchantId,
      query,
      items,
      stage: FlywheelStage.CONSIDERATION,
    });

    // Step 3: Update Taste Profile
    if (merchantId) {
      await tasteProfileService.update(userId, merchantId, 'browse');
    }

    // Step 4: Get Personalization Context
    const context = await memoryEngine.getContext(userId);
    const tasteProfile = await tasteProfileService.get(userId);

    log.info('BROWSE', 'Browse event processed', { userId, eventId });

    res.json({
      success: true,
      data: {
        eventId,
        userId,
        context,
        tasteProfile,
        stage: FlywheelStage.CONSIDERATION,
        recommendations: generateMockRecommendations(tasteProfile || undefined, merchantId),
      },
    });
  } catch (error) {
    log.error('BROWSE', 'Failed to process browse', { error: (error as Error).message });
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}));

// ============================================================================
// FLYWHEEL STAGE 3: ORDER
// ============================================================================

/**
 * POST /api/order
 * Records an order and triggers downstream updates
 */
app.post('/api/order', asyncHandler(async (req: Request, res: Response) => {
  const { userId, merchantId, merchantName, items, totalAmount } = req.body as OrderRequest;

  if (!userId || !merchantId || !items) {
    return res.status(400).json({
      success: false,
      error: 'userId, merchantId, and items are required',
    });
  }

  log.info('ORDER', 'Processing order', { userId, merchantId, itemCount: items.length });

  try {
    const orderId = uuidv4();
    const calculatedTotal = totalAmount || items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order: Order = {
      orderId,
      userId,
      merchantId,
      merchantName,
      items,
      totalAmount: calculatedTotal,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    // Step 1: Record in Event Platform
    await eventPlatform.record({
      type: EventType.ORDER,
      userId,
      merchantId,
      items,
      totalAmount: order.totalAmount,
      stage: FlywheelStage.CONVERSION,
    });

    // Step 2: Create Reorder Profile (initialize for future reorder)
    reorderEngine.calculateScore(order);

    // Step 3: Update Identity Graph
    await identityGraph.link(userId, 'order', orderId, {
      merchantId,
      items: items.map((i) => i.id || i.name),
      totalAmount: order.totalAmount,
    });

    // Step 4: Update Taste Profile with order signal
    await tasteProfileService.update(userId, merchantId, 'order');

    // Store order
    identityGraph.addOrder(order);

    log.info('ORDER', 'Order processed successfully', {
      orderId,
      userId,
      merchantId,
      totalAmount: order.totalAmount,
    });

    res.json({
      success: true,
      data: {
        orderId,
        userId: order.userId,
        merchantId: order.merchantId,
        merchantName: order.merchantName,
        items: order.items,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
        stage: FlywheelStage.CONVERSION,
        reorderScheduled: true,
        estimatedReorderWindow: calculateReorderWindow(7),
        message: 'Order complete! Reorder reminder scheduled.',
      },
    });
  } catch (error) {
    log.error('ORDER', 'Failed to process order', { error: (error as Error).message });
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}));

// ============================================================================
// FLYWHEEL STAGE 4: REORDER TRIGGER (Scheduled)
// ============================================================================

/**
 * POST /api/reorder/trigger
 * Manually triggers reorder evaluation for all orders
 */
app.post('/api/reorder/trigger', asyncHandler(async (_req: Request, res: Response) => {
  log.info('REORDER', 'Triggering reorder evaluation');

  try {
    // Step 1: Check Reorder Scores
    const reorderCandidates = await reorderEngine.processReorders();

    // Step 2: Send Nudges for high-scoring orders
    const nudgeResults: Array<{ orderId: string; nudgeId: string; score: number; userId: string }> = [];
    for (const candidate of reorderCandidates) {
      const order = identityGraph.getOrders().find((o) => o.orderId === candidate.orderId);
      if (order) {
        const nudgeResult = await notificationService.sendNudge(
          candidate.userId,
          order,
          candidate.scoreData.score
        );
        nudgeResults.push({
          orderId: candidate.orderId,
          nudgeId: nudgeResult.nudge.id,
          score: candidate.scoreData.score,
          userId: candidate.userId,
        });
      }
    }

    // Step 3: Track Conversion (mock - in real system, this would be tracked)
    const conversionTracking = {
      evaluated: identityGraph.getOrders().length,
      candidates: reorderCandidates.length,
      nudgesSent: nudgeResults.length,
      conversionRate: 'TBD',
    };

    log.info('REORDER', 'Reorder evaluation complete', conversionTracking);

    res.json({
      success: true,
      data: {
        evaluated: identityGraph.getOrders().length,
        candidates: reorderCandidates,
        nudges: nudgeResults,
        tracking: conversionTracking,
      },
    });
  } catch (error) {
    log.error('REORDER', 'Failed to trigger reorder', { error: (error as Error).message });
    res.status(500).json({ success: false, error: (error as Error).message });
  }
}));

/**
 * GET /api/reorder/scores/:userId
 * Get reorder scores for a specific user
 */
app.get('/api/reorder/scores/:userId', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  const userOrders = identityGraph.getOrders().filter((o) => o.userId === userId);

  const scores = userOrders.map((order) => ({
    orderId: order.orderId,
    merchantId: order.merchantId,
    merchantName: order.merchantName,
    lastOrderDate: order.createdAt,
    score: reorderEngine.getScore(order.orderId) || { score: 0, factors: { daysSinceOrder: 0, recencyBoost: 0, frequencyBoost: 0, itemCount: 0 }, threshold: 60, shouldNudge: false },
    daysSinceOrder: Math.floor(
      (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  res.json({ success: true, data: scores });
}));

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

/**
 * GET /api/user/:userId/profile
 * Get complete user profile across all services
 */
app.get('/api/user/:userId/profile', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  const [tasteProfile, events, searchContext, allOrders] = await Promise.all([
    tasteProfileService.get(userId),
    Promise.resolve(eventPlatform.getEventsByUser(userId)),
    memoryEngine.getContext(userId),
    Promise.resolve(identityGraph.getOrdersByUser(userId)),
  ]);

  const identity = await identityGraph.getIdentity(userId, tasteProfile?.merchants || {});

  res.json({
    success: true,
    data: {
      userId,
      tasteProfile,
      identity,
      events: events.slice(-10),
      searchContext,
      totalOrders: allOrders.length,
      flywheelStage: determineFlywheelStage(events, allOrders),
    },
  });
}));

/**
 * GET /api/events
 * Get all events (for debugging/demo)
 */
app.get('/api/events', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      total: eventPlatform.getEvents().length,
      events: eventPlatform.getEvents().slice(-50),
    },
  });
});

/**
 * GET /api/flywheel/status
 * Get overall flywheel status
 */
app.get('/api/flywheel/status', (_req: Request, res: Response) => {
  const events = eventPlatform.getEvents();
  const orders = identityGraph.getOrders();
  const nudges = notificationService.getNudges();
  const profiles = tasteProfileService.getAllProfiles();

  res.json({
    success: true,
    data: {
      totalEvents: events.length,
      totalOrders: orders.length,
      totalNudges: nudges.length,
      usersWithProfiles: Object.keys(profiles).length,
      recentActivity: {
        events: events.slice(-5).map((e) => ({
          type: e.type,
          userId: e.userId,
          timestamp: e.timestamp,
        })),
        orders: orders.slice(-3).map((o) => ({
          orderId: o.orderId,
          userId: o.userId,
          merchantName: o.merchantName,
        })),
      },
    },
  });
});

/**
 * POST /api/reset
 * Reset all data (for demo purposes)
 */
app.post('/api/reset', (_req: Request, res: Response) => {
  eventPlatform.clearEvents();
  tasteProfileService.clearProfiles();
  memoryEngine.clearHistory();
  identityGraph.clearOrders();
  reorderEngine.clearScores();
  notificationService.clearNudges();

  log.info('RESET', 'All stores reset');

  res.json({ success: true, message: 'All data reset' });
});

// ============================================================================
// DEMO FRONTEND
// ============================================================================

/**
 * GET /demo
 * Serves a simple demo page showing the flywheel
 */
app.get('/demo', (_req: Request, res: Response) => {
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

    updateStatus();
    setInterval(updateStatus, 5000);
  </script>
</body>
</html>`;

  res.type('html').send(html);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
  log.info('STARTUP', `ReZ Consumer Loop Service started on port ${PORT}`);
  log.info('STARTUP', `Demo UI available at http://localhost:${PORT}/demo`);
  log.info('STARTUP', 'Flywheel stages: QR_SCAN -> BROWSE -> ORDER -> REORDER');
});

export default app;
