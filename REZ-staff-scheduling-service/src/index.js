import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import staffRoutes from './routes/staffRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 4067;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-staff-scheduling';

const logger = {
  info: (m, meta = {}) => console.log(`[${new Date().toISOString()}] INFO: ${m}`, JSON.stringify(meta)),
  error: (m, meta = {}) => console.error(`[${new Date().toISOString()}] ERROR: ${m}`, JSON.stringify(meta))
};

const staffSchema = new mongoose.Schema({
  staffId: { type: String, required: true, unique: true },
  employeeId: String,
  name: { type: String, required: true },
  email: String,
  phone: String,
  role: { type: String, required: true },
  department: String,
  locationId: { type: String, index: true },
  franchiseId: String,
  employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'temporary'], default: 'full_time' },
  hourlyRate: Number,
  status: { type: String, enum: ['active', 'inactive', 'on_leave', 'terminated'], default: 'active' },
  skills: [String],
  certifications: [String],
  availability: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

staffSchema.index({ locationId: 1, status: 1 });
const Staff = mongoose.model('Staff', staffSchema);

const scheduleSchema = new mongoose.Schema({
  scheduleId: { type: String, required: true, unique: true },
  locationId: { type: String, required: true, index: true },
  franchiseId: String,
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  publishedAt: Date,
  createdBy: String,
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

scheduleSchema.index({ locationId: 1, weekStart: 1 });
const Schedule = mongoose.model('Schedule', scheduleSchema);

const shiftSchema = new mongoose.Schema({
  shiftId: { type: String, required: true, unique: true },
  scheduleId: { type: String, required: true, index: true },
  staffId: { type: String, required: true, index: true },
  locationId: { type: String, required: true },
  role: { type: String, required: true },
  date: { type: Date, required: true, index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  breakMinutes: { type: Number, default: 0 },
  totalHours: Number,
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },
  notes: String,
  timesheet: {
    clockIn: Date,
    clockOut: Date,
    hoursWorked: Number,
    overtimeHours: Number
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

shiftSchema.index({ staffId: 1, date: 1 });
shiftSchema.index({ locationId: 1, date: 1 });
shiftSchema.index({ status: 1 });
const Shift = mongoose.model('Shift', shiftSchema);

const timeOffSchema = new mongoose.Schema({
  timeOffId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  type: { type: String, enum: ['vacation', 'sick', 'personal', 'other'], required: true },
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  approvedBy: String,
  approvedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

timeOffSchema.index({ staffId: 1, startDate: 1, endDate: 1 });
const TimeOff = mongoose.model('TimeOff', timeOffSchema);

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

app.use('/api/staff', internalAuth, staffRoutes);
app.use('/api/schedules', internalAuth, scheduleRoutes);
app.use('/api/shifts', internalAuth, shiftRoutes);
app.get('/api/staff/health', (_req, res) => res.json({ success: true, status: 'healthy', service: 'rez-staff-scheduling-service' }));
app.get('/', (_req, res) => res.json({ service: 'REZ Staff Scheduling Service', version: '1.0.0', port: PORT }));
app.use((err, _req, res) => res.status(500).json({ success: false, error: err.message }));

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { maxPoolSize: 10 });
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => logger.info(`REZ Staff Scheduling Service started on port ${PORT}`));
    process.on('SIGTERM', async () => { await mongoose.connection.close(); process.exit(0); });
  } catch (error) {
    logger.error('Failed to start', { error: error.message });
    process.exit(1);
  }
}

export { app, Staff, Schedule, Shift, TimeOff };
main();
