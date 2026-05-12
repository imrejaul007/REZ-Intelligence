/**
 * REZ Unified Event Schema Service
 * ONE canonical event model for ALL of REZ
 */

import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';

const app = express();
app.use(express.json());

// Connections
const CDP_API = process.env.CDP_API || 'https://rez-cdp.onrender.com';
const ANALYTICS_API = process.env.ANALYTICS_API || 'https://rez-analytics.onrender.com';
const ATTRIBUTION_API = process.env.ATTRIBUTION_API || 'https://REZ-attribution.onrender.com';

// Canonical Event Types
const EVENT_TYPES = {
  // Order
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',

  // Payment
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',

  // User
  USER_SIGNED_UP: 'user.signed_up',
  USER_LOGGED_IN: 'user.logged_in',

  // AI
  AI_QUERY: 'ai.query',
  AI_RECOMMENDATION_SHOWN: 'ai.recommendation_shown',
  AI_RECOMMENDATION_CLICKED: 'ai.recommendation_clicked',

  // Engagement
  PAGE_VIEWED: 'page.viewed',
  SEARCH_PERFORMED: 'search.performed',
  PRODUCT_VIEWED: 'product.viewed',
  ADDED_TO_CART: 'cart.added',
  WISHLIST_ADDED: 'wishlist.added',

  // Loyalty
  POINTS_EARNED: 'loyalty.points_earned',
  POINTS_REDEEMED: 'loyalty.points_redeemed',
  COUPON_APPLIED: 'loyalty.coupon_applied',

  // QR Scans
  QR_SCANNED: 'qr.scanned',
  QR_VERIFIED: 'qr.verified',
  WARRANTY_ACTIVATED: 'warranty.activated',

  // Expense
  EXPENSE_ADDED: 'expense.added',
  RECEIPT_SCANNED: 'receipt.scanned',

  // Nearby
  REQUEST_POSTED: 'request.posted',
  REQUEST_FULFILLED: 'request.fulfilled'
};

// Canonical Event Schema
const CanonicalEvent = mongoose.model('CanonicalEvent', new mongoose.Schema({
  event_id: { type: String, required: true, unique: true },
  event_type: { type: String, required: true, index: true },

  // Identity
  user_id: String,
  merchant_id: String,
  location_id: String,
  device_id: String,
  session_id: String,

  // Transaction
  order_id: String,
  payment_id: String,
  transaction_id: String,

  // Money
  amount: Number,
  currency: { type: String, default: 'INR' },
  payment_method: String,

  // Engagement
  coin_used: Boolean,
  loyalty_points: Number,

  // Product
  product_id: String,
  sku: String,
  quantity: Number,

  // Location
  location: {
    lat: Number,
    lng: Number,
    city: String,
    country: String
  },

  // Context
  source: String, // pos, app, web, qr, api
  platform: String, // ios, android, web

  // AI Context
  ai: {
    model: String,
    confidence: Number,
    recommendations_shown: [String],
    recommendations_clicked: [String]
  },

  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  tags: [String],

  // Timestamp
  timestamp: { type: Date, default: Date.now, index: true }
}));

// Event Registry (tracks all event types)
const EventRegistry = mongoose.model('EventRegistry', new mongoose.Schema({
  event_type: { type: String, required: true, unique: true },
  description: String,
  category: String,
  is_active: { type: Boolean, default: true },
  schema: mongoose.Schema.Types.Mixed,
  created_at: { type: Date, default: Date.now }
}));

// POST /api/event - Ingest canonical event
app.post('/api/event', async (req, res) => {
  const {
    event_type, user_id, merchant_id, location_id,
    order_id, payment_id, amount, currency,
    source, platform, metadata, tags
  } = req.body;

  const event_id = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const event = new CanonicalEvent({
    event_id,
    event_type,
    user_id,
    merchant_id,
    location_id,
    order_id,
    payment_id,
    amount,
    currency: currency || 'INR',
    source,
    platform,
    metadata,
    tags,
    timestamp: new Date()
  });

  await event.save();

  // Stream to Analytics
  try {
    await axios.post(`${ANALYTICS_API}/api/events`, { event });
  } catch (e) {}

  // Stream to Attribution
  try {
    await axios.post(`${ATTRIBUTION_API}/api/track`, { event });
  } catch (e) {}

  // Stream to CDP
  try {
    await axios.post(`${CDP_API}/api/events`, { event });
  } catch (e) {}

  res.json({ success: true, event_id, event_type });
});

// POST /api/events/batch - Batch ingest
app.post('/api/events/batch', async (req, res) => {
  const { events } = req.body;

  const results = [];
  for (const eventData of events) {
    const event = new CanonicalEvent({
      event_id: `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...eventData,
      timestamp: new Date()
    });
    await event.save();
    results.push(event.event_id);
  }

  res.json({ success: true, count: results.length, event_ids: results });
});

// GET /api/events - Query events
app.get('/api/events', async (req, res) => {
  const { user_id, merchant_id, event_type, from, to, limit = 100 } = req.query;

  const query: any = {};
  if (user_id) query.user_id = user_id;
  if (merchant_id) query.merchant_id = merchant_id;
  if (event_type) query.event_type = event_type;
  if (from && to) {
    query.timestamp = { $gte: new Date(from as string), $lte: new Date(to as string) };
  }

  const events = await CanonicalEvent.find(query)
    .sort({ timestamp: -1 })
    .limit(Number(limit));

  res.json({ events, count: events.length });
});

// GET /api/events/stats - Event statistics
app.get('/api/events/stats', async (req, res) => {
  const { from, to, group_by = 'event_type' } = req.query;

  const match: any = {};
  if (from && to) {
    match.timestamp = { $gte: new Date(from as string), $lte: new Date(to as string) };
  }

  const stats = await CanonicalEvent.aggregate([
    { $match: match },
    { $group: { _id: `$${group_by}`, count: { $sum: 1 }, total_amount: { $sum: '$amount' } } },
    { $sort: { count: -1 } },
    { $limit: 50 }
  ]);

  res.json({ stats });
});

// POST /api/events/register - Register new event type
app.post('/api/events/register', async (req, res) => {
  const { event_type, description, category, schema } = req.body;

  const existing = await EventRegistry.findOne({ event_type });
  if (existing) {
    return res.status(400).json({ error: 'Event type already registered' });
  }

  const registry = new EventRegistry({ event_type, description, category, schema });
  await registry.save();

  res.json({ success: true, registry });
});

// GET /api/events/types - Get all event types
app.get('/api/events/types', async (req, res) => {
  const types = await EventRegistry.find({ is_active: true });
  res.json({ types });
});

export default app;
