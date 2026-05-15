/**
 * RFM++ Service
 * Advanced customer segmentation beyond RFM
 */

import express from 'express';
import mongoose from 'mongoose';
import { rfmService } from './services/rfmService';

const app = express();
const PORT = process.env.PORT || 4055;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rfm-plus';

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rfm-plus' });
});

app.post('/api/customers/:id/rfm', async (req, res) => {
  const { transactions } = req.body;
  const result = await rfmService.updateCustomerRFM(req.params.id, transactions || []);
  res.json(result);
});

app.get('/api/customers/:id/segments', async (req, res) => {
  const segment = await rfmService.assignSegment(req.params.id);
  const ltv = await rfmService.predictLTV(req.params.id);
  const churn = await rfmService.detectChurnRisk(req.params.id);
  res.json({ segment, ltv, churnRisk: churn });
});

app.get('/api/cohorts/:date', async (req, res) => {
  const date = new Date(req.params.date);
  const cohort = await rfmService.analyzeCohort(date);
  res.json(cohort);
});

app.post('/api/recalculate', async (_req, res) => {
  const result = await rfmService.recalculateAll();
  res.json(result);
});

app.listen(PORT, () => console.log(`RFM++ on ${PORT}`));

mongoose.connect(MONGODB_URI).then(() => console.log('MongoDB connected'));
