/**
 * REZ Fleet Management - Main Entry
 */

import express import logger from './utils/logger';
import from 'express';
import { routingService } from './services/RoutingService';
import { surgePricingService } from './services/SurgePricingService';
import { incentiveService } from './services/IncentiveService';

const app = express();
const PORT = process.env.PORT || 4016;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'rez-fleet-management' });
});

// Routes
app.post('/api/routes/calculate', async (req, res) => {
  try {
    const { rider, orders } = req.body;
    const result = await routingService.calculateOptimalRoute(rider, orders);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/routes/assign', async (req, res) => {
  try {
    const { order, riders } = req.body;
    const rider = await routingService.findNearestRider(order, riders);
    res.json({ rider });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/surge/calculate', async (req, res) => {
  try {
    const { activeRiders, pendingOrders } = req.body;
    const multiplier = surgePricingService.calculateSurge(activeRiders, pendingOrders);
    res.json({ multiplier });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(PORT, () => {
  logger.info(`Fleet Management running on port ${PORT}`);
});

export default app;
