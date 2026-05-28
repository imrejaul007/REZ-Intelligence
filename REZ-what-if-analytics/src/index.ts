import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import scenarioRoutes from './routes/scenarioRoutes.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 4193;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_whatif_analytics';

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'rez-what-if-analytics', timestamp: new Date().toISOString() });
});

app.use('/api', scenarioRoutes);

app.post('/api/batch-simulate', async (req, res) => {
  try {
    const { scenarios } = req.body;
    if (!Array.isArray(scenarios)) {
      return res.status(400).json({ success: false, error: 'scenarios must be an array' });
    }

    const results = await Promise.all(scenarios.map(async (scenario) => {
      const { simulationEngine } = await import('./services/simulationEngine.js');
      return simulationEngine.runScenario(scenario);
    }));

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Batch simulate error:', error);
    res.status(500).json({ success: false, error: 'Batch simulation failed' });
  }
});

app.get('/api/templates', (req, res) => {
  const templates = [
    {
      id: 'pricing-increase-10',
      name: 'Price Increase 10%',
      description: 'Simulate impact of 10% price increase',
      type: 'pricing',
      parameters: { metric: 'revenue', changePercent: 10, timeHorizon: 'month' }
    },
    {
      id: 'promotion-20-off',
      name: '20% Promotion Discount',
      description: 'Simulate 20% discount campaign',
      type: 'promotion',
      parameters: { metric: 'revenue', changePercent: -15, timeHorizon: 'week' }
    },
    {
      id: 'traffic-increase-50',
      name: '50% Traffic Increase',
      description: 'Simulate major foot traffic boost',
      type: 'demand',
      parameters: { metric: 'customers', changePercent: 50, timeHorizon: 'month' }
    },
    {
      id: 'new-product-launch',
      name: 'New Product Launch',
      description: 'Simulate launching a new product line',
      type: 'inventory',
      parameters: { metric: 'units_sold', changePercent: 25, timeHorizon: 'quarter' }
    },
    {
      id: 'customer-acquisition-campaign',
      name: 'Customer Acquisition Push',
      description: 'Simulate aggressive customer acquisition',
      type: 'customer',
      parameters: { metric: 'customers', changePercent: 30, timeHorizon: 'month' }
    }
  ];
  res.json({ success: true, data: templates });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`REZ What-If Analytics running on port ${PORT}`);
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
