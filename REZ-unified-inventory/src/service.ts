/**
 * REZ Unified Inventory Service
 * ONE inventory engine for all verticals
 */

import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';

const app = express();
app.use(express.json());

// Connections
const MERCHANT_API = process.env.MERCHANT_API || 'https://rez-merchant.onrender.com';
const NOTIF_API = process.env.NOTIF_API || 'https://rez-notifications.onrender.com';

// Verticals
const VERTICALS = ['restaurant', 'hotel', 'salon', 'fitness', 'retail', 'grocery'];

// Universal Product Schema
const UniversalProduct = mongoose.model('UniversalProduct', new mongoose.Schema({
  product_id: { type: String, required: true, unique: true },
  sku: { type: String, required: true, index: true },
  barcodes: [String],

  // Classification
  verticals: [String], // restaurant, hotel, salon, etc
  categories: [String],
  tags: [String],

  // Name & Description
  name: String,
  description: String,
  image_url: String,

  // Inventory by location
  inventory: {
    type: Map,
    of: {
      available: Number,
      reserved: Number,
      damaged: Number,
      in_transit: Number,
      reorder_point: Number
    }
  },

  // Pricing by location
  pricing: {
    type: Map,
    of: {
      mrp: Number,
      selling_price: Number,
      cost_price: Number,
      margin_percent: Number
    }
  },

  // Suppliers
  suppliers: [{
    supplier_id: String,
    name: String,
    lead_time_days: Number,
    moq: Number,
    cost_per_unit: Number
  }],

  // Channel listings (Zomato, Swiggy, etc)
  channels: [{
    channel: String, // zomato, swiggy, amazon
    listed: Boolean,
    channel_product_id: String,
    channel_price: Number,
    channel_stock: Number,
    last_sync: Date
  }],

  // AI Predictions
  ai_predictions: {
    demand_forecast_30d: Number,
    optimal_stock_level: Number,
    best_selling_hours: [String],
    seasonal_factor: Number,
    reorder_recommended: Boolean
  },

  // Metadata
  merchant_id: String,
  status: { type: String, enum: ['active', 'inactive', 'out_of_stock'], default: 'active' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}));

// Stock Movement
const StockMovement = mongoose.model('StockMovement', new mongoose.Schema({
  movement_id: String,
  product_id: String,
  location_id: String,
  type: String, // in, out, transfer, adjustment
  quantity: Number,
  reason: String,
  reference_id: String, // order_id, purchase_id, etc
  created_at: { type: Date, default: Date.now }
}));

// POST /api/product - Create product
app.post('/api/product', async (req, res) => {
  const { sku, name, verticals, categories, merchant_id } = req.body;

  const product = new UniversalProduct({
    product_id: `PRD-${Date.now()}`,
    sku,
    name,
    verticals,
    categories,
    merchant_id,
    inventory: new Map(),
    pricing: new Map(),
    suppliers: [],
    channels: [],
    ai_predictions: {}
  });

  await product.save();

  res.json({ success: true, product });
});

// GET /api/product/:id - Get product
app.get('/api/product/:id', async (req, res) => {
  const product = await UniversalProduct.findOne({ product_id: req.params.id });
  res.json(product);
});

// PUT /api/inventory/:id - Update inventory
app.put('/api/inventory/:id', async (req, res) => {
  const { location_id, available, reserved, damaged } = req.body;

  const product = await UniversalProduct.findOne({ product_id: req.params.id });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Update inventory
  if (!product.inventory) product.inventory = new Map();
  product.inventory.set(location_id, {
    available: available ?? product.inventory.get(location_id)?.available ?? 0,
    reserved: reserved ?? 0,
    damaged: damaged ?? 0,
    in_transit: product.inventory.get(location_id)?.in_transit ?? 0,
    reorder_point: product.inventory.get(location_id)?.reorder_point ?? 10
  });

  // Check low stock
  const inv = product.inventory.get(location_id);
  if (inv.available < inv.reorder_point) {
    // Notify merchant
    try {
      await axios.post(`${NOTIF_API}/api/notify`, {
        merchant_id: product.merchant_id,
        template: 'low_stock_alert',
        data: { product_id: product.product_id, location_id, available: inv.available }
      });
    } catch (e) {}
  }

  await product.save();

  res.json({ success: true, inventory: inv });
});

// POST /api/inventory/:id/movement - Record stock movement
app.post('/api/inventory/:id/movement', async (req, res) => {
  const { location_id, type, quantity, reason, reference_id } = req.body;

  const product = await UniversalProduct.findOne({ product_id: req.params.id });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Update inventory
  const inv = product.inventory.get(location_id) || { available: 0, reserved: 0, damaged: 0, in_transit: 0, reorder_point: 10 };

  if (type === 'in') inv.available += quantity;
  if (type === 'out') inv.available -= quantity;
  if (type === 'damage') { inv.damaged += quantity; inv.available -= quantity; }

  product.inventory.set(location_id, inv);
  await product.save();

  // Record movement
  const movement = new StockMovement({
    movement_id: `MOV-${Date.now()}`,
    product_id: req.params.id,
    location_id,
    type,
    quantity,
    reason,
    reference_id
  });
  await movement.save();

  res.json({ success: true });
});

// GET /api/inventory/:id/sync - Sync with channels
app.get('/api/inventory/:id/sync', async (req, res) => {
  const { location_id } = req.query;

  const product = await UniversalProduct.findOne({ product_id: req.params.id });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const inv = product.inventory.get(location_id as string);
  const synced = [];

  for (const channel of product.channels) {
    // Sync stock to channel
    // (actual implementation would call channel APIs)
    channel.channel_stock = inv.available;
    channel.last_sync = new Date();
    synced.push(channel.channel);
  }

  await product.save();

  res.json({ success: true, synced });
});

// GET /api/products - Search products
app.get('/api/products', async (req, res) => {
  const { merchant_id, category, vertical, location_id } = req.query;

  const query: Record<string, unknown> = {};
  if (merchant_id) query.merchant_id = merchant_id;
  if (category) query.categories = category;
  if (vertical) query.verticals = vertical;

  const products = await UniversalProduct.find(query as Record<string, unknown>).limit(100);

  res.json({ products, count: products.length });
});

export default app;
