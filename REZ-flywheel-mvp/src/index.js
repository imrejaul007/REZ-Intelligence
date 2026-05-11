'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = {
  info: (msg, data) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', msg, ...data })),
  warn: (msg, data) => console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', msg, ...data }))
};

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// MongoDB Schemas - Minimal for MVP
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  phone: String,
  name: String,
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

const merchantSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true },
  name: String,
  category: String,
  location: String,
  createdAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
  userId: String,
  merchantId: String,
  type: { type: String, enum: ['qr_scan', 'browse', 'search', 'order', 'reorder_nudge', 'reorder_click', 'reorder_convert'] },
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: String,
  merchantId: String,
  items: [{
    name: String,
    price: Number,
    quantity: Number
  }],
  total: Number,
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'completed' },
  source: { type: String, enum: ['direct', 'reorder_nudge'], default: 'direct' },
  createdAt: { type: Date, default: Date.now }
});

const reorderProfileSchema = new mongoose.Schema({
  userId: String,
  merchantId: String,
  lastOrderDate: Date,
  orderCount: { type: Number, default: 1 },
  avgOrderValue: Number,
  reorderScore: { type: Number, default: 0 },
  shouldNudge: { type: Boolean, default: false },
  nudged: { type: Boolean, default: false },
  nudgedAt: Date,
  clicked: { type: Boolean, default: false },
  converted: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

reorderProfileSchema.index({ userId: 1, merchantId: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const Merchant = mongoose.model('Merchant', merchantSchema);
const Event = mongoose.model('Event', eventSchema);
const Order = mongoose.model('Order', orderSchema);
const ReorderProfile = mongoose.model('ReorderProfile', reorderProfileSchema);

// Simple scoring algorithm
function calculateReorderScore(profile) {
  if (!profile.lastOrderDate) return 0;

  const daysSinceOrder = Math.floor((Date.now() - profile.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
  const orderCount = profile.orderCount || 1;

  // Higher score = more likely to reorder
  let score = 0;

  // Recency (max 40 points)
  if (daysSinceOrder <= 1) score += 40;
  else if (daysSinceOrder <= 3) score += 35;
  else if (daysSinceOrder <= 7) score += 25;
  else if (daysSinceOrder <= 14) score += 15;
  else score += 5;

  // Frequency (max 30 points)
  if (orderCount >= 5) score += 30;
  else if (orderCount >= 3) score += 20;
  else if (orderCount >= 2) score += 10;

  // Value consistency (max 30 points)
  if (profile.avgOrderValue >= 500) score += 30;
  else if (profile.avgOrderValue >= 300) score += 20;
  else if (profile.avgOrderValue >= 150) score += 10;

  return Math.min(100, score);
}

// Express app
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/demo', '/status'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'flywheel-mvp', timestamp: new Date().toISOString() });
});

// ============================================
// CORE FLYWHEEL ENDPOINTS
// ============================================

// 1. QR Scan - Discovery
app.post('/api/qr-scan', async (req, res) => {
  try {
    const { userId, merchantId } = req.body;

    // Record event
    await Event.create({ userId, merchantId, type: 'qr_scan' });

    // Update user last active
    await User.findOneAndUpdate({ userId }, { lastActive: new Date() });

    logger.info('QR Scan', { userId, merchantId });

    res.json({ success: true, message: 'QR scan recorded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Order - Conversion
app.post('/api/order', async (req, res) => {
  try {
    const { userId, merchantId, items, total } = req.body;
    const orderId = `ord_${uuidv4().substring(0, 8)}`;

    // Create order
    await Order.create({ orderId, userId, merchantId, items, total });

    // Record event
    await Event.create({ userId, merchantId, type: 'order', metadata: { orderId, total } });

    // Update user last active
    await User.findOneAndUpdate({ userId }, { lastActive: new Date() });

    // Update reorder profile
    let profile = await ReorderProfile.findOne({ userId, merchantId });

    if (profile) {
      const prevOrders = profile.orderCount;
      profile.lastOrderDate = new Date();
      profile.orderCount += 1;
      profile.avgOrderValue = ((profile.avgOrderValue * prevOrders) + total) / profile.orderCount;
      profile.reorderScore = calculateReorderScore(profile);
      profile.shouldNudge = profile.reorderScore >= 60;
      profile.nudged = false;
      profile.updatedAt = new Date();
      await profile.save();
    } else {
      await ReorderProfile.create({
        userId,
        merchantId,
        lastOrderDate: new Date(),
        orderCount: 1,
        avgOrderValue: total,
        reorderScore: calculateReorderScore({ lastOrderDate: new Date(), orderCount: 1, avgOrderValue: total }),
        shouldNudge: false
      });
    }

    logger.info('Order placed', { orderId, userId, merchantId, total });

    res.json({ success: true, orderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Trigger Reorder Nudges - Retention
app.post('/api/nudge/trigger', async (req, res) => {
  try {
    // Find users who should be nudged
    const profiles = await ReorderProfile.find({
      shouldNudge: true,
      nudged: false,
      reorderScore: { $gte: 60 }
    }).limit(100);

    const nudges = [];

    for (const profile of profiles) {
      // Mark as nudged
      profile.nudged = true;
      profile.nudgedAt = new Date();
      await profile.save();

      // Record event
      await Event.create({
        userId: profile.userId,
        merchantId: profile.merchantId,
        type: 'reorder_nudge'
      });

      nudges.push({
        userId: profile.userId,
        merchantId: profile.merchantId,
        score: profile.reorderScore,
        message: `Time to reorder! Score: ${profile.reorderScore}`
      });
    }

    logger.info('Nudges triggered', { count: nudges.length });

    res.json({ success: true, count: nudges.length, nudges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Nudge Clicked - Engagement
app.post('/api/nudge/click', async (req, res) => {
  try {
    const { userId, merchantId } = req.body;

    // Update profile
    await ReorderProfile.findOneAndUpdate(
      { userId, merchantId },
      { clicked: true }
    );

    // Record event
    await Event.create({ userId, merchantId, type: 'reorder_click' });

    logger.info('Nudge clicked', { userId, merchantId });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Nudge Converted - Revenue
app.post('/api/nudge/convert', async (req, res) => {
  try {
    const { userId, merchantId, orderId } = req.body;

    // Update profile
    await ReorderProfile.findOneAndUpdate(
      { userId, merchantId },
      { converted: true, source: 'reorder_nudge' }
    );

    // Update order source
    if (orderId) {
      await Order.findOneAndUpdate({ orderId }, { source: 'reorder_nudge' });
    }

    // Record event
    await Event.create({ userId, merchantId, type: 'reorder_convert', metadata: { orderId } });

    logger.info('Nudge converted', { userId, merchantId, orderId });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DASHBOARD & STATUS
// ============================================

app.get('/status', async (req, res) => {
  try {
    const [
      totalUsers,
      totalMerchants,
      totalOrders,
      totalEvents,
      nudgeProfiles,
      clickedProfiles,
      convertedProfiles,
      reorderOrders
    ] = await Promise.all([
      User.countDocuments(),
      Merchant.countDocuments(),
      Order.countDocuments(),
      Event.countDocuments(),
      ReorderProfile.countDocuments({ nudged: true }),
      ReorderProfile.countDocuments({ clicked: true }),
      ReorderProfile.countDocuments({ converted: true }),
      Order.countDocuments({ source: 'reorder_nudge' })
    ]);

    // Calculate funnel
    const events = await Event.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const eventCounts = {};
    events.forEach(e => eventCounts[e._id] = e.count);

    const nudgeRate = nudgeProfiles > 0 ? (clickedProfiles / nudgeProfiles * 100).toFixed(1) : 0;
    const clickToConvert = clickedProfiles > 0 ? (convertedProfiles / clickedProfiles * 100).toFixed(1) : 0;
    const reorderAttribution = totalOrders > 0 ? (reorderOrders / totalOrders * 100).toFixed(1) : 0;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        users: totalUsers,
        merchants: totalMerchants,
        orders: totalOrders,
        events: totalEvents
      },
      funnel: {
        qrScans: eventCounts.qr_scan || 0,
        orders: eventCounts.order || 0,
        nudgesSent: nudgeProfiles,
        nudgesClicked: clickedProfiles,
        nudgesConverted: convertedProfiles,
        reorderOrders
      },
      kpis: {
        nudgeClickRate: nudgeRate,
        nudgeConversionRate: clickToConvert,
        reorderAttributionRate: reorderAttribution,
        status: parseFloat(nudgeRate) >= 8 && parseFloat(clickToConvert) >= 10 ? 'GREEN' :
                parseFloat(nudgeRate) >= 5 || parseFloat(clickToConvert) >= 5 ? 'YELLOW' : 'BUILDING'
      },
      flywheelHealth: {
        discovery: eventCounts.qr_scan > 0 ? 'ACTIVE' : 'NO_DATA',
        conversion: eventCounts.order > 0 ? 'ACTIVE' : 'NO_DATA',
        retention: nudgeProfiles > 0 ? 'ACTIVE' : 'NO_DATA'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Demo HTML page
app.get('/demo', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>REZ Flywheel MVP - Demo</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 10px 0; }
    .step { display: flex; align-items: center; padding: 15px; border-bottom: 1px solid #eee; }
    .step-num { width: 30px; height: 30px; background: #007bff; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; }
    .step-content { flex: 1; }
    .step-action { margin-left: 10px; }
    button { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0056b3; }
    input, select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin: 5px; }
    .status { padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0; }
    .status-green { background: #d4edda; color: #155724; }
    .status-yellow { background: #fff3cd; color: #856404; }
    .kpi { display: inline-block; padding: 10px 20px; margin: 5px; background: #e9ecef; border-radius: 4px; }
    .kpi-value { font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>REZ Flywheel MVP</h1>
  <p>Test the core loop: QR Scan → Order → Reorder Nudge → Repeat Purchase</p>

  <div class="status" id="statusPanel">
    <h2>System Status</h2>
    <div id="statusContent">Loading...</div>
  </div>

  <h2>The Flywheel Loop</h2>

  <div class="card">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-content">
        <strong>QR Scan - Discovery</strong>
        <p>User scans merchant QR code</p>
      </div>
      <div class="step-action">
        <input type="text" id="userId1" placeholder="User ID" value="user_demo">
        <input type="text" id="merchantId1" placeholder="Merchant ID" value="merchant_1">
        <button onclick="qrScan()">Scan QR</button>
      </div>
    </div>

    <div class="step">
      <div class="step-num">2</div>
      <div class="step-content">
        <strong>Place Order - Conversion</strong>
        <p>User makes a purchase</p>
      </div>
      <div class="step-action">
        <input type="text" id="userId2" placeholder="User ID" value="user_demo">
        <input type="text" id="merchantId2" placeholder="Merchant ID" value="merchant_1">
        <input type="number" id="total2" placeholder="Total" value="250">
        <button onclick="placeOrder()">Place Order</button>
      </div>
    </div>

    <div class="step">
      <div class="step-num">3</div>
      <div class="step-content">
        <strong>Trigger Reorder Nudge</strong>
        <p>AI scores users and sends reorder notifications</p>
      </div>
      <div class="step-action">
        <button onclick="triggerNudge()">Trigger Nudges</button>
      </div>
    </div>

    <div class="step">
      <div class="step-num">4</div>
      <div class="step-content">
        <strong>Nudge Clicked</strong>
        <p>User clicks the reorder notification</p>
      </div>
      <div class="step-action">
        <input type="text" id="userId4" placeholder="User ID" value="user_demo">
        <input type="text" id="merchantId4" placeholder="Merchant ID" value="merchant_1">
        <button onclick="nudgeClick()">Nudge Clicked</button>
      </div>
    </div>

    <div class="step">
      <div class="step-num">5</div>
      <div class="step-content">
        <strong>Reorder Converted</strong>
        <p>User completes the repeat purchase</p>
      </div>
      <div class="step-action">
        <input type="text" id="userId5" placeholder="User ID" value="user_demo">
        <input type="text" id="merchantId5" placeholder="Merchant ID" value="merchant_1">
        <button onclick="nudgeConvert()">Convert</button>
      </div>
    </div>
  </div>

  <div id="log" style="margin-top: 20px; font-family: monospace; font-size: 12px;"></div>

  <script>
    const API = '';

    function log(message, type = 'info') {
      const div = document.getElementById('log');
      const time = new Date().toLocaleTimeString();
      div.innerHTML = '<div style="color: ' + (type === 'error' ? 'red' : 'green') + '">[' + time + '] ' + message + '</div>' + div.innerHTML;
    }

    function refreshStatus() {
      fetch('/status')
        .then(r => r.json())
        .then(data => {
          const kpis = data.kpis;
          const statusClass = kpis.status === 'GREEN' ? 'status-green' : 'status-yellow';
          document.getElementById('statusPanel').className = 'status ' + statusClass;
          document.getElementById('statusContent').innerHTML =
            '<div class="kpi"><div class="kpi-value">' + kpis.nudgeClickRate + '%</div>Nudge CTR</div>' +
            '<div class="kpi"><div class="kpi-value">' + kpis.nudgeConversionRate + '%</div>Nudge Conv.</div>' +
            '<div class="kpi"><div class="kpi-value">' + kpis.reorderAttributionRate + '%</div>Reorder %</div>' +
            '<div class="kpi"><div class="kpi-value">' + data.metrics.users + '</div>Users</div>' +
            '<div class="kpi"><div class="kpi-value">' + data.metrics.orders + '</div>Orders</div>';
        });
    }

    async function qrScan() {
      const userId = document.getElementById('userId1').value;
      const merchantId = document.getElementById('merchantId1').value;
      try {
        await fetch(API + '/api/qr-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, merchantId })
        });
        log('QR Scan: ' + userId + ' @ ' + merchantId);
        refreshStatus();
      } catch (e) { log('Error: ' + e.message, 'error'); }
    }

    async function placeOrder() {
      const userId = document.getElementById('userId2').value;
      const merchantId = document.getElementById('merchantId2').value;
      const total = parseFloat(document.getElementById('total2').value);
      try {
        await fetch(API + '/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, merchantId, total, items: [{ name: 'Demo Item', price: total, quantity: 1 }] })
        });
        log('Order: ' + userId + ' - ₹' + total);
        refreshStatus();
      } catch (e) { log('Error: ' + e.message, 'error'); }
    }

    async function triggerNudge() {
      try {
        const r = await fetch(API + '/api/nudge/trigger', { method: 'POST' });
        const data = await r.json();
        log('Nudges triggered: ' + data.count);
        refreshStatus();
      } catch (e) { log('Error: ' + e.message, 'error'); }
    }

    async function nudgeClick() {
      const userId = document.getElementById('userId4').value;
      const merchantId = document.getElementById('merchantId4').value;
      try {
        await fetch(API + '/api/nudge/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, merchantId })
        });
        log('Nudge clicked: ' + userId);
        refreshStatus();
      } catch (e) { log('Error: ' + e.message, 'error'); }
    }

    async function nudgeConvert() {
      const userId = document.getElementById('userId5').value;
      const merchantId = document.getElementById('merchantId5').value;
      try {
        await fetch(API + '/api/nudge/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, merchantId })
        });
        log('Reorder converted: ' + userId + ' (attribution tracked!)');
        refreshStatus();
      } catch (e) { log('Error: ' + e.message, 'error'); }
    }

    // Load status on page load
    refreshStatus();
    setInterval(refreshStatus, 5000);
  </script>
</body>
</html>
  `);
});

const errorHandler = (err, req, res, next) => {
  res.status(500).json({ success: false, error: err.message });
};

app.use(errorHandler);

const PORT = process.env.PORT || 4101;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Flywheel MVP running on port ${PORT}`);
      console.log(`Demo: http://localhost:${PORT}/demo`);
      console.log(`Status: http://localhost:${PORT}/status`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();
