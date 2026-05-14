import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import waitlistRoutes from './routes/waitlistRoutes.js';
import queueRoutes from './routes/queueRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 4066;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-waitlist-service';

const logger = {
  info: (m, meta = {}) => console.log(`[${new Date().toISOString()}] INFO: ${m}`, JSON.stringify(meta)),
  error: (m, meta = {}) => console.error(`[${new Date().toISOString()}] ERROR: ${m}`, JSON.stringify(meta))
};

const queueSchema = new mongoose.Schema({
  queueId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  locationId: { type: String, index: true },
  franchiseId: String,
  type: { type: String, enum: ['dining', 'service', 'retail', 'events'], default: 'dining' },
  status: { type: String, enum: ['active', 'paused', 'closed'], default: 'active' },
  settings: {
    estimatedWaitPerCustomer: { type: Number, default: 15 },
    maxQueueSize: Number,
    allowCallAhead: { type: Boolean, default: true },
    sendNotifications: { type: Boolean, default: true }
  },
  stats: {
    totalServed: { type: Number, default: 0 },
    averageWaitTime: { type: Number, default: 0 },
    peakQueueSize: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

const Queue = mongoose.model('Queue', queueSchema);

const entrySchema = new mongoose.Schema({
  entryId: { type: String, required: true, unique: true },
  queueId: { type: String, required: true, index: true },
  customerId: String,
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  partySize: { type: Number, default: 1 },
  position: { type: Number, required: true },
  status: {
    type: String,
    enum: ['waiting', 'called', 'seated', 'cancelled', 'no_show'],
    default: 'waiting'
  },
  estimatedWait: Number,
  actualWait: Number,
  calledAt: Date,
  seatedAt: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

entrySchema.index({ queueId: 1, status: 1, position: 1 });
entrySchema.index({ customerId: 1 });

const Entry = mongoose.model('Entry', entrySchema);

const app = express();
app.use(helmet(), cors(), compression());
app.use(express.json());

app.use((req, _res, next) => { logger.info(`${req.method} ${req.path}`); next(); });

function internalAuth(req, res, next) {
  if (!req.headers['x-internal-token'] || req.headers['x-internal-token'] !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

app.use('/api/waitlist', internalAuth, waitlistRoutes);
app.use('/api/queues', internalAuth, queueRoutes);
app.get('/api/waitlist/health', (_req, res) => res.json({ success: true, status: 'healthy', service: 'rez-waitlist-service' }));
app.get('/', (_req, res) => res.json({ service: 'REZ Waitlist Service', version: '1.0.0', port: PORT }));
app.use((err, _req, res) => res.status(500).json({ success: false, error: err.message }));

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { maxPoolSize: 10 });
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => logger.info(`REZ Waitlist Service started on port ${PORT}`));
    process.on('SIGTERM', async () => { await mongoose.connection.close(); process.exit(0); });
  } catch (error) {
    logger.error('Failed to start', { error: error.message });
    process.exit(1);
  }
}

export { app, Queue, Entry };
main();
