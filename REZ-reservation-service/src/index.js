import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import reservationRoutes from './routes/reservationRoutes.js';
import tableRoutes from './routes/tableRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 4065;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-reservation-service';

const logger = {
  info: (m, meta = {}) => console.log(`[${new Date().toISOString()}] INFO: ${m}`, JSON.stringify(meta)),
  error: (m, meta = {}) => console.error(`[${new Date().toISOString()}] ERROR: ${m}`, JSON.stringify(meta))
};

const restaurantSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  franchiseId: String,
  locationId: String,
  address: { street: String, city: String, state: String },
  contact: { phone: String, email: String },
  settings: {
    reservationDuration: { type: Number, default: 90 },
    maxAdvanceDays: { type: Number, default: 30 },
    minPartySize: { type: Number, default: 1 },
    maxPartySize: { type: Number, default: 20 },
    allowWaitlist: { type: Boolean, default: true },
    requiresDeposit: { type: Boolean, default: false }
  },
  operatingHours: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const Table = mongoose.model('Table', restaurantSchema);

const tableSchema = new mongoose.Schema({
  tableId: { type: String, required: true, unique: true },
  restaurantId: { type: String, required: true, index: true },
  tableNumber: { type: String, required: true },
  capacity: { min: { type: Number, default: 1 }, max: { type: Number, default: 4 } },
  location: { type: String, enum: ['indoor', 'outdoor', 'private', 'bar'], default: 'indoor' },
  status: { type: String, enum: ['available', 'reserved', 'occupied', 'maintenance'], default: 'available' },
  createdAt: { type: Date, default: Date.now }
});

tableSchema.index({ restaurantId: 1, status: 1 });
const TableModel = mongoose.model('TableModel', tableSchema);

const reservationSchema = new mongoose.Schema({
  reservationId: { type: String, required: true, unique: true },
  restaurantId: { type: String, required: true, index: true },
  tableId: String,
  customerId: String,
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: String,
  partySize: { type: Number, required: true },
  dateTime: { type: Date, required: true, index: true },
  duration: { type: Number, default: 90 },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  specialRequests: String,
  occasion: String,
  notes: String,
  depositPaid: { type: Boolean, default: false },
  depositAmount: Number,
  reminderSent: { type: Boolean, default: false },
  timeline: [{ status: String, timestamp: { type: Date, default: Date.now }, notes: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

reservationSchema.index({ restaurantId: 1, dateTime: 1, status: 1 });
reservationSchema.index({ customerId: 1 });
const Reservation = mongoose.model('Reservation', reservationSchema);

const app = express();
app.use(helmet(), cors(), compression());
app.use(express.json({ limit: '10mb' }));
app.use((req, _res, next) => { logger.info(`${req.method} ${req.path}`); next(); });

function internalAuth(req, res, next) {
  if (!req.headers['x-internal-token'] || req.headers['x-internal-token'] !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

app.use('/api/reservations', internalAuth, reservationRoutes);
app.use('/api/tables', internalAuth, tableRoutes);
app.use('/api/restaurants', internalAuth, restaurantRoutes);

app.get('/api/reservations/health', (_req, res) => res.json({ success: true, status: 'healthy', service: 'rez-reservation-service' }));
app.get('/', (_req, res) => res.json({ service: 'REZ Reservation Service', version: '1.0.0', port: PORT }));
app.use((err, _req, res, _next) => res.status(500).json({ success: false, error: err.message }));

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { maxPoolSize: 10 });
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => logger.info(`REZ Reservation Service started on port ${PORT}`));
    process.on('SIGTERM', async () => { await mongoose.connection.close(); process.exit(0); });
  } catch (error) {
    logger.error('Failed to start', { error: error.message });
    process.exit(1);
  }
}

export { app, Restaurant, TableModel, Reservation };
main();
