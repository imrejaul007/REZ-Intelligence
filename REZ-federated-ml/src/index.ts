import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import flRoutes from './routes/flRoutes.js';
import { nodeManager } from './services/nodeManager.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4194;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_federated_ml';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-federated-ml',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', flRoutes);

app.get('/api/stats', (req, res) => {
  const nodeStats = nodeManager.getNodeStats();
  res.json({
    success: true,
    data: {
      nodes: nodeStats,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  });
});

app.use((err, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    setInterval(() => {
      const health = nodeManager.checkNodeHealth();
      if (health.unhealthy.length > 0) {
        logger.warn(`Unhealthy nodes detected: ${health.unhealthy.length}`);
      }
    }, 60000);

    app.listen(PORT, () => {
      logger.info(`REZ Federated ML running on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

start();

export default app;
