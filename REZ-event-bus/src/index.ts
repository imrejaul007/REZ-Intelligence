/**
 * REZ Event Bus Service
 *
 * Central event routing and pub/sub
 * Port: 4031
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectRedis, redis, publisher } from './config/redis';
import { eventRoutes } from './routes/event.routes';
import { subscriptionRoutes } from './routes/subscription.routes';
import { EventBusService } from './services/EventBusService';

const app = express();
const PORT = process.env.PORT || 4031;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize service
const eventBusService = new EventBusService();

// Health check
app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    res.json({
      service: 'event-bus',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy' });
  }
});

app.get('/ready', async (req, res) => {
  try {
    await redis.ping();
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

// Routes
app.use('/api/events', eventRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  const stats = await eventBusService.getStats();
  res.json(stats);
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Event Bus Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    // Connect to Redis
    await connectRedis();

    // Initialize service
    await eventBusService.initialize();

    // Start server
    app.listen(PORT, () => {
      console.log(`Event Bus Service listening on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

start();

export default app;
