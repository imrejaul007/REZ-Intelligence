'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { createClient } = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = {
  info: (msg, data) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', msg, ...data }))
};

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Redis client for pub/sub
let redis;
let redisSub;

async function initRedis() {
  try {
    redis = createClient({ url: process.env.REDIS_URL });
    redisSub = createClient({ url: process.env.REDIS_URL });
    await redis.connect();
    await redisSub.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis connection failed', { error: err.message });
  }
}

// Connected clients
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId') || 'anonymous';

  ws.clientId = clientId;
  ws.userId = userId;
  ws.subscriptions = new Set();

  clients.set(clientId, ws);

  logger.info('WebSocket connected', { clientId, userId });

  // Send welcome
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    logger.info('WebSocket disconnected', { clientId, userId });
  });

  ws.on('error', (err) => {
    logger.error('WebSocket error', { clientId, error: err.message });
    clients.delete(clientId);
  });
});

function handleMessage(ws, data) {
  const { action, channel, payload } = data;

  switch (action) {
    case 'subscribe':
      subscribe(ws, channel);
      break;
    case 'unsubscribe':
      unsubscribe(ws, channel);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown action' }));
  }
}

function subscribe(ws, channel) {
  if (!channel) {
    ws.send(JSON.stringify({ type: 'error', message: 'Channel required' }));
    return;
  }

  ws.subscriptions.add(channel);
  ws.send(JSON.stringify({
    type: 'subscribed',
    channel,
    timestamp: new Date().toISOString()
  }));

  logger.info('Client subscribed', { clientId: ws.clientId, channel });
}

function unsubscribe(ws, channel) {
  ws.subscriptions.delete(channel);
  ws.send(JSON.stringify({
    type: 'unsubscribed',
    channel,
    timestamp: new Date().toISOString()
  }));
}

function broadcast(channel, message) {
  const payload = JSON.stringify({
    type: 'event',
    channel,
    data: message,
    timestamp: new Date().toISOString()
  });

  for (const [clientId, ws] of clients) {
    if (ws.readyState === 1 && ws.subscriptions.has(channel)) {
      ws.send(payload);
    }
  }
}

function sendToUser(userId, message) {
  const payload = JSON.stringify({
    type: 'event',
    data: message,
    timestamp: new Date().toISOString()
  });

  for (const [clientId, ws] of clients) {
    if (ws.readyState === 1 && ws.userId === userId) {
      ws.send(payload);
    }
  }
}

// Setup Redis pub/sub if available
async function setupRedisPubSub() {
  if (!redisSub) return;

  // Subscribe to channels
  await redisSub.subscribe('rez:events', (message) => {
    const data = JSON.parse(message);
    broadcast('events', data);
  });

  await redisSub.subscribe('rez:notifications', (message) => {
    const data = JSON.parse(message);
    broadcast('notifications', data);
    if (data.userId) {
      sendToUser(data.userId, data);
    }
  });

  await redisSub.subscribe('rez:recommendations', (message) => {
    const data = JSON.parse(message);
    broadcast('recommendations', data);
    if (data.userId) {
      sendToUser(data.userId, data);
    }
  });

  logger.info('Redis pub/sub subscribed to channels');
}

// HTTP endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'realtime-gateway',
    connections: clients.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/stats', (req, res) => {
  const stats = {
    totalConnections: clients.size,
    channels: {},
    users: new Set([...clients.values()].map(c => c.userId)).size
  };

  for (const ws of clients.values()) {
    for (const channel of ws.subscriptions) {
      stats.channels[channel] = (stats.channels[channel] || 0) + 1;
    }
  }
  stats.users = [...stats.users].length;

  res.json({ success: true, stats });
});

app.post('/broadcast', (req, res) => {
  const { channel, message } = req.body;

  if (!channel || !message) {
    return res.status(400).json({ error: 'channel and message required' });
  }

  broadcast(channel, message);

  res.json({ success: true, clientsNotified: clients.size });
});

app.post('/send/:userId', (req, res) => {
  const { userId } = req.params;
  const { message } = req.body;

  sendToUser(userId, message);

  res.json({ success: true });
});

const PORT = process.env.PORT || 4094;

async function start() {
  await initRedis();
  await setupRedisPubSub();

  server.listen(PORT, () => {
    logger.info(`Realtime Gateway running on port ${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
    console.log(`HTTP: http://localhost:${PORT}`);
  });
}

start();
