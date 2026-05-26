/**
 * REZ Real-time Service
 * WebSocket server for live activities, merchant data, and social proof
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';
import logger from './utils/logger.js';
import { setupSocketHandlers } from './socketHandlers.js';
import { LiveActivityStore } from './stores/liveActivityStore.js';
import { config } from './config.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

// Initialize stores
const liveActivityStore = new LiveActivityStore();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

// REST API endpoints
app.get('/api/activities', (req, res) => {
  const { city, type, limit } = req.query;
  const activities = liveActivityStore.getActivities({
    city: city as string,
    type: type as string,
    limit: parseInt(limit as string) || 50,
  });
  res.json({ success: true, activities });
});

app.get('/api/trending', (req, res) => {
  const { city, category, limit } = req.query;
  const items = liveActivityStore.getTrendingItems({
    city: city as string,
    category: category as string,
    limit: parseInt(limit as string) || 20,
  });
  res.json({ success: true, items });
});

app.get('/api/merchants/:id/live', (req, res) => {
  const merchantId = req.params.id;
  const data = liveActivityStore.getMerchantLiveData(merchantId);
  res.json({ success: true, data });
});

app.post('/api/activities', (req, res) => {
  const { type, city, count, metadata } = req.body;

  if (!type || !city) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const activity = liveActivityStore.addActivity({
    id: uuidv4(),
    type,
    city,
    count: count || 1,
    timestamp: new Date().toISOString(),
    metadata,
  });

  // Broadcast to all subscribers
  io.to('activity').emit('activity', { channel: 'activity', data: activity });

  res.json({ success: true, activity });
});

// Setup Socket handlers
setupSocketHandlers(io, liveActivityStore);

// Start server
const PORT = config.port;

httpServer.listen(PORT, () => {
  logger.info(`
╔══════════════════════════════════════════════════════════════╗
║           REZ Real-time Service                             ║
║                                                              ║
║  WebSocket:  ws://localhost:${PORT}                            ║
║  Health:    http://localhost:${PORT}/health                   ║
║  REST API:  http://localhost:${PORT}/api/*                   ║
║                                                              ║
║  Channels: activity, merchants, trending, social            ║
╚══════════════════════════════════════════════════════════════╝
  `);

  // Start live activity simulation
  startLiveActivitySimulation(liveActivityStore, io);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  io.close(() => {
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
});

// Live Activity Simulation (for development/demo)
function startLiveActivitySimulation(store: LiveActivityStore, io: Server) {
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata'];
  const types = ['order', 'purchase', 'review', 'checkin', 'deal', 'signup'] as const;

  // Simulate activities every 3-8 seconds
  const simulateActivity = () => {
    const activity = store.addActivity({
      id: uuidv4(),
      type: types[randomInt(0, types.length)],
      city: cities[randomInt(0, cities.length)],
      count: randomInt(1, 51),
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    io.to('activity').emit('activity', { channel: 'activity', data: activity });

    // Schedule next simulation
    const delay = 3000 + randomInt(0, 5001);
    setTimeout(simulateActivity, delay);
  };

  // Start after initial delay
  setTimeout(simulateActivity, 2000);

  // Update trending items periodically
  setInterval(() => {
    store.updateTrendingScores();
    const trending = store.getTrendingItems({ limit: 20 });
    io.to('trending').emit('trending', { channel: 'trending', data: trending });
  }, 30000);
}

export { io, app };
